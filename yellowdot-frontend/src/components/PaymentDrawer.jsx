/**
 * PaymentDrawer.jsx — Smart Payment Collection Experience
 * ─────────────────────────────────────────────────────────
 * A dedicated, conversion-optimised payment screen for:
 *   – UPI QR code with exact invoice amount
 *   – WhatsApp share with pre-filled UPI deep link
 *   – Bank transfer details with 1-tap copy
 *   – Cash / Cheque instructions
 *   – Payment history
 *   – "Record Payment" trigger
 *
 * Rendered as a fixed right-side panel (480px) with backdrop.
 * Works from both Invoice list page and standalone InvoiceView.
 *
 * Props:
 *   open            bool
 *   invoice         object   — invoice record
 *   payments        array    — existing payments (optional; shows history)
 *   onClose         fn
 *   onRecord        fn(inv)  — opens RecordPaymentDrawer from parent
 */

import { useEffect, useState, useCallback } from "react";
import { QRCodeCanvas }                     from "qrcode.react";
import { api }                              from "../services/authService";
import { parseCurrency }                    from "../utils/currency";

/* ─── Helpers ──────────────────────────────────────────────────────── */
const getSettings = () => api.get("/api/settings").then(r => r.data);

function INR(val) {
  const n = parseCurrency(val);
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
async function copyText(text, setCopied) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const el = Object.assign(document.createElement("textarea"), { value: text });
      document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  } catch { /* silent */ }
}

/* ─── Design tokens (fintech-clean, not warm preschool) ────────────── */
const T = {
  bg:           "#FFFFFF",
  bgSoft:       "#F8F9FA",
  bgDark:       "#111827",
  yellow:       "#F4C400",
  yellowLight:  "#FFFBEA",
  green:        "#16A34A",
  greenLight:   "#F0FDF4",
  greenDark:    "#15803D",
  greenBorder:  "#BBF7D0",
  wa:           "#25D366",    // WhatsApp brand green
  waDark:       "#128C7E",
  border:       "#E5E7EB",
  borderLight:  "#F3F4F6",
  text:         "#111827",
  textSoft:     "#6B7280",
  textMuted:    "#9CA3AF",
  red:          "#DC2626",
  redLight:     "#FEF2F2",
  amber:        "#D97706",
  amberLight:   "#FFFBEB",
};

/* ─── Copy button ────────────────────────────────────────────────────── */
function CopyBtn({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => copyText(value, setCopied)}
      style={{
        padding: "4px 10px", borderRadius: 6,
        fontSize: 10, fontWeight: 700, cursor: "pointer",
        border: `1px solid ${copied ? T.greenBorder : T.border}`,
        background: copied ? T.greenLight : T.bgSoft,
        color: copied ? T.greenDark : T.textSoft,
        letterSpacing: "0.06em", textTransform: "uppercase",
        transition: "all 0.18s", flexShrink: 0, whiteSpace: "nowrap",
      }}
    >{copied ? "✓ Copied" : label}</button>
  );
}

/* ─── Section divider ──────────────────────────────────────────────── */
function Divider({ label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      margin: "20px 0 14px",
    }}>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      {label && (
        <span style={{
          fontSize: 9, fontWeight: 800, color: T.textMuted,
          textTransform: "uppercase", letterSpacing: "0.12em",
          whiteSpace: "nowrap",
        }}>{label}</span>
      )}
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

