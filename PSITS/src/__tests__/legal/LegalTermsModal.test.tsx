import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LegalTermsModal } from '@/features/legal/components/LegalTermsModal';

describe('LegalTermsModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <LegalTermsModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders terms and conditions by default', () => {
    render(<LegalTermsModal isOpen={true} onClose={vi.fn()} defaultTab="terms" />);
    expect(screen.getByText('Terms & Conditions of Service')).toBeInTheDocument();
    expect(screen.getByText(/Acceptance of Terms/i)).toBeInTheDocument();
  });

  it('switches between Terms and Privacy Policy tabs', () => {
    render(<LegalTermsModal isOpen={true} onClose={vi.fn()} defaultTab="terms" />);
    
    // Switch to privacy policy tab
    const privacyTabBtn = screen.getByRole('button', { name: /Privacy Policy/i });
    fireEvent.click(privacyTabBtn);

    expect(screen.getByText('Data Privacy Policy & Protection')).toBeInTheDocument();
    expect(screen.getByText(/Institutional Commitment & Legal Framework/i)).toBeInTheDocument();
  });

  it('filters clauses when typing into the search input', () => {
    render(<LegalTermsModal isOpen={true} onClose={vi.fn()} defaultTab="privacy" />);
    
    const searchInput = screen.getByPlaceholderText(/Search clauses or topics/i);
    fireEvent.change(searchInput, { target: { value: 'DPO' } });

    expect(screen.getAllByText(/Data Protection Officer/i).length).toBeGreaterThanOrEqual(1);
  });



  it('calls onAccept and onClose when accepting terms', () => {
    const onAcceptMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <LegalTermsModal
        isOpen={true}
        onClose={onCloseMock}
        defaultTab="terms"
        showAcceptButton={true}
        onAccept={onAcceptMock}
      />
    );

    const acceptBtn = screen.getByRole('button', { name: /I Read & Agree to Terms/i });
    fireEvent.click(acceptBtn);

    expect(onAcceptMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
