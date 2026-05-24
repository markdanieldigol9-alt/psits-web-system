import { Navigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { LoadingSpinner } from '@/shared/components/Common';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  allowExpired?: boolean;
}

export const ProtectedRoute = ({
  children,
  requiredRoles = [],
  allowExpired = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && user && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Lockout logic for expired members
  if (user?.role === 'member' && !allowExpired) {
    const expiresAt = user.membershipExpiresAt ? new Date(user.membershipExpiresAt) : null;
    if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      // Membership is expired and this route does not allow expired members.
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
