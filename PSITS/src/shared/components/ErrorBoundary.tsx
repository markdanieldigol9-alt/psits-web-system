import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, LogIn } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('Unhandled UI Exception caught by ErrorBoundary:', error, errorInfo);

    const msg = String(error?.message || error || '');
    const isChunkLoadFailed =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      error?.name === 'ChunkLoadError' ||
      msg.includes('Loading chunk') ||
      msg.includes('dynamically imported module');

    // Auto-reload once per chunk deployment failure with 15s cooldown to prevent infinite loops
    if (isChunkLoadFailed) {
      const retryKey = 'psits_error_boundary_retry_ts';
      const lastRetry = sessionStorage.getItem(retryKey);
      const now = Date.now();
      if (!lastRetry || now - Number(lastRetry) > 15000) {
        sessionStorage.setItem(retryKey, String(now));
        const url = new URL(window.location.href);
        url.searchParams.set('_v', now.toString());
        window.location.replace(url.toString());
      }
    }
  }

  handleReload = (): void => {
    // Clear any retry flags across session
    try {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('psits_')) sessionStorage.removeItem(k);
      });
    } catch {
      // ignore
    }
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.replace(url.toString());
  };

  handleGoHome = (): void => {
    try {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('psits_')) sessionStorage.removeItem(k);
      });
    } catch {
      // ignore
    }
    window.location.href = '/dashboard';
  };

  handleGoLogin = (): void => {
    try {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('psits_')) sessionStorage.removeItem(k);
      });
    } catch {
      // ignore
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const msg = String(this.state.error?.message || this.state.error || '');
      const isChunkLoadFailed =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        this.state.error?.name === 'ChunkLoadError' ||
        msg.includes('Loading chunk') ||
        msg.includes('dynamically imported module');

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center animate-fade-in">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center border shadow-sm ${
              isChunkLoadFailed
                ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
            }`}>
              {isChunkLoadFailed ? <RefreshCw className="w-8 h-8 animate-spin-slow" /> : <AlertTriangle className="w-8 h-8" />}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isChunkLoadFailed ? 'System Update Available' : 'Something went wrong'}
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              {isChunkLoadFailed
                ? 'A new version of the PSITS Web System was updated on the server. Please refresh to load the latest application assets and features.'
                : 'An unexpected error occurred while loading this view. Try refreshing the page to load the latest system assets.'}
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left overflow-x-auto max-h-32">
                <p className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-semibold break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>{isChunkLoadFailed ? 'Update & Refresh' : 'Reload Page'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm transition-all cursor-pointer"
              >
                <Home size={15} />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoLogin}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm transition-all cursor-pointer"
              >
                <LogIn size={15} />
                <span>Login</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
