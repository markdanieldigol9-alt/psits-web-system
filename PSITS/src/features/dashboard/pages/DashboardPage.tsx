import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Badge } from '@/shared/components/Form';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { getUserDisplayName } from '@/shared/utils/userInterface';
import { InstitutionEventLeaderboard } from '@/features/dashboard/components/InstitutionEventLeaderboard';
import api from '@/shared/services/api';
import {
  Users,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  ArrowRight,
  Megaphone,
  CalendarDays,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type DashboardReport = {
  success: boolean;
  summary: {
    totalMembers: number;
    activeMembers: number;
    pendingApprovals: number;
    activeEvents: number;
    totalRevenue: number;
  };
  memberGrowth: Array<{ month: string; members: number; active: number }>;
  revenueByMethod: Array<{ name: string; value: number }>;
  pendingMembers: Array<{
    id: string;
    fullName: string;
    email: string;
    sector: string;
    memberType: string | null;
    status: string;
    createdAt: string;
  }>;
};

type DashboardEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  status: string;
};

type DashboardAnnouncement = {
  id: string;
  title: string;
  content: string;
  date: string;
};

const chartColors = ['#2563EB', '#06B6D4', '#F59E0B', '#10B981', '#8B5CF6'];

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [report, setReport] = useState<DashboardReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<{ id: string; name: string } | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberEvents, setMemberEvents] = useState<DashboardEvent[]>([]);
  const [memberAnnouncements, setMemberAnnouncements] = useState<DashboardAnnouncement[]>([]);

  const canManageMembers = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.getReports('dashboard');
      if (data?.success) setReport(data);
    } catch {
      // keep UI usable even if report fails
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemberDashboard = async () => {
    setMemberLoading(true);
    try {
      const [eventsRes, announcementsRes] = await Promise.all([api.getEvents(), api.getAnnouncements()]);

      if (eventsRes.data?.success) {
        setMemberEvents(eventsRes.data.events || []);
      }

      if (announcementsRes.data?.success) {
        const list = announcementsRes.data.announcements || [];
        setMemberAnnouncements(list);

        // Notify member about new announcements they haven't been alerted of yet
        const notifiedKey = `psits_notified_announcements_${user?.id ?? 'guest'}`;
        const notifiedRaw = localStorage.getItem(notifiedKey);
        const notifiedIds = notifiedRaw ? (JSON.parse(notifiedRaw) as string[]) : [];
        const updatedIds = [...notifiedIds];
        let hasNew = false;

        list.forEach((ann: any) => {
          const annId = String(ann.id);
          if (!notifiedIds.includes(annId)) {
            addNotification({
              userId: String(user?.id ?? 'guest'),
              title: 'New Announcement',
              message: `New announcement: "${ann.title}"`,
              type: 'info',
              isRead: false,
            });
            updatedIds.push(annId);
            hasNew = true;
          }
        });

        if (hasNew) {
          localStorage.setItem(notifiedKey, JSON.stringify(updatedIds));
        }
      }
    } catch {
      // keep member dashboard usable on partial failures
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    if (user.role === 'member') {
      void loadMemberDashboard();
      return;
    }

    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const handleApprove = async (memberId: string) => {
    if (!canManageMembers) return;
    setApprovingId(memberId);
    try {
      const { data } = await api.updateMember(memberId, { status: 'active' });
      addNotification({
        userId: 'current',
        title: 'Member Approved',
        message: data?.notification?.emailSent
          ? 'Member account is now active. Approval email sent.'
          : 'Member account is now active. Email was not sent (SMTP not configured).',
        type: 'success',
        isRead: false,
      });
      await loadReport();
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to approve member.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const upcomingEvents = useMemo(() => {
    return [...memberEvents]
      .filter((event) => event.status === 'upcoming' || event.status === 'ongoing')
      .sort((a, b) => {
        const aDate = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
        const bDate = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
        return aDate - bDate;
      })
      .slice(0, 6);
  }, [memberEvents]);

  const latestAnnouncements = useMemo(() => {
    return [...memberAnnouncements].slice(0, 6);
  }, [memberAnnouncements]);

  if (!user) return null;

  const formatDate = (dateValue: string) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (user.role === 'member') {
    const expiryDate = user.membershipExpiresAt ? new Date(user.membershipExpiresAt) : null;
    const daysLeft = expiryDate && !Number.isNaN(expiryDate.getTime())
      ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <MainLayout>
        <div className="space-y-6">
          {daysLeft !== null && daysLeft < 0 && (
            <div className="bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 p-4 rounded-xl shadow-xs animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Megaphone className="h-5 w-5 text-red-500" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Membership Expired</h3>
                  <div className="mt-1 text-xs sm:text-sm text-red-700 dark:text-red-300">
                    <p>
                      Your membership has expired. Your account is restricted. Please go to the Payments page to renew and regain full access.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {daysLeft !== null && daysLeft >= 0 && daysLeft <= 90 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 p-4 rounded-xl shadow-xs animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Clock className="h-5 w-5 text-amber-500" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Renewal Notice</h3>
                  <div className="mt-1 text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                    <p>
                      Your membership will expire in {daysLeft} days (on {expiryDate?.toLocaleDateString()}). Please renew soon to maintain access.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Member Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-xl shadow-blue-600/20 p-6 sm:p-8 animate-fade-in">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-mono font-bold uppercase tracking-wider mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" /> Student Portal
                </span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Welcome, {getUserDisplayName(user)}</h1>
                {user.memberType === 'institution' && (user.representativeName || (user.sectorDetails && user.fullName && user.fullName !== user.sectorDetails)) && (
                  <p className="text-xs sm:text-sm font-semibold text-cyan-200 mt-1">
                    Representative: {user.representativeName || user.fullName}
                  </p>
                )}
                <p className="mt-1 text-blue-100 text-xs sm:text-sm max-w-xl">
                  Stay updated with your registered events, live announcements, and fast-track actions.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => navigate('/events')} className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                  <CalendarDays size={15} /> Browse Events
                </Button>
                <Button variant="gold" size="sm" onClick={() => navigate('/payments')}>
                  <DollarSign size={15} /> Pay Fee
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <Card className="p-5 flex items-center gap-4 border-l-4 border-l-cyan-500 shadow-card hover:shadow-glow-cyan transition-all">
              <div className="p-3 bg-cyan-50 dark:bg-cyan-950/50 rounded-2xl text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800">
                <Users size={22} />
              </div>
              <div>
                <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Account Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={user.status === 'active' ? 'cyber' : user.status === 'pending' ? 'warning' : 'error'} dot={true}>
                    {user.status || (user.isActive ? 'active' : 'pending')}
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 border-l-4 border-l-blue-500 shadow-card hover:shadow-card-md transition-all">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                <CalendarDays size={22} />
              </div>
              <div>
                <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Service Period</p>
                <p className="mt-1 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {user.membershipStartedAt ? formatDate(user.membershipStartedAt) : 'N/A'} - {expiryDate ? formatDate(expiryDate.toISOString()) : 'N/A'}
                </p>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 border-l-4 border-l-emerald-500 shadow-card hover:shadow-card-md transition-all">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Days Remaining</p>
                <p className={`mt-1 font-bold text-sm ${daysLeft !== null && daysLeft < 30 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {daysLeft !== null ? (daysLeft >= 0 ? `${daysLeft} days` : 'Expired') : 'N/A'}
                </p>
              </div>
            </Card>
          </div>

          {/* Institution Event Attendance & Registration Leaderboard */}
          <InstitutionEventLeaderboard />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Upcoming Events" subtitle="Your next activities and schedules">
              <div className="space-y-3">
                {memberLoading && <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Loading events...</p>}
                {!memberLoading && upcomingEvents.length === 0 && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium py-4 text-center">No upcoming events yet.</p>
                )}
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="border border-gray-200/80 dark:border-slate-800 rounded-2xl p-4 hover:border-cyan-500/30 transition-all bg-white dark:bg-[#0B1326]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{event.title}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1 flex items-center gap-1.5">
                          <CalendarDays size={13} className="text-cyan-500" />
                          {formatDate(event.date)}{event.time ? ` at ${event.time}` : ''}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate mt-0.5">{event.location || 'TBA'}</p>
                      </div>
                      <Badge variant={event.status === 'ongoing' ? 'cyber' : 'primary'} dot={true} className="shrink-0">
                        {event.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Announcements List" subtitle="Latest system updates for members">
              <div className="space-y-3">
                {memberLoading && <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Loading announcements...</p>}
                {!memberLoading && latestAnnouncements.length === 0 && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium py-4 text-center">No announcements available.</p>
                )}
                {latestAnnouncements.map((announcement) => (
                  <div key={announcement.id} className="border border-gray-200/80 dark:border-slate-800 rounded-2xl p-4 hover:border-blue-500/30 transition-all bg-white dark:bg-[#0B1326]">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5">
                        <Megaphone size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{announcement.title}</p>
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-medium shrink-0">{formatDate(announcement.date)}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">{announcement.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="Quick Links" subtitle="Go directly to common member actions">
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${user.memberType === 'institution' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-3`}>
              {user.memberType === 'institution' && (
                <Button variant="outline" onClick={() => navigate('/institution-members')} className="justify-between">
                  <span className="flex items-center gap-2"><CheckCircle size={16} /> Institution Members</span>
                  <ArrowRight size={16} />
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/events')} className="justify-between">
                <span className="flex items-center gap-2"><CalendarDays size={16} /> Events</span>
                <ArrowRight size={16} />
              </Button>
              <Button variant="outline" onClick={() => navigate('/announcements')} className="justify-between">
                <span className="flex items-center gap-2"><Megaphone size={16} /> Announcements</span>
                <ArrowRight size={16} />
              </Button>
              <Button variant="outline" onClick={() => navigate('/payments')} className="justify-between">
                <span className="flex items-center gap-2"><ExternalLink size={16} /> Payments</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const summary = report?.summary;
  const stats = [
    {
      label: 'Total Members',
      value: String(summary?.totalMembers ?? 0),
      subtitle: `${summary?.activeMembers ?? 0} active members`,
      tag: 'SYS.OK',
      icon: Users,
      iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border border-blue-100 dark:border-blue-900',
    },
    {
      label: 'Active Tech Events',
      value: String(summary?.activeEvents ?? 0),
      subtitle: 'Scheduled & ongoing',
      tag: 'LIVE',
      icon: Calendar,
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900',
    },
    {
      label: 'Total Revenue',
      value: `PHP ${(summary?.totalRevenue ?? 0).toLocaleString()}`,
      subtitle: 'Verified collections',
      tag: 'FINANCE',
      icon: DollarSign,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900',
    },
    {
      label: 'Pending Approvals',
      value: String(summary?.pendingApprovals ?? 0),
      subtitle: 'Requires officer review',
      tag: 'QUEUE',
      icon: Clock,
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900',
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Admin/Officer Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-900 to-[#060E20] text-white shadow-xl shadow-blue-900/20 p-8 sm:p-10 animate-fade-in border border-blue-700/40">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 left-10 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-mono text-[11px] text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>GOVERNANCE PORTAL • REGION XII</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Welcome back, {getUserDisplayName(user)}!
              </h1>
              <p className="text-blue-100 text-sm sm:text-base max-w-2xl leading-relaxed">
                Here is your organizational telemetry for today. Monitor member growth, approve registrations, and manage regional IT summits.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="cyber" size="sm" onClick={() => navigate('/members')}>
                <Users size={16} /> Manage Members
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/events')} className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                <Calendar size={16} /> Add Event
              </Button>
            </div>
          </div>
        </div>

        {/* 4 Telemetry Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-5 sm:p-6 transition-all hover:-translate-y-1 hover:shadow-card-elevated hover:border-cyan-500/40 group">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{stat.value}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {isLoading ? 'Refreshing...' : stat.subtitle}
                    </p>
                  </div>
                  <div className={`p-3 rounded-2xl ${stat.iconBg} shadow-sm group-hover:scale-110 transition-transform`}>
                    <Icon size={22} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Institution Event Attendance & Registration Leaderboard */}
        <InstitutionEventLeaderboard />

        {canManageMembers && (
          <Card
            title="Pending Registrations"
            subtitle="Review and approve new collegiate members"
            headerAction={
              report?.pendingMembers?.length ? (
                <Button variant="outline" size="xs" onClick={() => navigate('/members')}>
                  View All ({report.pendingMembers.length})
                </Button>
              ) : null
            }
          >
            {report?.pendingMembers?.length ? (
              <div className="space-y-3">
                {report.pendingMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-4 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 hover:border-cyan-500/30 transition-all bg-white dark:bg-[#0B1326]">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{m.fullName}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate">{m.email}</p>
                      <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-medium mt-1">{m.sector} • {m.memberType || 'member'} • {m.status}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => setConfirmApprove({ id: m.id, name: m.fullName || m.email })}
                        disabled={approvingId === m.id}
                      >
                        <CheckCircle size={15} /> Approve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate('/members')}>View</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 dark:text-slate-400 font-medium text-center py-8 text-sm">No pending registrations requiring review.</p>
            )}
          </Card>
        )}

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Monthly Member Growth" subtitle="Registrations over last 6 months">
            <div className="overflow-x-auto pt-2">
              <div className="min-w-[400px]">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={report?.memberGrowth || []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="#94A3B8" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(11, 19, 38, 0.9)',
                        borderRadius: '12px',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="members" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} name="New Registrations" />
                    <Line type="monotone" dataKey="active" stroke="#06B6D4" strokeWidth={3} dot={{ r: 4 }} name="Approved Active" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card title="Revenue Distribution" subtitle="Payment methods breakdown">
            <div className="overflow-x-auto pt-2">
              <div className="min-w-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={report?.revenueByMethod || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      labelLine={false}
                      label={({ name, value }: { name: string; value: number }) => `${name}: ₱${value.toLocaleString()}`}
                      dataKey="value"
                    >
                      {(report?.revenueByMethod || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(11, 19, 38, 0.9)',
                        borderRadius: '12px',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <VerifyActionModal
        isOpen={!!confirmApprove}
        title="Approve Member"
        message={`Approve ${confirmApprove?.name}? This will activate the member account and send login details.`}
        confirmLabel="Accept & Activate"
        confirmVariant="primary"
        onCancel={() => {
          if (approvingId) return;
          setConfirmApprove(null);
        }}
        onVerified={async () => {
          if (!confirmApprove) return;
          await handleApprove(confirmApprove.id);
          setConfirmApprove(null);
        }}
      />
    </MainLayout>
  );
};


