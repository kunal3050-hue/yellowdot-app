/* ═══════════════════════════════════════════════════════════════════
   Yellow Dot UI — component barrel export
   Import from "../../components/ui" or "@/components/ui"
   ═══════════════════════════════════════════════════════════════════

   Core primitives
   ─────────────────────────────────────────────────────────────────── */
export { default as Button        } from "./Button";
export { default as Badge         } from "./Badge";
export { default as StatusBadge   } from "./StatusBadge";
export { default as Avatar        } from "./Avatar";
export { default as Card          } from "./Card";
export { default as Skeleton      } from "./Skeleton";

/* ── Form ─────────────────────────────────────────────────────────── */
export { default as Input         } from "./Input";
export { default as Select        } from "./Select";
export { default as FormSection,
         Field, FormGrid          } from "./FormSection";

/* ── Layout / Page structure ─────────────────────────────────────── */
export { default as PageHeader    } from "./PageHeader";
export { default as SectionHeader } from "./SectionHeader";
export { default as ActionBar     } from "./ActionBar";

/* ── Data display ────────────────────────────────────────────────── */
export { default as Table         } from "./Table";
export { default as DataTable     } from "./DataTable";
export { default as StatsCard     } from "./StatsCard";
export { default as InvoiceCard   } from "./InvoiceCard";
export { default as Timeline      } from "./Timeline";
export { default as ActivityFeed  } from "./ActivityFeed";

/* ── Charts (Recharts wrapper) ───────────────────────────────────── */
export {
  KpiCard, LineChart, AreaChart, BarChart, PieChart,
  Sparkline, ProgressRing, useChartTokens,
} from "./Charts";

/* ── Wizard (multi-step flow) ────────────────────────────────────── */
export { default as Wizard } from "./Wizard";

/* ── Quick Action Card (dashboard building block) ────────────────── */
export { default as QuickActionCard } from "./QuickActionCard";

/* ── Toolbar / Search ────────────────────────────────────────────── */
export { default as SearchBar     } from "./SearchBar";
export { default as SearchToolbar } from "./SearchToolbar";

/* ── Overlays ────────────────────────────────────────────────────── */
export { default as Modal         } from "./Modal";
export { default as Drawer        } from "./Drawer";
export { default as Tabs          } from "./Tabs";

/* ── State / Feedback ────────────────────────────────────────────── */
export { default as EmptyState    } from "./EmptyState";
export { default as LoadingPage,
         PageError                } from "./LoadingPage";
export { ToastProvider, useToast  } from "./Toast";
