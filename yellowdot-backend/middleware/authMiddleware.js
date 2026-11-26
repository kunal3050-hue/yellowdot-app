/**
 * authMiddleware.js — Firebase ID token verification
 * ────────────────────────────────────────────────────
 * Verifies the Firebase ID token sent in the Authorization header.
 *
 * Attaches to req.user:
 *   userId, email, role, schoolId, centerId, centers[],
 *   name, photoUrl, permissions, student (parents only)
 *
 * Role resolution order:
 *   1. Firestore users/{uid}               → staff user (direct UID match)
 *      A doc with no `role` field resolves to role="unknown" + profileMissing,
 *      NOT to a default staff role — see _buildUserFromDoc. Fail closed.
 *   1b. Firestore users where email==email → handles Google OAuth UID mismatch
 *       (Firebase creates a new UID for Google sign-in when the email already
 *        has a password-based account; email fallback finds the existing profile.
 *        A Firestore doc for the new Google UID is auto-created on first match.)
 *   2. students collection                 → parent (fatherEmail / motherEmail)
 *   3. No match                            → role = "unknown", profileMissing = true
 *
 * A user document does not carry the parent↔child link — that lives only in the
 * students collection. So whenever paths 1 or 1b resolve role="parent", the link
 * is looked up and attached too (_attachLinkedStudent). Without it a parent who
 * happens to have a users doc authenticates fine but every child-scoped endpoint
 * denies them, because req.user.student is what those endpoints read.
 *
 * schoolId resolution:
 *   1. User doc has schoolId field   → use it
 *   2. SCHOOL_ID env var             → use it
 *   3. Default "yd-main"
 *
 * Debug logs: every resolution step is logged with [AUTH-DEBUG] prefix.
 */

const { auth, db }       = require("../firebaseAdmin");
const { isBypassRole, ROLE_PERMISSIONS } = require("../config/permissionsBackend");
const roleSvc            = require("../services/roleService");

const DEFAULT_SCHOOL_ID  = process.env.SCHOOL_ID || "yd-main";

// tenantMiddleware -> tenantService -> firebaseAdmin never reaches back here,
// so this import introduces no cycle.
const { enforceTenant, attachTenantStatus } = require("./tenantMiddleware");

// ── Internal helpers ───────────────────────────────────────────────

/**
 * Build req.user from a Firestore user document snapshot/data + the decoded token.
 * Logs any missing critical fields so they appear clearly in server logs.
 */
async function _buildUserFromDoc(uid, docData, decoded) {
  const missingFields = [];
  if (!docData.role)                      missingFields.push("role");
  if (!docData.schoolId)                  missingFields.push("schoolId");
  if (!docData.centerId && !docData.center) missingFields.push("centerId/center");
  if (!docData.name)                      missingFields.push("name");

  if (missingFields.length > 0) {
    console.warn(
      `[AUTH-DEBUG] User doc users/${uid} is missing fields: [${missingFields.join(", ")}]` +
      ` — email=${decoded.email || "(none)"} role=${docData.role || "(missing)"}`,
    );
  }

  // A user doc with no `role` field must NOT inherit a working role. Defaulting
  // to a real role here would fail OPEN: firestore.rules grants `teacher` read
  // access to every student in the school, so a half-provisioned user doc would
  // silently become a staff account with school-wide read. Resolve to the
  // "unknown" sentinel instead — blockUnknown/staffOnly reject it, and
  // /api/auth returns the friendly ACCOUNT_NOT_REGISTERED response.
  const _schoolId = docData.schoolId || DEFAULT_SCHOOL_ID;

  if (!docData.role) {
    console.warn(
      `[AUTH-DEBUG] Profile resolved with NO ROLE — uid=${uid}` +
      ` schoolId=${_schoolId} — denying as role="unknown" (fail closed).` +
      ` Fix the users/${uid} doc to grant access.`,
    );
    return {
      userId:    uid,
      email:     decoded.email || docData.email || "",
      role:      "unknown",
      schoolId:  _schoolId,
      centerId:  docData.centerId || docData.center || "",
      center:    docData.centerId || docData.center || "",
      centers:   Array.isArray(docData.centers) ? docData.centers
                 : (docData.center ? [docData.center] : []),
      name:      docData.name    || decoded.name    || "",
      photoUrl:  docData.photoUrl || decoded.picture || "",
      permissions: [],
      profileMissing: true,   // surfaced to frontend for user-friendly error
    };
  }

  const _role = docData.role;

  console.log(
    `[AUTH-DEBUG] Profile resolved — uid=${uid}` +
    ` role=${_role} schoolId=${_schoolId} centerId=${docData.centerId || docData.center || "(none)"}`,
  );

  return {
    userId:    uid,
    email:     decoded.email || docData.email || "",
    role:      _role,
    schoolId:  _schoolId,
    centerId:  docData.centerId || docData.center || "",
    center:    docData.centerId || docData.center || "",
    centers:   Array.isArray(docData.centers) ? docData.centers
               : (docData.center ? [docData.center] : []),
    name:      docData.name    || decoded.name    || "",
    photoUrl:  docData.photoUrl || decoded.picture || "",
    permissions: await roleSvc.getPermissionsForRole(_role, _schoolId),
    roleMatrix:  await roleSvc.getRoleMatrix(_role, _schoolId),
  };
}

