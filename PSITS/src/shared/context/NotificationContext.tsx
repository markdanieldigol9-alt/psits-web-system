import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Notification } from '@/shared/types';
import { useAuth } from '@/shared/context/AuthContext';

interface NotificationContextType {
  notifications: Notification[];
  toasts: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);

  const storageKey = useMemo(() => `psits_notifications_${user?.id ?? 'guest'}`, [user?.id]);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setNotifications([]);
      return;
    }

    try {
      const parsed: Notification[] = JSON.parse(raw).map((n: Notification) => ({
        ...n,
        createdAt: new Date(n.createdAt),
      }));
      setNotifications(parsed);
    } catch {
      setNotifications([]);
    }
  }, [storageKey]);

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

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
    setToasts(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setToasts([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, toasts, addNotification, removeNotification, dismissToast, markAsRead, markAllRead, clearAll }}>
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
