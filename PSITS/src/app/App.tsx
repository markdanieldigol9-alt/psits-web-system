import {
  BrowserRouter as Router,
  Routes,
  Route,
} from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from '@/shared/context/AuthContext';
import { NotificationProvider } from '@/shared/context/NotificationContext';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { LoadingSpinner } from '@/shared/components/Common';
import { Toasts } from '@/shared/components/Toasts';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import('@/features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const NotFoundPage = lazy(() =>
  import('@/features/misc/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);
const UnauthorizedPage = lazy(() =>
  import('@/features/misc/pages/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage }))
);
const MembersPage = lazy(() =>
  import('@/features/members/pages/MembersPage').then((m) => ({ default: m.MembersPage }))
);
const EventsPage = lazy(() =>
  import('@/features/events/pages/EventsPage').then((m) => ({ default: m.EventsPage }))
);
const PaymentsPage = lazy(() =>
  import('@/features/payments/pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage }))
);
const AnnouncementsPage = lazy(() =>
  import('@/features/announcements/pages/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage }))
);
const OfficersPage = lazy(() =>
  import('@/features/officers/pages/OfficersPage').then((m) => ({ default: m.OfficersPage }))
);
const ReportsPage = lazy(() =>
  import('@/features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const SettingsPage = lazy(() =>
  import('@/features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const PartnersPage = lazy(() =>
  import('@/features/partners/pages/PartnersPage').then((m) => ({ default: m.PartnersPage }))
);
const LiveEventsPage = lazy(() =>
  import('@/features/live-events/pages/LiveEventsPage').then((m) => ({ default: m.LiveEventsPage }))
);
const LiveStudioPage = lazy(() =>
  import('@/features/live-events/pages/LiveStudioPage').then((m) => ({ default: m.LiveStudioPage }))
);
const MyEventsPage = lazy(() =>
  import('@/features/my-events/pages/MyEventsPage').then((m) => ({ default: m.MyEventsPage }))
);
const InstitutionMembersPage = lazy(() =>
  import('@/features/institution-members/pages/InstitutionMembersPage').then((m) => ({ default: m.InstitutionMembersPage }))
);
const ElectionsPage = lazy(() =>
  import('@/features/elections/pages/ElectionsPage').then((m) => ({ default: m.ElectionsPage }))
);
const ForumPage = lazy(() =>
  import('@/features/forum/pages/ForumPage').then((m) => ({ default: m.ForumPage }))
);
const LandingPage = lazy(() =>
  import('@/features/landing/pages/LandingPage').then((m) => ({ default: m.LandingPage }))
);

export const App = () => {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
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
                  <ProtectedRoute requiredRoles={['super_admin', 'admin', 'officer', 'member']}>
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
                path="/live-events"
                element={
                  <ProtectedRoute>
                    <LiveEventsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/live-events/studio/:sessionId"
                element={
                  <ProtectedRoute>
                    <LiveStudioPage />
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
    </Router>
  );
};

export default App;
