# Lens — Market Heat Map

A premium, liquid-glass finance heat map built with Next.js 15, TypeScript, D3, and Framer Motion. Supports custom date ranges, sector grouping, zoom/drill-in, and live data via Polygon.io.

---

## API Provider Research & Decision

### Compared

| Provider | Batch support | Free tier | Prod-ready | Notes |
|---|---|---|---|---|
| **Polygon.io** | Grouped Daily (1 call = all tickers) | Unlimited historical EOD | Excellent | **Selected** |
| Alpha Vantage | None (1 ticker/call) | 25 req/day | Good | Unusable for heatmaps at scale |
| Tiingo | Limited multi-ticker | 500 req/day, 50 symbols | Good | Solid fallback |
| yfinance | Batch via Python | Free (unofficial) | No | Prototype only |

### Why Polygon.io

Polygon's Aggregates endpoint returns OHLCV data per symbol. For a heatmap with 50 names, controlled fan-out with a concurrency limit is fast enough on free tier. Production paid plans unlock more throughput.

**Tradeoffs accepted:**
- Free tier has a 15-minute delay on real-time quotes (irrelevant for EOD heatmaps)
- Index constituent lists not provided — managed in `/lib/universe/instruments.ts`
- Rate limit: 5 req/min on free tier handled by `fetchBatchCandles` concurrency control

**To swap providers:** change the import in `/lib/market-data/index.ts`. All providers share `MarketDataProvider` interface in `/lib/market-data/providers/types.ts`.

---

## Performance Calculation

### Default mode: `START_OPEN_TO_END_CLOSE`

```
percentChange = ((endClose / startOpen) - 1) * 100
```

- `startOpen` = raw open price on the **first valid trading day** within the selected range
- `endClose`  = raw close price on the **last valid trading day** within the selected range
- Weekend/holiday start dates auto-resolve to the next trading day inside the range
- Weekend/holiday end dates auto-resolve to the prior trading day inside the range
- If no trading days exist in the range, a clean empty state is shown

**Example: March 16-20, 2025**
- March 16 is a Monday (trading day) -> use March 16 open as startOpen
- March 20 is a Thursday (trading day) -> use March 20 close as endClose

### Supported modes

| Mode | Description |
|---|---|
| `START_OPEN_TO_END_CLOSE` | Default — range performance |
| `CLOSE_TO_CLOSE` | Prior close to end close |
| `OPEN_TO_CLOSE` | Open to close |
| `ADJ_CLOSE_TO_ADJ_CLOSE` | Adjusted close to adjusted close |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.local.example .env.local
# Add your POLYGON_API_KEY (or leave blank for mock data)

# 3. Run dev server
npm run dev
```

Open http://localhost:3000

> **No API key?** The app automatically uses realistic mock data when `POLYGON_API_KEY` is missing. A yellow badge in the header shows when mock mode is active.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POLYGON_API_KEY` | Yes (for live data) | Free at polygon.io |
| `USE_MOCK_DATA` | No | Force mock data (true/false) |

---

## Project Structure

```
app/
  layout.tsx                  Root layout
  page.tsx                    Entry point
  globals.css                 Liquid-glass design tokens
  api/heatmap/route.ts        Server-side data + calc API

components/
  HeatMap/
    HeatMapContainer.tsx      State management, data fetching
    HeatMapCanvas.tsx         Canvas with zoom + tile layout
    HeatTile.tsx              Individual animated tile
    HoverCard.tsx             Floating detail card on hover
    MiniChart.tsx             SVG sparkline
    Breadcrumb.tsx            Zoom navigation breadcrumb
    useTreemap.ts             D3 treemap layout hook
  Controls/
    Header.tsx                All controls
  ui/
    GlassPanel.tsx            Reusable glass panel
    LoadingSkeleton.tsx       Shimmer skeletons
    EmptyState.tsx            Error/empty state handler

lib/
  market-data/
    providers/
      types.ts                Shared interfaces
      polygon.ts              Polygon.io — FULLY IMPLEMENTED
      alphavantage.ts         Alpha Vantage — stub
      tiingo.ts               Tiingo — stub
    index.ts                  Provider factory (swap here)
    calculator.ts             Performance calculator
    trading-calendar.ts       US market holiday calendar
    cache.ts                  In-memory candle cache
  universe/
    instruments.ts            S&P 500 subset, Mag7, Sector ETFs
  heatmap-color.ts            Color scale + formatters
```

---

## Adding a Custom Watchlist

Edit `lib/universe/instruments.ts`:

```ts
export const MY_WATCHLIST: UniverseInstrument[] = [
  { symbol: "COIN", name: "Coinbase", sector: "Financials", type: "stock", marketCapBucket: "large" },
];

// Add to WATCHLISTS:
{ id: "my-list", label: "My Watchlist", instruments: MY_WATCHLIST }
```

## Swapping the Data Provider

In `lib/market-data/index.ts`, change:

```ts
import { TiingoProvider } from "./providers/tiingo";
// ...
_provider = new TiingoProvider(process.env.TIINGO_API_TOKEN!);
```

---

## Verification: Calculator Edge Cases

| Case | Behavior |
|---|---|
| All trading days in range | First open, last close |
| Start date on weekend | Resolves to next Monday |
| End date on weekend | Resolves to prior Friday |
| One-day range | Same candle for open and close |
| Missing symbol data | NO_START_CANDLE error, empty state |
| No trading days in range | NO_TRADING_DAYS, clean empty state |
| Market holidays | Skipped by isTradingDay() |
| March 16-20 | Uses March 16 open to March 20 close |

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + custom CSS variables (liquid-glass)
- **Treemap layout:** D3 (d3-hierarchy)
- **Animations:** Framer Motion
- **Market data:** Polygon.io
