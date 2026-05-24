import { Bell, LogOut, Settings, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 gap-3">
        {/* Left side - Logo and Menu Toggle */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt="PSITS"
              className="h-8 w-8"
            />
            <span className="text-lg font-bold text-primary hidden sm:inline">PSITS Hub</span>
          </div>
        </div>

        {/* Right side - Icons and Profile */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {user && (
            <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary md:inline-flex">
              {getUserInterfaceLabel(user)}
            </span>
          )}
          {/* Notifications */}
          <Link to="/notifications" className="relative p-2 hover:bg-gray-100 rounded">
            <Bell size={20} className="text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Link>

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded"
            >
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                {user?.fullName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-900 hidden sm:inline max-w-[10rem] truncate">
                {user?.fullName}
              </span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                <Link
                  to="/settings/profile"
                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-gray-700"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <Settings size={16} /> Profile Settings
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-gray-700 text-left"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
