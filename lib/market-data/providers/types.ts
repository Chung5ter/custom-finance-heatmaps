/**
 * Provider abstraction layer for market data.
 * All providers must implement MarketDataProvider.
 * To swap providers: change the active provider in /lib/market-data/index.ts.
 */

export interface DailyCandle {
  date: string;       // ISO date "YYYY-MM-DD"
  open: number;       // Raw open price
  high: number;
  low: number;
  close: number;      // Raw close price
  volume: number;
  adjClose?: number;  // Adjusted close if available from provider
  // NOTE: Default formula uses raw open + raw close to avoid mixing adjusted/raw.
  // If provider only supplies adjusted fields, document clearly in the provider file.
}

export interface InstrumentMeta {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "index" | "crypto" | "unknown";
  sector?: string;
  industry?: string;
  marketCap?: number;          // USD — either from provider or computed below
  sharesOutstanding?: number;  // used to compute implied market cap = endClose × shares
  currency?: string;
  exchange?: string;
}

export interface FetchCandlesParams {
  symbol: string;
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
  adjusted?: boolean; // default false — use raw prices
}

export interface FetchBatchCandlesParams {
  symbols: string[];
  startDate: string;
  endDate: string;
  adjusted?: boolean;
}

export interface BatchCandleResult {
  [symbol: string]: DailyCandle[] | null; // null = no data found for symbol
}

/** The single interface all providers must implement. */
export interface MarketDataProvider {
  readonly name: string;

  /** Fetch OHLCV candles for a single instrument over a date range. */
  fetchCandles(params: FetchCandlesParams): Promise<DailyCandle[]>;

  /** Fetch candles for many instruments. Providers may batch internally or fan out. */
  fetchBatchCandles(params: FetchBatchCandlesParams): Promise<BatchCandleResult>;

  /** Optional: enrich metadata for a symbol. */
  fetchMeta?(symbol: string): Promise<InstrumentMeta | null>;

  /**
   * Optional: fetch live quote metadata (market cap, sector, industry, name) for
   * multiple symbols in a single request. Used to enrich custom bucket instruments
   * that aren't in the predefined universe and therefore lack this data.
   */
  fetchBatchQuoteMeta?(symbols: string[]): Promise<Record<string, LiveQuoteMeta | null>>;
}

export interface LiveQuoteMeta {
  marketCap?: number;
  sector?: string;
  industry?: string;
  name?: string;
  currency?: string;
}

// ─── Resolved instrument (output from calculator layer) ─────────────────────

export type ReturnMode =
  | "START_OPEN_TO_END_CLOSE"   // default — uses first session open, last session close
  | "CLOSE_TO_CLOSE"
  | "OPEN_TO_CLOSE"
  | "ADJ_CLOSE_TO_ADJ_CLOSE";

export interface ResolvedInstrument {
  symbol: string;
  name: string;
  type: InstrumentMeta["type"];
  sector?: string;
  industry?: string;
  marketCap?: number;
  currency?: string;
  exchange?: string;

  // Resolved trading dates (may differ from user's selected dates on weekends/holidays)
  resolvedStartDate: string;   // "YYYY-MM-DD"
  resolvedEndDate: string;     // "YYYY-MM-DD"
  startOpen: number;
  endClose: number;
  percentChange: number;

  candles: DailyCandle[];
  returnMode: ReturnMode;
}
