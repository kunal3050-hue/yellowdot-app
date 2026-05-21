/**
 * ReceiptView.jsx — Premium Payment Receipt
 * ─────────────────────────────────────────────────────────────────────
 * Route: /receipt/:receiptId
 * Standalone page — no MainLayout.
 *
 * Visual identity: completely distinct from Invoice.
 *   Invoice  = warm cream + gold  = "please pay"
 *   Receipt  = pure white + sage  = "payment confirmed, thank you"
 *
 * Design target: Apple Pay · Stripe · Luxury hotel confirmation.
 * Optimised for: A4 PDF · WhatsApp screenshot · mobile view.
 *
 * DO NOT add colored heavy bars or dashboard widgets.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate }                    from "react-router-dom";
import { api }                                       from "../services/authService";
import { parseCurrency }                             from "../utils/currency";
import jsPDF                                         from "jspdf";
import html2canvas                                   from "html2canvas";

const get = url => api.get(url).then(r => r.data);

/* ═══════════════════════════════════════════════════════════════════
   RECEIPT PALETTE  — warm ivory base, olive-gold accent
   Yellow Dot brand palette — warm, premium, no cool grays or greens
   ═══════════════════════════════════════════════════════════════════ */
const R = {
  /* Document surfaces — warm ivory */
  docBg:        "#FFFDF6",
  pageBg:       "#F5F0E2",
  sectionBg:    "#FAF6EA",
  footerBg:     "#FFFBEE",
  innerCard:    "#FFFDF6",

  /* Warm olive-gold ─ success / "paid" accent (replaces sage green) */
  sage:         "#8b7a28",
  sageDark:     "#6a5c18",
  sageDeep:     "#4a4014",
  sageLight:    "#f8f4d8",
  sagePale:     "#faf7e0",
  sageBorder:   "#d4bc58",
  sageBorderSoft:"rgba(176,152,48,0.14)",
  sageMid:      "#b09830",
  sageFaint:    "rgba(176,152,48,0.06)",
  sageShadow:   "rgba(176,152,48,0.10)",
  sageGlow:     "rgba(176,152,48,0.18)",

  /* Amber ─ partial payments */
  amber:        "#B45309",
  amberDark:    "#92400E",
  amberLight:   "#FFFBEB",
  amberPale:    "#FFFEF7",
  amberBorder:  "#FCD34D",
  amberBorderSoft:"rgba(180,83,9,0.15)",
  amberFaint:   "rgba(180,83,9,0.06)",
  amberShadow:  "rgba(180,83,9,0.10)",

  /* Brand gold */
  gold:         "#F4C400",
  goldDark:     "#C9A000",
  goldBorder:   "#DEC840",

  /* Ink hierarchy — warm charcoal, not cool blue-gray */
  ink:          "#1f1a17",
  inkSoft:      "#2a221d",
  inkMid:       "#4a3f2a",
  inkMuted:     "#8b7d65",
  inkFaint:     "#a3957e",
  inkGhost:     "#d4c8a8",

  /* Borders — warm */
  border:       "#ECE7D8",
  borderLight:  "#F5F0E2",
  borderFaint:  "rgba(139,125,101,0.08)",
};

