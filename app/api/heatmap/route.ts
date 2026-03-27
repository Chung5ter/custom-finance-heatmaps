/**
 * /api/heatmap — Server-side market data endpoint
 *
 * Query params:
 *   watchlist  — watchlist id (default: "sp500")
 *   startDate  — "YYYY-MM-DD"
 *   endDate    — "YYYY-MM-DD"
 *   mode       — ReturnMode (default: "START_OPEN_TO_END_CLOSE")
 *   adjusted   — "true" | "false" (default: "false")
 *
 * API keys never leave the server — they are only read from process.env here.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/market-data";
import type { ReturnMode } from "@/lib/market-data";
import { calculatePerformance } from "@/lib/market-data/calculator";
import { getCached, setCached, makeCandleCacheKey } from "@/lib/market-data/cache";
import { getWatchlist, DEFAULT_WATCHLIST_ID } from "@/lib/universe/instruments";
import type { DailyCandle, LiveQuoteMeta } from "@/lib/market-data/providers/types";

// Use mock data when Polygon API key is not set (for local dev without an API key)
// Yahoo Finance requires no API key, so mock mode only activates when explicitly requested.
const USE_MOCK = process.env.USE_MOCK_DATA === "true";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const watchlistId = searchParams.get("watchlist") ?? DEFAULT_WATCHLIST_ID;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const returnMode = (searchParams.get("mode") ?? "START_OPEN_TO_END_CLOSE") as ReturnMode;
  const adjusted = searchParams.get("adjusted") === "true";

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { error: "startDate must be before or equal to endDate" },
      { status: 400 }
    );
  }

  // Reject requests where the entire range is in the future — no candles will exist.
  // "Today" on the server is UTC; markets close at ~21:00 UTC (4pm ET) so this is
  // a safe ceiling for EOD data. The UI also enforces max=today on date pickers.
  const todayUTC = new Date().toISOString().slice(0, 10);
  if (startDate > todayUTC) {
    return NextResponse.json(
      { error: "Selected date range is in the future. No market data is available yet.", code: "FUTURE_RANGE" },
      { status: 400 }
    );
  }

  // Silently clamp endDate to today if the range straddles the present.
  // e.g. a "Week of" pick where Friday hasn't happened yet → use today's close instead.
  const clampedEndDate = endDate > todayUTC ? todayUTC : endDate;

  // Custom bucket support: if ?symbols=AAPL,MSFT,... is present, use that list
  // directly instead of a predefined watchlist. Symbols are uppercased and capped at 50.
  const rawSymbolsParam = searchParams.get("symbols");
  const isCustom = !!rawSymbolsParam;
  const customSymbols = rawSymbolsParam
    ? rawSymbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 50)
    : null;

  const watchlist = getWatchlist(watchlistId);

  // Build the instrument list: custom symbols get minimal metadata (no sector/shares);
  // any symbol that also exists in the predefined universe inherits its full metadata.
  const universeMap = new Map(watchlist.instruments.map((i) => [i.symbol, i]));
  const instruments = isCustom && customSymbols
    ? customSymbols.map((sym) => universeMap.get(sym) ?? {
        symbol: sym,
        name: sym,
        sector: undefined as unknown as string,
        type: "stock" as const,
        marketCapBucket: undefined,
      })
    : watchlist.instruments;

  const symbols = instruments.map((i) => i.symbol);
  const cacheId = isCustom ? `custom:${symbols.join(",")}` : `batch:${watchlistId}`;

  try {
    let batchCandles: Record<string, DailyCandle[] | null>;
    // Declared here so it's accessible for the quote-meta enrichment step below.
    const provider = USE_MOCK ? null : getProvider();

    if (USE_MOCK) {
      // Generate mock candles for UI development without a real API key
      batchCandles = generateMockCandles(symbols, startDate, endDate);
    } else {
      // Check cache first
      const cacheKey = makeCandleCacheKey(cacheId, startDate, clampedEndDate, adjusted);
      const cached = getCached<Record<string, DailyCandle[] | null>>(cacheKey);

      if (cached) {
        batchCandles = cached;
      } else {
        batchCandles = await provider!.fetchBatchCandles({ symbols, startDate, endDate: clampedEndDate, adjusted });
        // Only cache if every symbol returned data — a partial result means one or
        // more calls were rate-limited and should be retried on the next request.
        const isComplete = symbols.every((s) => batchCandles[s] !== null);
        if (isComplete) {
          // Historical ranges (both dates before today) never change — cache for 1 hour.
          // Ranges that include today may update as the session progresses — 5 minutes.
          const isFullyHistorical = clampedEndDate < todayUTC;
          const ttl = isFullyHistorical ? 60 * 60 * 1000 : 5 * 60 * 1000;
          setCached(cacheKey, batchCandles, ttl);
        }
      }
    }

    // Calculate performance for each instrument
    const results = instruments.map((instrument) => {
      const candles = batchCandles[instrument.symbol] ?? [];
      const calcResult = calculatePerformance({
        symbol: instrument.symbol,
        meta: {
          symbol: instrument.symbol,
          name: instrument.name,
          type: instrument.type,
          sector: instrument.sector,
          industry: instrument.industry,
          // marketCap is computed in the calculator from endClose × sharesOutstanding
          sharesOutstanding: instrument.sharesOutstanding,
          marketCap: undefined,
        },
        candles,
        userStartDate: startDate,
        userEndDate: clampedEndDate,
        returnMode,
      });

      return {
        ...calcResult.instrument,
        error: calcResult.error ?? null,
        // Include bucket weight from universe config for treemap sizing
        marketCapBucket: instrument.marketCapBucket ?? "mid",
      };
    });

    // ── Live quote enrichment for custom buckets ───────────────────────────────
    // Custom symbols aren't in the predefined universe, so they lack sector,
    // industry, name, and market cap. Fetch all of these via Yahoo quoteSummary.
    // Extract the bound method so TypeScript can narrow it to a plain function.
    const fetchBatchQuoteMeta = provider?.fetchBatchQuoteMeta?.bind(provider);
    if (!USE_MOCK && isCustom && fetchBatchQuoteMeta) {
      // Only enrich symbols that are missing metadata (not already in the universe).
      const needsEnrichment = results
        .filter((r) => !r.error && (!r.sector || !r.marketCap))
        .map((r) => r.symbol);

      if (needsEnrichment.length > 0) {
        const metaCacheKey = `quotemeta:${needsEnrichment.slice().sort().join(",")}`;
        let quoteMeta = getCached<Record<string, LiveQuoteMeta | null>>(metaCacheKey);

        if (!quoteMeta) {
          quoteMeta = await fetchBatchQuoteMeta(needsEnrichment);
          // Quote meta doesn't need to be as fresh as candle data — 5 min is fine.
          setCached(metaCacheKey, quoteMeta, 5 * 60 * 1000);
        }

        for (const r of results) {
          const meta = quoteMeta[r.symbol];
          if (!meta) continue;
          if (!r.marketCap && meta.marketCap) r.marketCap = meta.marketCap;
          if (!r.sector    && meta.sector)    r.sector    = meta.sector;
          if (!r.industry  && meta.industry)  r.industry  = meta.industry;
          // Only overwrite name if it's still just the raw ticker (our unknown-symbol fallback)
          if (r.name === r.symbol && meta.name) r.name = meta.name;
          if (!r.currency  && meta.currency)  r.currency  = meta.currency;
        }
      }
    }

    return NextResponse.json({
      watchlistId,
      watchlistLabel: watchlist.label,
      startDate,
      endDate,
      returnMode,
      isMockData: USE_MOCK,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message.includes("rate limit") || message.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait and try again.", code: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    console.error("[heatmap API]", err);
    return NextResponse.json(
      { error: "Failed to fetch market data", detail: message },
      { status: 500 }
    );
  }
}

// ─── Mock data generator (dev without API key) ────────────────────────────────
function generateMockCandles(
  symbols: string[],
  startDate: string,
  endDate: string
): Record<string, DailyCandle[]> {
  const result: Record<string, DailyCandle[]> = {};

  for (const symbol of symbols) {
    const candles: DailyCandle[] = [];
    // Seed random price based on symbol name for consistency
    const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    let price = 50 + (seed % 450); // $50–$500

    let current = startDate;
    while (current <= endDate) {
      const d = new Date(current + "T12:00:00Z");
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) {
        // Simulate realistic OHLC
        const change = (Math.random() - 0.48) * price * 0.025;
        const open = price;
        const close = Math.max(1, price + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);

        candles.push({
          date: current,
          open: +open.toFixed(2),
          high: +high.toFixed(2),
          low: +low.toFixed(2),
          close: +close.toFixed(2),
          volume: Math.floor(Math.random() * 50_000_000) + 1_000_000,
        });
        price = close;
      }

      // advance day
      const next = new Date(current + "T12:00:00Z");
      next.setUTCDate(next.getUTCDate() + 1);
      current = next.toISOString().slice(0, 10);
    }

    result[symbol] = candles;
  }

  return result;
}
