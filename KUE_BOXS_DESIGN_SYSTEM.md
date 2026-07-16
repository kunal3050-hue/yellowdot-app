# KUE BOXS Design System

**Status: canonical, v2.** This is the single source of truth for visual design across both the staff CRM and the parent app. Like `SECURITY_ARCHITECTURE.md` for authorization, it exists so future UI work reuses an established pattern instead of inventing a new one per page.

**v2 supersedes the v1 audit findings.** The 2026-07-14 audit (preserved in §19 as a historical record) found fragmentation across the token system and component library. Design System v2 (completed 2026-07-16) resolved every item in that audit and added a full canonical component library on top: DataTable v2, Timeline, ActivityFeed, Charts, Wizard, QuickActionCard, and a shared Motion system. **Phase 2 (module-by-module UI transformation) is the next program and is tracked separately — see §21.**

---

## 0. Design philosophy

We are not building a traditional ERP. We are building the calmest, most premium preschool SaaS platform available — two distinct emotional registers for two distinct audiences:

- **Staff app (KUE BOXS Care CRM):** Apple-level simplicity, Linear-level polish, Stripe Dashboard clarity, Notion spacing, Figma-grade interaction feedback, Slack-grade information density done calmly. Premium, calm, spacious, fast, professional.
- **Parent app:** warm, emotional, photo-centric. A consumer app a parent opens to feel connected to their child's day — not a portal into "the system."

**Avoid, everywhere:** dense unstyled tables, tiny click targets, flat Bootstrap-era borders-and-shadows, overuse of bright color, cartoon preschool graphics, clutter. Whitespace and restraint are load-bearing, not decoration.

---

## 1. Design principles — the five questions every page must answer

Before shipping any redesigned page, it should have a clear answer to each of these. A page that can't answer one of them isn't ready:

1. **What is the single most important thing on this page right now?** — it should be visually dominant (size, position, or color) over everything else. A page with three equally-weighted "important" things has none.
2. **What can the user do from here without navigating away?** — the primary actions (QuickActionCard, a toolbar button, an inline row action) should be reachable in one click, not buried in a menu.
3. **What does "nothing here yet" look like?** — every list, table, or feed needs a considered `EmptyState`, not a blank div. See the empty-state guidelines below.
4. **Does this work with one hand on a phone?** — even staff-primary screens should degrade to a usable mobile layout (card-per-row, sticky primary action, ≥44px targets), not just "technically render."
5. **What happens on a slow connection or with 5,000 rows?** — loading states are skeletons matching real content shape, not spinners; large datasets use DataTable v2's virtualization rather than a fresh pagination hack.

### Standard dashboard layout

Every module's landing/dashboard view follows the same skeleton, so a user who learns one dashboard already knows the next one:

```
┌─────────────────────────────────────────────────────────┐
│ PageHeader (title, context, primary action)              │
├─────────────────────────────────────────────────────────┤
│ KPI row — KpiCard × 3–4, never more even on ultra-wide   │
├───────────────────────────────┬───────────────────────────┤
│ Primary content                │ Side rail                 │
│ (Chart / DataTable / Timeline) │ QuickActionCard grid       │
│                                 │ ActivityFeed / Notifications│
└───────────────────────────────┴───────────────────────────┘
```

Side rail collapses below the primary content on tablet/mobile, never disappears.

### Empty-state guidelines (expanded from v1 §13)

- **First-time empty** ("no students yet"): icon + one-line explanation + one primary CTA that starts the fix. Encouraging tone.
- **Filtered-empty** ("no results for this search/filter"): icon + "no results" + a "clear filters" secondary action, never a CTA to create new data (the data likely exists, the filter is just narrow).
- **Error-empty**: icon + plain-language explanation of what went wrong + a retry action. Never expose a stack trace or raw error code to a non-technical preschool admin.
- Every empty state variant above is implemented once in `EmptyState.jsx` (`variant="default"|"filtered"|"error"|"first-time"`) — reuse it, don't hand-roll a new blank-state div per page.

