import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { LoadingSpinner } from '@/shared/components/Common';
import { canOfficerAccessPath } from '@/shared/utils/officerPermissions';

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
  const location = useLocation();
  const [currentTime] = useState(() => Date.now());

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

  // Position-based module access control for officers
  if (user?.role === 'officer' && !canOfficerAccessPath(user?.position, location.pathname)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Lockout logic for suspended accounts (strictly allow Settings module only)
  if (user?.status === 'suspended') {
    if (!location.pathname.startsWith('/settings')) {
      return <Navigate to="/settings" replace />;
    }
  }

  // Lockout logic for expired members
  if (user?.role === 'member' && !allowExpired) {
    const expiresAt = user.membershipExpiresAt ? new Date(user.membershipExpiresAt) : null;
    if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < currentTime) {
      // Membership is expired and this route does not allow expired members.
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

