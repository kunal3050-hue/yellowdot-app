# Platform Access Model — design

**Status:** proposal, nothing implemented
**Date:** 2026-11-26
**Problem:** there is no way to let someone run the operator console without
giving them everything, in every school.

---

## 1. Where things actually stand

The console is live at `/platform/*` behind `PlatformRoute`, and
`canUsePlatformConsole()` currently answers `isBypassRole()`. That is not a
shortcut taken for speed — it is the only thing the system can express today.

Three gates decide access, and all three fail the same way:

| Gate | Where | Behaviour for a would-be platform operator |
|---|---|---|
| `authorize(...roles)` | `authMiddleware.js:388` | bypass short-circuits, then an exact role-name match. `/api/tenants` lists only `super_admin`, `developer`. |
| `authorizeRoute(routeKey)` | `authMiddleware.js:402` | bypass short-circuits, then `permissions.includes(routeKey)`. |
| `can(routeKey)` (frontend) | `ProtectedRoute` | same idea, client side. |

And both bypass roles hold `"*"`:

```js
// config/permissionsBackend.js
developer:   ["*"],
super_admin: ["*"],
```

`getPermissionsForRole()` doesn't even consult Firestore for them — it returns
`["*"]` from code at `roleService.js:226`.

### Why `tenant-management` is unreachable

`knownGaps.js` records `tenant-management` as unreachable for every role under
every possible role document. The cause is specific and fixable:

```js
// roleService.js:161
function deriveRouteKeys(permissions = {}) {
  for (const [moduleId, actions] of Object.entries(permissions)) {
    if (actions?.view) (MODULE_ROUTE_MAP[moduleId] || []).forEach(k => keys.add(k));
  }
}
```

**`tenant_management` is absent from `MODULE_ROUTE_MAP`.** No role matrix can
produce the `tenant-management` routeKey, so no role document — system or
custom — can ever grant it. The console worked only because bypass roles never
reach this code.

So the gap isn't "nobody got around to granting it". It is not grantable.

---

## 2. What roles actually are

Worth stating, because it determines how much of this is data and how much is
a deploy.

- Role documents live in Firestore at `roles/{roleId}` — **one document per
  role, globally**, not one per school.
- `SYSTEM_ROLES` in `roleService.js:255` is the code-side seed. Those carry
  `isSystem: true`.
- `_fetchAndCache` accepts a role doc when `doc.schoolId === schoolId || doc.isSystem`
  — so system roles are global and custom roles are school-scoped.
- Permissions are a matrix, `{ moduleId: { action: bool } }`, derived into
  routeKeys through `MODULE_ROUTE_MAP`.

A new system role is therefore: a code change to `SYSTEM_ROLES`, a seed run,
and a `MODULE_ROUTE_MAP` entry. Not a schema change.

---

## 3. Proposal

### 3.1 A real role, not a fourth bypass

Add `platform_admin` as a system role that is **not** in `BYPASS_ROLES` and
does **not** hold `"*"`. That distinction is the entire point: a bypass role
cannot be scoped, so adding one would reproduce the problem with a new name.

```js
{
  roleId:      "platform_admin",
  name:        "Platform Admin",
  description: "Runs the operator console. No access to any school's data.",
  isSystem:    true,
  homeRoute:   "/platform/tenants",
  permissions: {
    tenant_management: { view: true, manage: true },
  },
}
```

And the missing map entry, which is what makes the above mean anything:

```js
MODULE_ROUTE_MAP.tenant_management = ["tenant-management"];
```

That one line also closes the `knownGaps` entry, which can then be deleted
rather than carried.

### 3.2 Where platform staff live

**Recommendation: a separate `platformUsers` collection, not `users`.**

A platform employee is not staff of any school, and the system assumes
otherwise everywhere. Three concrete problems with putting them in `users`:

