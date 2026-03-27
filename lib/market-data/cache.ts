/**
 * Simple in-memory cache for candle data.
 * In production, replace with Redis or Next.js Data Cache.
 *
 * Cache key: "{symbol}:{startDate}:{endDate}:{adjusted}"
 * TTL: 5 minutes for intraday, longer for historical.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function makeCandleCacheKey(
  symbol: string,
  startDate: string,
  endDate: string,
  adjusted: boolean
): string {
  return `candles:${symbol}:${startDate}:${endDate}:${adjusted}`;
}
