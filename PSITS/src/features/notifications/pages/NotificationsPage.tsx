import { MainLayout } from '@/shared/layouts';
import { Card } from '@/shared/components/Form';
import { Bell, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useNotification } from '@/shared/context/NotificationContext';

const typeIcon = {
  success: <CheckCircle size={18} className="text-green-600" />,
  warning: <AlertTriangle size={18} className="text-yellow-600" />,
  info: <Bell size={18} className="text-blue-600" />,
  error: <AlertCircle size={18} className="text-red-600" />,
};

export const NotificationsPage = () => {
  const { notifications, markAsRead, removeNotification, markAllRead, clearAll } = useNotification();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-2">View your recent alerts and messages</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={markAllRead}
              className="px-3 py-2 text-sm font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
              disabled={!notifications.length}
            >
              Mark all as read
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="px-3 py-2 text-sm font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
              disabled={!notifications.length}
            >
              Clear all
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {!notifications.length && (
            <Card className="p-6 text-center text-gray-500">
              No notifications yet. You’ll see updates here as you use the system.
            </Card>
          )}
          {notifications.map((n) => (
            <Card key={n.id} className="p-4">
              <div className="flex items-start gap-3">
                {typeIcon[n.type as keyof typeof typeIcon] || typeIcon.info}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{n.title}</h3>
                      <p className="text-gray-600 text-sm">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                        Unread
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                      disabled={n.isRead}
                    >
                      Mark as read
                    </button>
                    <button
                      type="button"
                      onClick={() => removeNotification(n.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};
