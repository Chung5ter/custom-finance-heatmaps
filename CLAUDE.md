@AGENTS.md

---

## Build Progress

### Status: MVP working — Yahoo Finance provider, localStorage bucket CRUD, Share view

---

### What's been built

#### Infrastructure
- `next.config.ts` — Next.js 16 App Router config
- `.env.local` / `.env.local.example` — env template (no API key required for current provider)
- `tailwind.config.ts` + `app/globals.css` — liquid-glass design tokens, custom CSS vars

#### Market data layer (`/lib/market-data/`)
- `providers/types.ts` — shared `MarketDataProvider` interface, `DailyCandle`, `ResolvedInstrument`, `ReturnMode`; also exports `LiveQuoteMeta` (`marketCap`, `sector`, `industry`, `name`, `currency`) and optional `fetchBatchQuoteMeta?` on the provider interface
- `providers/yahoo.ts` — **active provider** (Yahoo Finance unofficial chart API); no API key; concurrent fetches (MAX_CONCURRENT=10); parses adjClose; dates in America/New_York timezone to avoid UTC off-by-one; implements `fetchBatchQuoteMeta` via `v10/finance/quoteSummary?modules=price,assetProfile` with crumb auth (see below)
- `providers/fmp.ts` — inactive (250 calls/day free tier too easy to exhaust during dev); uses `/stable/historical-price-eod/full` (post-Aug 2025 endpoint)
- `providers/polygon.ts` — inactive (burst-throttles on free tier; sequential 1 req/s too slow)
- `index.ts` — provider factory; swap provider here by changing the single `_provider = new ...` line
- `calculator.ts` — `START_OPEN_TO_END_CLOSE` and `CLOSE_TO_CLOSE` return modes; auto-applies adjClose factor when available; uses today's open instead of yesterday's close when market is currently open
- `trading-calendar.ts` — weekend + holiday handling; `isMarketCurrentlyOpen()` (14:30–21:00 UTC)
- `cache.ts` — in-memory TTL cache; 1hr for fully historical ranges, 5min when range includes today; only caches when all symbols returned data

#### Universe / watchlists (`/lib/universe/`)
- `instruments.ts` — Magnificent 7 active (with `sharesOutstanding` for market-cap sizing); S&P 500 subset and Sector ETFs defined but commented out to preserve API quota during dev; `DEFAULT_WATCHLIST_ID = "mag7"`

#### Personal buckets (`/lib/personal/`)
- `buckets.ts` — seed file; `MY_BUCKETS` array is written to localStorage on first visit (currently includes Energy bucket: XOM, NEE, CVX, COP, SLB, EOG, MPC, PSX, VLO, OXY, DVN, KMI); contains migration instructions for DB-backed multi-user launch at the top
- `useCustomBuckets.ts` — localStorage-backed hook (`"lens-custom-buckets-v1"`); seeded from `MY_BUCKETS` on first visit; exposes `buckets`, `addBucket`, `updateBucket`, `deleteBucket`; server always returns `[]` (no SSR mismatch); `generateId` slugifies label + deduplicates with numeric suffix

#### API route
- `app/api/heatmap/route.ts` — server-side only; accepts `?watchlist=...` for predefined lists or `?symbols=AAPL,MSFT,...` for custom buckets (capped at 50); server-side future-date guard; clamps `endDate` to today silently; TTL cache; USE_MOCK_DATA env var for offline dev; **live enrichment**: for custom symbol requests, calls `fetchBatchQuoteMeta` after price calc to backfill missing `sector`, `marketCap`, `industry`, `name`; enrichment results cached 5 min under `quotemeta:...` key