/* ─── Status config ────────────────────────────────────────────────── */
const STATUS_COLOR = {
  Paid:      { bg: T.greenLight, fg: T.greenDark,  border: T.greenBorder },
  Pending:   { bg: T.amberLight, fg: T.amber,       border: "#FDE68A" },
  Partial:   { bg: "#EFF6FF",    fg: "#1E40AF",     border: "#BFDBFE" },
  Overdue:   { bg: T.redLight,   fg: T.red,         border: "#FECACA" },
  Cancelled: { bg: T.bgSoft,     fg: T.textSoft,    border: T.border },
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function PaymentDrawer({ open, invoice, payments = [], onClose, onRecord }) {
  const [school,   setSchool  ] = useState(null);
  const [loading,  setLoading ] = useState(false);
  const [bankOpen, setBankOpen] = useState(true);
  const [cashOpen, setCashOpen] = useState(false);

  /* ── Load school/payment settings ─────────────────────────────── */
  useEffect(() => {
    if (!open || school) return;
    setLoading(true);
    getSettings()
      .then(s => {
        const sc  = s?.school   || {};
        const br  = s?.branding || {};
        const pay = s?.payment  || {};
        setSchool({
          schoolName:      br.reportHeader  || sc.name        || "Yellow Dot Preschool",
          upiId:           pay.upiId         || "",
          bankName:        pay.bankName       || "",
          accountName:     pay.accountName    || "",
          accountNumber:   pay.accountNumber  || "",
          ifscCode:        pay.ifscCode       || "",
          branch:          pay.branch         || "",
          cashInstructions:pay.cashInstructions|| "Pay at the school front desk during office hours.",
          officeHours:     pay.officeHours    || "Mon – Sat: 8:00 AM – 6:00 PM",
          phone:           sc.phone           || "",
          email:           sc.email           || "",
        });
      })
      .catch(() => setSchool({}))
      .finally(() => setLoading(false));
  }, [open]);

  /* ── Close on Escape ───────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  /* ── Lock scroll ───────────────────────────────────────────────── */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !invoice) return null;

  /* ── Derived values ─────────────────────────────────────────────── */
  const balance    = parseCurrency(invoice.balance ?? invoice.totalAmount);
  const totalPaid  = parseCurrency(invoice.paidAmount ?? 0);
  const isPaid     = balance <= 0;
  const sc         = school || {};
  const st         = STATUS_COLOR[invoice.status] || STATUS_COLOR.Pending;

  /* UPI deep link for exact outstanding balance */
  const amountForQR = isPaid ? parseCurrency(invoice.totalAmount) : balance;
  const upiLink = sc.upiId
    ? `upi://pay?pa=${encodeURIComponent(sc.upiId)}&pn=${encodeURIComponent(sc.schoolName)}&am=${amountForQR}&cu=INR&tn=${encodeURIComponent(invoice.invoiceNumber)}`
    : "";

  /* WhatsApp message */
  const phone    = (invoice.fatherWhatsApp || invoice.motherWhatsApp || "").replace(/\D/g, "");
  const dialCode = phone.length >= 10 ? (phone.startsWith("91") ? phone : `91${phone}`) : "";
  const waLines  = [
    `*${sc.schoolName} – Fee Invoice*`,
    ``,
    `Dear Parent,`,
    `Your invoice *${invoice.invoiceNumber}* for *${invoice.studentName}* is ready.`,
    ``,
    `Amount  : *${INR(invoice.totalAmount)}*`,
    `Paid    : ${INR(invoice.paidAmount ?? 0)}`,
    `Balance : *${INR(balance)}*`,
    `Due Date: ${fmtDate(invoice.dueDate)}`,
    `Status  : ${invoice.status}`,
    ``,
    ...(sc.upiId && !isPaid ? [
      `📱 *Pay instantly via UPI:*`,
      `UPI ID: ${sc.upiId}`,
      `Amount: ${INR(balance)} (pre-filled)`,
      ``,
      upiLink,
      ``,
      `Open the link in GPay, PhonePe, Paytm or BHIM.`,
      ``,
    ] : []),
    `Thank you! 🌟`,
  ];
  const waUrl = dialCode
    ? `https://wa.me/${dialCode}?text=${encodeURIComponent(waLines.join("\n"))}`
    : null;

  /* ── UI ─────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)",
          zIndex: 300,
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(480px, 100vw)",
        background: T.bg,
        zIndex: 301,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 48px rgba(0,0,0,0.18)",
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: T.bg,
          borderBottom: `1px solid ${T.border}`,
          padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
              Payment Collection
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {invoice.invoiceNumber} · {invoice.studentName}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.bgSoft, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: T.textSoft, flexShrink: 0,
          }}>✕</button>
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div style={{ flex: 1, padding: "20px 20px 32px" }}>

          {/* Amount Hero */}
          <div style={{
            borderRadius: 16,
            background: isPaid
              ? `linear-gradient(135deg, #15803D 0%, #16A34A 100%)`
              : `linear-gradient(135deg, #111827 0%, #1F2937 100%)`,
            padding: "24px 24px 20px",
            marginBottom: 20,
            position: "relative", overflow: "hidden",
          }}>
            {/* Subtle glow */}
            <div style={{
              position: "absolute", top: -20, right: -20,
              width: 140, height: 140, borderRadius: "50%",
              background: isPaid ? "rgba(255,255,255,0.08)" : `rgba(244,196,0,0.12)`,
              pointerEvents: "none",
            }}/>

            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
              {isPaid ? "Total Amount" : "Balance Due"}
            </div>
            <div style={{
              fontSize: 36, fontWeight: 900, color: "#FFFFFF",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "-0.02em", lineHeight: 1,
              marginBottom: 10,
            }}>
              {isPaid ? INR(invoice.totalAmount) : INR(balance)}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Status pill */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: st.bg, color: st.fg, border: `1px solid ${st.border}`,
                padding: "3px 10px", borderRadius: 999,
                fontSize: 10, fontWeight: 800, letterSpacing: "0.07em",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: st.fg }} />
                {invoice.status}
              </span>
              {invoice.dueDate && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", fontWeight: 500 }}>
                  Due {fmtDate(invoice.dueDate)}
                </span>
              )}
            </div>

            {/* Paid breakdown */}
            {totalPaid > 0 && !isPaid && (
              <div style={{
                marginTop: 14, paddingTop: 14,
                borderTop: "1px solid rgba(255,255,255,0.12)",
                display: "flex", gap: 20,
              }}>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Total</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.70)", fontFamily: "'Courier New',monospace" }}>{INR(invoice.totalAmount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Paid</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#86EFAC", fontFamily: "'Courier New',monospace" }}>{INR(totalPaid)}</div>
                </div>
              </div>
            )}
          </div>

          {/* ── If paid: confirmation only ────────────────────────── */}
          {isPaid ? (
            <div style={{
              textAlign: "center", padding: "24px 16px",
              background: T.greenLight, borderRadius: 14,
              border: `1px solid ${T.greenBorder}`, marginBottom: 20,
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.greenDark, marginBottom: 4 }}>
                Payment Complete
              </div>
              <div style={{ fontSize: 12, color: T.green }}>
                This invoice has been paid in full. Thank you!
              </div>
            </div>
          ) : (
            <>
              {/* ── QR / UPI ─────────────────────────────────────── */}
              {loading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: T.textMuted, fontSize: 13 }}>
                  Loading payment details…
                </div>
              ) : sc.upiId ? (
                <>
                  <Divider label="Scan & Pay Instantly" />

                  {/* QR Code block */}
                  <div style={{
                    borderRadius: 16, border: `1px solid ${T.border}`,
                    padding: "24px 20px", textAlign: "center",
                    background: T.bg, marginBottom: 14,
                  }}>
                    {/* QR canvas */}
                    <div style={{
                      display: "inline-block",
                      padding: 12, background: "#FFFFFF",
                      borderRadius: 12, border: `1px solid ${T.border}`,
                      lineHeight: 0, marginBottom: 14,
                    }}>
                      <QRCodeCanvas
                        value={upiLink}
                        size={170}
                        bgColor="#FFFFFF"
                        fgColor="#111827"
                        level="M"
                        includeMargin={false}
                      />
                    </div>

                    {/* App badges */}
                    <div style={{
                      display: "flex", justifyContent: "center", gap: 8,
                      marginBottom: 12, flexWrap: "wrap",
                    }}>
                      {["GPay", "PhonePe", "Paytm", "BHIM"].map(app => (
                        <span key={app} style={{
                          padding: "4px 10px", borderRadius: 6,
                          background: T.bgSoft, border: `1px solid ${T.border}`,
                          fontSize: 10, fontWeight: 700, color: T.textSoft,
                        }}>{app}</span>
                      ))}
                    </div>

                    <div style={{ fontSize: 12, color: T.textSoft, lineHeight: 1.5 }}>
                      Scan with any UPI app
                      <br/>
                      <span style={{ fontWeight: 700, color: T.text }}>
                        {INR(amountForQR)} pre-filled automatically
                      </span>
                    </div>
                  </div>

                  {/* UPI ID row */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", borderRadius: 10,
                    background: T.bgSoft, border: `1px solid ${T.border}`,
                    marginBottom: 20, gap: 8,
                  }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 3 }}>UPI ID</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'Courier New', monospace" }}>{sc.upiId}</div>
                    </div>
                    <CopyBtn value={sc.upiId} label="Copy UPI"/>
                  </div>
                </>
              ) : (
                <div style={{
                  padding: "14px 16px", borderRadius: 10, marginBottom: 20,
                  background: T.amberLight, border: "1px solid #FDE68A",
                  fontSize: 12, color: T.amber,
                }}>
                  ⚙️  UPI not configured. Go to <strong>Settings → Payment Settings</strong> to add your UPI ID.
                </div>
              )}

              {/* ── WhatsApp CTA ──────────────────────────────────── */}
              {waUrl ? (
                <a
                  href={waUrl} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "16px 20px", borderRadius: 14,
                    background: T.wa, textDecoration: "none",
                    boxShadow: "0 4px 20px rgba(37,211,102,0.30)",
                    marginBottom: 20,
                  }}
                >
                  {/* WhatsApp icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "rgba(255,255,255,0.20)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, flexShrink: 0,
                  }}>💬</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.2 }}>
                      Send on WhatsApp
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                      Invoice details + UPI link sent to parent
                    </div>
                  </div>
                  <div style={{ fontSize: 16, color: "rgba(255,255,255,0.70)" }}>→</div>
                </a>
              ) : (
                <div style={{
                  padding: "12px 16px", borderRadius: 10, marginBottom: 20,
                  background: T.bgSoft, border: `1px solid ${T.border}`,
                  fontSize: 11, color: T.textMuted,
                }}>
                  📵  No WhatsApp number on record for this student.
                </div>
              )}

              {/* ── Bank Transfer ─────────────────────────────────── */}
              {(sc.bankName || sc.accountNumber) && (
                <>
                  <button
                    onClick={() => setBankOpen(o => !o)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px", borderRadius: 10,
                      background: T.bgSoft, border: `1px solid ${T.border}`,
                      cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.text,
                      marginBottom: bankOpen ? 0 : 14,
                    }}
                  >
                    <span>🏦  Bank Transfer</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{bankOpen ? "▲" : "▼"}</span>
                  </button>
                  {bankOpen && (
                    <div style={{
                      borderRadius: "0 0 10px 10px",
                      border: `1px solid ${T.border}`, borderTop: "none",
                      padding: "14px 16px", marginBottom: 14,
                      background: T.bg,
                    }}>
                      {[
                        { label: "Bank",         value: sc.bankName },
                        { label: "Account Name", value: sc.accountName },
                        { label: "Account No.",  value: sc.accountNumber, mono: true, copy: true },
                        { label: "IFSC Code",    value: sc.ifscCode,      mono: true, copy: true },
                        { label: "Branch",       value: sc.branch },
                      ].filter(r => r.value).map(r => (
                        <div key={r.label} style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", gap: 8,
                          padding: "8px 0",
                          borderBottom: `1px solid ${T.borderLight}`,
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0 }}>
                            {r.label}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 600, color: T.text, textAlign: "right",
                              fontFamily: r.mono ? "'Courier New',monospace" : "inherit",
                            }}>{r.value}</span>
                            {r.copy && <CopyBtn value={r.value}/>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Cash / Cheque ─────────────────────────────────── */}
              <button
                onClick={() => setCashOpen(o => !o)}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 10,
                  background: T.bgSoft, border: `1px solid ${T.border}`,
                  cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.text,
                  marginBottom: cashOpen ? 0 : 20,
                }}
              >
                <span>💵  Cash / Cheque</span>
                <span style={{ fontSize: 11, color: T.textMuted }}>{cashOpen ? "▲" : "▼"}</span>
              </button>
              {cashOpen && (
                <div style={{
                  borderRadius: "0 0 10px 10px",
                  border: `1px solid ${T.border}`, borderTop: "none",
                  padding: "14px 16px", marginBottom: 20,
                  background: T.bg, fontSize: 12, color: T.textSoft, lineHeight: 1.7,
                }}>
                  {sc.cashInstructions}
                  {sc.officeHours && <><br/><strong style={{ color: T.text }}>{sc.officeHours}</strong></>}
                  {sc.accountName  && <><br/>Cheques payable to: <strong style={{ color: T.text }}>{sc.accountName}</strong></>}
                </div>
              )}
            </>
          )}

          {/* ── Payment History ──────────────────────────────────── */}
          {payments.length > 0 && (
            <>
              <Divider label="Payment History" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {payments.slice(0, 5).map((p, i) => (
                  <div key={p.paymentId || i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", borderRadius: 10,
                    background: T.greenLight, border: `1px solid ${T.greenBorder}`,
                    gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.greenDark }}>
                        {INR(p.amount)}
                      </div>
                      <div style={{ fontSize: 10, color: T.green, marginTop: 1 }}>
                        {p.paymentDate} · {p.paymentMode || "Cash"}
                        {p.transactionId && ` · #${p.transactionId}`}
                      </div>
                    </div>
                    <span style={{
                      padding: "2px 8px", borderRadius: 5, fontSize: 10,
                      fontWeight: 700, background: T.greenBorder, color: T.greenDark,
                    }}>✓ Recorded</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Record Payment CTA ───────────────────────────────── */}
          {!isPaid && onRecord && (
            <button
              onClick={() => { onClose(); onRecord(invoice); }}
              style={{
                width: "100%", padding: "15px 20px",
                borderRadius: 12, border: "none",
                background: `linear-gradient(135deg, #F4C400, #FFE033)`,
                color: "#111827", fontSize: 14, fontWeight: 800,
                cursor: "pointer", letterSpacing: "0.01em",
                boxShadow: "0 4px 20px rgba(244,196,0,0.35)",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8,
              }}
            >
              <span>+</span>
              <span>Record Payment</span>
            </button>
          )}

        </div>
      </div>
    </>
  );
}
