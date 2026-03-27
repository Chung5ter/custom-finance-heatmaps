"use client";
import { useState, useEffect, useCallback } from "react";
import { MY_BUCKETS, type PersonalBucket } from "./buckets";

const STORAGE_KEY = "lens-custom-buckets-v1";

function generateId(label: string, existing: PersonalBucket[]): string {
  const base =
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
    "bucket";
  const existingIds = new Set(existing.map((b) => b.id));
  if (!existingIds.has(base)) return base;
  let i = 2;
  while (existingIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/**
 * Manages custom watchlist buckets in localStorage.
 * Seeded from MY_BUCKETS on first load (when localStorage is empty).
 * All reads/writes are client-only — the server always sees an empty list
 * during SSR, so consumers must treat the initial empty state as a loading state.
 */
export function useCustomBuckets() {
  const [buckets, setBuckets] = useState<PersonalBucket[]>([]);

  // Load from localStorage on mount; fall back to hardcoded MY_BUCKETS seed
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setBuckets(JSON.parse(stored));
      } else if (MY_BUCKETS.length > 0) {
        // Seed localStorage with the hardcoded defaults on first visit
        setBuckets(MY_BUCKETS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(MY_BUCKETS));
      }
    } catch {
      // Malformed storage — start fresh
      setBuckets([]);
    }
  }, []);

  const persist = useCallback((next: PersonalBucket[]) => {
    setBuckets(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable (private browsing quota exceeded etc.)
    }
  }, []);

  const addBucket = useCallback(
    (label: string, symbols: string[]) => {
      setBuckets((prev) => {
        const id = generateId(label, prev);
        const next = [...prev, { id, label, symbols }];
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* */ }
        return next;
      });
    },
    []
  );

  const updateBucket = useCallback(
    (id: string, label: string, symbols: string[]) => {
      setBuckets((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, label, symbols } : b));
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* */ }
        return next;
      });
    },
    []
  );

  const deleteBucket = useCallback((id: string) => {
    setBuckets((prev) => {
      const next = prev.filter((b) => b.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }, []);

  return { buckets, addBucket, updateBucket, deleteBucket };
}