### AI / PWA / mobile / accessibility requirements

- **AI-assisted surfaces** (if/when introduced) must render inside existing primitives (Card, Modal, ActivityFeed) — never a visually distinct "AI panel" with its own chrome; the platform has one visual language, not two.
- **PWA:** every module screen must work from the installed app shell (see `InstallContext`/`InstallAppButton`) with no layout dependency on being inside a browser chrome (no reliance on the browser back button as the only way out of a flow).
- **Mobile:** staff CRM is usable but desk/tablet-primary; parent app is mobile-first. Any new staff screen must still be operable at 375px width even if not the primary target (per design principle #4 above).
- **Accessibility:** WCAG AA minimum (4.5:1 body text, 3:1 large text/UI components), full keyboard reachability, visible focus rings, `prefers-reduced-motion` respected by every animated component (enforced centrally — see §18).

---

## 2. Typography

**Face:** Plus Jakarta Sans everywhere (`--yd-font`), system-ui/-apple-system fallback. Kept unchanged from v1 — no compelling usability case for a second display face emerged during v2 planning, so the "one face, weight-and-size-driven hierarchy" rule stands.

| Token | Size | Use |
|---|---|---|
| `--yd-font-size-xs` | 10px | Overline labels, badge text (uppercase, `--yd-tracking-wider`) |
| `--yd-font-size-sm` | 12px | Captions, table meta, timestamps |
| `--yd-font-size-base` | 14px | Body default, form inputs, table cells |
| `--yd-font-size-md` | 15px | Emphasized body, card titles |
| `--yd-font-size-lg` | 18px | Section headers |
| `--yd-font-size-xl` | 22px | Page titles (staff) |
| `--yd-font-size-2xl` | 28px | Dashboard hero numbers, KpiCard value |
| `--yd-font-size-3xl` | 36px | Parent-app hero moments only |
| `--yd-font-size-4xl` | 46px | Reserved — marketing/empty-state hero only, never inside a data view |

**Weights:** 400 body, 500 medium (labels, nav items), 600 semi (card titles, button text), 700 bold (page titles), 800/900 reserved for hero numbers only. **Never use font-weight alone to imply interactivity** — pair with color/underline.

**Rule:** every page-title/heading gets `text-wrap: balance`. Running text stays near 60-70 characters per line.

---

## 3. Color palette

**Source of truth: `src/styles/tokens.css`.** Do not introduce new hex values in a page-level file — extend `tokens.css` if a genuinely new need arises, in the same commit.

### Staff app (cool-neutral, pure-white SaaS)

| Role | Token | Value |
|---|---|---|
| Brand accent | `--yd-yellow` | `#F4C400` (kept — confirmed brand color, not changed in v2) |
| Brand accent, hover | `--yd-yellow-dark` | `#D9AE00` |
| Page background | `--yd-bg` | `#FFFFFF` |
| Sunken/inset areas | `--yd-bg-sunken` | `#F5F5F5` |
| Primary text | `--yd-charcoal` / `--yd-text` | `#0F172A` |
| Secondary text | `--yd-text-soft` | `#64748B` |
| Muted text | `--yd-text-muted` | `#94A3B8` |
| Border | `--yd-border` | `#E8E8E8` |
| Success | `--yd-success` | `#22C55E` |
| Danger | `--yd-danger` | `#EF4444` |
| Warning | `--yd-warning` | `#F59E0B` |
| Info | `--yd-info` | `#3B82F6` |

Every semantic color has a `-soft` (background tint) and `-border` pair — use them together (e.g. a warning pill is `--yd-warning-soft` background + `--yd-warning-border` border + `--yd-warning` text), never a semantic color as a solid fill for anything larger than a small pill or dot. `StatusBadge.jsx` is the canonical consumer of this pattern for every status pill app-wide (see §19, item 1 — resolved).

**The brand yellow is an accent, not a background.** Use it for the one primary action on a screen, active nav indicators, and focus rings — never as a page or card background outside the parent app.

### Parent app (warm, photo-first)

Owned separately in `src/modules/parent/theme/colors.ts` — yellow-forward, warmer neutrals than the staff app. Green is success-only, never primary. Do not let staff-app cool-grey creep into parent screens.

### Dark mode

Both apps ship dark-mode token overrides (`.dark` class on `<html>`, `tokens.css`). Chart, Wizard, and every v2 component read colors live via CSS custom properties (Charts specifically via the `useChartTokens()` hook, which also re-reads on `.dark` class toggle via a `MutationObserver`) so dark mode is automatic rather than a second implementation.

---

## 4. Elevation — canonical 4-level scale

Approved during v2 planning: **four named levels (None / Small / Medium / Large)**, not the six-shadow scale v1 originally proposed collapsing to two. The underlying `--yd-shadow-*` variables are kept as aliases so nothing that referenced them directly needed to change.

| Level | Token | Use |
|---|---|---|
| None | `--yd-elevation-none` | Flat content, table rows, inline chips |
| Small | `--yd-elevation-small` | Resting cards (KpiCard, QuickActionCard), table container |
| Medium | `--yd-elevation-medium` | Raised/hover cards, popovers, tooltips |
| Large | `--yd-elevation-large` | Drawers, modals, command palette |

`--yd-shadow-yellow` is reserved for the single primary CTA on a page when it needs to visually lead — not a default button treatment.

---

## 5. Spacing & layout grid

8px base rhythm (`--yd-space-1` through `--yd-space-20`, 4px–80px). **Compose spacing with flex/grid `gap`, not per-element margin.**

- Content max-width: `--yd-content-max` (1120px) for staff data views.
- Card max-width: `--yd-card-max` (540px) for single-entity detail cards; `--yd-auth-card-max` (460px) for auth.
- Radii: `--yd-radius-card` (18px) for cards, `--yd-radius-button`/`--yd-radius-input` (12px), `--yd-radius-dialog` (20px) for modals/drawers — these semantic names sit alongside the older generic `--yd-radius-*` scale, which unrelated elements (badges, chips, avatars) keep using unchanged.

---

## 6. Cards

`Card.jsx` + `.yd-card` remains canonical for simple content cards. For dashboard building blocks specifically, use the purpose-built v2 components instead of a generic card:

- **KpiCard** — the standard dashboard number card (label, hero value, trend arrow + %, optional inline Sparkline).
- **QuickActionCard** — the standard dashboard action tile (icon, title, description, badge, notification count, keyboard shortcut, permission-aware visibility via `useAuth().can()/canDo()`, hover lift, disabled state).

Both live in elevation level Small at rest, Medium on hover only if genuinely interactive.

---

## 7. Buttons

`Button.jsx` + `.btn`/`.btn-{variant}` is canonical. Variants: primary, secondary, outline, danger, ghost, success; sizes xs/sm/md/lg/xl.

- **Minimum touch target: 44×44px** on any surface reachable on mobile.
- **One primary button per view.**
- Icon-only buttons always carry an `aria-label`.
- Loading state: `loading` prop replaces the label with a themed dot-spinner, never disable-and-gray-out silently.

---

## 8. Forms

`Input.jsx`/`Select.jsx`/`FormSection.jsx`/`Field`/`FormGrid` are canonical. Stack: **React Hook Form + Zod** (via `@hookform/resolvers/zod`) for any form with real validation — this is the mandated pattern going forward (see Wizard, §12).

- Label above field, error text in `--yd-danger` replacing helper text when invalid.
- Focus state: visible `--yd-yellow` ring via `:focus-visible`.
- `FormSection` is now motion-enabled: its `collapsible` mode animates open/closed via the shared accordion variant (see §18) instead of an instant show/hide.

---

## 9. Tables — DataTable v2

`DataTable/` (`src/components/ui/DataTable/`) is the canonical, single enterprise-grade table every module should eventually use — built on `@tanstack/react-table` + `@tanstack/react-virtual`, replacing the older `Table.jsx` primitive for any new work (`Table.jsx` is kept only for pages not yet migrated).

**Feature set:** sticky header + pagination, responsive horizontal scroll, Comfortable/Compact density, instant + column search with highlight, multi-select/date-range/status filters with an active-filter badge, multi-column sort, checkbox bulk actions (select page/all, bulk delete/export/archive/status update), CSV/Excel/print export (PDF-ready architecture), configurable page size with a "Showing X–Y of Z" range, column hide/show/reorder/pin/avatar/badge/action columns, skeleton loading (not spinners), card-based mobile layout, and row virtualization for 5,000+ rows (switches between `getRowModel()` and `getPrePaginationRowModel()` based on dataset size rather than composing pagination and virtualization simultaneously).

**Accessibility (§19 item 5 — resolved):** every row is keyboard-reachable — `tabIndex`, `onKeyDown` (Enter triggers `onRowClick`), proper focus management across virtualized and non-virtualized render paths.

**Known, documented gotcha for anyone extending DataTable further:** TanStack's row-model getters (e.g. `getPaginationRowModel`) are not reliably toggle-able across re-renders of the same table instance — always register them, and choose which resulting row model to *use* rather than conditionally passing the option.

---

## 10. Timeline

`Timeline/` — canonical for any chronological record: Student Journey, Attendance/Pickup History, Incident Timeline, Medical Timeline, Parent Communication, Audit Logs, generic Activity History.

Features: avatars, per-event-type colored icons (`eventTypeConfig`, overridable), timestamps, attachments, expandable entries (keyboard-accessible, animated via the shared accordion variant), automatic grouping into Today/Yesterday/This Week/Older, infinite scroll (`useInfiniteScroll`, IntersectionObserver-based), loading skeletons, `EmptyState` integration, mobile responsive (description line hides below 480px).

---

## 11. ActivityFeed

`ActivityFeed/` — the standard activity/notification component app-wide (notification center, dashboard "recent activity", approval queues). Supports unread indicators + one-click mark-as-read, avatars, category badges (caller-supplied palette), `@mention` highlighting, attachments, inline actions (e.g. Approve/Reject buttons per item), category filter chips, live search, and the same infinite-scroll/loading/empty patterns as Timeline.

---

## 12. Charts

`Charts/` — a themed wrapper around Recharts: `KpiCard`, `LineChart`, `AreaChart` (stacked-capable), `BarChart` (stacked + horizontal), `PieChart` (donut mode with a center label), `Sparkline`, `ProgressRing`. All consume live design tokens via `useChartTokens()` rather than a hardcoded palette, so dark mode and any future token change propagate automatically. Tooltips are a shared themed `ChartTooltip`, not Recharts' default unstyled box. Every chart type shares `ChartContainer` for title/subtitle/loading-skeleton/empty-state chrome.

**Note for anyone extending Charts:** disable Recharts' `isAnimationActive` on `Pie` specifically — its entrance animation depends on a JS animation loop that can silently fail to render any sectors in constrained/automated browser contexts (confirmed during v2 verification); Line/Area/Bar are unaffected and keep their default animation.

---

## 13. Wizard

`Wizard/` — the official multi-step flow component (Admissions, employee/parent onboarding, school/subscription setup, incident reporting). Built on React Hook Form + Zod. Supports horizontal/vertical/mobile-compact layouts, autosave with debounced localStorage persistence and draft-recovery banner, per-step field validation via `trigger()`, optional and locked steps, a progress indicator (dots + connecting line, collapses to a "Step X of Y" bar on mobile), a themed success state, and full keyboard accessibility.

**Two correctness lessons baked into this component, worth knowing before extending it:**
1. Step content transitions **do not** gate on an exit-animation completing (no `AnimatePresence mode="wait"` between steps) — only entrance-animate the incoming step. Gating content correctness on animation completion is fragile in constrained environments and was a real, confirmed bug during v2 verification (progress indicator advanced, content didn't).
2. Autosave must **pause once the flow has succeeded** — otherwise its debounced effect keeps re-writing localStorage after a successful submit and silently undoes the post-submit `clearDraft()`.

---

## 14. QuickActionCard

Covered in §6 above alongside KpiCard — the dashboard action-tile building block (Take Attendance, Add Student, Send Notice, Generate Invoice, Mark Meal, Emergency Pickup, Approve Leave, etc.), permission-aware via `useAuth()`.

---

## 15. Icons

**Lucide React only**, globally migrated (v2 Phase 1 Task 1). No emoji-as-icon, no mixed icon libraries. A handful of legacy names have current Lucide equivalents (`AlertTriangle`→`TriangleAlert`, `CheckSquare`→`SquareCheckBig`, `Sliders`→`SlidersVertical`, `BarChart2`→`ChartNoAxesColumn`, `Grid`→`Grid3x3`) — check `node_modules/lucide-react/dist/lucide-react.d.ts` before assuming an icon name from an older Lucide version still exists.

---

## 16. Navigation

Top bar: 56px (`--yd-topbar-height`), page context, global search (`⌘K`/`Ctrl+K` command palette), notifications, current-center switcher, profile menu, Install App entry point. Sticky, elevation Small only on scroll.

**Sidebar nav groups** (per the approved v2 spec): Overview, Admissions, Children, Parents, Attendance, Safety, Academics, Finance, **People** (renamed from "HR" per approval), Communication, Reports & Analytics, Settings, Support. **No global Reports hub** — reports stay embedded within their functional module (e.g. Attendance Reports lives under Attendance, not under a cross-cutting Reports section) per explicit approval.

**Safety & Compliance is permanently expanded** (non-collapsible) so Gate Register and Incident Reports are never accidentally hidden behind a collapsed section — a deliberate, confirmed fix, not the default behavior for other groups, which remain collapsible.

---

## 17. Sidebars

`Sidebar.jsx` (staff): collapsible, state persisted (localStorage), icon+label rows, animated active-state accent, role-filtered nav groups, badge counters. Active item: left accent bar in `--yd-yellow` + subtle background tint, never a full-yellow-fill row.

`ParentLayout.jsx`'s frosted top bar + floating glass bottom dock is the correct, intentionally different pattern for the parent app.

---

## 18. Motion system

Centralized in `src/components/ui/motion.js` — the single source for every animated component, built on **Framer Motion only**.

- **Durations:** fast 120ms, base 160ms, slow 200ms — matching the "120–200ms, never distract" rule.
- **Easing:** standard (`[0.4,0,0.2,1]`), spring (`[0.22,1,0.36,1]`), bounce (`[0.34,1.56,0.64,1]`) — mirrors the CSS easing tokens already in `tokens.css` so JS- and CSS-driven motion feel identical.
- **Shared variants:** `dialogVariants`, `drawerVariants`, `bottomSheetVariants`, `popoverVariants`, `accordionVariants`, `cardVariants`, `toastVariants`, `pageVariants`, `wizardStepVariants(direction)`, `overlayVariants`, `staggerContainer`.
- **`usePrefersReducedMotion()` / `withReducedMotion()`:** every variant set can be passed through `withReducedMotion(variants, reduced)` to collapse to an instant opacity-only transition — applied consistently across every component below, not opt-in per page.

**Retrofitted into:** `Modal` (overlay + dialog variants), `Drawer` (overlay + drawer variants), `Toast` (toast variants via `AnimatePresence`, safe because item removal is time-based and independent of animation completion), `FormSection`'s collapsible accordion, and the DataTable toolbar's filter/column/export popovers.

**Engineering note:** entrance-only animation (no `AnimatePresence` exit-dependency) is the deliberate default for Modal/Drawer/Toast-style overlays, mirroring the Wizard lesson in §13 — correctness should never depend on an animation callback firing.

---

## 19. Historical audit findings (2026-07-14) — resolution status

Preserved as a record of what v2 fixed, not as outstanding work:

1. ~~`src/design-system/theme.js` has a stale, conflicting color palette.~~ **Resolved.** `StatusBadge.jsx` now renders entirely from `tokens.css` CSS variables; `theme.js` had zero remaining consumers and was deleted in v2 Phase 1 Task 4.
2. ~~`layout.css` has three competing sidebar/`.yd-page` definitions.~~ **Resolved** — collapsed to one token-driven definition (Design System Foundations pass).
3. ~~`.yd-status-paid/pending/overdue/active` hardcode hex.~~ **Resolved** alongside the StatusBadge fix.
4. ~~`LiveDashboard.jsx` and `Login.jsx` inject their own `<style>` blocks.~~ **Resolved** — both were redesigned as the v2 pilot modules.
5. ~~`DataTable.jsx`'s clickable rows have no keyboard support.~~ **Resolved** in DataTable v2 (`tabIndex`, `onKeyDown`, Enter-triggers-click) — see §9.
6. Informative parent-app photos using `alt=""` — **not yet verified as part of v2**; carry forward into the Parents module pass (Phase 2.4).
7. ~2,500 raw hex literals / ~760 raw Tailwind-gray classes across `src/pages` bypassing tokens — **this is the explicit subject of Phase 2** (module-by-module UI transformation), not resolved by the component-library work alone. See §21.

---

## 20. Module redesign process

Every module redesign must include:

1. **Before/after comparison** — screenshot or description of current state vs. redesigned state.
2. **Screenshots** — light and dark mode where supported, desktop and mobile breakpoints where used on both.
3. **Accessibility review** — keyboard navigation, focus order, alt text, WCAG AA contrast, touch-target sizing.
4. **Performance impact** — bundle size delta, any new dependency justified, render-blocking concerns called out.
5. **Regression verification** — existing functionality (data fetching, forms, actions) must work identically after a purely visual redesign.

**No business logic, API contracts, permissions, or backend behavior changes as part of any redesign.**

---

## 21. Phase 2 — UI Transformation (in progress)

With the v2 component library complete, work now proceeds module-by-module, applying DataTable v2 / QuickActionCard / Timeline / ActivityFeed / Charts / the Motion system / design tokens to real product pages, following the process in §20:

- **Phase 2.1 — Dashboard:** Live Dashboard, Quick Navigation, KPI cards, Recent Activity, Quick Actions, Notifications, Today's Schedule. The benchmark module for every one after it.
- **Phase 2.2 — Students:** Student List, Student Profile, Admission Details, Medical, Documents, Journey, Attendance, Pickup.
- **Phase 2.3 — Staff:** Employees, Departments, Designations, Attendance, Leave, Payroll.
- **Phase 2.4 — Parents:** Parent List, Parent Profile, Communication, PTM, Incidents.
- **Phase 2.5 — Fees:** Invoices, Payments, Billing, Reports.

Visual target: the polish level of Linear, Stripe Dashboard, Notion, Vercel, Slack, and Figma, kept approachable for preschool administrators. Only presentation, layout, navigation, responsiveness, consistency, accessibility, and usability change — never business logic, APIs, or permissions.

---

*Companion to `SECURITY_ARCHITECTURE.md` and `MASTER_PLATFORM_STATUS.md`. Update this document in the same commit whenever a new UI pattern is introduced, an existing one changes, or a Phase 2 module is completed.*
