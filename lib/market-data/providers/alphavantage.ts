/**
 * Alpha Vantage Provider — STUB
 *
 * WHY NOT PRIMARY:
 * - Free tier: 25 requests/day, 500/month — far too low for heatmaps with 50+ tickers.
 * - No batch endpoint: one ticker per call.
 * - For a 50-ticker heatmap, a full refresh exhausts the daily free quota.
 *
 * TRADEOFFS IF USED:
 * - Upgraded tier ($50/mo) gives 75 req/min — usable but expensive relative to Polygon.
 * - Adjusted close is available. Raw open + adjusted close mixing risk — document carefully.
 *
 * TO ACTIVATE: implement the methods below and update /lib/market-data/index.ts.
 */

import type {
  MarketDataProvider,
  DailyCandle,
  FetchCandlesParams,
  FetchBatchCandlesParams,
  BatchCandleResult,
  InstrumentMeta,
} from "./types";

export class AlphaVantageProvider implements MarketDataProvider {
  readonly name = "alphavantage";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchCandles(_params: FetchCandlesParams): Promise<DailyCandle[]> {
    // TODO: implement
    // Endpoint: https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={sym}&outputsize=full&apikey={key}
    // Parse "Time Series (Daily)" object, sort ascending, filter by date range.
    // NOTE: Alpha Vantage returns close prices only (no intraday open on daily endpoint).
    //       For adjusted: use function=TIME_SERIES_DAILY_ADJUSTED.
    //       raw open is available in the daily endpoint — use it for START_OPEN_TO_END_CLOSE.
    throw new Error("AlphaVantage provider not yet implemented — use PolygonProvider");
  }

  async fetchBatchCandles(params: FetchBatchCandlesParams): Promise<BatchCandleResult> {
    // NOTE: Must fan out to fetchCandles per symbol — no batch endpoint.
    // Severely rate-limited on free tier. Not recommended for heatmap use.
    throw new Error("AlphaVantage batch not implemented");
  }

  async fetchMeta(_symbol: string): Promise<InstrumentMeta | null> {
    // Endpoint: https://www.alphavantage.co/query?function=OVERVIEW&symbol={sym}&apikey={key}
    throw new Error("AlphaVantage fetchMeta not implemented");
  }
}