/**
 * Shape a matched student snapshot into the link both callers rely on.
 *
 * `studentId` falls back to the Firestore document id. A student document is
 * written with its id in BOTH places — studentService.create() sets the field
 * and uses the same value as the document id — but only the document id is
 * guaranteed, because the field can be absent on a record that arrived any
 * other way (an import, a migration, a seed, a hand-written fixture).
 *
 * Without the fallback such a record matches the query and then resolves to
 * `studentId: undefined`, so `requireOwnChild` reads no linked id and denies
 * EVERY child-scoped endpoint with NO_LINKED_STUDENT — the parent's own fees,
 * journey, attendance and care. The failure is particularly unhelpful because
 * `/api/parent/me` and `/api/parent/children` resolve through the `parents`
 * collection instead and keep working, so the family sees a populated home
 * screen above a wall of "no student linked".
 *
 * Every other reader in the codebase already does this: studentService's own
 * shaping function is `studentId: d.studentId || id`, and getOne/update/remove
 * each fall back to a field query when the document id misses. This was the
 * one lookup that trusted the field alone.
 */
function _toStudentLink(snap) {
  const d = snap.data();
  return { ...d, studentId: d.studentId || snap.id };
}

/**
 * Find the student record linked to a parent's email address.
 * fatherEmail first, then motherEmail — the order parent resolution has always
 * used. Returns the student document data, or null when no student carries it.
 *
 * This is the ONLY copy of the parent↔child lookup. Every path that can resolve
 * a parent goes through it, so a parent's child link cannot depend on which
 * branch happened to resolve their profile.
 */
async function _findLinkedStudent(email) {
  if (!email) return null;

  const fatherSnap = await db.collection("students")
    .where("fatherEmail", "==", email)
    .limit(1)
    .get();

  if (!fatherSnap.empty) {
    const doc = _toStudentLink(fatherSnap.docs[0]);
    console.log(`[AUTH-DEBUG] Parent match via fatherEmail — studentId=${doc.studentId}`);
    return doc;
  }

  const motherSnap = await db.collection("students")
    .where("motherEmail", "==", email)
    .limit(1)
    .get();

  if (!motherSnap.empty) {
    const doc = _toStudentLink(motherSnap.docs[0]);
    console.log(`[AUTH-DEBUG] Parent match via motherEmail — studentId=${doc.studentId}`);
    return doc;
  }

  return null;
}

/**
 * Attach the child link to a parent whose profile came from a users document.
 *
 * Only ever ADDS `student`, and only for role="parent" — schoolId, centerId and
 * centers stay exactly what the user document said, because that document is
 * authoritative for tenant scoping on this path and always has been. A parent
 * with no matching student keeps student=undefined, so child-scoped endpoints
 * still fail closed.
 */
async function _attachLinkedStudent(user, email) {
  if (user.role !== "parent" || user.student) return;

  const studentDoc = await _findLinkedStudent(email);
  if (!studentDoc) {
    console.warn(
      `[AUTH-DEBUG] Parent profile users/${user.userId} has NO student linked to` +
      ` email=${email || "(none)"} — child-scoped endpoints will deny.`,
    );
    return;
  }

  user.student = {
    studentId:   studentDoc.studentId,
    studentName: studentDoc.studentName,
  };
  console.log(`[AUTH-DEBUG] Child link attached — studentId=${studentDoc.studentId}`);
}

// ── Middleware ─────────────────────────────────────────────────────

