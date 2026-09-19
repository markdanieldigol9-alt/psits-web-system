import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { AuthProvider } from '@/shared/context/AuthContext';

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginPage Component', () => {
  it('renders login form with email and password inputs and buttons', () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot password\?/i)).toBeInTheDocument();
  });

  it('displays validation errors when submitting empty form', () => {
    renderLoginPage();

    const form = screen.getByPlaceholderText(/enter your email/i).closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it('validates invalid email format', () => {
    renderLoginPage();

    const emailInput = screen.getByPlaceholderText(/enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/enter your password/i);
    const form = emailInput.closest('form')!;

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.submit(form);

    expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    renderLoginPage();

    const passwordInput = screen.getByPlaceholderText(/enter your password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleVisibilityBtn = screen.getByLabelText(/show password/i);
    if (toggleVisibilityBtn) {
      fireEvent.click(toggleVisibilityBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });
});