1. **`schoolId` is effectively mandatory.** Every branch of `authMiddleware`
   falls back to `DEFAULT_SCHOOL_ID` (`authMiddleware.js:39`). A platform
   admin would silently become a member of whichever school that names.
2. **`enforceTenant` would block them.** It 403s when `!schoolId`, and
   otherwise resolves that school's status — so a platform admin could be
   locked out by the suspension of a school they have nothing to do with, and
   un-suspending it is done from the console they can no longer reach.
3. **`firestore.rules` keys on `me().schoolId` and `myRole()`.** The app reads
   nothing from Firestore directly today — everything goes through the API —
   but a `users` doc with a real `schoolId` would grant SDK-level read access
   to that school regardless. A separate collection has no such doc to match.

The cost is one extra lookup branch in `authMiddleware`: check `platformUsers`
first, and only fall through to the school path if there is no match.

### 3.3 Touch points

Each of these is a place the current design will bite if missed.

| # | File | Change |
|---|---|---|
| 1 | `services/roleService.js` | add `platform_admin` to `SYSTEM_ROLES`; add `tenant_management` to `MODULE_ROUTE_MAP` |
| 2 | `middleware/authMiddleware.js` | resolve `platformUsers` before the school lookup |
| 3 | `middleware/tenantMiddleware.js` | `evaluateTenant` must return no block for platform roles — they have no tenant, and the `!schoolId` branch currently 403s |
| 4 | `routes/tenantRoutes.js` | `authorize("super_admin", "developer", "platform_admin")` |
| 5 | `src/config/permissions.js` | widen `canUsePlatformConsole()` — the seam already exists |
| 6 | `src/platform/registry/knownGaps.js` | remove `tenant-management`; it becomes reachable |
| 7 | `scripts/seedEmulator.js` | grant the role locally, or it is invisible to every non-bypass account in dev |

Point 3 is the easiest to overlook and the most damaging: a platform admin who
cannot sign in because they have no school.

### 3.4 What this deliberately does not do

- **It does not grant impersonation.** `/impersonate` reads a school's real
  data as one of its users. That is a separate capability and should be a
  separate permission, not implied by "can manage tenants".
- **It does not touch the school roles.** No existing role gains or loses
  anything; `verify:permissions` should show zero diff.
- **It does not make the console multi-user on its own.** Creating and
  managing platform staff is a further piece — this is the model it needs.

---

## 4. Decisions that are yours

1. **Can a platform admin impersonate?** It is the only action here that reads
   children's records. Recommendation: no by default, as a separate
   `tenant_management.impersonate` action granted explicitly. It is already
   audit-logged either way (`tenantService.logImpersonation`).
2. **Can a platform admin suspend?** Suspension now genuinely cuts a school
   off. Reasonable either as part of `manage` or as its own action.
3. **Can a platform admin create and delete schools?** `DELETE /api/tenants/:id`
   exists. Deletion is probably yours alone.
4. **Does `super_admin` stay a bypass role?** It could become an ordinary
   platform role with everything granted, which would make the whole platform
   side scoped and auditable. Larger change, better end state.
5. **Who manages platform staff?** Presumably you only, which implies a role
   above `platform_admin` — or simply that the directory is edited outside the
   app until there is a reason not to.

---

## 5. Suggested order

1. `MODULE_ROUTE_MAP` entry + delete the `knownGaps` line. Small, and it makes
   the routeKey grantable — everything else builds on it.
2. `platform_admin` in `SYSTEM_ROLES`, with tests that it resolves to exactly
   `["profile", "tenant-management"]` and **not** `"*"`.
3. `platformUsers` lookup and the `enforceTenant` exemption, with a test that a
   platform admin is unaffected by any school's suspension.
4. Widen `authorize()` on the tenant routes and `canUsePlatformConsole()`.
5. Only then, a UI for managing platform staff.

Steps 1–4 are the model. Step 5 is the feature, and is not worth starting
before the model holds.
