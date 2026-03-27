"use client";
import { memo } from "react";
import { getHeatColor, fmtPct } from "@/lib/heatmap-color";
import type { TreemapNode } from "./useTreemap";
import type { ResolvedInstrument } from "@/lib/market-data/providers/types";

interface HeatTileProps {
  node: TreemapNode;
  colorMode: "standard" | "intense";
  onHover: (instrument: ResolvedInstrument | null, x: number, y: number) => void;
  onClick?: (instrument: ResolvedInstrument) => void;
  isHighlighted?: boolean;
}

/** Minimum tile dimension for showing a label */
const SHOW_TICKER_MIN = 28;
const SHOW_NAME_MIN = 60;
const SHOW_PCT_MIN = 34;

export const HeatTile = memo(function HeatTile({
  node,
  colorMode,
  onHover,
  onClick,
  isHighlighted,
}: HeatTileProps) {
  const { x0, y0, width, height, instrument } = node;
  const { percentChange } = instrument;
  const color = getHeatColor(percentChange, colorMode);

  const showTicker = width > SHOW_TICKER_MIN && height > SHOW_TICKER_MIN;
  const showName = width > SHOW_NAME_MIN && height > SHOW_NAME_MIN;
  const showPct = width > SHOW_PCT_MIN && height > SHOW_PCT_MIN;

  // Font size scaling based on tile size
  const tickerSize = Math.min(21, Math.max(12, Math.floor(Math.min(width, height) / 6 * 1.5)));
  const pctSize = Math.min(18, Math.max(10, tickerSize - 3));
  const nameSize = Math.max(10, tickerSize - 4);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${instrument.name} (${instrument.symbol}): ${fmtPct(percentChange)}`}
      style={{
        position: "absolute",
        left: x0,
        top: y0,
        width,
        height,
        background: color.background,
        boxShadow: isHighlighted ? color.glow : "inset 0 0 0 0.5px rgba(0,0,0,0.3)",
        borderRadius: Math.min(6, width / 8, height / 8),
        cursor: "pointer",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2px",
        transition: "filter 0.12s ease, transform 0.12s ease",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        onHover(instrument, e.clientX, e.clientY);
      }}
      onMouseMove={(e) => {
        onHover(instrument, e.clientX, e.clientY);
      }}
      onMouseLeave={() => onHover(null, 0, 0)}
      onClick={() => onClick?.(instrument)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.(instrument);
      }}
    >
      {/* Inner glass sheen */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Labels */}
      {showTicker && (
        <div style={{ position: "relative", textAlign: "center", lineHeight: 1.2, padding: "0 2px" }}>
          <div
            style={{
              fontSize: tickerSize,
              fontWeight: 700,
              color: color.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: width - 4,
            }}
          >
            {instrument.symbol}
          </div>

          {showName && (
            <div
              style={{
                fontSize: nameSize,
                color: "rgba(255,255,255,0.55)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: width - 4,
                marginTop: 1,
              }}
            >
              {instrument.name}
            </div>
          )}

          {showPct && (
            <div
              style={{
                fontSize: pctSize,
                fontWeight: 600,
                color: color.text,
                marginTop: 2,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtPct(percentChange)}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
