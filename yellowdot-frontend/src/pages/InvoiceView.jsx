/**
 * InvoiceView.jsx — Yellow Dot Premium Invoice
 * ─────────────────────────────────────────────────────────────────
 * Route : /invoice-view/:invoiceNumber  (standalone, no MainLayout)
 *
 * DUAL-MODE ARCHITECTURE
 * ──────────────────────
 *  1. InvoiceDocument   — PDF/print-first. Cream background, gold accents,
 *                         luxury typography. Zero payment widgets.
 *                         Captured by html2canvas for PDF export.
 *
 *  2. DigitalPaymentPanel — Web-only (yd-no-print). UPI QR, bank transfer,
 *                           WhatsApp share, copy links. Rendered below the
 *                           document in the browser. Never appears in PDF.
 *
 * Color rule: Yellow Dot brand only — gold, charcoal, warm ivory, cream.
 *             No blue, green, purple, orange.  errRed for form validation only.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate }                    from "react-router-dom";
import { api }                                       from "../services/authService";
import { parseCurrency }                             from "../utils/currency";
import jsPDF                                         from "jspdf";
import html2canvas                                   from "html2canvas";
import { QRCodeCanvas }                              from "qrcode.react";
import PaymentDrawer         from "../components/PaymentDrawer";
import PaymentCollectDrawer  from "../components/PaymentCollectDrawer";

const get = (url) => api.get(url).then((r) => r.data);

/* ═══════════════════════════════════════════════════════════════════
   BRAND PALETTE — strict Yellow Dot only
   ═══════════════════════════════════════════════════════════════════ */
const C = {
  /* Gold ───────────────────────────────── */
  gold:        "#F4C400",
  goldDark:    "#C9A000",
  goldDeep:    "#9A7600",
  goldLight:   "#FFF8D0",
  goldPale:    "#FDFBF2",
  goldBorder:  "#DEC840",
  goldFaint:   "rgba(244,196,0,0.10)",

  /* Ink / Charcoal ─────────────────────── */
  ink:         "#1C1917",
  inkMid:      "#292524",
  inkSoft:     "#3C3835",
  inkMuted:    "#6B6560",
  inkFaint:    "#9C9590",

  /* Warm Neutrals ─────────────────────── */
  cream:       "#FAF8F3",
  creamDark:   "#F4EFE4",
  creamBorder: "#DDD5C0",

  /* Document ──────────────────────────── */
  pageBg:      "#F0EEE9",   /* outer page                     */
  docBg:       "#FDFCF9",   /* invoice doc — barely warm white */
  sectionBg:   "#F8F6F1",   /* alternating sections            */
  cardBg:      "#F3F1EB",   /* card backgrounds                */
  rowAlt:      "#F7F5F0",   /* alternating table rows          */

  /* Typography ────────────────────────── */
  text:        "#0F0D0B",
  textSoft:    "#3C3835",
  textMuted:   "#6B6560",
  textFaint:   "#9C9590",

  /* Structural ────────────────────────── */
  border:      "#E2DED8",
  borderLight: "#EDEBE5",

  /* Form validation only (not a design color) */
  errRed:      "#DC2626",
  errRedLight: "#FEF2F2",
  errRedBorder:"#FECACA",
};

/* ═══════════════════════════════════════════════════════════════════
   STATUS — brand palette only
   ═══════════════════════════════════════════════════════════════════ */
const STATUS = {
  Paid:      { label:"Paid",      bg:"#FFF8D0",               fg:"#7A5C00", border:"#DEC840",              dot:"#C9A000" },
  Pending:   { label:"Pending",   bg:"#FAF8F3",               fg:"#3C3835", border:"#C8B87A",              dot:"#B8940A" },
  Partial:   { label:"Partial",   bg:"rgba(244,196,0,0.14)",  fg:"#7A5C00", border:"rgba(201,160,0,0.32)", dot:"#F4C400" },
  Overdue:   { label:"Overdue",   bg:"#1C1917",               fg:"#F4C400", border:"rgba(244,196,0,0.22)", dot:"#F4C400" },
  Cancelled: { label:"Cancelled", bg:"#F5F3EE",               fg:"#6B6560", border:"#E2DED8",              dot:"#9C9590" },
};

/* ── Logo source priority: faviconUrl → logoUrl → website favicon ── */
function getLogoSrc(school) {
  if (school.faviconUrl) return school.faviconUrl;
  if (school.logoUrl)    return school.logoUrl;
  if (school.website) {
    const host = school.website.replace(/^https?:\/\//, "").split("/")[0];
    return `https://${host}/favicon.ico`;
  }
  return "";
}

/* ── Default school ─────────────────────────────────────────────── */
const DEFAULT_SCHOOL = {
  schoolName:      "Yellow Dot Preschool",
  branchName:      "Seawoods Branch",
  address:         "Sector 50, Seawoods, Navi Mumbai — 400 706",
  phone:           "+91 98765 43210",
  email:           "hello@yellowdot.app",
  gstNumber:       "",
  website:         "www.yellowdot.app",
  logoUrl:         "",
  faviconUrl:      "/favicon.ico",
  upiId:           "yellowdot@upi",
  bankName:        "HDFC Bank",
  accountName:     "Yellow Dot Education Pvt Ltd",
  accountNumber:   "XXXX XXXX 1234",
  ifscCode:        "HDFC0001234",
  branch:          "Seawoods, Navi Mumbai",
  cashInstructions:"Pay at the school front desk during office hours.",
  officeHours:     "Mon – Sat: 8:00 AM – 6:00 PM",
};

/* ── Print / PDF CSS ─────────────────────────────────────────────── */
const PRINT_CSS = `
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0 !important; background: #FDFCF9 !important; }
    .yd-no-print { display: none !important; }
    .inv-page { padding: 0 !important; background: transparent !important; min-height: unset !important; }
    .inv-doc  { border-radius: 0 !important; box-shadow: none !important; max-width: 100% !important; }
    @page { size: A4 portrait; margin: 0mm; }
  }
`;

/* ── Formatters ──────────────────────────────────────────────────── */
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s
    : d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}
function fmtPhone(p) {
  if (!p) return "—";
  const c = String(p).replace(/\D/g, "");
  if (c.length >= 10) { const t = c.slice(-10); return `+91 ${t.slice(0,5)} ${t.slice(5)}`; }
  return p;
}
function initials(name = "") {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "YD";
}
function INR(val) {
  const n = parseCurrency(val);
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits:0, maximumFractionDigits:2 });
}

/* ═══════════════════════════════════════════════════════════════════
   SHARED PRIMITIVES
   ═══════════════════════════════════════════════════════════════════ */

function SectionLabel({ children, style = {} }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:14, ...style }}>
      <div style={{ width:2.5, height:11, borderRadius:2, background:C.gold, flexShrink:0 }}/>
      <span style={{
        fontSize:8, fontWeight:800, color:C.inkFaint,
        textTransform:"uppercase", letterSpacing:"0.14em",
      }}>{children}</span>
    </div>
  );
}

