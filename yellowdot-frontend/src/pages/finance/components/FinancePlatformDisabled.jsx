/**
 * FinancePlatformDisabled — shown in place of a Finance screen's real
 * content when GET /api/finance/status reports enabled:false.
 * ─────────────────────────────────────────────────────────────────────────
 * Deliberately calm and informational, not an error state — nothing is
 * broken, the module simply isn't switched on for this school yet. Every
 * Finance screen renders this instead of its own KPIs/tables/forms while
 * disabled, which also means none of those screens' create/edit/approve
 * actions are even mounted — there is nothing on screen that could trigger
 * a call to a route that doesn't exist.
 */
import EmptyState from "../../../components/ui/EmptyState";

export default function FinancePlatformDisabled({ title, description }) {
  return (
    <EmptyState
      variant="disabled"
      size="lg"
      title={title || "Finance Platform is not yet enabled"}
      description={
        description ||
        "This module is switched off for your school right now. Once your administrator turns it on, this screen will start showing live billing, payment and ledger data automatically — nothing to do here."
      }
    />
  );
}
