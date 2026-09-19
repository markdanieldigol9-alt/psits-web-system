import type { ReactNode, ButtonHTMLAttributes } from 'react';

// ─── Button ──────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost' | 'gradient';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled = false,
  leftIcon,
  rightIcon,
  ...props
}: ButtonProps) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1';

  const variantClasses = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0',
    secondary:
      'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 active:bg-gray-300 hover:-translate-y-[1px] active:translate-y-0',
    danger:
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0',
    outline:
      'border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 shadow-xs hover:-translate-y-[1px] active:translate-y-0',
    ghost:
      'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100 active:bg-gray-200 dark:active:bg-slate-700',
    gradient:
      'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-[0_4px_14px_rgb(37,99,235,0.35)] hover:-translate-y-[1px] active:translate-y-0',
  };

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-[11px] font-semibold rounded-lg',
    sm: 'px-3.5 py-1.5 text-xs font-semibold',
    md: 'px-4 py-2.5 text-sm font-semibold',
    lg: 'px-6 py-3 text-base font-bold',
  };

  const spinnerSize = { xs: 'h-3 w-3', sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <span className={`animate-spin border-2 border-current border-t-transparent rounded-full ${spinnerSize[size]}`} />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};

// ─── Input ───────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
}

export const Input = ({
  label,
  error,
  helperText,
  prefixIcon,
  suffixIcon,
  className = '',
  required,
  ...props
}: InputProps) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {prefixIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none">
            {prefixIcon}
          </div>
        )}
        <input
          required={required}
          className={`w-full py-2.5 bg-white dark:bg-slate-900 border rounded-[10px] text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 hover:border-gray-300 dark:hover:border-slate-600 ${
            prefixIcon ? 'pl-9' : 'pl-3.5'
          } ${suffixIcon ? 'pr-9' : 'pr-3.5'} ${
            error
              ? 'border-red-400 dark:border-red-500 bg-red-50/30 dark:bg-red-950/20 focus:ring-red-500/20 focus:border-red-500'
              : 'border-gray-200 dark:border-slate-700'
          } ${className}`}
          {...props}
        />
        {suffixIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none">
            {suffixIcon}
          </div>
        )}
      </div>
      {error && <p className="text-red-500 dark:text-red-400 text-xs font-medium animate-fade-in">{error}</p>}
      {helperText && !error && <p className="text-gray-400 dark:text-slate-500 text-xs">{helperText}</p>}
    </div>
  );
};

// ─── Select ──────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string;
  hidePlaceholder?: boolean;
}

export const Select = ({
  label,
  error,
  options,
  className = '',
  required,
  placeholder = 'Select an option',
  hidePlaceholder = false,
  ...props
}: SelectProps) => {
  const hasEmptyOption = options.some((o) => o.value === '');
  const filteredOptions = hasEmptyOption ? options.filter((o) => o.value !== '') : options;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        required={required}
        className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border rounded-[10px] text-sm text-gray-900 dark:text-slate-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 hover:border-gray-300 dark:hover:border-slate-600 appearance-none cursor-pointer ${
          error
            ? 'border-red-400 dark:border-red-500 bg-red-50/30 dark:bg-red-950/20 focus:ring-red-500/20 focus:border-red-500'
            : 'border-gray-200 dark:border-slate-700'
        } ${className}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: '36px',
        }}
        {...props}
      >
        {!hidePlaceholder && (
          <option value="" className="dark:bg-slate-900 dark:text-slate-200 text-gray-400">
            {placeholder}
          </option>
        )}
        {filteredOptions.map((option) => (
          <option key={option.value} value={option.value} className="dark:bg-slate-900 dark:text-slate-200">
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-red-500 dark:text-red-400 text-xs font-medium animate-fade-in">{error}</p>}
    </div>
  );
};

// ─── TextArea ─────────────────────────────────────────────────
interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = ({ label, error, className = '', required, ...props }: TextAreaProps) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        required={required}
        className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border rounded-[10px] text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 hover:border-gray-300 dark:hover:border-slate-600 resize-y ${
          error
            ? 'border-red-400 dark:border-red-500 bg-red-50/30 dark:bg-red-950/20 focus:ring-red-500/20 focus:border-red-500'
            : 'border-gray-200 dark:border-slate-700'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-red-500 dark:text-red-400 text-xs font-medium animate-fade-in">{error}</p>}
    </div>
  );
};

// ─── Card ─────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'bordered' | 'glass' | 'flat';
}

export const Card = ({
  children,
  className = '',
  title,
  subtitle,
  style,
  onClick,
  variant = 'default',
}: CardProps) => {
  const variantClasses = {
    default:
      'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-card hover:shadow-card-md hover:border-gray-200/80 dark:hover:border-slate-700',
    elevated:
      'bg-white dark:bg-slate-900 border border-gray-100/80 dark:border-slate-800 shadow-card-lg hover:shadow-[0_16px_40px_-8px_rgb(0,0,0,0.12)]',
    bordered:
      'bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800',
    glass:
      'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-card',
    flat:
      'bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800',
  };

  return (
    <div
      style={style}
      onClick={onClick}
      className={`rounded-2xl transition-all duration-200 text-gray-900 dark:text-slate-100 ${variantClasses[variant]} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {(title || subtitle) && (
        <div className="border-b border-gray-100 dark:border-slate-800 px-5 py-4 sm:px-6 sm:py-4 rounded-t-2xl">
          {title && <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className={title || subtitle ? 'p-5 sm:p-6' : ''}>{children}</div>
    </div>
  );
};

// ─── Badge ────────────────────────────────────────────────────
interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary';
  dot?: boolean;
  className?: string;
}

export const Badge = ({ children, variant = 'primary', dot = false, className = '' }: BadgeProps) => {
  const variantClasses = {
    primary:
      'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70',
    secondary:
      'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700',
    success:
      'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70',
    warning:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/70',
    error:
      'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/70',
    info:
      'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/70',
  };

  const dotColors = {
    primary: 'bg-blue-500', secondary: 'bg-gray-400', success: 'bg-emerald-500',
    warning: 'bg-amber-500', error: 'bg-rose-500', info: 'bg-sky-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        variantClasses[variant] || variantClasses.primary
      } ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} shrink-0`} />}
      {children}
    </span>
  );
};
