/**
 * Tiingo Provider — STUB
 *
 * WHY NOT PRIMARY:
 * - Free tier: 500 req/day, max 50 symbols — manageable for small watchlists.
 * - Multi-ticker endpoint exists but is less ergonomic than Polygon's Grouped Daily.
 * - Missing sector/industry data in base plan.
 *
 * TRADEOFFS IF USED:
 * - $10/mo Power plan is excellent value — 20,000 req/day, 5,000 tickers.
 * - Good adjusted close support; raw OHLC also available.
 * - Strong alternative to Polygon for budget-constrained builds.
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

export class TiingoProvider implements MarketDataProvider {
  readonly name = "tiingo";
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async fetchCandles(_params: FetchCandlesParams): Promise<DailyCandle[]> {
    // TODO: implement
    // Endpoint: https://api.tiingo.com/tiingo/daily/{ticker}/prices?startDate={}&endDate={}&token={token}
    // Returns array of { date, open, high, low, close, volume, adjClose, adjHigh, adjLow, adjOpen }
    // Use raw open + raw close for START_OPEN_TO_END_CLOSE mode.
    // adjClose is available if adjusted=true is desired in future modes.
    throw new Error("Tiingo provider not yet implemented — use PolygonProvider");
  }

  async fetchBatchCandles(_params: FetchBatchCandlesParams): Promise<BatchCandleResult> {
    // Tiingo supports comma-separated tickers via /iex endpoint for quotes,
    // but historical EOD must be fetched per-ticker. Fan out with rate limiting.
    throw new Error("Tiingo batch not implemented");
  }

  async fetchMeta(_symbol: string): Promise<InstrumentMeta | null> {
    // Endpoint: https://api.tiingo.com/tiingo/daily/{ticker}?token={token}
    throw new Error("Tiingo fetchMeta not implemented");
  }
}
