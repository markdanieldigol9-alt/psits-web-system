import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

// ─── Modal ────────────────────────────────────────────────────
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  hideCloseButton?: boolean;
  accentColor?: string;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  hideCloseButton = false,
}: ModalProps) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    overlayRef.current?.focus();
    return () => prev?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-lg',
    md: 'max-w-2xl',
    lg: 'max-w-3xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/55 dark:bg-black/70 backdrop-blur-[2px] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={overlayRef}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={-1}
    >
      <div className="min-h-[100dvh] flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div
          className={`bg-white dark:bg-slate-900 rounded-[20px] shadow-modal ${sizeClasses[size]} w-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col overflow-hidden border border-gray-100 dark:border-slate-800 animate-pop-in text-gray-900 dark:text-slate-100`}
        >
          {/* Header with top accent line */}
          <div className="relative flex items-start justify-between p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
            {/* Blue top accent bar */}
            <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400 rounded-b-full" />

            <div className="mt-1 flex-1 min-w-0 pr-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{subtitle}</p>
              )}
            </div>

            {!hideCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="shrink-0 p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors mt-0.5"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
};

// ─── Alert ────────────────────────────────────────────────────
interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  className?: string;
  truncate?: boolean;
}

export const Alert = ({ type, message, onClose, className = '', truncate = false }: AlertProps) => {
  const typeConfig = {
    success: {
      bg: 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200',
      icon: <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
    },
    error: {
      bg: 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200',
      icon: <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
    },
    warning: {
      bg: 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200',
      icon: <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
    },
    info: {
      bg: 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200',
      icon: <Info size={16} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />,
    },
  };

  const config = typeConfig[type] || typeConfig.info;

  return (
    <div className={`border rounded-xl p-3.5 flex items-start justify-between gap-3 text-sm animate-fade-in shadow-xs ${config.bg} ${className}`}>
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {config.icon}
        <p className={`flex-1 break-words leading-relaxed font-medium ${truncate ? 'truncate' : ''}`}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close alert"
          className="p-1 text-current opacity-50 hover:opacity-100 rounded transition-opacity shrink-0"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

// ─── LoadingSpinner ───────────────────────────────────────────
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
  label?: string;
}

export const LoadingSpinner = ({ size = 'md', fullPage = false, label }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-[3px]',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`animate-spin border-blue-600 dark:border-blue-400 border-t-transparent rounded-full ${sizeClasses[size]}`}
      />
      {label && <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{label}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return <div className="flex items-center justify-center p-6">{spinner}</div>;
};

// ─── Pagination ───────────────────────────────────────────────
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
    <div className="flex items-center justify-center gap-1 mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>

      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            1
          </button>
          {startPage > 2 && <span className="px-1 text-gray-400 dark:text-slate-600 text-xs">···</span>}
        </>
      )}

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            page === currentPage
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
              : 'text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          {page}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-1 text-gray-400 dark:text-slate-600 text-xs">···</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  );
};

// ─── Badge (Common) ───────────────────────────────────────────
interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

export const Badge = ({ children, variant = 'primary', className = '' }: BadgeProps) => {
  const variantClasses = {
    primary: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70',
    success: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70',
    warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/70',
    error: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/70',
    info: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/70',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        variantClasses[variant] || variantClasses.primary
      } ${className}`}
    >
      {children}
    </span>
  );
};

// ─── StatusBadge ──────────────────────────────────────────────
type StatusBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const statusToneClasses: Record<StatusBadgeTone, string> = {
  neutral: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700',
  success: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70',
  warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/70',
  danger: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/70',
  info: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/70',
  brand: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70',
};

function normalizeStatus(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function getStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    case 'pending': return 'warning';
    case 'approved': case 'active': case 'verified': return 'success';
    case 'rejected': case 'inactive': return 'danger';
    case 'suspended': return 'warning';
    case 'banned': return 'danger';
    case 'ongoing': case 'registration_open': return 'info';
    case 'registration_closed': case 'completed': return 'neutral';
    case 'draft': case 'published': return 'brand';
    case 'cancelled': return 'danger';
    case 'scheduled': return 'brand';
    case 'live': return 'info';
    case 'ended': return 'neutral';
    default: return 'neutral';
  }
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
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
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide',
        statusToneClasses[tone],
        isBanned ? 'bg-gray-900 text-gray-100 border-gray-800 dark:bg-gray-950 dark:text-gray-200' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label || formatStatusLabel(normalized)}
    </span>
  );
};

// ─── EmptyState ───────────────────────────────────────────────
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export const EmptyState = ({ title, description, action, icon }: EmptyStateProps) => {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-10 sm:p-14 text-center">
      {icon && (
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 flex items-center justify-center text-gray-400 dark:text-slate-500 shadow-xs">
          {icon}
        </div>
      )}
      <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-gray-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
};
