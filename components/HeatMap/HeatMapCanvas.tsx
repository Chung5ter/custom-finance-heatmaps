"use client";
import { useCallback, useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTreemap } from "./useTreemap";
import { HeatTile } from "./HeatTile";
import { HoverCard } from "./HoverCard";
import { Breadcrumb } from "./Breadcrumb";
import type { ResolvedInstrument } from "@/lib/market-data/providers/types";
import { HeatMapSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface HeatMapCanvasProps {
  instruments: ResolvedInstrument[];
  sizeMode: "equal" | "marketcap";
  colorMode: "standard" | "intense";
  groupBy: "sector" | "none";
  isLoading: boolean;
  error?: string | null;
  onReset?: () => void;
  onShare?: () => void;
}

const HOVER_DELAY_MS = 80;   // ms before showing card
const HOVER_LEAVE_MS = 120;  // ms before hiding card

export function HeatMapCanvas({
  instruments,
  sizeMode,
  colorMode,
  groupBy,
  isLoading,
  error,
  onReset,
  onShare,
}: HeatMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Zoom state
  const [zoomedSector, setZoomedSector] = useState<string | null>(null);

  // Hover state
  const [hoveredInstrument, setHoveredInstrument] = useState<ResolvedInstrument | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset zoom when instruments change
  useEffect(() => {
    setZoomedSector(null);
  }, [instruments]);

  const { groups, flatNodes } = useTreemap({
    instruments,
    width: dimensions.width,
    height: dimensions.height,
    sizeMode,
    groupBy,
    zoomedSector,
  });

  const handleHover = useCallback(
    (instrument: ResolvedInstrument | null, x: number, y: number) => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      if (instrument) {
        setCursorPos({ x, y });
        hoverTimerRef.current = setTimeout(() => {
          setHoveredInstrument(instrument);
        }, HOVER_DELAY_MS);
      } else {
        leaveTimerRef.current = setTimeout(() => {
          setHoveredInstrument(null);
        }, HOVER_LEAVE_MS);
      }
    },
    []
  );

  const handleTileClick = useCallback((instrument: ResolvedInstrument) => {
    if (groupBy === "sector" && !zoomedSector) {
      // Drill into sector
      setZoomedSector(instrument.sector ?? null);
    }
  }, [groupBy, zoomedSector]);

  const handleGroupClick = useCallback((sectorId: string) => {
    setZoomedSector(sectorId);
  }, []);

  const inViewCount = zoomedSector
    ? instruments.filter((i) => (i.sector ?? "Other") === zoomedSector).length
    : instruments.length;

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      {/* Breadcrumb */}
      <Breadcrumb
        zoomedSector={zoomedSector}
        onReset={() => setZoomedSector(null)}
        totalInView={inViewCount}
      />

      {/* Color legend strip */}
      <div className="flex items-center gap-2 px-4 pb-2">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>−5%+</span>
        <div
          className="flex-1 h-1.5 rounded-full"
          style={{
            background: "linear-gradient(90deg, rgba(239,68,68,0.8), rgba(185,28,28,0.5), rgba(255,255,255,0.06), rgba(0,107,69,0.5), rgba(0,217,126,0.8))",
          }}
        />
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>+5%+</span>
        {onShare && instruments.length > 0 && (
          <button
            onClick={onShare}
            title="Share / screenshot view"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all"
            style={{
              marginLeft: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.45)",
              cursor: "pointer",
            }}
          >
            ↗ Share
          </button>
        )}
      </div>

      {/* Main canvas area */}
      <div
        ref={containerRef}
        className="relative mx-4 mb-4"
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 fade-in">
            <HeatMapSkeleton />
          </div>
        )}

        {!isLoading && error && (
          <EmptyState
            type={error.includes("rate") ? "rate_limit" : "error"}
            detail={error}
            onReset={onReset}
          />
        )}

        {!isLoading && !error && instruments.length === 0 && (
          <EmptyState type="no_data" onReset={onReset} />
        )}

        {!isLoading && !error && instruments.length > 0 && dimensions.width > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${zoomedSector ?? "root"}-${sizeMode}-${groupBy}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: "absolute", inset: 0 }}
            >
              {/* Sector group labels (top-level, not zoomed) */}
              {groupBy === "sector" && !zoomedSector && groups.map((group) => (
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
                  }}
                >
                  {/* Sector label bar */}
                  <div
                    onClick={() => handleGroupClick(group.id)}
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
                      cursor: "zoom-in",
                      zIndex: 5,
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
                    {group.width > 80 && (
                      <span
                        style={{
                          fontSize: 9,
                          marginLeft: 4,
                          color: "rgba(255,255,255,0.25)",
                        }}
                      >
                        ⊕
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Tiles */}
              {flatNodes.map((node) => (
                <HeatTile
                  key={node.symbol}
                  node={node}
                  colorMode={colorMode}
                  onHover={handleHover}
                  onClick={handleTileClick}
                  isHighlighted={hoveredInstrument?.symbol === node.symbol}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Hover card — rendered outside canvas so it's never clipped */}
      <HoverCard
        instrument={hoveredInstrument}
        cursorX={cursorPos.x}
        cursorY={cursorPos.y}
      />
    </div>
  );
}
