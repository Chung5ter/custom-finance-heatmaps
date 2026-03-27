/**
 * Yahoo Finance Market Data Provider
 *
 * WHY YAHOO FOR HISTORICAL DATA:
 * - No API key, no rate limits, fully concurrent fetching.
 * - Mag7 cold-cache load: ~500 ms (all 7 in parallel).
 * - Historical EOD data is reliable and widely used in production finance tools.
 * - Instability concerns apply to real-time/streaming; historical OHLC is stable.
 *
 * TRADEOFFS ACCEPTED:
 * - Unofficial API — Yahoo can change endpoints without notice.
 * - No SLA; not suitable for regulated/commercial production.
 * - adjClose is included but labelled clearly (Yahoo adjusts for splits + dividends).
 * - For START_OPEN_TO_END_CLOSE we use raw open + raw close (not adjClose).
 *
 * HOW TO SWAP PROVIDERS:
 * Change the active import in /lib/market-data/index.ts.
 *
 * ENDPOINT:
 *   GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
 *     ?interval=1d
 *     &period1={unix_seconds_start}
 *     &period2={unix_seconds_end}
 *     &events=history
 *     &includePrePost=false
 *
 * RESPONSE SHAPE (abbreviated):
 *   chart.result[0].timestamp          — array of Unix seconds (UTC)
 *   chart.result[0].indicators.quote[0] — { open, high, low, close, volume } (parallel arrays)
 *   chart.result[0].indicators.adjclose[0].adjclose — parallel adjClose array
 *
 * DATE HANDLING:
 *   Yahoo timestamps represent midnight ET (or thereabouts). We convert to "YYYY-MM-DD"
 *   by formatting in the America/New_York timezone, matching how Yahoo labels dates.
 *   This prevents the off-by-one that `.toISOString().slice(0,10)` (UTC) can cause for
 *   US market dates when the server is in a different timezone.
 */

import type {
  MarketDataProvider,
  DailyCandle,
  FetchCandlesParams,
  FetchBatchCandlesParams,
  BatchCandleResult,
  InstrumentMeta,
  LiveQuoteMeta,
} from "./types";

// Fire all requests in parallel — Yahoo has no documented rate limit.
const MAX_CONCURRENT = 10;

// ─── Yahoo response shapes ────────────────────────────────────────────────────

// quoteSummary response shapes (used for live meta enrichment)
interface YahooQuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      price?: {
        marketCap?: { raw?: number };
        shortName?: string;
        longName?: string;
        currency?: string;
      };
      assetProfile?: {
        sector?: string;
        industry?: string;
      };
    }>;
    error?: unknown;
  };
}

interface YahooQuote {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  volume: (number | null)[];
}

