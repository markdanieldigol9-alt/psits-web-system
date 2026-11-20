import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, ExternalLink, RefreshCw, FlaskConical } from 'lucide-react';

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
    <AuthLayout
      title="Reset Your Password"
      subtitle="Enter your registered email address to receive a recovery link."
    >
      {isSuccess ? (
        <div className="space-y-5 animate-fade-in">
          <div className="p-5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
              <CheckCircle2 size={28} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 text-balance">
                Check Your Inbox
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                If an account matches <strong className="text-slate-900">{submittedEmail}</strong>, we have sent a secure password reset link.
              </p>
            </div>

            <p className="text-xs text-slate-600">
              The link is valid for <strong>1 hour</strong>. Don&apos;t forget to check your spam or junk folder if you don&apos;t see it within a few minutes.
            </p>
          </div>

          {/* Quick Action to open Gmail */}
          <div className="space-y-2.5">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-sm transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <Mail size={18} />
              <span>Open Gmail</span>
              <ExternalLink size={15} className="opacity-80" />
            </a>

            {/* Dev Helper Link when running in localhost/dev */}
            {devResetUrl && (
              <a
                href={devResetUrl}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-800 font-semibold text-xs transition-colors hover:bg-amber-500/25"
              >
                <FlaskConical size={14} strokeWidth={1.75} className="shrink-0" />
                <span>Dev Quick Link: Proceed to Reset Password</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
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
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
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
            variant="light"
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
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary transition-colors"
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
