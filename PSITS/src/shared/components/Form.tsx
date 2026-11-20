import { useId } from 'react';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

// ─── Button ──────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost' | 'gradient' | 'cyber' | 'gold';
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
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-1 active:scale-[0.98]';

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:from-primary-700 hover:to-indigo-700 shadow-sm hover:shadow-[0_4px_16px_rgb(37,99,235,0.35)] hover:-translate-y-[1px] active:translate-y-0',
    cyber:
      'bg-gradient-to-r from-primary-600 via-indigo-600 to-cyan-500 text-white hover:from-primary-700 hover:to-cyan-600 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 border border-cyan-400/30',
    gold:
      'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold hover:from-amber-600 hover:to-yellow-600 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0',
    secondary:
      'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 hover:-translate-y-[1px] active:translate-y-0 border border-slate-200/80 dark:border-slate-700/60',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0',
    outline:
      'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 hover:text-primary-600 dark:hover:text-cyan-400 shadow-xs hover:-translate-y-[1px] active:translate-y-0',
    ghost:
      'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 active:bg-slate-200 dark:active:bg-slate-700',
    gradient:
      'bg-gradient-to-r from-primary-600 to-cyan-500 text-white hover:from-primary-700 hover:to-cyan-600 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0',
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
        <span className="inline-flex items-center shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon && <span className="inline-flex items-center shrink-0">{rightIcon}</span>}
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
  suffixAction?: ReactNode;
  variant?: 'default' | 'light';
}

export const Input = ({
  label,
  error,
  helperText,
  prefixIcon,
  suffixIcon,
  suffixAction,
  className = '',
  required,
  variant = 'default',
  style,
  id,
  ...props
}: InputProps) => {
  const generatedId = useId();
  const controlId = id || `input-${generatedId}`;
  const descriptionId = error
    ? `${controlId}-error`
    : helperText
    ? `${controlId}-helper`
    : undefined;
  const isLight = variant === 'light';
  const hasSuffix = Boolean(suffixAction || suffixIcon);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={controlId}
          className={`block text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-700 dark:text-slate-300'}`}
        >
          {label} {required && <span className="text-rose-600 dark:text-rose-400" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        {prefixIcon && (
          <div
            aria-hidden="true"
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-slate-500 dark:text-slate-400'} pointer-events-none`}
          >
            {prefixIcon}
          </div>
        )}
        <input
          id={controlId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptionId}
          className={`w-full py-2.5 rounded-lg text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 ${
            isLight
              ? 'bg-white text-slate-900 placeholder:text-slate-500 hover:border-slate-300 border-slate-200 [color-scheme:light]'
              : 'bg-white dark:bg-obsidian-surface text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 dark:focus:border-cyan-400 border border-slate-200 dark:border-slate-700'
          } ${
            prefixIcon ? 'pl-9' : 'pl-3.5'
          } ${hasSuffix ? 'pr-10' : 'pr-3.5'} ${
            error
              ? isLight
                ? 'border-rose-500 bg-rose-50/30'
                : 'border-rose-500 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500'
              : ''
          } ${className}`}
          style={{
            ...(isLight ? { colorScheme: 'light', backgroundColor: '#ffffff', color: '#111827' } : {}),
            ...style,
          }}
          {...props}
        />
        {suffixAction ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {suffixAction}
          </div>
        ) : suffixIcon ? (
          <div
            aria-hidden="true"
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-slate-500 dark:text-slate-400'} pointer-events-none`}
          >
            {suffixIcon}
          </div>
        ) : null}
      </div>
      {error && (
        <p id={`${controlId}-error`} className={`text-xs font-medium animate-fade-in ${isLight ? 'text-rose-600' : 'text-rose-600 dark:text-rose-400'}`}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${controlId}-helper`} className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-600 dark:text-slate-400'}`}>
          {helperText}
        </p>
      )}
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
  variant?: 'default' | 'light';
}

