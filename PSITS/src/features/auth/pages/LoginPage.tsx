import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, ExternalLink } from 'lucide-react';

import { useAuth } from '@/shared/context/AuthContext';
import { AuthLayout } from '@/shared/layouts';
import { Input, Button } from '@/shared/components/Form';
import { Alert } from '@/shared/components/Common';
import { validateEmail } from '@/shared/utils/helpers';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, email: e.target.value });

    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: '' }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, password: e.target.value });

    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: '' }));
    }
  };

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, rememberMe: e.target.checked });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await login(formData.email, formData.password);

      if (formData.rememberMe) {
        localStorage.setItem('remembered_email', formData.email);
      } else {
        localStorage.removeItem('remembered_email');
      }

      const stored = localStorage.getItem('user');
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.status === 'suspended') {
        navigate('/settings');
      } else {
        navigate('/dashboard');
      }
    } catch {
      // Error is already captured in useAuth and displayed via the inline Alert component
    }
  };

  return (
    <AuthLayout title="Login">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="space-y-3">
            <Alert
              type="error"
              message={error}
              className="text-sm sm:text-[15px] font-semibold p-4 shadow-sm"
            />
            {error.toLowerCase().includes('gmail') && (
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=psits.official@gmail.com&su=${encodeURIComponent('Account Activation / Reactivation Inquiry')}&body=${encodeURIComponent(
                  `Dear PSITS Officers and Administrators,\n\nMy account access has been restricted. I would like to request assistance in activating/reactivating my account.\n\nRegistered Email: ${formData.email.trim() || '[Your Email]'}\n\nThank you.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm transition-all shadow-sm hover:shadow-md cursor-pointer"
              >
                <Mail size={18} />
                <span>Contact Officer / Admin via Gmail</span>
                <ExternalLink size={15} className="opacity-80" />
              </a>
            )}
          </div>
        )}

        <Input
          label="Email Address"
          type="email"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleEmailChange}
          error={errors.email}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={formData.password}
              onChange={handlePasswordChange}
              className={`w-full px-3.5 py-2.5 pr-10 rounded-[10px] text-sm text-gray-900 placeholder-gray-400 bg-white border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 ${
                errors.password ? 'border-red-400 bg-red-50/30' : 'border-gray-200'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs font-medium">{errors.password}</p>}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.rememberMe}
              onChange={handleRememberMeChange}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Remember me</span>
          </label>

          <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
        >
          Login
        </Button>

        <p className="text-center text-gray-600 text-sm border-t border-gray-100 pt-4">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Register here
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
