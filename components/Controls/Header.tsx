"use client";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { WATCHLISTS } from "@/lib/universe/instruments";
import { useState, useEffect } from "react";
import { useCustomBuckets } from "@/lib/personal/useCustomBuckets";
import { BucketManager } from "./BucketManager";

export interface HeatMapConfig {
  watchlistId: string;
  // Set when a custom bucket is selected; passed to API as ?symbols=... instead of ?watchlist=
  customSymbols?: string[];
  customLabel?: string;
  startDate: string;
  endDate: string;
  returnMode: string;
  sizeMode: "equal" | "marketcap";
  colorMode: "standard" | "intense";
  groupBy: "sector" | "none";
}

interface HeaderProps {
  config: HeatMapConfig;
  onChange: (updates: Partial<HeatMapConfig>) => void;
  isLoading?: boolean;
  isMockData?: boolean;
}

// Preset date ranges
function getDatePresets() {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const todayStr = fmt(today);

  const d5 = new Date(today);
  d5.setDate(d5.getDate() - 5);

  const d30 = new Date(today);
  d30.setDate(d30.getDate() - 30);

  const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return [
    { label: "Today", start: todayStr, end: todayStr },
    { label: "5D", start: fmt(d5), end: todayStr },
    { label: "1M", start: fmt(d30), end: todayStr },
    { label: "MTD", start: fmt(mtdStart), end: todayStr },
  ];
}

// Given a Monday date string, return that week's Friday as "YYYY-MM-DD".
// No validation that the input is actually a Monday — the date picker enforces that.
function fridayOfWeek(mondayStr: string): string {
  const d = new Date(mondayStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 4); // Mon + 4 = Fri
  return d.toISOString().slice(0, 10);
}

