require("dotenv").config();

// ── Firebase Admin — must be initialized before any service imports ──
require("./firebaseAdmin");

const PORT = process.env.PORT || 5000;

const express = require("express");
const cors    = require("cors");
const app     = express();

// CORS — restrict to known frontend origins in production
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000")
  .split(",").map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server / Postman (no Origin header)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "5mb" })); // Allow photo base64 uploads

// ── Route modules ──────────────────────────────────────────────────
const authRoutes             = require("./routes/authRoutes");
const userRoutes             = require("./routes/userRoutes");
const napRoutes              = require("./routes/napRoutes");
const foodMenuRoutes         = require("./routes/foodMenuRoutes");
const foodConsumptionRoutes  = require("./routes/foodConsumptionRoutes");
const attendanceRoutes       = require("./routes/attendanceRoutes");
const parentAttendanceRoutes = require("./routes/parentAttendanceRoutes");
const pickupRoutes           = require("./routes/pickupRoutes");
const roleRoutes             = require("./routes/roleRoutes");
const communicationRoutes    = require("./routes/communicationRoutes");
const securityRoutes         = require("./routes/securityRoutes");
const qrRoutes               = require("./routes/qrRoutes");
const cctvRoutes             = require("./routes/cctvRoutes");

// ── Services (for inline routes below) ────────────────────────────
const studentSvc        = require("./services/studentService");
const studentMedicalSvc = require("./services/studentMedicalService");
const studentNotesSvc   = require("./services/studentNotesService");
const invoiceSvc        = require("./services/invoiceService");
const settingsSvc       = require("./services/settingsService");
const pickupAuthSvc     = require("./services/pickupAuthorizationService");

// ── Auth middleware ────────────────────────────────────────────────
const { authenticate, authorize, blockUnknown, staffOnly } = require("./middleware/authMiddleware");

// ── Mount route modules ────────────────────────────────────────────
app.use(authRoutes);           // /api/auth/me, /api/auth/logout, etc.  (has own auth)
app.use(userRoutes);           // /api/users  (full auth + RBAC inside)
app.use(napRoutes);
app.use(foodMenuRoutes);
app.use(foodConsumptionRoutes);
app.use(attendanceRoutes);
app.use(parentAttendanceRoutes);
app.use(pickupRoutes);
app.use(roleRoutes);
app.use(communicationRoutes);
app.use(securityRoutes);
app.use(qrRoutes);             // /api/qr/center/:centerId, /api/qr/validate
app.use(cctvRoutes);           // /api/cctv/cameras  (CCTV V2 — metadata CRUD, no streaming)

// ============================================================
// UTILITY HELPERS
// ============================================================

function logRouteError(route, err) {
  const code = err.code || err.status || "?";
  console.error(`[${route}] Error (code ${code}): ${err.message}`);
}

// Resolve school + center context from authenticated request
function resolveContext(req) {
  return {
    schoolId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    centerId:    req.query?.centerId || req.user?.centerId   || "",
    actorUserId: req.user?.userId   || "system",
  };
}

// ============================================================
// HEALTH CHECK  (public)
// ============================================================

app.get("/", (req, res) => {
  res.json({
    status:  "ok",
    service: "Yellow Dot Backend",
    backend: "Firestore",
    uptime:  Math.floor(process.uptime()) + "s",
  });
});

// ============================================================
// STUDENTS — CRUD
// ============================================================

app.get("/students", authenticate, blockUnknown, async (req, res) => {
  try {
    const { schoolId, centerId } = resolveContext(req);

    // Parents may only retrieve their own linked child
    if (req.user.role === "parent") {
      const linkedId = req.user.student?.studentId;
      if (!linkedId) {
        return res.status(403).json({ error: "No student linked to this parent account." });
      }
      const student = await studentSvc.getOne(linkedId);
      return res.json(student ? [student] : []);
    }

    // Staff: admins/developers see all centers; teachers/others see own center only
    const bypassAll = ["developer", "super_admin", "admin"].includes(req.user.role);
    const filter    = bypassAll ? { schoolId } : { schoolId, centerId: centerId || req.user.centerId };
    const students  = await studentSvc.getAll(filter);
    res.json(students);
  } catch (err) {
    logRouteError("GET /students", err);
    res.status(500).json({ error: "Failed to fetch students", details: err.message });
  }
});

