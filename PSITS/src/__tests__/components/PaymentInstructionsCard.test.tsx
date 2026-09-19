import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentInstructionsCard } from '@/shared/components/PaymentInstructionsCard';

describe('PaymentInstructionsCard Component', () => {
  it('renders GCash instructions correctly', () => {
    const mockSettings = {
      gcash_qr_code: 'https://example.com/gcash-qr.png'
    };

    render(<PaymentInstructionsCard method="gcash" settings={mockSettings} />);

    expect(screen.getByText(/scan & pay via gcash/i)).toBeInTheDocument();
    expect(screen.getByAltText(/gcash qr code/i)).toBeInTheDocument();
  });

  it('renders PayMaya instructions correctly', () => {
    const mockSettings = {
      paymaya_qr_code: 'https://example.com/paymaya-qr.png'
    };

    render(<PaymentInstructionsCard method="paymaya" settings={mockSettings} />);

    expect(screen.getByText(/scan & pay via paymaya \/ maya/i)).toBeInTheDocument();
    expect(screen.getByAltText(/paymaya \/ maya qr code/i)).toBeInTheDocument();
  });

  it('renders Bank Transfer details correctly', () => {
    const mockSettings = {
      bank_transfer_details: 'BDO Account: 1234-5678-9012\nAccount Name: PSITS Region XII'
    };

    render(<PaymentInstructionsCard method="bank_transfer" settings={mockSettings} />);

    expect(screen.getByText(/bank transfer payment/i)).toBeInTheDocument();
    expect(screen.getByText(/1234-5678-9012/i)).toBeInTheDocument();
  });

  it('renders nothing if method is empty', () => {
    const { container } = render(<PaymentInstructionsCard method="" />);
    expect(container.firstChild).toBeNull();
  });
});
