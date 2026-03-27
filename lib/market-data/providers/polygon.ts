/**
 * Polygon.io Market Data Provider
 *
 * WHY POLYGON:
 * - "Grouped Daily Bars" endpoint returns ALL tickers for a given date in one call.
 *   This is perfect for heatmaps — minimizes round trips when loading 50–500 symbols.
 * - Production-grade reliability, well-maintained REST API.
 * - Free tier covers unlimited historical EOD data (previous day+ delay on free).
 * - Adjusted close fields available; raw OHLC also available — no silent mixing.
 * - Paid plans ($29/mo Starter) unlock real-time and larger batch limits.
 *
 * TRADEOFFS ACCEPTED:
 * - Free tier has a 15-min delay on real-time data (irrelevant for historical ranges).
 * - Index constituents (e.g. S&P 500 list) are not provided — we manage our universe separately.
 * - Rate limit: 5 API calls/min on free tier → we fan-out single-ticker calls in controlled bursts.
 *
 * HOW TO SWAP PROVIDERS:
 * Change the export in /lib/market-data/index.ts to use a different provider.
 * All providers share the MarketDataProvider interface.
 */

import type {
  MarketDataProvider,
  DailyCandle,
  FetchCandlesParams,
  FetchBatchCandlesParams,
  BatchCandleResult,
  InstrumentMeta,
} from "./types";

const BASE_URL = "https://api.polygon.io";

// Polygon free tier: fire one request at a time with a 1.2 s gap.
// This costs ~8 s for Mag7 on a cold cache, but the cache makes repeats instant.
// Historical ranges are cached for 1 hour (see route.ts) so the slow path is rare.
// Upgrade to Polygon Starter ($29/mo) to parallelise safely.
const BATCH_DELAY_MS = 1200;
const MAX_CONCURRENT = 1;
const RETRY_DELAY_MS = 3000; // back-off before a single retry on rate-limit

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface PolygonAgg {
  t: number;  // timestamp ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
}

interface PolygonAggResponse {
  ticker?: string;
  resultsCount?: number;
  results?: PolygonAgg[];
  status?: string;
  error?: string;
}

interface PolygonTickerDetail {
  results?: {
    ticker?: string;
    name?: string;
    type?: string;
    market_cap?: number;
    currency_name?: string;
    primary_exchange?: string;
    sic_description?: string;
  };
}

function parseAgg(agg: PolygonAgg): DailyCandle {
  const date = new Date(agg.t);
  // Polygon timestamps are in milliseconds UTC
  const iso = date.toISOString().slice(0, 10);
  return {
    date: iso,
    open: agg.o,
    high: agg.h,
    low: agg.l,
    close: agg.c,
    volume: agg.v,
    // adjClose: not included in free aggregates endpoint; available via adjusted=true param
  };
}

async function polygonFetch<T>(path: string, apiKey: string, retry = true): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${sep}apiKey=${apiKey}`;
  // Use no-store so Next.js never caches a rate-limit error response.
  // Successful results are cached at the app level via /lib/market-data/cache.ts.
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    // 429 = hard rate limit → retry once after back-off
    if (res.status === 429 && retry) {
      console.warn(`[Polygon] 429 rate limit on ${path} — retrying after ${RETRY_DELAY_MS}ms`);
      await sleep(RETRY_DELAY_MS);
      return polygonFetch<T>(path, apiKey, false);
    }
    const body = await res.text();
    throw new Error(`Polygon API error ${res.status}: ${body}`);
  }

  const data = await res.json() as T & { status?: string; error?: string };

  // Polygon returns HTTP 200 with status:"ERROR" when rate-limited or key is invalid.
  // Treat this as a retryable error so the symbol isn't silently dropped.
  if ((data as { status?: string }).status === "ERROR") {
    const msg = (data as { error?: string }).error ?? "unknown Polygon error";
    if (retry) {
      console.warn(`[Polygon] status=ERROR on ${path}: "${msg}" — retrying after ${RETRY_DELAY_MS}ms`);
      await sleep(RETRY_DELAY_MS);
      return polygonFetch<T>(path, apiKey, false);
    }
    throw new Error(`Polygon returned ERROR: ${msg}`);
  }

  return data as T;
}

export class PolygonProvider implements MarketDataProvider {
  readonly name = "polygon";
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("Polygon API key is required");
    this.apiKey = apiKey;
  }

  async fetchCandles(params: FetchCandlesParams): Promise<DailyCandle[]> {
    const { symbol, startDate, endDate, adjusted = false } = params;
    const adj = adjusted ? "true" : "false";

    // Polygon aggregates endpoint: /v2/aggs/ticker/{sym}/range/1/day/{from}/{to}
    const path = `/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/day/${startDate}/${endDate}?adjusted=${adj}&sort=asc&limit=500`;

    const data = await polygonFetch<PolygonAggResponse>(path, this.apiKey);

    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map(parseAgg);
  }

  async fetchBatchCandles(params: FetchBatchCandlesParams): Promise<BatchCandleResult> {
    const { symbols, startDate, endDate, adjusted = false } = params;
    const result: BatchCandleResult = {};

    // Fan out with controlled concurrency to respect rate limits
    for (let i = 0; i < symbols.length; i += MAX_CONCURRENT) {
      const chunk = symbols.slice(i, i + MAX_CONCURRENT);

      await Promise.all(
        chunk.map(async (symbol) => {
          try {
            const candles = await this.fetchCandles({ symbol, startDate, endDate, adjusted });
            result[symbol] = candles.length > 0 ? candles : null;
          } catch (err) {
            console.error(`[Polygon] Failed to fetch ${symbol}:`, err);
            result[symbol] = null;
          }
        })
      );

      // Delay between chunks to respect free-tier rate limits
      if (i + MAX_CONCURRENT < symbols.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return result;
  }

  async fetchMeta(symbol: string): Promise<InstrumentMeta | null> {
    try {
      const data = await polygonFetch<PolygonTickerDetail>(
        `/v3/reference/tickers/${symbol.toUpperCase()}`,
        this.apiKey
      );
      const r = data.results;
      if (!r) return null;

      const typeMap: Record<string, InstrumentMeta["type"]> = {
        CS: "stock",
        ETF: "etf",
        INDEX: "index",
        CRYPTO: "crypto",
      };

      return {
        symbol: symbol.toUpperCase(),
        name: r.name ?? symbol,
        type: typeMap[r.type ?? ""] ?? "unknown",
        sector: undefined, // Polygon reference doesn't give sector on free tier
        industry: r.sic_description,
        marketCap: r.market_cap,
        currency: r.currency_name?.toUpperCase(),
        exchange: r.primary_exchange,
      };
    } catch {
      return null;
    }
  }
}