app.get("/students/:id", authenticate, blockUnknown, async (req, res) => {
  try {
    // Parents may only fetch their own linked child
    if (req.user.role === "parent") {
      const linkedId = req.user.student?.studentId;
      if (!linkedId || req.params.id !== linkedId) {
        return res.status(403).json({ error: "You can only access your own child's records." });
      }
    }
    const student = await studentSvc.getOne(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    logRouteError("GET /students/:id", err);
    res.status(500).json({ message: "Error fetching student", details: err.message });
  }
});

app.post("/add-student", authenticate, authorize("admin","center_admin","reception","super_admin","developer"), async (req, res) => {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const body = req.body || {};
    const result = await studentSvc.create(body, { schoolId, centerId, actorUserId });

    // ── Auto-create Father & Mother as protected pickup persons ────
    const studentId   = result?.studentId || result?.student?.studentId;
    const studentName = body.student_name || body.studentName || "";
    if (studentId) {
      const parents = [];

      const fatherName  = body.father_name  || body.fatherName  || "";
      const fatherPhone = body.father_whatsapp || body.fatherWhatsapp || body.father_phone || "";
      const fatherPhoto = body.father_photo || body.fatherPhoto || "";

      const motherName  = body.mother_name  || body.motherName  || "";
      const motherPhone = body.mother_whatsapp || body.motherWhatsapp || body.mother_phone || "";
      const motherPhoto = body.mother_photo || body.motherPhoto || "";

      if (fatherName.trim()) {
        parents.push({
          studentId, studentName,
          pickupName:  fatherName.trim(),
          relation:    "Father",
          mobile:      fatherPhone || "",
          photoUrl:    fatherPhoto || "",
          emergency:   true,
          isParent:    true,
          isProtected: true,
          notes:       "Auto-created from admission form",
        });
      }
      if (motherName.trim()) {
        parents.push({
          studentId, studentName,
          pickupName:  motherName.trim(),
          relation:    "Mother",
          mobile:      motherPhone || "",
          photoUrl:    motherPhoto || "",
          emergency:   true,
          isParent:    true,
          isProtected: true,
          notes:       "Auto-created from admission form",
        });
      }

      // Fire-and-forget — don't fail the student creation if pickup creation fails
      Promise.allSettled(
        parents.map(p => pickupAuthSvc.create(p, { schoolId, centerId, actorUserId }))
      ).then(results => {
        const failed = results.filter(r => r.status === "rejected");
        if (failed.length) {
          console.warn("[add-student] Auto-pickup creation partial failure:",
            failed.map(f => f.reason?.message).join(", "));
        }
      });
    }

    res.json(result);
  } catch (err) {
    logRouteError("POST /add-student", err);
    res.status(500).json({ success: false, message: "Error adding student", details: err.message });
  }
});

app.put("/update-student/:id", authenticate, authorize("admin","center_admin","teacher","reception","super_admin","developer"), async (req, res) => {
  try {
    const { actorUserId } = resolveContext(req);
    const result = await studentSvc.update(req.params.id, req.body || {}, { actorUserId });
    if (!result) return res.status(404).json({ success: false, message: "Student not found" });
    res.json(result);
  } catch (err) {
    logRouteError("PUT /update-student/:id", err);
    res.status(500).json({ success: false, message: "Update failed", details: err.message });
  }
});

app.delete("/delete-student/:id", authenticate, authorize("admin","super_admin","developer"), async (req, res) => {
  try {
    const { actorUserId } = resolveContext(req);
    const deleted = await studentSvc.remove(req.params.id, { actorUserId });
    if (!deleted) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    logRouteError("DELETE /delete-student/:id", err);
    res.status(500).json({ success: false, message: "Delete failed", details: err.message });
  }
});