async function _authenticateOnly(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const token = authHeader.slice(7);

  try {
    // AUTH STEP 1 — verify Firebase ID token
    const decoded = await auth.verifyIdToken(token);
    const uid     = decoded.uid;
    const email   = (decoded.email || "").toLowerCase();
    console.log(`[AUTH-DEBUG] Token verified — uid=${uid} email=${decoded.email || "(none)"} provider=${decoded.firebase?.sign_in_provider || "?"}`);

    // AUTH STEP 2 — direct UID lookup in Firestore users collection
    console.log(`[AUTH-DEBUG] AUTH STEP 2 — Firestore users/${uid} lookup`);
    const userDoc = await db.collection("users").doc(uid).get();
    console.log(`[AUTH-DEBUG] Firestore users/${uid} → exists=${userDoc.exists}`);

    if (userDoc.exists) {
      // AUTH STEP 3 — build user from UID match
      console.log(`[AUTH-DEBUG] AUTH STEP 3 — building user from UID doc`);
      req.user = await _buildUserFromDoc(uid, userDoc.data(), decoded);
      await _attachLinkedStudent(req.user, email);
      console.log(`[AUTH-DEBUG] AUTH STEP 3 complete — role=${req.user.role} schoolId=${req.user.schoolId}`);
      return next();
    }

    // ── 1b. Email-based fallback ───────────────────────────────────────────────
    // Handles: admin pre-creates user with password auth → user signs in with
    // Google → Firebase Email Enumeration Protection creates a new UID.
    // We find the profile by email and auto-link the new Google UID to it.
    if (email) {
      // AUTH STEP 3b — email fallback
      console.log(`[AUTH-DEBUG] AUTH STEP 3b — UID miss, email fallback for ${email}`);
      const emailSnap = await db.collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!emailSnap.empty) {
        const matchedDoc  = emailSnap.docs[0];
        const matchedData = matchedDoc.data();
        const originalUid = matchedDoc.id;

        console.warn(
          `[AUTH-DEBUG] UID MISMATCH — email=${email}` +
          ` uid_in_token=${uid} uid_in_doc=${originalUid}` +
          ` provider=${decoded.firebase?.sign_in_provider || "?"}` +
          ` — auto-linking Google UID to existing profile.`,
        );

        // Build req.user using the matched profile data but the CURRENT uid
        req.user = await _buildUserFromDoc(uid, matchedData, decoded);
        await _attachLinkedStudent(req.user, email);

        // Write a mirror profile for the Google UID so future sign-ins hit the
        // direct UID lookup (path 1) instead of this fallback.
        //
        // The mirror deliberately carries NO email. This block used to copy
        // matchedData wholesale, address included, which left two documents
        // claiming one address — and the very fallback above resolves an
        // address with limit(1), so which profile (and therefore which role)
        // won was down to Firestore's ordering. That is how the duplicate in
        // production was manufactured: not by anyone creating an account
        // twice, but by this write, every time someone with a password account
        // signed in with Google.
        //
        // Dropping the address means exactly one document owns it, so the
        // fallback is unambiguous and deleting a stale mirror actually sticks —
        // a re-created mirror no longer brings the duplicate back with it.
        //
        // The mirror cannot simply be skipped: firestore.rules resolves a
        // caller's role with get(/databases/../users/$(request.auth.uid)), so a
        // Google UID with no document of its own loses client-side Firestore
        // access entirely. It has to exist, and it has to carry the role.
        //
        // aliasOf marks it as a mirror so other code can find it — the role
        // sync in staffController updates mirrors alongside the profile they
        // point at, otherwise the two could drift apart.
        const { email: _mirrorEmailOmitted, ...mirrorProfile } = matchedData;
        db.collection("users").doc(uid).set(
          {
            ...mirrorProfile,
            userId:      uid,            // update to Google UID
            aliasOf:     originalUid,    // this is a mirror of that profile
            linkedUid:   originalUid,    // kept: pre-existing audit trail field
            updatedAt:   new Date().toISOString(),
          },
          { merge: true },
        ).then(() =>
          console.log(`[AUTH-DEBUG] Auto-linked Google UID ${uid} to profile of ${email} (original uid: ${originalUid})`),
        ).catch(err =>
          console.error(`[AUTH-DEBUG] Auto-link write failed:`, err.message),
        );

        return next();
      }

      console.log(`[AUTH-DEBUG] Email fallback miss — no users doc with email=${email}`);
    }


    // ── 1c. Platform operator — platformUsers directory ───────────────────────
    // A platform operator is staff of the PLATFORM, not of any school, so they
    // get their own collection rather than a users/{uid} doc. Three concrete
    // reasons, all of which bite otherwise (docs/platform-access-model.md §3.2):
    // schoolId falls back to DEFAULT_SCHOOL_ID here, so they would silently
    // join whichever school that names; enforceTenant would then let that
    // school's suspension lock them out of the console used to un-suspend it;
    // and firestore.rules keys on me().schoolId, so a users doc would grant
    // SDK-level read access to that school's documents.
    //
    // Checked AFTER the users collection, not before as the design document
    // first proposed. Resolving platform identity first would mean anyone who
    // holds both docs loses their school identity — which is precisely the
    // lockout fixed in e24e37d. School identity always wins; a pure platform
    // operator simply has no users doc. The conflict is logged rather than
    // silently resolved, because it means someone's intent is unclear.
    {
      let platformDoc = await db.collection("platformUsers").doc(uid).get();

      // Email fallback so an operator can be provisioned before they first
      // sign in, when their uid is not yet known — same reason the users
      // collection has one.
      if (!platformDoc.exists && email) {
        const snap = await db.collection("platformUsers")
          .where("email", "==", email).limit(1).get();
        if (!snap.empty) platformDoc = snap.docs[0];
      }

      if (platformDoc.exists) {
        const d = platformDoc.data() || {};
        const role = d.role || "platform_admin";

        if (d.status && d.status !== "active") {
          console.warn(`[AUTH-DEBUG] platformUsers/${platformDoc.id} status=${d.status} — denying`);
          return res.status(403).json({
            error: "This operator account is not active.",
            code:  "PLATFORM_ACCOUNT_INACTIVE",
          });
        }

        // No schoolId, deliberately. It is the absence of one that keeps a
        // platform operator out of every school's data, and enforceTenant
        // recognises platform roles rather than demanding a tenant.
        req.user = {
          userId:      platformDoc.id,
          email:       d.email || email || "",
          name:        d.name || decoded.name || "",
          photoUrl:    d.photoUrl || decoded.picture || "",
          role,
          isPlatform:  true,
          permissions: await roleSvc.getPermissionsForRole(role, null),
          roleMatrix:  await roleSvc.getRoleMatrix(role, null),
        };
        console.log(`[AUTH-DEBUG] Platform operator resolved — uid=${platformDoc.id} role=${role}`);
        return next();
      }
    }

    // ── 2. Parent — email match in students collection ────────────────────────
    if (email) {
      // AUTH STEP 4 — parent lookup
      console.log(`[AUTH-DEBUG] AUTH STEP 4 — parent lookup for email=${email}`);
      const studentDoc = await _findLinkedStudent(email);

      if (studentDoc) {
        const resolvedCenter = studentDoc.centerId || studentDoc.center || "";
        req.user = {
          userId:    uid,
          email:     decoded.email || "",
          role:      "parent",
          schoolId:  studentDoc.schoolId || DEFAULT_SCHOOL_ID,
          centerId:  resolvedCenter,
          center:    resolvedCenter,
          centers:   [resolvedCenter].filter(Boolean),
          name:      decoded.name    || "",
          photoUrl:  decoded.picture || "",
          student:   {
            studentId:   studentDoc.studentId,
            studentName: studentDoc.studentName,
          },
          permissions: await roleSvc.getPermissionsForRole("parent", studentDoc.schoolId || DEFAULT_SCHOOL_ID),
        };
        return next();
      }

      console.log(`[AUTH-DEBUG] No parent match for email=${email}`);
    }

    // ── 3. Authenticated but no matching profile found ────────────────────────
    console.warn(
      `[AUTH-DEBUG] PROFILE MISSING — uid=${uid} email=${decoded.email || "(none)"}` +
      ` provider=${decoded.firebase?.sign_in_provider || "?"}` +
      ` — No Firestore staff doc or parent email match found.` +
      ` Ensure admin has created a user with POST /api/users for this email.`,
    );

    req.user = {
      userId:       uid,
      email:        decoded.email || "",
      role:         "unknown",
      schoolId:     DEFAULT_SCHOOL_ID,
      centerId:     "",
      center:       "",
      centers:      [],
      name:         decoded.name || "",
      photoUrl:     decoded.picture || "",
      permissions:  [],
      profileMissing: true,   // surfaced to frontend for user-friendly error
    };
    next();

  } catch (err) {
    if (err.code === "auth/id-token-expired") {
      return res.status(401).json({
        error: "Session expired. Please log in again.",
        code:  "TOKEN_EXPIRED",
      });
    }
    console.error("[auth-middleware] Authentication failed:", err.message);
    console.error("[auth-middleware] Full error:", err);
    console.error("[auth-middleware] Stack:", err.stack);
    return res.status(401).json({ error: "Invalid authentication token." });
  }
}

