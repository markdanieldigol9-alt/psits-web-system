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
  const baseClasses = 'font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow-md';

  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary-light disabled:bg-gray-400 disabled:transform-none disabled:shadow-none',
    secondary: 'bg-secondary text-gray-900 hover:bg-secondary-dark disabled:bg-gray-300 disabled:transform-none disabled:shadow-none',
    danger: 'bg-error text-white hover:bg-red-600 disabled:bg-red-300 disabled:transform-none disabled:shadow-none',
    success: 'bg-success text-white hover:bg-green-600 disabled:bg-green-300 disabled:transform-none disabled:shadow-none',
    outline: 'border-2 border-primary text-primary hover:bg-primary-50 disabled:border-gray-300 disabled:text-gray-400 disabled:transform-none disabled:shadow-none bg-transparent',
  };

  const sizeClasses = {
    sm: 'px-4 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-8 py-3.5 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && (
        <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
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
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          {label} {required && <span className="text-error">*</span>}
        </label>
      )}
      <input
        required={required}
        className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 ${
          error ? 'border-error focus:ring-error/50 focus:border-error' : 'border-gray-200 hover:border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-error text-sm mt-1.5 font-medium animate-fade-in">{error}</p>}
      {helperText && <p className="text-gray-500 text-sm mt-1.5">{helperText}</p>}
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
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          {label} {required && <span className="text-error">*</span>}
        </label>
      )}
      <select
        required={required}
        className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 ${
          error ? 'border-error focus:ring-error/50 focus:border-error' : 'border-gray-200 hover:border-gray-300'
        } ${className}`}
        {...props}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-error text-sm mt-1.5 font-medium animate-fade-in">{error}</p>}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = ({ label, error, className = '', required, ...props }: TextAreaProps) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          {label} {required && <span className="text-error">*</span>}
        </label>
      )}
      <textarea
        required={required}
        className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 ${
          error ? 'border-error focus:ring-error/50 focus:border-error' : 'border-gray-200 hover:border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-error text-sm mt-1.5 font-medium animate-fade-in">{error}</p>}
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
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md ${className}`}>
      {(title || subtitle) && (
        <div className="border-b border-gray-100 p-6 bg-gray-50/50 rounded-t-2xl">
          {title && <h3 className="text-xl font-bold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 mt-1.5">{subtitle}</p>}
        </div>
      )}
      <div className={title || subtitle ? 'p-6' : ''}>{children}</div>
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
    primary: 'bg-primary-50 text-primary border border-primary/20',
    secondary: 'bg-gray-100 text-gray-800 border border-gray-200',
    success: 'bg-green-50 text-success border border-success/20',
    warning: 'bg-yellow-50 text-warning border border-warning/20',
    error: 'bg-red-50 text-error border border-error/20',
    info: 'bg-blue-50 text-info border border-info/20',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${variantClasses[variant] || variantClasses.primary} ${className}`}>
      {children}
    </span>
  );
};
