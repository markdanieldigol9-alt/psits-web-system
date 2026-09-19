import { useMemo } from 'react';
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
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type MenuItem = { label: string; icon: React.ElementType; href: string };

const menuGroups: Record<string, { group: string; items: MenuItem[] }[]> = {
  super_admin: [
    {
      group: 'Overview',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      ],
    },
    {
      group: 'Management',
      items: [
        { label: 'Membership', icon: Users, href: '/members' },
        { label: 'Officers', icon: Briefcase, href: '/officers' },
        { label: 'Officer Elections', icon: Vote, href: '/elections' },
        { label: 'Events', icon: Calendar, href: '/events' },
        { label: 'Payment Tracking', icon: DollarSign, href: '/payments' },
        { label: 'Institution Members', icon: Upload, href: '/institution-members' },
        { label: 'Reports', icon: FileText, href: '/reports' },
      ],
    },
    {
      group: 'Community',
      items: [
        { label: 'PSITS Community', icon: MessageSquareText, href: '/forum' },
        { label: 'Announcements', icon: Megaphone, href: '/announcements' },
        { label: 'Partners', icon: Briefcase, href: '/partners' },
        { label: 'Stream Events', icon: Video, href: '/stream-events' },
      ],
    },
    {
      group: 'Account',
      items: [
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Settings', icon: Settings, href: '/settings' },
      ],
    },
  ],
  admin: [
    {
      group: 'Overview',
      items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
    },
    {
      group: 'Management',
      items: [
        { label: 'Membership', icon: Users, href: '/members' },
        { label: 'Officer Elections', icon: Vote, href: '/elections' },
        { label: 'Events', icon: Calendar, href: '/events' },
        { label: 'Payment Tracking', icon: DollarSign, href: '/payments' },
        { label: 'Institution Members', icon: Upload, href: '/institution-members' },
        { label: 'Reports', icon: FileText, href: '/reports' },
      ],
    },
    {
      group: 'Community',
      items: [
        { label: 'PSITS Community', icon: MessageSquareText, href: '/forum' },
        { label: 'Announcements', icon: Megaphone, href: '/announcements' },
        { label: 'Partners', icon: Briefcase, href: '/partners' },
        { label: 'Stream Events', icon: Video, href: '/stream-events' },
      ],
    },
    {
      group: 'Account',
      items: [
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Settings', icon: Settings, href: '/settings' },
      ],
    },
  ],
  officer: [
    {
      group: 'Overview',
      items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
    },
    {
      group: 'Management',
      items: [
        { label: 'Membership', icon: Users, href: '/members' },
        { label: 'Officer Elections', icon: Vote, href: '/elections' },
        { label: 'Events', icon: Calendar, href: '/events' },
        { label: 'Payment Tracking', icon: DollarSign, href: '/payments' },
        { label: 'Institution Members', icon: Upload, href: '/institution-members' },
        { label: 'Reports', icon: FileText, href: '/reports' },
      ],
    },
    {
      group: 'Community',
      items: [
        { label: 'Announcements', icon: Megaphone, href: '/announcements' },
        { label: 'PSITS Community', icon: MessageSquareText, href: '/forum' },
        { label: 'Stream Events', icon: Video, href: '/stream-events' },
      ],
    },
    {
      group: 'Account',
      items: [{ label: 'Notifications', icon: Bell, href: '/notifications' }],
    },
  ],
  member: [
    {
      group: 'Overview',
      items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
    },
    {
      group: 'Events & Payments',
      items: [
        { label: 'Events', icon: Calendar, href: '/events' },
        { label: 'My Events', icon: Calendar, href: '/my-events' },
        { label: 'Stream Events', icon: Video, href: '/stream-events' },
        { label: 'Payment History', icon: DollarSign, href: '/payments' },
      ],
    },
    {
      group: 'Community',
      items: [
        { label: 'PSITS Community', icon: MessageSquareText, href: '/forum' },
        { label: 'Announcements', icon: Megaphone, href: '/announcements' },
        { label: 'Partners', icon: Briefcase, href: '/partners' },
        { label: 'Officers', icon: Briefcase, href: '/officers' },
        { label: 'Officer Elections', icon: Vote, href: '/elections' },
      ],
    },
    {
      group: 'Account',
      items: [
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Profile', icon: Settings, href: '/settings' },
      ],
    },
  ],
  member_individual: [
    {
      group: 'Overview',
      items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
    },
    {
      group: 'Events & Payments',
      items: [
        { label: 'Events', icon: Calendar, href: '/events' },
        { label: 'My Events', icon: Calendar, href: '/my-events' },
        { label: 'Stream Events', icon: Video, href: '/stream-events' },
        { label: 'Payment History', icon: DollarSign, href: '/payments' },
      ],
    },
    {
      group: 'Community',
      items: [
        { label: 'PSITS Community', icon: MessageSquareText, href: '/forum' },
        { label: 'Announcements', icon: Megaphone, href: '/announcements' },
        { label: 'Partners', icon: Briefcase, href: '/partners' },
        { label: 'Officers', icon: Briefcase, href: '/officers' },
        { label: 'Officer Elections', icon: Vote, href: '/elections' },
      ],
    },
    {
      group: 'Account',
      items: [
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Profile', icon: Settings, href: '/settings' },
      ],
    },
  ],
  member_institutional: [
    {
      group: 'Overview',
      items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
    },
    {
      group: 'Events & Payments',
      items: [
        { label: 'Institution Members', icon: Upload, href: '/institution-members' },
        { label: 'Events', icon: Calendar, href: '/events' },
        { label: 'My Events', icon: Calendar, href: '/my-events' },
        { label: 'Stream Events', icon: Video, href: '/stream-events' },
        { label: 'Payment History', icon: DollarSign, href: '/payments' },
      ],
    },
    {
      group: 'Community',
      items: [
        { label: 'PSITS Community', icon: MessageSquareText, href: '/forum' },
        { label: 'Announcements', icon: Megaphone, href: '/announcements' },
        { label: 'Partners', icon: Briefcase, href: '/partners' },
        { label: 'Officers', icon: Briefcase, href: '/officers' },
        { label: 'Officer Elections', icon: Vote, href: '/elections' },
      ],
    },
    {
      group: 'Account',
      items: [
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Profile', icon: Settings, href: '/settings' },
      ],
    },
  ],
  member_industry: [
    {
      group: 'Overview',
      items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
    },
    {
      group: 'Events & Payments',
      items: [
        { label: 'Events', icon: Calendar, href: '/events' },
        { label: 'My Events', icon: Calendar, href: '/my-events' },
        { label: 'Stream Events', icon: Video, href: '/stream-events' },
        { label: 'Payment History', icon: DollarSign, href: '/payments' },
      ],
    },
    {
      group: 'Community',
      items: [
        { label: 'PSITS Community', icon: MessageSquareText, href: '/forum' },
        { label: 'Announcements', icon: Megaphone, href: '/announcements' },
        { label: 'Partners', icon: Briefcase, href: '/partners' },
        { label: 'Officers', icon: Briefcase, href: '/officers' },
        { label: 'Officer Elections', icon: Vote, href: '/elections' },
        { label: 'Reports', icon: FileText, href: '/reports' },
      ],
    },
    {
      group: 'Account',
      items: [
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Profile', icon: Settings, href: '/settings' },
      ],
    },
  ],
};

