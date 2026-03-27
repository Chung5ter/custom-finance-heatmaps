"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ResolvedInstrument } from "@/lib/market-data/providers/types";
import { fmtPct, fmtPrice } from "@/lib/heatmap-color";

/** Format a raw dollar market cap into e.g. "$3.28T", "$842B", "$12.4M" */
function fmtMarketCap(value: number | undefined): string | null {
  if (value == null || value <= 0) return null;
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}
import { MiniChart } from "./MiniChart";
import { formatDisplayDate } from "@/lib/market-data/trading-calendar";

interface HoverCardProps {
  instrument: ResolvedInstrument | null;
  cursorX: number;
  cursorY: number;
}

const CARD_WIDTH = 220;
const CARD_HEIGHT = 260; // rough estimate for positioning
const OFFSET = 16;

export function HoverCard({ instrument, cursorX, cursorY }: HoverCardProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!instrument) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = cursorX + OFFSET;
    let y = cursorY + OFFSET;

    // Flip left if near right edge
    if (x + CARD_WIDTH + 20 > vw) x = cursorX - CARD_WIDTH - OFFSET;
    // Flip up if near bottom
    if (y + CARD_HEIGHT + 20 > vh) y = cursorY - CARD_HEIGHT - OFFSET;

    setPos({ x: Math.max(8, x), y: Math.max(8, y) });
  }, [instrument, cursorX, cursorY]);

  const positive = instrument ? instrument.percentChange >= 0 : true;
  const returnLabel: Record<string, string> = {
    START_OPEN_TO_END_CLOSE: "Open → Close",
    CLOSE_TO_CLOSE: "Close → Close",
    OPEN_TO_CLOSE: "Open → Close",
    ADJ_CLOSE_TO_ADJ_CLOSE: "Adj. Close → Adj. Close",
  };

  return (
    <AnimatePresence>
      {instrument && (
        <motion.div
          ref={cardRef}
          key={instrument.symbol}
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            width: CARD_WIDTH,
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          <div
            className="glass rounded-2xl overflow-hidden"
            style={{
              background: "rgba(14, 15, 22, 0.88)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.05)",
            }}
          >
            {/* Header */}
            <div
              className="px-4 pt-4 pb-3"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div
                    className="text-xs font-semibold mono tracking-wide"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    {instrument.symbol}
                  </div>
                  <div
                    className="text-sm font-semibold mt-0.5 leading-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {instrument.name}
                  </div>
                  {instrument.sector && (
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {instrument.sector}
                      {instrument.industry ? ` · ${instrument.industry}` : ""}
                    </div>
                  )}
                </div>

                <div
                  className="text-base font-bold tabular-nums shrink-0"
                  style={{ color: positive ? "#00d97e" : "#ef4444" }}
                >
                  {fmtPct(instrument.percentChange)}
                </div>
              </div>
            </div>

            {/* Mini chart */}
            {instrument.candles.length > 1 && (
              <div className="px-3 pt-3">
                <MiniChart
                  candles={instrument.candles}
                  width={CARD_WIDTH - 24}
                  height={44}
                  positive={positive}
                />
              </div>
            )}

            {/* Data rows */}
            <div className="px-4 py-3 flex flex-col gap-2">
              <DataRow
                label={returnLabel[instrument.returnMode] ?? "Return"}
                value={fmtPct(instrument.percentChange)}
                highlight
                positive={positive}
              />
              <DataRow
                label="Start open"
                value={fmtPrice(instrument.startOpen, instrument.currency)}
              />
              <DataRow
                label="End close"
                value={fmtPrice(instrument.endClose, instrument.currency)}
              />

              <div
                className="mt-1 pt-2 flex flex-col gap-1"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <DataRow
                  label="From"
                  value={instrument.resolvedStartDate ? formatDisplayDate(instrument.resolvedStartDate) : "—"}
                />
                <DataRow
                  label="To"
                  value={instrument.resolvedEndDate ? formatDisplayDate(instrument.resolvedEndDate) : "—"}
                />
                {fmtMarketCap(instrument.marketCap) && (
                  <DataRow
                    label="Mkt cap"
                    value={fmtMarketCap(instrument.marketCap)!}
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DataRow({
  label,
  value,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </span>
      <span
        className="text-xs font-semibold mono"
        style={{
          color: highlight
            ? positive
              ? "#00d97e"
              : "#ef4444"
            : "rgba(255,255,255,0.8)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
