import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/shared/layouts';
import { Card, Button } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Eye,
  Trash2,
  CheckCheck,
  UserCheck,
  Calendar,
  Mail,
  User,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useNotification } from '@/shared/context/NotificationContext';
import type { Notification } from '@/shared/types';

const typeConfig = {
  success: {
    icon: <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400" />,
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    borderClass: 'border-l-4 border-l-emerald-500',
    label: 'Success',
  },
  warning: {
    icon: <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />,
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    borderClass: 'border-l-4 border-l-amber-500',
    label: 'Alert / Appeal',
  },
  info: {
    icon: <Bell size={18} className="text-blue-600 dark:text-blue-400" />,
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    borderClass: 'border-l-4 border-l-blue-500',
    label: 'Information',
  },
  error: {
    icon: <AlertCircle size={18} className="text-red-600 dark:text-red-400" />,
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
    borderClass: 'border-l-4 border-l-red-500',
    label: 'Urgent Error',
  },
};

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, markAsRead, removeNotification, markAllRead, clearAll } = useNotification();
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'appeals'>('all');

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const appealsCount = notifications.filter(
    (n) => n.meta?.kind === 'reactivation_request' || n.title.toLowerCase().includes('reactivation')
  ).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'appeals') {
      return n.meta?.kind === 'reactivation_request' || n.title.toLowerCase().includes('reactivation');
    }
    return true;
  });

  const handleOpenDetailModal = (notification: Notification) => {
    setSelectedNotification(notification);
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2.5">
              <Bell className="text-primary h-7 w-7" />
              Notifications & Alerts
            </h1>
            <p className="text-gray-600 dark:text-slate-400 text-sm mt-1">
              View system updates, member reactivation requests, and important announcements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={!notifications.length || unreadCount === 0}
              className="flex items-center gap-1.5"
            >
              <CheckCheck size={16} />
              <span>Mark all read</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={!notifications.length}
              className="flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 size={16} />
              <span>Clear all</span>
            </Button>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            All Notifications
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">{notifications.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'unread'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-extrabold animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appeals')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'appeals'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            <ShieldAlert size={14} />
            Reactivation Appeals
            {appealsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white">
                {appealsCount}
              </span>
            )}
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <Card className="p-12 text-center text-gray-500 dark:text-slate-400 space-y-2">
              <Bell className="mx-auto h-10 w-10 text-gray-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-semibold text-gray-700 dark:text-slate-300">No notifications found</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                {activeTab === 'unread'
                  ? 'You are all caught up! No unread messages.'
                  : activeTab === 'appeals'
                  ? 'No account reactivation appeals at this time.'
                  : 'You will receive in-app notifications as events and requests occur.'}
              </p>
            </Card>
          ) : (
            filteredNotifications.map((n) => {
              const config = typeConfig[n.type as keyof typeof typeConfig] || typeConfig.info;
              const isReactivation =
                n.meta?.kind === 'reactivation_request' || n.title.toLowerCase().includes('reactivation');

              return (
                <Card
                  key={n.id}
                  className={`p-4 transition-all hover:shadow-md cursor-pointer ${
                    !n.isRead
                      ? 'bg-blue-50/40 dark:bg-blue-950/15 border-blue-200 dark:border-blue-900/60'
                      : 'bg-white dark:bg-slate-900'
                  } ${config.borderClass}`}
                  onClick={() => handleOpenDetailModal(n)}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 shrink-0 mt-0.5">
                      {config.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3
                            className={`text-sm truncate ${
                              !n.isRead
                                ? 'font-bold text-gray-900 dark:text-slate-100'
                                : 'font-semibold text-gray-800 dark:text-slate-200'
                            }`}
                          >
                            {n.title}
                          </h3>
                          {isReactivation && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shrink-0">
                              Reactivation Request
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!n.isRead && (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-blue-600 text-white">
                              New
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-600 dark:text-slate-300 text-xs sm:text-sm line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>

                      <div
                        className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenDetailModal(n)}
                          className="flex items-center gap-1.5 text-xs py-1 px-3"
                        >
                          <Eye size={14} />
                          <span>View Details</span>
                        </Button>

                        {!n.isRead && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => markAsRead(n.id)}
                            className="flex items-center gap-1.5 text-xs py-1 px-3"
                          >
                            <CheckCheck size={14} />
                            <span>Mark as read</span>
                          </Button>
                        )}

                        <button
                          type="button"
                          onClick={() => removeNotification(n.id)}
                          className="ml-auto text-xs text-gray-400 hover:text-red-600 p-1 rounded-md transition-colors flex items-center gap-1"
                          title="Remove notification"
                        >
                          <Trash2 size={14} />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* POP-UP MODAL: View Notification Details */}
        {selectedNotification && (
          <Modal
            isOpen={Boolean(selectedNotification)}
            onClose={() => setSelectedNotification(null)}
            title="Notification Details"
            size="md"
          >
            <div className="space-y-4">
              {/* Notification Header Badge & Timestamp */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800">
                    {typeConfig[selectedNotification.type as keyof typeof typeConfig]?.icon || typeConfig.info.icon}
                  </div>
                  <div>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        typeConfig[selectedNotification.type as keyof typeof typeConfig]?.badgeClass ||
                        typeConfig.info.badgeClass
                      }`}
                    >
                      {typeConfig[selectedNotification.type as keyof typeof typeConfig]?.label || 'Notification'}
                    </span>
                    <h3 className="font-bold text-base text-gray-900 dark:text-slate-100 mt-1">
                      {selectedNotification.title}
                    </h3>
                  </div>
                </div>

                <div className="text-right text-xs text-gray-400 shrink-0">
                  <p>{new Date(selectedNotification.createdAt).toLocaleDateString()}</p>
                  <p className="font-semibold text-gray-600 dark:text-slate-300">
                    {new Date(selectedNotification.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Message Box */}
              <div className="bg-gray-50/70 dark:bg-slate-900/60 p-4 rounded-xl border border-gray-200 dark:border-slate-800 text-sm text-gray-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedNotification.message}
              </div>

              {/* Reactivation Request Extended Metadata Breakdown */}
              {selectedNotification.meta?.kind === 'reactivation_request' && (
                <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wide">
                    <ShieldAlert size={16} />
                    <span>Member Account Appeal Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/40">
                      <span className="text-gray-500 dark:text-slate-400 block font-medium">Applicant Name</span>
                      <span className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                        <User size={13} className="text-amber-600" />
                        {selectedNotification.meta?.memberName || 'N/A'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/40">
                      <span className="text-gray-500 dark:text-slate-400 block font-medium">Email Address</span>
                      <span className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                        <Mail size={13} className="text-amber-600" />
                        {selectedNotification.meta?.memberEmail || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {selectedNotification.meta?.suspendedReason && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/40 text-xs">
                      <span className="text-gray-500 dark:text-slate-400 block font-medium">Suspension Reason Given</span>
                      <p className="font-semibold text-red-600 dark:text-red-400 mt-0.5">
                        {selectedNotification.meta.suspendedReason}
                      </p>
                    </div>
                  )}

                  {selectedNotification.meta?.appealMessage && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/40 text-xs">
                      <span className="text-gray-500 dark:text-slate-400 block font-medium">Member's Appeal Message</span>
                      <p className="font-medium text-gray-800 dark:text-slate-200 mt-1 italic">
                        "{selectedNotification.meta.appealMessage}"
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      className="w-full flex items-center justify-center gap-2 !bg-amber-600 hover:!bg-amber-700 text-white font-bold text-xs py-2.5 cursor-pointer"
                      onClick={() => {
                        setSelectedNotification(null);
                        navigate('/members');
                      }}
                    >
                      <UserCheck size={16} />
                      <span>Review & Reactivate Member in Membership</span>
                      <ExternalLink size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Membership Renewal Request Breakdown */}
              {selectedNotification.meta?.kind === 'renewal_request' && (
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-xs uppercase tracking-wide">
                    <RefreshCw size={16} />
                    <span>Membership Renewal Request Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40">
                      <span className="text-gray-500 dark:text-slate-400 block font-medium">Member Name</span>
                      <span className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                        <User size={13} className="text-blue-600" />
                        {selectedNotification.meta?.memberName || 'N/A'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40">
                      <span className="text-gray-500 dark:text-slate-400 block font-medium">Email Address</span>
                      <span className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                        <Mail size={13} className="text-blue-600" />
                        {selectedNotification.meta?.memberEmail || 'N/A'}
                      </span>
                    </div>

                    {selectedNotification.meta?.amount !== undefined && (
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40">
                        <span className="text-gray-500 dark:text-slate-400 block font-medium">Renewal Amount</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">
                          ₱{Number(selectedNotification.meta.amount).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {selectedNotification.meta?.referenceNumber && (
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40">
                        <span className="text-gray-500 dark:text-slate-400 block font-medium">Payment Reference</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-slate-100 mt-0.5 block truncate">
                          {selectedNotification.meta.referenceNumber}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      className="w-full flex items-center justify-center gap-2 font-bold text-xs py-2.5 cursor-pointer shadow-xs"
                      onClick={() => {
                        setSelectedNotification(null);
                        navigate('/payments');
                      }}
                    >
                      <ExternalLink size={15} />
                      <span>Review & Verify in Payments Management</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Event / Announcement / Other Direct Action Link */}
              {selectedNotification.meta?.kind !== 'reactivation_request' && selectedNotification.meta?.kind !== 'renewal_request' && selectedNotification.meta?.url && (
                <div className="pt-1">
                  <Button
                    variant="primary"
                    className="w-full flex items-center justify-center gap-2 font-bold text-xs py-2.5 cursor-pointer shadow-xs"
                    onClick={() => {
                      const targetUrl = String(selectedNotification.meta?.url || '');
                      setSelectedNotification(null);
                      if (targetUrl) navigate(targetUrl);
                    }}
                  >
                    <ExternalLink size={15} />
                    <span>
                      {selectedNotification.meta.url === '/events'
                        ? 'View Event & Registration'
                        : selectedNotification.meta.url === '/announcements'
                        ? 'Open Announcements'
                        : 'View Details'}
                    </span>
                  </Button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    removeNotification(selectedNotification.id);
                    setSelectedNotification(null);
                  }}
                  className="text-red-600 hover:text-red-700 text-xs"
                >
                  <Trash2 size={14} className="mr-1" />
                  Remove Notification
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedNotification(null)}
                  className="px-5 font-semibold text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </MainLayout>
  );
};
