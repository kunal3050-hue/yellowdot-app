/**
 * QRManagement.jsx
 * ──────────────────────────────────────────────────────────────────────
 * Admin page for generating and managing school/center QR codes.
 * Route: /qr-management
 * Section: Presence & Safety
 *
 * V1 Features:
 *   - Generate static center QR
 *   - Large preview with center name below
 *   - Download as PNG
 *   - Print-friendly view
 *   - Regenerate with confirmation
 *
 * Architecture:
 *   - qrApi.js calls backend qrService.js
 *   - QR image generated server-side (800px PNG, high error correction)
 *   - Base64 data URL stored in Firestore, returned on load
 *
 * Future: rotating QR, classroom QR, visitor QR, expiring QR
 */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import qrApi from "../services/qrApi";

// ── Print styles injected once ────────────────────────────────────────────────
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .yd-qr-printzone,
  .yd-qr-printzone * { visibility: visible !important; }
  .yd-qr-printzone {
    position: fixed !important;
    inset: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: #fff !important;
  }
}
`;

// ── Spring easing ─────────────────────────────────────────────────────────────
const SPRING = "cubic-bezier(0.22, 1, 0.36, 1)";

// ── Friendly center name from centerId ────────────────────────────────────────
function friendlyName(centerId = "") {
  return centerId
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Format date ───────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function QRManagement() {
  const { user, role }       = useAuth();
  const centerId             = user?.centerId || user?.center || user?.activeCenter || "";
  const [config, setConfig]  = useState(null);   // Firestore QR config
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [centerName, setCenterName] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast]    = useState(null);    // { msg, type }
  const toastTimer           = useRef(null);

  // ── Load existing QR on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!centerId) { setLoading(false); return; }
    qrApi.get(centerId)
      .then(data => {
        setConfig(data.hasQR ? data : null);
        setCenterName(data.centerName || friendlyName(centerId));
      })
      .catch(() => {
        setCenterName(friendlyName(centerId));
      })
      .finally(() => setLoading(false));
  }, [centerId]);

  // ── Toast helper ────────────────────────────────────────────────────────────
  function showToast(msg, type = "success") {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // ── Generate / Regenerate ───────────────────────────────────────────────────
  async function handleGenerate() {
    if (!centerId) return;
    setGenerating(true);
    setShowConfirm(false);
    try {
      const result = await qrApi.generate(centerId, centerName || friendlyName(centerId));
      setConfig({ hasQR: true, ...result });
      showToast(config ? "QR regenerated successfully" : "QR generated successfully");
    } catch (err) {
      showToast(err?.response?.data?.error || "Failed to generate QR. Try again.", "error");
    } finally {
      setGenerating(false);
    }
  }

  // ── Download PNG ────────────────────────────────────────────────────────────
  function handleDownload() {
    if (!config?.qrDataUrl) return;
    const link    = document.createElement("a");
    link.href     = config.qrDataUrl;
    link.download = `yd-qr-${centerId}.png`;
    link.click();
    showToast("QR downloaded");
  }

  // ── Print ───────────────────────────────────────────────────────────────────
  function handlePrint() {
    window.print();
  }

  // ── No center fallback ──────────────────────────────────────────────────────
  if (!loading && !centerId) {
    return (
      <div style={styles.page}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🏫</div>
          <p style={styles.emptyTitle}>No center assigned</p>
          <p style={styles.emptySub}>
            Your account doesn't have a center. Contact your administrator to assign one.
          </p>
        </div>
      </div>
    );
  }

  const hasQR      = config?.hasQR && config?.qrDataUrl;
  const isAdmin    = ["admin","center_admin","center_owner","super_admin","developer"].includes(role);

  return (
    <>
      {/* Print CSS — injected once */}
      <style>{PRINT_CSS}</style>

      <div style={styles.page}>

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>QR Management</h1>
            <p style={styles.subtitle}>
              Generate and print QR codes for attendance, check-in, and visitor scanning.
            </p>
          </div>
          <div style={styles.headerBadge}>
            <span style={styles.badgeDot} />
            V1 · Static
          </div>
        </div>

        {/* ── Main card ────────────────────────────────────────────────────── */}
        <div style={styles.card}>

          {/* Center info bar */}
          <div style={styles.centerBar}>
            <span style={styles.centerLabel}>CENTER</span>
            <span style={styles.centerId}>{centerId}</span>
          </div>

          {loading ? (
            <div style={styles.loadingBox}>
              <LoadingSpinner />
              <p style={styles.loadingText}>Loading QR configuration…</p>
            </div>
          ) : hasQR ? (
            <>
              {/* ── QR preview (also the print zone) ───────────────────────── */}
              <div className="yd-qr-printzone" style={styles.printZone}>
                <div style={styles.qrCard}>
                  <img
                    src={config.qrDataUrl}
                    alt={`QR code for ${centerName}`}
                    style={styles.qrImage}
                  />
                  <p style={styles.qrCenterName}>{config.centerName || centerName}</p>
                  <p style={styles.qrScanHint}>Scan to check in</p>
                </div>
              </div>

              {/* ── Action buttons ──────────────────────────────────────────── */}
              <div style={styles.actions}>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleDownload}>
                  <DownloadIcon /> Download PNG
                </button>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={handlePrint}>
                  <PrintIcon /> Print
                </button>
                {isAdmin && (
                  <button
                    style={{ ...styles.btn, ...styles.btnGhost }}
                    onClick={() => setShowConfirm(true)}
                    disabled={generating}
                  >
                    <RefreshIcon spin={generating} />
                    {generating ? "Regenerating…" : "Regenerate"}
                  </button>
                )}
              </div>

              {/* ── Meta row ────────────────────────────────────────────────── */}
              <div style={styles.metaRow}>
                <MetaTag label="Generated" value={fmtDate(config.generatedAt)} />
                <MetaTag label="Version" value={`V${config.version || 1}`} />
                <MetaTag label="Type" value={config.type || "center"} />
                <MetaTag label="Error Correction" value="High (H)" />
              </div>
            </>
          ) : (
            /* ── Empty state — no QR generated yet ──────────────────────── */
            <div style={styles.emptyQR}>
              <QRPlaceholder />

              {isAdmin && (
                <div style={styles.generateForm}>
                  <label style={styles.fieldLabel}>Center display name</label>
                  <input
                    style={styles.nameInput}
                    value={centerName}
                    onChange={e => setCenterName(e.target.value)}
                    placeholder="e.g. Yellow Dot Seawoods Main"
                    maxLength={60}
                  />
                  <p style={styles.fieldHint}>
                    This name appears below the QR code on print.
                  </p>
                  <button
                    style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnFull }}
                    onClick={handleGenerate}
                    disabled={generating || !centerName.trim()}
                  >
                    {generating ? (
                      <><LoadingSpinnerSm /> Generating…</>
                    ) : (
                      <><QRIcon /> Generate School QR</>
                    )}
                  </button>
                </div>
              )}

              {!isAdmin && (
                <p style={styles.emptySub}>
                  No QR code has been generated for this center yet.
                  Ask your administrator to generate one.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Future-ready info strip ──────────────────────────────────────── */}
        <div style={styles.futureStrip}>
          <p style={styles.futureTitle}>Future QR types</p>
          <div style={styles.futurePills}>
            {["Rotating QR", "Expiring QR", "Classroom QR", "Visitor QR", "Staff QR"].map(t => (
              <span key={t} style={styles.futurePill}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Regenerate confirmation modal ───────────────────────────────────── */}
      {showConfirm && (
        <ConfirmModal
          centerName={centerName}
          setCenterName={setCenterName}
          onConfirm={handleGenerate}
          onCancel={() => setShowConfirm(false)}
          generating={generating}
          existingCenterName={config?.centerName}
        />
      )}

      {/* ── Toast notification ──────────────────────────────────────────────── */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  );
}

// ── Regenerate confirmation modal ─────────────────────────────────────────────
function ConfirmModal({ centerName, setCenterName, onConfirm, onCancel, generating, existingCenterName }) {
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Regenerate QR code?</h2>
        <p style={styles.modalBody}>
          This will replace the existing QR. Any printed or shared copies of
          the old QR will stop working for new scanning modules.
          <br /><br />
          V1 static QR is safe to regenerate — no expiry logic yet.
        </p>

        <label style={styles.fieldLabel}>Center name on print</label>
        <input
          style={styles.nameInput}
          value={centerName}
          onChange={e => setCenterName(e.target.value)}
          placeholder={existingCenterName || "Center display name"}
        />

        <div style={styles.modalActions}>
          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onCancel}>
            Cancel
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnDanger }}
            onClick={onConfirm}
            disabled={generating}
          >
            {generating ? "Regenerating…" : "Regenerate QR"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  const bg = type === "error" ? "#FF3B30" : "#34C759";
  return (
    <div style={{ ...styles.toast, background: bg }}>
      {type === "error" ? "✕" : "✓"} {msg}
    </div>
  );
}

// ── Meta tag ──────────────────────────────────────────────────────────────────
function MetaTag({ label, value }) {
  return (
    <div style={styles.metaTag}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={styles.metaValue}>{value}</span>
    </div>
  );
}

// ── QR placeholder (dashed box shown before generation) ──────────────────────
function QRPlaceholder() {
  return (
    <div style={styles.placeholder}>
      <svg viewBox="0 0 120 120" width={120} height={120} fill="none" stroke="#D0D0D0" strokeWidth="2">
        {/* Mimics QR corner markers */}
        <rect x="8"  y="8"  width="36" height="36" rx="4" />
        <rect x="76" y="8"  width="36" height="36" rx="4" />
        <rect x="8"  y="76" width="36" height="36" rx="4" />
        <rect x="16" y="16" width="20" height="20" rx="2" fill="#E8E8E8" stroke="none" />
        <rect x="84" y="16" width="20" height="20" rx="2" fill="#E8E8E8" stroke="none" />
        <rect x="16" y="84" width="20" height="20" rx="2" fill="#E8E8E8" stroke="none" />
        {/* Data dots */}
        {[60,68,76,84,92,100,108].flatMap(x =>
          [8,16,24,32,40,52,60,68,76].map(y => (
            Math.random() > 0.5
              ? <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1" fill="#E8E8E8" stroke="none" />
              : null
          ))
        )}
      </svg>
      <p style={styles.placeholderText}>No QR generated yet</p>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const ic = { w: 16, h: 16, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

function DownloadIcon() {
  return (
    <svg {...ic} viewBox="0 0 24 24" style={{ marginRight: 6, flexShrink: 0 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg {...ic} viewBox="0 0 24 24" style={{ marginRight: 6, flexShrink: 0 }}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function RefreshIcon({ spin }) {
  return (
    <svg {...ic} viewBox="0 0 24 24"
      style={{ marginRight: 6, flexShrink: 0, animation: spin ? "yd-qr-spin 0.8s linear infinite" : "none" }}>
      <style>{`@keyframes yd-qr-spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function QRIcon() {
  return (
    <svg {...ic} viewBox="0 0 24 24" style={{ marginRight: 6, flexShrink: 0 }}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <line x1="14" y1="14" x2="14" y2="14.01" />
      <line x1="18" y1="14" x2="18" y2="14.01" />
      <line x1="21" y1="14" x2="21" y2="14.01" />
      <line x1="14" y1="18" x2="14" y2="21" />
      <line x1="21" y1="18" x2="21" y2="21" />
      <line x1="14" y1="21" x2="14" y2="21.01" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" fill="none"
      style={{ animation: "yd-qr-spin 0.8s linear infinite", display: "block" }}>
      <circle cx="16" cy="16" r="12" stroke="#E8E8E8" strokeWidth="3" />
      <path d="M16 4a12 12 0 0 1 12 12" stroke="#F4C400" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function LoadingSpinnerSm() {
  return (
    <svg width={16} height={16} viewBox="0 0 32 32" fill="none"
      style={{ animation: "yd-qr-spin 0.8s linear infinite", display: "inline-block", marginRight: 6, verticalAlign: "middle" }}>
      <circle cx="16" cy="16" r="12" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
      <path d="M16 4a12 12 0 0 1 12 12" stroke="white" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    maxWidth:  720,
    margin:    "0 auto",
    padding:   "24px 16px 40px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    animation: `yd-qr-fadein 0.35s ${SPRING} both`,
  },

  // ── Header
  header: {
    display:        "flex",
    alignItems:     "flex-start",
    justifyContent: "space-between",
    gap:            16,
    marginBottom:   24,
    flexWrap:       "wrap",
  },
  title: {
    fontSize:    24,
    fontWeight:  700,
    color:       "#0D0D0D",
    margin:      0,
    letterSpacing: "-0.4px",
  },
  subtitle: {
    fontSize:  14,
    color:     "#777",
    margin:    "4px 0 0",
    lineHeight: 1.4,
  },
  headerBadge: {
    display:      "flex",
    alignItems:   "center",
    gap:          6,
    padding:      "4px 10px",
    borderRadius: 20,
    background:   "#FFF9E6",
    border:       "1px solid #F4C400",
    fontSize:     11,
    fontWeight:   600,
    color:        "#B38000",
    whiteSpace:   "nowrap",
    flexShrink:   0,
  },
  badgeDot: {
    width:        6,
    height:       6,
    borderRadius: "50%",
    background:   "#F4C400",
    display:      "inline-block",
  },

  // ── Card
  card: {
    background:   "#FFFFFF",
    border:       "1px solid #EBEBEB",
    borderRadius: 16,
    overflow:     "hidden",
    marginBottom: 16,
  },
  centerBar: {
    display:         "flex",
    alignItems:      "center",
    gap:             10,
    padding:         "12px 20px",
    background:      "#F8F8F8",
    borderBottom:    "1px solid #EBEBEB",
  },
  centerLabel: {
    fontSize:    10,
    fontWeight:  700,
    letterSpacing: "0.1em",
    color:       "#999",
    textTransform: "uppercase",
  },
  centerId: {
    fontSize:   13,
    color:      "#333",
    fontFamily: "ui-monospace, 'SF Mono', monospace",
  },

  // ── Loading
  loadingBox: {
    display:         "flex",
    flexDirection:   "column",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             12,
    padding:         "60px 24px",
  },
  loadingText: {
    fontSize: 13,
    color:    "#999",
    margin:   0,
  },

  // ── QR printzone + card
  printZone: {
    display:         "flex",
    justifyContent:  "center",
    padding:         "32px 24px 24px",
  },
  qrCard: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    gap:            12,
    padding:        "24px",
    background:     "#FAFAFA",
    border:         "1px solid #EBEBEB",
    borderRadius:   12,
    maxWidth:       340,
    width:          "100%",
  },
  qrImage: {
    width:        "100%",
    maxWidth:     300,
    height:       "auto",
    borderRadius: 8,
    display:      "block",
    imageRendering: "pixelated",  // crisp pixels, no blur
  },
  qrCenterName: {
    fontSize:    16,
    fontWeight:  700,
    color:       "#0D0D0D",
    margin:      0,
    textAlign:   "center",
    letterSpacing: "-0.2px",
  },
  qrScanHint: {
    fontSize:  12,
    color:     "#999",
    margin:    0,
    textAlign: "center",
  },

  // ── Actions
  actions: {
    display:        "flex",
    flexWrap:       "wrap",
    gap:            10,
    padding:        "0 24px 24px",
    justifyContent: "center",
  },

  // ── Meta row
  metaRow: {
    display:     "flex",
    flexWrap:    "wrap",
    gap:         1,
    borderTop:   "1px solid #EBEBEB",
    background:  "#F8F8F8",
  },
  metaTag: {
    display:        "flex",
    flexDirection:  "column",
    padding:        "10px 16px",
    gap:            2,
    flex:           "1 1 auto",
  },
  metaLabel: {
    fontSize:    10,
    fontWeight:  600,
    color:       "#AAAAAA",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },
  metaValue: {
    fontSize:  13,
    color:     "#333",
    fontWeight: 500,
  },

  // ── Empty QR state
  emptyQR: {
    padding:        "40px 24px 32px",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    gap:            20,
  },
  placeholder: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    gap:            12,
    padding:        "24px",
    border:         "2px dashed #E0E0E0",
    borderRadius:   12,
    background:     "#FAFAFA",
  },
  placeholderText: {
    fontSize:  13,
    color:     "#AAAAAA",
    margin:    0,
  },
  generateForm: {
    width:     "100%",
    maxWidth:  400,
    display:   "flex",
    flexDirection: "column",
    gap:       8,
  },

  // ── Empty state (no center)
  emptyState: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    gap:            12,
    padding:        "80px 24px",
    textAlign:      "center",
  },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: "#0D0D0D", margin: 0 },
  emptySub:   { fontSize: 14, color: "#777", margin: 0, maxWidth: 320, lineHeight: 1.5, textAlign: "center" },

  // ── Form fields
  fieldLabel: {
    fontSize:  12,
    fontWeight: 600,
    color:      "#555",
    display:    "block",
  },
  nameInput: {
    width:        "100%",
    padding:      "10px 14px",
    border:       "1.5px solid #E0E0E0",
    borderRadius: 10,
    fontSize:     14,
    color:        "#0D0D0D",
    background:   "#FFFFFF",
    outline:      "none",
    boxSizing:    "border-box",
    transition:   "border-color 0.15s ease",
  },
  fieldHint: {
    fontSize: 12,
    color:    "#AAAAAA",
    margin:   "0 0 4px",
  },

  // ── Buttons
  btn: {
    display:      "inline-flex",
    alignItems:   "center",
    justifyContent: "center",
    padding:      "10px 18px",
    borderRadius: 10,
    fontSize:     14,
    fontWeight:   600,
    cursor:       "pointer",
    border:       "none",
    transition:   "opacity 0.15s ease, transform 0.1s ease",
    userSelect:   "none",
  },
  btnPrimary: {
    background: "#0D0D0D",
    color:      "#FFFFFF",
  },
  btnSecondary: {
    background: "#F2F2F2",
    color:      "#333",
  },
  btnGhost: {
    background: "transparent",
    color:      "#666",
    border:     "1.5px solid #E0E0E0",
  },
  btnDanger: {
    background: "#FF3B30",
    color:      "#FFFFFF",
  },
  btnFull: {
    width: "100%",
  },

  // ── Future strip
  futureStrip: {
    padding:      "14px 16px",
    background:   "#F8F8F8",
    border:       "1px solid #EBEBEB",
    borderRadius: 12,
  },
  futureTitle: {
    fontSize:    11,
    fontWeight:  600,
    color:       "#AAAAAA",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin:      "0 0 8px",
  },
  futurePills: {
    display:  "flex",
    flexWrap: "wrap",
    gap:      6,
  },
  futurePill: {
    padding:      "3px 10px",
    borderRadius: 20,
    fontSize:     12,
    color:        "#888",
    background:   "#EBEBEB",
    fontWeight:   500,
  },

  // ── Modal
  overlay: {
    position:   "fixed",
    inset:      0,
    background: "rgba(0,0,0,0.4)",
    display:    "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex:     1000,
    padding:    16,
  },
  modal: {
    background:   "#FFFFFF",
    borderRadius: 16,
    padding:      "24px",
    maxWidth:     440,
    width:        "100%",
    display:      "flex",
    flexDirection: "column",
    gap:          12,
    animation:    `yd-qr-fadein 0.2s ${SPRING} both`,
  },
  modalTitle: {
    fontSize:   18,
    fontWeight: 700,
    color:      "#0D0D0D",
    margin:     0,
  },
  modalBody: {
    fontSize:   14,
    color:      "#666",
    margin:     0,
    lineHeight: 1.5,
  },
  modalActions: {
    display:  "flex",
    gap:      10,
    justifyContent: "flex-end",
    marginTop: 4,
  },

  // ── Toast
  toast: {
    position:     "fixed",
    bottom:       24,
    left:         "50%",
    transform:    "translateX(-50%)",
    padding:      "10px 20px",
    borderRadius: 30,
    color:        "#FFFFFF",
    fontSize:     14,
    fontWeight:   600,
    zIndex:       2000,
    boxShadow:    "0 4px 20px rgba(0,0,0,0.15)",
    whiteSpace:   "nowrap",
    animation:    `yd-qr-fadein 0.2s ${SPRING} both`,
  },
};

// Inject fade-in keyframe once
if (typeof document !== "undefined") {
  const styleId = "yd-qr-style";
  if (!document.getElementById(styleId)) {
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `@keyframes yd-qr-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`;
    document.head.appendChild(el);
  }
}
