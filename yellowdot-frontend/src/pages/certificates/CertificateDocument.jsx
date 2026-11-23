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
