/**
 * PaymentCollectDrawer.jsx — Premium Payment Recording Experience
 * ────────────────────────────────────────────────────────────────
 * Full-screen overlay for recording fee payments.
 * Three phases: FORM → SAVING → RECEIPT
 *
 * Props:
 *   open          bool
 *   invoice       object   — invoice record
 *   student       object   — student record (optional, enriches display)
 *   payments      array    — existing payments
 *   school        object   — school/payment settings
 *   onClose       fn
 *   onSaved       fn(payment, updatedInvoice)  — called after save
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate }  from "react-router-dom";
import { api }          from "../services/authService";
import { parseCurrency } from "../utils/currency";
import jsPDF            from "jspdf";
import html2canvas      from "html2canvas";

/* ═══════════════════════════════════════════════════════════
   FORM PALETTE — Invoice / Yellow Dot gold  (form UI only)
   ═══════════════════════════════════════════════════════════ */
const C = {
  gold:       "#F4C400", goldDark:   "#C9A000", goldDeep:  "#9A7600",
  goldLight:  "#FFF8D0", goldPale:   "#FDFBF2", goldBorder:"#DEC840",
  goldFaint:  "rgba(244,196,0,0.10)",
  ink:        "#1C1917", inkMid:     "#292524", inkSoft:   "#3C3835",
  inkMuted:   "#6B6560", inkFaint:   "#9C9590",
  cream:      "#FAF8F3", creamDark:  "#F4EFE4", creamBorder:"#DDD5C0",
  docBg:      "#FDFCF9", sectionBg:  "#F8F6F1", cardBg:    "#F3F1EB",
  pageBg:     "#F0EEE9", rowAlt:     "#F7F5F0",
  text:       "#0F0D0B", textSoft:   "#3C3835", textMuted:  "#6B6560",
  border:     "#E2DED8", borderLight:"#EDEBE5",
  errRed:     "#DC2626", errRedLight:"#FEF2F2", errRedBorder:"#FECACA",
};

/* STATUS pills used in the form's live-preview panel */
const STATUS = {
  Paid:      { bg:"#FFF8D0",              fg:"#7A5C00", border:"#DEC840",              dot:"#C9A000" },
  Pending:   { bg:"#FAF8F3",              fg:"#3C3835", border:"#C8B87A",              dot:"#B8940A" },
  Partial:   { bg:"rgba(244,196,0,0.14)", fg:"#7A5C00", border:"rgba(201,160,0,0.32)", dot:"#F4C400" },
  Overdue:   { bg:"#1C1917",              fg:"#F4C400", border:"rgba(244,196,0,0.22)", dot:"#F4C400" },
  Cancelled: { bg:"#F5F3EE",             fg:"#6B6560", border:"#E2DED8",              dot:"#9C9590" },
};

/* ═══════════════════════════════════════════════════════════
   RECEIPT PALETTE — Warm Yellow Dot brand tones only
   ═══════════════════════════════════════════════════════════ */
const R = {
  docBg:       "#FFFDF6",
  pageBg:      "#F5F0E2",
  sectionBg:   "#FAF6EA",
  // Warm olive-gold — replaces sage green for "Paid" accents
  sage:        "#8b7a28",
  sageDark:    "#6a5c18",
  sageDeep:    "#4a4014",
  sageLight:   "#f8f4d8",
  sagePale:    "#f8f4d8",
  sageBorder:  "#d4bc58",
  sageMid:     "#b09830",
  sageFaint:   "rgba(176,152,48,0.08)",
  // Amber — partial payments
  amber:       "#B45309",
  amberLight:  "#FFFBEB",
  amberBorder: "#FDE68A",
  amberDot:    "#F59E0B",
  // Gold — brand primary
  gold:        "#F4C400", goldDark:"#C9A000", goldBorder:"#DEC840",
  // Ink — warm charcoal, not cool gray
  border:      "#ECE7D8", borderLight:"#F5F0E2",
  ink:         "#1f1a17", inkSoft:"#4a3f2a", inkMuted:"#8b7d65", inkFaint:"#a3957e",
  text:        "#1f1a17", textSoft:"#4a3f2a",
  errRed:      "#c0402a", errRedLight:"#fee8e2", errRedBorder:"#e0a898",
};

/* STATUS pills used in ReceiptDoc */
const R_STATUS = {
  Paid:    { bg:R.sageLight,  fg:R.sageDeep,  border:R.sageBorder,  dot:R.sage },
  Partial: { bg:R.amberLight, fg:R.amber,      border:R.amberBorder, dot:R.amberDot },
  Pending: { bg:"#F9FAFB",    fg:"#374151",    border:"#E5E7EB",     dot:"#9CA3AF" },
};

const MODES = ["UPI","Cash","Bank Transfer","Cheque","Card","Online"];

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */
function INR(v) {
  const n = parseCurrency(v);
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits:0, maximumFractionDigits:2 });
}
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function fmtTime(s) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
}
function todayISO() { return new Date().toISOString().slice(0,10); }
function initials(name="") {
  return name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()||"YD";
}
function computeStatus(total, paid) {
  if (paid <= 0)             return "Pending";
  if (paid >= total - 0.01)  return "Paid";
  return "Partial";
}
async function copyText(text, set) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const el = Object.assign(document.createElement("textarea"),{value:text});
      document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    set(true); setTimeout(()=>set(false),2200);
  } catch {}
}

/**
 * Generate a display-safe receipt number when backend doesn't return one.
 * Format: RCPT-YYYYMM-NNNN  (e.g. RCPT-202605-0001)
 */
function genReceiptNumber(paymentId) {
  const d   = new Date();
  const ym  = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}`;
  const raw = String(paymentId || Date.now());
  const seq = raw.replace(/\D/g,"").slice(-4).padStart(4,"0");
  return `RCPT-${ym}-${seq}`;
}
function displayRcptNum(receipt) {
  if (receipt?.receiptNumber) return receipt.receiptNumber;
  const d   = new Date(receipt?.paymentDate || receipt?.createdAt || Date.now());
  const ym  = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}`;
  const raw = String(receipt?.paymentId || receipt?.id || Date.now());
  const seq = raw.replace(/\D/g,"").slice(-4).padStart(4,"0");
  return `RCPT-${ym}-${seq}`;
}

/* ═══════════════════════════════════════════════════════════
   RECEIPT DOCUMENT  (ref captured for PDF)
   Uses R (sage green) palette — completely separate from invoice.
   ═══════════════════════════════════════════════════════════ */
