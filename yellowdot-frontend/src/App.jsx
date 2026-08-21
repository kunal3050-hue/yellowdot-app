import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useIsMobile } from "./hooks/useIsMobile";

// ── Always-eager: infrastructure (tiny, needed on every render) ──────────────
import { AuthProvider }  from "./contexts/AuthContext";
import { InstallProvider } from "./contexts/InstallContext";
import ProtectedRoute    from "./components/auth/ProtectedRoute";
import Login             from "./pages/auth/Login";
import MainLayout        from "./layouts/MainLayout";
import { parentRoutes } from "./modules/parent";
import DevRoleSwitch     from "./components/DevRoleSwitch";
import InstallPrompt     from "./components/InstallPrompt";
import IosInstallGuide   from "./components/IosInstallGuide";
import SplashScreen      from "./components/SplashScreen";

// ── Lazy-loaded pages (each becomes its own chunk) ───────────────────────────
const SelectCenter        = lazy(() => import("./pages/auth/SelectCenter"));
const Profile             = lazy(() => import("./pages/auth/Profile"));
const SecuritySettings    = lazy(() => import("./pages/auth/SecuritySettings"));
const ProfileIncomplete   = lazy(() => import("./pages/auth/ProfileIncomplete"));
const Unauthorized        = lazy(() => import("./pages/Unauthorized"));

const LiveDashboard       = lazy(() => import("./pages/LiveDashboard"));
const Dashboard           = lazy(() => import("./pages/Dashboard"));
const Care                = lazy(() => import("./pages/Care"));
const StaffHome           = lazy(() => import("./staffMobile/StaffHome"));
const QuickNav            = lazy(() => import("./pages/QuickNav"));
const QuickNavigation     = lazy(() => import("./pages/quickNavigation"));
const Analytics           = lazy(() => import("./pages/Analytics"));
const CCTV                = lazy(() => import("./pages/CCTV"));
const Students            = lazy(() => import("./pages/Students"));
const StudentWizard       = lazy(() => import("./pages/Students/StudentWizard"));
const StudentProfile      = lazy(() => import("./pages/StudentProfile"));

const Attendance          = lazy(() => import("./pages/Attendance"));
const MobileAttendance    = lazy(() => import("./staffMobile/screens/MobileAttendance"));
const MobileCareHygiene   = lazy(() => import("./staffMobile/screens/MobileCareHygiene"));
const ChildPresence       = lazy(() => import("./pages/ChildPresence"));
const NapTracker          = lazy(() => import("./pages/NapTracker"));
const FoodMenu            = lazy(() => import("./pages/FoodMenu"));
const FoodConsumption     = lazy(() => import("./pages/FoodConsumption"));
const CareHygiene         = lazy(() => import("./pages/CareHygiene"));




// Parent screens are defined in src/modules/parent (see parentRoutes).
// (Self check-in is staff-only via the backend; not exposed in the parent app.)
const PickupAuthorization = lazy(() => import("./pages/PickupAuthorization"));
const PickupHistory       = lazy(() => import("./pages/PickupHistory"));
const StaffCheckout       = lazy(() => import("./pages/StaffCheckout"));
const PickupMigration     = lazy(() => import("./pages/PickupMigration"));

const Settings            = lazy(() => import("./pages/Settings"));
const UserManagement      = lazy(() => import("./pages/UserManagement"));
const RolesPermissions    = lazy(() => import("./pages/RolesPermissions"));
const ModuleExplorer      = lazy(() => import("./pages/dev/ModuleExplorer"));
const DataTablePlayground = lazy(() => import("./pages/dev/DataTablePlayground"));
const ComponentPlayground = lazy(() => import("./pages/dev/ComponentPlayground"));
const QRManagement        = lazy(() => import("./pages/QRManagement"));
const AcademicsClasses            = lazy(() => import("./pages/academics/AcademicsClasses"));
const AcademicsBatches            = lazy(() => import("./pages/academics/AcademicsBatches"));
const AcademicsTeacherAllocation  = lazy(() => import("./pages/academics/AcademicsTeacherAllocation"));
const AcademicsClassroomAllocation= lazy(() => import("./pages/academics/AcademicsClassroomAllocation"));
const AcademicsStudentAllocation  = lazy(() => import("./pages/academics/AcademicsStudentAllocation"));


