import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';

import { AuthLayout } from '@/shared/layouts';
import { Input, Button } from '@/shared/components/Form';
import { Alert } from '@/shared/components/Common';
import { validateEmail } from '@/shared/utils/helpers';
import api from '@/shared/services/api';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.forgotPassword(trimmedEmail);
      setIsSuccess(true);
      setSubmittedEmail(trimmedEmail);
      if (response.data?.resetUrl) {
        setDevResetUrl(response.data.resetUrl);
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to process your request. Please try again later.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    setIsSuccess(false);
    setDevResetUrl('');
    setError('');
  };

  return (
    <AuthLayout title="Forgot Password">
      {isSuccess ? (
        <div className="space-y-5 animate-fade-in">
          <div className="p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <CheckCircle2 size={28} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Check Your Inbox
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                If an account matches <strong className="text-gray-900 dark:text-white">{submittedEmail}</strong>, we have sent a secure password reset link.
              </p>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              The link is valid for <strong>1 hour</strong>. Don&apos;t forget to check your spam or junk folder if you don&apos;t see it within a few minutes.
            </p>
          </div>

          {/* Quick Action to open Gmail */}
          <div className="space-y-2.5">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <Mail size={18} />
              <span>Open Gmail</span>
              <ExternalLink size={15} className="opacity-80" />
            </a>

            {/* Dev Helper Link when running in localhost/dev */}
            {devResetUrl && (
              <a
                href={devResetUrl}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-400/40 text-amber-800 dark:text-amber-200 font-semibold text-xs transition-colors hover:bg-amber-500/25"
              >
                <span>🧪 Dev Quick Link: Proceed to Reset Password</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium text-xs transition-colors cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Send to a different email address</span>
            </button>
          </div>

          <div className="pt-2 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowLeft size={16} />
              <span>Return to login</span>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Enter your registered email address below and we&apos;ll send you instructions to safely reset your password.
          </p>

          {error && (
            <Alert
              type="error"
              message={error}
              className="text-sm font-semibold p-4 shadow-sm"
            />
          )}

          <Input
            label="Registered Email Address"
            type="email"
            placeholder="e.g. yourname@gmail.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            required
            autoFocus
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isLoading}
          >
            Send Reset Link
          </Button>

          <div className="pt-2 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Login</span>
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};