function Field({ label, value, mono, bold, children, style = {} }) {
  return (
    <div style={{ marginBottom:9, ...style }}>
      <div style={{
        fontSize:7.5, fontWeight:700, color:C.inkFaint,
        textTransform:"uppercase", letterSpacing:"0.11em", marginBottom:2,
      }}>{label}</div>
      <div style={{
        fontSize: bold ? 13 : 11.5,
        fontWeight: bold ? 700 : 500,
        color: C.text,
        fontFamily: mono ? "'Courier New', monospace" : "inherit",
        lineHeight: 1.45,
      }}>
        {children ?? (value || "—")}
      </div>
    </div>
  );
}

function StatusPill({ st, size = "md" }) {
  const sz = size === "sm" ? { px:"4px 10px", fs:9,    dot:5 }
           : size === "lg" ? { px:"7px 18px", fs:13,   dot:7 }
           :                 { px:"5px 13px", fs:10.5,  dot:6 };
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      background:st.bg, color:st.fg,
      border:`1px solid ${st.border}`,
      padding:sz.px, borderRadius:999,
      fontSize:sz.fs, fontWeight:800, letterSpacing:"0.05em",
    }}>
      <span style={{ width:sz.dot, height:sz.dot, borderRadius:"50%", background:st.dot, flexShrink:0 }}/>
      {st.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRINTABLE INVOICE SECTIONS
   (Everything below is captured by html2canvas for PDF export)
   ═══════════════════════════════════════════════════════════════════ */

/* ── HEADER — light, cream, premium ────────────────────────────── */
function InvHeader({ school, invoice, st }) {
  const logoSrc = getLogoSrc(school);
  const [logoErr, setLogoErr] = useState(false);
  const showLogo = !!logoSrc && !logoErr;
  const inits    = initials(school.schoolName);

  return (
    <div style={{
      position:"relative",
      /* ── Yellow Dot luxury brand gradient — full header bg ── */
      background:[
        "radial-gradient(circle at top right, rgba(255,255,255,0.55) 0%, transparent 35%)",
        "linear-gradient(155deg, #fff4c2 0%, #ffe78a 45%, #ffd43b 100%)",
      ].join(","),
      boxShadow:"inset 0 -2px 0 rgba(180,140,0,0.18), 0 2px 12px rgba(180,140,0,0.08)",
    }}>
      {/* Soft top-left shimmer */}
      <div style={{
        position:"absolute",top:0,left:0,right:0,height:1,pointerEvents:"none",
        background:"linear-gradient(90deg,rgba(255,255,255,0.70),rgba(255,255,255,0.30) 60%,transparent)",
      }}/>

      {/* Gold top accent rule — 3px brand bar */}
      <div style={{
        height:3,
        background:`linear-gradient(90deg, ${C.goldDark} 0%, ${C.gold} 30%, #FFE44D 55%, ${C.gold} 80%, ${C.goldDark} 100%)`,
      }}/>

      <div style={{ padding:"24px 44px 20px", position:"relative" }}>
        <div style={{
          display:"flex", justifyContent:"space-between",
          alignItems:"flex-start", gap:24,
        }}>

          {/* LEFT — School identity */}
          <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>

            {/* Logo container — warm yellow bg */}
            <div style={{
              width:56, height:56, borderRadius:14, flexShrink:0,
              position:"relative",
              border:"1.5px solid rgba(180,140,0,0.28)",
              background: showLogo
                ? "linear-gradient(145deg,#fffef5,#fff8d0)"
                : `linear-gradient(145deg, ${C.gold} 0%, ${C.goldDark} 100%)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              overflow:"hidden",
              boxShadow:"0 2px 12px rgba(180,140,0,0.20), 0 1px 3px rgba(0,0,0,0.06)",
            }}>
              {showLogo ? (
                <div style={{
                  position:"absolute", inset:7,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <img
                    src={logoSrc}
                    alt={school.schoolName}
                    onError={() => setLogoErr(true)}
                    style={{
                      maxWidth:"100%", maxHeight:"100%",
                      width:"auto", height:"auto",
                      objectFit:"contain", objectPosition:"center",
                      display:"block",
                    }}
                  />
                </div>
              ) : (
                <span style={{
                  fontSize:17, fontWeight:900, color:"#3D2E00",
                  fontFamily:"system-ui, -apple-system, sans-serif",
                  userSelect:"none", lineHeight:1,
                }}>{inits}</span>
              )}
            </div>

            {/* School info */}
            <div>
              <div style={{
                fontSize:20, fontWeight:900, color:"#1a1400",
                letterSpacing:"-0.025em", lineHeight:1.1,
              }}>{school.schoolName}</div>

              {/* Gold accent line */}
              <div style={{
                height:2, marginTop:4, marginBottom:4, width:52, borderRadius:2,
                background:"linear-gradient(90deg,#C9A000,#DEC840,transparent)",
              }}/>

              {school.branchName && (
                <div style={{
                  fontSize:9, fontWeight:700, color:"#b8860b",
                  textTransform:"uppercase", letterSpacing:"0.14em",
                }}>{school.branchName}</div>
              )}

              <div style={{
                fontSize:9.5, color:"#7A6A50",
                marginTop:6, lineHeight:1.8, fontWeight:400,
              }}>
                {school.address && <div>{school.address}</div>}
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:1 }}>
                  {school.phone && <span>{school.phone}</span>}
                  {school.email && <span>{school.email}</span>}
                </div>
                {school.gstNumber && (
                  <div style={{ marginTop:1, fontWeight:600, color:"#5A4E30" }}>
                    GSTIN: {school.gstNumber}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — Invoice identity */}
          <div style={{ textAlign:"right", flexShrink:0 }}>
            {/* TAX INVOICE badge — gold gradient */}
            <div style={{
              display:"inline-flex", alignItems:"center", marginBottom:9,
              padding:"4px 13px", borderRadius:6,
              background:"linear-gradient(135deg,#fff6cc 0%,#ffe066 100%)",
              border:"1.5px solid rgba(180,140,0,0.35)",
              boxShadow:"0 1px 4px rgba(180,140,0,0.18)",
            }}>
              <span style={{
                fontSize:7, fontWeight:800, color:"#7A5C00",
                textTransform:"uppercase", letterSpacing:"0.22em",
              }}>Tax Invoice</span>
            </div>

            {/* Invoice number */}
            <div style={{
              display:"block",
              fontSize:26, fontWeight:900, color:"#1a1400",
              fontFamily:"'Courier New', monospace",
              letterSpacing:"0.02em", lineHeight:1, marginBottom:10,
            }}>#{invoice.invoiceNumber}</div>

            <StatusPill st={st} size="md"/>

            {/* Dates */}
            <div style={{
              marginTop:10, fontSize:9.5, color:"#7A6A50",
              display:"flex", gap:8, justifyContent:"flex-end",
              alignItems:"center", flexWrap:"wrap",
            }}>
              <span>Issued {fmtDate(invoice.invoiceDate)}</span>
              {invoice.dueDate && (
                <span style={{
                  padding:"2px 8px", borderRadius:4,
                  background:"rgba(180,140,0,0.12)", border:"1px solid rgba(180,140,0,0.28)",
                  fontSize:8.5, fontWeight:700, color:"#7A5C00",
                }}>Due {fmtDate(invoice.dueDate)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Golden whisper bottom divider */}
      <div style={{ height:1, background:"linear-gradient(90deg,transparent,rgba(180,140,0,0.22) 20%,rgba(180,140,0,0.22) 80%,transparent)", margin:"0 44px" }}/>
    </div>
  );
}

/* ── STUDENT + PARENT (Bill To) ─────────────────────────────────── */
function BillToSection({
  photo, name, studentId, admNo, cls, division, center, academicYear,
  fatherName, fatherPhone, motherName, motherPhone, email,
  emergencyName, emergencyPhone,
}) {
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"1fr 1fr",
      borderBottom:`1px solid ${C.border}`,
      background:C.sectionBg,
    }}>
      {/* Student */}
      <div style={{ padding:"22px 44px", borderRight:`1px solid ${C.border}` }}>
        <SectionLabel>Student</SectionLabel>

        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
          {photo ? (
            <img src={photo} alt={name} style={{
              width:46, height:46, borderRadius:12, objectFit:"cover",
              border:`1.5px solid ${C.goldBorder}`, flexShrink:0,
              boxShadow:"0 2px 8px rgba(0,0,0,0.07)",
            }}/>
          ) : (
            <div style={{
              width:46, height:46, borderRadius:12, flexShrink:0,
              background:`linear-gradient(145deg, ${C.gold} 0%, ${C.goldDark} 100%)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, fontWeight:900, color:C.ink,
            }}>{initials(name)}</div>
          )}
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:C.text, lineHeight:1.2 }}>{name}</div>
            <div style={{ fontSize:10.5, color:C.inkMuted, marginTop:3, fontWeight:500 }}>
              {[cls, division].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 20px" }}>
          {admNo        && <Field label="Admission No." value={admNo} bold/>}
          <Field label="Student ID"    value={studentId} mono/>
          <Field label="Class"         value={cls}/>
          {division     && <Field label="Division"     value={division}/>}
          <Field label="Center"        value={center}/>
          {academicYear && <Field label="Academic Year" value={academicYear}/>}
        </div>
      </div>

      {/* Parent / Guardian */}
      <div style={{ padding:"22px 44px" }}>
        <SectionLabel>Bill To — Parent / Guardian</SectionLabel>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 20px" }}>
          {fatherName  && <Field label="Father's Name"   value={fatherName}/>}
          {fatherPhone && <Field label="Father's Mobile" value={fmtPhone(fatherPhone)}/>}
          {motherName  && <Field label="Mother's Name"   value={motherName}/>}
          {motherPhone && <Field label="Mother's Mobile" value={fmtPhone(motherPhone)}/>}
          {email       && <Field label="Email" value={email} style={{gridColumn:"1/-1"}}/>}
        </div>

        {(emergencyName || emergencyPhone) && (
          <div style={{
            marginTop:14, padding:"9px 12px 9px 15px", borderRadius:8,
            background:C.goldLight, border:`1px solid ${C.goldBorder}`,
            position:"relative", overflow:"hidden",
          }}>
            <div style={{
              position:"absolute", left:0, top:0, bottom:0, width:3,
              background:C.goldDark, borderRadius:"8px 0 0 8px",
            }}/>
            <div style={{
              fontSize:7.5, fontWeight:800, color:C.goldDeep,
              textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:2,
            }}>Emergency Contact</div>
            <div style={{fontSize:11, fontWeight:600, color:C.inkMid}}>
              {[emergencyName, emergencyPhone ? fmtPhone(emergencyPhone) : ""].filter(Boolean).join("  ·  ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── FEE TABLE + TOTALS ─────────────────────────────────────────────
   Invoice is a BILLING REQUEST only. It shows the fee breakdown and
   the amount due. Payment status belongs on the Receipt, not here.
   ─────────────────────────────────────────────────────────────────── */
function FeeAndTotals({ invoice }) {
  const base     = parseCurrency(invoice.amount);
  const discount = parseCurrency(invoice.discount);
  const gst      = parseCurrency(invoice.gst);
  const total    = parseCurrency(invoice.totalAmount);

  const TH = ({ children, right, first }) => (
    <th style={{
      padding:"10px 14px",
      textAlign: right ? "right" : "left",
      fontSize:8, fontWeight:700, color:C.inkFaint,
      textTransform:"uppercase", letterSpacing:"0.12em",
      background:C.cardBg,
      borderBottom:`1px solid ${C.border}`,
      paddingLeft: first ? 44 : 14,
    }}>{children}</th>
  );

  const TD = ({ children, right, bold, color, mono, first }) => (
    <td style={{
      padding:"12px 14px",
      textAlign: right ? "right" : "left",
      fontSize: bold ? 13 : 11.5,
      fontWeight: bold ? 700 : 500,
      color: color || C.text,
      fontFamily: mono ? "'Courier New', monospace" : "inherit",
      paddingLeft: first ? 44 : 14,
    }}>{children}</td>
  );

  const TotalRow = ({ label, value, separator, grandTotal, muted, highlight }) => {
    if (separator) return <div style={{ height:1, background:C.borderLight, margin:"4px 0" }}/>;
    return (
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"baseline",
        padding: grandTotal ? "8px 0 4px" : "3.5px 0",
      }}>
        <span style={{
          fontSize: grandTotal ? 12 : 11,
          fontWeight: grandTotal ? 700 : 400,
          color: muted ? C.inkFaint : grandTotal ? C.text : C.inkMuted,
        }}>{label}</span>
        <span style={{
          fontSize: grandTotal ? 20 : 12,
          fontWeight: grandTotal ? 900 : 500,
          color: highlight ? C.goldDark : muted ? C.inkFaint : grandTotal ? C.text : C.inkMuted,
          fontFamily: grandTotal ? "'Courier New', monospace" : "inherit",
          letterSpacing: grandTotal ? "-0.01em" : 0,
        }}>{value}</span>
      </div>
    );
  };

  return (
    <div style={{ borderBottom:`1px solid ${C.border}` }}>
      {/* Table */}
      <div style={{ padding:"24px 0 0" }}>
        <div style={{ padding:"0 44px 12px" }}>
          <SectionLabel>Fee Breakdown</SectionLabel>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              <TH first>#</TH>
              <TH>Description</TH>
              <TH right>Base Amount</TH>
              <TH right>Discount</TH>
              <TH right>GST / Tax</TH>
              <TH right>Net Amount</TH>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background:C.docBg }}>
              <TD first>
                <span style={{fontSize:10, fontWeight:600, color:C.inkFaint, fontFamily:"'Courier New',monospace"}}>01</span>
              </TD>
              <TD bold>{invoice.feeType || "Tuition Fee"}</TD>
              <TD right mono>{INR(base)}</TD>
              <TD right color={discount > 0 ? C.goldDark : C.inkFaint}>
                {discount > 0 ? `− ${INR(discount)}` : "—"}
              </TD>
              <TD right color={gst > 0 ? C.inkSoft : C.inkFaint}>
                {gst > 0 ? `+ ${INR(gst)}` : "—"}
              </TD>
              <TD right bold mono>{INR(total)}</TD>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals — invoice shows ONLY what is due, never what was paid */}
      <div style={{
        display:"flex", justifyContent:"flex-end",
        borderTop:`1px solid ${C.border}`,
        padding:"18px 44px 24px",
      }}>
        <div style={{ width:280 }}>
          <TotalRow label="Subtotal"    value={INR(base)}              muted/>
          {discount > 0 && <TotalRow label="Discount"   value={`− ${INR(discount)}`} highlight/>}
          {gst > 0      && <TotalRow label="GST / Tax"  value={`+ ${INR(gst)}`}/>}
          <TotalRow separator/>
          <TotalRow label="Amount Due"  value={INR(total)} grandTotal/>
        </div>
      </div>
    </div>
  );
}

