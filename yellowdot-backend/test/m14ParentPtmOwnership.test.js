/**
 * Milestone 14 — parentRoutes.js PTM booking ownership validation,
 * tenant isolation, and booking-hijack prevention.
 */
const test = require("node:test");
const assert = require("node:assert");

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}
function findRouteHandler(router, path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) return null;
  // [0] is loadParent (identity resolution) — skipped since req.parent is pre-set in these tests.
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

// ── ptmService: booking ownership (the actual hijack bug) ──────────────
//
// db is a true singleton (same object every `require("../firebaseAdmin")`),
// so patching db.collection itself — not just .doc() on one returned
// instance — reliably intercepts every internal bookingCol()/slotCol() call
// ptmService.js makes, without ever touching real (production) Firestore.

function withFakeBookingDoc(bookingData, fn) {
  const { db } = require("../firebaseAdmin");
  const origCollection = db.collection.bind(db);
  db.collection = (name) => {
    if (name === "ptmBookings") {
      return { doc: () => ({ get: async () => ({ exists: true, data: () => bookingData }) }) };
    }
    return origCollection(name);
  };
  return fn().finally(() => { db.collection = origCollection; });
}

test("ptmService.rescheduleBooking: rejects a mismatched parentId (booking hijack blocked)", async () => {
  const svc = require("../services/ptmService");
  await withFakeBookingDoc({ parentId: "REAL-OWNER", slotId: "SLOT-1", status: "confirmed" }, () =>
    assert.rejects(
      () => svc.rescheduleBooking("BOOK-1", "SLOT-2", { parentId: "ATTACKER" }),
      /Booking not found/,
      "a non-owning parentId must be rejected as if the booking doesn't exist",
    ),
  );
});

test("ptmService.cancelBooking: rejects a mismatched parentId (booking hijack blocked)", async () => {
  const svc = require("../services/ptmService");
  await withFakeBookingDoc({ parentId: "REAL-OWNER", slotId: "SLOT-1", status: "confirmed" }, () =>
    assert.rejects(
      () => svc.cancelBooking("BOOK-2", { parentId: "ATTACKER" }),
      /Booking not found/,
    ),
  );
});

test("ptmService.rescheduleBooking: allows the real owner past the ownership gate", async () => {
  const svc = require("../services/ptmService");
  // Ownership passes, so it should fail on the *next* check (already cancelled),
  // proving the ownership gate doesn't block the legitimate owner.
  await withFakeBookingDoc({ parentId: "REAL-OWNER", slotId: "SLOT-1", status: "cancelled" }, () =>
    assert.rejects(
      () => svc.rescheduleBooking("BOOK-3", "SLOT-2", { parentId: "REAL-OWNER" }),
      /already cancelled/,
    ),
  );
});

test("ptmService.cancelBooking: allows the real owner past the ownership gate", async () => {
  const svc = require("../services/ptmService");
  await withFakeBookingDoc({ parentId: "REAL-OWNER", slotId: "SLOT-1", status: "cancelled" }, () =>
    assert.rejects(
      () => svc.cancelBooking("BOOK-4", { parentId: "REAL-OWNER" }),
      /Already cancelled/,
    ),
  );
});

// ── parentRoutes: tenant isolation on PTM booking ───────────────────────

test("parent PTM: POST /:id/book blocks a cross-tenant PTM, never calls bookSlot", async () => {
  const parentRoutes = require("../routes/parentRoutes");
  const ptmSvc = require("../services/ptmService");
  const origGetPtm = ptmSvc.getPtm;
  const origBookSlot = ptmSvc.bookSlot;
  ptmSvc.getPtm = async () => ({ id: "PTM-1", schoolId: "school-B", title: "Foreign PTM" });
  let called = false;
  ptmSvc.bookSlot = async () => { called = true; return {}; };

  const handler = findRouteHandler(parentRoutes, "/api/parent/ptm/:id/book", "post");
  assert.ok(handler);

  const req = {
    params: { id: "PTM-1" },
    body: { studentId: "YD001", slotId: "SLOT-1" },
    parent: { uid: "P1", schoolId: "school-A", studentIds: ["YD001"] },
  };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false, "bookSlot must never be called for a cross-tenant PTM");
  ptmSvc.getPtm = origGetPtm;
  ptmSvc.bookSlot = origBookSlot;
});

