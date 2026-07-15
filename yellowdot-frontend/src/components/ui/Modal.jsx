import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Button from "./Button";

/**
 * Modal — centered overlay dialog
 *
 * @prop {boolean}   isOpen
 * @prop {function}  onClose
 * @prop {string}    title
 * @prop {ReactNode} footer       replaces the default footer; pass null to hide footer
 * @prop {string}    size         "default" | "wide" | "xl"
 * @prop {boolean}   closeOnBackdrop  (default: true)
 * @prop {string}    className
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "default",
  closeOnBackdrop = true,
  className = "",
}) {
  /* Lock scroll while open */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  /* Escape key to close */
  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = size === "wide" ? "yd-modal-wide" : size === "xl" ? "yd-modal-xl" : "";

  return createPortal(
    <div
      className="yd-overlay"
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose?.(); } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`yd-modal ${sizeClass} ${className}`}>
        {/* Header */}
        <div className="yd-modal-header">
          <h2>{title}</h2>
          <button className="yd-close-btn" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="yd-modal-body">{children}</div>

        {/* Footer */}
        {footer !== null && (
          <div className="yd-modal-footer">
            {footer ?? (
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function XIcon() {
  return <X size={14} strokeWidth={2.5} />;
}
