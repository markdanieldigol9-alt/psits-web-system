import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import * as AuthContext from '@/shared/context/AuthContext';

describe('ProtectedRoute Component', () => {
  it('redirects unauthenticated users to /login', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Screen</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Protected Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected Dashboard')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', role: 'admin', email: 'admin@example.com', status: 'active' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Protected Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
  });

  it('redirects to /unauthorized when user lacks required role', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { id: '2', role: 'member', email: 'member@example.com', status: 'active' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/members']}>
        <Routes>
          <Route path="/unauthorized" element={<div>Unauthorized Access</div>} />
          <Route
            path="/members"
            element={
              <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
                <div>Admin Members Area</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Unauthorized Access')).toBeInTheDocument();
    expect(screen.queryByText('Admin Members Area')).not.toBeInTheDocument();
  });
});
