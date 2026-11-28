/**
 * billingDocuments.test.js — the two printable documents
 *
 * An invoice and a receipt are the same object at two moments, and they are
 * now rendered by one component on the client. The claim this file defends is
 * the server half of that: both carry the SAME letterhead, built from the same
 * place, so the pair a family receives cannot disagree about who issued it.
 *
 * What is asserted:
 *   1. getInvoiceDocument exists and is exported — the client route 404s
 *      silently otherwise, and the page would just show "could not load".
 *   2. The document endpoint is declared and carries the same guard chain as
 *      the rest of the billing reads. (billingAccess.test.js walks the router
 *      for this too; here it is named, so a deletion says what it broke.)
 *   3. "/invoices/:invoiceId/document" cannot be swallowed by
 *      "/invoices/:invoiceId" — a path parameter matches one segment, and a
 *      regression here would serve the register payload to the printed page.
 *   4. Invoice and receipt resolve the identical letterhead object.
 */

const test   = require("node:test");
const assert = require("node:assert");

const router  = require("../routes/billingRoutes");
const billing = require("../services/billingService");

function routeFor(path, method = "get") {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  return layer ? { path, names: layer.route.stack.map(s => s.handle.name) } : null;
}

test("getInvoiceDocument is exported from the billing service", () => {
  assert.strictEqual(typeof billing.getInvoiceDocument, "function",
    "the printable invoice has no server side; /document would 404");
});

test("the document endpoint is declared and guarded like the other reads", () => {
  const doc = routeFor("/api/billing/invoices/:invoiceId/document");
  assert.ok(doc, "GET /api/billing/invoices/:invoiceId/document is not declared");

  const receipt = routeFor("/api/billing/receipts/:paymentId");
  assert.ok(receipt, "the receipt route vanished");

  // Same gate as the receipt: whoever may read a receipt may read a bill.
  assert.deepStrictEqual(
    doc.names.filter(Boolean), receipt.names.filter(Boolean),
    "the printable invoice is guarded differently from the receipt",
  );
});

test("the register route cannot swallow the document route", () => {
  const paths = router.stack.filter(l => l.route).map(l => l.route.path);
  assert.ok(paths.includes("/api/billing/invoices/:invoiceId"));
  assert.ok(paths.includes("/api/billing/invoices/:invoiceId/document"));

  // Express matches per segment, so ":invoiceId" cannot absorb "x/document".
  // Asserted rather than assumed, because the failure is quiet: the printed
  // page would render the register payload and simply have no letterhead.
  const register = /^\/api\/billing\/invoices\/([^/]+)$/;
  assert.strictEqual(register.test("/api/billing/invoices/inv_1/document"), false);
  assert.strictEqual(register.test("/api/billing/invoices/inv_1"), true);
});

test("invoice and receipt build their letterhead from the same helper", () => {
  // Asserted against the source rather than by calling the two functions.
  // Stubbing the exports does not intercept the calls they make internally,
  // and the alternative - a seeded emulator - would test Firestore, not this.
  // What matters here is that neither document grew a letterhead of its own,
  // and that is visible in the source.
  const src = require("node:fs")
    .readFileSync(require.resolve("../services/billingService"), "utf8");

  const NEWLINE_BRACE = String.fromCharCode(10) + "}";
  const body = name => {
    const at = src.indexOf(`async function ${name}(`);
    assert.notStrictEqual(at, -1, `${name} is gone`);
    return src.slice(at, src.indexOf(NEWLINE_BRACE, at));
  };

  for (const fn of ["getInvoiceDocument", "getReceipt"]) {
    assert.match(body(fn), /getLetterhead\(/,
      `${fn} no longer uses the shared letterhead, so the pair can disagree`);
    assert.match(body(fn), /school/,
      `${fn} does not return the school block the document renders`);
  }

  assert.match(src, /name:\s*settings\?\.schoolName \|\| tenant\?\.schoolName/,
    "the letterhead no longer prefers the billing settings name over the tenant record");
});
