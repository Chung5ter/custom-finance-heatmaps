/**
 * Trading Calendar Utilities
 *
 * Assumptions:
 * - US market calendar (NYSE/NASDAQ) — extend for other exchanges as needed.
 * - Weekend detection is universal. US federal holidays are hardcoded for current years.
 * - Exchange-specific half-days are NOT handled here (acceptable for EOD heatmaps).
 *
 * For production accuracy, consider integrating with a calendar API
 * (e.g., Polygon's /v1/marketstatus/upcoming) instead of the hardcoded list.
 */

// US market holidays (NYSE) — extend annually
const US_MARKET_HOLIDAYS = new Set<string>([
  // 2024
  "2024-01-01", "2024-01-15", "2024-02-19", "2024-03-29",
  "2024-05-27", "2024-06-19", "2024-07-04", "2024-09-02",
  "2024-11-28", "2024-12-25",
  // 2025
  "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18",
  "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01",
  "2025-11-27", "2025-12-25",
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03",
  "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07",
  "2026-11-26", "2026-12-25",
]);

/** Returns true if the given date string ("YYYY-MM-DD") is a US trading day. */
export function isTradingDay(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00Z");
  const dow = date.getUTCDay();
  if (dow === 0 || dow === 6) return false; // weekend
  if (US_MARKET_HOLIDAYS.has(dateStr)) return false;
  return true;
}

/**
 * Given a start date, return the first trading day >= startDate within the range [startDate, endDate].
 * Returns null if no trading day exists in the range.
 */
export function resolveStartTradingDay(startDate: string, endDate: string): string | null {
  let current = startDate;
  while (current <= endDate) {
    if (isTradingDay(current)) return current;
    current = addDays(current, 1);
  }
  return null;
}

/**
 * Given an end date, return the last trading day <= endDate within the range [startDate, endDate].
 * Returns null if no trading day exists in the range.
 */
export function resolveEndTradingDay(startDate: string, endDate: string): string | null {
  let current = endDate;
  while (current >= startDate) {
    if (isTradingDay(current)) return current;
    current = addDays(current, -1);
  }
  return null;
}

/** Add N days to a date string "YYYY-MM-DD". */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Get all trading days in a range [startDate, endDate] inclusive. */
export function getTradingDaysInRange(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    if (isTradingDay(current)) days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

/**
 * Returns true if the US equity market (NYSE/NASDAQ) is currently in its regular
 * trading session (9:30am–4:00pm ET, excluding weekends and holidays).
 *
 * Used by the calculator to decide whether to use today's open (mid-session)
 * or today's official close (post-session) as the end-of-range price.
 *
 * DST note: US DST runs from the second Sunday of March to the first Sunday of
 * November. During EDT (UTC-4) market hours are 13:30–20:00 UTC; during EST
 * (UTC-5) they are 14:30–21:00 UTC. We use the wider 13:30–21:00 UTC window so
 * both periods are covered without needing a full DST lookup here.
 */
export function isMarketCurrentlyOpen(): boolean {
  const now = new Date();
  const dow = now.getUTCDay();
  if (dow === 0 || dow === 6) return false;

  const todayStr = now.toISOString().slice(0, 10);
  if (US_MARKET_HOLIDAYS.has(todayStr)) return false;

  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const openUTC = 13 * 60 + 30;  // 9:30am ET in EST (UTC-5); EDT is even earlier so this is safe
  const closeUTC = 21 * 60;      // 4:00pm ET in EDT (UTC-4); EST is even later so this is safe

  return utcMinutes >= openUTC && utcMinutes < closeUTC;
}

/** Format "YYYY-MM-DD" to human-readable "Mar 16, 2025" */
export function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
