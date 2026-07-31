/**
 * defineTaskProvider.js — Task Engine contract
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §4 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * Care is ONE continuously-sorted list of Task objects, not a stack of
 * module-labelled sections. A provider turns one module's data into Tasks; the
 * engine does exactly two things to them — escalate() and sort() — and nothing
 * else. That is what keeps business logic in the owning module.
 *
 * The rule that prevents duplication: **Care reads, links and counts. It never
 * mutates, validates, or owns a business rule.** A task leaves the queue
 * because its state changed in the module that owns it, not because Care
 * marked it done.
 *
 * Providers declare reads the same way widgets do (§5A), so Care and Dashboard
 * share one service layer and one set of endpoints.
 */

/** Weakest → strongest. Index is the rank, so escalation is +1. */
export const TIERS = ["low", "medium", "high", "critical"];

export const STATUSES = ["pending", "in_progress", "completed"];

export function tierRank(tier) {
  const i = TIERS.indexOf(tier);
  return i === -1 ? 0 : i;
}

/** Bump one tier, capped at critical. */
export function escalateOnce(tier) {
  return TIERS[Math.min(tierRank(tier) + 1, TIERS.length - 1)];
}

/**
 * Compute a task's effective priority (§3b).
 *
 * Deliberately rule-based and explainable — a support engineer must be able to
 * read this and defend why an item is at the top. This is NOT the deferred AI
 * Insights feature (§5E); do not conflate them.
 *
 * Escalates AT MOST ONE TIER in total, not one per rule. An item that is both
 * overdue and inside its urgent window is urgent once, not twice — otherwise
 * everything reaches critical by mid-afternoon and the ranking stops meaning
 * anything.
 *
 * @returns {{ priority: string, reason: string|null }} reason is shown in the UI
 */
export function computePriority(task, now = new Date()) {
  const base = TIERS.includes(task.basePriority) ? task.basePriority : "medium";

  if (task.status === "completed") return { priority: base, reason: null };

  const due = task.dueAt ? new Date(task.dueAt) : null;
  const dueValid = due && !isNaN(due);

  if (dueValid && due.getTime() < now.getTime()) {
    return { priority: escalateOnce(base), reason: "Overdue" };
  }

  // Inside the domain's urgent window — the last N minutes before due.
  if (dueValid && task.urgentWindowMs) {
    const msLeft = due.getTime() - now.getTime();
    if (msLeft <= task.urgentWindowMs) {
      return { priority: escalateOnce(base), reason: "Due soon" };
    }
  }

  return { priority: base, reason: null };
}

/** Sort: priority desc → dueAt asc → createdAt asc. Stable and total. */
export function compareTasks(a, b) {
  const byPriority = tierRank(b.priority) - tierRank(a.priority);
  if (byPriority) return byPriority;

  const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
  const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
  if (ad !== bd) return ad - bd;

  const ac = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
  const bc = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
  if (ac !== bc) return ac - bc;

  return String(a.id).localeCompare(String(b.id));
}

/** Normalise + validate one Task emitted by a provider. */
export function normalizeTask(raw, provider) {
  if (!raw?.id)    throw new Error(`Task provider "${provider.id}" emitted a task with no id`);
  if (!raw.title)  throw new Error(`Task provider "${provider.id}" emitted task "${raw.id}" with no title`);

  const status = STATUSES.includes(raw.status) ? raw.status : "pending";
  return {
    context:   "",
    dueAt:     null,
    owner:     null,
    deepLink:  provider.deepLink ?? null,
    createdAt: null,
    urgentWindowMs: provider.urgentWindowMs ?? null,
    ...raw,
    status,
    moduleId:     provider.moduleId,
    basePriority: raw.basePriority ?? provider.basePriority ?? "medium",
  };
}

/**
 * @param {object} def
 * @param {string} def.id           provider id
 * @param {string} def.moduleId     MUST exist in the Module Registry — enforced by the engine
 * @param {string} def.capability   gate (§2a)
 * @param {string} [def.featureFlag]
 * @param {string} def.basePriority declared judgement call for this KIND of item
 * @param {object} def.reads        { key: { service, read, args } } — same shape as widgets
 * @param {function} def.toTasks    (data) => Task[]
 */
export function defineTaskProvider(def) {
  const where = `task provider "${def?.id ?? "(missing id)"}"`;

  if (!def?.id)       throw new Error(`Task registry: ${where} — 'id' is required`);
  if (!def.moduleId)  throw new Error(`Task registry: ${where} — 'moduleId' is required`);
  if (!def.capability) throw new Error(`Task registry: ${where} — 'capability' is required`);
  if (typeof def.toTasks !== "function") {
    throw new Error(`Task registry: ${where} — 'toTasks' must be a function`);
  }
  if (def.basePriority && !TIERS.includes(def.basePriority)) {
    throw new Error(`Task registry: ${where} — unknown basePriority "${def.basePriority}"`);
  }
  for (const [key, r] of Object.entries(def.reads ?? {})) {
    if (!r?.service || !r?.read) {
      throw new Error(`Task registry: ${where} — reads.${key} needs { service, read }`);
    }
  }

  return Object.freeze({
    featureFlag: null,
    basePriority: "medium",
    reads: {},
    urgentWindowMs: null,
    ...def,
  });
}
