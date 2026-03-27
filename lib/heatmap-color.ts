/**
 * Heatmap color mapping — perceptually balanced green/red scale
 *
 * Uses a stepped scale anchored at meaningful return thresholds:
 *   > +5%: strong green
 *   +2–5%: medium green
 *   +0.5–2%: light green
 *   ±0.5%: near-neutral charcoal
 *   -0.5 to -2%: light red
 *   -2 to -5%: medium red
 *   < -5%: strong red
 */

interface HeatColor {
  background: string;
  text: string;
  glow: string;
}

export function getHeatColor(pct: number, mode: "standard" | "intense" = "standard"): HeatColor {
  const multiplier = mode === "intense" ? 1.5 : 1;
  const abs = Math.abs(pct) * multiplier;

  if (pct >= 5 * (1 / multiplier)) {
    return {
      background: "rgba(0, 217, 126, 0.72)",
      text: "rgba(0,255,160,1)",
      glow: "0 0 24px rgba(0,217,126,0.4)",
    };
  } else if (pct >= 2 * (1 / multiplier)) {
    return {
      background: "rgba(0, 168, 107, 0.62)",
      text: "rgba(0,230,140,0.95)",
      glow: "0 0 16px rgba(0,168,107,0.3)",
    };
  } else if (pct >= 0.5 * (1 / multiplier)) {
    return {
      background: "rgba(0, 107, 69, 0.55)",
      text: "rgba(100,220,160,0.9)",
      glow: "none",
    };
  } else if (abs < 0.5 * (1 / multiplier)) {
    return {
      background: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.55)",
      glow: "none",
    };
  } else if (pct > -2 * (1 / multiplier)) {
    return {
      background: "rgba(122, 26, 26, 0.55)",
      text: "rgba(255,160,160,0.9)",
      glow: "none",
    };
  } else if (pct > -5 * (1 / multiplier)) {
    return {
      background: "rgba(185, 28, 28, 0.62)",
      text: "rgba(255,120,120,0.95)",
      glow: "0 0 16px rgba(185,28,28,0.3)",
    };
  } else {
    return {
      background: "rgba(239, 68, 68, 0.72)",
      text: "rgba(255,100,100,1)",
      glow: "0 0 24px rgba(239,68,68,0.4)",
    };
  }
}

/** Format percent change for display */
export function fmtPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/** Format currency price */
export function fmtPrice(price: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/** Format large numbers (market cap) */
export function fmtLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