// ============================================================
// INVOICES — REST API  (/api/invoices)
// ============================================================

app.get("/api/invoices", authenticate, async (req, res) => {
  try {
    const { schoolId, centerId } = resolveContext(req);
    const { studentId, status }  = req.query;
    const bypassAll = ["developer","super_admin","admin","accountant"].includes(req.user.role);
    const invoices  = await invoiceSvc.getAllInvoices({
      schoolId,
      centerId: bypassAll ? (centerId || undefined) : centerId,
      studentId,
      status,
    });
    res.json({ success: true, invoices });
  } catch (e) {
    logRouteError("GET /api/invoices", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/invoices", authenticate, authorize("admin","center_admin","accountant","super_admin","developer"), async (req, res) => {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const invoice = await invoiceSvc.createInvoice(req.body || {}, { schoolId, centerId, actorUserId });
    res.json({ success: true, invoice });
  } catch (e) {
    logRouteError("POST /api/invoices", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put("/api/invoices/:invoiceNumber", authenticate, authorize("admin","center_admin","accountant","super_admin","developer"), async (req, res) => {
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const updated = await invoiceSvc.updateInvoice(req.params.invoiceNumber, req.body || {}, { schoolId, actorUserId });
    if (!updated) return res.status(404).json({ success: false, error: "Invoice not found." });
    res.json({ success: true, invoice: updated });
  } catch (e) {
    logRouteError("PUT /api/invoices/:invoiceNumber", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete("/api/invoices/:invoiceNumber", authenticate, authorize("admin","super_admin","developer"), async (req, res) => {
  try {
    const { schoolId } = resolveContext(req);
    const deleted = await invoiceSvc.deleteInvoice(req.params.invoiceNumber, { schoolId });
    if (!deleted) return res.status(404).json({ success: false, error: "Invoice not found." });
    res.json({ success: true });
  } catch (e) {
    logRouteError("DELETE /api/invoices/:invoiceNumber", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================
// INVOICES — legacy shim routes (backward-compat for older frontend)
// ============================================================

app.post("/save-invoice", authenticate, authorize("admin","center_admin","accountant","super_admin","developer","teacher"), async (req, res) => {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const invoice = await invoiceSvc.createInvoice(req.body || {}, { schoolId, centerId, actorUserId });
    res.json({ success: true, message: "Invoice saved successfully", invoice });
  } catch (err) {
    logRouteError("POST /save-invoice", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/invoices", authenticate, async (req, res) => {
  try {
    const { schoolId } = resolveContext(req);
    const invoices = await invoiceSvc.getAllInvoices({ schoolId });
    res.json(invoices);
  } catch (err) {
    logRouteError("GET /invoices", err);
    res.status(500).json({ error: "Failed to fetch invoices", details: err.message });
  }
});

app.get("/invoice/:invoiceNumber", authenticate, async (req, res) => {
  try {
    const { schoolId } = resolveContext(req);
    const invoice = await invoiceSvc.getInvoice(req.params.invoiceNumber, { schoolId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, ...invoice });
  } catch (err) {
    logRouteError("GET /invoice/:invoiceNumber", err);
    res.status(500).json({ success: false, message: "Server error", details: err.message });
  }
});

app.post("/record-payment", authenticate, authorize("admin","center_admin","accountant","super_admin","developer","teacher"), async (req, res) => {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const { payment, invoice } = await invoiceSvc.recordPayment(req.body || {}, { schoolId, centerId, actorUserId });
    res.json({ success: true, message: "Payment saved successfully", payment, invoice });
  } catch (err) {
    logRouteError("POST /record-payment", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/payments", authenticate, async (req, res) => {
  try {
    const { schoolId } = resolveContext(req);
    const payments = await invoiceSvc.getAllPayments(null, { schoolId });
    res.json(payments);
  } catch (err) {
    logRouteError("GET /payments", err);
    res.status(500).json({ error: "Failed to fetch payments", details: err.message });
  }
});

// ============================================================
// PAYMENTS — REST API  (/api/payments)
// ============================================================

app.get("/api/payments", authenticate, async (req, res) => {
  try {
    const { schoolId, centerId }          = resolveContext(req);
    const { invoiceNumber, studentId }    = req.query;
    const payments = await invoiceSvc.getAllPayments(invoiceNumber || null, { schoolId, centerId, studentId });
    res.json({ success: true, payments });
  } catch (e) {
    logRouteError("GET /api/payments", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/payments", authenticate, authorize("admin","center_admin","accountant","super_admin","developer","teacher"), async (req, res) => {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const { payment, invoice } = await invoiceSvc.recordPayment(req.body || {}, { schoolId, centerId, actorUserId });
    res.json({ success: true, payment, invoice });
  } catch (e) {
    logRouteError("POST /api/payments", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================
// FEE TEMPLATES — REST API  (/api/fee-templates)
// ============================================================

app.get("/api/fee-templates", authenticate, async (req, res) => {
  try {
    const { schoolId, centerId } = resolveContext(req);
    const templates = await invoiceSvc.getAllTemplates({ schoolId, centerId });
    res.json({ success: true, templates });
  } catch (e) {
    logRouteError("GET /api/fee-templates", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/fee-templates", authenticate, authorize("admin","center_admin","accountant","super_admin","developer"), async (req, res) => {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const template = await invoiceSvc.createTemplate(req.body || {}, { schoolId, centerId, actorUserId });
    res.json({ success: true, template });
  } catch (e) {
    logRouteError("POST /api/fee-templates", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put("/api/fee-templates/:templateId", authenticate, authorize("admin","center_admin","accountant","super_admin","developer"), async (req, res) => {
  try {
    const { actorUserId } = resolveContext(req);
    const template = await invoiceSvc.updateTemplate(req.params.templateId, req.body || {}, { actorUserId });
    if (!template) return res.status(404).json({ success: false, error: "Template not found." });
    res.json({ success: true, template });
  } catch (e) {
    logRouteError("PUT /api/fee-templates/:templateId", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete("/api/fee-templates/:templateId", authenticate, authorize("admin","center_admin","accountant","super_admin","developer"), async (req, res) => {
  try {
    const deleted = await invoiceSvc.deleteTemplate(req.params.templateId);
    if (!deleted) return res.status(404).json({ success: false, error: "Template not found." });
    res.json({ success: true });
  } catch (e) {
    logRouteError("DELETE /api/fee-templates/:templateId", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================
// STUDENT MEDICAL
// ============================================================

app.get("/api/student-medical/:studentId", authenticate, async (req, res) => {
  try {
    const entry = await studentMedicalSvc.get(req.params.studentId);
    res.json({ success: true, entry: entry || null });
  } catch (e) {
    console.error("[GET /api/student-medical]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put("/api/student-medical/:studentId", authenticate, authorize("admin","center_admin","teacher","super_admin","developer"), async (req, res) => {
  try {
    const { studentId } = req.params;
    const {
      bloodGroup, allergies, medications,
      doctorName, doctorPhone, emergencyNotes, notes,
    } = req.body || {};

    const { actorUserId } = resolveContext(req);
    await studentMedicalSvc.upsert(
      { studentId, bloodGroup, allergies, medications, doctorName, doctorPhone, emergencyNotes, notes },
      { actorUserId }
    );
    res.json({ success: true, message: "Medical info saved." });
  } catch (e) {
    console.error("[PUT /api/student-medical]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================
// STUDENT NOTES
// ============================================================

app.get("/api/student-notes/:studentId", authenticate, async (req, res) => {
  try {
    const notes = await studentNotesSvc.getNotes(req.params.studentId);
    res.json({ success: true, notes });
  } catch (e) {
    console.error("[GET /api/student-notes]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/student-notes/:studentId", authenticate, authorize("admin","center_admin","teacher","super_admin","developer"), async (req, res) => {
  try {
    const { note } = req.body || {};
    if (!note?.trim()) return res.status(400).json({ success: false, error: "Note text required." });
    const createdBy = req.user?.name || req.user?.email || "Staff";
    const { actorUserId } = resolveContext(req);
    const entry = await studentNotesSvc.addNote(req.params.studentId, note, actorUserId || createdBy);
    res.json({ success: true, note: entry });
  } catch (e) {
    console.error("[POST /api/student-notes]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete("/api/student-notes/:studentId/:noteId", authenticate, authorize("admin","center_admin","teacher","super_admin","developer"), async (req, res) => {
  try {
    const { studentId, noteId } = req.params;
    const deleted = await studentNotesSvc.deleteNote(studentId, noteId);
    if (!deleted) return res.status(404).json({ success: false, error: "Note not found." });
    res.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/student-notes]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================
// SETTINGS
// ============================================================

// NOTE: /api/settings/users must come BEFORE /api/settings/:section
// so the literal "users" path isn't treated as a section param.

app.get("/api/settings/users", authenticate, authorize("admin","center_admin","super_admin","developer"), async (req, res) => {
  try {
    const { schoolId } = resolveContext(req);
    const users = await settingsSvc.getUsers({ schoolId });
    res.json({ success: true, users });
  } catch (e) {
    logRouteError("GET /api/settings/users", e);
    res.status(500).json({ error: "Failed to load users", details: e.message });
  }
});

app.post("/api/settings/users", authenticate, authorize("admin","super_admin","developer"), async (req, res) => {
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const user = await settingsSvc.createUser(req.body || {}, { actorUserId });
    res.json({ success: true, user });
  } catch (e) {
    logRouteError("POST /api/settings/users", e);
    res.status(500).json({ error: "Failed to create user", details: e.message });
  }
});

app.put("/api/settings/users/:id", authenticate, authorize("admin","super_admin","developer"), async (req, res) => {
  try {
    const { actorUserId } = resolveContext(req);
    const user = await settingsSvc.updateUser(req.params.id, req.body || {}, { updatedBy: actorUserId });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user });
  } catch (e) {
    logRouteError(`PUT /api/settings/users/${req.params.id}`, e);
    res.status(500).json({ error: "Failed to update user", details: e.message });
  }
});

app.get("/api/settings", authenticate, async (req, res) => {
  try {
    const settings = await settingsSvc.getAllSettings();
    res.json(settings);
  } catch (e) {
    logRouteError("GET /api/settings", e);
    res.status(500).json({ error: "Failed to load settings", details: e.message });
  }
});

app.put("/api/settings/:section", authenticate, authorize("admin","super_admin","developer"), async (req, res) => {
  try {
    const { section } = req.params;
    const data = req.body?.data || req.body || {};
    if (!section || typeof data !== "object") {
      return res.status(400).json({ error: "section param and data body are required" });
    }
    await settingsSvc.saveSection(section, data);
    res.json({ success: true, section });
  } catch (e) {
    logRouteError(`PUT /api/settings/${req.params.section}`, e);
    res.status(500).json({ error: "Failed to save settings", details: e.message });
  }
});

// ============================================================
// PAYMENT RECEIPT (stub)
// ============================================================

app.get("/payment-receipt/:invoiceNumber", authenticate, (req, res) => {
  res.status(501).json({ message: "PDF receipt generation not yet implemented" });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[global-error]", err.message, err.stack);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

// ============================================================
// STARTUP  (only when run directly, not when imported by Cloud Functions)
// ============================================================

function runStartupDiagnostics() {
  const hasCreds = !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!hasCreds) {
    console.warn("⚠️   No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT in .env");
  } else {
    console.log("    Firebase Admin credentials configured ✓");
  }
  console.log(`    School ID: ${process.env.SCHOOL_ID || "yd-main (default)"}`);
}

// When run directly (`node server.js` or `npm start`) → start HTTP server.
// When imported by index.js (Cloud Functions) → just export the Express app.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀  Server Running On Port ${PORT}`);
    runStartupDiagnostics();
  });
}

module.exports = app;
