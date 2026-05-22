/**
 * rbacConfig.js — Yellow Dot RBAC front-end configuration
 * ─────────────────────────────────────────────────────────
 * Single source of truth for:
 *   - Permission categories, modules, and supported actions
 *   - Permission dependency rules (create → auto-enable view)
 *   - Staff type categories
 *   - Role colour presets
 *   - One-click role templates
 *   - Module → route-key mapping (for sidebar preview)
 */

// ── Action metadata (labels only — no colour coding per-action) ───────────────
export const ACTIONS = {
  view:    { label: "View" },
  create:  { label: "Create" },
  edit:    { label: "Edit" },
  delete:  { label: "Delete" },
  export:  { label: "Export" },
  approve: { label: "Approve" },
  manage:  { label: "Manage" },
  mark:    { label: "Mark" },
  upload:  { label: "Upload" },
};

// ── Permission dependency rules ───────────────────────────────────────────────
// "If you grant X, you must also grant Y."
// Used in applyPermissionDependencies() below.
export const PERMISSION_DEPS = {
  create:  ["view"],
  edit:    ["view"],
  delete:  ["view"],
  export:  ["view"],
  approve: ["view"],
  mark:    ["view"],
  manage:  ["view"],
  upload:  ["view"],
};

// ── Staff type categories ─────────────────────────────────────────────────────
export const STAFF_CATEGORIES = [
  { id: "academic",    label: "Academic",        color: "#059669" },
  { id: "finance",     label: "Finance",          color: "#2563eb" },
  { id: "operations",  label: "Operations",       color: "#d97706" },
  { id: "security",    label: "Security",         color: "#dc2626" },
  { id: "support",     label: "Parent Support",   color: "#7c3aed" },
  { id: "management",  label: "Management",       color: "#0f172a" },
];

// ── Role colour presets ───────────────────────────────────────────────────────
export const ROLE_COLOR_PRESETS = [
  { label: "Violet",  hex: "#7c3aed" },
  { label: "Blue",    hex: "#2563eb" },
  { label: "Cyan",    hex: "#0891b2" },
  { label: "Green",   hex: "#059669" },
  { label: "Amber",   hex: "#d97706" },
  { label: "Orange",  hex: "#ea580c" },
  { label: "Red",     hex: "#dc2626" },
  { label: "Pink",    hex: "#db2777" },
  { label: "Slate",   hex: "#475569" },
  { label: "Gold",    hex: "#b45309" },
  { label: "Indigo",  hex: "#4338ca" },
  { label: "Teal",    hex: "#0d9488" },
];

// ── Permission categories and modules ─────────────────────────────────────────
export const PERMISSION_CATEGORIES = [
  {
    id:    "core",
    label: "Core",
    icon:  "🏠",
    modules: [
      { id: "dashboard", label: "Dashboard", actions: ["view"] },
      { id: "documents", label: "Documents", actions: ["view", "upload", "delete", "export"] },
    ],
  },
  {
    id:    "people",
    label: "People",
    icon:  "👥",
    modules: [
      { id: "students",   label: "Students",   actions: ["view", "create", "edit", "delete", "export"] },
      { id: "admissions", label: "Admissions", actions: ["view", "create", "edit", "approve"] },
      { id: "attendance", label: "Attendance", actions: ["view", "mark", "edit", "export"] },
    ],
  },
  {
    id:    "daily_ops",
    label: "Daily Ops",
    icon:  "⚙️",
    modules: [
      { id: "nap_tracking", label: "Nap Tracking",     actions: ["view", "mark", "edit"] },
      { id: "pickup_auth",  label: "Pickup Auth",      actions: ["view", "create", "edit", "approve"] },
      { id: "medical",      label: "Medical Records",  actions: ["view", "edit"] },
      { id: "food_menu",    label: "Food & Menu",      actions: ["view", "create", "edit", "delete"] },
    ],
  },
  {
    id:    "finance",
    label: "Finance",
    icon:  "💰",
    modules: [
      { id: "fees",      label: "Fees",      actions: ["view", "create", "edit", "delete", "approve"] },
      { id: "invoices",  label: "Invoices",  actions: ["view", "create", "edit", "delete", "approve"] },
      { id: "payments",  label: "Payments",  actions: ["view", "create", "delete"] },
      { id: "receipts",  label: "Receipts",  actions: ["view", "create", "export"] },
      { id: "analytics", label: "Analytics", actions: ["view", "export"] },
    ],
  },
  {
    id:    "administration",
    label: "Administration",
    icon:  "🛡️",
    modules: [
      { id: "staff",             label: "Staff",                actions: ["view", "create", "edit", "delete"] },
      { id: "roles_permissions", label: "Roles & Permissions",  actions: ["view", "manage"] },
      { id: "settings",          label: "Settings",             actions: ["view", "edit"] },
    ],
  },
  {
    id:    "security",
    label: "Security",
    icon:  "📹",
    modules: [
      { id: "cctv", label: "CCTV", actions: ["view", "manage"] },
    ],
  },
  {
    id:    "communication",
    label: "Communication",
    icon:  "📣",
    modules: [
      { id: "notifications", label: "Notifications", actions: ["view", "create", "manage"] },
      { id: "parent_app",    label: "Parent App",    actions: ["view", "manage"] },
    ],
  },
];

