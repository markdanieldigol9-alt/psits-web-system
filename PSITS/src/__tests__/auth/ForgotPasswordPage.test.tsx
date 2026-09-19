import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import api from '@/shared/services/api';

const renderForgotPasswordPage = () => {
  return render(
    <BrowserRouter>
      <ForgotPasswordPage />
    </BrowserRouter>
  );
};

describe('ForgotPasswordPage Component', () => {
  it('renders email input and submit button', () => {
    renderForgotPasswordPage();

    expect(screen.getByPlaceholderText(/yourname@gmail\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByText(/back to login/i)).toBeInTheDocument();
  });

  it('displays error when submitting invalid email format', async () => {
    renderForgotPasswordPage();

    const emailInput = screen.getByPlaceholderText(/yourname@gmail\.com/i);
    const form = emailInput.closest('form')!;

    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('shows success message after successful submission', async () => {
    vi.spyOn(api, 'forgotPassword').mockResolvedValueOnce({
      data: { success: true, message: 'Reset link sent.' }
    } as any);

    renderForgotPasswordPage();

    const emailInput = screen.getByPlaceholderText(/yourname@gmail\.com/i);
    const form = emailInput.closest('form')!;

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
      expect(screen.getByText(/user@example\.com/i)).toBeInTheDocument();
    });
  });
});
