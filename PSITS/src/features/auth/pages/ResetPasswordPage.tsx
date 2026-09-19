import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Check, X } from 'lucide-react';

import { AuthLayout } from '@/shared/layouts';
import { Input, Button } from '@/shared/components/Form';
import { Alert, LoadingSpinner } from '@/shared/components/Common';
import api from '@/shared/services/api';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isVerifyingToken, setIsVerifyingToken] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(4);

  // Validate reset token on mount
  useEffect(() => {
    if (!token) {
      setIsVerifyingToken(false);
      setTokenError('Missing password reset token. Please check the link from your email or request a new one.');
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const res = await api.verifyResetToken(token);
        if (isMounted) {
          setUserEmail(res.data?.email || '');
          setUserName(res.data?.fullName || '');
          setIsVerifyingToken(false);
        }
      } catch (err: any) {
        if (isMounted) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            'This password reset link is invalid or has expired. Please request a new one.';
          setTokenError(msg);
          setIsVerifyingToken(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Countdown timer redirecting to login on success
  useEffect(() => {
    if (!isSuccess) return;
    if (countdown <= 0) {
      navigate('/login');
      return;
    }

    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isSuccess, countdown, navigate]);

  // Rule checks matching backend PASSWORD_RULES
  const ruleMinLength = password.length >= 10;
  const ruleUpper = /[A-Z]/.test(password);
  const ruleLower = /[a-z]/.test(password);
  const ruleNumber = /[0-9]/.test(password);
  const ruleSpecial = /[^\w\s]/.test(password);
  const ruleMatch = Boolean(password && confirmPassword && password === confirmPassword);

  const allRulesPassed =
    ruleMinLength && ruleUpper && ruleLower && ruleNumber && ruleSpecial && ruleMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!ruleMinLength) {
      setSubmitError('Password must be at least 10 characters long.');
      return;
    }
    if (!ruleUpper) {
      setSubmitError('Password must include at least one uppercase letter (A-Z).');
      return;
    }
    if (!ruleLower) {
      setSubmitError('Password must include at least one lowercase letter (a-z).');
      return;
    }
    if (!ruleNumber) {
      setSubmitError('Password must include at least one number (0-9).');
      return;
    }
    if (!ruleSpecial) {
      setSubmitError('Password must include at least one special character (e.g. !@#$%^&*).');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.resetPassword({ token, password });
      setIsSuccess(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to reset password. The link may have expired.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Reset Password">
      {isVerifyingToken ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="md" />
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Verifying your reset link...
          </p>
        </div>
      ) : tokenError ? (
        <div className="space-y-5 animate-fade-in text-center">
          <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle size={26} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Reset Link Expired or Invalid
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {tokenError}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-sm"
            >
              <span>Request a New Reset Link</span>
              <ArrowRight size={16} />
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium text-xs transition-colors"
            >
              <span>Return to Login</span>
            </Link>
          </div>
        </div>
      ) : isSuccess ? (
        <div className="space-y-5 animate-fade-in text-center">
          <div className="p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={30} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Password Successfully Reset!
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Your account password has been updated. You can now log into your PSITS account with your new password.
              </p>
            </div>

            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              Redirecting to login in {countdown}s...
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            Log In Now
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          <div className="space-y-1">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Set a new secure password for{' '}
              <strong className="text-gray-900 dark:text-white">
                {userEmail || userName || 'your account'}
              </strong>
              .
            </p>
          </div>

          {submitError && (
            <Alert
              type="error"
              message={submitError}
              className="text-sm font-semibold p-4 shadow-sm"
            />
          )}

          {/* New Password */}
          <div className="relative">
            <Input
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (submitError) setSubmitError('');
              }}
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-10 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <Input
              label="Confirm New Password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (submitError) setSubmitError('');
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-10 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Password Requirements Checklist */}
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300">
              <ShieldCheck size={14} className="text-blue-500" />
              <span>Password Security Requirements:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  ruleMinLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {ruleMinLength ? <Check size={12} className="stroke-[3]" /> : <X size={12} />}
                <span>At least 10 characters</span>
              </div>

              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  ruleUpper ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {ruleUpper ? <Check size={12} className="stroke-[3]" /> : <X size={12} />}
                <span>Uppercase letter (A-Z)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  ruleLower ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {ruleLower ? <Check size={12} className="stroke-[3]" /> : <X size={12} />}
                <span>Lowercase letter (a-z)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  ruleNumber ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {ruleNumber ? <Check size={12} className="stroke-[3]" /> : <X size={12} />}
                <span>Number (0-9)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  ruleSpecial ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {ruleSpecial ? <Check size={12} className="stroke-[3]" /> : <X size={12} />}
                <span>Special character (!@#$)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  ruleMatch ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {ruleMatch ? <Check size={12} className="stroke-[3]" /> : <X size={12} />}
                <span>Passwords match</span>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            disabled={!allRulesPassed}
          >
            Reset Password
          </Button>

          <div className="pt-2 text-center">
            <Link
              to="/login"
              className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-primary transition-colors"
            >
              Cancel and return to Login
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};
