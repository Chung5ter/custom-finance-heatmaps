/**
 * ─── PERSONAL BUCKET CONFIG ──────────────────────────────────────────────────
 *
 * This is the single place to define your custom watchlist buckets.
 * Add, rename, or remove entries in MY_BUCKETS below.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  GOING PUBLIC?                                                          │
 * │  Replace this file's static array with a DB-backed data source.        │
 * │  Suggested path:                                                        │
 * │    1. Create a `buckets` table (id, user_id, label, symbols[])         │
 * │    2. Add GET/POST/DELETE /api/buckets routes                          │
 * │    3. Replace the MY_BUCKETS import in Header.tsx with a              │
 * │       useSWR('/api/buckets') call                                       │
 * │    4. Wire BucketManager save/delete to the API instead of this file   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

export interface PersonalBucket {
  id: string;     // stable slug — used as the watchlist id in the URL
  label: string;  // display name in the SOURCE dropdown
  symbols: string[];
}

export const MY_BUCKETS: PersonalBucket[] = [
  // ── Add your buckets here ─────────────────────────────────────────────────
  {
    id: "energy",
    label: "Energy",
    symbols: ["XOM", "NEE", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "DVN", "KMI"],
  },

];
