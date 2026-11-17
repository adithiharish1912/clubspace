import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute, { GuestRoute } from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import { PageLoader } from './components/ui';
import { InstallBanner } from './components/InstallApp';

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Members = lazy(() => import('./pages/members/Members'));
const MemberDetail = lazy(() => import('./pages/members/MemberDetail'));
const Plans = lazy(() => import('./pages/plans/Plans'));
const Coupons = lazy(() => import('./pages/coupons/Coupons'));
const Payments = lazy(() => import('./pages/payments/Payments'));
const Attendance = lazy(() => import('./pages/attendance/Attendance'));
const Events = lazy(() => import('./pages/events/Events'));
const EventDetail = lazy(() => import('./pages/events/EventDetail'));
const Notifications = lazy(() => import('./pages/notifications/Notifications'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const Users = lazy(() => import('./pages/users/Users'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const MyMembership = lazy(() => import('./pages/my/MyMembership'));
const MyPayments = lazy(() => import('./pages/my/MyPayments'));
const MyAttendance = lazy(() => import('./pages/my/MyAttendance'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />

            <Route element={<ProtectedRoute roles={['admin', 'staff']} />}>
              <Route path="/members" element={<Members />} />
              <Route path="/members/:id" element={<MemberDetail />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/attendance" element={<Attendance />} />
            </Route>
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="/plans" element={<Plans />} />
              <Route path="/coupons" element={<Coupons />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/users" element={<Users />} />
            </Route>
            <Route element={<ProtectedRoute roles={['superadmin']} />}>
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route element={<ProtectedRoute roles={['member']} />}>
              <Route path="/my/membership" element={<MyMembership />} />
              <Route path="/my/payments" element={<MyPayments />} />
              <Route path="/my/attendance" element={<MyAttendance />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
    <InstallBanner />
    </>
  );
}
