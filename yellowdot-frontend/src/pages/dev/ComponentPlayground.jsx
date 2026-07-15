/**
 * ComponentPlayground.jsx — dev-only verification harness for Design System v2
 * canonical components (Timeline, ActivityFeed, ...). Not a production page.
 */
import { useMemo, useState } from "react";
import { z } from "zod";
import { UserPlus, ClipboardCheck, Bell as BellIcon, Receipt, Utensils } from "lucide-react";
import {
  Timeline, ActivityFeed, Button, Input, Field, FormGrid,
  KpiCard, LineChart, AreaChart, BarChart, PieChart, Sparkline, ProgressRing,
  Wizard, QuickActionCard, Modal, Drawer, FormSection, useToast,
} from "../../components/ui";

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const TIMELINE_ITEMS = [
  {
    id: "t1", type: "attendance", title: "Checked in", description: "Marked present by Ms. Kavya",
    timestamp: NOW - 1 * HOUR, avatar: { name: "Aarav Sharma" },
  },
  {
    id: "t2", type: "medical", title: "Medication administered", description: "Paracetamol 5ml — fever",
    timestamp: NOW - 3 * HOUR, avatar: { name: "Nurse Priya" },
    expandable: true, details: "Temperature was 99.8°F at 10:15 AM. Administered as per parent-authorized medication plan. Re-checked at 11:00 AM — 98.6°F.",
    attachments: [{ name: "medication-log.pdf", url: "#" }],
  },
  {
    id: "t3", type: "pickup", title: "Picked up by father", description: "Verified via QR code",
    timestamp: NOW - 1 * DAY - 2 * HOUR, avatar: { name: "Rohan Sharma" },
  },
  {
    id: "t4", type: "incident", title: "Minor fall on playground", description: "Small scrape on left knee",
    timestamp: NOW - 2 * DAY, avatar: { name: "Ms. Kavya" },
    expandable: true, details: "Child tripped near the slide. First aid applied, ice pack given. Parent notified via call at 3:45 PM. Incident report #INC-2291 filed.",
    attachments: [{ name: "incident-photo.jpg", url: "#" }, { name: "incident-report.pdf", url: "#" }],
  },
  {
    id: "t5", type: "communication", title: "Message sent to parent", description: "Weekly progress update",
    timestamp: NOW - 9 * DAY, avatar: { name: "Ms. Kavya" },
  },
];

const FEED_CATEGORIES = [
  { key: "system", label: "System", color: "var(--yd-text-soft)", bg: "var(--yd-soft)" },
  { key: "approval", label: "Approval", color: "var(--yd-warning)", bg: "var(--yd-warning-soft)" },
  { key: "mention", label: "Mention", color: "var(--yd-info)", bg: "var(--yd-info-soft)" },
  { key: "billing", label: "Billing", color: "var(--yd-success)", bg: "var(--yd-success-soft)" },
];

function makeFeedItems() {
  return [
    {
      id: "f1", unread: true, category: "mention",
      avatar: { name: "Meera Iyer" },
      title: "Meera Iyer mentioned you", body: "@you can you review the Pre-K attendance sheet before 5 PM?",
      timestamp: NOW - 15 * 60 * 1000,
      actions: [{ label: "Reply", onClick: () => alert("Reply") }],
    },
    {
      id: "f2", unread: true, category: "approval",
      avatar: { name: "System" },
      title: "Leave request awaiting approval", body: "Priya Nair requested 2 days of casual leave (Jul 18–19).",
      timestamp: NOW - 2 * HOUR,
      actions: [
        { label: "Approve", variant: "success", onClick: () => alert("Approved") },
        { label: "Reject", variant: "danger", onClick: () => alert("Rejected") },
      ],
    },
    {
      id: "f3", unread: false, category: "billing",
      avatar: { name: "System" },
      title: "Invoice #INV-3381 paid", body: "₹18,500 received from Rohan Sharma via UPI.",
      timestamp: NOW - 1 * DAY,
      attachments: [{ name: "receipt-3381.pdf", url: "#" }],
    },
    {
      id: "f4", unread: false, category: "system",
      avatar: { name: "System" },
      title: "Backup completed", body: "Nightly Firestore export finished successfully.",
      timestamp: NOW - 2 * DAY,
    },
  ];
}

