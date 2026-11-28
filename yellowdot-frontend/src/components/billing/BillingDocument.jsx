/**
 * BillingDocument.jsx — the paper a family is handed
 * ─────────────────────────────────────────────────────────────────────────────
 * One component for both billing documents. An invoice and a receipt are the
 * same object at two moments — "this is owed" and "this was paid" — and a
 * family should recognise the second as the counterpart of the first. Two
 * separate layouts drift apart the moment either is touched; this one cannot.
 *
 * The caller supplies content, never markup:
 *
 *   kind        the word in the title lobe — "Invoice", "Receipt"
 *   school      letterhead: { name, logo, address, phone, email }
 *   billTo      { heading, name, lines[] }
 *   meta        [{ label, value }] — the reference block, right of BILL TO
 *   rows        [{ label, price, qty, total }] — the priced table
 *   totals      [{ label, value, rule?, strong? }] — the stack under the table
 *   highlight   { label, value, sub } — the one figure the reader is after
 *   aside       anything to print bottom-left (payment details, terms)
 *   signature   { name, role }
 *   watermark   "REVERSED" / "VOID" — stamped across the page when set
 *
 * ── Why it is built out of blocks, not a grid framework ──────────────────────
 * It has to survive print, where there is no viewport and no JS. Every part is
 * ordinary flow or a two-column flex that collapses predictably, and the print
 * rules in billing.css only remove chrome and pin the palette. Nothing here is
 * positioned, so nothing can be clipped out of a scroll container — the bug
 * that made the previous receipt print a blank page.
 */

export default function BillingDocument({
  kind = "Invoice",
  school = {},
  billTo = {},
  meta = [],
  rows = [],
  totals = [],
  highlight = null,
  aside = null,
  signature = null,
  watermark = "",
  footerNote = "",
}) {
  // Either half may be missing on a school that has not filled in its
  // contact details, and a dangling separator reads as a defect.
  const contact = [school.phone, school.email].filter(Boolean).join("  ·  ");

  return (
    <article className="yd-doc">

      {/* ── Masthead. The lobe carries the document's name so the reader can
             tell an invoice from a receipt across a desk. ─────────────────── */}
      <header className="yd-doc__head">
        <div className="yd-doc__brand">
          {school.logo
            ? <img className="yd-doc__logo" src={school.logo} alt="" aria-hidden="true" />
            : <span className="yd-doc__logo yd-doc__logo--letter" aria-hidden="true">
                {(school.name || "K").charAt(0)}
              </span>}
          <span className="yd-doc__brandname">{school.name}</span>
        </div>
        <div className="yd-doc__lobe"><h1 className="yd-doc__kind">{kind}</h1></div>
      </header>

      {watermark && <div className="yd-doc__watermark" aria-hidden="true">{watermark}</div>}

      {/* ── Who it is for, and which document this is ────────────────────── */}
      <section className="yd-doc__parties">
        <div className="yd-doc__billto">
          <h2 className="yd-doc__billto-h">{billTo.heading || "Bill to:"}</h2>
          <p className="yd-doc__billto-name">{billTo.name}</p>
          {(billTo.lines || []).filter(Boolean).map((l, i) => (
            <p className="yd-doc__billto-line" key={i}>{l}</p>
          ))}
        </div>
        <dl className="yd-doc__meta">
          {meta.filter(Boolean).map(m => (
            <div className="yd-doc__meta-row" key={m.label}>
              <dt>{m.label}:</dt><dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── The priced table. A real <table>, so it reads correctly to a
             screen reader and breaks sanely across printed pages. ─────────── */}
      <section className="yd-doc__items">
        <table className="yd-doc__table">
          <thead>
            <tr>
              <th scope="col" className="yd-doc__c-desc">Item description</th>
              <th scope="col" className="yd-doc__c-num">Price</th>
              <th scope="col" className="yd-doc__c-num">Qty</th>
              <th scope="col" className="yd-doc__c-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key || i}>
                <td className="yd-doc__c-desc">
                  {r.label}
                  {r.sub && <span className="yd-doc__rowsub">{r.sub}</span>}
                </td>
                <td className="yd-doc__c-num">{r.price}</td>
                <td className="yd-doc__c-num">{r.qty}</td>
                <td className="yd-doc__c-num">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── The arithmetic, right-aligned under the Total column ─────────── */}
      {totals.length > 0 && (
        <section className="yd-doc__sums">
          <dl className="yd-doc__sumlist">
            {totals.filter(Boolean).map(s => (
              <div
                key={s.label}
                className={`yd-doc__sum${s.rule ? " is-ruled" : ""}${s.strong ? " is-strong" : ""}`}
              >
                <dt>{s.label}</dt><dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ── The one figure the reader opened this for ────────────────────── */}
      {highlight && (
        <section className="yd-doc__highlight">
          <p className="yd-doc__highlight-label">{highlight.label}</p>
          <p className="yd-doc__highlight-value">{highlight.value}</p>
          {highlight.sub && <p className="yd-doc__highlight-sub">{highlight.sub}</p>}
        </section>
      )}

      {/* ── Terms left, signature right. The signature line is printed only;
             on screen it is a rule that does nothing, on paper a document with
             nowhere to sign gets handed back. ───────────────────────────── */}
      <footer className="yd-doc__foot">
        <div className="yd-doc__aside">{aside}</div>
        {signature && (
          <div className="yd-doc__sign">
            <span className="yd-doc__signline" />
            <span className="yd-doc__signname">{signature.name}</span>
            <span className="yd-doc__signrole">{signature.role}</span>
          </div>
        )}
      </footer>

      {footerNote && <p className="yd-doc__note">{footerNote}</p>}

      {/* ── Contact strip. Mirrors the masthead so the page is bracketed. ── */}
      {(school.address || contact) && (
        <div className="yd-doc__strip">
          {school.address && <span className="yd-doc__strip-item">{school.address}</span>}
          {school.phone   && <span className="yd-doc__strip-item">{school.phone}</span>}
          {school.email   && <span className="yd-doc__strip-item">{school.email}</span>}
        </div>
      )}
    </article>
  );
}
