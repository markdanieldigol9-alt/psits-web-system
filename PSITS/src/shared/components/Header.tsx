import { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, Settings, Menu, X, Sun, Moon, ChevronRight } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { useTheme } from '@/shared/context/ThemeContext';
import { getUserInterfaceLabel } from '@/shared/utils/userInterface';
import { Link, useLocation } from 'react-router-dom';
import logo from '@/assets/image/PSITS_Logo.png';

interface HeaderProps {
  onMenuClick?: () => void;
  isMenuOpen?: boolean;
}

// Map routes to friendly page names
const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/members': 'Membership',
  '/officers': 'Officers',
  '/elections': 'Officer Elections',
  '/events': 'Events',
  '/my-events': 'My Events',
  '/payments': 'Payments',
  '/forum': 'PSITS Community',
  '/announcements': 'Announcements',
  '/partners': 'Partners',
  '/stream-events': 'Stream Events',
  '/live-events': 'Stream Events',
  '/reports': 'Reports',
  '/institution-members': 'Institution Members',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
};

export const Header = ({ onMenuClick, isMenuOpen }: HeaderProps) => {
  const { user, logout } = useAuth();
  const { notifications } = useNotification();
  const { effectiveTheme, toggleTheme } = useTheme();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Current page label
  const pageLabel = Object.entries(PAGE_LABELS).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  )?.[1] ?? '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';

  return (
    <header className="sticky top-0 z-40 bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border-b border-gray-100/80 dark:border-slate-800/80 shadow-[0_1px_0_0_rgb(0,0,0,0.04)] transition-all duration-200">
      <div className="flex items-center justify-between h-[60px] px-4 sm:px-6 gap-4">

        {/* ── Left: Mobile toggle + Breadcrumb ─── */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Logo — mobile only (hidden on desktop since sidebar shows it) */}
          <Link
            to={user?.status === 'suspended' ? '/settings' : '/dashboard'}
            className="lg:hidden flex items-center gap-2 group"
          >
            <div className="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-sm">
              <img src={logo} alt="PSITS" className="h-4 w-4 object-contain brightness-0 invert" />
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100 tracking-tight">PSITS</span>
          </Link>

          {/* Breadcrumb — desktop */}
          {pageLabel && (
            <div className="hidden lg:flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400">
              <span className="text-gray-300 dark:text-slate-600">PSITS</span>
              <ChevronRight size={14} className="text-gray-300 dark:text-slate-600" />
              <span className="font-semibold text-gray-800 dark:text-slate-200">{pageLabel}</span>
            </div>
          )}
        </div>

        {/* ── Right: Actions ────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          {/* Role / status badge */}
          {user?.status === 'suspended' ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Suspended
            </span>
          ) : user && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {getUserInterfaceLabel(user)}
            </span>
          )}

          {/* Theme toggle — pill style */}
          <button
            onClick={toggleTheme}
            title={effectiveTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            aria-label="Toggle theme"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100/80 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition-colors text-xs font-medium"
          >
            {effectiveTheme === 'dark' ? (
              <><Sun size={15} className="text-amber-400" /><span className="hidden sm:inline text-amber-500 dark:text-amber-400">Light</span></>
            ) : (
              <><Moon size={15} /><span className="hidden sm:inline">Dark</span></>
            )}
          </button>

          {/* Notifications */}
          {user && (
            <Link
              to="/notifications"
              className="relative p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
              <Bell
                size={19}
                className={unreadCount > 0 ? 'animate-ring text-blue-600 dark:text-blue-400' : ''}
              />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 min-w-[16px] px-0.5 flex items-center justify-center shadow-sm animate-pop-in">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Profile dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all border ${
                showProfileMenu
                  ? 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                  : 'border-transparent hover:bg-gray-100/80 dark:hover:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-700'
              }`}
            >
              <div className="relative">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user?.fullName || 'User'}
                    className="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {initial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border-[1.5px] border-white dark:border-slate-900 rounded-full" />
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 max-w-[8rem] truncate">
                  {user?.fullName || 'User'}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">
                  {user?.role || 'member'}
                </span>
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-modal border border-gray-100 dark:border-slate-800 py-2 z-50 animate-pop-in overflow-hidden">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user?.fullName || ''} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-sm font-bold">
                          {initial}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{user?.fullName}</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>

                <div className="py-1 px-2">
                  <Link
                    to="/settings"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-400 rounded-xl transition-colors"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <Settings size={15} className="text-gray-400 dark:text-slate-500" />
                    Account Settings
                  </Link>
                </div>

                <div className="mx-2 border-t border-gray-100 dark:border-slate-800" />

                <div className="py-1 px-2">
                  <button
                    onClick={() => { handleLogout(); setShowProfileMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors text-left"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
