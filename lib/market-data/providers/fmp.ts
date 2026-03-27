/**
 * Financial Modeling Prep (FMP) Market Data Provider
 *
 * WHY FMP:
 * - No burst throttle on the free tier (unlike Polygon free which serialises to ~1 req/s).
 * - Reliable, well-maintained REST API with clear upgrade path.
 * - Free tier: 250 calls/day. At 10 concurrent with no delay, Mag7 loads in one round-trip.
 * - Stable endpoint (`/stable/historical-price-eod/full`) is the current (post-Aug 2025) API.
 *
 * TRADEOFFS ACCEPTED:
 * - Multi-ticker bulk on a single call is a paid feature — we fan out per-ticker concurrently.
 * - Free tier: 250 calls/day (~35 Mag7 loads/day, ~5 S&P-50 loads/day).
 * - Paid Starter ($19/mo): 300 calls/min — essentially unlimited for this use case.
 * - History on free tier: ~5 years (ample for most heatmap date ranges).
 *
 * HOW TO SWAP PROVIDERS:
 * Change the active import in /lib/market-data/index.ts. All providers share
 * the MarketDataProvider interface — no UI or calculator changes required.
 *
 * SIGN UP: https://financialmodelingprep.com/developer/docs (free key, instant)
 *
 * RESPONSE FORMAT (stable endpoint):
 *   GET /stable/historical-price-eod/full?symbol=AAPL&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   → Array<{ symbol, date, open, high, low, close, volume, change, changePercent, vwap }>
 *   Bars are returned in DESCENDING date order — we sort ascending before returning.
 *   Dates are calendar dates (exchange local ET) — treated identically to Polygon/Tiingo labels.
 *   Raw OHLC only on free tier; adjClose not present (paid plan feature).
 *   For START_OPEN_TO_END_CLOSE we use raw open + raw close — no silent mixing.
 */

import type {
  MarketDataProvider,
  DailyCandle,
  FetchCandlesParams,
  FetchBatchCandlesParams,
  BatchCandleResult,
  InstrumentMeta,
} from "./types";

const BASE_URL = "https://financialmodelingprep.com";

// Fire this many single-ticker requests in parallel.
// FMP free has no burst throttle — 10 concurrent is safe.
const MAX_CONCURRENT = 10;

// ─── FMP stable response shape ────────────────────────────────────────────────

interface FMPStableBar {
  symbol: string;
  date: string;        // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change?: number;
  changePercent?: number;
  vwap?: number;
  // adjClose not present on free tier
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBar(bar: FMPStableBar): DailyCandle {
  return {
    date: bar.date,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  };
}

async function fmpFetch<T>(path: string, apiKey: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${sep}apikey=${apiKey}`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FMP API ${res.status}: ${body.slice(0, 200)}`);
  }

  const text = await res.text();
  if (!text || text.trim() === "") {
    throw new Error("FMP returned empty response");
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`FMP non-JSON response: ${text.slice(0, 200)}`);
  }

  // FMP signals errors as plain strings or objects with an "Error Message" key
  if (typeof data === "string" && data.toLowerCase().includes("error")) {
    throw new Error(`FMP error: ${data.slice(0, 200)}`);
  }
  if (data && typeof data === "object" && "Error Message" in (data as object)) {
    throw new Error(`FMP error: ${(data as { "Error Message": string })["Error Message"]}`);
  }
  // Premium-gate signals come back as plain text (non-JSON) starting with "Premium"
  if (typeof data === "string" && data.startsWith("Premium")) {
    throw new Error(`FMP plan limit: ${data.slice(0, 200)}`);
  }

  return data as T;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class FMPProvider implements MarketDataProvider {
  readonly name = "fmp";
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("FMP_API_KEY is not set");
    this.apiKey = apiKey;
  }

  async fetchCandles(params: FetchCandlesParams): Promise<DailyCandle[]> {
    const { symbol, startDate, endDate } = params;
    const path = `/stable/historical-price-eod/full?symbol=${symbol.toUpperCase()}&from=${startDate}&to=${endDate}`;

    const bars = await fmpFetch<FMPStableBar[]>(path, this.apiKey);

    if (!Array.isArray(bars) || bars.length === 0) return [];

    // Stable endpoint returns descending — sort ascending for the calculator
    return [...bars]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(parseBar);
  }

  /**
   * Fan-out concurrent single-ticker fetches.
   * MAX_CONCURRENT = 10 — FMP free has no burst throttle, so full parallelism is safe.
   * For Mag7 (7 tickers) this is effectively one parallel round-trip (~300 ms).
   */
  async fetchBatchCandles(params: FetchBatchCandlesParams): Promise<BatchCandleResult> {
    const { symbols, startDate, endDate } = params;
    const result: BatchCandleResult = {};

    for (let i = 0; i < symbols.length; i += MAX_CONCURRENT) {
      const chunk = symbols.slice(i, i + MAX_CONCURRENT);

      await Promise.all(
        chunk.map(async (symbol) => {
          try {
            const candles = await this.fetchCandles({ symbol, startDate, endDate });
            result[symbol] = candles.length > 0 ? candles : null;
          } catch (err) {
            console.error(`[FMP] Failed to fetch ${symbol}:`, err);
            result[symbol] = null;
          }
        })
      );

      // Small courtesy delay between chunks (only matters for batches > 10 tickers)
      if (i + MAX_CONCURRENT < symbols.length) {
        await sleep(100);
      }
    }

    return result;
  }

  async fetchMeta(symbol: string): Promise<InstrumentMeta | null> {
    try {
      type ProfileItem = {
        symbol?: string;
        companyName?: string;
        sector?: string;
        industry?: string;
        mktCap?: number;
        currency?: string;
        exchangeShortName?: string;
      };
      // Profile endpoint still uses v3 path (not deprecated for this resource)
      const data = await fmpFetch<ProfileItem[]>(
        `/api/v3/profile/${symbol.toUpperCase()}`,
        this.apiKey
      );
      if (!Array.isArray(data) || data.length === 0) return null;
      const p = data[0];
      return {
        symbol: symbol.toUpperCase(),
        name: p.companyName ?? symbol,
        type: "stock",
        sector: p.sector,
        industry: p.industry,
        marketCap: p.mktCap,
        currency: p.currency,
        exchange: p.exchangeShortName,
      };
    } catch {
      return null;
    }
  }
}
