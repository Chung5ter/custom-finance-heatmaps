"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { PersonalBucket } from "@/lib/personal/buckets";

interface BucketManagerProps {
  isOpen: boolean;
  onClose: () => void;
  buckets: PersonalBucket[];
  onAdd: (label: string, symbols: string[]) => void;
  onUpdate: (id: string, label: string, symbols: string[]) => void;
  onDelete: (id: string) => void;
}

type View =
  | { mode: "list" }
  | { mode: "edit"; bucket: PersonalBucket }
  | { mode: "add" };

function parseSymbols(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z.]{1,10}$/.test(s))
    ),
  ].slice(0, 50);
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

export function BucketManager({
  isOpen,
  onClose,
  buckets,
  onAdd,
  onUpdate,
  onDelete,
}: BucketManagerProps) {
  const [view, setView] = useState<View>({ mode: "list" });
  const [label, setLabel] = useState("");
  const [symbolsText, setSymbolsText] = useState("");
  const [formError, setFormError] = useState("");

  function openAdd() {
    setLabel("");
    setSymbolsText("");
    setFormError("");
    setView({ mode: "add" });
  }

  function openEdit(bucket: PersonalBucket) {
    setLabel(bucket.label);
    setSymbolsText(bucket.symbols.join(", "));
    setFormError("");
    setView({ mode: "edit", bucket });
  }

  function backToList() {
    setView({ mode: "list" });
    setFormError("");
  }

  function handleSave() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("Name is required.");
      return;
    }
    const symbols = parseSymbols(symbolsText);
    if (symbols.length === 0) {
      setFormError("Enter at least one valid ticker symbol.");
      return;
    }
    if (view.mode === "add") {
      onAdd(trimmedLabel, symbols);
    } else if (view.mode === "edit") {
      onUpdate(view.bucket.id, trimmedLabel, symbols);
    }
    backToList();
  }

  function handleDelete(id: string) {
    onDelete(id);
    if (view.mode === "edit" && view.bucket.id === id) backToList();
  }

  function handleClose() {
    backToList();
    onClose();
  }

  const isEditing = view.mode !== "list";
  const parsedSymbols = parseSymbols(symbolsText);
  const title =
    view.mode === "add"
      ? "New Bucket"
      : view.mode === "edit"
      ? "Edit Bucket"
      : "Custom Sources";

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
            onClick={handleClose}
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isEditing && (
                  <button
                    onClick={backToList}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.4)",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                      padding: "2px 4px",
                    }}
                  >
                    ←
                  </button>
                )}
                <span
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  {title}
                </span>
              </div>
              <button
                onClick={handleClose}
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
            <div
              style={{
                padding: "16px 20px 20px",
                maxHeight: "60vh",
                overflowY: "auto",
              }}
            >
              {view.mode === "list" ? (
                <>
                  {buckets.length === 0 ? (
                    <p
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        fontSize: 13,
                        textAlign: "center",
                        margin: "24px 0",
                      }}
                    >
                      No custom buckets yet. Add one below.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {buckets.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            borderRadius: 10,
                            padding: "10px 14px",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                color: "var(--text-primary)",
                                fontSize: 14,
                                fontWeight: 500,
                              }}
                            >
                              {b.label}
                            </div>
                            <div
                              style={{
                                color: "rgba(255,255,255,0.35)",
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              {b.symbols.slice(0, 8).join(", ")}
                              {b.symbols.length > 8
                                ? ` +${b.symbols.length - 8} more`
                                : ""}
                              {" · "}
                              {b.symbols.length} ticker
                              {b.symbols.length !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <button
                            onClick={() => openEdit(b)}
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 6,
                              padding: "4px 10px",
                              cursor: "pointer",
                              color: "rgba(255,255,255,0.55)",
                              fontSize: 12,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            style={{
                              background: "rgba(239,68,68,0.08)",
                              border: "1px solid rgba(239,68,68,0.2)",
                              borderRadius: 6,
                              padding: "4px 10px",
                              cursor: "pointer",
                              color: "rgba(239,68,68,0.7)",
                              fontSize: 12,
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={openAdd}
                    style={{
                      width: "100%",
                      padding: "10px",
                      background: "rgba(59,130,246,0.1)",
                      border: "1px solid rgba(59,130,246,0.25)",
                      borderRadius: 10,
                      cursor: "pointer",
                      color: "#93c5fd",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    + New Bucket
                  </button>
                </>
              ) : (
                /* ── Add / Edit form ─────────────────────────────────────── */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Name */}
                  <div>
                    <label
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      NAME
                    </label>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => {
                        setLabel(e.target.value);
                        setFormError("");
                      }}
                      placeholder="e.g. My Tech"
                      style={inputStyle}
                      autoFocus
                    />
                  </div>

                  {/* Symbols */}
                  <div>
                    <label
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      TICKERS{" "}
                      <span
                        style={{
                          color: "rgba(255,255,255,0.25)",
                          fontWeight: 400,
                        }}
                      >
                        (comma-separated, max 50)
                      </span>
                    </label>
                    <textarea
                      value={symbolsText}
                      onChange={(e) => {
                        setSymbolsText(e.target.value);
                        setFormError("");
                      }}
                      placeholder="AAPL, MSFT, NVDA, GOOGL..."
                      rows={4}
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                        fontFamily: "monospace",
                        fontSize: 13,
                      }}
                    />
                    {symbolsText.trim() && (
                      <div
                        style={{
                          color: "rgba(255,255,255,0.3)",
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        {parsedSymbols.length} valid ticker
                        {parsedSymbols.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {/* Error */}
                  {formError && (
                    <p
                      style={{
                        color: "rgba(239,68,68,0.8)",
                        fontSize: 12,
                        margin: 0,
                      }}
                    >
                      {formError}
                    </p>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    <button
                      onClick={backToList}
                      style={{
                        flex: 1,
                        padding: "9px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        cursor: "pointer",
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 13,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      style={{
                        flex: 2,
                        padding: "9px",
                        background: "rgba(59,130,246,0.2)",
                        border: "1px solid rgba(59,130,246,0.35)",
                        borderRadius: 8,
                        cursor: "pointer",
                        color: "#93c5fd",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      Save Bucket
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