export const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
  const { user } = useAuth();
  const location = useLocation();

  const groupsToDisplay = useMemo(() => {
    if (!user) return [];

    if (user.status === 'suspended') {
      return [{
        group: 'Account',
        items: [{ label: 'Settings', icon: Settings, href: '/settings' }],
      }];
    }

    const uiKey = getUserInterfaceKey(user);
    const groups = menuGroups[uiKey] || menuGroups[user.role] || menuGroups.member;

    const isMember = user.role === 'member';
    const expiresAt = user.membershipExpiresAt ? new Date(user.membershipExpiresAt) : null;
    const isExpired = isMember && expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now();

    if (!isExpired) return groups;

    const allowedHrefs = ['/dashboard', '/settings', '/payments'];
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => allowedHrefs.includes(i.href)) }))
      .filter((g) => g.items.length > 0);
  }, [user]);

  if (!user) return null;

  const initial = user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-200 w-64 flex flex-col gradient-sidebar border-r border-gray-100 dark:border-slate-800/80 overflow-hidden z-30 shadow-[1px_0_0_0_rgb(0,0,0,0.04)]`}
      >
        {/* ── Logo area ─────────────────────────── */}
        <div className="flex items-center gap-3 px-5 h-[60px] border-b border-gray-100/80 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-md shadow-blue-600/30">
            <img src={logo} alt="PSITS" className="h-5 w-5 object-contain brightness-0 invert" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100 tracking-tight">PSITS</span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium tracking-wide">Web System</span>
          </div>
        </div>

        {/* ── Navigation ────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {groupsToDisplay.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
              {/* Group label */}
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-600">
                {group.group}
              </p>

              {/* Items */}
              {group.items.map((item) => {
                const isStreamActive =
                  (item.href === '/stream-events' || item.href === '/live-events') &&
                  (location.pathname.startsWith('/stream-events') || location.pathname.startsWith('/live-events'));
                const isActive = location.pathname === item.href || isStreamActive;

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={onClose}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl mb-0.5 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-semibold shadow-[inset_3px_0_0_#2563EB]'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <item.icon
                        size={17}
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isActive && (
                      <ChevronRight size={13} className="text-blue-400 dark:text-blue-500 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── User footer ───────────────────────── */}
        <div className="shrink-0 border-t border-gray-100 dark:border-slate-800/60 p-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-default">
            <div className="relative shrink-0">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName || 'User'}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {initial}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate leading-tight">
                {user.fullName || 'User'}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 capitalize truncate leading-tight mt-0.5">
                {getUserInterfaceLabel(user)}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