#### UI components
- `components/ui/GlassPanel.tsx` — reusable liquid-glass card primitive
- `components/ui/LoadingSkeleton.tsx` — animated shimmer skeleton
- `components/ui/EmptyState.tsx` — clean no-data / error states
- `components/Controls/Header.tsx` — SOURCE selector (predefined watchlists + localStorage custom buckets under "Custom" optgroup), date presets (Today/5D/1M/MTD), "Week of" Monday picker (auto-fills Mon→Fri), custom date range, METRIC / SIZE BY / GROUP BY toggles; ⊕ button opens BucketManager; uses `useCustomBuckets` hook; `suppressHydrationWarning` on all three date inputs (NordPass extension fix)
- `components/Controls/BucketManager.tsx` — full CRUD modal; list view (Edit/Delete buttons per bucket + "New Bucket" button) and add/edit form view; `parseSymbols` validates tickers (`/^[A-Z.]{1,10}$/`), deduplicates, caps at 50; mutations go up via `onAdd`/`onUpdate`/`onDelete` props
- `components/HeatMap/HeatMapContainer.tsx` — top-level orchestrator; fetches data, manages config state, 400ms debounce on date input changes; manages `shareOpen` state; renders `<ShareView>` inside `<AnimatePresence>`
- `components/HeatMap/HeatMapCanvas.tsx` — treemap layout engine (squarified algorithm), zoom/drill-in, breadcrumb navigation; optional `onShare` prop — shows "↗ Share" button in legend strip when set and instruments are loaded
- `components/HeatMap/ShareView.tsx` — full-screen screenshot-ready overlay (z-index 500); editable title (`<input>` styled as plain text), read-only date range, editable subtitle/tickers (`<textarea>` auto-resizes); uses `useTreemap` + `HeatTile` directly (no HeatMapCanvas); shows sector group labels; "Lens · Market Heat Map" watermark; Escape key closes; no hover interaction (`onHover={NOOP}`)
- `components/HeatMap/HeatTile.tsx` — individual tile; font sizes 50% larger than original; smart label truncation at small sizes; color intensity by return magnitude
- `components/HeatMap/HoverCard.tsx` — floating hover card with full instrument details (including computed market cap), mini sparkline; stable open/close delay to prevent flicker
- `components/HeatMap/MiniChart.tsx` — pure SVG sparkline (no library); plots close prices with fill area
- `components/HeatMap/Breadcrumb.tsx` — zoom path bar (e.g. All → Technology)

#### Pages
- `app/layout.tsx` — dark-mode root layout, fonts
- `app/page.tsx` — dashboard page

---

### Active provider: Yahoo Finance
- **Why**: No API key required; concurrent fetches; ~750ms cold load for Mag7; adjClose built-in
- **Price endpoint**: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&...`
- **Quote meta endpoint**: `https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules=price,assetProfile` — requires crumb auth
- **Crumb auth flow**: GET `https://fc.yahoo.com/` → capture `Set-Cookie` headers → GET `/v1/test/getcrumb` with those cookies → returns a crumb string; both cached 30 min per provider instance in `ensureCrumb()`
- **Rate limits**: None on free tier for reasonable usage
- **To swap back to Polygon**: edit `lib/market-data/index.ts` — uncomment `PolygonProvider`, comment out `YahooProvider`, set `POLYGON_API_KEY` in `.env.local`
- **To swap to FMP**: same pattern — uncomment `FMPProvider`, set `FMP_API_KEY` in `.env.local`

---

### Custom bucket architecture
- **In-UI CRUD**: click ⊕ in the header SOURCE row → BucketManager modal; add/edit/delete buckets; persisted to `localStorage["lens-custom-buckets-v1"]`
- **Seed file**: `MY_BUCKETS` in `lib/personal/buckets.ts` is written to localStorage on first visit (only if localStorage is empty); edit this to change the default buckets shipped with the app
- **Live enrichment**: custom symbol requests hit Yahoo `quoteSummary` after price calc to fill in `sector`, `marketCap`, `industry`, `name`; this fixes both hover card market cap and sector-grouped treemap layouts for ad-hoc tickers
- **GOING PUBLIC?** See the comment block at the top of `lib/personal/buckets.ts` for the DB migration path (buckets table → `/api/buckets` routes → `useSWR` in Header → BucketManager wired to API)