// ── Authorization helpers ──────────────────────────────────────────

/**
 * Role-based access — allow if user's role is in the allowed list.
 * Bypass roles (developer, super_admin) always pass.
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (isBypassRole(req.user.role)) return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have access to this resource." });
    }
    next();
  };
}

/**
 * Permission-based access — allow if user has the named route permission.
 */
function authorizeRoute(routeKey) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (isBypassRole(req.user.role)) return next();
    const perms = req.user.permissions || [];
    if (!perms.includes("*") && !perms.includes(routeKey)) {
      return res.status(403).json({ error: "You do not have access to this module." });
    }
    next();
  };
}

function getPermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

// ── Security guards ────────────────────────────────────────────────

/**
 * blockUnknown — rejects Firebase-authenticated users who have no matching
 * staff record OR parent link in Firestore. Prevents "ghost" accounts from
 * reading any data.
 */
function blockUnknown(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (req.user.role === "unknown") {
    return res.status(403).json({
      error: "Your account is not registered in this system. Contact your administrator.",
      code:  "ACCOUNT_NOT_REGISTERED",
    });
  }
  next();
}

/**
 * staffOnly — allows only registered staff roles through. Blocks:
 *   - "unknown" (not registered)
 *   - "parent"  (must use the parent-specific endpoints)
 * Bypass roles (developer, super_admin) always pass.
 */
function staffOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (isBypassRole(req.user.role)) return next();
  if (req.user.role === "unknown") {
    return res.status(403).json({
      error: "Your account is not registered in this system. Contact your administrator.",
      code:  "ACCOUNT_NOT_REGISTERED",
    });
  }
  if (req.user.role === "parent") {
    return res.status(403).json({
      error: "Parents cannot access staff-only resources.",
      code:  "PARENT_ACCESS_DENIED",
    });
  }
  next();
}

/**
 * requireOwnChild — for parent-facing endpoints.
 * - Bypass roles pass through with no restriction.
 * - Non-parent roles (staff) receive a 403.
 * - Parent must have a linked student; if a studentId is present in
 *   params/query/body it must match the linked child.
 * Sets req.ownChildId = linkedStudentId so controllers can use it directly.
 */
function requireOwnChild(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (isBypassRole(req.user.role)) return next(); // developers / super_admin see all

  if (req.user.role !== "parent") {
    return res.status(403).json({
      error: "This endpoint is for parents only.",
      code:  "STAFF_ACCESS_DENIED",
    });
  }

  const linkedId = req.user.student?.studentId;
  if (!linkedId) {
    return res.status(403).json({
      error: "No student linked to this parent account. Contact your administrator.",
      code:  "NO_LINKED_STUDENT",
    });
  }

  // If a studentId was supplied, it must match the linked child
  const requestedId =
    req.params.studentId ||
    req.params.id        ||
    req.query.studentId  ||
    req.body?.studentId;

  if (requestedId && requestedId !== linkedId) {
    return res.status(403).json({
      error: "You can only access your own child's records.",
      code:  "CHILD_SCOPE_VIOLATION",
    });
  }

  req.ownChildId = linkedId; // controllers read this instead of req.body/query
  next();
}

/**
 * Paths that stay reachable for a suspended or cancelled school.
 *
 * Without these the client cannot find out WHY it is blocked: /api/auth/me is
 * the boot call that gates the whole UI, so blocking it makes a suspended
 * school look broken rather than suspended. sync-user runs at login before a
 * profile exists, and logout must always work — locking someone out of the
 * app should not also trap them signed in.
 *
 * Everything else, including refresh-permissions and select-center, is gated.
 */
const TENANT_GATE_EXEMPT = new Set([
  "/api/auth/me",
  "/api/auth/sync-user",
  "/api/auth/logout",
]);

/**
 * authenticate + tenant status gate.
 *
 * tenantMiddleware documents its own usage as `app.use(authenticate,
 * enforceTenant, ...)`, but it was never wired that way. server.js mounted it
 * as app-level middleware on /api that returned early when req.user was unset
 * — and because authenticate runs per-route, req.user is ALWAYS unset at that
 * point, so enforceTenant never ran once. Suspending a school wrote a field
 * and changed nothing else.
 *
 * Composing it here fixes that for every authenticated route at once, present
 * and future, instead of adding a middleware to 300+ route definitions and
 * relying on nobody forgetting it on the next one.
 *
 * _authenticateOnly has nine separate next() exits; wrapping its callback
 * catches all of them, which editing each one would not reliably do.
 */
async function authenticate(req, res, next) {
  return _authenticateOnly(req, res, (err) => {
    if (err) return next(err);
    // Routes that authenticate optionally can reach here with no user.
    if (!req.user) return next();
    if (TENANT_GATE_EXEMPT.has(req.path)) return attachTenantStatus(req, res, next);
    return enforceTenant(req, res, next);
  });
}

module.exports = { authenticate, authorize, authorizeRoute, blockUnknown, staffOnly, requireOwnChild, TENANT_GATE_EXEMPT };
