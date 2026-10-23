import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotification } from '@/shared/context/NotificationContext';

const typeConfig: Record<
  string,
  {
    borderLeft: string;
    icon: React.ReactNode;
    titleClass: string;
  }
> = {
  success: {
    borderLeft: 'border-l-emerald-500',
    icon: <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
    titleClass: 'text-emerald-900 dark:text-emerald-200',
  },
  error: {
    borderLeft: 'border-l-rose-500',
    icon: <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
    titleClass: 'text-rose-900 dark:text-rose-200',
  },
  warning: {
    borderLeft: 'border-l-amber-500',
    icon: <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
    titleClass: 'text-amber-900 dark:text-amber-200',
  },
  info: {
    borderLeft: 'border-l-blue-500',
    icon: <Info size={18} className="text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />,
    titleClass: 'text-blue-900 dark:text-blue-200',
  },
};

export const Toasts = () => {
  const { toasts, dismissToast } = useNotification();

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[70] space-y-3 w-[min(24rem,calc(100vw-2rem))] pointer-events-none">
      {toasts.map((n) => {
        const config = typeConfig[n.type] || typeConfig.info;
        return (
          <div
            key={n.id}
            className={`w-full pointer-events-auto rounded-xl shadow-modal border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 border-l-4 ${config.borderLeft} animate-pop-in transition-all`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                {config.icon}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-bold ${config.titleClass} truncate tracking-tight`}>
                    {n.title}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 break-words font-medium leading-relaxed">
                    {n.message}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(n.id)}
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
