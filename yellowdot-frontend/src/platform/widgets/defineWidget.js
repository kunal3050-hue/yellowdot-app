/**
 * defineWidget.js — Widget descriptor contract
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §3 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * A widget is DATA, not a component. It declares what it needs and where it
 * goes; the engine resolves permissions, fetches, sorts and renders. The
 * engine never learns what a widget means — there is no `switch (widget.id)`
 * anywhere, and if that stops being true the abstraction has failed.
 *
 * Reads are declarative and go through the Service Registry (§5A), so a widget
 * cannot call an API directly and two widgets needing the same read issue one
 * request:
 *
 *     reads: { summary: { service: "attendance", read: "summary",
 *                         args: () => ({ date: todayISO() }) } }
 *
 * `select` then turns the raw payloads into what the layout renders, keeping
 * the app's inconsistent response envelopes out of the view layer.
 */

/** Layouts the engine can currently render. Others are declared but fall back. */
export const SUPPORTED_LAYOUTS = ["stat", "list"];

const VALID_TONES = ["neutral", "good", "warn", "bad"];

export function defineWidget(w) {
  const where = `widget "${w?.id ?? "(missing id)"}"`;

  if (!w?.id)        throw new Error(`Widget registry: ${where} — 'id' is required`);
  if (!w.title)      throw new Error(`Widget registry: ${where} — 'title' is required`);
  if (!w.moduleId)   throw new Error(`Widget registry: ${where} — 'moduleId' is required (links to the Module Registry)`);
  if (!w.capability) throw new Error(`Widget registry: ${where} — 'capability' is required`);

  const layouts = w.layouts ?? ["stat"];
  if (!layouts.some(l => SUPPORTED_LAYOUTS.includes(l))) {
    throw new Error(
      `Widget registry: ${where} — none of its layouts [${layouts}] can be rendered. ` +
      `Supported: ${SUPPORTED_LAYOUTS.join(", ")}`,
    );
  }

  for (const [key, r] of Object.entries(w.reads ?? {})) {
    if (!r?.service || !r?.read) {
      throw new Error(`Widget registry: ${where} — reads.${key} needs { service, read }`);
    }
  }

  if (w.tone && !VALID_TONES.includes(w.tone)) {
    throw new Error(`Widget registry: ${where} — unknown tone "${w.tone}"`);
  }

  return Object.freeze({
    icon: null,
    description: "",
    featureFlag: null,
    priority: 100,             // lower sorts first
    displayOrder: {},          // per-role override of priority
    refreshInterval: 60_000,   // matches the cadence LiveDashboard already uses
    destination: null,         // "Open →" deep link
    reads: {},
    select: () => ({}),
    emptyState: "Nothing to show yet",
    quickActions: [],
    ...w,
    layouts,
  });
}