/* ── Print + hover CSS ── */
const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900&display=swap');
  @media print {
    * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    body { margin:0!important; background:#FFFFFF!important; }
    .yd-no-print { display:none!important; }
    .rcpt-page   { padding:0!important; background:transparent!important; }
    .rcpt-doc    { border-radius:0!important; box-shadow:none!important; max-width:100%!important; }
    @page { size:A4 portrait; margin:0mm; }
  }
  .rcpt-btn { transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease; }
  .rcpt-btn:hover { opacity:0.88; transform:translateY(-1px); }
  .rcpt-wa-btn:hover  { filter:brightness(1.06); transform:translateY(-1px); }
  .rcpt-link-btn:hover { background:#f8f4d8!important; }
`;

/* ── Helpers ── */
function INR(v) {
  const n = parseCurrency(v);
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits:0, maximumFractionDigits:2 });
}
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}
function fmtDateTime(s) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
    + " · "
    + d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true });
}
function initials(name = "") {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "YD";
}
async function copyText(text, set) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const el = Object.assign(document.createElement("textarea"), { value: text });
      document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    set(true); setTimeout(() => set(false), 2200);
  } catch {}
}

/** Fallback receipt number when backend doesn't return one yet. Format: RCPT-YYYYMM-NNNN */
function displayReceiptNumber(receipt) {
  if (receipt?.receiptNumber) return receipt.receiptNumber;
  const d   = new Date(receipt?.paymentDate || receipt?.createdAt || Date.now());
  const ym  = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const raw = String(receipt?.paymentId || receipt?.id || Date.now());
  const seq = raw.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `RCPT-${ym}-${seq}`;
}

/* ── Payment mode colour chips — warm Yellow Dot palette only ── */
const MODE_C = {
  "UPI":           { bg:"#faf7e0", fg:"#6a5c18", bd:"#d4bc58" },
  "Bank Transfer": { bg:"#f8f4d8", fg:"#5a4d18", bd:"#d4bc58" },
  "Cash":          { bg:"#FEF3C7", fg:"#92400E", bd:"#FDE68A" },
  "Card":          { bg:"#faf1d6", fg:"#8b6820", bd:"#dcc060" },
  "Cheque":        { bg:"#FFF7ED", fg:"#9A3412", bd:"#FDBA74" },
  "Online":        { bg:"#f8f4d8", fg:"#6a5c18", bd:"#d4bc58" },
};
const modeC = m => MODE_C[m] || { bg:R.sagePale, fg:R.sageDeep, bd:R.sageBorder };

/* ─── Document primitives ─────────────────────────────────────────── */
function SectionLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 7, fontWeight: 700, color: R.inkFaint,
      textTransform: "uppercase", letterSpacing: "0.18em",
      marginBottom: 10, ...style,
    }}>{children}</div>
  );
}
function Field({ label, value, mono, bold, accent, style = {} }) {
  return (
    <div style={{ marginBottom: 9, ...style }}>
      <div style={{
        fontSize: 7, fontWeight: 600, color: R.inkFaint,
        textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontSize: bold ? 12.5 : 11.5,
        fontWeight: bold ? 700 : 600,
        color: accent ? R.sageDeep : R.inkSoft,
        fontFamily: mono ? "'Courier New', monospace" : "inherit",
        lineHeight: 1.4, letterSpacing: mono ? "0.01em" : "inherit",
      }}>{value || "—"}</div>
    </div>
  );
}
function ThinLine({ color = R.border, style = {} }) {
  return <div style={{ height: 1, background: color, ...style }} />;
}

/* ═══════════════════════════════════════════════════════════════════
   RECEIPT DOCUMENT  — captured by html2canvas for PDF
   ═══════════════════════════════════════════════════════════════════ */
function ReceiptDocument({ receipt, invoice, student, school, priorPayments }) {
  const logoSrc  = school.faviconUrl || school.logoUrl || "/favicon.ico";
  const [logoErr, setLogoErr] = useState(false);
  const showLogo = !!logoSrc && !logoErr;
  const inits    = initials(school.schoolName || "YD");
  const rcptNum  = displayReceiptNumber(receipt);

  const total       = parseCurrency(invoice.totalAmount || receipt.amount);
  const thisPay     = parseCurrency(receipt.amount);
  const prior       = priorPayments.reduce((s, p) => s + parseCurrency(p.amount), 0);
  const allPaid     = prior + thisPay;
  const remaining   = Math.max(0, total - allPaid);
  const isFullPaid  = remaining <= 0;

  const mc = modeC(receipt.paymentMode);

  /* Status chip colours */
  const statusBg     = isFullPaid ? R.sageFaint    : R.amberFaint;
  const statusBorder = isFullPaid ? R.sageBorderSoft: R.amberBorderSoft;
  const statusDot    = isFullPaid ? R.sage          : R.amber;
  const statusFg     = isFullPaid ? R.sageDeep      : R.amber;
  const statusLabel  = isFullPaid ? "Payment Received" : "Partial Payment";
  const amtColor     = isFullPaid ? R.sageDeep      : R.amber;

  /* Hero card colours — warm ivory tones */
  const heroBg      = isFullPaid
    ? "linear-gradient(145deg, rgba(248,244,216,0.80) 0%, rgba(255,253,246,0.95) 100%)"
    : "linear-gradient(145deg, rgba(255,251,235,0.80) 0%, rgba(255,253,246,0.95) 100%)";
  const heroBorder  = isFullPaid ? "rgba(176,152,48,0.18)"  : "rgba(180,83,9,0.14)";
  const heroTopLine = isFullPaid ? R.sage                    : R.amber;
  const heroShadow  = isFullPaid
    ? "0 2px 20px rgba(176,152,48,0.10), 0 1px 3px rgba(31,26,23,0.04)"
    : "0 2px 20px rgba(180,83,9,0.09), 0 1px 3px rgba(31,26,23,0.04)";

  /* Icon for the check circle */
  const iconBg = isFullPaid
    ? `linear-gradient(145deg, ${R.sage}, ${R.sageMid})`
    : `linear-gradient(145deg, ${R.amberDark}, ${R.amber})`;

  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      background: R.docBg,
    }}>

      {/* ── Sage rule — 3px, fade at edges ── */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${R.sageDark} 0%, ${R.sage} 30%, ${R.sageMid} 50%, ${R.sage} 70%, ${R.sageDark} 100%)`,
      }} />

      {/* ════════════════════════════════════
          HEADER — Yellow Dot brand gradient
          ════════════════════════════════════ */}
      <div style={{
        padding:"22px 40px 18px",
        background:[
          "radial-gradient(circle at top right, rgba(255,255,255,0.55) 0%, transparent 35%)",
          "linear-gradient(155deg, #fff4c2 0%, #ffe78a 45%, #ffd43b 100%)",
        ].join(","),
        position:"relative",
        boxShadow:"inset 0 -2px 0 rgba(180,140,0,0.18), 0 2px 12px rgba(180,140,0,0.08)",
      }}>
        {/* Top-left soft highlight */}
        <div style={{
          position:"absolute",top:0,left:0,right:0,height:1,pointerEvents:"none",
          background:"linear-gradient(90deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.30) 60%, transparent 100%)",
        }}/>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:20,position:"relative" }}>

          {/* School identity */}
          <div style={{ display:"flex",gap:13,alignItems:"flex-start" }}>
            <div style={{
              width:56,height:56,borderRadius:14,flexShrink:0,position:"relative",
              border:"1.5px solid rgba(180,140,0,0.25)",
              background: showLogo
                ? "linear-gradient(145deg,#fffef5,#fff8d0)"
                : `linear-gradient(145deg,${R.gold},${R.goldDark})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              overflow:"hidden",
              boxShadow:"0 2px 12px rgba(180,140,0,0.18), 0 1px 3px rgba(0,0,0,0.06)",
            }}>
              {showLogo
                ? <div style={{ position:"absolute",inset:6,display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <img src={logoSrc} alt="" onError={() => setLogoErr(true)}
                      style={{ maxWidth:"100%",maxHeight:"100%",objectFit:"contain",display:"block" }} />
                  </div>
                : <span style={{ fontSize:16,fontWeight:900,color:"#3D2E00",userSelect:"none" }}>{inits}</span>
              }
            </div>

            <div>
              <div style={{ fontSize:17,fontWeight:800,color:"#1C1410",letterSpacing:"-0.025em",lineHeight:1.1 }}>
                {school.schoolName}
              </div>
              {/* Gold accent bar */}
              <div style={{
                height:2,marginTop:4,marginBottom:4,width:52,borderRadius:2,
                background:"linear-gradient(90deg,#C9A000,#DEC840,transparent)",
              }}/>
              {school.branchName && (
                <div style={{ fontSize:7.5,fontWeight:700,color:"#b8860b",textTransform:"uppercase",letterSpacing:"0.13em" }}>
                  {school.branchName}
                </div>
              )}
              <div style={{ fontSize:8,color:"#7A6A50",marginTop:4,lineHeight:1.75 }}>
                {school.address && <div>{school.address}</div>}
                <div>{[school.phone,school.email].filter(Boolean).join("  ·  ")}</div>
                {school.gstNumber && (
                  <div style={{ fontWeight:600,color:"#5A4E30" }}>GSTIN: {school.gstNumber}</div>
                )}
              </div>
            </div>
          </div>

          {/* Receipt identity */}
          <div style={{ textAlign:"right",flexShrink:0 }}>
            {/* Dynamic paid / partial badge — gold gradient */}
            <div style={{
              display:"inline-flex",alignItems:"center",gap:5,marginBottom:7,
              padding:"4px 13px",borderRadius:6,
              background: isFullPaid
                ? "linear-gradient(135deg,#fff6cc 0%,#ffe066 100%)"
                : "rgba(180,83,9,0.08)",
              border:`1.5px solid ${isFullPaid ? "rgba(180,140,0,0.35)" : "#FDE68A"}`,
              boxShadow: isFullPaid ? "0 1px 4px rgba(180,140,0,0.18)" : "none",
            }}>
              <span style={{
                fontSize:6.5,fontWeight:800,letterSpacing:"0.22em",textTransform:"uppercase",
                color: isFullPaid ? "#7A5C00" : R.amber,
              }}>{isFullPaid ? "✦  PAID RECEIPT" : "◑  PARTIAL PAYMENT"}</span>
            </div>

            <div style={{
              display:"block",
              fontSize:22,fontWeight:800,color:"#1C1410",
              fontFamily:"'Courier New',monospace",
              letterSpacing:"0.04em",lineHeight:1,marginBottom:6,
            }}>{rcptNum}</div>

            <div style={{ fontSize:8,lineHeight:1.85 }}>
              <div style={{ fontWeight:600,color:"#5A4E30" }}>
                {fmtDateTime(receipt.createdAt || receipt.paymentDate)}
              </div>
              <div style={{ color:"#7A6A50" }}>
                Invoice: <span style={{ fontFamily:"'Courier New',monospace",color:"#5A4E30" }}>{invoice.invoiceNumber}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Golden divider — whisper-thin */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(180,140,0,0.20) 20%,rgba(180,140,0,0.20) 80%,transparent)" }} />

      {/* ════════════════════════════════════
          SUCCESS HERO — glass card + amount
          ════════════════════════════════════ */}
      <div style={{ padding:"10px 40px" }}>
        <div style={{
          position:"relative",
          borderRadius:14,
          background:heroBg,
          border:`1px solid ${heroBorder}`,
          boxShadow:heroShadow,
          overflow:"hidden",
          padding:"14px 20px",
        }}>
          {/* Thin top accent line */}
          <div style={{
            position:"absolute",top:0,left:0,right:0,height:1.5,
            background:`linear-gradient(90deg,transparent,${heroTopLine} 25%,${heroTopLine} 75%,transparent)`,
            opacity:0.5,
          }}/>
          {/* Faint radial glow */}
          <div style={{
            position:"absolute",bottom:-40,right:-40,
            width:150,height:150,borderRadius:"50%",
            background: isFullPaid ? R.sageFaint : R.amberFaint,
            pointerEvents:"none",
          }}/>

          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:20,flexWrap:"wrap" }}>

            {/* Left: icon + label */}
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              {/* Circle check icon */}
              <div style={{
                width:42,height:42,borderRadius:"50%",flexShrink:0,
                background:iconBg,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:17,color:"#FFFFFF",fontWeight:900,
                boxShadow: isFullPaid
                  ? "0 3px 12px rgba(22,163,74,0.28), 0 0 0 3px rgba(22,163,74,0.10)"
                  : "0 3px 12px rgba(180,83,9,0.22), 0 0 0 3px rgba(180,83,9,0.08)",
              }}>{isFullPaid ? "✓" : "◑"}</div>

              <div>
                <div style={{
                  fontSize:13,fontWeight:800,
                  color:amtColor,
                  lineHeight:1.15,letterSpacing:"-0.01em",
                }}>
                  {isFullPaid ? "Payment Received Successfully" : "Partial Payment Recorded"}
                </div>
                <div style={{ fontSize:9,color:isFullPaid?R.sage:R.amber,marginTop:2,opacity:0.75 }}>
                  {isFullPaid
                    ? "This invoice has been completely settled."
                    : `Balance of ${INR(remaining)} remains outstanding.`}
                </div>
              </div>
            </div>

            {/* Right: amount + chips */}
            <div style={{ textAlign:"right" }}>
              <div style={{
                fontSize:7,fontWeight:700,color:amtColor,opacity:0.6,
                textTransform:"uppercase",letterSpacing:"0.13em",marginBottom:2,
              }}>Amount Paid</div>
              <div style={{
                fontSize:36,fontWeight:800,color:amtColor,
                fontFamily:"'Courier New',monospace",
                letterSpacing:"-0.02em",lineHeight:1,
              }}>{INR(thisPay)}</div>
              <div style={{ marginTop:7,display:"flex",gap:5,justifyContent:"flex-end",flexWrap:"wrap" }}>
                <span style={{
                  display:"inline-flex",alignItems:"center",gap:4,
                  background:mc.bg,border:`1px solid ${mc.bd}`,
                  padding:"2.5px 9px",borderRadius:4,
                  fontSize:9,fontWeight:700,color:mc.fg,
                }}>{receipt.paymentMode || "Cash"}</span>
                {receipt.transactionId && (
                  <span style={{
                    display:"inline-flex",alignItems:"center",
                    background:"rgba(0,0,0,0.03)",border:`1px solid ${R.border}`,
                    padding:"2.5px 9px",borderRadius:4,
                    fontSize:8.5,fontWeight:600,color:R.inkMuted,
                    fontFamily:"'Courier New',monospace",
                  }}>UTR: {receipt.transactionId}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ThinLine style={{ margin:"0 40px" }} />

      {/* ════════════════════════════════════
          STUDENT + PARENT — premium cards
          ════════════════════════════════════ */}
      <div style={{
        display:"grid",gridTemplateColumns:"1fr 1fr",
        borderTop:`1px solid ${R.border}`,borderBottom:`1px solid ${R.border}`,
        background:R.sectionBg,
      }}>
        {/* Student */}
        <div style={{ padding:"12px 40px 12px",borderRight:`1px solid ${R.border}` }}>
          <SectionLabel>Student</SectionLabel>

          {/* Premium avatar + name card */}
          <div style={{
            display:"flex",alignItems:"center",gap:10,
            padding:"9px 12px",borderRadius:10,marginBottom:10,
            background:R.innerCard,
            border:`1px solid rgba(0,0,0,0.04)`,
            boxShadow:"0 1px 4px rgba(0,0,0,0.03)",
          }}>
            <div style={{
              width:34,height:34,borderRadius:"50%",flexShrink:0,
              background:`linear-gradient(145deg,${R.sage},${R.sageMid})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:12,fontWeight:800,color:"#FFFFFF",
              boxShadow:"0 0 0 3px rgba(22,163,74,0.15), 0 2px 8px rgba(22,163,74,0.22)",
            }}>{initials(receipt.studentName || invoice.studentName)}</div>
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:R.ink,lineHeight:1.1 }}>
                {receipt.studentName || invoice.studentName || "—"}
              </div>
              <div style={{ fontSize:8.5,color:R.inkMuted,marginTop:2 }}>
                {invoice.class || receipt.class || "—"}
              </div>
            </div>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px" }}>
            <Field label="Student ID"    value={receipt.studentId || invoice.studentId} />
            <Field label="Academic Year" value={
              invoice.invoiceDate
                ? `${new Date(invoice.invoiceDate).getFullYear()}–${String(new Date(invoice.invoiceDate).getFullYear() + 1).slice(2)}`
                : "—"
            } />
          </div>
        </div>

        {/* Parent */}
        <div style={{ padding:"12px 40px 12px" }}>
          <SectionLabel>Parent / Guardian</SectionLabel>

          <div style={{
            padding:"9px 12px",borderRadius:10,
            background:R.innerCard,
            border:`1px solid rgba(0,0,0,0.04)`,
            boxShadow:"0 1px 4px rgba(0,0,0,0.03)",
          }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px" }}>
              {(student?.father_name || student?.fatherName) && (
                <Field label="Father" value={student?.father_name || student?.fatherName} />
              )}
              {(student?.father_whatsapp || invoice.fatherWhatsApp) && (
                <Field label="Father Mobile" value={student?.father_whatsapp || invoice.fatherWhatsApp} />
              )}
              {(student?.mother_name || student?.motherName) && (
                <Field label="Mother" value={student?.mother_name || student?.motherName} />
              )}
              {(student?.mother_whatsapp || invoice.motherWhatsApp) && (
                <Field label="Mother Mobile" value={student?.mother_whatsapp || invoice.motherWhatsApp} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════
          PAYMENT DETAILS — soft card, 3-col
          ════════════════════════════════════ */}
      <div style={{ padding:"10px 40px 10px",borderBottom:`1px solid ${R.border}` }}>
        <SectionLabel>Payment Details</SectionLabel>
        <div style={{
          background:"#F8FAFC",borderRadius:10,
          border:`1px solid ${R.borderLight}`,
          padding:"12px 16px",
        }}>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px 20px" }}>
            <Field label="Receipt Number"    value={rcptNum}                  mono bold accent />
            <Field label="Invoice Number"    value={invoice.invoiceNumber}    mono />
            <Field label="Payment Date"      value={fmtDate(receipt.paymentDate)} />
            <Field label="Amount Paid"       value={INR(thisPay)}             bold />
            <Field label="Payment Mode"      value={receipt.paymentMode || "Cash"} />
            {receipt.transactionId && (
              <Field label="Transaction / UTR" value={receipt.transactionId} mono />
            )}
            {receipt.bankName  && <Field label="Bank"         value={receipt.bankName} />}
            {receipt.staffName && <Field label="Collected By" value={receipt.staffName} />}
            {receipt.notes     && <Field label="Notes"        value={receipt.notes} style={{ gridColumn:"1/-1" }} />}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════
          INVOICE SUMMARY — compact premium
          ════════════════════════════════════ */}
      <div style={{ padding:"10px 40px 10px",borderBottom:`1px solid ${R.border}`,background:R.sectionBg }}>
        <SectionLabel>Invoice Summary</SectionLabel>
        <div style={{ display:"flex",justifyContent:"flex-end" }}>
          <div style={{
            width:280,
            background:R.innerCard,
            border:`1px solid ${isFullPaid ? R.sageBorderSoft : R.borderFaint}`,
            borderRadius:10,overflow:"hidden",
            boxShadow:isFullPaid
              ? "0 1px 8px rgba(22,163,74,0.08)"
              : "0 1px 6px rgba(0,0,0,0.04)",
          }}>
            {/* Fully Settled badge header */}
            {isFullPaid && (
              <div style={{
                background:R.sageFaint,
                borderBottom:`1px solid ${R.sageBorderSoft}`,
                padding:"5px 14px",
                display:"flex",alignItems:"center",gap:6,
              }}>
                <span style={{ fontSize:9.5,fontWeight:800,color:R.sageDeep,letterSpacing:"0.01em" }}>
                  ✓ Fully Settled
                </span>
                <span style={{ fontSize:8,color:R.sage,opacity:0.7 }}>· No balance due</span>
              </div>
            )}
            {[
              { label:"Invoice Total",     value:INR(total),          muted:true  },
              prior > 0 && { label:"Previously Paid", value:`− ${INR(prior)}`,   muted:true },
              { label:"This Payment",      value:`− ${INR(thisPay)}`, sage:true,  bold:true  },
              { sep:true },
              {
                label:remaining <= 0 ? "Balance" : "Remaining Balance",
                value:remaining <= 0 ? "₹ 0" : INR(remaining),
                bold:true,
                sage:remaining <= 0,
                amber:remaining > 0,
              },
            ].filter(Boolean).map((row, i, arr) =>
              row.sep
                ? <ThinLine key="sep" />
                : (
                  <div key={i} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"baseline",
                    padding:"6px 14px",
                    borderBottom: i < arr.length - 1 && !arr[i + 1]?.sep
                      ? `1px solid ${R.borderLight}` : "none",
                  }}>
                    <span style={{
                      fontSize:10,
                      color:row.sage ? R.sageDeep : row.amber ? R.amber : row.muted ? R.inkFaint : R.inkMuted,
                      fontWeight:row.bold ? 700 : 400,
                    }}>{row.label}</span>
                    <span style={{
                      fontSize:row.bold ? 13 : 11,
                      fontWeight:row.bold ? 800 : 500,
                      color:row.sage ? R.sageDeep : row.amber ? R.amber : R.inkSoft,
                      fontFamily:"'Courier New',monospace",
                      letterSpacing:"-0.01em",
                    }}>{row.value}</span>
                  </div>
                )
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════
          PRIOR PAYMENTS (if any)
          ════════════════════════════════════ */}
      {priorPayments.length > 0 && (
        <div style={{ padding:"10px 40px",borderBottom:`1px solid ${R.border}` }}>
          <SectionLabel>Prior Payments on This Invoice</SectionLabel>
          <div style={{
            border:`1px solid ${R.border}`,borderRadius:10,overflow:"hidden",
            boxShadow:"0 1px 4px rgba(0,0,0,0.03)",
          }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:R.sectionBg }}>
                  {["Date", "Mode", "UTR / Ref", "Amount"].map((h, i) => (
                    <th key={h} style={{
                      padding:"6px 12px",textAlign:i === 3 ? "right" : "left",
                      fontSize:7,fontWeight:700,color:R.inkFaint,
                      textTransform:"uppercase",letterSpacing:"0.12em",
                      borderBottom:`1px solid ${R.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priorPayments.map((p, i) => {
                  const mc2 = modeC(p.paymentMode);
                  return (
                    <tr key={p.paymentId || i} style={{ background:i % 2 === 0 ? R.docBg : R.sectionBg }}>
                      <td style={{ padding:"6px 12px",color:R.inkMid,fontSize:10 }}>
                        {fmtDate(p.paymentDate || p.createdAt)}
                      </td>
                      <td style={{ padding:"6px 12px" }}>
                        <span style={{
                          padding:"2px 8px",borderRadius:4,
                          background:mc2.bg,color:mc2.fg,
                          fontSize:8.5,fontWeight:700,border:`1px solid ${mc2.bd}`,
                        }}>{p.paymentMode || "Cash"}</span>
                      </td>
                      <td style={{
                        padding:"6px 12px",color:R.inkFaint,
                        fontFamily:"'Courier New',monospace",fontSize:9,
                      }}>{p.transactionId || "—"}</td>
                      <td style={{
                        padding:"6px 12px",fontWeight:700,color:R.sage,
                        textAlign:"right",fontFamily:"'Courier New',monospace",fontSize:10.5,
                      }}>{INR(p.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          SIGNATURES + OFFICIAL SEAL
          ════════════════════════════════════ */}
      <div style={{
        padding:"12px 40px 10px",
        background:R.sectionBg,
        borderTop:`1px solid ${R.border}`,
      }}>
        <div style={{
          display:"grid",gridTemplateColumns:"1fr 80px 1fr",
          alignItems:"flex-end",gap:16,
        }}>
          {/* Signatory */}
          <div style={{ textAlign:"center" }}>
            <div style={{ height:22,borderBottom:`1px solid ${R.inkGhost}`,marginBottom:5 }} />
            <div style={{ fontSize:7,fontWeight:700,color:R.inkFaint,textTransform:"uppercase",letterSpacing:"0.14em" }}>
              Authorised Signatory
            </div>
            <div style={{ fontSize:9,fontWeight:600,color:R.inkMid,marginTop:2 }}>{school.schoolName}</div>
          </div>

          {/* Seal */}
          <div style={{ textAlign:"center" }}>
            <div style={{
              width:52,height:52,borderRadius:"50%",margin:"0 auto",
              border:`1.5px dashed ${R.sageBorder}`,
              background:`radial-gradient(circle at 40% 35%,${R.sagePale},${R.docBg} 70%)`,
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              boxShadow:`0 0 0 3px ${R.sageFaint}`,
              gap:2,
            }}>
              <div style={{
                fontSize:7.5,fontWeight:800,color:R.sage,
                textTransform:"uppercase",letterSpacing:"0.16em",
              }}>SEAL</div>
              <div style={{ width:20,height:0.75,background:R.sageBorder }} />
              <div style={{ fontSize:5.5,color:R.inkFaint,textTransform:"uppercase",letterSpacing:"0.12em" }}>
                OFFICIAL
              </div>
            </div>
            <div style={{
              fontSize:6.5,color:R.inkFaint,marginTop:3,
              textTransform:"uppercase",letterSpacing:"0.10em",fontWeight:600,
            }}>School Seal</div>
          </div>

          {/* Parent */}
          <div style={{ textAlign:"center" }}>
            <div style={{ height:22,borderBottom:`1px solid ${R.inkGhost}`,marginBottom:5 }} />
            <div style={{ fontSize:7,fontWeight:700,color:R.inkFaint,textTransform:"uppercase",letterSpacing:"0.14em" }}>
              Parent / Guardian
            </div>
            <div style={{ fontSize:9,fontWeight:600,color:R.inkMid,marginTop:2 }}>
              Received &amp; Acknowledged
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════
          FOOTER — Yellow Dot brand gradient
          ════════════════════════════════════ */}
      <div style={{
        padding:"18px 40px 22px",
        background:[
          "radial-gradient(circle at bottom left, rgba(255,255,255,0.28) 0%, transparent 40%)",
          "linear-gradient(145deg, #ffe680 0%, #ffd43b 55%, #ffc800 100%)",
        ].join(","),
        borderTop:"2px solid rgba(180,140,0,0.22)",
        boxShadow:"inset 0 2px 0 rgba(255,255,255,0.40), 0 -1px 0 rgba(180,140,0,0.10)",
        position:"relative",
      }}>
        {/* Soft inner top shimmer */}
        <div style={{
          position:"absolute",top:0,left:0,right:0,height:2,pointerEvents:"none",
          background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.50) 40%, rgba(255,255,255,0.50) 60%, transparent)",
        }}/>

        <div style={{ textAlign:"center",position:"relative" }}>

          {/* Thank-you headline */}
          <div style={{
            fontSize:11,fontWeight:700,color:"#2b2b2b",
            letterSpacing:"0.005em",lineHeight:1.4,
            display:"flex",alignItems:"center",justifyContent:"center",gap:5,
          }}>
            <span>Thank you for choosing</span>
            <span style={{ fontWeight:800,color:"#1a1400" }}>{school.schoolName}</span>
            <span style={{ fontSize:13 }}>✨</span>
          </div>

          {/* Warm dot-separator row */}
          <div style={{
            display:"flex",alignItems:"center",justifyContent:"center",
            gap:6,marginTop:8,marginBottom:8,
          }}>
            <div style={{ height:1,width:44,background:"linear-gradient(90deg,transparent,rgba(100,70,0,0.25))" }}/>
            <div style={{ width:3.5,height:3.5,borderRadius:"50%",background:"rgba(80,55,0,0.40)" }}/>
            <div style={{ width:3.5,height:3.5,borderRadius:"50%",background:"rgba(80,55,0,0.20)" }}/>
            <div style={{ width:3.5,height:3.5,borderRadius:"50%",background:"rgba(80,55,0,0.40)" }}/>
            <div style={{ height:1,width:44,background:"linear-gradient(270deg,transparent,rgba(100,70,0,0.25))" }}/>
          </div>

          {/* Support contact */}
          {(school.phone || school.email) && (
            <div style={{ fontSize:8,lineHeight:2,marginBottom:5 }}>
              <span style={{ fontWeight:600,color:"#3d3000",marginRight:5 }}>For support:</span>
              {school.phone && <span style={{ color:"#4a3c00" }}>{school.phone}</span>}
              {school.phone && school.email && (
                <span style={{ margin:"0 8px",color:"rgba(60,45,0,0.30)" }}>·</span>
              )}
              {school.email && <span style={{ color:"#4a3c00" }}>{school.email}</span>}
            </div>
          )}

          {/* Receipt number — dark-on-gold subtle */}
          <div style={{
            fontSize:6.5,letterSpacing:"0.08em",
            color:"rgba(40,28,0,0.40)",
            fontFamily:"'Courier New',monospace",
          }}>
            digitally generated payment receipt · {rcptNum}
          </div>

        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SHARE PANEL  — web-only (yd-no-print)
   ═══════════════════════════════════════════════════════════════════ */
function SharePanel({ receipt, invoice, student, school, remaining }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const shareUrl  = typeof window !== "undefined" ? window.location.href : "";
  const rcptNum   = displayReceiptNumber(receipt);
  const paid      = parseCurrency(receipt.amount);

  /* Premium WhatsApp message */
  const parentName  = student?.father_name || student?.fatherName
    || student?.mother_name || student?.motherName || "Parent";
  const firstName   = parentName.split(" ")[0];
  const studentName = receipt.studentName || invoice.studentName || "—";

  const phone    = (invoice.fatherWhatsApp || invoice.motherWhatsApp || "").replace(/\D/g, "");
  const dialCode = phone.length >= 10 ? (phone.startsWith("91") ? phone : `91${phone}`) : "";

  const waLines = [
    `*${school.schoolName}*`,
    ``,
    `Dear ${firstName},`,
    ``,
    `We've received your payment. Here are the details:`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 Receipt: *${rcptNum}*`,
    `👤 Student: *${studentName}*`,
    `💰 Amount: *${INR(paid)}*`,
    `💳 Mode: *${receipt.paymentMode || "Cash"}*`,
    receipt.transactionId ? `🔢 UTR: ${receipt.transactionId}` : null,
    `📅 Date: ${fmtDate(receipt.paymentDate)}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    remaining > 0
      ? `⚠️ Balance Remaining: *${INR(remaining)}*`
      : `✅ Invoice fully settled — No balance due.`,
    ``,
    `📄 Invoice: ${invoice.invoiceNumber}`,
    shareUrl ? `🔗 View Receipt: ${shareUrl}` : null,
    ``,
    `Thank you for choosing ${school.schoolName}! 🌟`,
  ].filter(l => l !== null).join("\n");

  const waUrl = dialCode
    ? `https://wa.me/${dialCode}?text=${encodeURIComponent(waLines)}`
    : `https://wa.me/?text=${encodeURIComponent(waLines)}`;

  return (
    <div className="yd-no-print" style={{ maxWidth:840,margin:"12px auto 48px",padding:"0 20px" }}>
      <div style={{
        background:"#FFFFFF",borderRadius:14,
        border:`1px solid ${R.border}`,
        padding:"16px 20px",
        boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          fontSize:7,fontWeight:700,color:R.inkFaint,
          textTransform:"uppercase",letterSpacing:"0.18em",marginBottom:12,
        }}>Share Receipt</div>

        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="rcpt-wa-btn"
            style={{
              flex:1,minWidth:160,
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              padding:"11px 18px",borderRadius:10,
              background:"#25D366",textDecoration:"none",
              fontSize:12.5,fontWeight:700,color:"#FFFFFF",
              boxShadow:"0 3px 12px rgba(37,211,102,0.25)",
            }}>📲 Send on WhatsApp</a>

          <button onClick={() => copyText(shareUrl, setLinkCopied)}
            className="rcpt-btn"
            style={{
              flex:1,minWidth:160,
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              padding:"11px 18px",borderRadius:10,
              background:linkCopied ? R.sageLight : R.sectionBg,
              border:`1px solid ${linkCopied ? R.sageBorder : R.border}`,
              fontSize:12.5,fontWeight:700,
              color:linkCopied ? R.sageDeep : R.inkMuted,
              cursor:"pointer",transition:"all 0.15s",
            }}>{linkCopied ? "✓ Link Copied!" : "🔗 Copy Link"}</button>

          {invoice.invoiceNumber && (
            <a href={`/invoice-view/${invoice.invoiceNumber}`}
              className="rcpt-btn"
              style={{
                flex:1,minWidth:160,
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                padding:"11px 18px",borderRadius:10,
                background:R.sectionBg,border:`1px solid ${R.border}`,
                textDecoration:"none",fontSize:12.5,fontWeight:700,color:R.inkMuted,
              }}>↗ View Invoice</a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Loading & Error states ── */
function LoadingState() {
  return (
    <div style={{
      minHeight:"100vh",background:R.pageBg,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,
    }}>
      <div style={{
        width:54,height:54,borderRadius:16,
        background:`linear-gradient(135deg,${R.sage},${R.sageMid})`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:24,boxShadow:"0 8px 24px rgba(22,163,74,0.26)",
      }}>✓</div>
      <div style={{ fontSize:14,fontWeight:700,color:R.inkMid }}>Loading receipt…</div>
      <div style={{ display:"flex",gap:6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width:6,height:6,borderRadius:"50%",background:R.sage,
            animation:`yd-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes yd-pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}
function ErrorState({ msg, onBack }) {
  return (
    <div style={{
      minHeight:"100vh",background:R.pageBg,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,
    }}>
      <span style={{ fontSize:44 }}>😕</span>
      <div style={{ fontSize:18,fontWeight:800,color:R.ink }}>Receipt Not Found</div>
      <div style={{ fontSize:13,color:R.inkMuted,maxWidth:340,textAlign:"center" }}>
        {msg || "This receipt could not be loaded."}
      </div>
      <button onClick={onBack} style={{
        marginTop:6,padding:"10px 24px",borderRadius:10,
        background:`linear-gradient(135deg,${R.sage},${R.sageMid})`,
        color:"#FFFFFF",fontWeight:800,fontSize:13,border:"none",cursor:"pointer",
        boxShadow:"0 4px 14px rgba(22,163,74,0.30)",
      }}>← Go Back</button>
    </div>
  );
}

/* ── Sticky top action bar ── */
function TopBar({ receipt, onBack, onPrint, onDownload, exporting }) {
  const rcptNum = displayReceiptNumber(receipt);
  return (
    <div className="yd-no-print" style={{
      background:"#FFFFFF",borderBottom:`1px solid ${R.border}`,
      padding:"0 24px",height:52,
      display:"flex",alignItems:"center",gap:12,
      position:"sticky",top:0,zIndex:50,
      boxShadow:"0 1px 6px rgba(0,0,0,0.05)",
    }}>
      <button onClick={onBack} className="rcpt-btn" style={{
        background:R.sectionBg,border:`1px solid ${R.border}`,
        color:R.inkMid,padding:"5px 13px",borderRadius:8,
        fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,
      }}>← Back</button>

      <div style={{
        width:24,height:24,borderRadius:7,flexShrink:0,
        background:`linear-gradient(135deg,${R.sage},${R.sageMid})`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:10,fontWeight:900,color:"#FFFFFF",
      }}>✓</div>

      <div style={{ flex:1,minWidth:0 }}>
        <span style={{ fontWeight:700,fontSize:13,color:R.ink,fontFamily:"'Courier New',monospace" }}>
          {rcptNum}
        </span>
        <span style={{ fontSize:11,color:R.inkMuted,marginLeft:10 }}>
          {receipt.studentName} · {INR(receipt.amount)} · {receipt.paymentMode}
        </span>
      </div>

      <div style={{ display:"flex",gap:7,flexShrink:0 }}>
        <button onClick={onPrint} className="rcpt-btn" style={{
          display:"flex",alignItems:"center",gap:6,
          padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:700,
          cursor:"pointer",background:R.sectionBg,color:R.inkMuted,border:`1px solid ${R.border}`,
        }}>🖨 Print</button>
        <button onClick={onDownload} disabled={exporting} className="rcpt-btn" style={{
          display:"flex",alignItems:"center",gap:6,
          padding:"6px 16px",borderRadius:8,fontSize:12,fontWeight:700,
          cursor:exporting ? "not-allowed" : "pointer",
          background:exporting ? R.sectionBg : `linear-gradient(135deg,${R.sage},${R.sageMid})`,
          color:exporting ? R.inkMuted : "#FFFFFF",border:"none",
          opacity:exporting ? 0.65 : 1,
          boxShadow:exporting ? "none" : "0 3px 10px rgba(22,163,74,0.26)",
        }}>{exporting ? "⏳ Exporting…" : "⬇ Download PDF"}</button>
      </div>
    </div>
  );
}

/* ── Default school fallback ── */
const DEFAULT_SCHOOL = {
  schoolName:"Yellow Dot Preschool", branchName:"Seawoods Branch",
  address:"Sector 50, Seawoods, Navi Mumbai — 400 706",
  phone:"+91 98765 43210", email:"hello@yellowdot.app",
  logoUrl:"", faviconUrl:"/favicon.ico", gstNumber:"",
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function ReceiptView() {
  const { receiptId } = useParams();
  const navigate      = useNavigate();
  const receiptRef    = useRef(null);

  const [receipt,       setReceipt       ] = useState(null);
  const [invoice,       setInvoice       ] = useState(null);
  const [student,       setStudent       ] = useState(null);
  const [priorPayments, setPriorPayments  ] = useState([]);
  const [school,        setSchool        ] = useState(DEFAULT_SCHOOL);
  const [loading,       setLoading       ] = useState(true);
  const [error,         setError         ] = useState("");
  const [exporting,     setExporting     ] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError("");

        /* Resolve by receiptNumber first, then paymentId */
        let rcpt = null;
        try {
          const r = await get(`/api/payments?receiptNumber=${encodeURIComponent(receiptId)}`);
          rcpt = Array.isArray(r) ? r[0] : (r?.payments?.[0] || r);
        } catch {}
        if (!rcpt?.amount) {
          try { rcpt = await get(`/api/payments/${encodeURIComponent(receiptId)}`); } catch {}
        }
        if (!rcpt?.amount) { setError("Receipt not found or access denied."); return; }
        if (!cancelled) setReceipt(rcpt);

        const invNum = rcpt.invoiceNumber;
        const stuId  = rcpt.studentId;

        const [invRes, stuRes, payRes, setRes] = await Promise.allSettled([
          invNum ? get(`/invoice/${encodeURIComponent(invNum)}`)                              : Promise.resolve(null),
          stuId  ? get(`/students/${encodeURIComponent(stuId)}`)                              : Promise.resolve(null),
          invNum ? get(`/api/payments?invoiceNumber=${encodeURIComponent(invNum)}`) : Promise.resolve([]),
          get("/api/settings"),
        ]);
        if (cancelled) return;

        if (invRes.status === "fulfilled" && invRes.value) setInvoice(invRes.value);
        if (stuRes.status === "fulfilled" && stuRes.value) {
          const s = stuRes.value; setStudent(s.student || s);
        }
        if (payRes.status === "fulfilled") {
          const pd  = payRes.value;
          const all = Array.isArray(pd) ? pd : (pd?.payments || []);
          setPriorPayments(all.filter(p =>
            p.paymentId !== rcpt.paymentId && p.receiptNumber !== rcpt.receiptNumber
          ));
        }
        if (setRes.status === "fulfilled" && setRes.value) {
          const s = setRes.value, sc = s?.school || {}, br = s?.branding || {}, pay = s?.payment || {};
          setSchool(prev => ({
            ...prev,
            schoolName:  br.reportHeader || sc.name       || prev.schoolName,
            branchName:  sc.tagline      || sc.branchName || prev.branchName,
            address:     sc.address      || prev.address,
            phone:       sc.phone        || prev.phone,
            email:       sc.email        || prev.email,
            logoUrl:     br.logoUrl      || sc.logoUrl    || prev.logoUrl,
            faviconUrl:  br.faviconUrl   || sc.faviconUrl || prev.faviconUrl,
            gstNumber:   pay.gstNumber   || sc.gstNumber  || prev.gstNumber,
          }));
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.error || e.message || "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [receiptId]);

  /* ── PDF export — fixed pagination (no blank trailing pages) ── */
  const downloadPDF = useCallback(async () => {
    if (!receiptRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale:2.5, useCORS:true, allowTaint:true,
        backgroundColor:R.docBg, logging:false, imageTimeout:8000,
      });
      const img  = canvas.toDataURL("image/png");
      const pdf  = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pdfW) / canvas.width;
      const totalPages = Math.max(1, Math.ceil((imgH - 0.5) / pdfH));
      for (let pg = 0; pg < totalPages; pg++) {
        if (pg > 0) pdf.addPage();
        pdf.addImage(img, "PNG", 0, -(pg * pdfH), pdfW, imgH);
      }
      pdf.save(`Receipt-${displayReceiptNumber(receipt)}.pdf`);
    } catch (e) {
      console.error("[PDF]", e);
      alert("PDF export failed. Try Print instead.");
    } finally {
      setExporting(false);
    }
  }, [receiptId, receipt, exporting]);

  if (loading)           return <LoadingState />;
  if (error || !receipt) return <ErrorState msg={error} onBack={() => navigate(-1)} />;

  const inv       = invoice || { invoiceNumber:receipt.invoiceNumber||"—", totalAmount:receipt.amount, class:receipt.class };
  const total     = parseCurrency(inv.totalAmount || receipt.amount);
  const prior     = priorPayments.reduce((s, p) => s + parseCurrency(p.amount), 0);
  const thisPay   = parseCurrency(receipt.amount);
  const remaining = Math.max(0, total - (prior + thisPay));

  return (
    <div style={{
      fontFamily:"'Plus Jakarta Sans',system-ui,-apple-system,sans-serif",
      background:R.pageBg, minHeight:"100vh",
    }}>
      <style>{PRINT_CSS}</style>

      <TopBar
        receipt={receipt}
        onBack={() => navigate(-1)}
        onPrint={() => window.print()}
        onDownload={downloadPDF}
        exporting={exporting}
      />

      <div className="rcpt-page" style={{ padding:"22px 20px 14px" }}>

        {/* Printable receipt document */}
        <div
          ref={receiptRef}
          className="rcpt-doc"
          style={{
            maxWidth:840, margin:"0 auto",
            background:R.docBg,
            borderRadius:16, overflow:"hidden",
            boxShadow:"0 0 0 1px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.07), 0 16px 48px rgba(0,0,0,0.05)",
          }}
        >
          <ReceiptDocument
            receipt={receipt}
            invoice={inv}
            student={student}
            school={school}
            priorPayments={priorPayments}
          />
        </div>

        {/* Share panel — digital only */}
        <SharePanel
          receipt={receipt}
          invoice={inv}
          student={student}
          school={school}
          remaining={remaining}
        />
      </div>
    </div>
  );
}