/* ── PAYMENT HISTORY — digital only, links to receipts ─────────────
   NOT part of the printable invoice. Rendered inside a yd-no-print
   wrapper outside the invoiceRef div.
   ─────────────────────────────────────────────────────────────────── */
function PaymentHistorySection({ payments }) {
  if (!payments.length) return null;
  const total = payments.reduce((s, p) => s + parseCurrency(p.amount), 0);

  return (
    <div style={{
      background: C.docBg,
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      overflow: "hidden",
      marginBottom: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${C.border}`,
        background: C.sectionBg,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:2.5, height:11, borderRadius:2, background:C.gold }}/>
          <span style={{ fontSize:8, fontWeight:800, color:C.inkFaint, textTransform:"uppercase", letterSpacing:"0.13em" }}>
            Payment Receipts ({payments.length})
          </span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:C.goldDeep, fontFamily:"'Courier New',monospace" }}>
          {INR(total)} collected
        </span>
      </div>

      {/* Receipt rows */}
      <div style={{ display:"flex", flexDirection:"column" }}>
        {payments.map((p, i) => (
          <div key={p.paymentId || i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 20px",
            borderBottom: i < payments.length - 1 ? `1px solid ${C.borderLight}` : "none",
            background: i % 2 === 0 ? C.docBg : C.rowAlt,
          }}>
            {/* Check icon */}
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: `linear-gradient(135deg, #16A34A, #22C55E)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, color: "#FFFFFF", fontWeight: 900,
            }}>✓</div>

            {/* Details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.text, fontFamily:"'Courier New',monospace" }}>
                  {INR(p.amount)}
                </span>
                <span style={{
                  padding:"2px 8px", borderRadius:5,
                  background: C.goldLight, color: C.goldDeep,
                  fontSize: 9.5, fontWeight: 700, border: `1px solid ${C.goldBorder}`,
                }}>{p.paymentMode || "Cash"}</span>
                {p.receiptNumber && (
                  <span style={{ fontSize:9.5, color:C.inkFaint, fontFamily:"'Courier New',monospace" }}>
                    {p.receiptNumber}
                  </span>
                )}
              </div>
              <div style={{ fontSize:10, color:C.inkFaint, marginTop:2 }}>
                {fmtDate(p.paymentDate || p.createdAt)}
                {p.transactionId && ` · ${p.transactionId}`}
                {p.staffName     && ` · ${p.staffName}`}
              </div>
            </div>

            {/* View Receipt button */}
            {(p.receiptNumber || p.paymentId) && (
              <a
                href={`/receipt/${p.receiptNumber || p.paymentId}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  flexShrink: 0,
                  padding: "6px 12px", borderRadius: 7,
                  border: `1px solid ${C.border}`,
                  background: C.sectionBg,
                  fontSize: 11, fontWeight: 700, color: C.inkSoft,
                  textDecoration: "none", whiteSpace: "nowrap",
                }}
              >View Receipt ↗</a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── NOTES & POLICIES (printable, brand-only) ───────────────────── */
function NotesAndPolicies({ invoice, school }) {
  const policies = [
    {
      title: "Late Payment",
      text:  "A charge of ₹100/day applies after the due date. Please ensure timely payment.",
      accent: C.goldDark, bg: C.goldLight, border: C.goldBorder,
    },
    {
      title: "Refund Policy",
      text:  "Fees are non-refundable except under exceptional circumstances approved by management.",
      accent: C.goldDeep, bg: C.cream, border: C.creamBorder,
    },
    {
      title: "For Queries",
      text:  [school.phone, school.email].filter(Boolean).join("  ·  "),
      sub:   `Quote invoice #${invoice.invoiceNumber} in all correspondence.`,
      accent: C.gold, bg: C.goldPale, border: C.goldBorder,
    },
  ];

  return (
    <div style={{ padding:"20px 44px 22px", borderBottom:`1px solid ${C.border}` }}>
      <SectionLabel style={{marginBottom:12}}>Notes &amp; Policies</SectionLabel>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {policies.map((c, i) => (
          <div key={i} style={{
            position:"relative",
            borderRadius:8, background:c.bg,
            border:`1px solid ${c.border}`,
            padding:"9px 12px 10px 16px",
            overflow:"hidden",
          }}>
            <div style={{
              position:"absolute", left:0, top:0, bottom:0, width:3,
              background:c.accent, borderRadius:"8px 0 0 8px",
            }}/>
            <div style={{
              fontSize:8, fontWeight:800, color:c.accent,
              textTransform:"uppercase", letterSpacing:"0.10em", marginBottom:4,
            }}>{c.title}</div>
            <p style={{ fontSize:9.5, color:C.inkSoft, lineHeight:1.65, margin:0, fontWeight:500 }}>
              {c.text}
            </p>
            {c.sub && (
              <p style={{ fontSize:9, color:C.inkMuted, lineHeight:1.5, margin:"3px 0 0", fontStyle:"italic" }}>
                {c.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {invoice.notes && (
        <div style={{
          marginTop:10, position:"relative",
          borderRadius:8, background:C.goldLight,
          border:`1px solid ${C.goldBorder}`,
          padding:"9px 12px 9px 16px", overflow:"hidden",
        }}>
          <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:C.goldDark, borderRadius:"8px 0 0 8px" }}/>
          <div style={{fontSize:8, fontWeight:800, color:C.goldDark, textTransform:"uppercase", letterSpacing:"0.10em", marginBottom:4}}>Invoice Note</div>
          <p style={{fontSize:10.5, color:C.inkSoft, lineHeight:1.6, margin:0, fontWeight:500}}>{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ── FOOTER (printable) ─────────────────────────────────────────── */
function InvFooter({ school, invoiceNumber }) {
  const inits = initials(school.schoolName);
  return (
    <div>
      {/* Signatures row */}
      <div style={{
        padding:"22px 44px",
        display:"grid", gridTemplateColumns:"1fr auto 1fr",
        alignItems:"flex-end", gap:20,
        background:C.sectionBg,
        borderTop:`1px solid ${C.border}`,
      }}>
        <div style={{textAlign:"center"}}>
          <div style={{height:36, borderBottom:`1px solid ${C.goldBorder}`, marginBottom:7}}/>
          <div style={{fontSize:8, fontWeight:700, color:C.inkFaint, textTransform:"uppercase", letterSpacing:"0.12em"}}>
            Authorised Signatory
          </div>
          <div style={{fontSize:11, fontWeight:600, color:C.inkSoft, marginTop:2}}>{school.schoolName}</div>
        </div>

        <div style={{textAlign:"center", padding:"0 20px"}}>
          <div style={{
            width:48, height:48, borderRadius:"50%",
            border:`1.5px dashed ${C.goldBorder}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, color:C.goldBorder, background:C.goldPale,
          }}>🔏</div>
          <div style={{fontSize:8, color:C.inkFaint, marginTop:4, letterSpacing:"0.09em", textTransform:"uppercase", fontWeight:600}}>
            School Seal
          </div>
        </div>

        <div style={{textAlign:"center"}}>
          <div style={{height:36, borderBottom:`1px solid ${C.goldBorder}`, marginBottom:7}}/>
          <div style={{fontSize:8, fontWeight:700, color:C.inkFaint, textTransform:"uppercase", letterSpacing:"0.12em"}}>
            Parent / Guardian
          </div>
          <div style={{fontSize:11, fontWeight:600, color:C.inkSoft, marginTop:2}}>
            Received &amp; Acknowledged
          </div>
        </div>
      </div>

      {/* Bottom brand strip */}
      <div style={{
        padding:"18px 44px 22px",
        background:[
          "radial-gradient(circle at bottom left, rgba(255,255,255,0.28) 0%, transparent 40%)",
          "linear-gradient(145deg, #ffe680 0%, #ffd43b 55%, #ffc800 100%)",
        ].join(","),
        borderTop:"2px solid rgba(180,140,0,0.22)",
        boxShadow:"inset 0 2px 0 rgba(255,255,255,0.40), 0 -1px 0 rgba(180,140,0,0.10)",
        position:"relative",
        display:"flex", flexDirection:"column", alignItems:"center", gap:6,
      }}>
        {/* Line 1: Thank you headline */}
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <div style={{
            width:20, height:20, borderRadius:5,
            background:"linear-gradient(145deg,#fffef5,#fff8d0)",
            border:"1.5px solid rgba(180,140,0,0.28)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:9, fontWeight:900, color:"#7A5C00",
            boxShadow:"0 1px 4px rgba(180,140,0,0.15)",
          }}>{inits[0]}</div>
          <span style={{fontSize:12, fontWeight:700, color:"#2b2b2b", letterSpacing:"0.01em"}}>
            Thank you for choosing <strong style={{color:"#1a1400"}}>{school.schoolName}</strong> ✨
          </span>
        </div>

        {/* Line 2: Dot separators */}
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{width:4, height:4, borderRadius:"50%", background:"rgba(80,55,0,0.40)"}}/>
          <div style={{width:3, height:3, borderRadius:"50%", background:"rgba(80,55,0,0.20)"}}/>
          <div style={{width:4, height:4, borderRadius:"50%", background:"rgba(80,55,0,0.40)"}}/>
        </div>

        {/* Line 3: Support + invoice ghost */}
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:3}}>
          {(school.phone || school.email) && (
            <span style={{fontSize:8.5, color:"#3d3000"}}>
              For support:
              {school.phone && <span style={{fontWeight:600, color:"#4a3c00"}}> {school.phone}</span>}
              {school.phone && school.email && <span style={{color:"rgba(80,55,0,0.40)"}}> · </span>}
              {school.email && <span style={{fontWeight:600, color:"#4a3c00"}}>{school.email}</span>}
            </span>
          )}
          <span style={{fontSize:7.5, color:"rgba(40,28,0,0.40)", letterSpacing:"0.04em", textTransform:"uppercase"}}>
            digitally generated invoice · {invoiceNumber || ""}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DIGITAL PAYMENT PANEL  — yd-no-print. Never in PDF.
   ═══════════════════════════════════════════════════════════════════ */

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

function CopyBtn({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => copyText(value, setCopied)} style={{
      padding:"3px 8px", borderRadius:5, fontSize:9,
      fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase",
      border:`1px solid ${copied ? C.goldBorder : C.border}`,
      background: copied ? C.goldLight : C.docBg,
      color: copied ? C.goldDeep : C.inkFaint,
      cursor:"pointer", flexShrink:0, whiteSpace:"nowrap",
      transition:"all 0.15s",
    }}>{copied ? "✓ Copied" : label}</button>
  );
}

function DigitalPaymentPanel({ invoice, school, payments, balance, onCollect }) {
  const isPaid      = balance <= 0;
  const amount      = parseCurrency(invoice.totalAmount);
  const hasUpi      = !!school.upiId;
  const hasBank     = !!(school.bankName || school.accountNumber);
  const [linkCopied, setLinkCopied] = useState(false);

  const upiLink = hasUpi
    ? `upi://pay?pa=${encodeURIComponent(school.upiId)}&pn=${encodeURIComponent(school.schoolName)}&am=${balance > 0 ? balance : amount}&cu=INR&tn=${encodeURIComponent(invoice.invoiceNumber)}`
    : "";

  /* WhatsApp share message */
  const waText = [
    `*${school.schoolName}* — Fee Invoice`,
    "",
    `Student: *${invoice.studentName || "—"}*`,
    `Invoice: *#${invoice.invoiceNumber}*`,
    `Amount Due: *${INR(balance > 0 ? balance : amount)}*`,
    invoice.dueDate ? `Due Date: ${fmtDate(invoice.dueDate)}` : "",
    "",
    hasUpi ? `Pay via UPI: *${school.upiId}*` : "",
    hasUpi ? `(GPay · PhonePe · Paytm · BHIM)` : "",
    "",
    `Thank you! 🌟`,
  ].filter(l => l !== undefined).join("\n");

  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  /* Share payment link (current page URL) */
  const shareLink = typeof window !== "undefined" ? window.location.href : "";

  const panelCard = (children, style = {}) => (
    <div style={{
      background:C.docBg,
      border:`1px solid ${C.border}`,
      borderRadius:14,
      padding:"18px 20px",
      ...style,
    }}>{children}</div>
  );

  const panelLabel = (text) => (
    <div style={{
      fontSize:8, fontWeight:800, color:C.inkFaint,
      textTransform:"uppercase", letterSpacing:"0.13em", marginBottom:12,
    }}>{text}</div>
  );

  if (isPaid && payments.length > 0) {
    return (
      <div className="yd-no-print" style={{ maxWidth:860, margin:"16px auto 40px", padding:"0 20px" }}>
        <div style={{
          padding:"16px 20px", borderRadius:12,
          background:C.goldLight, border:`1px solid ${C.goldBorder}`,
          display:"flex", alignItems:"center", gap:12,
        }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background:`linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:16, color:C.ink, flexShrink:0,
          }}>✓</div>
          <div>
            <div style={{fontSize:14, fontWeight:800, color:C.goldDeep}}>Invoice Fully Paid</div>
            <div style={{fontSize:12, color:C.inkMuted, marginTop:2}}>
              This invoice has been settled. No further payment required.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="yd-no-print" style={{ maxWidth:860, margin:"20px auto 60px", padding:"0 20px" }}>

      {/* Panel header */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"4px 0 16px",
      }}>
        <div>
          <div style={{fontSize:15, fontWeight:800, color:C.text}}>Payment Options</div>
          <div style={{fontSize:12, color:C.inkMuted, marginTop:2}}>
            Balance due:{" "}
            <span style={{fontWeight:800, color:C.text, fontFamily:"'Courier New',monospace"}}>
              {INR(balance)}
            </span>
          </div>
        </div>
        <div style={{display:"flex", gap:8}}>
          {/* WhatsApp reminder */}
          <a
            href={waUrl} target="_blank" rel="noopener noreferrer"
            style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"8px 14px", borderRadius:9,
              border:`1px solid ${C.border}`,
              background:C.docBg,
              fontSize:12, fontWeight:700, color:C.inkSoft,
              textDecoration:"none", cursor:"pointer",
            }}
          >📲 Send Reminder</a>

          {/* Collect payment */}
          <button onClick={onCollect} style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"8px 18px", borderRadius:9,
            background:`linear-gradient(135deg, ${C.gold}, #FFE033)`,
            border:"none", cursor:"pointer",
            fontSize:12, fontWeight:800, color:C.ink,
            boxShadow:`0 3px 12px rgba(244,196,0,0.30)`,
          }}>💳 Collect Payment</button>
        </div>
      </div>

      {/* Main payment cards grid */}
      <div style={{
        display:"grid",
        gridTemplateColumns: hasBank ? "auto 1fr" : "1fr",
        gap:14,
        alignItems:"start",
      }}>

        {/* UPI QR */}
        {hasUpi && panelCard(
          <>
            {panelLabel("Scan & Pay — UPI")}

            {/* QR */}
            <div style={{
              padding:10, background:C.docBg,
              borderRadius:10, border:`1px solid ${C.goldBorder}`,
              lineHeight:0, display:"inline-block",
              boxShadow:`0 2px 8px ${C.goldFaint}`,
              marginBottom:12,
            }}>
              <QRCodeCanvas
                value={upiLink}
                size={132}
                bgColor="#FFFFFF"
                fgColor={C.ink}
                level="M"
                includeMargin={false}
              />
            </div>

            <div style={{ fontSize:9, color:C.inkFaint, lineHeight:1.7, marginBottom:10 }}>
              GPay · PhonePe · Paytm · BHIM
              <br/>
              <span style={{fontSize:11, fontWeight:800, color:C.goldDark}}>
                {INR(balance)} pre-filled
              </span>
            </div>

            {/* UPI ID chip */}
            <div style={{
              display:"flex", alignItems:"center", gap:0,
              background:C.goldPale,
              border:`1px solid ${C.goldBorder}`,
              borderRadius:7, padding:"5px 9px",
              justifyContent:"space-between",
            }}>
              <span style={{fontSize:10.5, fontWeight:700, color:C.text, fontFamily:"'Courier New',monospace"}}>
                {school.upiId}
              </span>
              <CopyBtn value={school.upiId}/>
            </div>

            {/* Direct UPI link */}
            <a href={upiLink} style={{
              display:"block", marginTop:10,
              padding:"8px 0", borderRadius:8,
              background:C.goldLight, border:`1px solid ${C.goldBorder}`,
              textAlign:"center", textDecoration:"none",
              fontSize:11, fontWeight:700, color:C.goldDeep,
            }}>Open in Payment App</a>
          </>,
          { minWidth:200, textAlign:"center" }
        )}

        {/* Right column */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* Bank Transfer */}
          {hasBank && panelCard(
            <>
              {panelLabel("Bank Transfer")}
              {[
                { label:"Bank",         value:school.bankName },
                { label:"Account Name", value:school.accountName },
                { label:"Account No.",  value:school.accountNumber, mono:true, copy:true },
                { label:"IFSC Code",    value:school.ifscCode,      mono:true, copy:true },
                { label:"Branch",       value:school.branch },
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{
                  display:"flex", justifyContent:"space-between",
                  alignItems:"center", gap:8, padding:"6px 0",
                  borderBottom:`1px solid ${C.borderLight}`,
                }}>
                  <span style={{fontSize:8.5, fontWeight:700, color:C.inkFaint, textTransform:"uppercase", letterSpacing:"0.08em", flexShrink:0}}>
                    {r.label}
                  </span>
                  <div style={{display:"flex", alignItems:"center", gap:0}}>
                    <span style={{
                      fontSize:11.5, fontWeight:600, color:C.text,
                      fontFamily: r.mono ? "'Courier New',monospace" : "inherit",
                    }}>{r.value}</span>
                    {r.copy && <CopyBtn value={r.value}/>}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Cash / Cheque */}
          <div style={{
            padding:"16px 20px",
            background:C.goldPale,
            border:`1px solid ${C.goldBorder}`,
            borderRadius:14,
          }}>
            {panelLabel("Cash / Cheque")}
            <div style={{ fontSize:11, color:C.inkSoft, lineHeight:1.75, fontWeight:500 }}>
              {school.cashInstructions || "Pay at the school front desk during office hours."}
              {school.officeHours && (
                <><br/><span style={{fontWeight:700}}>{school.officeHours}</span></>
              )}
              {school.accountName && (
                <><br/><span style={{color:C.inkMuted}}>Cheques payable to: </span>
                <strong style={{color:C.text}}>{school.accountName}</strong></>
              )}
            </div>
          </div>

          {/* Share row */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{
              flex:1, minWidth:120,
              display:"flex", alignItems:"center", justifyContent:"center", gap:7,
              padding:"10px 14px", borderRadius:10,
              background:C.docBg, border:`1px solid ${C.border}`,
              textDecoration:"none", fontSize:12, fontWeight:700, color:C.inkSoft,
            }}>📲 WhatsApp Share</a>

            <button
              onClick={() => copyText(shareLink, setLinkCopied)}
              style={{
                flex:1, minWidth:120,
                display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                padding:"10px 14px", borderRadius:10,
                background: linkCopied ? C.goldLight : C.docBg,
                border:`1px solid ${linkCopied ? C.goldBorder : C.border}`,
                fontSize:12, fontWeight:700,
                color: linkCopied ? C.goldDeep : C.inkSoft,
                cursor:"pointer", transition:"all 0.15s",
              }}
            >{linkCopied ? "✓ Link Copied!" : "🔗 Copy Invoice Link"}</button>
          </div>
        </div>
      </div>

      {!hasUpi && !hasBank && (
        <div style={{
          marginTop:16, padding:"12px 16px", borderRadius:9,
          background:C.goldLight, border:`1px solid ${C.goldBorder}`,
          fontSize:11, color:C.goldDeep, fontWeight:600,
        }}>
          ⚙️ Payment details not configured.
          Go to <strong>Settings → Payment Settings</strong> to add UPI ID and bank details.
        </div>
      )}
    </div>
  );
}

/* ── Loading ──────────────────────────────────────────────────────── */
function LoadingState() {
  return (
    <div style={{minHeight:"100vh",background:C.pageBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:56,height:56,borderRadius:17,background:`linear-gradient(135deg,${C.gold},#FFE033)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,boxShadow:`0 8px 24px rgba(244,196,0,0.32)`}}>⭐</div>
      <div style={{fontSize:14,fontWeight:700,color:C.inkSoft}}>Loading invoice…</div>
      <div style={{display:"flex",gap:6}}>
        {[0,1,2].map(i => <div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.gold,animation:`yd-pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
      </div>
      <style>{`@keyframes yd-pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

/* ── Error ────────────────────────────────────────────────────────── */
function ErrorState({ msg, onBack }) {
  return (
    <div style={{minHeight:"100vh",background:C.pageBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <span style={{fontSize:44}}>😕</span>
      <div style={{fontSize:18,fontWeight:800,color:C.text}}>Invoice Not Found</div>
      <div style={{fontSize:13,color:C.inkMuted,maxWidth:340,textAlign:"center"}}>{msg || "The requested invoice could not be loaded."}</div>
      <button onClick={onBack} style={{marginTop:8,padding:"10px 24px",borderRadius:10,background:C.gold,color:C.ink,fontWeight:800,fontSize:13,border:"none",cursor:"pointer",boxShadow:`0 4px 14px rgba(244,196,0,0.38)`}}>← Go Back</button>
    </div>
  );
}

/* ── Top action bar ───────────────────────────────────────────────── */
function TopBar({ invoice, st, sName, onBack, onPrint, onDownload, exporting, onCollect, isPaid }) {
  return (
    <div className="yd-no-print" style={{
      background:"#FFFFFF", borderBottom:`1px solid ${C.border}`,
      padding:"0 24px", height:56,
      display:"flex", alignItems:"center", gap:12,
      position:"sticky", top:0, zIndex:50,
      boxShadow:`0 1px 10px rgba(0,0,0,0.06)`,
    }}>
      <button onClick={onBack} style={{background:C.sectionBg,border:`1px solid ${C.border}`,color:C.text,padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
        ← Back
      </button>

      <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${C.gold},#FFE033)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:C.ink,flexShrink:0}}>
        {initials(invoice.studentName || "YD")[0]}
      </div>

      <div style={{flex:1,display:"flex",alignItems:"center",gap:10,minWidth:0}}>
        <span style={{fontWeight:800,fontSize:14,color:C.text,fontFamily:"'Courier New',monospace"}}>#{invoice.invoiceNumber}</span>
        {sName && <span style={{fontSize:11,color:C.inkMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sName}</span>}
        <StatusPill st={st} size="sm"/>
      </div>

      <div style={{display:"flex",gap:8,flexShrink:0}}>
        {!isPaid && (
          <button onClick={onCollect} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",background:C.sectionBg,color:C.inkSoft,border:`1px solid ${C.border}`}}>
            💳 Collect
          </button>
        )}
        <button onClick={onPrint} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",background:C.sectionBg,color:C.inkSoft,border:`1px solid ${C.border}`}}>
          🖨 Print
        </button>
        <button onClick={onDownload} disabled={exporting} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:exporting?"not-allowed":"pointer",background:exporting?C.cardBg:`linear-gradient(135deg,${C.gold},#FFE033)`,color:C.ink,border:"none",opacity:exporting?0.6:1,boxShadow:exporting?"none":`0 3px 12px rgba(244,196,0,0.30)`}}>
          {exporting ? "⏳" : "⬇"} {exporting ? "Exporting…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function InvoiceView() {
  const { invoiceNumber } = useParams();
  const navigate          = useNavigate();
  const invoiceRef        = useRef(null);   /* captures printable doc only */

  const [invoice,       setInvoice      ] = useState(null);
  const [student,       setStudent      ] = useState(null);
  const [payments,      setPayments     ] = useState([]);
  const [school,        setSchool       ] = useState(DEFAULT_SCHOOL);
  const [loading,       setLoading      ] = useState(true);
  const [error,         setError        ] = useState("");
  const [exporting,         setExporting        ] = useState(false);
  const [payDrawerOpen,     setPayDrawerOpen     ] = useState(false);
  const [collectDrawerOpen, setCollectDrawerOpen ] = useState(false);

  /* ── Data loading ─────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError("");
        const inv = await get(`/invoice/${encodeURIComponent(invoiceNumber)}`);
        if (!inv || inv.error || !inv.invoiceNumber) { setError("Invoice not found or access denied."); return; }
        if (!cancelled) setInvoice(inv);

        const [stuRes, payRes, setRes] = await Promise.allSettled([
          inv.studentId ? get(`/students/${encodeURIComponent(inv.studentId)}`) : Promise.resolve(null),
          get(`/api/payments?invoiceNumber=${encodeURIComponent(invoiceNumber)}`),
          get("/api/settings"),
        ]);
        if (cancelled) return;

        if (stuRes.status === "fulfilled" && stuRes.value) {
          const s = stuRes.value; setStudent(s.student || s);
        }
        if (payRes.status === "fulfilled") {
          const pd = payRes.value;
          setPayments(Array.isArray(pd) ? pd : (pd?.payments || []));
        }
        if (setRes.status === "fulfilled" && setRes.value) {
          const s = setRes.value, sc = s?.school || {}, br = s?.branding || {}, pay = s?.payment || {};
          setSchool(prev => ({
            ...prev,
            schoolName:      br.reportHeader || sc.name        || prev.schoolName,
            branchName:      sc.tagline      || sc.branchName   || prev.branchName,
            address:         sc.address      || prev.address,
            phone:           sc.phone        || prev.phone,
            email:           sc.email        || prev.email,
            website:         sc.website      || prev.website,
            logoUrl:         br.logoUrl      || sc.logoUrl      || prev.logoUrl,
            faviconUrl:      br.faviconUrl   || sc.faviconUrl   || prev.faviconUrl,
            gstNumber:       pay.gstNumber   || sc.gstNumber    || prev.gstNumber,
            upiId:           pay.upiId         || prev.upiId,
            bankName:        pay.bankName       || prev.bankName,
            accountName:     pay.accountName    || prev.accountName,
            accountNumber:   pay.accountNumber  || prev.accountNumber,
            ifscCode:        pay.ifscCode       || prev.ifscCode,
            branch:          pay.branch         || prev.branch,
            cashInstructions: pay.cashInstructions || prev.cashInstructions,
            officeHours:     pay.officeHours    || prev.officeHours,
          }));
        }
      } catch(e) {
        if (!cancelled) setError(e?.response?.data?.error || e.message || "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceNumber]);

  /* ── After PaymentCollectDrawer saves ──────────────────────────── */
  function handlePaymentSaved(savedPayment, updatedInv) {
    if (updatedInv) setInvoice(prev => ({...prev, ...updatedInv}));
    if (savedPayment) setPayments(prev => [savedPayment, ...prev]);
  }

  /* ── PDF export — captures invoiceRef (printable doc only) ────── */
  const downloadPDF = useCallback(async () => {
    if (!invoiceRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale:2.5, useCORS:true, allowTaint:true,
        backgroundColor:"#FDFCF9", logging:false, imageTimeout:8000,
      });
      const img  = canvas.toDataURL("image/png");
      const pdf  = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pdfW) / canvas.width;
      /* Fixed pagination — 0.5 mm tolerance prevents blank trailing pages */
      const totalPages = Math.max(1, Math.ceil((imgH - 0.5) / pdfH));
      for (let pg = 0; pg < totalPages; pg++) {
        if (pg > 0) pdf.addPage();
        pdf.addImage(img, "PNG", 0, -(pg * pdfH), pdfW, imgH);
      }
      pdf.save(`Invoice-${invoiceNumber}.pdf`);
    } catch(e) {
      console.error("[PDF]", e);
      alert("PDF export failed. Please use Print instead.");
    } finally { setExporting(false); }
  }, [invoiceNumber, exporting]);

  const handlePrint = useCallback(() => window.print(), []);

  /* ── Guards ───────────────────────────────────────────────────── */
  if (loading)           return <LoadingState/>;
  if (error || !invoice) return <ErrorState msg={error} onBack={() => navigate(-1)}/>;

  /* ── Derived data ─────────────────────────────────────────────── */
  const st        = STATUS[invoice.status] || STATUS.Pending;
  const totalPaid = payments.reduce((s, p) => s + parseCurrency(p.amount), 0);
  const balance   = parseCurrency(invoice.totalAmount) - totalPaid;

  const S           = student || {};
  const sName       = S.Student_Name     || S.studentName    || invoice.studentName  || "—";
  const sId         = S.Student_ID       || S.studentId      || invoice.studentId    || "—";
  const sClass      = S.Class            || S.class          || invoice.class        || "—";
  const sDiv        = S.Division         || S.division       || "";
  const sCenter     = S.center           || S.Center         || invoice.centerId     || "—";
  const sPhoto      = S.Profile_Image    || S.profileImage   || "";
  const sAdmNo      = S.Admission_Number || S.admissionNumber|| "";
  const fatherName  = S.father_name      || S.fatherName     || "";
  const fatherPhone = S.father_whatsapp  || S.fatherWhatsapp || invoice.fatherWhatsApp || "";
  const motherName  = S.mother_name      || S.motherName     || "";
  const motherPhone = S.mother_whatsapp  || S.motherWhatsapp || invoice.motherWhatsApp || "";
  const parentEmail = S.father_email     || S.mother_email   || S.email              || "";
  const emergName   = S.emergency_contact_name  || S.emergencyContactName  || "";
  const emergPhone  = S.emergency_contact_phone || S.emergencyContactPhone || "";
  const yr          = invoice.invoiceDate ? new Date(invoice.invoiceDate).getFullYear() : new Date().getFullYear();
  const academicYear = `${yr}–${String(yr+1).slice(2)}`;

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div style={{
      fontFamily:"'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      background:C.pageBg, minHeight:"100vh",
    }}>
      <style>{PRINT_CSS}</style>

      {/* Sticky top bar — hidden in print */}
      <TopBar
        invoice={invoice} st={st} sName={sName}
        onBack={() => navigate(-1)}
        onPrint={handlePrint}
        onDownload={downloadPDF}
        exporting={exporting}
        onCollect={() => setCollectDrawerOpen(true)}
        isPaid={balance <= 0}
      />

      {/* UPI/bank info drawer — shows payment options to parent */}
      <PaymentDrawer
        open={payDrawerOpen}
        invoice={invoice}
        payments={payments}
        onClose={() => setPayDrawerOpen(false)}
        onRecord={() => { setPayDrawerOpen(false); setCollectDrawerOpen(true); }}
      />

      {/* Premium payment collection + receipt drawer */}
      <PaymentCollectDrawer
        open={collectDrawerOpen}
        invoice={invoice}
        student={student}
        payments={payments}
        school={school}
        onClose={() => setCollectDrawerOpen(false)}
        onSaved={handlePaymentSaved}
      />

      {/* ── Page wrapper ── */}
      <div className="inv-page" style={{ padding:"32px 20px 80px" }}>

        {/*
          ┌─────────────────────────────────────────────────┐
          │  PRINTABLE INVOICE DOCUMENT                     │
          │  • Captured by html2canvas for PDF export       │
          │  • Contains ONLY invoice content                │
          │  • No QR codes, no payment widgets              │
          │  • Beautiful when printed on A4                 │
          └─────────────────────────────────────────────────┘
        */}
        <div
          ref={invoiceRef}
          className="inv-doc"
          style={{
            maxWidth:860, margin:"0 auto",
            background:C.docBg,
            borderRadius:16, overflow:"hidden",
            boxShadow:`
              0 0 0 1px rgba(0,0,0,0.05),
              0 4px 24px rgba(0,0,0,0.07),
              0 16px 64px rgba(0,0,0,0.06)
            `,
          }}
        >
          <InvHeader school={school} invoice={invoice} st={st}/>

          <BillToSection
            photo={sPhoto} name={sName} studentId={sId} admNo={sAdmNo}
            cls={sClass} division={sDiv} center={sCenter} academicYear={academicYear}
            fatherName={fatherName} fatherPhone={fatherPhone}
            motherName={motherName} motherPhone={motherPhone}
            email={parentEmail} emergencyName={emergName} emergencyPhone={emergPhone}
          />

          <FeeAndTotals invoice={invoice}/>

          <NotesAndPolicies invoice={invoice} school={school}/>

          <InvFooter school={school} invoiceNumber={invoice.invoiceNumber}/>
        </div>

        {/*
          ┌─────────────────────────────────────────────────┐
          │  PAYMENT RECEIPTS — digital only, never in PDF  │
          │  Shows receipts generated from this invoice.    │
          │  Belongs here, not inside the invoice document. │
          └─────────────────────────────────────────────────┘
        */}
        {payments.length > 0 && (
          <div className="yd-no-print" style={{ maxWidth:860, margin:"16px auto 0", padding:"0 20px" }}>
            <PaymentHistorySection payments={payments}/>
          </div>
        )}

        {/*
          ┌─────────────────────────────────────────────────┐
          │  DIGITAL PAYMENT PANEL                          │
          │  • yd-no-print → never in PDF or print         │
          │  • QR code, UPI, bank transfer, WhatsApp        │
          │  • Interactive copy buttons                     │
          │  • Mobile-friendly payment experience           │
          └─────────────────────────────────────────────────┘
        */}
        <DigitalPaymentPanel
          invoice={invoice}
          school={school}
          payments={payments}
          balance={balance}
          onCollect={() => setCollectDrawerOpen(true)}
        />

      </div>
    </div>
  );
}
