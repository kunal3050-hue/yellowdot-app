import { createContext, useContext, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toastVariants, usePrefersReducedMotion, withReducedMotion } from "./motion";

/* ── Context ─────────────────────────────────────────────────────────── */
const ToastContext = createContext(null);

let _nextId = 1;

/**
 * ToastProvider — wrap your app (or layout) with this once.
 * Then call useToast() anywhere inside to show toasts.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "info", duration = 4000) => {
    const id = _nextId++;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    /* Mark as exiting to trigger the fade-out animation */
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, exiting: true } : t))
    );
    /* Remove from DOM after the animation completes */
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 220);
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {createPortal(
        <div className="yd-toast-container" aria-live="polite">
          <AnimatePresence initial={false}>
            {toasts.map(t => (
              <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

/**
 * useToast — returns { show, dismiss }
 *
 * show(message, type, duration)
 *   type:     "success" | "error" | "warn" | "info"
 *   duration: ms before auto-dismiss (0 = never)
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/* ── Single toast item ───────────────────────────────────────────────── */
const ICONS = {
  success: "✓",
  error:   "✕",
  warn:    "⚠",
  info:    "ℹ",
};

function ToastItem({ toast, onDismiss }) {
  const reduced = usePrefersReducedMotion();
  const cls = ["yd-toast", `yd-toast-${toast.type}`].filter(Boolean).join(" ");

  return (
    <motion.div
      className={cls}
      role="alert"
      variants={withReducedMotion(toastVariants, reduced)}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{ICONS[toast.type]}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: "rgba(255,255,255,0.25)",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          color: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          fontSize: 11,
          flexShrink: 0,
          padding: 0,
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </motion.div>
  );
}
