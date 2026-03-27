"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { Header, type HeatMapConfig } from "@/components/Controls/Header";
import { HeatMapCanvas } from "./HeatMapCanvas";
import { ShareView } from "./ShareView";
import { WATCHLISTS } from "@/lib/universe/instruments";
import type { ResolvedInstrument } from "@/lib/market-data/providers/types";

function getDefaultDates() {
  const today = new Date();
  const d5 = new Date(today);
  d5.setDate(d5.getDate() - 5);
  return {
    start: d5.toISOString().slice(0, 10),
    end: today.toISOString().slice(0, 10),
  };
}

const defaults = getDefaultDates();

const DEFAULT_CONFIG: HeatMapConfig = {
  watchlistId: "mag7",
  startDate: defaults.start,
  endDate: defaults.end,
  returnMode: "START_OPEN_TO_END_CLOSE",
  sizeMode: "marketcap",
  colorMode: "standard",
  groupBy: "sector",
};

interface HeatMapApiResponse {
  results: (ResolvedInstrument & { marketCapBucket?: string; error?: string | null })[];
  isMockData?: boolean;
  error?: string;
}

export function HeatMapContainer() {
  const [config, setConfig] = useState<HeatMapConfig>(DEFAULT_CONFIG);
  const [instruments, setInstruments] = useState<ResolvedInstrument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Debounce config changes to avoid flooding the API on rapid date changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (cfg: HeatMapConfig) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate: cfg.startDate,
        endDate: cfg.endDate,
        mode: cfg.returnMode,
      });
      // Custom bucket: pass symbols directly; predefined: pass watchlist id
      if (cfg.customSymbols && cfg.customSymbols.length > 0) {
        params.set("symbols", cfg.customSymbols.join(","));
      } else {
        params.set("watchlist", cfg.watchlistId);
      }

      const res = await fetch(`/api/heatmap?${params.toString()}`);
      const data: HeatMapApiResponse = await res.json();

      if (!res.ok) {
        setError(data.error ?? `API error ${res.status}`);
        setInstruments([]);
        return;
      }

      // Filter out instruments with resolution errors (still show partial results)
      const valid = data.results.filter(
        (r) => !r.error || r.error === null
      );
      const invalid = data.results.filter((r) => r.error);

      if (valid.length === 0 && invalid.length > 0) {
        const firstError = invalid[0]?.error;
        setError(firstError === "NO_TRADING_DAYS"
          ? "No trading days in the selected range."
          : "No data returned for this range."
        );
      }

      setInstruments(valid);
      setIsMockData(data.isMockData ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setInstruments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfigChange = useCallback((updates: Partial<HeatMapConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };

      // Debounce data fetch so date inputs don't thrash
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchData(next);
      }, 400);

      return next;
    });
  }, [fetchData]);

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setError(null);
    fetchData(DEFAULT_CONFIG);
  }, [fetchData]);

  const shareTitle =
    config.customLabel ??
    WATCHLISTS.find((w) => w.id === config.watchlistId)?.label ??
    config.watchlistId;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Header
        config={config}
        onChange={handleConfigChange}
        isLoading={isLoading}
        isMockData={isMockData}
      />

      <HeatMapCanvas
        instruments={instruments}
        sizeMode={config.sizeMode}
        colorMode={config.colorMode}
        groupBy={config.groupBy}
        isLoading={isLoading}
        error={error}
        onReset={handleReset}
        onShare={() => setShareOpen(true)}
      />

      <AnimatePresence>
        {shareOpen && (
          <ShareView
            instruments={instruments}
            sizeMode={config.sizeMode}
            colorMode={config.colorMode}
            groupBy={config.groupBy}
            defaultTitle={shareTitle}
            startDate={config.startDate}
            endDate={config.endDate}
            onClose={() => setShareOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