export function Header({ config, onChange, isLoading, isMockData }: HeaderProps) {
  // Defer preset computation to the client to avoid SSR/client timezone mismatch.
  // Server always renders with an empty list; after hydration the real presets appear.
  const [presets, setPresets] = useState<ReturnType<typeof getDatePresets>>([]);
  useEffect(() => { setPresets(getDatePresets()); }, []);

  // "Week of" input — user picks a Monday, we auto-set Mon→Fri
  const [weekOf, setWeekOf] = useState("");

  // Today's date string — client-only to avoid SSR/timezone mismatch on max attr.
  const [todayStr, setTodayStr] = useState("");
  useEffect(() => { setTodayStr(new Date().toISOString().slice(0, 10)); }, []);

  // Custom buckets — managed in localStorage, seeded from MY_BUCKETS on first visit.
  // Hook returns [] during SSR and hydrates from localStorage after mount.
  const { buckets: customBuckets, addBucket, updateBucket, deleteBucket } = useCustomBuckets();
  const [bucketManagerOpen, setBucketManagerOpen] = useState(false);

  return (
    <div className="relative z-20">
      {/* Brand row */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.7) 0%, rgba(139,92,246,0.7) 100%)",
              boxShadow: "0 0 20px rgba(59,130,246,0.3)",
            }}
          >
            ◈
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none" style={{ color: "var(--text-primary)" }}>
              Lens
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Market Heat Map
            </p>
          </div>
        </div>

        {isMockData && (
          <div
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: "rgba(234,179,8,0.12)",
              border: "1px solid rgba(234,179,8,0.25)",
              color: "rgba(234,179,8,0.9)",
            }}
          >
            Demo data — add API key to .env.local for live
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "rgba(59,130,246,0.5)", borderTopColor: "transparent" }}
            />
            <span className="text-xs">Loading…</span>
          </div>
        )}
      </div>

      {/* Control bar */}
      <GlassPanel
        padding="none"
        radius="lg"
        className="mx-4 mb-3 overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">

          {/* Source selector */}
          <div className="flex flex-col gap-1">
            <label className="label-xs" style={{ color: "var(--text-muted)" }}>SOURCE</label>
            <div className="flex items-center gap-1">
              <select
                value={config.customSymbols ? `custom:${config.watchlistId}` : config.watchlistId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith("custom:")) {
                    const id = val.slice(7);
                    const bucket = customBuckets.find((b) => b.id === id);
                    if (bucket) onChange({ watchlistId: id, customSymbols: bucket.symbols, customLabel: bucket.label });
                  } else {
                    onChange({ watchlistId: val, customSymbols: undefined, customLabel: undefined });
                  }
                }}
                className="min-w-[140px]"
              >
                {WATCHLISTS.map((w) => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
                {customBuckets.length > 0 && (
                  <optgroup label="Custom">
                    {customBuckets.map((b) => (
                      <option key={b.id} value={`custom:${b.id}`}>{b.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                onClick={() => setBucketManagerOpen(true)}
                title="Manage custom buckets"
                className="px-2 py-1 rounded-md text-xs transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.45)",
                  cursor: "pointer",
                  lineHeight: 1,
                  fontSize: 14,
                }}
              >
                ⊕
              </button>
            </div>
          </div>

          <BucketManager
            isOpen={bucketManagerOpen}
            onClose={() => setBucketManagerOpen(false)}
            buckets={customBuckets}
            onAdd={addBucket}
            onUpdate={updateBucket}
            onDelete={deleteBucket}
          />

          {/* Date presets */}
          <div className="flex flex-col gap-1">
            <label className="label-xs" style={{ color: "var(--text-muted)" }}>PERIOD</label>
            <div className="flex gap-1">
              {presets.map((p) => {
                const isActive = config.startDate === p.start && config.endDate === p.end;
                return (
                  <button
                    key={p.label}
                    onClick={() => onChange({ startDate: p.start, endDate: p.end })}
                    className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                    style={{
                      background: isActive ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isActive ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: isActive ? "#93c5fd" : "var(--text-secondary)",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Week of — pick a Monday, auto-fills Mon open → Fri close */}
          <div className="flex flex-col gap-1">
            <label className="label-xs" style={{ color: "var(--text-muted)" }}>WEEK OF</label>
            <input
              type="date"
              value={weekOf}
              max={todayStr || undefined}
              onChange={(e) => {
                const monday = e.target.value;
                setWeekOf(monday);
                if (monday) {
                  onChange({ startDate: monday, endDate: fridayOfWeek(monday) });
                }
              }}
              className="w-36"
              placeholder="Pick a Monday"
              suppressHydrationWarning
            />
          </div>

          {/* Custom date range */}
          <div className="flex flex-col gap-1">
            <label className="label-xs" style={{ color: "var(--text-muted)" }}>CUSTOM RANGE</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={config.startDate}
                max={todayStr || undefined}
                onChange={(e) => onChange({ startDate: e.target.value })}
                className="w-36"
                suppressHydrationWarning
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
              <input
                type="date"
                value={config.endDate}
                max={todayStr || undefined}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className="w-36"
                suppressHydrationWarning
              />
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block h-8 w-px" style={{ background: "rgba(255,255,255,0.07)" }} />

          {/* Metric */}
          <div className="flex flex-col gap-1">
            <label className="label-xs" style={{ color: "var(--text-muted)" }}>METRIC</label>
            <select
              value={config.returnMode}
              onChange={(e) => onChange({ returnMode: e.target.value })}
              className="min-w-[160px]"
            >
              <option value="START_OPEN_TO_END_CLOSE">Open → Close</option>
              <option value="CLOSE_TO_CLOSE">Close → Close</option>
            </select>
          </div>

          {/* Size mode */}
          <div className="flex flex-col gap-1">
            <label className="label-xs" style={{ color: "var(--text-muted)" }}>SIZE BY</label>
            <div className="flex gap-1">
              {(["equal", "marketcap"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onChange({ sizeMode: mode })}
                  className="px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all"
                  style={{
                    background: config.sizeMode === mode ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${config.sizeMode === mode ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: config.sizeMode === mode ? "#93c5fd" : "var(--text-secondary)",
                  }}
                >
                  {mode === "marketcap" ? "Mkt Cap" : "Equal"}
                </button>
              ))}
            </div>
          </div>

          {/* Group by */}
          <div className="flex flex-col gap-1">
            <label className="label-xs" style={{ color: "var(--text-muted)" }}>GROUP BY</label>
            <div className="flex gap-1">
              {(["sector", "none"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => onChange({ groupBy: g })}
                  className="px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all"
                  style={{
                    background: config.groupBy === g ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${config.groupBy === g ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: config.groupBy === g ? "#93c5fd" : "var(--text-secondary)",
                  }}
                >
                  {g === "sector" ? "Sector" : "Flat"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
