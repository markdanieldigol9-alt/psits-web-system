import { useEffect, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Button, Card } from '@/shared/components/Form';

import api from '@/shared/services/api';
import { Modal } from '@/shared/components/Common';
import { exportToCSV } from '@/shared/utils/export';
import {
  FileDown,
  FileSpreadsheet,
  Printer,
  Users,
  CalendarCheck2,
  Wallet,
  CheckCircle2,
  TrendingUp,
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


export const ReportsPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [previewReport, setPreviewReport] = useState<string | null>(null);


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

  const handleGenerateExcel = async (title: string) => {
    setIsLoading(true);
    try {
      if (title === 'Membership Growth') {
        const dataToExport = memberGrowth.map((row: any) => ({
          Month: row.month,
          'New Registrations': row.members,
          'Approved Members': row.active,
        }));
        exportToCSV('Membership_Growth_Report', dataToExport);
      } else if (title === 'Event Participation') {
        const { data } = await api.getEvents();
        const events = data?.events || [];
        const dataToExport = events.map((ev: any) => ({
          'Event Title': ev.title,
          'Category': ev.category,
          'Status': ev.status,
          'Capacity': ev.capacity || 'Unlimited',
          'Participants Count': ev.participantsCount || 0,
          'Start Date': ev.startDate,
          'End Date': ev.endDate,
        }));
        exportToCSV('Event_Participation_Report', dataToExport);
      } else if (title === 'Financial Summary') {
        const { data } = await api.getPayments();
        const payments = data?.payments || [];
        const dataToExport = payments.map((p: any) => ({
          'Payment ID': p.id,
          'Member Name': p.memberName || p.fullName || p.userFullName || '—',
          'Email': p.email || p.userEmail || '—',
          'Amount': p.amount,
          'Method': p.method,
          'Status': p.status,
          'Reference No': p.referenceNo || p.referenceNumber || '—',
          'Payment Date': p.createdAt || p.paymentDate || '—',
        }));
        exportToCSV('Financial_Summary_Report', dataToExport);
      } else if (title === 'Complete Event') {
        const { data } = await api.getEvents();
        const completed = (data?.events || []).filter((ev: any) => ev.status === 'completed' || ev.status === 'closed');
        const dataToExport = completed.map((ev: any) => ({
          'Event Title': ev.title,
          'Category': ev.category,
          'Capacity': ev.capacity || 'Unlimited',
          'Participants Count': ev.participantsCount || 0,
          'Start Date': ev.startDate,
          'End Date': ev.endDate,
          'Description': ev.description || '—',
        }));
        exportToCSV('Completed_Events_Report', dataToExport);
      } else if (title === 'Revenue by Method') {
        const dataToExport = revenueData.map((row: any) => ({
          'Payment Method': row.month,
          'Verified Revenue': row.value,
        }));
        exportToCSV('Revenue_By_Method_Report', dataToExport);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportAllToExcel = () => {
    if (!report) return;
    const summaryData = [
      { Metric: 'Total Members', Value: report.summary?.totalMembers || 0 },
      { Metric: 'Active Members', Value: report.summary?.activeMembers || 0 },
      { Metric: 'Pending Approvals', Value: report.summary?.pendingApprovals || 0 },
      { Metric: 'Active Events', Value: report.summary?.activeEvents || 0 },
      { Metric: 'Total Verified Revenue', Value: report.summary?.totalRevenue || 0 },
    ];
    exportToCSV('Dashboard_Summary_Report', summaryData);
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-4">

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
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => void handleGenerateExcel(report.title)}
                      isLoading={isLoading}
                    >
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
            <Button variant="success" className="min-w-[140px]" onClick={handleExportAllToExcel} disabled={!report || isLoading}>
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
