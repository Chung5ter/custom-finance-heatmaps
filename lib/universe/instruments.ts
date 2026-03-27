/**
 * Instrument Universe Definitions
 *
 * Edit this file to change the default watchlist universe.
 * Add custom watchlists by appending to WATCHLISTS below.
 * All ticker lists are loaded server-side — never exposed in client bundles.
 */

export interface UniverseInstrument {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
  type: "stock" | "etf" | "index";
  marketCapBucket?: "mega" | "large" | "mid" | "small"; // rough sizing for treemap weight
  weight?: number; // optional manual weight override
  // Approximate shares outstanding (in whole shares). Used to compute
  // implied market cap = endClose × sharesOutstanding. Update periodically
  // as shares change via buybacks or issuances. Source: SEC filings / Yahoo Finance.
  sharesOutstanding?: number;
}

// ─── Magnificent 7 ────────────────────────────────────────────────────────────
// sharesOutstanding: approximate diluted shares as of early 2026 (whole shares).
// Source: latest SEC 10-Q/10-K filings. Update as needed.
export const MAG7: UniverseInstrument[] = [
  { symbol: "AAPL", name: "Apple",     sector: "Technology",             industry: "Consumer Electronics", type: "stock", marketCapBucket: "mega", sharesOutstanding: 15_022_000_000 },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology",             industry: "Software",             type: "stock", marketCapBucket: "mega", sharesOutstanding:  7_433_000_000 },
  { symbol: "NVDA", name: "NVIDIA",    sector: "Technology",             industry: "Semiconductors",       type: "stock", marketCapBucket: "mega", sharesOutstanding: 24_370_000_000 },
  { symbol: "GOOGL", name: "Alphabet", sector: "Communication Services", industry: "Internet",             type: "stock", marketCapBucket: "mega", sharesOutstanding: 12_000_000_000 },
  { symbol: "AMZN", name: "Amazon",    sector: "Consumer Discretionary", industry: "E-Commerce",           type: "stock", marketCapBucket: "mega", sharesOutstanding: 10_550_000_000 },
  { symbol: "META", name: "Meta",      sector: "Communication Services", industry: "Social Media",         type: "stock", marketCapBucket: "mega", sharesOutstanding:  2_545_000_000 },
  { symbol: "TSLA", name: "Tesla",     sector: "Consumer Discretionary", industry: "Electric Vehicles",    type: "stock", marketCapBucket: "mega", sharesOutstanding:  3_210_000_000 },
];

