import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  hideCloseButton?: boolean;
}

export const Modal = ({ isOpen, onClose, title, children, size = 'md', hideCloseButton = false }: ModalProps) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-lg',
    md: 'max-w-2xl',
    lg: 'max-w-3xl',
  };

  const overlayRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    overlayRef.current?.focus();
    return () => prev?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={overlayRef}
      onMouseDown={(e) => {
        // Close when clicking the backdrop (not inside the panel)
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      tabIndex={-1}
    >
      <div className="min-h-[100dvh] flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div
          className={`bg-white rounded-lg shadow-lg ${sizeClasses[size]} w-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={24} />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
}

export const Alert = ({ type, message, onClose }: AlertProps) => {
  const typeClasses = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div className={`border rounded-lg p-4 flex items-center justify-between ${typeClasses[type]}`}>
      <p className="font-medium">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close alert"
          className="p-1 hover:opacity-70"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner = ({ size = 'md' }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`animate-spin border-4 border-primary border-t-transparent rounded-full ${sizeClasses[size]}`} />
    </div>
  );
};

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => {
  const pages: number[] = [];
  const maxVisible = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>

      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="px-3 py-2 hover:bg-gray-100 rounded"
          >
            1
          </button>
          {startPage > 2 && <span className="px-2">...</span>}
        </>
      )}

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-2 rounded ${
            page === currentPage
              ? 'bg-primary text-white'
              : 'hover:bg-gray-100'
          }`}
        >
          {page}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-2">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="px-3 py-2 hover:bg-gray-100 rounded"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
};

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

export const Badge = ({ children, variant = 'primary', className = '' }: BadgeProps) => {
  const variantClasses = {
    primary: 'bg-blue-100 text-primary',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

type StatusBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const statusToneClasses: Record<StatusBadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200',
  success: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  warning: 'bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-200',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
  brand: 'bg-blue-50 text-primary ring-1 ring-inset ring-blue-200',
};

function normalizeStatus(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function getStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    // Member / registration / general
    case 'pending':
      return 'warning';
    case 'approved':
    case 'active':
    case 'verified':
      return 'success';
    case 'rejected':
    case 'inactive':
      return 'danger';
    case 'suspended':
      return 'warning';
    case 'banned':
      return 'danger';

    // Events
    case 'ongoing':
    case 'registration_open':
      return 'info';
    case 'registration_closed':
    case 'completed':
      return 'neutral';
    case 'draft':
      return 'brand';
    case 'published':
      return 'brand';
    case 'cancelled':
      return 'danger';

    // Live sessions
    case 'scheduled':
      return 'brand';
    case 'live':
      return 'info';
    case 'ended':
      return 'neutral';

    default:
      return 'neutral';
  }
}

function formatStatusLabel(status: string) {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export const StatusBadge = ({ status, label, className = '' }: StatusBadgeProps) => {
  const normalized = normalizeStatus(status);
  const tone = getStatusTone(normalized);
  const isBanned = normalized === 'banned';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        statusToneClasses[tone],
        isBanned ? 'bg-gray-900 text-gray-100 ring-gray-800' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label || formatStatusLabel(normalized)}
    </span>
  );
};

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, action }: EmptyStateProps) => {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
      <p className="text-base font-semibold text-gray-900">{title}</p>
      {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
};
