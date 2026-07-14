# KUE BOXS Design System

**Status: canonical.** This is the single source of truth for visual design across both the staff CRM and the parent app. Like `SECURITY_ARCHITECTURE.md` for authorization, it exists so future UI work reuses an established pattern instead of inventing a new one per page.

**This document codifies and fixes what already exists — it does not replace it.** An audit of the current frontend (2026-07-14) found the token system, component library, and navigation shells are already close to the bar this document sets. The real gap is fragmentation (a stale conflicting color source still driving every status badge) and inconsistent adoption (~2,500 raw hex literals and ~760 raw Tailwind-gray classes across `src/pages` bypassing the tokens). See §19 for the consolidation work required before module redesigns begin.

---

## 0. Design philosophy

We are not building a traditional ERP. We are building the calmest, most premium preschool SaaS platform available — two distinct emotional registers for two distinct audiences:

- **Staff app (KUE BOXS Care CRM):** Apple-level simplicity, Linear-level polish, Stripe Dashboard clarity, Notion spacing, Figma-grade interaction feedback, Arc Browser smoothness. Premium, calm, spacious, fast, professional.
- **Parent app:** warm, emotional, photo-centric. A consumer app a parent opens to feel connected to their child's day — not a portal into "the system."

**Avoid, everywhere:** dense unstyled tables, tiny click targets, flat Bootstrap-era borders-and-shadows, overuse of bright color, cartoon preschool graphics, clutter. Whitespace and restraint are load-bearing, not decoration.

---

## 1. Typography

**Face:** Plus Jakarta Sans everywhere (`--yd-font`), system-ui/-apple-system fallback. One face, used with weight and size to carry all hierarchy — do not introduce a second display face; that reads as decoration, not restraint.

| Token | Size | Use |
|---|---|---|
| `--yd-font-size-xs` | 10px | Overline labels, badge text (uppercase, `--yd-tracking-wider`) |
| `--yd-font-size-sm` | 12px | Captions, table meta, timestamps |
| `--yd-font-size-base` | 14px | Body default, form inputs, table cells |
| `--yd-font-size-md` | 15px | Emphasized body, card titles |
| `--yd-font-size-lg` | 18px | Section headers |
| `--yd-font-size-xl` | 22px | Page titles (staff) |
| `--yd-font-size-2xl` | 28px | Dashboard hero numbers |
| `--yd-font-size-3xl` | 36px | Parent-app hero moments only |
| `--yd-font-size-4xl` | 46px | Reserved — marketing/empty-state hero only, never inside a data view |

**Weights:** 400 body, 500 medium (labels, nav items), 600 semi (card titles, button text), 700 bold (page titles), 800/900 reserved for hero numbers only. **Never use font-weight alone to imply interactivity** — pair with color/underline.

**Line height:** tight (1.1) for display numbers, snug (1.3) for headings, normal (1.5) for body, relaxed (1.65) for long-form parent content (journey captions, notice bodies).

**Rule:** every page-title/heading gets `text-wrap: balance`. Running text (notices, journey captions) stays near 60-70 characters per line — don't let a body paragraph span a full 1120px content column.

---

## 2. Color palette

**Source of truth: `src/styles/tokens.css`.** Do not introduce new hex values in a page-level file — extend `tokens.css` if a genuinely new need arises, in the same commit, following the naming convention below.

### Staff app (cool-neutral, pure-white SaaS)

| Role | Token | Value |
|---|---|---|
| Brand accent | `--yd-yellow` | `#F4C400` |
| Brand accent, hover | `--yd-yellow-dark` | `#D9AE00` |
| Page background | `--yd-bg` | `#FFFFFF` |
| Sunken/inset areas | `--yd-bg-sunken` | `#F5F5F5` |
| Primary text | `--yd-charcoal` / `--yd-text` | `#0F172A` |
| Secondary text | `--yd-text-soft` | `#64748B` |
| Muted text | `--yd-text-muted` | `#94A3B8` |
| Border | `--yd-border` | `#E8E8E8` |
| Success | `--yd-success` | `#16A34A` |
| Danger | `--yd-danger` | `#DC2626` |
| Warning | `--yd-warning` | `#D97706` |
| Info | `--yd-info` | `#2563EB` |

