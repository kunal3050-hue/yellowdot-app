# Can Parent and Staff run on one platform?

**Short answer: yes for four of the five layers — and the backend already does.
The duplication is almost entirely in the frontend presentation layer, and one
layer (the Permission Engine) needs a second *resolution source*, not a second
engine.**

Measured against the code on 2026-07-26, not against the design docs.

| Layer | Shared today? | Verdict |
|---|---|---|
| **Service layer (backend)** | ✅ **Already shared** | 13 of 15 parent services delegate to the staff service. Keep as-is. |
| **Module Registry** | ❌ Not shared | Consolidate — parent routes live in a separate hand-maintained list. |
| **Service Registry (frontend)** | ❌ Not shared | Consolidate — parent has a parallel, unregistered service layer. |
| **Widget Engine** | ❌ Not shared | Consolidate — parent Home is a bespoke feed. |
| **Design System** | ❌ Not shared | Consolidate **carefully** — see §4, this is where UX risk lives. |
| **Permission Engine** | ⚠️ Partly | One genuine exception (§3). Same API, different resolution source. |

---

## 1. What is NOT duplication — do not "fix" this

The backend is the healthy part, and the instinct to collapse it would be wrong.

Of 15 `parent*Service` files (1,587 lines), **13 delegate to the shared staff
service and make zero direct database calls**:

```
parentNapService        → napService
parentConsumptionService→ foodConsumptionService
parentFeesService       → invoiceService
parentIncidentService   → incidentService
parentPtmService        → ptmService
parentFoodMenuService   → foodMenuService
parentEventService      → eventService
parentActivityFeedService → attendanceService + napService + foodConsumptionService
parentNoticesService / parentHolidaysService / parentFeedService
                        → communicationService
…
```

Only `parentAttendanceService` (1 call) and `parentProfileService` (3) touch
Firestore directly, and the latter legitimately resolves the parent↔child link.

**These are read projections, not copies.** A representative example
(`parentNapService`) does three things the staff service must not do:

1. scopes to one child,
2. applies a **field allowlist** (`toSafe()`) that strips fields parents must
   never see,
3. reshapes for the parent view (timeline order, available dates).

That field allowlist is a **privacy boundary**. Collapsing these projections
into the staff services would either leak staff-only fields to parents or push
audience-awareness down into every shared service — worse on both counts. This
pattern should be kept and, where the frontend consolidates, made the model.

---

## 2. Where code is genuinely duplicated — the full inventory

All frontend. The parent module is **7,325 lines** that share nothing with the
platform built over the last phases.

### D1 — Design System: two parallel styling systems

| Signal | Measurement |
|---|---|
| Parent screens importing `components/ui` | **0 of 22** |
| Uses of `var(--yd-…)` design tokens across the whole parent module | **1** |
| Inline `style={{…}}` blocks in parent pages | **616** |
| Parent's own theme (`theme/colors\|spacing\|typography.ts`) | **402 lines**, imported by 18 files |

Two token systems describe the same brand: `theme/colors.ts` (TS constants) and
the design system's CSS custom properties. A brand change today requires editing
both, and nothing detects the drift.

### D2 — Service Registry: a parallel, unregistered service layer

Parent has **16 hooks** feeding **`parentService.js` (187 lines)**, with **zero
direct `api` calls** — good discipline, but a *second* implementation of it.
None of it is registered in `platform/services`, so parent reads get none of
what registration provides: scope injection, request dedup, the single
`ServiceError` shape, or the `verify:services` boundary gate.

The ESLint boundary rule does not cover `modules/parent/**` either, so the
discipline there is convention only.

### D3 — Module Registry: a second route list

`modules/parent/routes/parentRoutes.jsx` hand-maintains ~20 routes. They are
invisible to `verify:registry`, which is why the `/parent-checkin` orphan
(linked from six surfaces, routed nowhere) survived — the drift gate literally
cannot see parent routes.

### D4 — Widget Engine: parent Home is a bespoke feed

`HomeFeed.jsx` (471 lines) hand-composes the parent dashboard. It is
retrospective ("Checked out 20h ago") where the staff Dashboard is
prospective — a real product difference — but the *mechanics* it reimplements
(fetch several sources, degrade per card, refresh, empty states) are exactly
what the Widget Engine already does.

### D5 — Navigation shell

`ParentLayout.jsx` (388 lines) implements a bottom tab bar with an elevated
centre tab. The agreed staff mobile IA is the same shape. Two implementations of
one pattern, and the staff one does not exist yet — so this is the cheapest
consolidation available, and it is the one already anticipated in §8 of the
architecture ("extract to a shared `AppShell`").

### D6 — Duplicated domain screens

Parent and staff each have their own `Attendance`, `CareHygiene`, `FoodMenu`,
`NapTracker`, `Incidents`, `PTM`, `Fees`, `Holidays`, `Events`. **These should
mostly stay separate** — a parent viewing one child's naps is a genuinely
different screen from a teacher logging naps for a room. What is duplicated is
the *scaffolding* (loading, empty, error, date navigation, card chrome), not the
content. Consolidate the scaffolding via D1; leave the screens.

