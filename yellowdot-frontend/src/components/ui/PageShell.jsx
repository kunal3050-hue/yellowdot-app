/**
 * PageShell — the Standard Page Structure
 * ─────────────────────────────────────────────────────────────────────────
 * Enforces the platform's page anatomy and its order/spacing so every
 * module looks and behaves the same:
 *
 *   Header (PageHeader)
 *     ↓
 *   KPI Cards (KpiRow, optional)
 *     ↓
 *   Filters + Search + View Options (FilterBar, or a DataTable's own toolbar)
 *     ↓
 *   Main Content (Table / Cards / Timeline / Charts)
 *     ↓
 *   Details Drawer / Side Panel (Drawer — portals itself; this slot is for
 *     co-location/readability in the page's JSX, not DOM nesting)
 *     ↓
 *   Pagination / Footer
 *
 * Each slot is optional except `children` (Main Content). See
 * docs/design-system/KUE_BOXS_LAYOUT_STANDARD.md for full usage and the
 * Students module as a worked reference implementation.
 *
 * @prop {ReactNode} header
 * @prop {ReactNode} kpis
 * @prop {ReactNode} filters
 * @prop {ReactNode} children   Main Content (required)
 * @prop {ReactNode} panel      Drawer/side-panel — rendered inline (it portals itself)
 * @prop {ReactNode} footer
 * @prop {string}    className
 */
export default function PageShell({
  header,
  kpis,
  filters,
  children,
  panel,
  footer,
  className = "",
}) {
  return (
    <div className={`yd-shell ${className}`}>
      {(header || kpis) && (
        <div className="yd-shell-top">
          {header}
          {kpis && <div className="yd-shell-kpis">{kpis}</div>}
        </div>
      )}

      {filters}

      <div className="yd-shell-content">{children}</div>

      {panel}

      {footer && <div className="yd-shell-footer">{footer}</div>}
    </div>
  );
}
