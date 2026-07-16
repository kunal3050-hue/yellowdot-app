# KUE BOXS Layout Standard

**Status: canonical, v1 (Phase 2.2c).** Companion to `KUE_BOXS_DESIGN_SYSTEM.md` (which owns typography/color/tokens/component visuals) — this document owns *page structure*: the fixed anatomy every module page follows, the components that implement each section, and the spacing/responsive rules binding them together. It is mandatory for every page built or redesigned from Phase 2.3 (Staff) onward.

**Reference implementation:** the Students module (`src/pages/Students/`), specifically `StudentList.jsx` for the list view and `StudentWizard/` for the add/edit flow. When in doubt about how a rule below applies in practice, read those files first.

---

## 1. Page anatomy

Every page follows this order top to bottom. Sections are optional except Main Content — a page skips what it doesn't need, but never reorders what it has.

```
Page Header            (PageHeader)
      ↓
KPI Cards               (KpiRow, optional)
      ↓
Filters + Search        (FilterBar, or a DataTable's own toolbar)
      ↓
Main Content            (DataTable / card grid / Timeline / Charts)
      ↓
Details Drawer/Panel    (Drawer — portals itself, doesn't affect layout flow)
      ↓
Pagination / Footer     (optional)
```

`PageShell` is the component that enforces this order and its spacing — it takes each section as a named slot and renders them in this sequence unconditionally:

```jsx
import { PageShell, PageHeader, KpiRow, KpiCard, FilterBar, DataTable } from "../../components/ui";

<PageShell
  header={<PageHeader title="Students" subtitle="42 students enrolled" primaryAction={{ label: "Add Student", icon: <UserPlus/>, onClick: onAdd }} />}
  kpis={<KpiRow><KpiCard label="Total" value={42} /><KpiCard label="Active" value={38} /></KpiRow>}
  panel={selected && <Drawer isOpen title="Student" onClose={() => setSelected(null)}>…</Drawer>}
  footer={<Pagination … />}
>
  <DataTable columns={columns} data={students} … />
</PageShell>
```

Notes on the slots:

- **`header`** — always `PageHeader`. Never hand-roll a `<h1>` + button row.
- **`kpis`** — `KpiRow` wrapping 2–4 `KpiCard`s. Omit entirely if the page has no summary metrics; don't pad it out to "look complete."
- **`filters`** — pass a standalone `FilterBar` here for pages *not* built on `DataTable`. Pages using `DataTable` don't pass anything to this slot — `DataTable`'s own toolbar (`DataTableToolbar`) already renders full-bleed as the first thing inside Main Content, and stacking a second filter bar above it would duplicate the row (see Students List — its `filters` slot is unused for exactly this reason).
- **`children` (Main Content)** — required. The one thing every page must have.
- **`panel`** — co-locate your `Drawer` JSX here for readability. `Drawer` renders via `createPortal(..., document.body)`, so its actual position in the DOM doesn't depend on where you place it in JSX — this slot exists so the *page's* JSX reads in anatomy order, not because `PageShell` positions it.
- **`footer`** — pagination controls or a summary footer. Most `DataTable` pages don't need this since `DataTable` paginates internally.

---

## 2. Spacing rules

`PageShell` owns page-level padding so individual pages never hand-roll it:

| Slot | Padding | Notes |
|---|---|---|
| `header` + `kpis` (`.yd-shell-top`) | `20px 24px` | Both slots share one padded block with `gap: 16px` between them |
| `filters` / Main Content toolbar | full-bleed, no shell padding | `FilterBar` and `DataTableToolbar` each carry their own `10px 16px` internal padding and a `border-bottom` — that border is meant to span edge-to-edge |
| Main Content (`.yd-shell-content`) | `0 24px 20px` (`20px` top only if there's no header/kpis/filters above it) | Scrolls independently (`overflow-y: auto`) — `header`/`kpis`/`filters` stay fixed |
| `footer` | `10px 24px` | Bordered top, same background as `PageHeader`'s surface |

Mobile (`≤640px`): shell padding tightens to `14px 16px` (top block) / `8px 16px` (footer). Individual components (FilterBar, DataTableToolbar, Wizard) each carry their own `≤640px` rules — see `filterBar.css`, `dataTable.css`, `wizard.css`.

**Never hardcode a page's own outer padding when it's wrapped in `PageShell`.** If a section needs *more* breathing room than the shell gives it, that's a signal the content belongs in its own `Card`, not a reason to add padding at the page level.

---

## 3. Components

### PageHeader (`src/components/ui/PageHeader.jsx`)

Title, subtitle, breadcrumbs, and the actions row. Two ways to supply actions — pick one per page, don't mix:

```jsx
// A — assembled (preferred for standard CRUD pages)
<PageHeader
  title="Students" subtitle="42 enrolled"
  breadcrumbs={[{ label: "People" }, { label: "Students" }]}
  primaryAction={{ label: "Add Student", icon: <UserPlus/>, onClick: onAdd }}
  secondaryActions={[{ key: "import", label: "Import", icon: <Upload/>, onClick: onImport }]}
  onExport={handleExport} onRefresh={reload} onHelp={openHelp}
  shortcutHint="⌘K to search"
/>

// B — manual (for bespoke headers, e.g. Live Dashboard's live-status badge)
<PageHeader title="Live Dashboard" subtitle={greeting} actions={<CustomBadgeAndButtons/>} />
```

If `actions` is passed, it always wins — `primaryAction`/`secondaryActions`/`onExport`/`onRefresh`/`onHelp` are ignored. This keeps existing callers (`LiveDashboard.jsx`, `QuickNav.jsx`) unaffected.

### KpiRow + KpiCard (`src/components/ui/Charts/KpiRow.jsx`, `KpiCard.jsx`)

```jsx
<KpiRow maxWidth={560}>
  <KpiCard label="Total Students" value={42} loading={loading} />
  <KpiCard label="Active" value={38} trend={4.2} trendLabel="vs last term" />
  <KpiCard label="Overdue Fees" value={3} comparison="1 last month" onClick={() => setFilter("overdue")} />
</KpiRow>
```

`KpiCard` props: `label`, `value`, `icon`, `trend` (signed %), `trendLabel`, `comparison` (a plain reference string, distinct from `trend`), `loading`, `empty` (renders `—` for genuinely absent data, not loading), `onClick` (makes the whole card a button with hover/focus affordance). 2–4 cards per row, never more even on ultra-wide (`KpiRow`'s grid is `auto-fit, minmax(180px, 1fr)`, so it reflows rather than stretching indefinitely).

### FilterBar (`src/components/ui/FilterBar.jsx`)

The standalone filter bar for pages *not* built on `DataTable` (card grids, Timeline views, Kanban-style boards). Supports search, `select`/`chips`/`dateRange` filter fields, saved views (pass `savedViewsKey` to persist to `localStorage`), active-filter count, and clear-all:

```jsx
<FilterBar
  search={q} onSearch={setQ}
  filters={[
    { key: "status", label: "Status", type: "select", value: status, options: ["All", "Active", "Inactive"], onChange: setStatus },
    { key: "tags", label: "Tags", type: "chips", value: tags, options: ["VIP", "New"], onChange: setTags },
    { key: "range", label: "Joined", type: "dateRange", value: range, onChange: setRange },
  ]}
  savedViewsKey="yd_leads_views"
  actions={<ActionBar actions={[{ key: "add", label: "Add Lead", variant: "primary", onClick: onAdd }]} />}
/>
```

**One implementation only:** if the page uses `DataTable`, do not also render `FilterBar` — `DataTable`'s built-in `DataTableToolbar` already covers search, per-column filters (select/multiselect/date-range), saved searches, active-filter chips, and clear-all. `FilterBar` exists for the pages that have list-like data but aren't a `DataTable` (e.g. a Kanban board, a card-grid directory).

### ActionBar (`src/components/ui/ActionBar.jsx`)

A row of standard-styled buttons — Add/Edit/Delete/Export/Import/Refresh — usable standalone above content or passed into `PageHeader`'s `actions`/`FilterBar`'s `actions` slot. When `selectedCount > 0` and `bulkActions` is provided, it swaps to a bulk-selection bar automatically:

```jsx
<ActionBar
  actions={[
    { key: "export", label: "Export", icon: <Download/>, onClick: handleExport },
    { key: "refresh", label: "Refresh", icon: <RotateCw/>, onClick: reload },
  ]}
  selectedCount={selectedRows.length}
  bulkActions={[{ key: "delete", label: "Delete", variant: "danger", onClick: bulkDelete }]}
  onClearSelection={() => setSelectedRows([])}
/>
```

Table pages: pass `bulkActions`/`exportFormats` straight to `<DataTable>` instead — it renders its own bulk bar in the same visual language, so don't stack a second `ActionBar` underneath it.

### StatusBadge (`src/components/ui/StatusBadge.jsx`)

The one status pill for the whole app. Every status string maps to a semantic token group (`success`/`warning`/`danger`/`info`/`neutral`/`yellow` for elevated-role badges) so colors always come from `tokens.css`, never a hardcoded hex:

```jsx
<StatusBadge status="Active" />      {/* success */}
<StatusBadge status="Overdue" />     {/* danger */}
<StatusBadge status="Completed" />   {/* success */}
```

Covered out of the box: `Active`/`Inactive`/`Alumni`, `Paid`/`Pending`/`Partial`/`Overdue`/`Cancelled`/`Completed`, `Present`/`Absent`/`Late`/`Holiday`, and every login-user role. Adding a new status string a module needs: add one line to `STATUS_LABEL_GROUP` in `StatusBadge.jsx` — never fork a new badge component.

### Skeleton loading (`src/components/ui/Skeleton.jsx`)

Four composed variants on top of the base `Skeleton` primitive, matching real content shape instead of a spinner:

```jsx
import { SkeletonTable, SkeletonCards, SkeletonTimeline, SkeletonForm } from "../../components/ui";

{loading ? <SkeletonTable rows={6} columns={5} /> : <DataTable .../>}
{loading ? <SkeletonCards count={3} /> : <KpiRow>…</KpiRow>}
{loading ? <SkeletonTimeline items={4} /> : <Timeline events={events} />}
{loading ? <SkeletonForm fields={5} /> : <FormSection>…</FormSection>}
```

`DataTable` and `KpiCard` already use these shapes internally when `loading` is passed — reach for the standalone variants only when building a new list/grid/timeline/form that isn't already wrapped by one of those.

### Drawer as the Standard Side Panel (`src/components/ui/Drawer.jsx`)

`Drawer` already is the platform's one side-panel implementation — used (or intended to be used, per this standard) for Student/Employee/Parent/Invoice/Lead/Incident/PTM/Attendance/Pickup detail panels. It slides in from the right, portals to `document.body`, traps `Escape`, and respects `prefers-reduced-motion`:

```jsx
<Drawer isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.name} footer={<Button onClick={save}>Save</Button>}>
  <StudentOverview student={selected} />
</Drawer>
```

No new "side panel" component was introduced — `Drawer`'s existing API (`isOpen`, `onClose`, `title`, `footer`, `width`, `children`) already covers every requirement; introducing a second name for the same thing would violate the "one implementation" rule this standard exists to enforce.

### EmptyState — unchanged, already standard

`EmptyState.jsx` already covers every list/table/timeline's zero-data case (`variant="default"|"filtered"|"error"|"first-time"`, `action`/`secondaryAction`) — see `KUE_BOXS_DESIGN_SYSTEM.md` §1 for the guidelines on which variant to use where. No changes were needed for this standard.

---

## 4. Responsive behavior

- **`PageShell`**: no special mobile behavior of its own beyond tighter padding (§2) — each slot's own component owns its responsive rules.
- **`PageHeader`**: title/subtitle/actions wrap (`flex-wrap`) below ~480px; breadcrumbs wrap onto a second line rather than truncating.
- **`KpiRow`**: `auto-fit, minmax(180px, 1fr)` narrows to `minmax(140px, 1fr)` under 480px — cards reflow from a row into 2 or 1 per line rather than shrinking illegibly.
- **`FilterBar` / `DataTableToolbar`**: search + filter fields wrap; the saved-views/export popovers remain tap-friendly (28px min touch target).
- **`DataTable`**: switches to `DataTableMobileCards` below its mobile breakpoint — this predates this standard and is unchanged by it.
- **`Drawer`**: fixed pixel `width` on desktop; already tested down to 375px as part of Phase 2.2b's Wizard mobile verification (same viewport, same component family).
- **Wizard** (add/edit flows): the mobile compact progress bar (`.yd-wiz-mobile-bar`) replaces the full step rail under 640px — see `wizard.css`. Unrelated to this standard but follows the same "component owns its own breakpoint" principle.

The rule of thumb: **`PageShell` controls order and page-level spacing; every component inside a slot owns its own responsive collapse.** No page should need a bespoke `@media` query just to reflow its header or KPI row — if one seems necessary, the fix belongs in the shared component, not the page.

---

## 5. Worked example — Students module (reference implementation)

`src/pages/Students/StudentList.jsx`:

```jsx
import { PageShell, PageHeader, KpiRow, KpiCard, DataTable } from "../../components/ui";

return (
  <PageShell
    header={
      <PageHeader
        title="Students"
        subtitle={`${students.length} students enrolled`}
        primaryAction={canAdd ? { label: "Add Student", icon: <UserPlus size={14}/>, onClick: onAdd } : undefined}
      />
    }
    kpis={
      <KpiRow maxWidth={560}>
        <KpiCard label="Total Students" value={students.length} loading={loading} />
        <KpiCard label="Active" value={activeCount} loading={loading} />
        <KpiCard label="Classes" value={classCount} loading={loading} />
      </KpiRow>
    }
  >
    <DataTable tableId="students-list" columns={columns} data={students} loading={loading} … />
  </PageShell>
);
```

This is the full anatomy in five lines of JSX: `PageHeader` (title + primary CTA) → `KpiRow` (3 `KpiCard`s) → `DataTable` (which supplies its own Filters row internally) → nothing further needed, since `DataTable` paginates internally. No hand-rolled `<h1>`, no ad-hoc `display:grid` KPI block, no bespoke toolbar — every piece is a shared component.

`StudentWizard` (`src/pages/Students/StudentWizard/`) is the reference implementation for the Add/Edit flow pattern (`Wizard` + autosave + draft recovery), and `StudentProfile` (`src/pages/Students/StudentProfile/`) is the reference for a tabbed detail shell (`StudentHeader` + tab bar + per-tab cards) — both predate this standard slightly (Phase 2.2/2.2b) but already follow its spacing and component-reuse principles, which is why this document treats the whole Students module, not just the list page, as "the reference."

---

## 6. Applying this to Phase 2.3 (Staff) and beyond

Every new module page:

1. Wraps its content in `PageShell`.
2. Uses `PageHeader` for the title/actions row — never a hand-rolled `<h1>` + button.
3. Uses `KpiRow`/`KpiCard` for any summary metrics — never a hand-rolled `display:grid`.
4. Uses either `DataTable` (which supplies its own filter bar) or `FilterBar` for filtering — never both, never a third hand-rolled toolbar.
5. Uses `Drawer` for any detail/side-panel need.
6. Uses `StatusBadge` for any status pill — add a status mapping if a new one is needed, don't fork the component.
7. Uses the `Skeleton*` composites for loading states shaped like the real content.

A module that can't be described using the anatomy in §1 is a sign the *page* needs rethinking, not that this standard needs an exception.

---

*Companion to `KUE_BOXS_DESIGN_SYSTEM.md` (visual language) and `SECURITY_ARCHITECTURE.md` (authorization). Update this document in the same commit whenever `PageShell` or one of the components in §3 changes shape.*