export const Select = ({
  label,
  error,
  options,
  className = '',
  required,
  placeholder = 'Select an option',
  hidePlaceholder = false,
  variant = 'default',
  style,
  id,
  ...props
}: SelectProps) => {
  const generatedId = useId();
  const controlId = id || `select-${generatedId}`;
  const errorId = error ? `${controlId}-error` : undefined;
  const hasEmptyOption = options.some((o) => o.value === '');
  const filteredOptions = hasEmptyOption ? options.filter((o) => o.value !== '') : options;
  const isLight = variant === 'light';

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={controlId}
          className={`block text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-700 dark:text-slate-300'}`}
        >
          {label} {required && <span className="text-rose-600 dark:text-rose-400" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        id={controlId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`w-full px-3.5 py-2.5 rounded-lg text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 appearance-none cursor-pointer ${
          isLight
            ? 'bg-white text-slate-900 border border-slate-200 hover:border-slate-300 [color-scheme:light]'
            : 'bg-white dark:bg-obsidian-surface border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 dark:focus:border-cyan-400'
        } ${
          error
            ? isLight
              ? 'border-rose-500 bg-rose-50/30'
              : 'border-rose-500 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500'
            : ''
        } ${className}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: '36px',
          ...(isLight ? { colorScheme: 'light', backgroundColor: '#ffffff', color: '#111827' } : {}),
          ...style,
        }}
        {...props}
      >
        {!hidePlaceholder && (
          <option value="" className={isLight ? "bg-white text-slate-500" : "dark:bg-obsidian-surface dark:text-slate-300 text-slate-500"}>
            {placeholder}
          </option>
        )}
        {filteredOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className={isLight ? "bg-white text-slate-900" : "dark:bg-obsidian-surface dark:text-slate-200 text-slate-900"}
          >
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className={`text-xs font-medium animate-fade-in ${isLight ? 'text-rose-600' : 'text-rose-600 dark:text-rose-400'}`}>
          {error}
        </p>
      )}
    </div>
  );
};

// ─── TextArea ─────────────────────────────────────────────────
interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  variant?: 'default' | 'light';
}

export const TextArea = ({ label, error, className = '', required, variant = 'default', style, id, ...props }: TextAreaProps) => {
  const generatedId = useId();
  const controlId = id || `textarea-${generatedId}`;
  const errorId = error ? `${controlId}-error` : undefined;
  const isLight = variant === 'light';

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={controlId}
          className={`block text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-700 dark:text-slate-300'}`}
        >
          {label} {required && <span className="text-rose-600 dark:text-rose-400" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        id={controlId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`w-full px-3.5 py-2.5 rounded-lg text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-y ${
          isLight
            ? 'bg-white text-slate-900 placeholder:text-slate-500 border border-slate-200 hover:border-slate-300 [color-scheme:light]'
            : 'bg-white dark:bg-obsidian-surface border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 dark:focus:border-cyan-400'
        } ${
          error
            ? isLight
              ? 'border-rose-500 bg-rose-50/30'
              : 'border-rose-500 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500'
            : ''
        } ${className}`}
        style={{
          ...(isLight ? { colorScheme: 'light', backgroundColor: '#ffffff', color: '#111827' } : {}),
          ...style,
        }}
        {...props}
      />
      {error && (
        <p id={errorId} className={`text-xs font-medium animate-fade-in ${isLight ? 'text-rose-600' : 'text-rose-600 dark:text-rose-400'}`}>
          {error}
        </p>
      )}
    </div>
  );
};

// ─── Card ─────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'bordered' | 'glass' | 'cyber' | 'flat';
}

export const Card = ({
  children,
  className = '',
  title,
  subtitle,
  headerAction,
  style,
  onClick,
  variant = 'default',
}: CardProps) => {
  const variantClasses = {
    default:
      'bg-white dark:bg-obsidian-card border border-slate-200/80 dark:border-slate-800 shadow-card hover:shadow-card-md hover:border-slate-300 dark:hover:border-slate-700',
    elevated:
      'bg-white dark:bg-obsidian-card border border-slate-200/80 dark:border-slate-800 shadow-card-lg hover:shadow-[0_16px_40px_-8px_rgb(0,0,0,0.12)]',
    bordered:
      'bg-white dark:bg-obsidian-card border-2 border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-cyan-800/80',
    glass:
      'bg-white/85 dark:bg-obsidian-surface/85 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-card',
    cyber:
      'bg-white dark:bg-obsidian-card border border-blue-500/20 dark:border-cyan-500/20 shadow-card hover:shadow-card-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200',
    flat:
      'bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800',
  };

  return (
    <div
      style={style}
      onClick={onClick}
      className={`rounded-2xl transition-all duration-200 text-slate-900 dark:text-slate-100 ${variantClasses[variant]} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {(title || subtitle || headerAction) && (
        <div className="border-b border-slate-200/80 dark:border-slate-800 px-5 py-4 sm:px-6 sm:py-4 rounded-t-2xl flex items-center justify-between gap-3">
          <div>
            {title && <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight text-balance">{title}</h3>}
            {subtitle && <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={title || subtitle || headerAction ? 'p-5 sm:p-6' : ''}>{children}</div>
    </div>
  );
};

// ─── Badge ────────────────────────────────────────────────────
interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'cyber' | 'gold' | 'code';
  dot?: boolean;
  className?: string;
}

export const Badge = ({ children, variant = 'primary', dot = false, className = '' }: BadgeProps) => {
  const variantClasses = {
    primary:
      'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70',
    cyber:
      'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/70',
    gold:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-700/60 font-medium',
    secondary:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    success:
      'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70',
    warning:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/70',
    error:
      'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/70',
    info:
      'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/70',
    code:
      'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-mono text-[11px] tracking-tight',
  };

  const dotColors = {
    primary: 'bg-blue-500', cyber: 'bg-cyan-400 animate-pulse', gold: 'bg-amber-400',
    secondary: 'bg-slate-500', success: 'bg-emerald-500',
    warning: 'bg-amber-500', error: 'bg-rose-500', info: 'bg-sky-500', code: 'bg-slate-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold leading-none ${
        variantClasses[variant] || variantClasses.primary
      } ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} shrink-0`} />}
      {children}
    </span>
  );
};

