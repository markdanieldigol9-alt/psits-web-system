import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Notification } from '@/shared/types';
import { useAuth } from '@/shared/context/AuthContext';
import api from '@/shared/services/api';

interface NotificationContextType {
  notifications: Notification[];
  toasts: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const storageKey = useMemo(() => `psits_notifications_${user?.id ?? 'guest'}`, [user?.id]);
  const isFetchingRef = useRef(false);

  const loadStoredNotifications = useCallback((key: string): Notification[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw)
        .filter((n: Notification) => n.title !== 'Login Successful' && n.title !== 'Login Failed')
        .map((n: Notification) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        }));
    } catch {
      return [];
    }
  }, []);

  const [notifications, setNotifications] = useState<Notification[]>(() => loadStoredNotifications(storageKey));
  const [toasts, setToasts] = useState<Notification[]>([]);

  const fetchBackendNotifications = useCallback(async () => {
    if (!user?.id || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const { data } = await api.getNotifications();
      if (data?.success && Array.isArray(data.notifications)) {
        const remoteList: Notification[] = data.notifications.map((n: any) => ({
          id: String(n.id),
          userId: String(n.userId || user.id),
          title: n.title,
          message: n.message,
          type: n.type || 'info',
          isRead: Boolean(n.isRead),
          meta: n.meta || null,
          createdAt: new Date(n.createdAt),
        }));

        setNotifications((prev) => {
          const remoteIds = new Set(remoteList.map((r) => r.id));
          const localOnly = prev.filter((p) => !remoteIds.has(p.id) && isNaN(Number(p.id)));
          return [...remoteList, ...localOnly].slice(0, 150);
        });
      }
    } catch {
      // ignore network errors / fallback to local storage
    } finally {
      isFetchingRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    setNotifications(loadStoredNotifications(storageKey));
    fetchBackendNotifications();
  }, [storageKey, loadStoredNotifications, fetchBackendNotifications]);

  // Polling for live notifications every 12 seconds
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchBackendNotifications();
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [user?.id, fetchBackendNotifications]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, storageKey]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 200));
    setToasts(prev => [newNotification, ...prev].slice(0, 4));

    setTimeout(() => {
      setToasts(prev => prev.filter(notif => notif.id !== newNotification.id));
    }, 5000);
  }, []);

  const removeNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
    setToasts(prev => prev.filter(notif => notif.id !== id));
    if (!isNaN(Number(id))) {
      try {
        await api.deleteNotification(id);
      } catch {
        // ignore
      }
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
    if (!isNaN(Number(id))) {
      try {
        await api.markNotificationRead(id);
      } catch {
        // ignore
      }
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
    try {
      await api.markAllNotificationsRead();
    } catch {
      // ignore
    }
  }, []);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    setToasts([]);
    try {
      await api.clearAllNotifications();
    } catch {
      // ignore
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, toasts, addNotification, removeNotification, dismissToast, markAsRead, markAllRead, clearAll, refreshNotifications: fetchBackendNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};
