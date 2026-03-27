/**
 * Market Data Entry Point
 *
 * To swap providers:
 * 1. Import a different provider class below.
 * 2. Change the `getProvider()` factory function.
 * 3. Everything else (calculator, API route, UI) stays the same.
 */

// import { PolygonProvider } from "./providers/polygon";
// import { AlphaVantageProvider } from "./providers/alphavantage";
// import { TiingoProvider } from "./providers/tiingo";
// import { FMPProvider } from "./providers/fmp";
import { YahooProvider } from "./providers/yahoo";
import type { MarketDataProvider } from "./providers/types";

export type { MarketDataProvider };
export type {
  DailyCandle,
  InstrumentMeta,
  ResolvedInstrument,
  ReturnMode,
  FetchCandlesParams,
  FetchBatchCandlesParams,
  BatchCandleResult,
} from "./providers/types";

let _provider: MarketDataProvider | null = null;

export function getProvider(): MarketDataProvider {
  if (_provider) return _provider;

  // Yahoo Finance requires no API key — instantiate directly.
  // To switch providers, comment this out and uncomment one of the others above.
  _provider = new YahooProvider();
  return _provider;
}