---

### Resolved bugs
| Bug | Fix |
|---|---|
| Hydration mismatch on date preset buttons | Moved `getDatePresets()` into `useEffect`; server always renders empty list |
| `NO_START_CANDLE` for META + TSLA (Polygon) | Polygon free-tier returns `status:"ERROR"` as HTTP 200; added status check + retry |
| Stale bad responses cached by Next.js `fetch` | Switched to `{ cache: "no-store" }`; rely on app-level TTL cache instead |
| Partial batch cached (null results stored) | Only write to cache when every symbol in batch returned data |
| Polygon sequential throttle (~7s for Mag7) | Switched to FMP bulk endpoint |
| FMP daily limit exhausted during dev testing | Switched to Yahoo Finance (no limit) |
| `step=7` Week Of locking to Thursdays | Unix epoch is a Thursday so step=7 skips Mondays; removed `step` attr entirely |
| March 9 range always failing | Self-perpetuating Polygon rate-limit loop; fixed by Yahoo switch + 1hr historical cache |
| UTC off-by-one on Yahoo candle dates | Yahoo timestamps are market-close UTC; format in `America/New_York` TZ via `toLocaleDateString` |
| Adjusted price as user toggle | Removed toggle; auto-applies `adjFactor = adjClose/close` whenever Yahoo provides adjClose |
| Mid-session end price using prior close | Added `isMarketCurrentlyOpen()` check; uses `endCandle.open` when market is live |
| Hydration mismatch on `<optgroup>` (custom buckets) | `customBuckets` was non-empty on server; fixed by `useState([])` + `useEffect` seed pattern in `useCustomBuckets` |
| Hydration mismatch on date inputs (NordPass extension) | NordPass injects `data-np-intersection-state` before React hydrates; fixed with `suppressHydrationWarning` on all three `<input type="date">` elements |
| Market cap missing in hover card for custom symbols | Custom symbols have no `sharesOutstanding` in universe → `impliedMarketCap` undefined; fixed by live `quoteSummary` enrichment |
| Sector grouping broken for custom symbols (all "Other") | Custom symbols had `sector: undefined` from fallback; fixed by same live enrichment |
| Yahoo `quoteSummary` returning "Invalid Crumb" | v10 endpoint now requires auth; fixed with `ensureCrumb()` flow (fc.yahoo.com → cookie → getcrumb) |
| TypeScript narrowing bug silently skipping enrichment | `provider?.fetchBatchQuoteMeta` as `if` condition doesn't narrow `provider`; fixed by `const fn = provider?.fetchBatchQuoteMeta?.bind(provider)` pattern |

---

### What still needs work / known gaps
- [ ] SP500 subset and Sector ETFs commented out — re-enable in `lib/universe/instruments.ts` when ready for larger universe testing
- [ ] Zoom/drill-in: breadcrumb works but pan gesture not implemented
- [ ] Touch device tap-to-open hover card not wired
- [ ] Filter bar (winners/losers/search) not yet implemented
- [ ] No test suite (calculation edge-case helpers noted in original spec)
- [x] Custom bucket CRUD in UI (localStorage-backed, full add/edit/delete)
- [x] Live market cap + sector enrichment for custom symbols via Yahoo quoteSummary
- [x] Share / screenshot view (full-screen, editable title/subtitle, "↗ Share" button)
- [ ] SP500 subset and Sector ETFs commented out — re-enable in `lib/universe/instruments.ts` when ready for larger universe testing
- [ ] Zoom/drill-in: breadcrumb works but pan gesture not implemented
- [ ] Touch device tap-to-open hover card not wired
- [ ] Filter bar (winners/losers/search) not yet implemented
- [ ] No test suite (calculation edge-case helpers noted in original spec)
- [ ] Share view: native screenshot / copy-to-clipboard button (currently user screenshots manually)
