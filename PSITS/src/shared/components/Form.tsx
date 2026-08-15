import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled = false,
  ...props
}: ButtonProps) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:transform-none';

  const variantClasses = {
    primary:
      'bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 active:bg-blue-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
    secondary:
      'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 active:bg-gray-300 dark:active:bg-slate-600 hover:-translate-y-0.5 active:translate-y-0',
    danger:
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
    outline:
      'border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-400 dark:hover:border-slate-600 shadow-2xs hover:-translate-y-0.5 active:translate-y-0',
  };

  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs font-semibold',
    md: 'px-4 py-2.5 text-sm font-semibold',
    lg: 'px-6 py-3 text-base font-bold',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      )}
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = ({ label, error, helperText, className = '', required, ...props }: InputProps) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        required={required}
        className={`w-full px-3.5 py-2.5 bg-gray-50/70 dark:bg-slate-950/60 border rounded-xl text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 dark:focus:border-blue-500 transition-all duration-200 ${
          error
            ? 'border-red-400 focus:ring-red-500/30 focus:border-red-600 bg-red-50/30 dark:bg-red-950/20'
            : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-red-600 dark:text-red-400 text-xs font-semibold animate-fade-in">{error}</p>}
      {helperText && !error && <p className="text-gray-500 dark:text-slate-400 text-xs">{helperText}</p>}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string | number; label: string }>;
}

export const Select = ({ label, error, options, className = '', required, ...props }: SelectProps) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        required={required}
        className={`w-full px-3.5 py-2.5 bg-gray-50/70 dark:bg-slate-950/60 border rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 dark:focus:border-blue-500 transition-all duration-200 ${
          error
            ? 'border-red-400 focus:ring-red-500/30 focus:border-red-600 bg-red-50/30 dark:bg-red-950/20'
            : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
        } ${className}`}
        {...props}
      >
        <option value="" className="dark:bg-slate-900 dark:text-slate-200">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="dark:bg-slate-900 dark:text-slate-200">
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-red-600 dark:text-red-400 text-xs font-semibold animate-fade-in">{error}</p>}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = ({ label, error, className = '', required, ...props }: TextAreaProps) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        required={required}
        className={`w-full px-3.5 py-2.5 bg-gray-50/70 dark:bg-slate-950/60 border rounded-xl text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 dark:focus:border-blue-500 transition-all duration-200 ${
          error
            ? 'border-red-400 focus:ring-red-500/30 focus:border-red-600 bg-red-50/30 dark:bg-red-950/20'
            : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-red-600 dark:text-red-400 text-xs font-semibold animate-fade-in">{error}</p>}
    </div>
  );
};

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export const Card = ({ children, className = '', title, subtitle }: CardProps) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-gray-300/80 dark:hover:border-slate-700 text-gray-900 dark:text-slate-100 ${className}`}
    >
      {(title || subtitle) && (
        <div className="border-b border-gray-100 dark:border-slate-800 p-5 sm:p-6 bg-gray-50/40 dark:bg-slate-950/40 rounded-t-2xl">
          {title && <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className={title || subtitle ? 'p-5 sm:p-6' : ''}>{children}</div>
    </div>
  );
};

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary';
  className?: string;
}

export const Badge = ({ children, variant = 'primary', className = '' }: BadgeProps) => {
  const variantClasses = {
    primary: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60',
    secondary: 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700',
    success: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60',
    warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60',
    error: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60',
    info: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
        variantClasses[variant] || variantClasses.primary
      } ${className}`}
    >
      {children}
    </span>
  );
};