// ── Module → route-key mapping (mirrors backend roleService.js) ───────────────
// Used by deriveRouteKeysFromPermissions() for sidebar preview.
const MODULE_ROUTE_MAP = {
  dashboard:         ["dashboard"],
  students:          ["students"],
  admissions:        ["students"],
  attendance:        ["attendance"],
  nap_tracking:      ["nap-tracker"],
  pickup_auth:       ["pickup-authorization", "pickup-history"],
  medical:           [],
  food_menu:         ["food-menu", "food-consumption"],
  fees:              ["fees"],
  invoices:          ["invoice"],
  payments:          ["fees"],
  receipts:          ["invoice"],
  analytics:         ["analytics"],
  staff:             ["user-management"],
  roles_permissions: ["roles-permissions"],
  settings:          ["settings"],
  cctv:              ["live-cctv", "cctv-settings"],
  notifications:     [],
  parent_app:        ["parent-checkin"],
  documents:         [],
};

/** Derive sidebar route keys from a granular permission matrix. */
export function deriveRouteKeysFromPermissions(permissions = {}) {
  const keys = new Set(["profile"]);
  for (const [moduleId, actions] of Object.entries(permissions)) {
    if (actions?.view) {
      (MODULE_ROUTE_MAP[moduleId] || []).forEach(k => keys.add(k));
    }
  }
  return [...keys];
}

// ── Permission dependency enforcement ─────────────────────────────────────────
/**
 * Apply dependency rules when a single action is toggled.
 * Rules:
 *   Enabling any non-view action → auto-enables view.
 *   Disabling view → disables all other actions for that module.
 */
