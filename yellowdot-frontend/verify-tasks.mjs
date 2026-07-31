/**
 * verify-tasks.mjs — Task Engine rules + provider mapping
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §12 Phase 9 / §4
 *
 * Usage: npm run verify:tasks
 *
 * The Task Engine's core is two PURE functions — computePriority() and
 * compareTasks() — which is exactly what makes the escalation ladder testable
 * with a simulated clock instead of by waiting until 4:45pm. The providers'
 * toTasks() are pure too, so their mapping is checked against fixtures without
 * a backend.
 *
 * This is the part of Care that a live backend cannot validate any better: the
 * ordering rules are deterministic, and getting them wrong is invisible in a
 * screenshot.
 */
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { makeReporter } from "./verify-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { pass, fail, warn, section, state } = makeReporter();

const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const iso = (h, m = 0) => at(h, m).toISOString();

async function run() {
  console.log("\n🔍 Task Engine — PLATFORM_ARCHITECTURE §12 Phase 9");

  const T = await import("./src/platform/tasks/defineTaskProvider.js");
  const PROVIDERS = (await import("./src/platform/tasks/providers.js")).default;
  const registry = await import("./src/platform/registry/index.js");

  // ── 1. Escalation ladder (§3b worked example) ──────────────────────────────
  section("1. Escalation ladder, simulated clock");

  const MIN = 60 * 1000;
  const cases = [
    // [label, task, now, expectedPriority]
    ["incident reported 40m ago, overdue → escalates",
      { basePriority: "high", status: "pending", dueAt: iso(8, 30) }, at(9, 0), "critical"],
    ["attendance at 09:00, cutoff 09:30 → not yet overdue",
      { basePriority: "medium", status: "pending", dueAt: iso(9, 30) }, at(9, 0), "medium"],
    ["attendance at 09:31, cutoff 09:30 → overdue, escalates",
      { basePriority: "medium", status: "pending", dueAt: iso(9, 30) }, at(9, 31), "high"],
    ["pickup at 09:00, due 17:00, 30m window → calm",
      { basePriority: "high", status: "pending", dueAt: iso(17, 0), urgentWindowMs: 30 * MIN }, at(9, 0), "high"],
    ["pickup at 16:45, due 17:00, 30m window → inside window, escalates",
      { basePriority: "high", status: "pending", dueAt: iso(17, 0), urgentWindowMs: 30 * MIN }, at(16, 45), "critical"],
    ["low with no due time → unchanged",
      { basePriority: "low", status: "pending", dueAt: null }, at(12, 0), "low"],
    ["critical stays capped at critical",
      { basePriority: "critical", status: "pending", dueAt: iso(8, 0) }, at(12, 0), "critical"],
    ["completed task is never escalated",
      { basePriority: "medium", status: "completed", dueAt: iso(8, 0) }, at(12, 0), "medium"],
  ];

  let ladderFails = 0;
  for (const [label, task, now, expected] of cases) {
    const { priority } = T.computePriority(task, now);
    if (priority !== expected) {
      fail(`escalation: ${label}`, `got ${priority}, expected ${expected}`);
      ladderFails++;
    }
  }

  // The one-tier cap: both overdue AND inside the urgent window must escalate
  // ONCE, not twice — otherwise everything reaches critical by mid-afternoon.
  const doubleTrigger = T.computePriority(
    { basePriority: "medium", status: "pending", dueAt: iso(9, 0), urgentWindowMs: 30 * MIN },
    at(9, 15),
  );
  if (doubleTrigger.priority !== "high") {
    fail("escalation caps at ONE tier when several rules fire",
         `got ${doubleTrigger.priority}, expected high`);
    ladderFails++;
  }
  if (!ladderFails) pass("Ladder correct", `${cases.length + 1} cases, simulated clock`);

  // ── 2. Sort order ──────────────────────────────────────────────────────────
  section("2. Feed ordering");

  // b critical/09:00 · a critical/17:00 · d high/10:00 · c low/no due  →  "badc"
  // Note d (high, due 10:00) sorts BELOW a (critical, due 17:00): priority
  // outranks due time, which is the whole point of the ladder.
  const feed = [
    { id: "c", priority: "low",      dueAt: null,    createdAt: iso(8) },
    { id: "a", priority: "critical", dueAt: iso(17), createdAt: iso(8) },
    { id: "d", priority: "high",     dueAt: iso(10), createdAt: iso(8) },
    { id: "b", priority: "critical", dueAt: iso(9),  createdAt: iso(8) },
  ].sort(T.compareTasks).map(t => t.id).join("");

  if (feed !== "badc") fail("sort order wrong", `got "${feed}", expected "badc"`);
  else pass("Sorted priority desc → dueAt asc → createdAt asc", feed);

  // ── 3. Providers belong to registered modules ──────────────────────────────
  section("3. Providers integrate through the Module Registry");

  let orphan = 0;
  for (const p of PROVIDERS) {
    if (!registry.MODULES_BY_ID[p.moduleId]) {
      fail(`provider "${p.id}" references unregistered moduleId "${p.moduleId}"`);
      orphan++;
    }
  }
  if (!orphan) pass("Every provider maps to a registered module", `${PROVIDERS.length} providers`);

  // ── 4. Provider mapping against fixtures ───────────────────────────────────
  section("4. toTasks() mapping");

  const byId = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));

  const pickup = byId["pickup-approvals"].toTasks({
    requests: { success: true, requests: [
      { id: "REQ1", studentName: "Aarav", createdAt: iso(15), requestedBy: "Mother" },
    ] },
  });
  if (pickup.length !== 1 || !pickup[0].id.startsWith("pickup:") || pickup[0].status !== "pending") {
    fail("pickup provider mapping", JSON.stringify(pickup));
  } else pass("pickup-approvals maps a request to a Task", pickup[0].context);

  // Failed/!success envelopes must yield NOTHING, never a fabricated task.
  const pickupFail = byId["pickup-approvals"].toTasks({ requests: { success: false } });
  if (pickupFail.length !== 0) fail("failed envelope must produce no tasks");
  else pass("Failed envelope produces zero tasks", "no fabricated work items");

  const attendance = byId["attendance-pending"].toTasks({
    summary:  { success: true, summary: { present: 8, absent: 2 } },
    students: { students: new Array(15).fill({ }) },
  });
  if (attendance.length !== 1 || !/5 of 15/.test(attendance[0].context)) {
    fail("attendance provider mapping", JSON.stringify(attendance));
  } else pass("attendance-pending computes unmarked correctly", attendance[0].context);

  // Fully marked → no task at all.
  const attendanceDone = byId["attendance-pending"].toTasks({
    summary:  { success: true, summary: { present: 13, absent: 2 } },
    students: { students: new Array(15).fill({ }) },
  });
  if (attendanceDone.length !== 0) fail("fully-marked attendance must produce no task");
  else pass("Fully-marked register produces no task", "queue stays clean");

  const invoices = byId["overdue-invoices"].toTasks({
    invoices: { success: true, invoices: [
      { status: "Overdue", balance: 5000 }, { status: "Overdue", balance: 2500 }, { status: "Paid", balance: 0 },
    ] },
  });
  if (invoices.length !== 1 || !/2 invoices/.test(invoices[0].context)) {
    fail("overdue-invoices mapping", JSON.stringify(invoices));
  } else pass("overdue-invoices aggregates rather than flooding", invoices[0].context);

  // ── 5. Normalisation ───────────────────────────────────────────────────────
  section("5. Task normalisation");

  try {
    T.normalizeTask({ title: "x" }, { id: "p", moduleId: "m" });
    fail("a task with no id must throw");
  } catch { pass("Missing id rejected", "providers cannot emit unkeyed tasks"); }

  const norm = T.normalizeTask({ id: "1", title: "t", status: "bogus" }, { id: "p", moduleId: "attendance" });
  if (norm.status !== "pending") fail("unknown status must fall back to pending", norm.status);
  else pass("Unknown status falls back to pending", "fails closed");

  section("Summary");
  console.log(`   Providers      : ${PROVIDERS.length}`);
  console.log(`   Ladder cases   : ${cases.length + 1}`);

  if (state.failures) {
    console.error(`\n❌ ${state.failures} failure(s).\n`);
    process.exit(1);
  }
  console.log(`\n✅ Task Engine rules verified.\n`);
}

run().catch(err => {
  console.error("\n❌ verify-tasks crashed:\n", err);
  process.exit(1);
});
