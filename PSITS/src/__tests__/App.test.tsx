import { render, screen } from '@testing-library/react';
import App from '@/app/App';
import { vi, test, expect } from 'vitest';

vi.mock('@/features/landing/pages/LandingPage', () => ({
  LandingPage: () => <div>Landing Page</div>,
}));

test('renders landing route by default', async () => {
  window.history.pushState({}, 'Test', '/');
  render(<App />);
  const landingText = await screen.findByText(/landing page/i);
  expect(landingText).toBeInTheDocument();
});