const ChildJourney        = lazy(() => import("./pages/ChildJourney"));
const NewObservation      = lazy(() => import("./pages/NewObservation"));
const NewArtwork          = lazy(() => import("./pages/NewArtwork"));
const NewMilestone        = lazy(() => import("./pages/NewMilestone"));

const Holidays            = lazy(() => import("./pages/Holidays"));
const Notices             = lazy(() => import("./pages/Notices"));
const Announcements       = lazy(() => import("./pages/Announcements"));
const Events              = lazy(() => import("./pages/Events"));
const PTM                 = lazy(() => import("./pages/PTM"));
const Incidents           = lazy(() => import("./pages/Incidents"));

// ── Staff Management pages ──────────────────────────────────────────────────
const StaffDashboard      = lazy(() => import("./pages/staff/StaffDashboard"));
const StaffDirectory      = lazy(() => import("./pages/staff/StaffDirectory"));
const StaffProfilePage    = lazy(() => import("./pages/staff/StaffProfile"));
const StaffDepartments    = lazy(() => import("./pages/staff/StaffDepartments"));
const StaffDesignations   = lazy(() => import("./pages/staff/StaffDesignations"));
// Phase 2 — Attendance
const AttendanceDashboard = lazy(() => import("./pages/staff/attendance/AttendanceDashboard"));
const AttendanceToday     = lazy(() => import("./pages/staff/attendance/AttendanceToday"));
const AttendanceCalendar  = lazy(() => import("./pages/staff/attendance/AttendanceCalendar"));
const AttendanceHistory   = lazy(() => import("./pages/staff/attendance/AttendanceHistory"));
const AttendanceReports   = lazy(() => import("./pages/staff/attendance/AttendanceReports"));
const StaffShifts         = lazy(() => import("./pages/staff/attendance/StaffShifts"));
// Phase 3 — Leave
const LeaveDashboard      = lazy(() => import("./pages/staff/leave/LeaveDashboard"));
const LeaveTypes          = lazy(() => import("./pages/staff/leave/LeaveTypes"));
const LeaveApply          = lazy(() => import("./pages/staff/leave/LeaveApply"));
const LeaveApprovals      = lazy(() => import("./pages/staff/leave/LeaveApprovals"));
const LeaveCalendarPage   = lazy(() => import("./pages/staff/leave/LeaveCalendar"));
const LeaveReports        = lazy(() => import("./pages/staff/leave/LeaveReports"));
// Phase 4 — Payroll
const PayrollDashboard    = lazy(() => import("./pages/staff/payroll/PayrollDashboard"));
const SalaryComponents    = lazy(() => import("./pages/staff/payroll/SalaryComponents"));
const SalaryStructures    = lazy(() => import("./pages/staff/payroll/SalaryStructures"));
const StaffSalaryPage     = lazy(() => import("./pages/staff/payroll/StaffSalary"));
const PayrollRun          = lazy(() => import("./pages/staff/payroll/PayrollRun"));
const PayrollHistory      = lazy(() => import("./pages/staff/payroll/PayrollHistory"));
const BankReport          = lazy(() => import("./pages/staff/payroll/BankReport"));
// Phase 5 — Performance
const PerformanceDashboard= lazy(() => import("./pages/staff/performance/PerformanceDashboard"));
const PerformanceKpis     = lazy(() => import("./pages/staff/performance/PerformanceKpis"));
const PerformanceReviews  = lazy(() => import("./pages/staff/performance/PerformanceReviews"));
const PerformanceGoals    = lazy(() => import("./pages/staff/performance/PerformanceGoals"));
const ParentFeedback      = lazy(() => import("./pages/staff/performance/ParentFeedback"));
const AwardsPromotions    = lazy(() => import("./pages/staff/performance/AwardsPromotions"));
const PerformanceTimelinePage = lazy(() => import("./pages/staff/performance/PerformanceTimeline"));

