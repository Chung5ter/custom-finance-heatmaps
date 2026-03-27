"use client";
/**
 * D3 treemap layout hook.
 *
 * Rendering choice: D3 computes layout (position + size), React renders DOM tiles.
 * This gives us React's event model for hover cards while D3 handles math.
 * SVG/Canvas considered: DOM is better for this use case — density is moderate (50–200 tiles),
 * hover cards need DOM, and we don't need Canvas-level rendering performance.
 */

import { useMemo } from "react";
import * as d3 from "d3";
import type { ResolvedInstrument } from "@/lib/market-data/providers/types";

export interface TreemapNode {
  symbol: string;
  name: string;
  sector: string;
  instrument: ResolvedInstrument;
  // Computed layout
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
}

export interface TreemapGroup {
  id: string;
  label: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
  children: TreemapNode[];
}

interface UseTreemapOptions {
  instruments: ResolvedInstrument[];
  width: number;
  height: number;
  sizeMode: "equal" | "marketcap";
  groupBy: "sector" | "none";
  zoomedSector: string | null;
}

interface D3HierarchyDatum {
  name: string;
  children?: D3HierarchyDatum[];
  value?: number;
  symbol?: string;
  instrument?: ResolvedInstrument;
}

const MARKET_CAP_BUCKET_WEIGHTS: Record<string, number> = {
  mega: 800,
  large: 300,
  mid: 80,
  small: 20,
};

function getWeight(instrument: ResolvedInstrument, sizeMode: "equal" | "marketcap"): number {
  if (sizeMode === "equal") return 1;
  // Use actual marketCap if available, otherwise fall back to bucket weight
  if (instrument.marketCap && instrument.marketCap > 0) {
    return instrument.marketCap / 1e9; // normalize to billions
  }
  return MARKET_CAP_BUCKET_WEIGHTS["large"] ?? 100;
}

export function useTreemap({
  instruments,
  width,
  height,
  sizeMode,
  groupBy,
  zoomedSector,
}: UseTreemapOptions): { groups: TreemapGroup[]; flatNodes: TreemapNode[] } {
  return useMemo(() => {
    if (!instruments.length || width === 0 || height === 0) {
      return { groups: [], flatNodes: [] };
    }

    // Filter to zoomed sector if drilling in
    const filtered = zoomedSector
      ? instruments.filter((i) => (i.sector ?? "Other") === zoomedSector)
      : instruments;

    // Build D3 hierarchy
    let hierarchyData: D3HierarchyDatum;

    if (groupBy === "sector" && !zoomedSector) {
      // Group by sector
      const sectorMap = new Map<string, ResolvedInstrument[]>();
      for (const inst of filtered) {
        const s = inst.sector ?? "Other";
        if (!sectorMap.has(s)) sectorMap.set(s, []);
        sectorMap.get(s)!.push(inst);
      }

      hierarchyData = {
        name: "root",
        children: Array.from(sectorMap.entries()).map(([sector, insts]) => ({
          name: sector,
          children: insts.map((i) => ({
            name: i.symbol,
            symbol: i.symbol,
            value: getWeight(i, sizeMode),
            instrument: i,
          })),
        })),
      };
    } else {
      // Flat — no sector groups
      hierarchyData = {
        name: "root",
        children: filtered.map((i) => ({
          name: i.symbol,
          symbol: i.symbol,
          value: getWeight(i, sizeMode),
          instrument: i,
        })),
      };
    }

    const root = d3.hierarchy<D3HierarchyDatum>(hierarchyData)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const PADDING = groupBy === "sector" && !zoomedSector ? 2 : 1;

    d3.treemap<D3HierarchyDatum>()
      .size([width, height])
      .paddingOuter(PADDING)
      .paddingInner(1)
      .paddingTop(groupBy === "sector" && !zoomedSector ? 22 : 1)
      .round(true)(root);

    type D3Node = d3.HierarchyRectangularNode<D3HierarchyDatum>;

    // Collect leaves (individual instruments)
    const leaves = root.leaves() as D3Node[];

    const flatNodes: TreemapNode[] = leaves
      .filter((l) => l.data.instrument)
      .map((l) => {
        const inst = l.data.instrument!;
        return {
          symbol: inst.symbol,
          name: inst.name,
          sector: inst.sector ?? "Other",
          instrument: inst,
          x0: l.x0,
          y0: l.y0,
          x1: l.x1,
          y1: l.y1,
          width: l.x1 - l.x0,
          height: l.y1 - l.y0,
        };
      });

    // Collect sector groups (depth=1 nodes that have children)
    const groups: TreemapGroup[] = [];
    if (groupBy === "sector" && !zoomedSector) {
      const sectorNodes = root.children as D3Node[] | undefined;
      if (sectorNodes) {
        for (const sg of sectorNodes) {
          const children = flatNodes.filter((n) => n.sector === sg.data.name);
          groups.push({
            id: sg.data.name,
            label: sg.data.name,
            x0: sg.x0,
            y0: sg.y0,
            x1: sg.x1,
            y1: sg.y1,
            width: sg.x1 - sg.x0,
            height: sg.y1 - sg.y0,
            children,
          });
        }
      }
    }

    return { groups, flatNodes };
  }, [instruments, width, height, sizeMode, groupBy, zoomedSector]);
}
