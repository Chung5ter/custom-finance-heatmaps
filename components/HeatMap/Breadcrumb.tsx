"use client";
import { AnimatePresence, motion } from "framer-motion";

interface BreadcrumbProps {
  zoomedSector: string | null;
  onReset: () => void;
  totalInView: number;
}

export function Breadcrumb({ zoomedSector, onReset, totalInView }: BreadcrumbProps) {
  return (
    <AnimatePresence>
      {zoomedSector && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2 px-4 py-2"
        >
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs glass rounded-lg px-2.5 py-1.5 glass-hover transition-all"
            style={{ color: "rgba(59,130,246,0.9)" }}
          >
            <span>←</span>
            <span>All sectors</span>
          </button>

          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>/</span>

          <span
            className="text-xs font-semibold"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            {zoomedSector}
          </span>

          <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            ({totalInView} stocks)
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