Every semantic color has a `-soft` (background tint) and `-border` pair — use them together (e.g. a warning pill is `--yd-warning-soft` background + `--yd-warning-border` border + `--yd-warning` text), never a semantic color as a solid fill for anything larger than a small pill or dot.

**The brand yellow is an accent, not a background.** Use it for the one primary action on a screen, active nav indicators, and focus rings — never as a page or card background outside the parent app.

### Parent app (warm, photo-first)

Owned separately in `src/modules/parent/theme/colors.ts` — yellow-forward, warmer neutrals than the staff app. **Green is success-only, never primary** (existing, correct rule — preserve it). Do not let staff-app cool-grey creep into parent screens; the two palettes are deliberately different registers for deliberately different audiences.

### Dark mode

Both apps ship dark-mode token overrides (`.dark` class, `tokens.css:180-202`). Every new component must be built against the CSS variables, never a literal light-mode hex, so dark mode is automatic rather than a second implementation.

---

## 3. Elevation

Five levels, neutral shadows (no yellow tint — a past revision deliberately removed brand-colored shadows from the base scale; preserve that decision):

| Level | Token | Use |
|---|---|---|
| 0 | none | Flat content, table rows |
| 1 | `--yd-shadow-xs` / `--yd-shadow-card` | Resting cards, table container |
| 2 | `--yd-shadow-sm` | Raised cards, dropdown triggers |
| 3 | `--yd-shadow-md` | Popovers, hover-raised cards |
| 4 | `--yd-shadow-lg` | Drawers, command palette |
| 5 | `--yd-shadow-xl` | Modals |

`--yd-shadow-yellow` is reserved for the single primary CTA on a page when it needs to visually lead (e.g. "Save" on a form) — not a default button treatment.

---

## 4. Spacing & layout grid

8px base rhythm (`--yd-space-1` through `--yd-space-20`, 4px–80px). **Compose spacing with flex/grid `gap`, not per-element margin** — this is what produces Notion-level consistency; margin-stacking is how spacing drifts page to page.

- Content max-width: `--yd-content-max` (1120px) for staff data views — this is what prevents the "dense ERP" feel on wide monitors.
- Card max-width: `--yd-card-max` (540px) for single-entity detail cards; `--yd-auth-card-max` (460px) for auth.
- Section spacing: `--yd-space-8` (32px) between major page sections, `--yd-space-4`–`--yd-space-6` (16-24px) inside a card, `--yd-space-2`–`--yd-space-3` (8-12px) between related inline elements.

---

## 5. Cards

`Card.jsx` + `.yd-card` is the canonical primitive — reuse it, don't reinvent a card with an inline `<style>` block (a real regression found in `LiveDashboard.jsx`, which reimplements its own stat-card with different hardcoded values than the existing `.yd-stat` class).

- Radius: `--yd-radius-md` (16px) default, `--yd-radius-lg` (20px) for hero/feature cards.
- Border: `1px solid var(--yd-border)`, elevation level 1 at rest, level 2-3 on hover (`.yd-card-hover`) only if the card is actually clickable — a card that doesn't navigate anywhere should never lift on hover (that's a promise the UI breaks).
- Padding: `--yd-space-6` (24px) standard, `--yd-space-4` (16px) for dense dashboard grids, never below `--yd-space-4`.

---

## 6. Buttons

`Button.jsx` + `.btn`/`.btn-{variant}` is canonical. Variants: primary (yellow fill, dark text), secondary (outlined), ghost (text-only, hover-tinted), danger (red, destructive actions only), and size variants sm/md/lg.

