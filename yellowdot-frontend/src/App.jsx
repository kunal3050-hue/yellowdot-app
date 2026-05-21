import { BrowserRouter, Routes, Route } from "react-router-dom";

// Auth
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Login from "./pages/auth/Login";
import SelectCenter from "./pages/auth/SelectCenter";
import Profile from "./pages/auth/Profile";
import SecuritySettings from "./pages/auth/SecuritySettings";
import Unauthorized from "./pages/Unauthorized";

// App pages
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import NewAdmission from "./pages/NewAdmission";
import Attendance from "./pages/Attendance";
import Fees from "./pages/Fees";
import StudentProfile from "./pages/StudentProfile";
import AddStudent from "./pages/AddStudent";
import EditStudent from "./pages/EditStudent";
import Invoice from "./pages/Invoice";
import NewInvoice from "./pages/NewInvoice";
import FeeTemplates from "./pages/FeeTemplates";
import GenerateInvoice from "./pages/GenerateInvoice";
import RecordPayment from "./pages/RecordPayment";
import Analytics from "./pages/Analytics";
import NapTracker from "./pages/NapTracker";
import FoodMenu from "./pages/FoodMenu";
import FoodConsumption from "./pages/FoodConsumption";
import CCTVSettings from "./pages/CCTVSettings";
import LiveCCTV from "./pages/LiveCCTV";
import MainLayout from "./layouts/MainLayout";
import InvoiceView from "./pages/InvoiceView";
import ReceiptView  from "./pages/ReceiptView";
import ParentCheckIn from "./pages/ParentCheckIn";
import PickupAuthorization from "./pages/PickupAuthorization";
import PickupHistory from "./pages/PickupHistory";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import RolesPermissions from "./pages/RolesPermissions";
import Holidays from "./pages/Holidays";
import Notices from "./pages/Notices";
import Announcements from "./pages/Announcements";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* ── Public routes ────────────────────────────────────────────── */}
          <Route path="/login" element={<Login />} />

          {/* ── Unauthorized access page (auth required, any role) ────────── */}
          <Route
            path="/unauthorized"
            element={
              <ProtectedRoute>
                <Unauthorized />
              </ProtectedRoute>
            }
          />

          {/* ── Authenticated-only: center selection ─────────────────────── */}
          <Route
            path="/select-center"
            element={
              <ProtectedRoute>
                <SelectCenter />
              </ProtectedRoute>
            }
          />

          {/* ── Authenticated-only: profile & security ───────────────────── */}
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

          {/* ── Main app routes — all protected ──────────────────────────── */}
          <Route
            path="/"
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
            path="/fees"
            element={
              <ProtectedRoute routeKey="fees">
                <Fees />
              </ProtectedRoute>
            }
          />
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
          <Route
            path="/parent-checkin"
            element={
              <ProtectedRoute routeKey="parent-checkin">
                <ParentCheckIn />
              </ProtectedRoute>
            }
          />
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

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