interface YahooResult {
  timestamp?: number[];
  indicators?: {
    quote?: YahooQuote[];
    adjclose?: { adjclose?: (number | null)[] }[];
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooResult[];
    error?: { code: string; description: string } | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert "YYYY-MM-DD" to Unix seconds (midnight UTC, safe for period1/period2). */
function dateToUnix(dateStr: string): number {
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

/**
 * Format a Unix-second timestamp as "YYYY-MM-DD" in America/New_York.
 * Yahoo bar timestamps represent the trading date in ET, so we must format
 * in ET rather than UTC to avoid date shifting near midnight.
 */
function unixToDateET(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }); // en-CA gives ISO-style "YYYY-MM-DD"
}

async function yahooFetch(symbol: string, startDate: string, endDate: string): Promise<DailyCandle[]> {
  // period2 = end of the last day requested (add 1 day to be inclusive)
  const period1 = dateToUnix(startDate);
  const period2 = dateToUnix(endDate) + 86400; // +1 day to include endDate

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}` +
    `?interval=1d&period1=${period1}&period2=${period2}&events=history&includePrePost=false`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      // Required: Yahoo returns 401 without a User-Agent
      "User-Agent": "Mozilla/5.0 (compatible; finance-heatmap/1.0)",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status} for ${symbol}`);
  }

  const data: YahooChartResponse = await res.json();

  if (data.chart?.error) {
    throw new Error(`Yahoo Finance error for ${symbol}: ${data.chart.error.description}`);
  }

  const result = data.chart?.result?.[0];
  if (!result?.timestamp || !result.indicators?.quote?.[0]) return [];

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  const adjCloseArr = result.indicators.adjclose?.[0]?.adjclose;

  const candles: DailyCandle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];

    // Skip bars where core fields are null (Yahoo sometimes returns null for missing days)
    if (open == null || close == null) continue;

    candles.push({
      date: unixToDateET(timestamps[i]),
      open,
      high: high ?? open,
      low: low ?? open,
      close,
      volume: volume ?? 0,
      // Yahoo adjClose is adjusted for splits + dividends.
      // Only used when returnMode === "ADJ_CLOSE_TO_ADJ_CLOSE".
      adjClose: adjCloseArr?.[i] ?? undefined,
    });
  }

  // Yahoo returns ascending order; sort to be safe
  return candles.sort((a, b) => a.date.localeCompare(b.date));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class YahooProvider implements MarketDataProvider {
  readonly name = "yahoo";

  // Crumb + cookie needed for quoteSummary (profile-level data).
  // Cached per provider instance; refreshed after 30 min or on 401.
  private crumb: string | null = null;
  private cookieJar: string | null = null;
  private crumbFetchedAt = 0;
  private static readonly CRUMB_TTL_MS = 30 * 60 * 1000;

  constructor() {}

  /**
   * Obtain a Yahoo crumb + session cookie.
   * Flow: fc.yahoo.com → set-cookie → /v1/test/getcrumb → crumb string.
   * The crumb must be sent as ?crumb=... and the cookie as Cookie: ... on
   * all subsequent quoteSummary calls.
   */
  private async ensureCrumb(): Promise<{ crumb: string; cookie: string } | null> {
    const now = Date.now();
    if (
      this.crumb &&
      this.cookieJar &&
      now - this.crumbFetchedAt < YahooProvider.CRUMB_TTL_MS
    ) {
      return { crumb: this.crumb, cookie: this.cookieJar };
    }

    try {
      // Step 1: Hit fc.yahoo.com to get a session cookie
      const fcRes = await fetch("https://fc.yahoo.com/", {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; finance-heatmap/1.0)" },
      });

      // getSetCookie() returns each Set-Cookie header as its own string (Node 18+).
      // Fall back to splitting the combined header for older runtimes.
      const rawCookies: string[] =
        typeof (fcRes.headers as unknown as { getSetCookie?(): string[] }).getSetCookie === "function"
          ? (fcRes.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
          : (fcRes.headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).filter(Boolean);

      const cookieString = rawCookies.map((c) => c.split(";")[0]).join("; ");

      // Step 2: Exchange cookie for crumb
      const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; finance-heatmap/1.0)",
          "Cookie": cookieString,
        },
      });

      if (!crumbRes.ok) {
        console.error(`[Yahoo] getcrumb HTTP ${crumbRes.status}`);
        return null;
      }

      const crumb = (await crumbRes.text()).trim();
      if (!crumb || crumb.startsWith("{")) {
        console.error("[Yahoo] getcrumb returned unexpected value:", crumb.slice(0, 80));
        return null;
      }

      this.crumb = crumb;
      this.cookieJar = cookieString;
      this.crumbFetchedAt = now;
      return { crumb, cookie: cookieString };
    } catch (err) {
      console.error("[Yahoo] ensureCrumb failed:", err);
      return null;
    }
  }

  async fetchCandles(params: FetchCandlesParams): Promise<DailyCandle[]> {
    return yahooFetch(params.symbol, params.startDate, params.endDate);
  }

  /** All tickers in parallel — Yahoo has no burst limit. */
  async fetchBatchCandles(params: FetchBatchCandlesParams): Promise<BatchCandleResult> {
    const { symbols, startDate, endDate } = params;
    const result: BatchCandleResult = {};

    for (let i = 0; i < symbols.length; i += MAX_CONCURRENT) {
      const chunk = symbols.slice(i, i + MAX_CONCURRENT);

      await Promise.all(
        chunk.map(async (symbol) => {
          try {
            const candles = await yahooFetch(symbol, startDate, endDate);
            result[symbol] = candles.length > 0 ? candles : null;
          } catch (err) {
            console.error(`[Yahoo] Failed to fetch ${symbol}:`, err);
            result[symbol] = null;
          }
        })
      );

      if (i + MAX_CONCURRENT < symbols.length) {
        await sleep(50); // tiny gap between chunks, purely courtesy
      }
    }

    return result;
  }

  async fetchMeta(_symbol: string): Promise<InstrumentMeta | null> {
    // Yahoo's quote summary endpoint could provide this, but sector/industry
    // are already supplied by our universe config — skip the extra call.
    return null;
  }

  /**
   * Fetch live quote metadata (market cap, sector, industry, name) for multiple
   * symbols concurrently via Yahoo's quoteSummary endpoint.
   *
   * WHY quoteSummary and not v7/finance/quote:
   *   v7/finance/quote is a price-tick endpoint — it returns regularMarketCap but
   *   does NOT return sector/industry (those are profile-level data). The
   *   quoteSummary `assetProfile` module is the reliable source for sector.
   *   We request `price,assetProfile` in one call per symbol and run all in parallel.
   *
   * Used to enrich custom bucket instruments that aren't in the predefined universe.
   */
  async fetchBatchQuoteMeta(symbols: string[]): Promise<Record<string, LiveQuoteMeta | null>> {
    const out: Record<string, LiveQuoteMeta | null> = Object.fromEntries(
      symbols.map((s) => [s, null])
    );

    if (symbols.length === 0) return out;

    const auth = await this.ensureCrumb();

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
          const url =
            `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
            `?modules=price,assetProfile${crumbParam}`;

          const res = await fetch(url, {
            cache: "no-store",
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; finance-heatmap/1.0)",
              "Accept": "application/json",
              ...(auth ? { "Cookie": auth.cookie } : {}),
            },
          });

          if (!res.ok) {
            console.error(`[Yahoo] quoteSummary HTTP ${res.status} for ${symbol}`);
            return;
          }

          const data: YahooQuoteSummaryResponse = await res.json();
          const result = data.quoteSummary?.result?.[0];
          if (!result) return;

          out[symbol] = {
            marketCap:  result.price?.marketCap?.raw,
            sector:     result.assetProfile?.sector,
            industry:   result.assetProfile?.industry,
            name:       result.price?.shortName ?? result.price?.longName,
            currency:   result.price?.currency,
          };
        } catch (err) {
          console.error(`[Yahoo] fetchBatchQuoteMeta failed for ${symbol}:`, err);
        }
      })
    );

    return out;
  }
}
