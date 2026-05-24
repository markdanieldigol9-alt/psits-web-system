import { render, screen } from '@testing-library/react';
import App from '@/app/App';
import { vi, test, expect } from 'vitest';

vi.mock('@/features/auth/pages/LoginPage', () => ({
  LoginPage: () => <div>Login</div>,
}));

test('renders login route by default', async () => {
  render(<App />);
  const loginText = await screen.findByText(/login/i);
  expect(loginText).toBeInTheDocument();
});
