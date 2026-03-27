/**
 * Performance Calculator
 *
 * Core logic for computing percent returns over custom date ranges.
 *
 * DEFAULT MODE: START_OPEN_TO_END_CLOSE
 *   Formula: ((endClose / startOpen) - 1) * 100
 *   Uses the raw open of the first valid trading day and the raw close of the last
 *   valid trading day within the selected range.
 *
 * IMPORTANT:
 * - Raw open and raw close are used consistently to avoid mixing adjusted/raw prices.
 * - If provider only supplies adjusted fields, the provider file must document this clearly.
 * - Non-trading days (weekends, holidays) are automatically resolved to the nearest
 *   valid trading day within the user's selected range.
 */

import type { DailyCandle, ResolvedInstrument, ReturnMode, InstrumentMeta } from "./providers/types";
import { resolveStartTradingDay, resolveEndTradingDay, isMarketCurrentlyOpen } from "./trading-calendar";

export interface CalculatorInput {
  symbol: string;
  meta: InstrumentMeta;
  candles: DailyCandle[];
  userStartDate: string;  // "YYYY-MM-DD" — may be weekend/holiday
  userEndDate: string;    // "YYYY-MM-DD" — may be weekend/holiday
  returnMode?: ReturnMode;
}

export interface CalculatorResult {
  instrument: ResolvedInstrument;
  error?: "NO_TRADING_DAYS" | "NO_START_CANDLE" | "NO_END_CANDLE" | "MISSING_PRICE";
}

/**
 * Resolve performance for a single instrument.
 *
 * Test cases this handles correctly:
 * - Range with all trading days: uses first open, last close
 * - Start date on weekend: resolves to next Monday (or first trading day in range)
 * - End date on weekend: resolves to prior Friday (or last trading day in range)
 * - One-day range: same candle for open and close
 * - Missing symbol data (empty candles): returns NO_START_CANDLE error
 * - Mixed market holidays: skipped in resolution
 * - March 16–20: uses March 16 open → March 20 close (both are trading days)
 */
