"use client";

interface EmptyStateProps {
  type:
    | "no_trading_days"
    | "no_data"
    | "rate_limit"
    | "invalid_ticker"
    | "partial_data"
    | "error";
  detail?: string;
  onReset?: () => void;
}

const configs: Record<EmptyStateProps["type"], { icon: string; title: string; desc: string }> = {
  no_trading_days: {
    icon: "📅",
    title: "No trading days in range",
    desc: "The selected date range contains no US market trading sessions. Try extending your range or choosing a weekday period.",
  },
  no_data: {
    icon: "📭",
    title: "No data available",
    desc: "No market data was returned for this range. The market may not have traded, or this instrument may not be supported.",
  },
  rate_limit: {
    icon: "⏳",
    title: "Rate limit reached",
    desc: "The data provider returned a rate limit error. Please wait a moment before refreshing.",
  },
  invalid_ticker: {
    icon: "🔍",
    title: "Symbol not found",
    desc: "One or more tickers in this watchlist could not be resolved. Check the universe config.",
  },
  partial_data: {
    icon: "⚠️",
    title: "Partial data",
    desc: "Some instruments returned incomplete candle data for this range. Results shown may be incomplete.",
  },
  error: {
    icon: "⚡",
    title: "Something went wrong",
    desc: "An unexpected error occurred while fetching market data.",
  },
};

export function EmptyState({ type, detail, onReset }: EmptyStateProps) {
  const cfg = configs[type];

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4 px-8 text-center fade-in">
      <div className="text-5xl mb-2 opacity-70">{cfg.icon}</div>
      <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {cfg.title}
      </h3>
      <p className="text-sm max-w-sm" style={{ color: "var(--text-secondary)" }}>
        {cfg.desc}
      </p>
      {detail && (
        <p className="text-xs mono px-3 py-2 rounded-lg max-w-sm break-all"
           style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>
          {detail}
        </p>
      )}
      {onReset && (
        <button
          onClick={onReset}
          className="mt-2 px-4 py-2 text-sm rounded-lg glass glass-hover transition-all"
          style={{ color: "var(--accent-blue)" }}
        >
          Reset to defaults
        </button>
      )}
    </div>
  );
}