function ReceiptDoc({ receipt, school, invoice, student, payments }) {
  const logoSrc = school.faviconUrl || school.logoUrl || "/favicon.ico";
  const [logoErr, setLogoErr] = useState(false);
  const showLogo = !!logoSrc && !logoErr;
  const inits    = initials(school.schoolName || "YD");
  const total    = parseCurrency(invoice.totalAmount);
  const prevPaidSum = payments.reduce((s,p)=>s+parseCurrency(p.amount),0);
  const allPaid  = prevPaidSum + parseCurrency(receipt.amount);
  const remaining = Math.max(0, total - allPaid);
  const isPaid   = remaining <= 0;
  const isPartial = !isPaid && allPaid > 0;

  const rStatusKey = isPaid ? "Paid" : isPartial ? "Partial" : "Pending";
  const rst = R_STATUS[rStatusKey];

  /* hero banner colours */
  const heroBg     = isPaid
    ? `linear-gradient(135deg,${R.sage} 0%,${R.sageDark} 100%)`
    : `linear-gradient(135deg,#92400E 0%,#B45309 100%)`; // amber gradient for partial
  const heroGlow   = isPaid
    ? "rgba(176,152,48,0.15)"
    : "rgba(245,158,11,0.15)";
  const heroIcon   = isPaid ? "✓" : "◑";
  const heroIconBg = isPaid
    ? "rgba(255,255,255,0.18)"
    : "rgba(255,255,255,0.18)";
  const heroLabel  = isPaid ? "Payment Received Successfully" : "Partial Payment Recorded";

  return (
    <div style={{
      fontFamily:"'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      background: R.docBg, width:"100%",
    }}>
      {/* Sage-green top rule */}
      <div style={{height:4, background:`linear-gradient(90deg,${R.sageDark},${R.sage} 40%,${R.sageMid} 55%,${R.sage} 80%,${R.sageDark})`}}/>

      {/* ── HEADER — Yellow Dot brand gradient ── */}
      <div style={{
        padding:"22px 44px 18px",
        background:[
          "radial-gradient(circle at top right, rgba(255,255,255,0.55) 0%, transparent 35%)",
          "linear-gradient(155deg, #fff4c2 0%, #ffe78a 45%, #ffd43b 100%)",
        ].join(","),
        position:"relative",
        boxShadow:"inset 0 -2px 0 rgba(180,140,0,0.18), 0 2px 12px rgba(180,140,0,0.08)",
      }}>
        {/* Top soft highlight line */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,pointerEvents:"none",
          background:"linear-gradient(90deg,rgba(255,255,255,0.70) 0%,rgba(255,255,255,0.30) 60%,transparent 100%)"}}/>


        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:24,position:"relative"}}>

          {/* School identity */}
          <div style={{display:"flex",gap:13,alignItems:"flex-start"}}>
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
                ? <div style={{position:"absolute",inset:6,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <img src={logoSrc} alt="" onError={()=>setLogoErr(true)}
                      style={{maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto",objectFit:"contain",display:"block"}}/>
                  </div>
                : <span style={{fontSize:17,fontWeight:900,color:"#3D2E00",userSelect:"none"}}>{inits}</span>
              }
            </div>
            <div>
              <div style={{fontSize:17,fontWeight:800,color:"#1C1410",letterSpacing:"-0.025em",lineHeight:1.1}}>
                {school.schoolName}
              </div>
              {/* Gold accent line */}
              <div style={{height:2,marginTop:4,marginBottom:4,width:52,borderRadius:2,background:"linear-gradient(90deg,#C9A000,#DEC840,transparent)"}}/>
              {school.branchName && (
                <div style={{fontSize:7.5,fontWeight:700,color:"#b8860b",textTransform:"uppercase",letterSpacing:"0.13em"}}>
                  {school.branchName}
                </div>
              )}
              <div style={{fontSize:8,color:"#7A6A50",marginTop:4,lineHeight:1.75}}>
                {school.address && <div>{school.address}</div>}
                <div>{[school.phone,school.email].filter(Boolean).join("  ·  ")}</div>
                {school.gstNumber && <div style={{fontWeight:600,color:"#5A4E30"}}>GSTIN: {school.gstNumber}</div>}
              </div>
            </div>
          </div>

          {/* Receipt identity */}
          <div style={{textAlign:"right",flexShrink:0}}>
            {/* Dynamic PAID / PARTIAL badge — gold gradient */}
            <div style={{
              display:"inline-flex",alignItems:"center",gap:5,marginBottom:7,
              padding:"4px 13px",borderRadius:6,
              background: isPaid
                ? "linear-gradient(135deg,#fff6cc 0%,#ffe066 100%)"
                : "rgba(180,83,9,0.08)",
              border:`1.5px solid ${isPaid ? "rgba(180,140,0,0.35)" : "#FDE68A"}`,
              boxShadow: isPaid ? "0 1px 4px rgba(180,140,0,0.18)" : "none",
            }}>
              <span style={{
                fontSize:6.5,fontWeight:800,letterSpacing:"0.22em",textTransform:"uppercase",
                color:isPaid ? "#7A5C00" : R.amber,
              }}>{isPaid ? "✦  PAID RECEIPT" : "◑  PARTIAL PAYMENT"}</span>
            </div>
            <div style={{
              display:"block",fontSize:22,fontWeight:800,color:"#1C1410",
              fontFamily:"'Courier New',monospace",letterSpacing:"0.04em",lineHeight:1,marginBottom:6,
            }}>{displayRcptNum(receipt)}</div>
            <div style={{fontSize:8,lineHeight:1.85}}>
              <div style={{fontWeight:600,color:"#5A4E30"}}>Payment Date: {fmtDate(receipt.paymentDate)}</div>
              <div style={{color:"#7A6A50"}}>Invoice Ref: <span style={{fontFamily:"'Courier New',monospace",color:"#5A4E30"}}>{invoice.invoiceNumber}</span></div>
            </div>
          </div>
        </div>
      </div>
      {/* Golden whisper divider */}
      <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(180,140,0,0.20) 20%,rgba(180,140,0,0.20) 80%,transparent)"}}/>

      {/* ── SUCCESS HERO BANNER ── */}
      <div style={{padding:"10px 44px 0"}}>
        <div style={{
          background:heroBg,
          borderRadius:16, padding:"22px 28px",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          flexWrap:"wrap", gap:16,
          position:"relative", overflow:"hidden",
        }}>
          {/* Glow orb */}
          <div style={{position:"absolute",top:-30,right:-30,width:160,height:160,borderRadius:"50%",background:heroGlow,pointerEvents:"none"}}/>

          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{
              width:44,height:44,borderRadius:13,flexShrink:0,
              background:heroIconBg,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:22,fontWeight:900,color:"#FFFFFF",
            }}>{heroIcon}</div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.65)",textTransform:"uppercase",letterSpacing:"0.11em",marginBottom:3}}>
                {heroLabel}
              </div>
              <div style={{fontSize:32,fontWeight:900,color:"#FFFFFF",fontFamily:"'Courier New',monospace",letterSpacing:"-0.02em",lineHeight:1}}>
                {INR(receipt.amount)}
              </div>
              <div style={{marginTop:6,fontSize:10,color:"rgba(255,255,255,0.55)"}}>
                {fmtDate(receipt.paymentDate)}{fmtTime(receipt.createdAt) ? ` · ${fmtTime(receipt.createdAt)}` : ""}
              </div>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"flex-end"}}>
            <div style={{
              background:"rgba(255,255,255,0.18)", color:"#FFFFFF", borderRadius:8,
              padding:"6px 14px", fontSize:12, fontWeight:800,
              letterSpacing:"0.04em", border:"1px solid rgba(255,255,255,0.25)",
            }}>{receipt.paymentMode}</div>
            {receipt.transactionId && (
              <div style={{
                background:"rgba(0,0,0,0.15)", borderRadius:6,
                padding:"5px 12px", fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.80)",
                fontFamily:"'Courier New',monospace",
              }}>UTR: {receipt.transactionId}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── STUDENT + PARENT ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:`1px solid ${R.border}`,borderTop:`1px solid ${R.border}`,background:R.sectionBg,marginTop:12}}>
        <div style={{padding:"12px 44px",borderRight:`1px solid ${R.border}`}}>
          <RLabel>Student</RLabel>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{
              width:34,height:34,borderRadius:"50%",flexShrink:0,
              background:`linear-gradient(135deg,${R.sage},${R.sageMid})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:12,fontWeight:800,color:"#FFFFFF",
              boxShadow:`0 0 0 3px rgba(22,163,74,0.15), 0 2px 8px rgba(22,163,74,0.22)`,
            }}>{initials(receipt.studentName)}</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:R.text}}>{receipt.studentName}</div>
              <div style={{fontSize:8.5,color:R.inkMuted,marginTop:2}}>{receipt.class || invoice.class || "—"}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <RField label="Student ID"    value={receipt.studentId || invoice.studentId}/>
            <RField label="Academic Year" value={invoice.invoiceDate ? `${new Date(invoice.invoiceDate).getFullYear()}–${String(new Date(invoice.invoiceDate).getFullYear()+1).slice(2)}` : "—"}/>
          </div>
        </div>
        <div style={{padding:"12px 44px"}}>
          <RLabel>Parent / Guardian</RLabel>
          <div style={{
            padding:"8px 12px",borderRadius:9,
            background:R.docBg,border:`1px solid rgba(0,0,0,0.04)`,
            boxShadow:"0 1px 4px rgba(0,0,0,0.03)",
          }}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
              {(student?.father_name||student?.fatherName) && <RField label="Father" value={student?.father_name||student?.fatherName}/>}
              {(student?.father_whatsapp||student?.fatherWhatsapp||invoice.fatherWhatsApp) &&
                <RField label="Father Mobile" value={student?.father_whatsapp||student?.fatherWhatsapp||invoice.fatherWhatsApp}/>}
              {(student?.mother_name||student?.motherName) && <RField label="Mother" value={student?.mother_name||student?.motherName}/>}
              {(student?.mother_whatsapp||student?.motherWhatsapp||invoice.motherWhatsApp) &&
                <RField label="Mother Mobile" value={student?.mother_whatsapp||student?.motherWhatsapp||invoice.motherWhatsApp}/>}
            </div>
          </div>
        </div>
      </div>

      {/* ── PAYMENT DETAILS GRID ── */}
      <div style={{padding:"10px 44px",borderBottom:`1px solid ${R.border}`}}>
        <RLabel>Payment Details</RLabel>
        <div style={{background:"#F8FAFC",borderRadius:10,border:`1px solid ${R.borderLight}`,padding:"10px 14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 20px"}}>
            <RField label="Invoice Number"    value={invoice.invoiceNumber} mono/>
            <RField label="Invoice Total"     value={INR(total)}/>
            <RField label="Previously Paid"   value={INR(prevPaidSum)}/>
            <RField label="This Payment"      value={INR(receipt.amount)} bold/>
            <RField label="Remaining Balance" value={INR(remaining)} bold accent={remaining<=0}/>
            <RField label="Received By"       value={receipt.staffName || "—"}/>
            {receipt.bankName && <RField label="Bank"  value={receipt.bankName}/>}
            {receipt.notes    && <RField label="Notes" value={receipt.notes} style={{gridColumn:"1/-1"}}/>}
          </div>
        </div>
      </div>

      {/* ── SIGNATURES ── */}
      <div style={{padding:"12px 44px 10px",background:R.sectionBg,borderBottom:`1px solid ${R.border}`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"flex-end",gap:20}}>
          <div style={{textAlign:"center"}}>
            <div style={{height:22,borderBottom:`1px solid rgba(0,0,0,0.10)`,marginBottom:5}}/>
            <div style={{fontSize:7,fontWeight:700,color:R.inkFaint,textTransform:"uppercase",letterSpacing:"0.14em"}}>Authorised Signatory</div>
            <div style={{fontSize:9,fontWeight:600,color:R.inkMuted,marginTop:2}}>{school.schoolName}</div>
          </div>
          <div style={{textAlign:"center",padding:"0 16px"}}>
            <div style={{
              width:48,height:48,borderRadius:"50%",margin:"0 auto",
              border:`1.5px dashed ${R.sageBorder}`,
              background:`radial-gradient(circle at 40% 35%,${R.sagePale},${R.docBg} 70%)`,
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              boxShadow:`0 0 0 3px ${R.sageFaint}`,
              gap:2,
            }}>
              <div style={{fontSize:7,fontWeight:800,color:R.sage,textTransform:"uppercase",letterSpacing:"0.16em"}}>SEAL</div>
              <div style={{width:18,height:0.75,background:R.sageBorder}}/>
              <div style={{fontSize:5,color:R.inkFaint,textTransform:"uppercase",letterSpacing:"0.12em"}}>OFFICIAL</div>
            </div>
            <div style={{fontSize:6.5,color:R.inkFaint,marginTop:3,textTransform:"uppercase",letterSpacing:"0.10em",fontWeight:600}}>School Seal</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{height:22,borderBottom:`1px solid rgba(0,0,0,0.10)`,marginBottom:5}}/>
            <div style={{fontSize:7,fontWeight:700,color:R.inkFaint,textTransform:"uppercase",letterSpacing:"0.14em"}}>Parent / Guardian</div>
            <div style={{fontSize:9,fontWeight:600,color:R.inkMuted,marginTop:2}}>Received &amp; Acknowledged</div>
          </div>
        </div>
      </div>

      {/* ── FOOTER — Yellow Dot brand gradient ── */}
      <div style={{
        padding:"18px 44px 22px",
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
          position:"absolute",top:0,left:0,right:0,height:2,
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.50) 40%,rgba(255,255,255,0.50) 60%,transparent)",
        }}/>
        <div style={{textAlign:"center",position:"relative"}}>
          {/* Thank-you headline */}
          <div style={{
            fontSize:11,fontWeight:700,color:"#2b2b2b",
            letterSpacing:"0.005em",lineHeight:1.4,
            display:"flex",alignItems:"center",justifyContent:"center",gap:5,
          }}>
            <span>Thank you for choosing</span>
            <span style={{fontWeight:800,color:"#1a1400"}}>{school.schoolName}</span>
            <span style={{fontSize:13}}>✨</span>
          </div>
          {/* Warm dot-separator */}
          <div style={{
            display:"flex",alignItems:"center",justifyContent:"center",
            gap:6,marginTop:8,marginBottom:8,
          }}>
            <div style={{height:1,width:44,background:"linear-gradient(90deg,transparent,rgba(100,70,0,0.25))"}}/>
            <div style={{width:3.5,height:3.5,borderRadius:"50%",background:"rgba(80,55,0,0.40)"}}/>
            <div style={{width:3.5,height:3.5,borderRadius:"50%",background:"rgba(80,55,0,0.20)"}}/>
            <div style={{width:3.5,height:3.5,borderRadius:"50%",background:"rgba(80,55,0,0.40)"}}/>
            <div style={{height:1,width:44,background:"linear-gradient(270deg,transparent,rgba(100,70,0,0.25))"}}/>
          </div>
          {/* Support contact */}
          {(school.phone||school.email) && (
            <div style={{fontSize:8,lineHeight:2,marginBottom:5}}>
              <span style={{fontWeight:600,color:"#3d3000",marginRight:5}}>For support:</span>
              {school.phone && <span style={{color:"#4a3c00"}}>{school.phone}</span>}
              {school.phone && school.email && <span style={{margin:"0 8px",color:"rgba(60,45,0,0.30)"}}>·</span>}
              {school.email && <span style={{color:"#4a3c00"}}>{school.email}</span>}
            </div>
          )}
          {/* Receipt number — dark-on-gold subtle */}
          <div style={{
            fontSize:6.5,letterSpacing:"0.08em",
            color:"rgba(40,28,0,0.40)",
            fontFamily:"'Courier New',monospace",
          }}>
            digitally generated payment receipt · {displayRcptNum(receipt)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Receipt sub-components (use R palette) ─────────────────── */
function RLabel({ children }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
      <div style={{width:2.5,height:10,borderRadius:2,background:R.sage,flexShrink:0}}/>
      <span style={{fontSize:7.5,fontWeight:800,color:R.inkFaint,textTransform:"uppercase",letterSpacing:"0.13em"}}>{children}</span>
    </div>
  );
}
function RField({ label, value, mono, bold, accent, style={} }) {
  return (
    <div style={{marginBottom:8,...style}}>
      <div style={{fontSize:7,fontWeight:700,color:R.inkFaint,textTransform:"uppercase",letterSpacing:"0.10em",marginBottom:2}}>{label}</div>
      <div style={{
        fontSize:bold?12:11, fontWeight:bold?700:500,
        color: accent ? R.sageDeep : R.text,
        fontFamily:mono?"'Courier New',monospace":"inherit", lineHeight:1.45,
      }}>{value||"—"}</div>
    </div>
  );
}
function RStatusPill({ rst, label, size="md" }) {
  const sz = size==="sm"?{px:"4px 9px",fs:9,dot:5}:{px:"5px 12px",fs:10.5,dot:6};
  const displayLabel = label==="Paid"?"Paid":label==="Partial"?"Partial":label==="Pending"?"Pending":label||"—";
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:4,
      background:rst.bg,color:rst.fg,border:`1px solid ${rst.border}`,
      padding:sz.px,borderRadius:999,
      fontSize:sz.fs,fontWeight:800,letterSpacing:"0.05em",
    }}>
      <span style={{width:sz.dot,height:sz.dot,borderRadius:"50%",background:rst.dot,flexShrink:0}}/>
      {displayLabel}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   RECEIPT MODAL  (post-save)
   ═══════════════════════════════════════════════════════════ */
function ReceiptModal({ receipt, school, invoice, student, payments, onClose, navigate }) {
  const receiptRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  /* PDF export */
  const downloadPDF = useCallback(async () => {
    if (!receiptRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale:2.5, useCORS:true, allowTaint:true,
        backgroundColor:C.docBg, logging:false, imageTimeout:8000,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pdfW) / canvas.width;
      /* Fixed pagination — 0.5 mm tolerance prevents blank trailing pages */
      const totalPages = Math.max(1, Math.ceil((imgH - 0.5) / pdfH));
      for (let pg = 0; pg < totalPages; pg++) {
        if (pg > 0) pdf.addPage();
        pdf.addImage(img, "PNG", 0, -(pg * pdfH), pdfW, imgH);
      }
      pdf.save(`Receipt-${displayRcptNum(receipt)}.pdf`);
    } catch(e) { console.error("[PDF]",e); }
    finally { setExporting(false); }
  },[receipt, exporting]);

  /* WhatsApp share — premium, human-feel message */
  const total     = parseCurrency(invoice.totalAmount);
  const allPaid   = payments.reduce((s,p)=>s+parseCurrency(p.amount),0)+parseCurrency(receipt.amount);
  const remaining = Math.max(0, total - allPaid);
  const phone     = (invoice.fatherWhatsApp||invoice.motherWhatsApp||"").replace(/\D/g,"");
  const dialCode  = phone.length>=10?(phone.startsWith("91")?phone:`91${phone}`):"";

  const parentName  = (student?.father_name||student?.fatherName||student?.mother_name||student?.motherName||"Parent");
  const firstName   = parentName.split(" ")[0];
  const studentName = receipt.studentName||invoice.studentName||"—";

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
    `💰 Amount: *${INR(receipt.amount)}*`,
    `💳 Mode: *${receipt.paymentMode}*`,
    receipt.transactionId ? `🔢 UTR: ${receipt.transactionId}` : null,
    `📅 Date: ${fmtDate(receipt.paymentDate)}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    remaining > 0
      ? `⚠️ Balance Remaining: *${INR(remaining)}*`
      : `✅ Invoice fully settled — No balance due.`,
    ``,
    `📄 Invoice: ${invoice.invoiceNumber}`,
    receiptPageUrl ? `🔗 View Receipt: ${receiptPageUrl}` : null,
    ``,
    `Thank you for choosing ${school.schoolName}! 🌟`,
  ].filter(l => l !== null).join("\n");

  const waUrl = dialCode
    ? `https://wa.me/${dialCode}?text=${encodeURIComponent(waLines)}`
    : `https://wa.me/?text=${encodeURIComponent(waLines)}`;

  const rcptNum        = displayRcptNum(receipt);
  const receiptPageUrl = typeof window!=="undefined"
    ? `${window.location.origin}/receipt/${rcptNum}`
    : "";

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:700,
      display:"flex",flexDirection:"column",
      background:"rgba(10,20,12,0.88)",backdropFilter:"blur(8px)",
    }}>
      {/* ── Top bar — sage green identity ── */}
      <div style={{
        flexShrink:0,
        background:R.docBg,borderBottom:`1px solid ${R.border}`,
        padding:"0 24px",height:56,
        display:"flex",alignItems:"center",gap:12,
      }}>
        <div style={{
          width:32,height:32,borderRadius:9,flexShrink:0,
          background:`linear-gradient(135deg,${R.sage},${R.sageDark})`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:14,fontWeight:900,color:"#FFFFFF",
        }}>✓</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:800,color:R.text}}>Payment Recorded</div>
          <div style={{fontSize:11,color:R.inkMuted}}>
            {displayRcptNum(receipt)} · {INR(receipt.amount)} via {receipt.paymentMode}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{
            display:"flex",alignItems:"center",gap:6,
            padding:"7px 14px",borderRadius:8,
            background:"#F0FDF4",border:`1px solid ${R.sageBorder}`,
            textDecoration:"none",fontSize:12,fontWeight:700,color:R.sageDeep,
          }}>📲 WhatsApp</a>
          <button onClick={downloadPDF} disabled={exporting} style={{
            display:"flex",alignItems:"center",gap:6,
            padding:"7px 16px",borderRadius:8,fontSize:12,fontWeight:700,
            background:exporting?"#F3F4F6":`linear-gradient(135deg,${R.sage},${R.sageDark})`,
            color:exporting?R.inkMuted:"#FFFFFF",border:"none",
            cursor:exporting?"not-allowed":"pointer",
            opacity:exporting?0.6:1,
            boxShadow:exporting?"none":`0 3px 12px rgba(22,163,74,0.30)`,
          }}>
            {exporting?"⏳ Exporting…":"⬇ Download PDF"}
          </button>
          {rcptNum && (
            <button onClick={()=>navigate(`/receipt/${rcptNum}`)} style={{
              display:"flex",alignItems:"center",gap:6,
              padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,
              background:R.sectionBg,border:`1px solid ${R.border}`,
              color:R.inkSoft,cursor:"pointer",
            }}>↗ Full Page</button>
          )}
          <button onClick={onClose} style={{
            width:36,height:36,borderRadius:8,
            border:`1px solid ${R.border}`,background:R.sectionBg,
            cursor:"pointer",fontSize:16,color:R.inkMuted,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>✕</button>
        </div>
      </div>

      {/* ── Receipt scroll area ── */}
      <div style={{flex:1,overflow:"auto",padding:"32px 20px 60px"}}>
        <div style={{
          maxWidth:820,margin:"0 auto",
          borderRadius:16,overflow:"hidden",
          boxShadow:"0 0 0 1px rgba(0,0,0,0.06),0 8px 40px rgba(0,0,0,0.22)",
        }}>
          <div ref={receiptRef}>
            <ReceiptDoc
              receipt={receipt}
              school={school}
              invoice={invoice}
              student={student}
              payments={payments}
            />
          </div>
        </div>

        {/* Share row below receipt */}
        <div style={{maxWidth:820,margin:"16px auto 0",display:"flex",gap:10,flexWrap:"wrap"}}>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{
            flex:1,minWidth:160,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            padding:"12px 20px",borderRadius:12,
            background:"#25D366",textDecoration:"none",
            fontSize:13,fontWeight:700,color:"#FFFFFF",
            boxShadow:"0 4px 16px rgba(37,211,102,0.30)",
          }}>📲 Send Receipt on WhatsApp</a>
          <button onClick={()=>copyText(receiptPageUrl,setLinkCopied)} style={{
            flex:1,minWidth:160,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            padding:"12px 20px",borderRadius:12,
            background:linkCopied?R.sageLight:R.docBg,
            border:`1px solid ${linkCopied?R.sageBorder:R.border}`,
            fontSize:13,fontWeight:700,color:linkCopied?R.sageDeep:R.inkSoft,
            cursor:"pointer",transition:"all 0.15s",
          }}>{linkCopied?"✓ Link Copied!":"🔗 Copy Receipt Link"}</button>
          <button onClick={onClose} style={{
            flex:1,minWidth:160,display:"flex",alignItems:"center",justifyContent:"center",
            padding:"12px 20px",borderRadius:12,
            background:R.docBg,border:`1px solid ${R.border}`,
            fontSize:13,fontWeight:700,color:R.inkSoft,cursor:"pointer",
          }}>← Back to Invoice</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN: PAYMENT COLLECT DRAWER
   ═══════════════════════════════════════════════════════════ */
export default function PaymentCollectDrawer({
  open, invoice, student, payments=[], school={}, onClose, onSaved,
}) {
  const navigate = useNavigate();

  /* ── Phase: "form" | "saving" | "receipt" ── */
  const [phase,   setPhase  ] = useState("form");
  const [receipt, setReceipt] = useState(null);
  const [errs,    setErrs   ] = useState({});

  /* ── Form state ── */
  const [form, setForm] = useState({
    amount:        "",
    paymentDate:   todayISO(),
    paymentMode:   "UPI",
    transactionId: "",
    bankName:      "",
    staffName:     "Staff",
    notes:         "",
    hasLateFee:    false,
    lateFeeAmount: "",
    hasDiscount:   false,
    discountAmt:   "",
  });

  const set = useCallback((k,v) => {
    setForm(f=>({...f,[k]:v}));
    setErrs(e=>({...e,[k]:""}));
  },[]);

  /* ── Reset when opened ── */
  useEffect(()=>{
    if (open) {
      setPhase("form");
      setReceipt(null);
      setErrs({});
      setForm({
        amount:        "",
        paymentDate:   todayISO(),
        paymentMode:   "UPI",
        transactionId: "",
        bankName:      school.bankName||"",
        staffName:     "Staff",
        notes:         "",
        hasLateFee:    false,
        lateFeeAmount: "",
        hasDiscount:   false,
        discountAmt:   "",
      });
    }
  },[open]);

  /* ── Lock scroll ── */
  useEffect(()=>{
    document.body.style.overflow = open?"hidden":"";
    return ()=>{ document.body.style.overflow=""; };
  },[open]);

  /* ── Escape ── */
  useEffect(()=>{
    if (!open) return;
    const h = e => { if(e.key==="Escape"&&phase==="form") onClose(); };
    document.addEventListener("keydown",h);
    return ()=>document.removeEventListener("keydown",h);
  },[open,phase,onClose]);

  if (!open||!invoice) return null;

  /* ── Derived ── */
  const total    = parseCurrency(invoice.totalAmount);
  const prevPaid = payments.reduce((s,p)=>s+parseCurrency(p.amount),0);
  const balance  = Math.max(0, total-prevPaid);
  const curAmt   = parseCurrency(form.amount)||0;
  const newPaid  = prevPaid+curAmt;
  const newBal   = Math.max(0, total-newPaid);
  const newStatus= computeStatus(total,newPaid);
  const newSt    = STATUS[newStatus]||STATUS.Pending;
  const showTxn  = ["UPI","Bank Transfer","Card","Online"].includes(form.paymentMode);
  const showBank = form.paymentMode==="Bank Transfer";

  /* ── Validation ── */
  function validate() {
    const e={};
    if (!form.amount || curAmt<=0)      e.amount="Enter a valid amount.";
    else if (curAmt>balance+0.01)       e.amount=`Maximum payable is ${INR(balance)}.`;
    if (!form.paymentDate)              e.paymentDate="Required.";
    if (!form.paymentMode)              e.paymentMode="Required.";
    setErrs(e);
    return Object.keys(e).length===0;
  }

  /* ── Submit ── */
  async function handleSave() {
    if (!validate()) return;
    setPhase("saving");
    try {
      const payload = {
        invoiceNumber: invoice.invoiceNumber,
        invoiceId:     invoice.invoiceId || invoice.invoiceNumber,
        studentId:     invoice.studentId,
        studentName:   invoice.studentName,
        schoolId:      invoice.schoolId,
        amount:        curAmt,
        paymentMode:   form.paymentMode,
        transactionId: form.transactionId,
        bankName:      form.bankName,
        staffName:     form.staffName,
        notes:         form.notes,
        paymentDate:   form.paymentDate,
        lateFeeAmount: form.hasLateFee ? parseCurrency(form.lateFeeAmount)||0 : 0,
        discountAmt:   form.hasDiscount ? parseCurrency(form.discountAmt)||0 : 0,
      };
      const res = await api.post("/api/payments",payload).then(r=>r.data);
      if (!res.success) throw new Error(res.error||"Failed to record payment.");

      const rawPayment   = res.payment || {...payload, paymentId:res.paymentId};
      /* Ensure receipt always has a properly formatted receipt number */
      const savedPayment = {
        ...rawPayment,
        receiptNumber: rawPayment.receiptNumber
          || res.receiptNumber
          || genReceiptNumber(rawPayment.paymentId || res.paymentId),
      };
      const updatedInv   = res.invoice||{...invoice, paidAmount:newPaid, balance:newBal, status:newStatus};

      setReceipt(savedPayment);
      setPhase("receipt");
      if (onSaved) onSaved(savedPayment, updatedInv);
    } catch(e) {
      setErrs({submit: e.message||"Failed to save payment. Please try again."});
      setPhase("form");
    }
  }

  /* ── Post-save receipt ── */
  if (phase==="receipt"&&receipt) {
    return (
      <ReceiptModal
        receipt={receipt}
        school={school}
        invoice={invoice}
        student={student}
        payments={payments}
        onClose={onClose}
        navigate={navigate}
      />
    );
  }

  /* ── Saving spinner ── */
  if (phase==="saving") {
    return (
      <div style={{
        position:"fixed",inset:0,zIndex:600,
        display:"flex",alignItems:"center",justifyContent:"center",
        background:"rgba(15,13,11,0.70)",backdropFilter:"blur(6px)",
      }}>
        <div style={{
          background:C.docBg,borderRadius:20,padding:"40px 48px",
          textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.22)",
        }}>
          <div style={{
            width:60,height:60,borderRadius:18,margin:"0 auto 16px",
            background:`linear-gradient(135deg,${C.gold},#FFE033)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:26,boxShadow:`0 8px 24px rgba(244,196,0,0.32)`,
          }}>💳</div>
          <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>Recording Payment…</div>
          <div style={{fontSize:12,color:C.inkMuted}}>Generating receipt, please wait</div>
          <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:16}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{
                width:6,height:6,borderRadius:"50%",background:C.gold,
                animation:`yd-pulse 1.2s ease-in-out ${i*0.2}s infinite`,
              }}/>
            ))}
          </div>
          <style>{`@keyframes yd-pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     FORM PHASE — the main payment entry UI
     ════════════════════════════════════════════════════════ */
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:600,
      display:"flex",flexDirection:"column",
      fontFamily:"'Plus Jakarta Sans',system-ui,-apple-system,sans-serif",
    }}>
      {/* Backdrop click → close */}
      <div
        onClick={onClose}
        style={{position:"absolute",inset:0,background:"rgba(15,13,11,0.65)",backdropFilter:"blur(4px)"}}
      />

      {/* Full-screen panel slides in from right */}
      <div style={{
        position:"absolute",top:0,right:0,bottom:0,
        width:"min(900px,100vw)",
        background:C.pageBg,
        display:"flex",flexDirection:"column",
        boxShadow:"-12px 0 60px rgba(0,0,0,0.22)",
        overflow:"hidden",
        zIndex:1,
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          flexShrink:0,
          background:C.docBg,borderBottom:`1px solid ${C.border}`,
          padding:"0 28px",height:60,
          display:"flex",alignItems:"center",gap:14,
        }}>
          <div style={{
            width:36,height:36,borderRadius:10,flexShrink:0,
            background:`linear-gradient(135deg,${C.gold},#FFE033)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:14,fontWeight:900,color:C.ink,
          }}>💳</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:800,color:C.text}}>Record Payment</div>
            <div style={{fontSize:11,color:C.inkMuted,marginTop:1}}>
              {invoice.invoiceNumber} · {invoice.studentName}
            </div>
          </div>
          <button onClick={onClose} style={{
            width:36,height:36,borderRadius:9,
            border:`1px solid ${C.border}`,background:C.sectionBg,
            cursor:"pointer",fontSize:16,color:C.inkMuted,
            display:"flex",alignItems:"center",justifyContent:"center",
            flexShrink:0,
          }}>✕</button>
        </div>

        {/* ── BODY: Two columns ── */}
        <div style={{
          flex:1,overflow:"hidden",
          display:"grid",gridTemplateColumns:"300px 1fr",
        }}>

          {/* ── LEFT COLUMN: Invoice summary ── */}
          <div style={{
            background:C.sectionBg,
            borderRight:`1px solid ${C.border}`,
            overflowY:"auto",padding:"24px 22px",
            display:"flex",flexDirection:"column",gap:16,
          }}>

            {/* Student card */}
            <div style={{
              background:C.ink,borderRadius:14,padding:"18px 18px 16px",
              position:"relative",overflow:"hidden",
            }}>
              <div style={{
                position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",
                background:`rgba(244,196,0,0.08)`,pointerEvents:"none",
              }}/>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{
                  width:44,height:44,borderRadius:13,flexShrink:0,
                  background:`linear-gradient(145deg,${C.gold},${C.goldDark})`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:16,fontWeight:900,color:C.ink,
                }}>{initials(invoice.studentName)}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:"#FFFFFF",lineHeight:1.1}}>
                    {invoice.studentName}
                  </div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.50)",marginTop:3}}>
                    {invoice.class||"—"} · {invoice.studentId||"—"}
                  </div>
                  <div style={{marginTop:8}}>
                    <StatusPillSmall label={invoice.status} st={STATUS[invoice.status]||STATUS.Pending}/>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice meta */}
            <SummaryCard title="Invoice">
              <SummaryRow label="Invoice No." value={invoice.invoiceNumber} mono/>
              <SummaryRow label="Fee Type"    value={invoice.feeType||"Tuition Fee"}/>
              <SummaryRow label="Issued"      value={fmtDate(invoice.invoiceDate)}/>
              {invoice.dueDate&&<SummaryRow label="Due" value={fmtDate(invoice.dueDate)}/>}
            </SummaryCard>

            {/* Balance breakdown */}
            <SummaryCard title="Balance">
              <SummaryRow label="Invoice Total" value={INR(total)}/>
              {prevPaid>0&&<SummaryRow label="Previously Paid" value={INR(prevPaid)}/>}
              <SummaryRow label="Outstanding" value={INR(balance)} bold/>
            </SummaryCard>

            {/* Live preview — updates as user types */}
            {curAmt>0&&(
              <div style={{
                borderRadius:12,overflow:"hidden",
                border:`1px solid ${newSt.border}`,
              }}>
                <div style={{
                  background:newSt.bg,padding:"10px 14px",
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                }}>
                  <span style={{fontSize:9,fontWeight:800,color:newSt.fg,textTransform:"uppercase",letterSpacing:"0.10em"}}>
                    After This Payment
                  </span>
                  <StatusPillSmall label={newStatus} st={newSt}/>
                </div>
                <div style={{background:C.docBg,padding:"12px 14px"}}>
                  <SummaryRow label="This Payment" value={INR(curAmt)} bold/>
                  <SummaryRow label="Remaining"    value={INR(newBal)}/>
                </div>
              </div>
            )}

            {/* Previous payments */}
            {payments.length>0&&(
              <SummaryCard title={`Payment History (${payments.length})`}>
                {payments.slice(0,4).map((p,i)=>(
                  <div key={p.paymentId||i} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"6px 0",borderBottom:i<payments.length-1?`1px solid ${C.borderLight}`:"none",
                  }}>
                    <div>
                      <div style={{fontSize:10.5,fontWeight:700,color:C.text}}>{INR(p.amount)}</div>
                      <div style={{fontSize:9,color:C.inkFaint}}>
                        {fmtDate(p.paymentDate||p.createdAt)} · {p.paymentMode||"Cash"}
                      </div>
                    </div>
                    <span style={{
                      padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:700,
                      background:C.goldLight,color:C.goldDeep,border:`1px solid ${C.goldBorder}`,
                    }}>✓</span>
                  </div>
                ))}
              </SummaryCard>
            )}
          </div>

          {/* ── RIGHT COLUMN: Payment form ── */}
          <div style={{overflowY:"auto",display:"flex",flexDirection:"column"}}>
            <div style={{flex:1,padding:"28px 32px"}}>

              {/* Amount hero */}
              <div style={{marginBottom:24}}>
                <div style={{
                  fontSize:9,fontWeight:700,color:C.inkFaint,
                  textTransform:"uppercase",letterSpacing:"0.11em",marginBottom:6,
                }}>Amount Received (₹) *</div>
                <input
                  type="number" min="0" max={balance}
                  value={form.amount}
                  onChange={e=>set("amount",e.target.value)}
                  placeholder="0"
                  style={{
                    display:"block",width:"100%",
                    padding:"14px 18px",borderRadius:12,
                    fontSize:28,fontWeight:900,
                    fontFamily:"'Courier New',monospace",
                    border:`1.5px solid ${errs.amount?C.errRed:curAmt>0?C.goldBorder:C.border}`,
                    background:errs.amount?C.errRedLight:curAmt>0?C.goldPale:C.docBg,
                    color:C.text,outline:"none",boxSizing:"border-box",
                    transition:"all 0.15s",
                  }}
                />
                {errs.amount&&<div style={{fontSize:10.5,color:C.errRed,marginTop:4}}>{errs.amount}</div>}

                {/* Quick % buttons */}
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  {[25,50,75,100].map(p=>(
                    <button key={p} type="button"
                      onClick={()=>set("amount",String(Math.round(balance*p/100)))}
                      style={{
                        flex:1,padding:"7px 0",borderRadius:8,
                        border:`1px solid ${C.goldBorder}`,
                        background:C.goldLight,color:C.goldDeep,
                        fontSize:11,fontWeight:700,cursor:"pointer",
                      }}>{p}%</button>
                  ))}
                </div>
              </div>

              {/* Two-column grid for rest of fields */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px 20px"}}>

                {/* Date */}
                <FormField label="Payment Date *" error={errs.paymentDate}>
                  <input type="date" value={form.paymentDate}
                    onChange={e=>set("paymentDate",e.target.value)}
                    style={inputStyle(!!errs.paymentDate)}
                  />
                </FormField>

                {/* Staff */}
                <FormField label="Received By">
                  <input type="text" value={form.staffName}
                    onChange={e=>set("staffName",e.target.value)}
                    placeholder="Staff name"
                    style={inputStyle(false)}
                  />
                </FormField>

                {/* Payment mode — full-width pills */}
                <div style={{gridColumn:"1/-1"}}>
                  <div style={{fontSize:9,fontWeight:700,color:C.inkFaint,textTransform:"uppercase",letterSpacing:"0.11em",marginBottom:8}}>
                    Payment Mode *
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {MODES.map(m=>(
                      <button key={m} type="button"
                        onClick={()=>set("paymentMode",m)}
                        style={{
                          padding:"8px 16px",borderRadius:8,
                          fontSize:11.5,fontWeight:700,cursor:"pointer",
                          border:`1.5px solid ${form.paymentMode===m?C.goldBorder:C.border}`,
                          background:form.paymentMode===m?C.goldLight:C.docBg,
                          color:form.paymentMode===m?C.goldDeep:C.inkMuted,
                          transition:"all 0.12s",
                        }}
                      >{m}</button>
                    ))}
                  </div>
                </div>

                {/* Transaction ID */}
                {showTxn&&(
                  <FormField label="Transaction ID / UTR" error={errs.transactionId}>
                    <input type="text" value={form.transactionId}
                      onChange={e=>set("transactionId",e.target.value)}
                      placeholder="UTR / Reference number"
                      style={inputStyle(false)}
                    />
                  </FormField>
                )}

                {/* Bank name */}
                {showBank&&(
                  <FormField label="Bank Name">
                    <input type="text" value={form.bankName}
                      onChange={e=>set("bankName",e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      style={inputStyle(false)}
                    />
                  </FormField>
                )}

                {/* Notes */}
                <div style={{gridColumn:"1/-1"}}>
                  <FormField label="Notes (optional)">
                    <textarea value={form.notes}
                      onChange={e=>set("notes",e.target.value)}
                      rows={2}
                      placeholder="Any remarks or additional info…"
                      style={{...inputStyle(false),resize:"vertical",minHeight:64}}
                    />
                  </FormField>
                </div>

                {/* Late fee toggle */}
                <div style={{gridColumn:"1/-1"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:form.hasLateFee?10:0}}>
                    <button type="button"
                      onClick={()=>set("hasLateFee",!form.hasLateFee)}
                      style={{
                        width:38,height:22,borderRadius:11,border:"none",
                        background:form.hasLateFee?C.gold:C.border,
                        position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,
                      }}
                    >
                      <span style={{
                        position:"absolute",top:3,
                        left:form.hasLateFee?18:3,
                        width:16,height:16,borderRadius:"50%",
                        background:"#FFFFFF",transition:"left 0.2s",
                        boxShadow:"0 1px 4px rgba(0,0,0,0.20)",
                      }}/>
                    </button>
                    <span style={{fontSize:12,fontWeight:600,color:C.textSoft}}>Late fee collected?</span>
                  </div>
                  {form.hasLateFee&&(
                    <input type="number" min="0"
                      value={form.lateFeeAmount}
                      onChange={e=>set("lateFeeAmount",e.target.value)}
                      placeholder="Late fee amount (₹)"
                      style={{...inputStyle(false),marginTop:0}}
                    />
                  )}
                </div>

                {/* Discount toggle */}
                <div style={{gridColumn:"1/-1"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:form.hasDiscount?10:0}}>
                    <button type="button"
                      onClick={()=>set("hasDiscount",!form.hasDiscount)}
                      style={{
                        width:38,height:22,borderRadius:11,border:"none",
                        background:form.hasDiscount?C.gold:C.border,
                        position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,
                      }}
                    >
                      <span style={{
                        position:"absolute",top:3,
                        left:form.hasDiscount?18:3,
                        width:16,height:16,borderRadius:"50%",
                        background:"#FFFFFF",transition:"left 0.2s",
                        boxShadow:"0 1px 4px rgba(0,0,0,0.20)",
                      }}/>
                    </button>
                    <span style={{fontSize:12,fontWeight:600,color:C.textSoft}}>Discount adjusted?</span>
                  </div>
                  {form.hasDiscount&&(
                    <input type="number" min="0"
                      value={form.discountAmt}
                      onChange={e=>set("discountAmt",e.target.value)}
                      placeholder="Discount amount (₹)"
                      style={{...inputStyle(false),marginTop:0}}
                    />
                  )}
                </div>

              </div>

              {/* Submit error */}
              {errs.submit&&(
                <div style={{
                  marginTop:20,padding:"10px 14px",borderRadius:9,
                  background:C.errRedLight,border:`1px solid ${C.errRedBorder}`,
                  fontSize:12,color:C.errRed,fontWeight:600,
                }}>{errs.submit}</div>
              )}
            </div>

            {/* ── STICKY ACTION BAR ── */}
            <div style={{
              flexShrink:0,borderTop:`1px solid ${C.border}`,
              background:C.docBg,padding:"16px 32px",
              display:"flex",gap:12,alignItems:"center",
            }}>
              {/* Balance preview */}
              <div style={{flex:1,minWidth:0}}>
                {curAmt>0?(
                  <>
                    <div style={{fontSize:9,color:C.inkFaint,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>
                      After saving
                    </div>
                    <div style={{fontSize:13,fontWeight:800,color:C.text}}>
                      Balance: <span style={{fontFamily:"'Courier New',monospace"}}>{INR(newBal)}</span>
                      {" "}
                      <StatusPillSmall label={newStatus} st={newSt}/>
                    </div>
                  </>
                ):(
                  <div style={{fontSize:12,color:C.inkFaint}}>Outstanding: {INR(balance)}</div>
                )}
              </div>
              <button onClick={onClose} style={{
                padding:"10px 20px",borderRadius:10,
                border:`1px solid ${C.border}`,background:C.sectionBg,
                fontSize:12,fontWeight:700,color:C.inkSoft,cursor:"pointer",
              }}>Cancel</button>
              <button onClick={handleSave} disabled={phase==="saving"||curAmt<=0} style={{
                padding:"10px 28px",borderRadius:10,border:"none",
                background:curAmt>0?`linear-gradient(135deg,${C.gold},#FFE033)`:C.cardBg,
                color:curAmt>0?C.ink:C.inkFaint,
                fontSize:13,fontWeight:800,cursor:curAmt>0?"pointer":"not-allowed",
                boxShadow:curAmt>0?`0 4px 16px rgba(244,196,0,0.30)`:"none",
                transition:"all 0.15s",
              }}>
                Save &amp; Generate Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */
function SummaryCard({ title, children }) {
  return (
    <div style={{
      background:C.docBg,borderRadius:11,
      border:`1px solid ${C.border}`,
      overflow:"hidden",
    }}>
      <div style={{
        padding:"8px 14px",borderBottom:`1px solid ${C.borderLight}`,
        fontSize:8,fontWeight:800,color:C.inkFaint,
        textTransform:"uppercase",letterSpacing:"0.12em",
        background:C.sectionBg,
      }}>{title}</div>
      <div style={{padding:"10px 14px"}}>{children}</div>
    </div>
  );
}
function SummaryRow({ label, value, mono, bold }) {
  return (
    <div style={{
      display:"flex",justifyContent:"space-between",alignItems:"baseline",
      padding:"4px 0",borderBottom:`1px solid ${C.borderLight}`,
    }}>
      <span style={{fontSize:10,color:C.inkMuted,fontWeight:500}}>{label}</span>
      <span style={{
        fontSize:bold?12:11,fontWeight:bold?800:600,color:C.text,
        fontFamily:mono?"'Courier New',monospace":"inherit",
      }}>{value}</span>
    </div>
  );
}
function StatusPillSmall({ label, st }) {
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:4,
      background:st.bg,color:st.fg,border:`1px solid ${st.border}`,
      padding:"2px 8px",borderRadius:999,fontSize:9,fontWeight:800,
    }}>
      <span style={{width:4,height:4,borderRadius:"50%",background:st.dot}}/>
      {label}
    </span>
  );
}
function FormField({ label, error, children }) {
  return (
    <div>
      <div style={{
        fontSize:9,fontWeight:700,color:C.inkFaint,
        textTransform:"uppercase",letterSpacing:"0.11em",marginBottom:5,
      }}>{label}</div>
      {children}
      {error&&<div style={{fontSize:10,color:C.errRed,marginTop:3}}>{error}</div>}
    </div>
  );
}
function inputStyle(err) {
  return {
    display:"block",width:"100%",padding:"9px 13px",borderRadius:9,
    fontSize:13,fontWeight:500,color:C.text,outline:"none",
    boxSizing:"border-box",transition:"border-color 0.15s",
    border:`1px solid ${err?C.errRed:C.border}`,
    background:err?C.errRedLight:C.docBg,
  };
}
