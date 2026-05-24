import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Badge } from '@/shared/components/Form';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
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

const colors = ['#003D82', '#FF6B6B', '#FFC300', '#10B981'];

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
        setMemberAnnouncements(announcementsRes.data.announcements || []);
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
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Megaphone className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Membership Expired</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      Your membership has expired. Your account is restricted. Please go to the Payments page to renew and regain full access.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {daysLeft !== null && daysLeft >= 0 && daysLeft <= 90 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Clock className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Renewal Notice</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Your membership will expire in {daysLeft} days (on {expiryDate?.toLocaleDateString()}). Please renew soon to maintain access.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100 p-6">
              <h1 className="text-3xl font-bold text-gray-900">Welcome, {user.fullName}</h1>
              <p className="mt-2 text-gray-700">
                Stay updated with your events, latest announcements, and quick actions.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-5 flex items-center gap-4 border-l-4 border-l-primary">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={user.status === 'active' ? 'success' : user.status === 'pending' ? 'warning' : 'error'}>
                    {user.status || (user.isActive ? 'active' : 'pending')}
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 border-l-4 border-l-blue-500">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <CalendarDays size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Service Period</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {user.membershipStartedAt ? formatDate(user.membershipStartedAt) : 'N/A'} - {expiryDate ? formatDate(expiryDate.toISOString()) : 'N/A'}
                </p>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 border-l-4 border-l-green-500">
              <div className="p-3 bg-green-50 rounded-xl text-green-600">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Days Remaining</p>
                <p className={`mt-1 font-semibold ${daysLeft !== null && daysLeft < 30 ? 'text-red-600' : 'text-green-600'}`}>
                  {daysLeft !== null ? (daysLeft >= 0 ? `${daysLeft} days` : 'Expired') : 'N/A'}
                </p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Upcoming Events" subtitle="Your next activities and schedules">
              <div className="space-y-3">
                {memberLoading && <p className="text-sm text-gray-500">Loading events...</p>}
                {!memberLoading && upcomingEvents.length === 0 && (
                  <p className="text-sm text-gray-600 py-2">No upcoming events yet.</p>
                )}
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{event.title}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDate(event.date)}{event.time ? ` at ${event.time}` : ''}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{event.location || 'TBA'}</p>
                      </div>
                      <Badge variant={event.status === 'ongoing' ? 'success' : 'info'} className="shrink-0">
                        {event.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Announcements List" subtitle="Latest system updates for members">
              <div className="space-y-3">
                {memberLoading && <p className="text-sm text-gray-500">Loading announcements...</p>}
                {!memberLoading && latestAnnouncements.length === 0 && (
                  <p className="text-sm text-gray-600 py-2">No announcements available.</p>
                )}
                {latestAnnouncements.map((announcement) => (
                  <div key={announcement.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Megaphone size={18} className="text-blue-700 mt-1 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{announcement.title}</p>
                        <p className="text-sm text-gray-500">{formatDate(announcement.date)}</p>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-2">{announcement.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="Quick Links" subtitle="Go directly to common member actions">
            <div className={`grid grid-cols-1 md:grid-cols-2 ${user.memberType === 'institution' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-3`}>
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
      icon: Users,
      color: 'bg-blue-100',
    },
    {
      label: 'Active Events',
      value: String(summary?.activeEvents ?? 0),
      icon: Calendar,
      color: 'bg-yellow-100',
    },
    {
      label: 'Total Revenue',
      value: `PHP ${(summary?.totalRevenue ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-green-100',
    },
    {
      label: 'Pending Approvals',
      value: String(summary?.pendingApprovals ?? 0),
      icon: Clock,
      color: 'bg-red-100',
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-blue-800 to-indigo-900 text-white shadow-xl shadow-primary/20 p-8 sm:p-10 mb-8 animate-fade-in">
          <div className="absolute top-0 -left-10 w-72 h-72 bg-white/10 rounded-full mix-blend-overlay filter blur-2xl animate-pulse-slow"></div>
          <div className="absolute -bottom-10 right-0 w-72 h-72 bg-secondary/30 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
          
          <div className="relative z-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Welcome back, {user.fullName}!
            </h1>
            <p className="mt-3 text-blue-100 text-lg max-w-2xl">
              Here's what's happening with your organization today. Monitor growth, approve members, and manage your community.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                    {isLoading && <p className="text-xs text-gray-400 mt-1">Updating...</p>}
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="text-gray-900" size={24} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {canManageMembers && (
          <Card title="Pending Registrations" subtitle="Approve new members">
            {report?.pendingMembers?.length ? (
              <div className="space-y-3">
                {report.pendingMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-4 border border-gray-200 rounded-lg p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{m.fullName}</p>
                      <p className="text-sm text-gray-600 truncate">{m.email}</p>
                      <p className="text-xs text-gray-500 mt-1">{m.sector} • {m.memberType || 'member'} • {m.status}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => setConfirmApprove({ id: m.id, name: m.fullName || m.email })}
                        disabled={approvingId === m.id}
                      >
                        <CheckCircle size={16} /> Approve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate('/members')}>View</Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => navigate('/members')}>View All Members</Button>
                </div>
              </div>
            ) : (
              <p className="text-gray-600 text-center py-6">No pending registrations.</p>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Member Growth" subtitle="Last 6 months">
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={report?.memberGrowth || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="members" stroke="#003D82" name="New Registrations" />
                    <Line type="monotone" dataKey="active" stroke="#10B981" name="Approved" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card title="Revenue by Payment Method">
            <div className="overflow-x-auto">
              <div className="min-w-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={report?.revenueByMethod || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }: { name: string; value: number }) => `${name} ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(report?.revenueByMethod || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Recent Activity">
          <div className="space-y-2">
            <p className="text-gray-600">Dashboard updates live from the database.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/members')}>Members</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/events')}>Events</Button>
            </div>
          </div>
        </Card>
      </div>

      <VerifyActionModal
        isOpen={!!confirmApprove}
        title="Approve Member"
        message={`Approve ${confirmApprove?.name}? This will activate the member account.`}
        confirmLabel="Accept"
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

