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

    // Auto-reload once for dynamic chunk import failures caused by new deployments
    const isChunkLoadFailed =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('dynamically imported module');

    if (isChunkLoadFailed) {
      const retryKey = 'psits_chunk_retry';
      const hasRetried = sessionStorage.getItem(retryKey);
      if (!hasRetried) {
        sessionStorage.setItem(retryKey, 'true');
        window.location.reload();
      }
    }
  }

  handleReload = (): void => {
    sessionStorage.removeItem('psits_chunk_retry');
    window.location.reload();
  };

  handleGoHome = (): void => {
    sessionStorage.removeItem('psits_chunk_retry');
    window.location.href = '/dashboard';
  };

  handleGoLogin = (): void => {
    sessionStorage.removeItem('psits_chunk_retry');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800 shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Something went wrong
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              An unexpected error occurred while loading this view. Try refreshing the page to load the latest system assets.
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
                <span>Reload Page</span>
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
