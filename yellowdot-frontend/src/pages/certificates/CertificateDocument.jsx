/**
 * CertificateDocument.jsx — the certificate itself
 *
 * The same component renders the on-screen preview and the printed page; see
 * src/styles/certificates.css for why that matters and how the two sizes come
 * from one set of rules.
 *
 * It takes a certificate record and renders it. It does no fetching and holds
 * no state, so the issue screen can feed it an unsaved draft for a live
 * preview and the register can feed it a saved row, with no difference in
 * what comes out of the printer.
 */

import { createPortal } from "react-dom";
import { PLATFORM_NAME } from "../../config/environment";
import { TYPE_BY_VALUE, formatAwardDate } from "./certificateMeta";

/**
 * The award seal — scalloped rosette with ribbon tails.
 *
 * Drawn as inline SVG rather than an image file: it stays crisp at A4, needs
 * no asset to load before printing, and colours come from the design tokens
 * so it follows the brand rather than freezing a hex into a PNG.
 */
function AwardSeal() {
  // 16 overlapping circles make the scalloped edge — simpler and more robust
  // than hand-writing an arc path, and it scales identically at any size.
  const scallops = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { cx: 50 + Math.cos(a) * 33, cy: 45 + Math.sin(a) * 33 };
  });

  return (
    <svg className="yd-cert-seal" viewBox="0 0 100 132" aria-hidden="true">
      {/* Ribbon tails, behind the rosette */}
      <path d="M36 70 L36 122 L50 110 L64 122 L64 70 Z" fill="var(--yd-yellow-dark)" />
      <path d="M40 70 L40 112 L50 103 L60 112 L60 70 Z" fill="var(--yd-yellow)" />

      {scallops.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r="9" fill="var(--yd-yellow)" />
      ))}
      <circle cx="50" cy="45" r="34" fill="var(--yd-yellow)" />
      <circle cx="50" cy="45" r="27" fill="var(--yd-white)" />
      <circle cx="50" cy="45" r="23" fill="none" stroke="var(--yd-yellow-dark)" strokeWidth="2" />
      {/* Five-pointed star */}
      <path
        fill="var(--yd-yellow-dark)"
        d="M50 29 L55.3 40.6 L68 42.1 L58.6 50.8 L61.1 63.3 L50 57.1 L38.9 63.3 L41.4 50.8 L32 42.1 L44.7 40.6 Z"
      />
    </svg>
  );
}

/**
 * Confetti scattered into the margins. Positions are hand-placed in the
 * sheet's own coordinate space (0-100 x 0-70) so nothing drifts into the
 * text column or the signature block at any scale.
 */
const CONFETTI = [
  { x: 8,  y: 10, r: 1.1, c: "var(--yd-yellow)" },
  { x: 13, y: 18, r: 0.7, c: "var(--yd-yellow-dark)" },
  { x: 6,  y: 26, r: 0.9, c: "var(--yd-yellow-light)" },
  { x: 91, y: 54, r: 1.0, c: "var(--yd-yellow)" },
  { x: 95, y: 44, r: 0.7, c: "var(--yd-yellow-dark)" },
  { x: 10, y: 58, r: 0.8, c: "var(--yd-yellow)" },
  { x: 4,  y: 46, r: 0.6, c: "var(--yd-yellow-dark)" },
  { x: 93, y: 20, r: 0.8, c: "var(--yd-yellow-light)" },
];

function PlayfulDecor() {
  return (
    <svg className="yd-cert-confetti" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">
      {CONFETTI.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} />
      ))}
    </svg>
  );
}

/**
 * @prop {object} certificate  a saved record, or an unsaved draft of the same shape
 * @prop {string} schoolName   printed header; defaults to the platform name
 */
export default function CertificateDocument({ certificate, schoolName = PLATFORM_NAME }) {
  const c = certificate || {};
  const type = TYPE_BY_VALUE[c.type];

  const template  = c.template === "playful" ? "playful" : "classic";
  const watermark = c.status === "draft" ? "draft" : c.status === "revoked" ? "revoked" : null;

  return (
    <div className={`yd-cert-sheet yd-cert-sheet--${template}`}>
      {watermark && (
        <div className={`yd-cert-watermark yd-cert-watermark--${watermark}`}>
          {watermark === "draft" ? "Draft" : "Revoked"}
        </div>
      )}

      <div className="yd-cert-frame">
        <div className="yd-cert-school">{schoolName}</div>
        <div className="yd-cert-rule" />

        {type && <div className="yd-cert-eyebrow">{type.label}</div>}
        <h1 className="yd-cert-title">{c.title || type?.defaultTitle || "Certificate"}</h1>

        <div className="yd-cert-presented">This is to certify that</div>
        <div className="yd-cert-name">{c.studentName || "—"}</div>
        <div className="yd-cert-underline" />

        <div className="yd-cert-citation">{c.citation || type?.defaultCitation || ""}</div>
        {c.className && <div className="yd-cert-class">{c.className}</div>}

        <div className="yd-cert-footer">
          <div className="yd-cert-foot-col">
            <div className="yd-cert-foot-value">{formatAwardDate(c.awardDate)}</div>
            <div className="yd-cert-foot-line" />
            <div className="yd-cert-foot-label">Date</div>
          </div>
          <div className="yd-cert-foot-col">
            {/* The signatory's name sits ABOVE the rule, so the rule itself is
                left clear for an actual pen. */}
            <div className="yd-cert-foot-value">{c.signatoryName || ""}</div>
            <div className="yd-cert-foot-line" />
            <div className="yd-cert-foot-label">
              {c.signatoryDesignation || "Authorised Signatory"}
            </div>
          </div>
        </div>
      </div>

      {/* Decoration sits OUTSIDE .yd-cert-frame and is absolutely positioned,
          so it cannot push content, wrap a long name differently, or
          reintroduce the overflow the frame was measured free of. */}
      {template === "playful" && (
        <>
          <PlayfulDecor />
          <AwardSeal />
          <img
            className="yd-cert-mascot"
            src="/icons/pwa-512x512.png"
            alt=""
            aria-hidden="true"
          />
        </>
      )}

      {c.serialNumber && <div className="yd-cert-serial">{c.serialNumber}</div>}
    </div>
  );
}

/**
 * The print copy, portaled to <body> so print media can hide every other body
 * child — the app shell, the sidebar, and the dialog the preview is sitting in.
 * Rendering it inside the dialog instead would print all of that furniture
 * around the certificate.
 *
 * Accepts an array so a bulk issue prints as one job, one page per child,
 * rather than asking staff to print thirty certificates one at a time.
 */
export function CertificatePrintPortal({ certificates = [], schoolName }) {
  if (!certificates.length) return null;

  return createPortal(
    <div className="yd-cert-print-root" aria-hidden="true">
      <div className="yd-cert-stage">
        {certificates.map((c, i) => (
          <CertificateDocument
            key={c.certificateId || `${c.studentId}-${i}`}
            certificate={c}
            schoolName={schoolName}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
