import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { getUserInterfaceKey, getUserInterfaceLabel } from '@/shared/utils/userInterface';
import logo from '@/assets/image/PSITS_Logo.png';
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  Megaphone,
  FileText,
  Settings,
  Briefcase,
  Video,
  Bell,
  Upload,
  Vote,
  MessageSquareText,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = {
	  super_admin: [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Membership', icon: Users, href: '/members' },
    { label: 'Officers', icon: Briefcase, href: '/officers' },
    { label: 'Officer Elections', icon: Vote, href: '/elections' },
    { label: 'Events', icon: Calendar, href: '/events' },
    { label: 'Payments', icon: DollarSign, href: '/payments' },
    { label: 'Community Forum', icon: MessageSquareText, href: '/forum' },
    { label: 'Announcements', icon: Megaphone, href: '/announcements' },
    { label: 'Partners', icon: Briefcase, href: '/partners' },
    { label: 'Live Events', icon: Video, href: '/live-events' },
    { label: 'Reports', icon: FileText, href: '/reports' },
	    { label: 'Institution Members', icon: Upload, href: '/institution-members' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
    { label: 'Settings', icon: Settings, href: '/settings' },
  ],
	  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Membership', icon: Users, href: '/members' },
    { label: 'Officer Elections', icon: Vote, href: '/elections' },
    { label: 'Events', icon: Calendar, href: '/events' },
    { label: 'Payments', icon: DollarSign, href: '/payments' },
    { label: 'Community Forum', icon: MessageSquareText, href: '/forum' },
    { label: 'Announcements', icon: Megaphone, href: '/announcements' },
    { label: 'Partners', icon: Briefcase, href: '/partners' },
    { label: 'Live Events', icon: Video, href: '/live-events' },
    { label: 'Reports', icon: FileText, href: '/reports' },
	    { label: 'Institution Members', icon: Upload, href: '/institution-members' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
    { label: 'Settings', icon: Settings, href: '/settings' },
  ],
	  officer: [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Membership', icon: Users, href: '/members' },
    { label: 'Officer Elections', icon: Vote, href: '/elections' },
    { label: 'Events', icon: Calendar, href: '/events' },
    { label: 'Payments', icon: DollarSign, href: '/payments' },
    { label: 'Announcements', icon: Megaphone, href: '/announcements' },
    { label: 'Forum', icon: MessageSquareText, href: '/forum' },
    { label: 'Reports', icon: FileText, href: '/reports' },
	    { label: 'Institution Members', icon: Upload, href: '/institution-members' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
  ],
  member: [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Officers', icon: Briefcase, href: '/officers' },
    { label: 'Events', icon: Calendar, href: '/events' },
    { label: 'My Events', icon: Calendar, href: '/my-events' },
    { label: 'Live Events', icon: Video, href: '/live-events' },
    { label: 'Payments', icon: DollarSign, href: '/payments' },
    { label: 'Forum', icon: MessageSquareText, href: '/forum' },
    { label: 'Announcements', icon: Megaphone, href: '/announcements' },
    { label: 'Partners', icon: Briefcase, href: '/partners' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
    { label: 'Profile', icon: Settings, href: '/settings' },
  ],
  member_individual: [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Officers', icon: Briefcase, href: '/officers' },
    { label: 'Events', icon: Calendar, href: '/events' },
    { label: 'My Events', icon: Calendar, href: '/my-events' },
    { label: 'Live Events', icon: Video, href: '/live-events' },
    { label: 'Payments', icon: DollarSign, href: '/payments' },
    { label: 'Forum', icon: MessageSquareText, href: '/forum' },
    { label: 'Announcements', icon: Megaphone, href: '/announcements' },
    { label: 'Partners', icon: Briefcase, href: '/partners' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
    { label: 'Profile', icon: Settings, href: '/settings' },
  ],
	  member_institutional: [
	    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
	    { label: 'Institution Members', icon: Upload, href: '/institution-members' },
	    { label: 'Officers', icon: Briefcase, href: '/officers' },
	    { label: 'Events', icon: Calendar, href: '/events' },
	    { label: 'My Events', icon: Calendar, href: '/my-events' },
	    { label: 'Live Events', icon: Video, href: '/live-events' },
	    { label: 'Payments', icon: DollarSign, href: '/payments' },
      { label: 'Forum', icon: MessageSquareText, href: '/forum' },
	    { label: 'Announcements', icon: Megaphone, href: '/announcements' },
    { label: 'Partners', icon: Briefcase, href: '/partners' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
    { label: 'Profile', icon: Settings, href: '/settings' },
  ],
	  member_industry: [
	    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
	    { label: 'Officers', icon: Briefcase, href: '/officers' },
	    { label: 'Events', icon: Calendar, href: '/events' },
	    { label: 'My Events', icon: Calendar, href: '/my-events' },
	    { label: 'Live Events', icon: Video, href: '/live-events' },
	    { label: 'Payments', icon: DollarSign, href: '/payments' },
      { label: 'Forum', icon: MessageSquareText, href: '/forum' },
	    { label: 'Announcements', icon: Megaphone, href: '/announcements' },
      { label: 'Partners', icon: Briefcase, href: '/partners' },
	    { label: 'Reports', icon: FileText, href: '/reports' },
      { label: 'Notifications', icon: Bell, href: '/notifications' },
      { label: 'Profile', icon: Settings, href: '/settings' },
	  ],
	};

export const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
  const { user } = useAuth();
  const location = useLocation();


  if (!user) return null;

  const uiKey = getUserInterfaceKey(user);
  const items = menuItems[uiKey] || menuItems[user.role] || menuItems.member;

  const isMember = user.role === 'member';
  const expiresAt = user.membershipExpiresAt ? new Date(user.membershipExpiresAt) : null;
  const isExpired = isMember && expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now();

  const itemsToDisplay = isExpired
    ? items.filter((item) => ['/dashboard', '/settings', '/payments'].includes(item.href))
    : items;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-200 w-64 bg-white border-r border-gray-200 overflow-y-auto z-30`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt="PSITS"
              className="h-8 w-8"
            />
            <span className="text-lg font-bold text-primary">PSITS Hub</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{getUserInterfaceLabel(user)} Interface</p>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {itemsToDisplay.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                location.pathname === item.href
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>


      </aside>
    </>
  );
};