---

## 3. The one genuine exception: Permission Engine

**Parent access is relationship-based, not capability-based**, and this is not a
gap to paper over.

Staff authorisation asks *"does this role hold `attendance.view`?"* Parent
authorisation asks *"is this child mine?"* — enforced today by
`requireOwnChild`, which resolves `req.user.student.studentId` and rejects any
mismatch. There is no capability that expresses "my child", and inventing one
(`child.view`) would be a lie: every parent would hold it, and it would carry
none of the actual protection.

The scope ladder (§2c.1) *nearly* covers it — `self` is "rows about me" — but a
parent's children are not the parent's own records, and the ladder's rungs are
organisational containment, which a family is not.

**Recommendation: keep one Permission Engine API, add one resolution source.**

```js
can("care_hygiene.view")        // staff: role matrix
can("care_hygiene.view")        // parent: audience grant, scoped to linked children
scope.childIds                  // new scope member, populated only for parents
```

Concretely: `buildScope()` gains `childIds` for parent sessions, and the parent
audience gets a fixed capability set (view-only over the child-facing modules)
rather than a role document. Call sites do not change; `requireOwnChild` remains
the server-side enforcement and is **not** replaced by a capability check.

This is a new *field and resolution branch*, not a new engine — consistent with
the architecture freeze.

---

## 4. The UX guardrail — this is the part that could go wrong

The parent app's visual language is deliberate and shipped: yellow status bar,
rounded cream-bordered cards, an elevated circular "sun" tab. It is warmer than
the staff UI **on purpose**.

**Consolidation must run in the direction of the design system absorbing the
parent app's primitives — not the parent app adopting staff chrome.** The
earlier design rounds already concluded the staff experience should feel like
"the Parent app evolved"; that only holds if the parent app is the donor.

Practical rule for the migration: **no parent screen may change pixels in a
consolidation commit.** If a screen looks different after moving onto shared
components, the shared component is wrong, not the screen. That makes each step
verifiable by screenshot comparison rather than opinion.

---

## 5. Proposed consolidation — ordered by value, lowest risk first

Each step is independently shippable and reversible, and none introduces a new
platform layer.

| # | Step | Removes | Risk |
|---|---|---|---|
| **C1** | Register parent routes in the Module Registry with an `audience: "parent"` facet | D3 | **Low** — data only; `verify:registry` immediately starts covering parent routes and would have caught the `/parent-checkin` orphan |
| **C2** | Register `parentService` in the Service Registry; convert the 16 hooks to `useService("parent…")`; extend the ESLint boundary to `modules/parent/**` | D2 | **Low** — hooks already go through a service; this changes the resolution path, not the calls |
| **C3** | Merge `theme/colors\|spacing\|typography.ts` into the design system as the **source** of its token values, and re-export the TS constants from it | D1 (tokens) | **Low** — values are unchanged; one definition, two consumption styles |
| **C4** | Extract `ParentLayout`'s tab bar into the shared `AppShell`; staff mobile consumes it | D5 | **Medium** — parent app is in production; gate on pixel-identical screenshots |
| **C5** | Migrate parent screens onto design-system primitives, replacing the 616 inline style blocks, one screen per commit | D1 (usage) | **Medium** — highest line-count, but mechanical; same pixel rule applies |
| **C6** | Re-express `HomeFeed` as widget descriptors with `audience: "parent"` | D4 | **Medium** — do this LAST; it changes a screen parents use daily and is the only step with real product surface |

**Deliberately not proposed:** merging the parent and staff domain screens (D6),
or collapsing the backend parent projections (§1). Both would trade a real
privacy boundary and a real product difference for a line-count win.

### The `audience` facet

C1 and C6 both need one new registry field:

```js
audience: ["staff"] | ["parent"] | ["staff", "parent"]
```

It is a filter facet exactly like `capability` and `featureFlag` — the engines
already filter on those, so this adds a condition, not a concept. The parent
experience then becomes what the architecture always claimed an experience
should be: *the same platform, filtered differently*.

---

## 6. Honest assessment of the payoff

- **Removed duplication:** roughly **1,000 lines** of genuinely duplicated
  infrastructure (theme, service plumbing, layout, route list) and a second
  styling discipline.
- **Not removed:** ~5,800 lines of parent screens, most of which *should* stay
  distinct.
- **The real win is not line count.** It is that parent routes become visible to
  `verify:registry`, parent reads gain the service-layer guarantees, and one
  brand-token change stops requiring two edits. Those are the failure modes that
  have actually bitten this codebase — the `/parent-checkin` orphan is the proof.

C1 and C2 deliver most of that benefit for very little risk and would be worth
doing regardless of whether C4–C6 ever happen.
