import { X } from 'lucide-react';
import { useNotification } from '@/shared/context/NotificationContext';

const typeClasses: Record<string, { ring: string; title: string }> = {
  success: { ring: 'ring-green-200 bg-green-50', title: 'text-green-900' },
  error: { ring: 'ring-red-200 bg-red-50', title: 'text-red-900' },
  warning: { ring: 'ring-yellow-200 bg-yellow-50', title: 'text-yellow-900' },
  info: { ring: 'ring-blue-200 bg-blue-50', title: 'text-blue-900' },
};

export const Toasts = () => {
  const { toasts, dismissToast } = useNotification();

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] space-y-3 w-[min(24rem,calc(100vw-2rem))]">
      {toasts.map((n) => {
        const cls = typeClasses[n.type] || typeClasses.info;
        return (
          <div
            key={n.id}
            className={`w-full rounded-lg shadow-lg ring-1 ${cls.ring} p-4`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${cls.title} truncate`}>{n.title}</div>
                <div className="text-sm text-gray-700 mt-1 break-words">{n.message}</div>
              </div>
              <button
                type="button"
                className="shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(n.id)}
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
