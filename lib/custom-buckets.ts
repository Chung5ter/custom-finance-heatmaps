/**
 * Custom source buckets — persisted in localStorage.
 * Each bucket is a named list of up to 50 ticker symbols.
 */

export interface CustomBucket {
  id: string;       // e.g. "bucket_1714000000000"
  label: string;    // user-defined name
  symbols: string[]; // uppercase, deduplicated, max 50
}

const STORAGE_KEY = "lens_custom_buckets";
export const MAX_BUCKET_SIZE = 50;

export function loadBuckets(): CustomBucket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomBucket[]) : [];
  } catch {
    return [];
  }
}

export function saveBuckets(buckets: CustomBucket[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buckets));
}

export function createBucket(label: string, symbols: string[]): CustomBucket {
  return {
    id: `bucket_${Date.now()}`,
    label: label.trim(),
    symbols: normalizeSymbols(symbols),
  };
}

export function updateBucket(
  buckets: CustomBucket[],
  id: string,
  label: string,
  symbols: string[]
): CustomBucket[] {
  return buckets.map((b) =>
    b.id === id ? { ...b, label: label.trim(), symbols: normalizeSymbols(symbols) } : b
  );
}

export function deleteBucket(buckets: CustomBucket[], id: string): CustomBucket[] {
  return buckets.filter((b) => b.id !== id);
}

/** Parse a free-form ticker string into a clean, deduplicated, uppercased array. */
export function parseTickerInput(raw: string): string[] {
  return normalizeSymbols(
    raw.split(/[\s,;|\n\t]+/).filter(Boolean)
  );
}

function normalizeSymbols(symbols: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of symbols) {
    const clean = s.toUpperCase().replace(/[^A-Z0-9.^-]/g, "");
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result.slice(0, MAX_BUCKET_SIZE);
}
