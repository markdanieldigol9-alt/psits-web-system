import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, AuthState, UserRole } from '@/shared/types';
import type { ReactNode } from 'react';
import { initializeSystem } from '@/shared/utils/seedAdmin';
import api from '@/shared/services/api';

const getApiErrorMessage = (err: unknown, fallback: string) => {
  const anyErr = err as any;
  const apiMessage = anyErr?.response?.data?.message;
  const status = anyErr?.response?.status;
  const rawData = anyErr?.response?.data;
  const rawText =
    typeof rawData === 'string'
      ? rawData
      : rawData && typeof rawData === 'object'
        ? rawData.message || JSON.stringify(rawData)
        : '';
  const message = apiMessage || anyErr?.message || rawText || fallback;
  if (message === 'Network Error') {
    return 'Cannot reach the API. Start both servers from the repo root with: npm run dev (API on http://localhost:3000), or from the PSITS folder run: npm run dev:full. If you opened the site via a LAN IP/IPv6, allow that origin via CORS_ORIGIN or use http://localhost:5173.';
  }
  if (status === 503) {
    return apiMessage || 'API is up, but the database is unavailable. Start MySQL and set DB_HOST/DB_USER/DB_PASSWORD/DB_NAME, then restart the API.';
  }
  if (status === 500 && !apiMessage) {
    return 'API server not ready. Start both servers from the repo root with: npm run dev (API on http://localhost:3000), or from the PSITS folder run: npm run dev:full.';
  }
  if (status) return `${message} (status ${status})`;
  return message;
};

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterPayload) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

import type { RegisterData } from '@/shared/types';
export type RegisterPayload = RegisterData;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    initializeSystem();

    const savedToken = localStorage.getItem('auth_token');

    // Modern auth UX: if a token exists, verify it with the server and refresh user data.
    // This prevents "phantom logins" when the token/session has expired server-side.
    if (!savedToken) return;

    setAuthState((prev) => ({ ...prev, isLoading: true }));

    (async () => {
      try {
        const { data } = await api.getMe();
        if (!data?.success || !data?.user) throw new Error('Session expired');

        const refreshedUser: User = {
          id: String(data.user.id),
          email: data.user.email,
          username: data.user.username,
          fullName: data.user.fullName,
          role: data.user.role as UserRole,
          contactNumber: data.user.contactNumber,
          sector: data.user.sector,
          sectorDetails: data.user.sectorDetails,
          memberType: data.user.memberType,
          membershipStartedAt: data.user.membershipStartedAt ?? null,
          membershipExpiresAt: data.user.membershipExpiresAt ?? null,
          status: data.user.status ?? null,
          isActive: data.user.isActive,
          createdAt: new Date(data.user.createdAt ?? Date.now()),
          updatedAt: new Date(data.user.updatedAt ?? Date.now()),
        };

        setAuthState({
          user: refreshedUser,
          token: savedToken,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        localStorage.setItem('user', JSON.stringify(refreshedUser));
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setAuthState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const { data } = await api.login(email, password);
      if (!data?.success) throw new Error(data?.message || 'Login failed');

      const loggedInUser: User = {
        id: String(data.user.id),
        email: data.user.email,
        username: data.user.username,
        fullName: data.user.fullName,
        role: data.user.role as UserRole,
        contactNumber: data.user.contactNumber,
        sector: data.user.sector,
        sectorDetails: data.user.sectorDetails,
        memberType: data.user.memberType,
        membershipStartedAt: data.user.membershipStartedAt ?? null,
        membershipExpiresAt: data.user.membershipExpiresAt ?? null,
        status: data.user.status ?? null,
        isActive: data.user.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setAuthState({
        user: loggedInUser,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
    } catch (err) {
      const message = getApiErrorMessage(err, 'Login failed');
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      throw new Error(message);
    }
  }, []);

  const register = useCallback(async (userData: RegisterPayload) => {
    setAuthState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const { data } = await api.register(userData);
      if (!data?.success) throw new Error(data?.message || 'Registration failed');

      const newUser: User = {
        id: String(data.user?.id ?? Date.now()),
        email: userData.email,
        username: userData.username,
        fullName: userData.fullName,
        role: 'member' as UserRole,
        contactNumber: userData.contactNumber,
        sector: userData.sector,
        sectorDetails: userData.sectorDetails,
        memberType: userData.memberType,
        membershipStartedAt: data.user?.membershipStartedAt ?? null,
        membershipExpiresAt: data.user?.membershipExpiresAt ?? null,
        status: data.user?.status ?? 'pending',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setAuthState({
        user: newUser,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = getApiErrorMessage(err, 'Registration failed');
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }, []);

  const updateUser = useCallback((user: User) => {
    setAuthState((prev) => ({
      ...prev,
      user,
    }));
    localStorage.setItem('user', JSON.stringify(user));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...authState, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

