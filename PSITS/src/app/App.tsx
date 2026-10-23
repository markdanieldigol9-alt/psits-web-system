import {
  BrowserRouter as Router,
  Routes,
  Route,
} from 'react-router-dom';
import { Suspense } from 'react';
import { AuthProvider } from '@/shared/context/AuthContext';
import { NotificationProvider } from '@/shared/context/NotificationContext';
import { ThemeProvider } from '@/shared/context/ThemeContext';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { LoadingSpinner } from '@/shared/components/Common';
import { Toasts } from '@/shared/components/Toasts';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

const LoginPage = lazyWithRetry(() => import('@/features/auth/pages/LoginPage'), 'LoginPage');
const RegisterPage = lazyWithRetry(() => import('@/features/auth/pages/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = lazyWithRetry(() => import('@/features/auth/pages/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyWithRetry(() => import('@/features/auth/pages/ResetPasswordPage'), 'ResetPasswordPage');
const DashboardPage = lazyWithRetry(() => import('@/features/dashboard/pages/DashboardPage'), 'DashboardPage');
const NotFoundPage = lazyWithRetry(() => import('@/features/misc/pages/NotFoundPage'), 'NotFoundPage');
const UnauthorizedPage = lazyWithRetry(() => import('@/features/misc/pages/UnauthorizedPage'), 'UnauthorizedPage');
const MembersPage = lazyWithRetry(() => import('@/features/members/pages/MembersPage'), 'MembersPage');
const EventsPage = lazyWithRetry(() => import('@/features/events/pages/EventsPage'), 'EventsPage');
const PaymentsPage = lazyWithRetry(() => import('@/features/payments/pages/PaymentsPage'), 'PaymentsPage');
const AnnouncementsPage = lazyWithRetry(() => import('@/features/announcements/pages/AnnouncementsPage'), 'AnnouncementsPage');
const OfficersPage = lazyWithRetry(() => import('@/features/officers/pages/OfficersPage'), 'OfficersPage');
const ReportsPage = lazyWithRetry(() => import('@/features/reports/pages/ReportsPage'), 'ReportsPage');
const NotificationsPage = lazyWithRetry(() => import('@/features/notifications/pages/NotificationsPage'), 'NotificationsPage');
const SettingsPage = lazyWithRetry(() => import('@/features/settings/pages/SettingsPage'), 'SettingsPage');
const PartnersPage = lazyWithRetry(() => import('@/features/partners/pages/PartnersPage'), 'PartnersPage');
const LiveEventsPage = lazyWithRetry(() => import('@/features/live-events/pages/LiveEventsPage'), 'LiveEventsPage');
const MyEventsPage = lazyWithRetry(() => import('@/features/my-events/pages/MyEventsPage'), 'MyEventsPage');
const InstitutionMembersPage = lazyWithRetry(() => import('@/features/institution-members/pages/InstitutionMembersPage'), 'InstitutionMembersPage');
const ElectionsPage = lazyWithRetry(() => import('@/features/elections/pages/ElectionsPage'), 'ElectionsPage');
const ForumPage = lazyWithRetry(() => import('@/features/forum/pages/ForumPage'), 'ForumPage');
const LandingPage = lazyWithRetry(() => import('@/features/landing/pages/LandingPage'), 'LandingPage');
const PrivacyPolicyPage = lazyWithRetry(() => import('@/features/legal/pages/PrivacyPolicyPage'), 'PrivacyPolicyPage');
const TermsPage = lazyWithRetry(() => import('@/features/legal/pages/TermsPage'), 'TermsPage');


export const App = () => {
  return (
    <Router>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <Suspense
                fallback={
                  <div className="h-screen flex items-center justify-center">
                    <LoadingSpinner size="lg" />
                  </div>
                }
              >
                <Toasts />
                <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />


              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowExpired={true}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Members Module */}
              <Route
                path="/members"
                element={
                  <ProtectedRoute requiredRoles={['super_admin', 'admin', 'officer']}>
                    <MembersPage />
                  </ProtectedRoute>
                }
              />

              {/* Events Module */}
              <Route
                path="/events"
                element={
                  <ProtectedRoute>
                    <EventsPage />
                  </ProtectedRoute>
                }
              />

              {/* Payments Module */}
              <Route
                path="/payments"
                element={
                  <ProtectedRoute allowExpired={true}>
                    <PaymentsPage />
                  </ProtectedRoute>
                }
              />

              {/* Announcements Module */}
              <Route
                path="/announcements"
                element={
                  <ProtectedRoute>
                    <AnnouncementsPage />
                  </ProtectedRoute>
                }
              />

              {/* Officers Module */}
              <Route
                path="/officers"
                element={
                  <ProtectedRoute requiredRoles={['super_admin', 'admin', 'officer', 'member']}>
                    <OfficersPage />
                  </ProtectedRoute>
                }
              />

              {/* Officer Elections */}
              <Route
                path="/elections"
                element={
                  <ProtectedRoute>
                    <ElectionsPage />
                  </ProtectedRoute>
                }
              />

              {/* Community Forum */}
              <Route
                path="/forum"
                element={
                  <ProtectedRoute>
                    <ForumPage />
                  </ProtectedRoute>
                }
              />

              {/* Fully implemented modules */}
              <Route
                path="/reports"
                element={
                  <ProtectedRoute requiredRoles={['super_admin', 'admin', 'officer']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowExpired={true}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/profile"
                element={
                  <ProtectedRoute allowExpired={true}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/partners"
                element={
                  <ProtectedRoute>
                    <PartnersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/stream-events"
                element={
                  <ProtectedRoute>
                    <LiveEventsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/live-events"
                element={
                  <ProtectedRoute>
                    <LiveEventsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-events"
                element={
                  <ProtectedRoute>
                    <MyEventsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/institution-members"
                element={
                  <ProtectedRoute requiredRoles={['super_admin', 'admin', 'officer', 'member']}>
                    <InstitutionMembersPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch all */}
              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
              </Suspense>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </Router>
  );
};

export default App;
