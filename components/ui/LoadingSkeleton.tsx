"use client";
import { clsx } from "clsx";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={clsx("skeleton", className)} style={style} />;
}

export function HeatMapSkeleton() {
  // Simulate a rough treemap grid of tiles
  const tiles = Array.from({ length: 48 }, (_, i) => i);
  const heights = [80, 60, 100, 80, 60, 120, 80, 100, 60, 80, 100, 60];

  return (
    <div className="w-full h-full p-1 flex flex-wrap gap-1 content-start">
      {tiles.map((i) => (
        <Skeleton
          key={i}
          style={{
            height: `${heights[i % heights.length]}px`,
            flexBasis: `${4 + (i % 7) * 2}%`,
            flexGrow: 1,
          }}
        />
      ))}
    </div>
  );
}

export function ControlsSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-7 w-24 ml-auto" />
    </div>
  );
}
