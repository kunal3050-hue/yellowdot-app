import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";

// ── Always-eager: infrastructure (tiny, needed on every render) ──────────────
import { AuthProvider }  from "./contexts/AuthContext";
import ProtectedRoute    from "./components/auth/ProtectedRoute";
import Login             from "./pages/auth/Login";
import MainLayout        from "./layouts/MainLayout";
import ParentLayout      from "./layouts/ParentLayout";
import DevRoleSwitch     from "./components/DevRoleSwitch";
import InstallPrompt     from "./components/InstallPrompt";
import SplashScreen      from "./components/SplashScreen";

// ── Lazy-loaded pages (each becomes its own chunk) ───────────────────────────
const SelectCenter        = lazy(() => import("./pages/auth/SelectCenter"));
const Profile             = lazy(() => import("./pages/auth/Profile"));
const SecuritySettings    = lazy(() => import("./pages/auth/SecuritySettings"));
const Unauthorized        = lazy(() => import("./pages/Unauthorized"));

const Dashboard           = lazy(() => import("./pages/Dashboard"));
const Analytics           = lazy(() => import("./pages/Analytics"));
const Students            = lazy(() => import("./pages/Students"));
const NewAdmission        = lazy(() => import("./pages/NewAdmission"));
const AddStudent          = lazy(() => import("./pages/AddStudent"));
const EditStudent         = lazy(() => import("./pages/EditStudent"));
const StudentProfile      = lazy(() => import("./pages/StudentProfile"));

const Attendance          = lazy(() => import("./pages/Attendance"));
const NapTracker          = lazy(() => import("./pages/NapTracker"));
const FoodMenu            = lazy(() => import("./pages/FoodMenu"));
const FoodConsumption     = lazy(() => import("./pages/FoodConsumption"));

const Fees                = lazy(() => import("./pages/Fees"));
const Invoice             = lazy(() => import("./pages/Invoice"));
const NewInvoice          = lazy(() => import("./pages/NewInvoice"));
const FeeTemplates        = lazy(() => import("./pages/FeeTemplates"));
const GenerateInvoice     = lazy(() => import("./pages/GenerateInvoice"));
const RecordPayment       = lazy(() => import("./pages/RecordPayment"));
const InvoiceView         = lazy(() => import("./pages/InvoiceView"));
const ReceiptView         = lazy(() => import("./pages/ReceiptView"));

const CCTVSettings        = lazy(() => import("./pages/CCTVSettings"));
const LiveCCTV            = lazy(() => import("./pages/LiveCCTV"));

const ParentDashboard     = lazy(() => import("./pages/ParentDashboard"));
const ParentCheckIn       = lazy(() => import("./pages/ParentCheckIn"));
const PickupAuthorization = lazy(() => import("./pages/PickupAuthorization"));
const PickupHistory       = lazy(() => import("./pages/PickupHistory"));

