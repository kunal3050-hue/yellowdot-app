/**
 * parentRoutes.jsx — Parent Module route table (V1)
 * ──────────────────────────────────────────────────────────────────
 * Exports an array of <Route> elements consumed by the top-level
 * <Routes> in App.jsx. Every parent screen is wrapped in ParentLayout
 * and (in production) guarded by ProtectedRoute.
 *
 * V1 surface:
 *   /parent-home            — Home Feed (Phase 2)
 *   /parent-profile         — Parent Profile (Phase 1)
 *   /parent-child/:id       — Child Profile  (Phase 1)
 *   /parent-attendance      — Attendance view (Phase 3)
 *   /parent-memories        — Memories timeline (Phase 4)
 *   /parent-fees            — Fees: balance, invoices, payments (Phase 5)
 *   /parent-daily-care      — Daily Care hub (full screen)
 *
 * No CCTV. No self check-in.
 */

import { lazy } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import ParentLayout from "../components/ParentLayout";

const HomeFeed      = lazy(() => import("../pages/HomeFeed"));
const ParentProfile = lazy(() => import("../pages/ParentProfile"));
const ChildProfile  = lazy(() => import("../pages/ChildProfile"));
const Attendance    = lazy(() => import("../pages/Attendance"));
const Memories      = lazy(() => import("../pages/Memories"));
const Fees          = lazy(() => import("../pages/Fees"));
const DailyCare     = lazy(() => import("../pages/DailyCare"));

// Wrap with ParentLayout; guard with ProtectedRoute unless in DEV.
function wrap(node, routeKey) {
  return import.meta.env.DEV
    ? <ParentLayout>{node}</ParentLayout>
    : <ProtectedRoute routeKey={routeKey}><ParentLayout>{node}</ParentLayout></ProtectedRoute>;
}

export const parentRoutes = [
  <Route key="parent-home"       path="/parent-home"           element={wrap(<HomeFeed />, "dashboard")} />,
  <Route key="parent-profile"    path="/parent-profile"        element={wrap(<ParentProfile />,  "profile")} />,
  <Route key="parent-child"      path="/parent-child/:studentId" element={wrap(<ChildProfile />, "profile")} />,
  <Route key="parent-attendance" path="/parent-attendance"     element={wrap(<Attendance />, "dashboard")} />,
  <Route key="parent-memories"    path="/parent-memories"       element={wrap(<Memories />, "dashboard")} />,
  <Route key="parent-fees"        path="/parent-fees"           element={wrap(<Fees />, "fees")} />,
  <Route key="parent-daily-care"  path="/parent-daily-care"     element={wrap(<DailyCare />, "dashboard")} />,
];

export default parentRoutes;