// ─── S&P 500 Subset — Representative ~50 names across all sectors ─────────────
export const SP500_SUBSET: UniverseInstrument[] = [
  // Technology
  { symbol: "AAPL", name: "Apple", sector: "Technology", industry: "Consumer Electronics", type: "stock", marketCapBucket: "mega" },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology", industry: "Software", type: "stock", marketCapBucket: "mega" },
  { symbol: "NVDA", name: "NVIDIA", sector: "Technology", industry: "Semiconductors", type: "stock", marketCapBucket: "mega" },
  { symbol: "AVGO", name: "Broadcom", sector: "Technology", industry: "Semiconductors", type: "stock", marketCapBucket: "mega" },
  { symbol: "ORCL", name: "Oracle", sector: "Technology", industry: "Software", type: "stock", marketCapBucket: "large" },
  { symbol: "CRM", name: "Salesforce", sector: "Technology", industry: "Software", type: "stock", marketCapBucket: "large" },
  { symbol: "AMD", name: "AMD", sector: "Technology", industry: "Semiconductors", type: "stock", marketCapBucket: "large" },
  { symbol: "INTC", name: "Intel", sector: "Technology", industry: "Semiconductors", type: "stock", marketCapBucket: "large" },
  { symbol: "AMAT", name: "Applied Materials", sector: "Technology", industry: "Semiconductor Equipment", type: "stock", marketCapBucket: "large" },
  // Communication Services
  { symbol: "GOOGL", name: "Alphabet", sector: "Communication Services", industry: "Internet", type: "stock", marketCapBucket: "mega" },
  { symbol: "META", name: "Meta", sector: "Communication Services", industry: "Social Media", type: "stock", marketCapBucket: "mega" },
  { symbol: "NFLX", name: "Netflix", sector: "Communication Services", industry: "Streaming", type: "stock", marketCapBucket: "large" },
  { symbol: "DIS", name: "Disney", sector: "Communication Services", industry: "Entertainment", type: "stock", marketCapBucket: "large" },
  { symbol: "T", name: "AT&T", sector: "Communication Services", industry: "Telecom", type: "stock", marketCapBucket: "large" },
  // Consumer Discretionary
  { symbol: "AMZN", name: "Amazon", sector: "Consumer Discretionary", industry: "E-Commerce", type: "stock", marketCapBucket: "mega" },
  { symbol: "TSLA", name: "Tesla", sector: "Consumer Discretionary", industry: "Electric Vehicles", type: "stock", marketCapBucket: "mega" },
  { symbol: "HD", name: "Home Depot", sector: "Consumer Discretionary", industry: "Home Improvement", type: "stock", marketCapBucket: "large" },
  { symbol: "MCD", name: "McDonald's", sector: "Consumer Discretionary", industry: "Restaurants", type: "stock", marketCapBucket: "large" },
  { symbol: "NKE", name: "Nike", sector: "Consumer Discretionary", industry: "Apparel", type: "stock", marketCapBucket: "large" },
  // Consumer Staples
  { symbol: "WMT", name: "Walmart", sector: "Consumer Staples", industry: "Retail", type: "stock", marketCapBucket: "mega" },
  { symbol: "PG", name: "P&G", sector: "Consumer Staples", industry: "Household Products", type: "stock", marketCapBucket: "mega" },
  { symbol: "KO", name: "Coca-Cola", sector: "Consumer Staples", industry: "Beverages", type: "stock", marketCapBucket: "large" },
  { symbol: "PEP", name: "PepsiCo", sector: "Consumer Staples", industry: "Beverages", type: "stock", marketCapBucket: "large" },
  { symbol: "COST", name: "Costco", sector: "Consumer Staples", industry: "Retail", type: "stock", marketCapBucket: "large" },
  // Healthcare
  { symbol: "LLY", name: "Eli Lilly", sector: "Healthcare", industry: "Pharmaceuticals", type: "stock", marketCapBucket: "mega" },
  { symbol: "UNH", name: "UnitedHealth", sector: "Healthcare", industry: "Managed Care", type: "stock", marketCapBucket: "mega" },
  { symbol: "JNJ", name: "J&J", sector: "Healthcare", industry: "Pharmaceuticals", type: "stock", marketCapBucket: "mega" },
  { symbol: "ABBV", name: "AbbVie", sector: "Healthcare", industry: "Pharmaceuticals", type: "stock", marketCapBucket: "large" },
  { symbol: "MRK", name: "Merck", sector: "Healthcare", industry: "Pharmaceuticals", type: "stock", marketCapBucket: "large" },
  // Financials
  { symbol: "BRK-B", name: "Berkshire B", sector: "Financials", industry: "Diversified", type: "stock", marketCapBucket: "mega" },
  { symbol: "JPM", name: "JPMorgan", sector: "Financials", industry: "Banking", type: "stock", marketCapBucket: "mega" },
  { symbol: "V", name: "Visa", sector: "Financials", industry: "Payments", type: "stock", marketCapBucket: "mega" },
  { symbol: "MA", name: "Mastercard", sector: "Financials", industry: "Payments", type: "stock", marketCapBucket: "mega" },
  { symbol: "GS", name: "Goldman Sachs", sector: "Financials", industry: "Investment Banking", type: "stock", marketCapBucket: "large" },
  { symbol: "BAC", name: "Bank of America", sector: "Financials", industry: "Banking", type: "stock", marketCapBucket: "large" },
  // Energy
  { symbol: "XOM", name: "ExxonMobil", sector: "Energy", industry: "Oil & Gas", type: "stock", marketCapBucket: "mega" },
  { symbol: "CVX", name: "Chevron", sector: "Energy", industry: "Oil & Gas", type: "stock", marketCapBucket: "large" },
  { symbol: "COP", name: "ConocoPhillips", sector: "Energy", industry: "Oil & Gas", type: "stock", marketCapBucket: "large" },
  // Industrials
  { symbol: "CAT", name: "Caterpillar", sector: "Industrials", industry: "Machinery", type: "stock", marketCapBucket: "large" },
  { symbol: "HON", name: "Honeywell", sector: "Industrials", industry: "Conglomerates", type: "stock", marketCapBucket: "large" },
  { symbol: "UPS", name: "UPS", sector: "Industrials", industry: "Logistics", type: "stock", marketCapBucket: "large" },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials", industry: "Aerospace", type: "stock", marketCapBucket: "large" },
  // Real Estate
  { symbol: "AMT", name: "American Tower", sector: "Real Estate", industry: "REITs", type: "stock", marketCapBucket: "large" },
  { symbol: "PLD", name: "Prologis", sector: "Real Estate", industry: "REITs", type: "stock", marketCapBucket: "large" },
  // Utilities
  { symbol: "NEE", name: "NextEra Energy", sector: "Utilities", industry: "Electric Utilities", type: "stock", marketCapBucket: "large" },
  { symbol: "DUK", name: "Duke Energy", sector: "Utilities", industry: "Electric Utilities", type: "stock", marketCapBucket: "large" },
  // Materials
  { symbol: "LIN", name: "Linde", sector: "Materials", industry: "Chemicals", type: "stock", marketCapBucket: "large" },
  { symbol: "FCX", name: "Freeport-McMoRan", sector: "Materials", industry: "Copper Mining", type: "stock", marketCapBucket: "mid" },
];