const MONTHS = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
const REVENUE_TREND = MONTHS.map((m, i) => ({ month: m, revenue: 42000 + i * 6200 + (i % 2) * 3000, expenses: 28000 + i * 3400 }));
const ENROLLMENT_TREND = MONTHS.map((m, i) => ({ month: m, toddler: 18 + i, preschool: 24 + Math.round(i * 1.4), preK: 12 + Math.round(i * 0.6) }));
const CLASSROOM_DISTRIBUTION = [
  { name: "Toddler A", value: 22 }, { name: "Toddler B", value: 19 },
  { name: "Preschool A", value: 27 }, { name: "Preschool B", value: 25 }, { name: "Pre-K", value: 16 },
];
const SPARK_DATA = [4, 6, 5, 8, 9, 7, 11, 13, 12, 15];

const admissionSchema = z.object({
  childName: z.string().min(2, "Child's name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  parentName: z.string().min(2, "Parent's name is required"),
  parentPhone: z.string().min(10, "Enter a valid phone number"),
  notes: z.string().optional(),
});

const ADMISSION_STEPS = [
  {
    key: "child", label: "Child Details", fields: ["childName", "dob"],
    render: (form) => (
      <FormGrid cols={2}>
        <Field label="Child's full name" required error={form.formState.errors.childName?.message}>
          <Input {...form.register("childName")} placeholder="e.g. Aarav Sharma" />
        </Field>
        <Field label="Date of birth" required error={form.formState.errors.dob?.message}>
          <Input type="date" {...form.register("dob")} />
        </Field>
      </FormGrid>
    ),
  },
  {
    key: "parent", label: "Parent Details", fields: ["parentName", "parentPhone"],
    render: (form) => (
      <FormGrid cols={2}>
        <Field label="Parent's full name" required error={form.formState.errors.parentName?.message}>
          <Input {...form.register("parentName")} placeholder="e.g. Rohan Sharma" />
        </Field>
        <Field label="Phone number" required error={form.formState.errors.parentPhone?.message}>
          <Input {...form.register("parentPhone")} placeholder="e.g. 9876543210" />
        </Field>
      </FormGrid>
    ),
  },
  {
    key: "notes", label: "Additional Notes", optional: true, fields: [],
    render: (form) => (
      <Field label="Notes" hint="Optional — any medical conditions, allergies, or special requirements.">
        <Input {...form.register("notes")} placeholder="Optional notes" />
      </Field>
    ),
  },
  {
    key: "review", label: "Review", fields: [],
    render: (form) => {
      const v = form.getValues();
      return (
        <div style={{ fontSize: 13, color: "var(--yd-text-soft)", lineHeight: 1.8 }}>
          <div><strong>Child:</strong> {v.childName || "—"} ({v.dob || "—"})</div>
          <div><strong>Parent:</strong> {v.parentName || "—"} · {v.parentPhone || "—"}</div>
          <div><strong>Notes:</strong> {v.notes || "None"}</div>
        </div>
      );
    },
  },
];

export default function ComponentPlayground() {
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsEmpty, setChartsEmpty] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);
  const [tlLoading, setTlLoading] = useState(false);
  const [tlEmpty, setTlEmpty] = useState(false);
  const [tlHasMore, setTlHasMore] = useState(true);
  const [tlLoadCount, setTlLoadCount] = useState(0);

  const [feedItems, setFeedItems] = useState(makeFeedItems);
  const [feedEmpty, setFeedEmpty] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toast = useToast();

  const timelineData = useMemo(() => (tlEmpty ? [] : TIMELINE_ITEMS), [tlEmpty]);

  function handleLoadMore() {
    setTlLoadCount(c => {
      const next = c + 1;
      if (next >= 2) setTlHasMore(false);
      return next;
    });
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--yd-charcoal)" }}>
          Timeline Playground
        </h1>
        <p style={{ fontSize: 13, color: "var(--yd-text-muted)", marginBottom: 16 }}>
          Dev-only verification harness — exercises grouping, expand/collapse, attachments, infinite scroll.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Button size="sm" variant={tlLoading ? "primary" : "secondary"} onClick={() => setTlLoading(l => !l)}>Toggle loading</Button>
          <Button size="sm" variant={tlEmpty ? "primary" : "secondary"} onClick={() => setTlEmpty(e => !e)}>Toggle empty</Button>
          <Button size="sm" variant="secondary" onClick={() => { setTlHasMore(true); setTlLoadCount(0); }}>Reset hasMore</Button>
        </div>
        <div style={{ background: "var(--yd-surface)", border: "1px solid var(--yd-border)", borderRadius: "var(--yd-radius-lg)", padding: 20 }}>
          <Timeline
            items={timelineData}
            loading={tlLoading}
            hasMore={tlHasMore}
            onLoadMore={handleLoadMore}
            empty={{ action: { label: "+ Add Entry", onClick: () => alert("Add entry") } }}
          />
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--yd-charcoal)" }}>
          ActivityFeed Playground
        </h1>
        <p style={{ fontSize: 13, color: "var(--yd-text-muted)", marginBottom: 16 }}>
          Dev-only verification harness — exercises search, category filters, unread state, inline actions.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Button size="sm" variant={feedLoading ? "primary" : "secondary"} onClick={() => setFeedLoading(l => !l)}>Toggle loading</Button>
          <Button size="sm" variant={feedEmpty ? "primary" : "secondary"} onClick={() => setFeedEmpty(e => !e)}>Toggle empty</Button>
          <Button size="sm" variant="secondary" onClick={() => setFeedItems(makeFeedItems())}>Reset unread</Button>
        </div>
        <div style={{ background: "var(--yd-surface)", border: "1px solid var(--yd-border)", borderRadius: "var(--yd-radius-lg)", padding: 20 }}>
          <ActivityFeed
            items={feedEmpty ? [] : feedItems}
            loading={feedLoading}
            categories={FEED_CATEGORIES}
            onMarkAsRead={(id) => setFeedItems(items => items.map(i => i.id === id ? { ...i, unread: false } : i))}
            onMarkAllAsRead={() => setFeedItems(items => items.map(i => ({ ...i, unread: false })))}
          />
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--yd-charcoal)" }}>
          Charts System Playground
        </h1>
        <p style={{ fontSize: 13, color: "var(--yd-text-muted)", marginBottom: 16 }}>
          Dev-only verification harness — KPI cards, Line/Area/Bar/Donut charts, Sparkline, Progress Ring.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Button size="sm" variant={chartsLoading ? "primary" : "secondary"} onClick={() => setChartsLoading(l => !l)}>Toggle loading</Button>
          <Button size="sm" variant={chartsEmpty ? "primary" : "secondary"} onClick={() => setChartsEmpty(e => !e)}>Toggle empty</Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
          <KpiCard label="Total Students" value="124" trend={8.2} trendLabel="vs last month" sparkline={SPARK_DATA} loading={chartsLoading} />
          <KpiCard label="Fees Collected" value="₹4.8L" trend={-2.1} trendLabel="vs last month" sparkline={SPARK_DATA} loading={chartsLoading} />
          <KpiCard label="Attendance Rate" value="94%" trend={1.4} trendLabel="vs last week" loading={chartsLoading} />
          <div style={{ background: "var(--yd-surface)", border: "1px solid var(--yd-border)", borderRadius: "var(--yd-radius-card)", boxShadow: "var(--yd-elevation-small)", padding: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ProgressRing value={72} />
            <div style={{ fontSize: 12, color: "var(--yd-text-soft)" }}>Capacity<br />used</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
          <div style={{ background: "var(--yd-surface)", border: "1px solid var(--yd-border)", borderRadius: "var(--yd-radius-lg)", padding: 20 }}>
            <LineChart
              title="Revenue vs Expenses" subtitle="Last 6 months"
              data={chartsEmpty ? [] : REVENUE_TREND} xKey="month"
              series={[{ key: "revenue", label: "Revenue" }, { key: "expenses", label: "Expenses" }]}
              loading={chartsLoading}
              valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
              onExport={() => alert("Export revenue chart")}
            />
          </div>
          <div style={{ background: "var(--yd-surface)", border: "1px solid var(--yd-border)", borderRadius: "var(--yd-radius-lg)", padding: 20 }}>
            <AreaChart
              title="Enrollment by Classroom Type" subtitle="Stacked, last 6 months"
              data={chartsEmpty ? [] : ENROLLMENT_TREND} xKey="month" stacked
              series={[{ key: "toddler", label: "Toddler" }, { key: "preschool", label: "Preschool" }, { key: "preK", label: "Pre-K" }]}
              loading={chartsLoading}
            />
          </div>
          <div style={{ background: "var(--yd-surface)", border: "1px solid var(--yd-border)", borderRadius: "var(--yd-radius-lg)", padding: 20 }}>
            <BarChart
              title="Students per Classroom" subtitle="Current term"
              data={chartsEmpty ? [] : CLASSROOM_DISTRIBUTION} xKey="name"
              series={[{ key: "value", label: "Students" }]}
              showLegend={false}
              loading={chartsLoading}
            />
          </div>
          <div style={{ background: "var(--yd-surface)", border: "1px solid var(--yd-border)", borderRadius: "var(--yd-radius-lg)", padding: 20 }}>
            <PieChart
              title="Classroom Distribution" subtitle="Donut, with center total"
              data={chartsEmpty ? [] : CLASSROOM_DISTRIBUTION}
              donut centerLabel={<>109<br /><span style={{ fontSize: 10, fontWeight: 500, color: "var(--yd-text-muted)" }}>students</span></>}
              loading={chartsLoading}
            />
          </div>
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--yd-charcoal)" }}>
          Wizard Playground
        </h1>
        <p style={{ fontSize: 13, color: "var(--yd-text-muted)", marginBottom: 16 }}>
          Dev-only verification harness — Zod validation, autosave/draft recovery, success state.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Button size="sm" variant="secondary" onClick={() => setWizardKey(k => k + 1)}>Reset wizard</Button>
        </div>
        <div style={{ background: "var(--yd-surface)", border: "1px solid var(--yd-border)", borderRadius: "var(--yd-radius-lg)", padding: 24 }}>
          <Wizard
            key={wizardKey}
            steps={ADMISSION_STEPS}
            schema={admissionSchema}
            defaultValues={{ childName: "", dob: "", parentName: "", parentPhone: "", notes: "" }}
            autosaveKey="yd-playground-admission-draft"
            onComplete={(values) => new Promise(resolve => setTimeout(() => { console.log("Wizard submitted:", values); resolve(); }, 400))}
            successState={{
              title: "Admission submitted!",
              description: "The application has been received and is pending review.",
              action: { label: "Start another", onClick: () => setWizardKey(k => k + 1) },
            }}
          />
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--yd-charcoal)" }}>
          Quick Action Card Playground
        </h1>
        <p style={{ fontSize: 13, color: "var(--yd-text-muted)", marginBottom: 16 }}>
          Dev-only verification harness — badges, notification counts, shortcuts, permission-aware visibility, disabled state.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <QuickActionCard
            icon={<UserPlus size={18} strokeWidth={2} />}
            title="Add Student"
            description="Enroll a new student"
            shortcut="⌘N"
            onClick={() => alert("Add Student")}
          />
          <QuickActionCard
            icon={<ClipboardCheck size={18} strokeWidth={2} />}
            title="Take Attendance"
            description="Mark today's attendance"
            badge="New"
            onClick={() => alert("Take Attendance")}
          />
          <QuickActionCard
            icon={<BellIcon size={18} strokeWidth={2} />}
            title="Approve Leave"
            description="2 requests pending"
            count={2}
            onClick={() => alert("Approve Leave")}
          />
          <QuickActionCard
            icon={<Receipt size={18} strokeWidth={2} />}
            title="Generate Invoice"
            description="Requires billing.create permission"
            permission={{ moduleId: "billing", action: "create" }}
            onClick={() => alert("Generate Invoice")}
          />
          <QuickActionCard
            icon={<Utensils size={18} strokeWidth={2} />}
            title="Mark Meal"
            description="Not available right now"
            disabled
            onClick={() => alert("should not fire")}
          />
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--yd-charcoal)" }}>
          Motion Retrofit Playground
        </h1>
        <p style={{ fontSize: 13, color: "var(--yd-text-muted)", marginBottom: 16 }}>
          Dev-only verification harness — Modal, Drawer, Toast, and collapsible FormSection motion retrofit.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Button size="sm" variant="secondary" onClick={() => setDrawerOpen(true)}>Open Drawer</Button>
          <Button size="sm" variant="secondary" onClick={() => toast.show("Saved successfully", "success")}>Show Toast</Button>
        </div>

        <FormSection title="Advanced Settings" description="Click to expand/collapse" collapsible defaultOpen={false}>
          <div style={{ fontSize: 13, color: "var(--yd-text-soft)" }}>
            This content animates in/out via the shared accordion motion variant.
          </div>
        </FormSection>

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Motion-retrofitted Modal">
          <p style={{ fontSize: 13, color: "var(--yd-text-soft)" }}>
            This dialog fades and scales in using the shared dialogVariants preset.
          </p>
        </Modal>

        <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="Motion-retrofitted Drawer">
          <p style={{ fontSize: 13, color: "var(--yd-text-soft)" }}>
            This panel slides in from the right using the shared drawerVariants preset.
          </p>
        </Drawer>
      </div>
    </div>
  );
}