// ── Super Admin pages ───────────────────────────────────────────────────────
const TenantList          = lazy(() => import("./pages/superadmin/TenantList"));
const TenantCreate        = lazy(() => import("./pages/superadmin/TenantCreate"));
const TenantDetail        = lazy(() => import("./pages/superadmin/TenantDetail"));
const PlatformAnalytics   = lazy(() => import("./pages/superadmin/PlatformAnalytics"));
const AuditLogs           = lazy(() => import("./pages/superadmin/AuditLogs"));
const ImpersonateLogin    = lazy(() => import("./pages/superadmin/ImpersonateLogin"));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
       <InstallProvider>
        {/* DEV-only floating view switcher — tree-shaken in production builds */}
        <DevRoleSwitch />
        {/* PWA install banner (shows after 2.5s, respects 30-day dismissal) */}
        <InstallPrompt />
        {/* iOS "Add to Home Screen" guide — opened from the banner, Login,
            Sidebar footer, or Settings → About; all share InstallContext */}
        <IosInstallGuide />
        {/* SplashScreen shown while Firebase auth resolves, then fades out */}
        <AuthSplash />
        <Suspense fallback={<SplashScreen />}>
          <Routes>

            {/* ── Public ───────────────────────────────────────────────────── */}
            <Route path="/login" element={<Login />} />

            {/* ── Profile incomplete (Firebase auth OK, but no Firestore profile) */}
            <Route path="/profile-incomplete" element={<ProfileIncomplete />} />

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

            {/* ── Parent Module (src/modules/parent) ───────────────────────── */}
            {parentRoutes}

            {/* ── Root redirect ─────────────────────────────────────────────── */}
            <Route path="/" element={<RootRedirect />} />

            {/* ── Dashboard & analytics ────────────────────────────────────── */}
            {/* PLATFORM ARCHITECTURE §6 — the Widget Engine dashboard. Added
                alongside /live-dashboard rather than replacing it: swapping the
                landing page is a separate, riskier change, and LIVE_DASHBOARD
                is still pre-production only (§12 Phase 8). */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute routeKey="dashboard">
                  <MainLayout><Dashboard /></MainLayout>
                </ProtectedRoute>
              }
            />
            {/* PLATFORM ARCHITECTURE §7 — Care. Gated on the same "dashboard"
                routeKey as the surfaces it replaces: Care shows only what the
                user's own capabilities already allow, so it grants nothing new. */}
            <Route
              path="/care"
              element={
                <ProtectedRoute routeKey="dashboard">
                  <MainLayout><Care /></MainLayout>
                </ProtectedRoute>
              }
            />
            {/* Staff Home plan (2026-07-31) — same "dashboard" routeKey gate
                as /dashboard and /care above: this grants nothing new, it's
                the Parent-Home-style mobile presentation of the same
                capability-driven content. NOT wrapped in MainLayout — it has
                its own shell (StaffHome), same pattern as Parent's own
                routes being outside MainLayout. */}
            <Route
              path="/staff-mobile"
              element={
                <ProtectedRoute routeKey="dashboard">
                  <StaffHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live-dashboard"
              element={
                <ProtectedRoute routeKey="dashboard">
                  <MainLayout><LiveDashboard /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quick-nav"
              element={
                <ProtectedRoute routeKey="dashboard">
                  <MainLayout><QuickNav /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quick-navigation"
              element={
                <ProtectedRoute routeKey="dashboard">
                  <MainLayout><QuickNavigation /></MainLayout>
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
                  <StudentWizard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-student"
              element={
                <ProtectedRoute routeKey="students">
                  <StudentWizard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-student/:id"
              element={
                <ProtectedRoute routeKey="students">
                  <StudentWizard />
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


            {/* ── Child Journey ────────────────────────────────────────────── */}
            <Route
              path="/child-journey"
              element={
                <ProtectedRoute routeKey="child-journey">
                  <ChildJourney />
                </ProtectedRoute>
              }
            />
            <Route
              path="/child-journey/observe"
              element={
                <ProtectedRoute routeKey="child-journey">
                  <NewObservation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/child-journey/artwork"
              element={
                <ProtectedRoute routeKey="child-journey">
                  <NewArtwork />
                </ProtectedRoute>
              }
            />
            <Route
              path="/child-journey/milestone"
              element={
                <ProtectedRoute routeKey="child-journey">
                  <NewMilestone />
                </ProtectedRoute>
              }
            />

            {/* ── Attendance & daily ops ───────────────────────────────────── */}
            <Route
              path="/attendance"
              element={
                <ProtectedRoute routeKey="attendance">
                  <AttendanceRoute />
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
              path="/care-hygiene"
              element={
                <ProtectedRoute routeKey="care-hygiene">
                  <CareHygieneRoute />
                </ProtectedRoute>
              }
            />

            {/* ── Finance Platform (new, additive; disabled feature flag server-side) ── */}

            {/* ── CCTV (V2 Phase 1 — metadata management, no streaming) ─────── */}
            <Route
              path="/cctv"
              element={
                <ProtectedRoute routeKey="cctv">
                  <MainLayout><CCTV /></MainLayout>
                </ProtectedRoute>
              }
            />

            {/* ── Child Presence (unified: Attendance + Parent Entry + Staff Checkout) */}
            <Route
              path="/child-presence"
              element={
                <ProtectedRoute routeKey="attendance">
                  <MainLayout><ChildPresence /></MainLayout>
                </ProtectedRoute>
              }
            />

            {/* ── Presence & Safety ────────────────────────────────────────── */}
            <Route
              path="/qr-management"
              element={
                <ProtectedRoute routeKey="qr-management">
                  <MainLayout><QRManagement /></MainLayout>
                </ProtectedRoute>
              }
            />

            {/* ── Pickup ───────────────────────────────────────────────────── */}
            <Route
              path="/pickup-authorization"
              element={
                <ProtectedRoute routeKey="pickup-authorization">
                  <MainLayout><PickupAuthorization /></MainLayout>
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
              path="/staff-checkout"
              element={
                <ProtectedRoute routeKey="staff-checkout">
                  <MainLayout><StaffCheckout /></MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/pickup-migration"
              element={
                <ProtectedRoute routeKey="attendance">
                  <PickupMigration />
                </ProtectedRoute>
              }
            />

            {/* ── Academics ────────────────────────────────────────────────── */}
            <Route
              path="/academics/classes"
              element={
                <ProtectedRoute routeKey="academics-classes">
                  <MainLayout><AcademicsClasses /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/academics/batches"
              element={
                <ProtectedRoute routeKey="academics-batches">
                  <MainLayout><AcademicsBatches /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/academics/teacher-allocation"
              element={
                <ProtectedRoute routeKey="academics-teacher-allocation">
                  <MainLayout><AcademicsTeacherAllocation /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/academics/classroom-allocation"
              element={
                <ProtectedRoute routeKey="academics-classroom-allocation">
                  <MainLayout><AcademicsClassroomAllocation /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/academics/student-allocation"
              element={
                <ProtectedRoute routeKey="academics-student-allocation">
                  <MainLayout><AcademicsStudentAllocation /></MainLayout>
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
            <Route
              path="/events"
              element={
                <ProtectedRoute routeKey="events">
                  <Events />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ptm"
              element={
                <ProtectedRoute routeKey="ptm">
                  <PTM />
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidents"
              element={
                <ProtectedRoute routeKey="incidents">
                  <Incidents />
                </ProtectedRoute>
              }
            />

            {/* ── Dev tools (super_admin / developer only) ─────────────────── */}
            <Route
              path="/dev/modules"
              element={
                import.meta.env.DEV
                  ? <MainLayout><ModuleExplorer /></MainLayout>
                  : <ProtectedRoute routeKey="dev-tools"><MainLayout><ModuleExplorer /></MainLayout></ProtectedRoute>
              }
            />
            <Route
              path="/dev/datatable-playground"
              element={
                import.meta.env.DEV
                  ? <MainLayout><DataTablePlayground /></MainLayout>
                  : <ProtectedRoute routeKey="dev-tools"><MainLayout><DataTablePlayground /></MainLayout></ProtectedRoute>
              }
            />
            <Route
              path="/dev/component-playground"
              element={
                import.meta.env.DEV
                  ? <MainLayout><ComponentPlayground /></MainLayout>
                  : <ProtectedRoute routeKey="dev-tools"><MainLayout><ComponentPlayground /></MainLayout></ProtectedRoute>
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

            {/* ── Staff Management ─────────────────────────────────────────── */}
            <Route
              path="/staff/dashboard"
              element={
                <ProtectedRoute routeKey="staff-dashboard">
                  <MainLayout><StaffDashboard /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/employees"
              element={
                <ProtectedRoute routeKey="staff-management">
                  <MainLayout><StaffDirectory /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/employees/new"
              element={
                <ProtectedRoute routeKey="staff-management">
                  <MainLayout><StaffProfilePage /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/employees/:staffId"
              element={
                <ProtectedRoute routeKey="staff-management">
                  <MainLayout><StaffProfilePage /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/departments"
              element={
                <ProtectedRoute routeKey="departments">
                  <MainLayout><StaffDepartments /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/designations"
              element={
                <ProtectedRoute routeKey="designations">
                  <MainLayout><StaffDesignations /></MainLayout>
                </ProtectedRoute>
              }
            />

            {/* ── Staff Attendance (Phase 2) ─────────────────────────────── */}
            <Route path="/staff/attendance"          element={<ProtectedRoute routeKey="staff-attendance"><MainLayout><AttendanceDashboard /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/attendance/today"    element={<ProtectedRoute routeKey="staff-attendance"><MainLayout><AttendanceToday /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/attendance/calendar" element={<ProtectedRoute routeKey="staff-attendance"><MainLayout><AttendanceCalendar /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/attendance/history"  element={<ProtectedRoute routeKey="staff-attendance"><MainLayout><AttendanceHistory /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/attendance/reports"  element={<ProtectedRoute routeKey="staff-attendance"><MainLayout><AttendanceReports /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/shifts"              element={<ProtectedRoute routeKey="staff-shifts"><MainLayout><StaffShifts /></MainLayout></ProtectedRoute>} />

            {/* ── Leave Management (Phase 3) ───────────────────────────── */}
            <Route path="/staff/leave"             element={<ProtectedRoute routeKey="staff-leave"><MainLayout><LeaveDashboard /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/leave/types"       element={<ProtectedRoute routeKey="staff-leave-types"><MainLayout><LeaveTypes /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/leave/apply"       element={<ProtectedRoute routeKey="staff-leave"><MainLayout><LeaveApply /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/leave/approvals"   element={<ProtectedRoute routeKey="staff-leave"><MainLayout><LeaveApprovals /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/leave/calendar"    element={<ProtectedRoute routeKey="staff-leave"><MainLayout><LeaveCalendarPage /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/leave/reports"     element={<ProtectedRoute routeKey="staff-leave"><MainLayout><LeaveReports /></MainLayout></ProtectedRoute>} />

            {/* ── Payroll (Phase 4) ─────────────────────────────────────── */}
            <Route path="/staff/payroll"            element={<ProtectedRoute routeKey="staff-payroll"><MainLayout><PayrollDashboard /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/payroll/components" element={<ProtectedRoute routeKey="staff-payroll-process"><MainLayout><SalaryComponents /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/payroll/structures" element={<ProtectedRoute routeKey="staff-payroll-process"><MainLayout><SalaryStructures /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/payroll/staff"      element={<ProtectedRoute routeKey="staff-payroll-process"><MainLayout><StaffSalaryPage /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/payroll/run"        element={<ProtectedRoute routeKey="staff-payroll-process"><MainLayout><PayrollRun /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/payroll/history"    element={<ProtectedRoute routeKey="staff-payroll"><MainLayout><PayrollHistory /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/payroll/bank"       element={<ProtectedRoute routeKey="staff-payroll"><MainLayout><BankReport /></MainLayout></ProtectedRoute>} />

            {/* ── Performance Management (Phase 5) ─────────────────────── */}
            <Route path="/staff/performance"          element={<ProtectedRoute routeKey="staff-performance"><MainLayout><PerformanceDashboard /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/performance/kpis"     element={<ProtectedRoute routeKey="staff-performance-manage"><MainLayout><PerformanceKpis /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/performance/reviews"  element={<ProtectedRoute routeKey="staff-performance"><MainLayout><PerformanceReviews /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/performance/goals"    element={<ProtectedRoute routeKey="staff-performance"><MainLayout><PerformanceGoals /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/performance/feedback" element={<ProtectedRoute routeKey="staff-performance"><MainLayout><ParentFeedback /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/performance/awards"   element={<ProtectedRoute routeKey="staff-performance"><MainLayout><AwardsPromotions /></MainLayout></ProtectedRoute>} />
            <Route path="/staff/performance/timeline" element={<ProtectedRoute routeKey="staff-performance"><MainLayout><PerformanceTimelinePage /></MainLayout></ProtectedRoute>} />

            {/* ── Super Admin ───────────────────────────────────────────────── */}
            <Route
              path="/super-admin/tenants"
              element={
                <ProtectedRoute routeKey="tenant-management">
                  <MainLayout><TenantList /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/tenants/new"
              element={
                <ProtectedRoute routeKey="tenant-management">
                  <MainLayout><TenantCreate /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/tenants/:tenantId"
              element={
                <ProtectedRoute routeKey="tenant-management">
                  <MainLayout><TenantDetail /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/analytics"
              element={
                <ProtectedRoute routeKey="tenant-management">
                  <MainLayout><PlatformAnalytics /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/audit"
              element={
                <ProtectedRoute routeKey="tenant-management">
                  <MainLayout><AuditLogs /></MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Public impersonation landing — exchanges custom token */}
            <Route path="/impersonate" element={<ImpersonateLogin />} />

          </Routes>
        </Suspense>
       </InstallProvider>
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
// Parents → /parent-home  |  Staff → /staff-mobile  |  Super Admin → platform analytics
function RootRedirect() {
  const { role, isAuthenticated, loading } = useAuth();
  if (loading) return null; // splash handles the loading UI
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === "parent") return <Navigate to="/parent-home" replace />;
  // Item 6 of the approved staff-review priority list (S1, 2026-07-30): a
  // Super Admin's job is platform health across every tenant school, not one
  // school's day-to-day operations — landing them on the single-school
  // Control Center buried their actual tools (Preschools, Platform
  // Analytics, Audit Logs) at the bottom of an unrelated 13-group sidebar.
  // Platform Analytics already existed as a real, working platform-level
  // overview (total schools, plan/status breakdown, recent preschools) — no
  // new page needed, just pointing the front door at it.
  //
  // `role` is the *effective* role (devRole-aware, see AuthContext), so a
  // Super Admin using the Role Switcher to preview as another role still
  // lands on that role's normal experience for testing, exactly as before.
  if (role === "super_admin") return <Navigate to="/super-admin/analytics" replace />;
  // Staff Home plan (2026-07-31): Staff Home is now THE landing page for
  // every Staff login, desktop included — same as Parent Home is the one
  // landing page for every Parent login regardless of window size.
  // Explicit user decision, confirmed after live-comparing Parent Home
  // (which has no viewport gating at all) against the previous
  // mobile-viewport-only redirect here. Control Center (/quick-navigation)
  // remains fully intact and reachable via its own sidebar link — this
  // only changes what a fresh login lands on.
  return <Navigate to="/staff-mobile" replace />;
}

// ── Viewport-aware Attendance / Care & Hygiene routes ──────────────────────
// Staff Home Phase 2 (2026-08-05): first mobile-native destination screens.
// At mobile widths, render the Staff-mobile-owned screen; otherwise render
// the existing desktop page (MainLayout + all its current views) completely
// unchanged. Same useIsMobile() hook the Phase 1 mobile-only RootRedirect
// gate used before the universal-landing decision removed that use.
function AttendanceRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileAttendance /> : <MainLayout><Attendance /></MainLayout>;
}
function CareHygieneRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileCareHygiene /> : <CareHygiene />;
}
