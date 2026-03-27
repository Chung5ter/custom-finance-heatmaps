@AGENTS.md

---

## Build Progress

### Status: MVP working — Yahoo Finance provider, personal bucket config

---

### What's been built

#### Infrastructure
- `next.config.ts` — Next.js 16 App Router config
- `.env.local` / `.env.local.example` — env template (no API key required for current provider)
- `tailwind.config.ts` + `app/globals.css` — liquid-glass design tokens, custom CSS vars

#### Market data layer (`/lib/market-data/`)
- `providers/types.ts` — shared `MarketDataProvider` interface, `DailyCandle`, `ResolvedInstrument`, `ReturnMode`
- `providers/yahoo.ts` — **active provider** (Yahoo Finance unofficial chart API); no API key; concurrent fetches (MAX_CONCURRENT=10); parses adjClose; dates in America/New_York timezone to avoid UTC off-by-one
- `providers/fmp.ts` — inactive (250 calls/day free tier too easy to exhaust during dev); uses `/stable/historical-price-eod/full` (post-Aug 2025 endpoint)
- `providers/polygon.ts` — inactive (burst-throttles on free tier; sequential 1 req/s too slow)
- `index.ts` — provider factory; swap provider here by changing the single `_provider = new ...` line
- `calculator.ts` — `START_OPEN_TO_END_CLOSE` and `CLOSE_TO_CLOSE` return modes; auto-applies adjClose factor when available; uses today's open instead of yesterday's close when market is currently open
- `trading-calendar.ts` — weekend + holiday handling; `isMarketCurrentlyOpen()` (14:30–21:00 UTC)
- `cache.ts` — in-memory TTL cache; 1hr for fully historical ranges, 5min when range includes today; only caches when all symbols returned data

#### Universe / watchlists (`/lib/universe/`)
- `instruments.ts` — Magnificent 7 active (with `sharesOutstanding` for market-cap sizing); S&P 500 subset and Sector ETFs defined but commented out to preserve API quota during dev; `DEFAULT_WATCHLIST_ID = "mag7"`

#### Personal buckets (`/lib/personal/`)
- `buckets.ts` — **single file for personal custom watchlists**; edit `MY_BUCKETS` array here; contains migration instructions for DB-backed multi-user launch at the top of the file

#### API route
- `app/api/heatmap/route.ts` — server-side only; accepts `?watchlist=...` for predefined lists or `?symbols=AAPL,MSFT,...` for custom buckets (capped at 50); server-side future-date guard; clamps `endDate` to today silently; TTL cache; USE_MOCK_DATA env var for offline dev

#### UI components
- `components/ui/GlassPanel.tsx` — reusable liquid-glass card primitive
- `components/ui/LoadingSkeleton.tsx` — animated shimmer skeleton
- `components/ui/EmptyState.tsx` — clean no-data / error states
- `components/Controls/Header.tsx` — SOURCE selector (predefined watchlists + MY_BUCKETS under "Custom" optgroup), date presets (Today/5D/1M/MTD), "Week of" Monday picker (auto-fills Mon→Fri), custom date range, METRIC / SIZE BY / GROUP BY toggles; ⊕ button opens BucketManager viewer
- `components/Controls/BucketManager.tsx` — read-only modal showing current MY_BUCKETS; links user to `lib/personal/buckets.ts` for edits; no localStorage/CRUD (personal use architecture)
- `components/HeatMap/HeatMapContainer.tsx` — top-level orchestrator; fetches data, manages config state, 400ms debounce on date input changes
- `components/HeatMap/HeatMapCanvas.tsx` — treemap layout engine (squarified algorithm), zoom/drill-in, breadcrumb navigation
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
- **Endpoint**: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&...`
- **Rate limits**: None on free tier for reasonable usage
- **To swap back to Polygon**: edit `lib/market-data/index.ts` — uncomment `PolygonProvider`, comment out `YahooProvider`, set `POLYGON_API_KEY` in `.env.local`
- **To swap to FMP**: same pattern — uncomment `FMPProvider`, set `FMP_API_KEY` in `.env.local`

---

### Personal bucket architecture
- **Add buckets**: edit `MY_BUCKETS` in `lib/personal/buckets.ts` and restart the dev server
- **GOING PUBLIC?** See the comment block at the top of `lib/personal/buckets.ts` for the DB migration path (buckets table → `/api/buckets` routes → `useSWR` in Header → BucketManager wired to API)
- BucketManager is **read-only** in the current personal-use build — no localStorage CRUD

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

---

### What still needs work / known gaps
- [ ] SP500 subset and Sector ETFs commented out — re-enable in `lib/universe/instruments.ts` when ready for larger universe testing
- [ ] Zoom/drill-in: breadcrumb works but pan gesture not implemented
- [ ] Touch device tap-to-open hover card not wired
- [ ] Filter bar (winners/losers/search) not yet implemented
- [ ] No test suite (calculation edge-case helpers noted in original spec)
- [ ] `MY_BUCKETS` is currently empty — add entries to `lib/personal/buckets.ts` to populate custom sources