export function calculatePerformance(input: CalculatorInput): CalculatorResult {
  const {
    symbol,
    meta,
    candles,
    userStartDate,
    userEndDate,
    returnMode = "START_OPEN_TO_END_CLOSE",
  } = input;

  // Resolve trading days within the user's selected range
  const resolvedStart = resolveStartTradingDay(userStartDate, userEndDate);
  const resolvedEnd = resolveEndTradingDay(userStartDate, userEndDate);

  if (!resolvedStart || !resolvedEnd) {
    return {
      instrument: makePartial(symbol, meta, candles, returnMode),
      error: "NO_TRADING_DAYS",
    };
  }

  // Build a date-indexed candle map for O(1) lookup
  const candleMap = new Map<string, DailyCandle>();
  for (const c of candles) {
    candleMap.set(c.date, c);
  }

  let startOpen: number | undefined;
  let endClose: number | undefined;

  if (returnMode === "START_OPEN_TO_END_CLOSE") {
    // Find candle on resolved start date — fall forward if missing (provider gap)
    const startCandle = findCandleOnOrAfter(candleMap, resolvedStart, resolvedEnd);
    if (!startCandle) {
      return {
        instrument: makePartial(symbol, meta, candles, returnMode),
        error: "NO_START_CANDLE",
      };
    }

    // Find candle on resolved end date — fall back if missing
    const endCandle = findCandleOnOrBefore(candleMap, resolvedEnd, resolvedStart);
    if (!endCandle) {
      return {
        instrument: makePartial(symbol, meta, candles, returnMode),
        error: "NO_END_CANDLE",
      };
    }

    // Automatically apply split + dividend adjustment when adjClose is available.
    // adjFactor = adjClose / close gives the cumulative adjustment multiplier for
    // that day. Multiplying raw open by that factor reconstructs an adjusted open
    // on the same scale as adjClose — the standard approach used by Bloomberg,
    // Yahoo Finance, and most professional data tools.
    // If adjClose is absent (provider doesn't supply it), raw prices are used as-is.
    const startAdjFactor =
      startCandle.adjClose != null && startCandle.close !== 0
        ? startCandle.adjClose / startCandle.close
        : 1;
    const endAdjFactor =
      endCandle.adjClose != null && endCandle.close !== 0
        ? endCandle.adjClose / endCandle.close
        : 1;

    startOpen = startCandle.open * startAdjFactor;

    // If the market is currently open, today's official close hasn't printed yet.
    // Use the end candle's open instead — it already prices in any overnight/
    // pre-market move and is the most recent "settled" reference available.
    const todayUTC = new Date().toISOString().slice(0, 10);
    const useOpen = endCandle.date === todayUTC && isMarketCurrentlyOpen();
    const rawEndPrice = useOpen ? endCandle.open : endCandle.close;
    const endFactor = useOpen ? startAdjFactor : endAdjFactor; // use start factor for open (same-day adj)
    endClose = rawEndPrice * endFactor;
  } else if (returnMode === "CLOSE_TO_CLOSE") {
    const startCandle = findCandleOnOrAfter(candleMap, resolvedStart, resolvedEnd);
    const endCandle = findCandleOnOrBefore(candleMap, resolvedEnd, resolvedStart);
    if (!startCandle || !endCandle) {
      return { instrument: makePartial(symbol, meta, candles, returnMode), error: "NO_START_CANDLE" };
    }
    startOpen = startCandle.close; // use "close" as starting reference
    endClose = endCandle.close;
  } else if (returnMode === "OPEN_TO_CLOSE") {
    const startCandle = findCandleOnOrAfter(candleMap, resolvedStart, resolvedEnd);
    const endCandle = findCandleOnOrBefore(candleMap, resolvedEnd, resolvedStart);
    if (!startCandle || !endCandle) {
      return { instrument: makePartial(symbol, meta, candles, returnMode), error: "NO_START_CANDLE" };
    }
    startOpen = startCandle.open;
    endClose = endCandle.close;
  } else if (returnMode === "ADJ_CLOSE_TO_ADJ_CLOSE") {
    const startCandle = findCandleOnOrAfter(candleMap, resolvedStart, resolvedEnd);
    const endCandle = findCandleOnOrBefore(candleMap, resolvedEnd, resolvedStart);
    if (!startCandle || !endCandle) {
      return { instrument: makePartial(symbol, meta, candles, returnMode), error: "NO_START_CANDLE" };
    }
    // NOTE: adjClose may be undefined if provider doesn't supply it.
    // Fall back to close with a console warning in that case.
    if (startCandle.adjClose === undefined || endCandle.adjClose === undefined) {
      console.warn(`[Calculator] adjClose not available for ${symbol}, falling back to raw close`);
    }
    startOpen = startCandle.adjClose ?? startCandle.close;
    endClose = endCandle.adjClose ?? endCandle.close;
  }

  if (startOpen === undefined || endClose === undefined) {
    return {
      instrument: makePartial(symbol, meta, candles, returnMode),
      error: "MISSING_PRICE",
    };
  }

  const percentChange = ((endClose / startOpen) - 1) * 100;

  // Implied market cap = endClose × sharesOutstanding.
  // Prefer an explicit marketCap from the provider; fall back to computed value.
  const impliedMarketCap =
    meta.marketCap ??
    (meta.sharesOutstanding != null ? endClose * meta.sharesOutstanding : undefined);

  return {
    instrument: {
      symbol,
      name: meta.name,
      type: meta.type,
      sector: meta.sector,
      industry: meta.industry,
      marketCap: impliedMarketCap,
      currency: meta.currency,
      exchange: meta.exchange,
      resolvedStartDate: resolvedStart,
      resolvedEndDate: resolvedEnd,
      startOpen,
      endClose,
      percentChange,
      candles,
      returnMode,
    },
  };
}

/** Find the candle on `targetDate` or the next available date up to `maxDate`. */
function findCandleOnOrAfter(
  map: Map<string, DailyCandle>,
  targetDate: string,
  maxDate: string
): DailyCandle | null {
  let d = targetDate;
  while (d <= maxDate) {
    const candle = map.get(d);
    if (candle) return candle;
    d = addDays(d, 1);
  }
  return null;
}

/** Find the candle on `targetDate` or the previous available date down to `minDate`. */
function findCandleOnOrBefore(
  map: Map<string, DailyCandle>,
  targetDate: string,
  minDate: string
): DailyCandle | null {
  let d = targetDate;
  while (d >= minDate) {
    const candle = map.get(d);
    if (candle) return candle;
    d = addDays(d, -1);
  }
  return null;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function makePartial(
  symbol: string,
  meta: InstrumentMeta,
  candles: DailyCandle[],
  returnMode: ReturnMode
): ResolvedInstrument {
  return {
    symbol,
    name: meta.name,
    type: meta.type,
    sector: meta.sector,
    industry: meta.industry,
    marketCap: meta.marketCap,
    currency: meta.currency,
    exchange: meta.exchange,
    resolvedStartDate: "",
    resolvedEndDate: "",
    startOpen: 0,
    endClose: 0,
    percentChange: 0,
    candles,
    returnMode,
  };
}
