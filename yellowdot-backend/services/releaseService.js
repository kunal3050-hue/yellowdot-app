/**
 * releaseService.js — Staged Release Dashboard backend.
 *
 * Source of truth for all modules, their lifecycle status, and the audit log.
 *
 * Status pipeline: development → testing → production
 *   development  = being built; not yet ready for QA
 *   testing      = feature-complete on Yellow Dot; under QA / review
 *   production   = approved and live on KUE Boxs Care
 *
 * Firestore collections:
 *   releaseModules/{schoolId}_{moduleKey}  — per-module state overrides
 *   releaseAudits/{auditId}               — immutable event log
 */

const { db }         = require('../firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

const SCHOOL_ID = process.env.SCHOOL_ID || 'ydseawoods';

// ── Module registry ────────────────────────────────────────────────────────────
// Single source of truth for every module's metadata. Keep in sync with
// featureFlags.js FLAG_GROUPS when adding new modules.

const MODULE_REGISTRY = {
  STUDENTS:           { name: 'Students',           description: 'Student profiles and enrollment',        version: '1.0.0'  },
  ATTENDANCE:         { name: 'Attendance',          description: 'Daily check-in and check-out tracking',  version: '1.0.0'  },
  FEES:               { name: 'Fees',                description: 'Fee management and billing',              version: '1.0.0'  },
  INVOICES:           { name: 'Invoices',            description: 'Invoice generation and tracking',         version: '1.0.0'  },
  NOTIFICATIONS:      { name: 'Notifications',       description: 'Push and in-app notifications',           version: '1.1.2'  },
  GATE_MANAGEMENT:    { name: 'Gate Management',     description: 'QR-based gate entry system',              version: '1.1.0'  },
  PARENT_PORTAL:      { name: 'Parent Portal',       description: 'Parent-facing mobile experience',         version: '1.1.0'  },
  FAMILY_MODULE:      { name: 'Family Module',       description: 'Sibling and family linking',              version: '1.1.4'  },
  CHILD_PRESENCE:     { name: 'Child Presence',      description: 'Real-time child location tracking',       version: '1.1.5'  },
  PICKUP_REQUEST:     { name: 'Pickup Request',      description: 'Parent pickup with gate alerts',          version: '1.1.5'  },
  DAILY_CARE:         { name: 'Daily Care',          description: 'Meals, nap, and hygiene logs',            version: '1.2.0'  },
  HIGHLIGHTS:         { name: 'Highlights',          description: 'Child moments and photo sharing',         version: '1.2.0'  },
  LIVE_DASHBOARD:     { name: 'Live Dashboard',      description: 'Real-time classroom monitoring',          version: '1.2.0'  },
  STUDENT_REPORTS_V2: { name: 'Student Reports V2',  description: 'Enhanced analytics and reports',          version: '1.2.0'  },
  CHILD_JOURNEY:      { name: 'Child Journey',       description: 'Milestones and learning timeline',        version: '1.2.0'  },
  MESSAGING:          { name: 'Messaging',           description: 'Parent-staff direct messaging',           version: null     },
  TIMETABLE:          { name: 'Timetable',           description: 'Class schedules and timetables',          version: null     },
  PAYROLL:            { name: 'Payroll',             description: 'Staff payroll management',                version: null     },
};

// Default status by flag group — before any Firestore override.
const DEFAULT_STATUS = {
  STUDENTS:           'production',
  ATTENDANCE:         'production',
  FEES:               'production',
  INVOICES:           'production',
  NOTIFICATIONS:      'production',
  GATE_MANAGEMENT:    'production',
  PARENT_PORTAL:      'production',
  FAMILY_MODULE:      'production',
  CHILD_PRESENCE:     'production',
  PICKUP_REQUEST:     'production',
  DAILY_CARE:         'testing',
  HIGHLIGHTS:         'testing',
  LIVE_DASHBOARD:     'testing',
  STUDENT_REPORTS_V2: 'testing',
  CHILD_JOURNEY:      'testing',
  MESSAGING:          'development',
  TIMETABLE:          'development',
  PAYROLL:            'development',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function moduleDocId(moduleKey) {
  return `${SCHOOL_ID}_${moduleKey}`;
}

function serializeTimestamp(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return ts;
}

function serializeDoc(data) {
  const out = { ...data };
  for (const k of ['promotedAt', 'rolledBackAt', 'updatedAt', 'createdAt', 'timestamp']) {
    if (k in out) out[k] = serializeTimestamp(out[k]);
  }
  return out;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns all modules merged with any Firestore overrides.
 */
async function getModules() {
  const snap = await db.collection('releaseModules')
    .where('schoolId', '==', SCHOOL_ID)
    .get();

  const overrides = {};
  snap.forEach(doc => { overrides[doc.data().moduleKey] = serializeDoc(doc.data()); });

  return Object.entries(MODULE_REGISTRY).map(([key, meta]) => {
    const ov = overrides[key] || {};
    return {
      moduleKey:        key,
      name:             meta.name,
      description:      meta.description,
      version:          ov.version || meta.version,
      status:           ov.status  || DEFAULT_STATUS[key] || 'development',
      promotedAt:       ov.promotedAt       || null,
      promotedBy:       ov.promotedBy       || null,
      promotedByName:   ov.promotedByName   || null,
      promotedByEmail:  ov.promotedByEmail  || null,
      releaseNote:      ov.releaseNote      || null,
      rolledBackAt:     ov.rolledBackAt     || null,
      rolledBackBy:     ov.rolledBackBy     || null,
      rolledBackByName: ov.rolledBackByName || null,
      rollbackReason:   ov.rollbackReason   || null,
    };
  });
}

/**
 * Promotes a module to 'production'. Writes a Firestore module doc + audit entry.
 */
async function promoteModule({ moduleKey, releaseNote, version, performedBy, performedByName, performedByEmail }) {
  if (!MODULE_REGISTRY[moduleKey]) throw new Error(`Unknown module: ${moduleKey}`);

  const meta    = MODULE_REGISTRY[moduleKey];
  const now     = FieldValue.serverTimestamp();
  const docRef  = db.collection('releaseModules').doc(moduleDocId(moduleKey));
  const auditRef = db.collection('releaseAudits').doc();

  const existingSnap = await docRef.get();
  const fromStatus   = existingSnap.exists
    ? existingSnap.data().status
    : DEFAULT_STATUS[moduleKey] || 'testing';

  const batch = db.batch();

  batch.set(docRef, {
    schoolId:        SCHOOL_ID,
    moduleKey,
    name:            meta.name,
    status:          'production',
    version:         version || meta.version || '1.0.0',
    releaseNote:     releaseNote || '',
    promotedAt:      now,
    promotedBy:      performedBy,
    promotedByName:  performedByName || '',
    promotedByEmail: performedByEmail || '',
    updatedAt:       now,
  }, { merge: true });

  batch.set(auditRef, {
    schoolId:        SCHOOL_ID,
    moduleKey,
    moduleName:      meta.name,
    action:          'promote',
    fromStatus,
    toStatus:        'production',
    version:         version || meta.version || '1.0.0',
    releaseNote:     releaseNote || '',
    performedBy,
    performedByName: performedByName || '',
    performedByEmail: performedByEmail || '',
    timestamp:       now,
  });

  await batch.commit();
  return { success: true, moduleKey, status: 'production' };
}

/**
 * Rolls a module back from 'production' to 'testing'. Writes module doc + audit entry.
 */
async function rollbackModule({ moduleKey, reason, performedBy, performedByName, performedByEmail }) {
  if (!MODULE_REGISTRY[moduleKey]) throw new Error(`Unknown module: ${moduleKey}`);

  const meta    = MODULE_REGISTRY[moduleKey];
  const now     = FieldValue.serverTimestamp();
  const docRef  = db.collection('releaseModules').doc(moduleDocId(moduleKey));
  const auditRef = db.collection('releaseAudits').doc();

  const existingSnap = await docRef.get();
  const fromStatus   = existingSnap.exists
    ? existingSnap.data().status
    : DEFAULT_STATUS[moduleKey] || 'production';

  const batch = db.batch();

  batch.set(docRef, {
    schoolId:           SCHOOL_ID,
    moduleKey,
    name:               meta.name,
    status:             'testing',
    rolledBackAt:       now,
    rolledBackBy:       performedBy,
    rolledBackByName:   performedByName || '',
    rolledBackByEmail:  performedByEmail || '',
    rollbackReason:     reason || '',
    updatedAt:          now,
  }, { merge: true });

  batch.set(auditRef, {
    schoolId:           SCHOOL_ID,
    moduleKey,
    moduleName:         meta.name,
    action:             'rollback',
    fromStatus,
    toStatus:           'testing',
    rollbackReason:     reason || '',
    performedBy,
    performedByName:    performedByName || '',
    performedByEmail:   performedByEmail || '',
    timestamp:          now,
  });

  await batch.commit();
  return { success: true, moduleKey, status: 'testing' };
}

/**
 * Returns the full audit log for this school, newest first.
 */
async function getAuditLog({ limit = 100 } = {}) {
  const snap = await db.collection('releaseAudits')
    .where('schoolId', '==', SCHOOL_ID)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => serializeDoc({ id: doc.id, ...doc.data() }));
}

module.exports = { getModules, promoteModule, rollbackModule, getAuditLog, MODULE_REGISTRY, DEFAULT_STATUS };
