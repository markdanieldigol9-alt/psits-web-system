import { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, Settings, Menu, X, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { useTheme } from '@/shared/context/ThemeContext';
import { getUserInterfaceLabel } from '@/shared/utils/userInterface';
import { Link } from 'react-router-dom';
import logo from '@/assets/image/PSITS_Logo.png';

interface HeaderProps {
  onMenuClick?: () => void;
  isMenuOpen?: boolean;
}

export const Header = ({ onMenuClick, isMenuOpen }: HeaderProps) => {
  const { user, logout } = useAuth();
  const { notifications } = useNotification();
  const { effectiveTheme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-slate-800 shadow-xs transition-all duration-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 gap-3">
        {/* Left side - Logo & Mobile Menu Toggle */}
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to={user?.status === 'suspended' ? '/settings' : '/dashboard'} className="flex items-center gap-2.5 group">
            <img
              src={logo}
              alt="PSITS Logo"
              className="h-8 w-8 object-contain transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-lg font-extrabold text-primary tracking-tight leading-none transition-colors">
                PSITS
              </span>
            </div>
          </Link>
        </div>

        {/* Right side - Badges, Notifications & Profile Dropdown */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          {user?.status === 'suspended' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Account Suspended
            </span>
          ) : user && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/80 border border-blue-100 text-xs font-semibold text-blue-800 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              {getUserInterfaceLabel(user)}
            </span>
          )}

          {/* Theme Quick Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-gray-100/80 dark:hover:bg-slate-800 rounded-lg transition-all"
            title={effectiveTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {effectiveTheme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
          </button>

          {/* Notifications Link */}
          {user?.status !== 'suspended' && (
            <Link
              to="/notifications"
              className="relative p-2 text-gray-600 dark:text-slate-300 hover:text-primary hover:bg-gray-100/80 dark:hover:bg-slate-800 rounded-lg transition-all"
              title="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shadow-xs animate-scale-in">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Profile Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="flex items-center gap-2.5 p-1.5 sm:px-2.5 sm:py-1.5 hover:bg-gray-100/80 rounded-xl transition-all border border-transparent hover:border-gray-200"
            >
              <div className="relative">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName || 'User Avatar'}
                    className="w-8 h-8 rounded-full object-cover shadow-xs border border-gray-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
                    {initial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-sm font-semibold text-gray-900 leading-tight max-w-[10rem] truncate">
                  {user?.fullName || 'User'}
                </span>
                <span className="text-[11px] text-gray-500 capitalize leading-tight">
                  {user?.role || 'Member'}
                </span>
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 py-1.5 z-50 animate-scale-in">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-800 sm:hidden">
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{user?.fullName}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{user?.email}</p>
                </div>

                <Link
                  to="/settings"
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-blue-50/60 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <Settings size={16} className="text-gray-400 dark:text-slate-500 group-hover:text-blue-700" />
                  Account Settings
                </Link>

                <div className="my-1 border-t border-gray-100 dark:border-slate-800" />

                <button
                  onClick={() => {
                    handleLogout();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
