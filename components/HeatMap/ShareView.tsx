"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTreemap } from "./useTreemap";
import { HeatTile } from "./HeatTile";
import type { ResolvedInstrument } from "@/lib/market-data/providers/types";

interface ShareViewProps {
  instruments: ResolvedInstrument[];
  sizeMode: "equal" | "marketcap";
  colorMode: "standard" | "intense";
  groupBy: "sector" | "none";
  defaultTitle: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
}

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const fmt = (d: string) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("en-US", opts);
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

// Auto-resize textarea to fit its content
function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

const NOOP = () => {};

export function ShareView({
  instruments,
  sizeMode,
  colorMode,
  groupBy,
  defaultTitle,
  startDate,
  endDate,
  onClose,
}: ShareViewProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState(
    instruments.map((i) => i.symbol).join(", ")
  );

  const subtitleRef = useAutoResize(subtitle);

  // Heatmap canvas sizing
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { groups, flatNodes } = useTreemap({
    instruments,
    width: dimensions.width,
    height: dimensions.height,
    sizeMode,
    groupBy,
    zoomedSector: null,
  });

  const dateDisplay = formatDateRange(startDate, endDate);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "#090a0f",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Close button ────────────────────────────────────────────────── */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 18,
          right: 22,
          zIndex: 10,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "5px 12px",
          color: "rgba(255,255,255,0.5)",
          fontSize: 13,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        ✕ Close
      </button>

      {/* ── Header section ──────────────────────────────────────────────── */}
      <div style={{ padding: "36px 44px 0px", flexShrink: 0 }}>
        {/* Editable title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            background: "none",
            border: "none",
            outline: "none",
            color: "#ffffff",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            width: "100%",
            padding: 0,
            lineHeight: 1.2,
            fontFamily: "inherit",
          }}
        />

        {/* Date range — not editable */}
        <div
          style={{
            color: "rgba(255,255,255,0.38)",
            fontSize: 13,
            marginTop: 6,
            letterSpacing: "0.01em",
          }}
        >
          {dateDisplay}
        </div>

        {/* Editable subtitle / tickers */}
        <textarea
          ref={subtitleRef}
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          rows={1}
          style={{
            background: "none",
            border: "none",
            outline: "none",
            color: "rgba(255,255,255,0.4)",
            fontSize: 12,
            width: "100%",
            padding: 0,
            marginTop: 8,
            resize: "none",
            overflow: "hidden",
            lineHeight: 1.6,
            fontFamily: "ui-monospace, monospace",
            display: "block",
          }}
        />

        {/* Color legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>−5%+</span>
          <div
            style={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              background:
                "linear-gradient(90deg, rgba(239,68,68,0.85), rgba(185,28,28,0.5), rgba(255,255,255,0.07), rgba(0,107,69,0.5), rgba(0,217,126,0.85))",
            }}
          />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>+5%+</span>
        </div>
      </div>

      {/* ── Heatmap canvas ──────────────────────────────────────────────── */}
      <div
        ref={canvasRef}
        style={{
          flex: 1,
          margin: "0 44px 44px",
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          minHeight: 0,
        }}
      >
        {dimensions.width > 0 && (
          <>
            {/* Sector group labels */}
            {groupBy === "sector" &&
              groups.map((group) => (
                <div
                  key={group.id}
                  style={{
                    position: "absolute",
                    left: group.x0,
                    top: group.y0,
                    width: group.width,
                    height: group.height,
                    borderRadius: 8,
                    overflow: "hidden",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 20,
                      padding: "0 6px",
                      display: "flex",
                      alignItems: "center",
                      background: "rgba(0,0,0,0.35)",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: Math.min(10, group.width / 12),
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.55)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {group.label}
                    </span>
                  </div>
                </div>
              ))}

            {/* Tiles — no hover interaction in share view */}
            {flatNodes.map((node) => (
              <HeatTile
                key={node.symbol}
                node={node}
                colorMode={colorMode}
                onHover={NOOP}
                isHighlighted={false}
              />
            ))}
          </>
        )}

        {/* Branding watermark */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 14,
            color: "rgba(255,255,255,0.18)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.04em",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          Lens · Market Heat Map
        </div>
      </div>
    </motion.div>
  );
}