- **Minimum touch target: 44×44px** on any surface reachable on mobile (already enforced in `mobile.css` — preserve and extend to any new button pattern).
- **One primary button per view.** If a screen has two "primary-looking" buttons, one is wrong — demote it to secondary or ghost.
- Icon-only buttons always carry an `aria-label` and a title-attribute tooltip on hover (desktop).
- Loading state: replace label with a spinner of the same visual weight, never disable-and-gray-out without also communicating why (use a tooltip or adjacent helper text for disabled-with-reason states).

---

## 7. Forms

`Input.jsx`/`Select.jsx`/`FormSection.jsx` are canonical.

- Label above field, not floating-inside (floating labels cost clarity for a marginal space saving — not worth it for a data-entry-heavy CRM).
- Helper text below field in `--yd-text-soft`, error text in `--yd-danger` replacing helper text (not appended below it) when a field is invalid.
- Focus state: visible ring in `--yd-yellow` at `2px` (already global via `:focus-visible` in `mobile.css` — every custom form control must inherit this, never suppress `outline` without providing an equivalent replacement).
- Group related fields with `FormSection`, not a bare grid of inputs — a section label (`--yd-font-size-sm`, uppercase, `--yd-tracking-wide`) tells the user why fields are grouped.
- Required-field marking: a small dot or "Required" helper text, never asterisk-only (asterisks fail for screen-reader users who don't have the convention explained).

---

## 8. Tables

This is the single highest-risk category for regressing into "traditional ERP" — the brief explicitly calls out dense tables as the thing to avoid. Canonical: `DataTable.jsx`/`.yd-table`.

- **Row height ≥ 48px**, generous cell padding (`--yd-space-3`–`--yd-space-4`), not the cramped 28px-row Bootstrap-table default.
- Zebra striping is **not** the default — use a single hairline border (`--yd-border`) between rows; reserve striping for tables with >15 visible rows where row-tracking genuinely helps.
- Column headers: `--yd-text-soft`, `--yd-font-size-sm`, uppercase with `--yd-tracking-wide` — quiet, not competing with the data.
- Row actions live in a trailing icon-button cluster that appears on row hover (desktop) / is always visible (mobile) — never a wall of always-visible action buttons per row.
- **Every interactive row must be keyboard-reachable.** `DataTable.jsx` currently attaches `onClick` to `<tr>` with no `role`, `tabIndex`, or `onKeyDown` — this is a real, confirmed a11y regression to fix (see §19), not a hypothetical guideline violation.
- For genuinely dense data (attendance grids, payroll runs), prefer a card-per-row pattern on mobile and reserve the literal `<table>` for desktop viewports ≥1024px.

---

## 9. Navigation

Top bar: 56px (`--yd-topbar-height`), houses page context (breadcrumb or title), global search, notifications, avatar/profile menu. Sticky, elevation level 1 only on scroll (flat at rest — a shadow-under-topbar-always is the classic "old ERP" tell).

Command palette (`⌘K`/`Ctrl+K`) already exists in `layout.css` — this is a Linear/Arc-grade pattern, preserve and extend it as the primary "get anywhere fast" mechanism rather than deepening sidebar nesting.

---

## 10. Sidebars

`Sidebar.jsx` (staff) is already the right interaction model — preserve its structure:
- Collapsible, state persisted (localStorage), icon+label rows, animated active-state accent, role-filtered nav groups, badge counters (LIVE/NEW/count).
- Collapsed state shows icon-only with tooltip-on-hover, never truncated labels.
- Active item: left accent bar in `--yd-yellow` + subtel background tint, not a full-yellow-fill row (a filled active row reads as a button, not a location).

**Required fix (§19):** the CSS backing this component (`layout.css`) currently has three competing, cascading definitions of the sidebar (an old warm-cream block, a "PREMIUM SIDEBAR" hardcoded-hex block that wins by cascade order, and a third simplified version in `global.css`). Collapse to one definition expressed entirely in `--yd-*` tokens before any module redesign touches a page that uses the sidebar.

`ParentLayout.jsx`'s frosted top bar + floating glass bottom dock (with a raised center tab) is the correct pattern for the parent app and should not be converted toward the staff sidebar model — the two are intentionally different vocabularies.

---

## 11. Dashboards

- Lead with the number, not the chart — a stat card's hero value is `--yd-font-size-2xl`+, bold, with a small trend indicator (▲/▼ + percentage in success/danger color) beside it, label below in `--yd-text-soft`.
- Dashboard grid: `--yd-space-4`–`--yd-space-6` gap, responsive 4-col → 2-col → 1-col, never more than 4 stat cards in a single row even on ultra-wide monitors (readability over density).
- Every dashboard needs a "last updated" or live-indicator affordance if its data isn't real-time — silent staleness erodes trust in a dashboard faster than any visual flaw.

---

## 12. Charts

- Palette: semantic colors only (success/danger/warning/info) plus `--yd-yellow` as the single categorical accent — never introduce a chart-specific color palette disconnected from the semantic tokens.
- Always a faint baseline grid (`--yd-border`, low opacity), never full gridlines competing with data.
- Area/line charts: soft gradient fill fading to transparent, emphasized endpoint dot on the current value.
- Empty/zero-data state for a chart is not a blank box — see §13.
- Tooltips on hover, not click-required; keyboard-focusable data points for accessibility where the charting library supports it.

---

## 13. Empty states

`EmptyState.jsx`/`.yd-empty` is canonical: icon or small illustration (never a cartoon mascot — brief explicitly rules this out), one-line explanation of *why* it's empty, one primary action to resolve it where applicable ("Add your first student," not just "No students found"). An empty state is a moment to guide, not just an absence notice.

---

## 14. Loading states

`Skeleton.jsx`/`LoadingPage.jsx` are canonical. **Skeleton screens, not spinners, for anything that takes >300ms and has a known shape** (tables, cards, lists) — a spinner is acceptable only for indeterminate, shapeless waits (form submission, file upload). Match the skeleton's shape to the real content's layout so there's no shift-on-load.

---

## 15. Toasts

`.yd-toast` + the shared `Toast` component, animated via `--yd-ease-spring` (already correct — `toastIn`/`toastOut` keyframes in `tailwind.config.js`/`animations.css`). **Always use the shared component** — a page hand-rolling its own toast markup (a confirmed regression in `Students.jsx`, which builds an ad-hoc toast with a raw emoji and `bg-white/20`) breaks both visual and motion consistency. One toast at a time, auto-dismiss with a visible countdown affordance, manual dismiss always available.

---

## 16. Modals

`.yd-modal` is canonical: elevation level 5, `--yd-radius-lg`, scale/fade entrance (`--yd-ease-spring`), backdrop blur+dim, focus-trapped, closes on `Escape` and backdrop click (except for destructive-confirmation modals, which require an explicit choice). Modal width scales to content but never exceeds `--yd-content-max`; on mobile, a modal becomes a bottom sheet or full-screen sheet rather than a shrunk centered dialog.

---

## 17. Responsive layouts

Mobile-first. Breakpoints follow Tailwind defaults (`sm` 640px / `md` 768px / `lg` 1024px / `xl` 1280px) with `mobile.css` handling the sub-768px touch/layout overrides already in place (44px targets, stacked page headers, auth-page mobile layout). Staff CRM is usable but not optimized below `md` — desk/tablet is the primary staff surface. Parent app is mobile-first and must be validated at 375px width before any wider breakpoint.

---

## 18. Motion guidelines

Motion is **systemic, not decorative** — every state transition should feel intentional, matching the Arc/Linear "everything moves with purpose" quality. Tokens already exist (`--yd-ease`, `--yd-ease-spring`, `--yd-ease-bounce`, `--yd-duration-fast/base/slow` = 120/180/280ms) — the gap is application, not definition (see §19).

- **Overlays** (modal, drawer, dropdown, toast, command palette): entrance + exit motion is mandatory, already implemented — preserve.
- **Page content** (tables, cards, lists): a subtle staggered fade-up (`yd-animate-fade-up`, already defined) on initial render is the target — currently absent from most CRUD pages; add during module redesign passes, not globally in one sweep (risk of jank if done carelessly across dozens of pages at once).
- **Micro-interactions**: button press (scale 0.98), card hover (translateY(-2px) + shadow level +1), input focus (ring fade-in) — subtle, `--yd-duration-fast`.
- **Never animate for its own sake.** If a transition doesn't communicate cause→effect or spatial relationship, cut it.
- **Always respect `prefers-reduced-motion`** — already implemented globally in `mobile.css`; any new keyframe-based component must be added to that reduction block, not assumed to inherit it automatically.

---

## 19. Known deviations requiring consolidation (audit findings, 2026-07-14)

These undermine every module redesign until fixed — recommended as their own small milestone(s) *before* page-by-page work begins, mirroring the security program's "fix the shared helper before building on it" discipline:

1. **`src/design-system/theme.js` has a stale, conflicting color palette** (warm cream/olive-gold) versus `tokens.css`'s current cool-white palette. Its only meaningful consumer, `StatusBadge.jsx`, renders every status pill app-wide in the wrong palette relative to its surrounding chrome. **Fix: repoint `StatusBadge` at `tokens.css`-driven CSS classes; delete or clearly mark `theme.js` deprecated.**
2. **`layout.css` has three competing sidebar/`.yd-page` definitions** (an old warm-cream block, a hardcoded-hex "PREMIUM SIDEBAR" block that currently wins by cascade order, and a third simplified version duplicated in `global.css`). **Fix: collapse to one definition, expressed entirely in `--yd-*` tokens.**
3. **`.yd-status-paid/pending/overdue/active` in `components.css`** hardcode hex that happens to match `tokens.css` today but will silently drift on the next token update. **Fix: replace literals with `var(--yd-*)`.**
4. **`LiveDashboard.jsx` and `Login.jsx` inject their own `<style>` blocks** reinventing stat cards, keyframes, and a different font stack instead of using existing primitives/tokens. **Fix as part of their module passes.**
5. **`DataTable.jsx`'s clickable rows have no keyboard support** (`onClick` on `<tr>`, no `role`/`tabIndex`/`onKeyDown`) — a real a11y regression, not hypothetical. **Fix in the table-primitive itself** (one fix, benefits every page using `DataTable`) rather than per-page.
6. **Informative parent-app photos use `alt=""`** (journey/memory images) — appropriate for decorative images only. **Fix: generate meaningful alt text from the entry's caption/type where available.**
7. **~2,500 raw hex literals and ~760 raw Tailwind-gray/blue/red/green classes across `src/pages`** (heaviest: `StudentProfile.jsx`, `Students.jsx`, `Attendance.jsx`, `PTM.jsx`, `Holidays.jsx`, `Notices.jsx`) bypass the token system entirely. This is the bulk of the module-by-module redesign work — not a separate finding, but the reason that work is needed.

---

## 20. Module redesign process

Every module redesign, once consolidation (§19 items 1-3, 5) is complete, must include:

1. **Before/after comparison** — screenshot or description of current state vs. redesigned state, called out explicitly, not just a diff.
2. **Screenshots** — both light and dark mode where the module supports it, both desktop and mobile breakpoints where the module is used on both.
3. **Accessibility review** — keyboard navigation, focus order, alt text, color contrast (WCAG AA minimum: 4.5:1 body text, 3:1 large text/UI components), touch-target sizing.
4. **Performance impact** — bundle size delta, any new dependency justified, render-blocking concerns (e.g. a new font, a heavy chart library) called out explicitly.
5. **Regression verification** — the module's existing functionality (data fetching, forms, actions) must work identically after a purely visual redesign; backend logic and APIs are never touched by this program.

**No business logic, API contracts, or backend behavior changes as part of any redesign** — this program is visual/interaction only, mirroring the same scope discipline the security hardening program held for authorization logic.

---

*Companion to `SECURITY_ARCHITECTURE.md` and `MASTER_PLATFORM_STATUS.md`. Update this document in the same commit whenever a new UI pattern is introduced or an existing one changes.*
