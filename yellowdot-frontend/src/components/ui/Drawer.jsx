import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { overlayVariants, drawerVariants, usePrefersReducedMotion, withReducedMotion } from "./motion";

/**
 * Drawer — slide-in panel from the right
 *
 * @prop {boolean}   isOpen
 * @prop {function}  onClose
 * @prop {string}    title
 * @prop {ReactNode} footer
 * @prop {number}    width       pixel width (default: 480)
 * @prop {string}    className
 */
export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = 480,
  className = "",
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const reduced = usePrefersReducedMotion();

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        className="yd-drawer-overlay"
        onClick={onClose}
        aria-hidden="true"
        variants={withReducedMotion(overlayVariants, reduced)}
        initial="hidden"
        animate="visible"
      />

      {/* Panel */}
      <motion.div
        className={`yd-drawer ${className}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        variants={withReducedMotion(drawerVariants, reduced)}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <div className="yd-drawer-header">
          <h2>{title}</h2>
          <button className="yd-close-btn" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="yd-drawer-body">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="yd-drawer-footer">{footer}</div>
        )}
      </motion.div>
    </>,
    document.body
  );
}

function XIcon() {
  return <X size={14} strokeWidth={2.5} />;
}