// ─── Sector ETFs ──────────────────────────────────────────────────────────────
export const SECTOR_ETFS: UniverseInstrument[] = [
  { symbol: "XLK", name: "Tech Sector ETF", sector: "Technology", type: "etf", marketCapBucket: "mega" },
  { symbol: "XLC", name: "Comm Services ETF", sector: "Communication Services", type: "etf", marketCapBucket: "large" },
  { symbol: "XLY", name: "Cons Discretionary ETF", sector: "Consumer Discretionary", type: "etf", marketCapBucket: "large" },
  { symbol: "XLP", name: "Cons Staples ETF", sector: "Consumer Staples", type: "etf", marketCapBucket: "large" },
  { symbol: "XLV", name: "Healthcare ETF", sector: "Healthcare", type: "etf", marketCapBucket: "large" },
  { symbol: "XLF", name: "Financials ETF", sector: "Financials", type: "etf", marketCapBucket: "large" },
  { symbol: "XLE", name: "Energy ETF", sector: "Energy", type: "etf", marketCapBucket: "large" },
  { symbol: "XLI", name: "Industrials ETF", sector: "Industrials", type: "etf", marketCapBucket: "large" },
  { symbol: "XLRE", name: "Real Estate ETF", sector: "Real Estate", type: "etf", marketCapBucket: "mid" },
  { symbol: "XLU", name: "Utilities ETF", sector: "Utilities", type: "etf", marketCapBucket: "mid" },
  { symbol: "XLB", name: "Materials ETF", sector: "Materials", type: "etf", marketCapBucket: "mid" },
];

// ─── Watchlist definitions (add custom watchlists here) ──────────────────────
export interface Watchlist {
  id: string;
  label: string;
  instruments: UniverseInstrument[];
}

export const WATCHLISTS: Watchlist[] = [
  // SP500_SUBSET and SECTOR_ETFS commented out during dev to avoid burning API quota.
  // Un-comment when ready to test larger universes.
  // { id: "sp500", label: "S&P 500 (subset)", instruments: SP500_SUBSET },
  { id: "mag7", label: "Magnificent 7", instruments: MAG7 },
  // { id: "sector-etfs", label: "Sector ETFs", instruments: SECTOR_ETFS },
];

export const DEFAULT_WATCHLIST_ID = "mag7";

export function getWatchlist(id: string): Watchlist {
  return WATCHLISTS.find((w) => w.id === id) ?? WATCHLISTS[0];
}

// Market cap bucket → numeric weight (for treemap sizing)
const BUCKET_WEIGHTS: Record<string, number> = {
  mega: 4,
  large: 2,
  mid: 1,
  small: 0.5,
};

export function getMarketCapWeight(instrument: UniverseInstrument): number {
  return BUCKET_WEIGHTS[instrument.marketCapBucket ?? "mid"] ?? 1;
}
