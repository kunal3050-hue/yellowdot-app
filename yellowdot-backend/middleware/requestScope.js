/**
 * requestScope.js — pure request-scoping helpers shared by server.js routes.
 * No Firestore/Express dependency, so these are directly unit-testable.
 */

// Resolve school + center context from authenticated request. schoolId always
// comes from req.user.schoolId (set by authMiddleware from the verified
// Firestore/token identity) — never from client-supplied query/body, which
// is what keeps every route below tenant-isolated.
function resolveContext(req) {
  return {
    schoolId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    centerId:    req.query?.centerId || req.user?.centerId   || "",
    actorUserId: req.user?.userId   || "system",
  };
}

// Scope a finance list query (invoices/payments) to the caller's own child
// when they're a parent — never trust a client-supplied studentId for that
// role. Staff/admin roles keep their existing unrestricted-within-school
// access. Returns { studentId } to actually query with, or { error } to send.
function scopeFinanceQuery(req, requestedStudentId) {
  if (req.user?.role === "unknown") {
    return { error: { status: 403, body: { success: false, error: "Your account is not registered in this system." } } };
  }
  if (req.user?.role === "parent") {
    const linkedId = req.user.student?.studentId;
    if (!linkedId) {
      return { error: { status: 403, body: { success: false, error: "No student linked to this parent account." } } };
    }
    return { studentId: linkedId };
  }
  return { studentId: requestedStudentId };
}

// Ownership check for a single fetched invoice — parents may only view
// their own child's invoice; staff/admin are unaffected.
function checkInvoiceOwnership(req, invoice) {
  if (req.user?.role === "parent") {
    const linkedId = req.user.student?.studentId;
    if (!linkedId || invoice.studentId !== linkedId) {
      return { status: 404, body: { success: false, message: "Invoice not found" } };
    }
  }
  return null;
}

module.exports = { resolveContext, scopeFinanceQuery, checkInvoiceOwnership };