const Settings            = lazy(() => import("./pages/Settings"));
const UserManagement      = lazy(() => import("./pages/UserManagement"));
const RolesPermissions    = lazy(() => import("./pages/RolesPermissions"));
const Holidays            = lazy(() => import("./pages/Holidays"));
const Notices             = lazy(() => import("./pages/Notices"));
const Announcements       = lazy(() => import("./pages/Announcements"));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* DEV-only floating view switcher — tree-shaken in production builds */}
        <DevRoleSwitch />
        {/* PWA install banner (shows after 2.5s, respects 30-day dismissal) */}
        <InstallPrompt />
        {/* SplashScreen shown while Firebase auth resolves, then fades out */}
        <AuthSplash />
        <Suspense fallback={<SplashScreen />}>
          <Routes>

            {/* ── Public ───────────────────────────────────────────────────── */}
            <Route path="/login" element={<Login />} />

            <Route
              path="/unauthorized"
              element={
                <ProtectedRoute>
                  <Unauthorized />
                </ProtectedRoute>
              }
            />

            <Route
              path="/select-center"
              element={
                <ProtectedRoute>
                  <SelectCenter />
                </ProtectedRoute>
              }
            />

            {/* ── Profile & security ───────────────────────────────────────── */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute routeKey="profile">
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/security"
              element={
                <ProtectedRoute routeKey="settings">
                  <SecuritySettings />
                </ProtectedRoute>
              }
            />

            {/* ── Parent app ───────────────────────────────────────────────── */}
            <Route
              path="/parent-home"
              element={
                import.meta.env.DEV
                  ? <ParentLayout><ParentDashboard /></ParentLayout>
                  : <ProtectedRoute routeKey="dashboard"><ParentLayout><ParentDashboard /></ParentLayout></ProtectedRoute>
              }
            />
            <Route
              path="/parent-checkin"
              element={
                import.meta.env.DEV
                  ? <ParentLayout><ParentCheckIn /></ParentLayout>
                  : <ProtectedRoute routeKey="parent-checkin"><ParentLayout><ParentCheckIn /></ParentLayout></ProtectedRoute>
              }
            />

            {/* ── Root redirect ─────────────────────────────────────────────── */}
            <Route path="/" element={<RootRedirect />} />

            {/* ── Dashboard & analytics ────────────────────────────────────── */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute routeKey="dashboard">
                  <MainLayout><Dashboard /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute routeKey="analytics">
                  <MainLayout><Analytics /></MainLayout>
                </ProtectedRoute>
              }
            />

            {/* ── Students ─────────────────────────────────────────────────── */}
            <Route
              path="/students"
              element={
                <ProtectedRoute routeKey="students">
                  <Students />
                </ProtectedRoute>
              }
            />
            <Route
              path="/students/new"
              element={
                <ProtectedRoute routeKey="students">
                  <NewAdmission />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-student"
              element={
                <ProtectedRoute routeKey="students">
                  <AddStudent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-student/:id"
              element={
                <ProtectedRoute routeKey="students">
                  <EditStudent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student-profile/:id"
              element={
                <ProtectedRoute routeKey="students">
                  <StudentProfile />
                </ProtectedRoute>
              }
            />

            {/* ── Attendance & daily ops ───────────────────────────────────── */}
            <Route
              path="/attendance"
              element={
                <ProtectedRoute routeKey="attendance">
                  <Attendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nap-tracker"
              element={
                <ProtectedRoute routeKey="nap-tracker">
                  <NapTracker />
                </ProtectedRoute>
              }
            />
            <Route
              path="/food-menu"
              element={
                <ProtectedRoute routeKey="food-menu">
                  <FoodMenu />
                </ProtectedRoute>
              }
            />
            <Route
              path="/food-consumption"
              element={
                <ProtectedRoute routeKey="food-consumption">
                  <FoodConsumption />
                </ProtectedRoute>
              }
            />

            {/* ── Invoices & fees ──────────────────────────────────────────── */}
            <Route
              path="/invoice"
              element={
                <ProtectedRoute routeKey="invoice">
                  <Invoice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoice/new"
              element={
                <ProtectedRoute routeKey="invoice">
                  <NewInvoice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoice/templates"
              element={
                <ProtectedRoute routeKey="invoice">
                  <FeeTemplates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoice-view/:invoiceNumber"
              element={
                <ProtectedRoute routeKey="invoice">
                  <InvoiceView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receipt/:receiptId"
              element={
                <ProtectedRoute routeKey="invoice">
                  <ReceiptView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fees"
              element={
                <ProtectedRoute routeKey="fees">
                  <Fees />
                </ProtectedRoute>
              }
            />
            <Route
              path="/generate-invoice"
              element={
                <ProtectedRoute routeKey="invoice">
                  <GenerateInvoice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/record-payment/:invoiceNumber"
              element={
                <ProtectedRoute routeKey="fees">
                  <RecordPayment />
                </ProtectedRoute>
              }
            />

            {/* ── CCTV ─────────────────────────────────────────────────────── */}
            <Route
              path="/cctv-settings"
              element={
                <ProtectedRoute routeKey="cctv-settings">
                  <CCTVSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live-cctv"
              element={
                <ProtectedRoute routeKey="live-cctv">
                  <LiveCCTV />
                </ProtectedRoute>
              }
            />

            {/* ── Pickup ───────────────────────────────────────────────────── */}
            <Route
              path="/pickup-authorization"
              element={
                <ProtectedRoute routeKey="pickup-authorization">
                  <PickupAuthorization />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pickup-history"
              element={
                <ProtectedRoute routeKey="pickup-history">
                  <PickupHistory />
                </ProtectedRoute>
              }
            />

            {/* ── Communication ────────────────────────────────────────────── */}
            <Route
              path="/holidays"
              element={
                <ProtectedRoute routeKey="holidays">
                  <Holidays />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notices"
              element={
                <ProtectedRoute routeKey="notices">
                  <Notices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements"
              element={
                <ProtectedRoute routeKey="announcements">
                  <Announcements />
                </ProtectedRoute>
              }
            />

            {/* ── Admin ────────────────────────────────────────────────────── */}
            <Route
              path="/user-management"
              element={
                <ProtectedRoute routeKey="user-management">
                  <MainLayout><UserManagement /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roles-permissions"
              element={
                <ProtectedRoute routeKey="roles-permissions">
                  <MainLayout><RolesPermissions /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute routeKey="settings">
                  <MainLayout><Settings /></MainLayout>
                </ProtectedRoute>
              }
            />

          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

// ── AuthSplash — shows the branded splash while Firebase auth initialises ─────
// Mounted once above <Routes>; passes live `loading` to SplashScreen which
// plays its own fade-out animation when loading flips false, then self-removes.
function AuthSplash() {
  const { loading } = useAuth();
  return <SplashScreen authLoading={loading} />;
}

// ── Smart root redirect ───────────────────────────────────────────────────────
// Parents → /parent-home  |  Staff → /dashboard
function RootRedirect() {
  const { role, isAuthenticated, loading } = useAuth();
  if (loading) return null; // splash handles the loading UI
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === "parent") return <Navigate to="/parent-home" replace />;
  return (
    <ProtectedRoute routeKey="dashboard">
      <MainLayout><Dashboard /></MainLayout>
    </ProtectedRoute>
  );
}
