"use client";
import { AnimatePresence, motion } from "framer-motion";
import { MY_BUCKETS } from "@/lib/personal/buckets";

interface BucketManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BucketManager({ isOpen, onClose }: BucketManagerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 200,
            }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 420,
              maxWidth: "calc(100vw - 32px)",
              zIndex: 201,
              background: "rgba(14,15,22,0.96)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 20px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 15 }}>
                Custom Sources
              </span>
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "2px 6px",
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 20px 20px", maxHeight: "60vh", overflowY: "auto" }}>
              {MY_BUCKETS.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", margin: "24px 0" }}>
                  No custom buckets defined yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {MY_BUCKETS.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 10,
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>
                        {b.label}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>
                        {b.symbols.slice(0, 8).join(", ")}
                        {b.symbols.length > 8 ? ` +${b.symbols.length - 8} more` : ""}
                        {" · "}{b.symbols.length} ticker{b.symbols.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Edit hint */}
              <div
                style={{
                  marginTop: MY_BUCKETS.length === 0 ? 0 : 4,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(59,130,246,0.07)",
                  border: "1px solid rgba(59,130,246,0.18)",
                }}
              >
                <p style={{ color: "rgba(147,197,253,0.7)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  To add or edit buckets, update{" "}
                  <code
                    style={{
                      fontFamily: "monospace",
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 4,
                      padding: "1px 5px",
                      fontSize: 11,
                    }}
                  >
                    lib/personal/buckets.ts
                  </code>
                  {" "}and restart the dev server.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
