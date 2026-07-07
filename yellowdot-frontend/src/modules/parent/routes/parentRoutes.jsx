/**
 * parentRoutes.jsx — Parent Module route table
 *
 * V2 additions:
 *   /parent-journey   — Unified Child Journey timeline (replaces /parent-memories)
 *   /parent-memories  — Redirects to /parent-journey (V1 backwards compat)
 */

import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import ParentLayout from "../components/ParentLayout";

const HomeFeed       = lazy(() => import("../pages/HomeFeed"));
const ParentProfile  = lazy(() => import("../pages/ParentProfile"));
const ChildProfile   = lazy(() => import("../pages/ChildProfile"));
const Attendance     = lazy(() => import("../pages/Attendance"));
const ParentJourney  = lazy(() => import("../pages/ParentJourney"));
const Fees           = lazy(() => import("../pages/Fees"));
const DailyCare      = lazy(() => import("../pages/DailyCare"));
const FoodMenu       = lazy(() => import("../pages/FoodMenu"));
const Consumption    = lazy(() => import("../pages/Consumption"));
const NapTracker     = lazy(() => import("../pages/NapTracker"));
const Holidays       = lazy(() => import("../pages/Holidays"));
const Notifications  = lazy(() => import("../pages/Notifications"));
const CareHygiene    = lazy(() => import("../pages/CareHygiene"));
const ParentEvents   = lazy(() => import("../pages/Events"));
const ParentPTM      = lazy(() => import("../pages/PTM"));
const ParentIncidents  = lazy(() => import("../pages/Incidents"));
const PickupApproval   = lazy(() => import("../pages/PickupApproval"));
const LiveView         = lazy(() => import("../pages/LiveView"));

// Wrap with ParentLayout; guard with ProtectedRoute unless in DEV.
function wrap(node, routeKey) {
  return import.meta.env.DEV
    ? <ParentLayout>{node}</ParentLayout>
    : <ProtectedRoute routeKey={routeKey}><ParentLayout>{node}</ParentLayout></ProtectedRoute>;
}

export const parentRoutes = [
  <Route key="parent-home"            path="/parent-home"              element={wrap(<HomeFeed />, "dashboard")} />,
  <Route key="parent-profile"         path="/parent-profile"           element={wrap(<ParentProfile />,  "profile")} />,
  <Route key="parent-child"           path="/parent-child/:studentId"  element={wrap(<ChildProfile />, "profile")} />,
  <Route key="parent-attendance"      path="/parent-attendance"        element={wrap(<Attendance />, "dashboard")} />,
  // V2: unified Child Journey timeline
  <Route key="parent-journey"         path="/parent-journey"           element={wrap(<ParentJourney />, "dashboard")} />,
  // V1 redirect: /parent-memories → /parent-journey
  <Route key="parent-memories"        path="/parent-memories"          element={<Navigate to="/parent-journey" replace />} />,
  <Route key="parent-fees"            path="/parent-fees"              element={wrap(<Fees />, "fees")} />,
  <Route key="parent-daily-care"      path="/parent-daily-care"        element={wrap(<DailyCare />, "dashboard")} />,
  <Route key="parent-food-menu"       path="/parent-food-menu"         element={wrap(<FoodMenu />, "dashboard")} />,
  <Route key="parent-consumption"     path="/parent-consumption"       element={wrap(<Consumption />, "dashboard")} />,
  <Route key="parent-nap"             path="/parent-nap"               element={wrap(<NapTracker />, "dashboard")} />,
  <Route key="parent-holidays"        path="/parent-holidays"          element={wrap(<Holidays />, "dashboard")} />,
  <Route key="parent-notifications"   path="/parent-notifications"     element={wrap(<Notifications />, "dashboard")} />,
  <Route key="parent-care"            path="/parent-care"              element={wrap(<CareHygiene />, "dashboard")} />,
  <Route key="parent-events"          path="/parent-events"            element={wrap(<ParentEvents />, "dashboard")} />,
  <Route key="parent-ptm"             path="/parent-ptm"               element={wrap(<ParentPTM />, "dashboard")} />,
  <Route key="parent-incidents"       path="/parent-incidents"         element={wrap(<ParentIncidents />, "dashboard")} />,
  <Route key="parent-pickup-approval" path="/parent-pickup-approval"   element={wrap(<PickupApproval />, "dashboard")} />,
  <Route key="parent-live"            path="/parent-live"              element={wrap(<LiveView />,       "dashboard")} />,
];

export default parentRoutes;
