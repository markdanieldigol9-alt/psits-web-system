import { useEffect, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Button, Card } from '@/shared/components/Form';
import { useAuth } from '@/shared/context/AuthContext';
import api from '@/shared/services/api';
import { Modal } from '@/shared/components/Common';
import {
  FileDown,
  FileSpreadsheet,
  Printer,
  Users,
  CalendarCheck2,
  Wallet,
  CheckCircle2,
  TrendingUp,
  Calendar,
  ClipboardList,
  BadgeDollarSign,
  BarChart3,
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
} from 'recharts';

const reportCards = [
  {
    title: 'Membership Growth',
    description: 'Track member sign-ups and growth trend by month.',
    icon: Users,
  },
  {
    title: 'Event Participation',
    description: 'View participation counts per event.',
    icon: CalendarCheck2,
  },
  {
    title: 'Financial Summary',
    description: 'Review total collections, approved payments, and balances.',
    icon: Wallet,
  },
  {
    title: 'Complete Event',
    description: 'List and summarize all completed events and outcomes.',
    icon: CheckCircle2,
  },
  {
    title: 'Revenue by Method',
    description: 'Analyze verified revenue grouped by payment method.',
    icon: TrendingUp,
  },
];

const industryCapabilities = [
  {
    title: 'Event Management',
    description: 'Showcase how the platform organizes events, schedules activities, and supports structured registrations.',
    icon: Calendar,
  },
  {
    title: 'Session Tracking',
    description: 'Track workshops, forums, and partner-led activities.',
    icon: ClipboardList,
  },
  {
    title: 'Member Organization',
    description: 'Present how member profiles and participation records are managed in one connected system.',
    icon: Users,
  },
  {
    title: 'Payment History',
    description: 'Make payment records, verification flow, and transaction visibility clear for sponsors and collaborators.',
    icon: BadgeDollarSign,
  },
  {
    title: 'Reports & Insights',
    description: 'Summarize growth, participation, and revenue data that industry partners can review quickly.',
    icon: BarChart3,
  },
];

export const ReportsPage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [previewReport, setPreviewReport] = useState<string | null>(null);
  const isIndustryMember = user?.role === 'member' && user?.memberType === 'industry';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.getReports('dashboard');
        if (!cancelled && data?.success) setReport(data);
      } catch {
        // keep UI usable even if report fails
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const memberGrowth = (report?.memberGrowth || []).map((row: any) => ({
    month: row.month,
    members: Number(row.members || 0),
    active: Number(row.active || 0),
  }));

  const revenueData = (report?.revenueByMethod || []).map((row: any) => ({
    month: row.name,
    value: Number(row.value || 0),
  }));

  return (
    <MainLayout>
      <div className="space-y-6 pb-4">
        {isIndustryMember && (
          <Card className="overflow-hidden">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Industry View
                </div>
                <h1 className="text-3xl font-bold text-gray-900">PSITS Hub System Overview</h1>
                <p className="max-w-3xl text-sm text-gray-600 sm:text-base">
                  This interface makes the platform&apos;s core value visible for industry partners: event management,
                  attendance tracking, member organization, payment history, and reports in one connected system.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {industryCapabilities.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-blue-50/60 p-4">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-primary">
                        <Icon size={20} />
                      </div>
                      <h2 className="text-base font-semibold text-gray-900">{item.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        <Card title="Reports">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reportCards.map((report) => {
              const Icon = report.icon;
              return (
                <div key={report.title} className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-primary/40 hover:bg-blue-50/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-gray-900">{report.title}</h3>
                      <p className="text-sm text-gray-600">{report.description}</p>
                    </div>
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => setPreviewReport(report.title)}>
                      View
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setPreviewReport(report.title)}>
                      Generate
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {isLoading && (
          <Card>
            <div className="text-sm text-gray-600">Loading report data...</div>
          </Card>
        )}

        <Card title="Export">
          <div className="flex flex-wrap gap-3">
            <Button className="min-w-[140px]">
              <FileDown size={16} />
              PDF
            </Button>
            <Button variant="success" className="min-w-[140px]">
              <FileSpreadsheet size={16} />
              Excel
            </Button>
            <Button variant="secondary" className="min-w-[140px]">
              <Printer size={16} />
              Print
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Membership Growth" subtitle="Last 6 months" className="h-[350px]">
            <div className="h-[255px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={memberGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="members" stroke="#003D82" strokeWidth={3} name="New Registrations" />
                  <Line type="monotone" dataKey="active" stroke="#10B981" strokeWidth={3} name="Approved" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Revenue by Method" subtitle="Verified payments" className="h-[350px]">
            <div className="h-[255px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={!!previewReport}
        onClose={() => setPreviewReport(null)}
        title={previewReport ? `${previewReport} Preview` : 'Report Preview'}
        size="lg"
      >
        <div className="space-y-4">
          {previewReport === 'Membership Growth' && (
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={memberGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="members" stroke="#003D82" strokeWidth={3} name="New Registrations" />
                  <Line type="monotone" dataKey="active" stroke="#10B981" strokeWidth={3} name="Approved" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {previewReport === 'Revenue by Method' && (
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {previewReport !== 'Membership Growth' && previewReport !== 'Revenue by Method' && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Preview is based on the current dashboard dataset. Additional detailed reports can be added as separate endpoints under `GET /api/reports/*`.
            </div>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
};
