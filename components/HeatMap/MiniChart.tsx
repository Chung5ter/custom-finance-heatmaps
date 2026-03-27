"use client";
import { useMemo } from "react";
import type { DailyCandle } from "@/lib/market-data/providers/types";

interface MiniChartProps {
  candles: DailyCandle[];
  width?: number;
  height?: number;
  positive: boolean;
}

export function MiniChart({ candles, width = 180, height = 48, positive }: MiniChartProps) {
  const path = useMemo(() => {
    if (!candles.length) return null;

    const closes = candles.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const xStep = width / Math.max(closes.length - 1, 1);
    const points = closes.map((v, i) => {
      const x = i * xStep;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M${points.join(" L")}`;
  }, [candles, width, height]);

  if (!path) return null;

  const strokeColor = positive ? "rgba(0,217,126,0.85)" : "rgba(239,68,68,0.85)";
  const fillColor = positive ? "rgba(0,217,126,0.08)" : "rgba(239,68,68,0.08)";

  // Build fill path (close the shape at bottom)
  const fillPath = path + ` L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Fill under line */}
      <path d={fillPath} fill={fillColor} stroke="none" />
      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
