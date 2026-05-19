import { useEffect } from "react";
import { createPortal } from "react-dom";

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

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="yd-drawer-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`yd-drawer ${className}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
      </div>
    </>,
    document.body
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