test("parent PTM: POST /:id/book allows a same-tenant PTM for the parent's own child", async () => {
  const parentRoutes = require("../routes/parentRoutes");
  const ptmSvc = require("../services/ptmService");
  const notif = require("../services/notificationService");
  const origGetPtm = ptmSvc.getPtm;
  const origBookSlot = ptmSvc.bookSlot;
  const origNotifyAsync = notif.notifyAsync;
  ptmSvc.getPtm = async () => ({ id: "PTM-2", schoolId: "school-A", title: "Own PTM" });
  ptmSvc.bookSlot = async () => ({ id: "BOOK-X", status: "confirmed" });
  notif.notifyAsync = () => {};

  const handler = findRouteHandler(parentRoutes, "/api/parent/ptm/:id/book", "post");
  const req = {
    params: { id: "PTM-2" },
    body: { studentId: "YD001", slotId: "SLOT-1" },
    parent: { uid: "P1", schoolId: "school-A", studentIds: ["YD001"] },
  };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 201);
  ptmSvc.getPtm = origGetPtm;
  ptmSvc.bookSlot = origBookSlot;
  notif.notifyAsync = origNotifyAsync;
});

test("parent PTM: GET /api/parent/ptm ignores a studentId not linked to this parent, falls back to own child", async () => {
  const parentRoutes = require("../routes/parentRoutes");
  const parentPtmSvc = require("../services/parentPtmService");
  const studentSvc = require("../services/studentService");
  const origGetPtmsView = parentPtmSvc.getPtmsView;
  const origGetOne = studentSvc.getOne;
  let capturedArgs = null;
  parentPtmSvc.getPtmsView = async (args) => { capturedArgs = args; return { ptms: [] }; };
  studentSvc.getOne = async () => ({ classId: "C1" });

  const handler = findRouteHandler(parentRoutes, "/api/parent/ptm", "get");
  const req = {
    query: { studentId: "YD999-FOREIGN" }, // not one of the parent's own children
    parent: { uid: "P1", schoolId: "school-A", studentIds: ["YD001"] },
  };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(capturedArgs.studentId, "YD001", "must fall back to the parent's own linked child, not the foreign one supplied in the query");
  assert.equal(capturedArgs.schoolId, "school-A", "must use the parent's own resolved schoolId, not a hardcoded one");

  parentPtmSvc.getPtmsView = origGetPtmsView;
  studentSvc.getOne = origGetOne;
});

// ── Regression: req.parent has no .parentId field, only .uid — a pre-existing
// bug found during this milestone's own live verification. Every PTM call site
// that read parent.parentId was silently passing undefined, which defeated
// the ownership check above entirely. Lock in the correct field everywhere. ──

test("parent PTM: reschedule/cancel/book/list all pass parent.uid as the ownership key, not the nonexistent parent.parentId", async () => {
  const parentRoutes = require("../routes/parentRoutes");
  const ptmSvc = require("../services/ptmService");
  const parentPtmSvc = require("../services/parentPtmService");
  const notif = require("../services/notificationService");
  const orig = {
    getPtm: ptmSvc.getPtm, bookSlot: ptmSvc.bookSlot,
    rescheduleBooking: ptmSvc.rescheduleBooking, cancelBooking: ptmSvc.cancelBooking,
    getPtmsView: parentPtmSvc.getPtmsView, notifyAsync: notif.notifyAsync,
  };
  const captured = {};
  ptmSvc.getPtm = async () => ({ id: "PTM-3", schoolId: "school-A", title: "T" });
  ptmSvc.bookSlot = async (args) => { captured.book = args.parentId; return { id: "B1" }; };
  ptmSvc.rescheduleBooking = async (id, slot, opts) => { captured.reschedule = opts.parentId; return { studentId: "YD001" }; };
  ptmSvc.cancelBooking = async (id, opts) => { captured.cancel = opts.parentId; };
  parentPtmSvc.getPtmsView = async (args) => { captured.list = args.parentId; return {}; };
  notif.notifyAsync = () => {};

  const req = { parent: { uid: "REAL-UID", schoolId: "school-A", studentIds: ["YD001"] } };
  const res = () => mockRes();

  await findRouteHandler(parentRoutes, "/api/parent/ptm", "get")({ ...req, query: {} }, res());
  await findRouteHandler(parentRoutes, "/api/parent/ptm/:id/book", "post")({ ...req, params: { id: "PTM-3" }, body: { studentId: "YD001", slotId: "S1" } }, res());
  await findRouteHandler(parentRoutes, "/api/parent/ptm/bookings/:bookingId/reschedule", "patch")({ ...req, params: { bookingId: "B1" }, body: { newSlotId: "S2" } }, res());
  await findRouteHandler(parentRoutes, "/api/parent/ptm/bookings/:bookingId", "delete")({ ...req, params: { bookingId: "B1" } }, res());

  assert.equal(captured.list, "REAL-UID");
  assert.equal(captured.book, "REAL-UID");
  assert.equal(captured.reschedule, "REAL-UID");
  assert.equal(captured.cancel, "REAL-UID");

  Object.assign(ptmSvc, { getPtm: orig.getPtm, bookSlot: orig.bookSlot, rescheduleBooking: orig.rescheduleBooking, cancelBooking: orig.cancelBooking });
  parentPtmSvc.getPtmsView = orig.getPtmsView;
  notif.notifyAsync = orig.notifyAsync;
});