export function applyPermissionDependencies(permissions, moduleId, actionId, newValue, moduleActions) {
  let next = {
    ...permissions,
    [moduleId]: { ...(permissions[moduleId] || {}), [actionId]: newValue },
  };

  if (newValue && actionId !== "view") {
    // Auto-enable view when a dependent action is granted
    next[moduleId].view = true;
  }

  if (!newValue && actionId === "view") {
    // Auto-disable everything when view is revoked
    for (const a of (moduleActions || [])) {
      if (a !== "view") next[moduleId][a] = false;
    }
  }

  return next;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildEmptyPermissions() {
  const result = {};
  for (const cat of PERMISSION_CATEGORIES) {
    for (const mod of cat.modules) {
      result[mod.id] = {};
      for (const action of mod.actions) {
        result[mod.id][action] = false;
      }
    }
  }
  return result;
}

export function normalizePermissions(raw = {}) {
  const base = buildEmptyPermissions();
  for (const [moduleId, actions] of Object.entries(raw || {})) {
    if (base[moduleId]) {
      for (const [action, value] of Object.entries(actions || {})) {
        if (action in base[moduleId]) base[moduleId][action] = Boolean(value);
      }
    }
  }
  return base;
}

export function isModuleFullyGranted(permissions, moduleId, actions) {
  return actions.every(a => !!permissions?.[moduleId]?.[a]);
}

export function setAllModuleActions(permissions, moduleId, actions, value) {
  const next = { ...permissions, [moduleId]: { ...(permissions[moduleId] || {}) } };

  if (value) {
    // Granting all: just set all to true
    for (const a of actions) next[moduleId][a] = true;
  } else {
    // Revoking all: clear everything
    for (const a of actions) next[moduleId][a] = false;
  }
  return next;
}

export function isCategoryFullyGranted(permissions, category) {
  return category.modules.every(mod =>
    isModuleFullyGranted(permissions, mod.id, mod.actions)
  );
}

export function setAllCategoryActions(permissions, category, value) {
  let next = permissions;
  for (const mod of category.modules) {
    next = setAllModuleActions(next, mod.id, mod.actions, value);
  }
  return next;
}

/** Count granted actions across a permissions object. */
export function countGrantedPermissions(permissions) {
  let total = 0, granted = 0;
  for (const cat of PERMISSION_CATEGORIES) {
    for (const mod of cat.modules) {
      for (const action of mod.actions) {
        total++;
        if (permissions?.[mod.id]?.[action]) granted++;
      }
    }
  }
  return { granted, total };
}

// ── Human-readable permission descriptions ────────────────────────────────────
// Displayed in the permission matrix rows and capabilities panel.
// Shape: { moduleId: { actionId: "Plain English string" } }
export const PERMISSION_DESCRIPTIONS = {
  dashboard:   { view: "See the home dashboard and key metrics" },
  documents:   {
    view:   "Browse uploaded school documents",
    upload: "Upload new files and documents",
    delete: "Remove uploaded files permanently",
    export: "Download documents to a device",
  },
  students: {
    view:   "Browse and search student profiles",
    create: "Enrol new students into the system",
    edit:   "Update student information and records",
    delete: "Permanently remove student profiles",
    export: "Download student data as spreadsheets",
  },
  admissions: {
    view:    "View new admission applications",
    create:  "Submit new admission requests",
    edit:    "Update admission application details",
    approve: "Accept or reject admission applications",
  },
  attendance: {
    view:   "View daily attendance records",
    mark:   "Mark students as present or absent",
    edit:   "Correct past attendance entries",
    export: "Download attendance reports",
  },
  nap_tracking: {
    view: "View nap and rest time logs",
    mark: "Record nap start and end times",
    edit: "Correct nap log entries",
  },
  pickup_auth: {
    view:    "View pickup authorization records",
    create:  "Create new pickup authorizations",
    edit:    "Update pickup authorization details",
    approve: "Approve or reject pickup requests",
  },
  medical: {
    view: "View student health and medical records",
    edit: "Update medical information and allergy notes",
  },
  food_menu: {
    view:   "View daily food menus",
    create: "Plan and create new menus",
    edit:   "Update existing menu items",
    delete: "Remove menu entries",
  },
  fees: {
    view:    "View fee structures and outstanding balances",
    create:  "Set up new fee items and structures",
    edit:    "Modify fee amounts and due dates",
    delete:  "Remove fee records",
    approve: "Approve fee waivers and discounts",
  },
  invoices: {
    view:    "View student invoices and billing",
    create:  "Generate new invoices",
    edit:    "Update invoice line items and amounts",
    delete:  "Void and permanently delete invoices",
    approve: "Approve invoices before sending",
  },
  payments: {
    view:   "View payment history and transactions",
    create: "Record and collect new payments",
    delete: "Reverse or delete payment records",
  },
  receipts: {
    view:   "View payment receipts",
    create: "Generate receipts for payments",
    export: "Download receipt PDFs and reports",
  },
  analytics: {
    view:   "View financial and operational reports",
    export: "Download analytics data and reports",
  },
  staff: {
    view:   "View staff member profiles and details",
    create: "Create new staff accounts",
    edit:   "Update staff information and roles",
    delete: "Deactivate and remove staff accounts",
  },
  roles_permissions: {
    view:   "View role definitions and permission settings",
    manage: "Create, edit, and delete custom roles",
  },
  settings: {
    view: "View school and system settings",
    edit: "Change school configuration and preferences",
  },
  cctv: {
    view:   "Watch live camera feeds",
    manage: "Configure CCTV cameras and access settings",
  },
  notifications: {
    view:   "See notifications and announcements",
    create: "Send notifications to parents and staff",
    manage: "Manage notification templates and settings",
  },
  parent_app: {
    view:   "Access parent-facing app features",
    manage: "Configure parent app settings and content",
  },
};

// ── Risk levels ───────────────────────────────────────────────────────────────
// "safe"      — default, no visual indicator
// "sensitive" — amber dot: affects privacy or data visibility
// "critical"  — red dot: irreversible or high-impact action
export const RISK_LEVELS = {
  "students.delete":          "critical",
  "fees.delete":              "critical",
  "invoices.delete":          "critical",
  "payments.delete":          "critical",
  "staff.delete":             "critical",
  "roles_permissions.manage": "critical",
  "documents.delete":         "critical",
  "fees.approve":             "sensitive",
  "invoices.approve":         "sensitive",
  "pickup_auth.approve":      "sensitive",
  "admissions.approve":       "sensitive",
  "payments.create":          "sensitive",
  "students.export":          "sensitive",
  "analytics.export":         "sensitive",
  "receipts.export":          "sensitive",
  "settings.edit":            "sensitive",
  "staff.create":             "sensitive",
  "staff.edit":               "sensitive",
  "cctv.manage":              "sensitive",
  "notifications.manage":     "sensitive",
  "medical.edit":             "sensitive",
};

/** Return the risk level for a module+action pair. */
export function getRiskLevel(moduleId, actionId) {
  return RISK_LEVELS[`${moduleId}.${actionId}`] || "safe";
}

/** Return the human-readable description for a module+action pair. */
export function getPermDescription(moduleId, actionId) {
  return PERMISSION_DESCRIPTIONS[moduleId]?.[actionId] || null;
}

/**
 * Derive a plain-English capability summary from a permissions object.
 * Returns { can: Item[], cannot: Item[] } where Item = { desc, risk, module, action, catIcon }.
 * "cannot" only includes sensitive/critical actions that are NOT granted.
 */
export function deriveCapabilities(permissions = {}) {
  const can    = [];
  const cannot = [];

  for (const cat of PERMISSION_CATEGORIES) {
    for (const mod of cat.modules) {
      const modPerms = permissions[mod.id] || {};
      for (const action of mod.actions) {
        const desc = getPermDescription(mod.id, action);
        if (!desc) continue;
        const risk = getRiskLevel(mod.id, action);
        if (modPerms[action]) {
          can.push({ desc, risk, module: mod.id, action, catIcon: cat.icon, catLabel: cat.label, catId: cat.id });
        } else if (risk === "critical" || risk === "sensitive") {
          cannot.push({ desc, risk, module: mod.id, action, catIcon: cat.icon, catLabel: cat.label, catId: cat.id });
        }
      }
    }
  }

  return { can, cannot };
}

// ── Role templates ────────────────────────────────────────────────────────────
// One-click presets for new role creation.
export const ROLE_TEMPLATES = [
  {
    id:          "teacher",
    label:       "Teacher",
    emoji:       "🎓",
    description: "Daily classroom and student care operations",
    color:       "#059669",
    category:    "academic",
    homeRoute:   "/attendance",
    permissions: {
      dashboard:   { view: true },
      students:    { view: true, create: false, edit: false, delete: false, export: false },
      attendance:  { view: true, mark: true,   edit: true,  export: false },
      nap_tracking:{ view: true, mark: true,   edit: true },
      pickup_auth: { view: true, create: false, edit: false, approve: false },
      medical:     { view: true, edit: false },
      food_menu:   { view: true, create: false, edit: false, delete: false },
      documents:   { view: true, upload: false, delete: false, export: false },
    },
  },
  {
    id:          "accountant",
    label:       "Accountant",
    emoji:       "📊",
    description: "Financial management, invoicing and reporting",
    color:       "#2563eb",
    category:    "finance",
    homeRoute:   "/invoice",
    permissions: {
      dashboard: { view: true },
      students:  { view: true, create: false, edit: false, delete: false, export: true },
      fees:      { view: true, create: true,  edit: true,  delete: false, approve: true },
      invoices:  { view: true, create: true,  edit: true,  delete: false, approve: true },
      payments:  { view: true, create: true,  delete: false },
      receipts:  { view: true, create: true,  export: true },
      analytics: { view: true, export: true },
      documents: { view: true, upload: true,  delete: false, export: true },
    },
  },
  {
    id:          "reception",
    label:       "Reception",
    emoji:       "🏫",
    description: "Front desk, check-in and pickup management",
    color:       "#d97706",
    category:    "operations",
    homeRoute:   "/",
    permissions: {
      dashboard:   { view: true },
      students:    { view: true, create: false, edit: false, delete: false, export: false },
      attendance:  { view: true, mark: true,   edit: false, export: false },
      pickup_auth: { view: true, create: true,  edit: true,  approve: false },
    },
  },
  {
    id:          "center_head",
    label:       "Center Head",
    emoji:       "🏢",
    description: "Full access scoped to their center",
    color:       "#0891b2",
    category:    "management",
    homeRoute:   "/",
    permissions: {
      dashboard:         { view: true },
      students:          { view: true, create: true,  edit: true,  delete: false, export: true },
      admissions:        { view: true, create: true,  edit: true,  approve: true },
      attendance:        { view: true, mark: true,    edit: true,  export: true },
      nap_tracking:      { view: true, mark: true,    edit: true },
      pickup_auth:       { view: true, create: true,  edit: true,  approve: true },
      medical:           { view: true, edit: true },
      food_menu:         { view: true, create: true,  edit: true,  delete: false },
      fees:              { view: true, create: true,  edit: true,  delete: false, approve: true },
      invoices:          { view: true, create: false, edit: false, delete: false, approve: false },
      analytics:         { view: true, export: false },
      staff:             { view: true, create: true,  edit: true,  delete: false },
      roles_permissions: { view: true, manage: false },
      settings:          { view: true, edit: true },
      documents:         { view: true, upload: true,  delete: false, export: true },
    },
  },
  {
    id:          "parent_support",
    label:       "Parent Support",
    emoji:       "💬",
    description: "Parent communication and support",
    color:       "#7c3aed",
    category:    "support",
    homeRoute:   "/",
    permissions: {
      dashboard:     { view: true },
      students:      { view: true, create: false, edit: false, delete: false, export: false },
      pickup_auth:   { view: true, create: false, edit: false, approve: false },
      notifications: { view: true, create: true,  manage: false },
      parent_app:    { view: true, manage: false },
    },
  },
  {
    id:          "security_guard",
    label:       "Security",
    emoji:       "🔒",
    description: "CCTV monitoring and campus security",
    color:       "#dc2626",
    category:    "security",
    homeRoute:   "/live-cctv",
    permissions: {
      cctv:        { view: true, manage: false },
      pickup_auth: { view: true, create: false, edit: false, approve: false },
    },
  },
  {
    id:          "transport",
    label:       "Transport",
    emoji:       "🚌",
    description: "Pickup authorization and transport management",
    color:       "#ea580c",
    category:    "operations",
    homeRoute:   "/pickup-authorization",
    permissions: {
      dashboard:   { view: true },
      students:    { view: true, create: false, edit: false, delete: false, export: false },
      pickup_auth: { view: true, create: true,  edit: true,  approve: true },
    },
  },
];
