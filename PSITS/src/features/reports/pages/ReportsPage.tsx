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
  {
    title: 'Election Tally',
    description: 'View vote count tallies and winning candidates per election.',
    icon: CheckCircle2,
  },
  {
    title: 'Partner Contributions',
    description: 'Summarize partnership deal resource values and sponsorship funds.',
    icon: Wallet,
  },
];


export const ReportsPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [previewReport, setPreviewReport] = useState<string | null>(null);

  const [elections, setElections] = useState<any[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [electionReportData, setElectionReportData] = useState<any | null>(null);
  const [partnerReportData, setPartnerReportData] = useState<any | null>(null);


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

  useEffect(() => {
    const loadElections = async () => {
      try {
        const { data } = await api.getElections();
        if (data?.success) {
          setElections(data.elections || []);
          if (data.elections?.length > 0) {
            setSelectedElectionId(String(data.elections[0].id));
          }
        }
      } catch {
        // ignore
      }
    };
    void loadElections();
  }, []);

  useEffect(() => {
    if (previewReport === 'Election Tally' && selectedElectionId) {
      const fetchElectionReport = async () => {
        setIsLoading(true);
        try {
          const { data } = await api.getElectionReport(selectedElectionId);
          if (data?.success) {
            setElectionReportData(data);
          }
        } catch {
          // ignore
        } finally {
          setIsLoading(false);
        }
      };
      void fetchElectionReport();
    }
  }, [previewReport, selectedElectionId]);

  useEffect(() => {
    if (previewReport === 'Partner Contributions') {
      const fetchPartnerReport = async () => {
        setIsLoading(true);
        try {
          const { data } = await api.getPartnerContributionsReport();
          if (data?.success) {
            setPartnerReportData(data);
          }
        } catch {
          // ignore
        } finally {
          setIsLoading(false);
        }
      };
      void fetchPartnerReport();
    }
  }, [previewReport]);

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
      } else if (title === 'Election Tally') {
        if (!selectedElectionId) return;
        const { data } = await api.getElectionReport(selectedElectionId);
        if (data?.success) {
          const dataToExport = (data.candidates || []).map((c: any) => ({
            'Election Title': data.election?.title || '—',
            'Candidate Name': c.name,
            'Position': c.position,
            'Platform': c.platform || '—',
            'Status': c.status,
            'Votes Count': c.votes_count,
            'Total Votes Cast': data.totalVotes || 0,
          }));
          exportToCSV(`${data.election?.title || 'Election'}_Tally_Report`, dataToExport);
        }
      } else if (title === 'Partner Contributions') {
        const { data } = await api.getPartnerContributionsReport();
        if (data?.success) {
          const dataToExport = (data.contributions || []).map((pc: any) => ({
            'Partner Name': pc.partner_name,
            'Deal Title': pc.deal_title,
            'Contribution Type': pc.contribution_type,
            'Value Amount (PHP)': pc.value_amount,
            'Linked Event': pc.event_title || 'General Support',
            'Description': pc.description || '—',
            'Log Date': pc.created_at,
          }));
          exportToCSV('Partner_Contributions_Report', dataToExport);
        }
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

          {previewReport === 'Election Tally' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-gray-50 p-4 rounded-xl border border-gray-150">
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{electionReportData?.election?.title || 'Select Election'}</h4>
                  <p className="text-sm text-gray-500">Status: <span className="font-semibold capitalize text-primary">{electionReportData?.election?.status}</span></p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-500">Total Votes Cast</span>
                  <p className="text-2xl font-bold text-gray-900">{electionReportData?.totalVotes || 0}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">Election:</label>
                <select
                  value={selectedElectionId}
                  onChange={(e) => setSelectedElectionId(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {elections.map((el) => (
                    <option key={el.id} value={el.id}>{el.title} ({el.status})</option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Candidate</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Position</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Votes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {(electionReportData?.candidates || []).map((cand: any) => (
                      <tr key={cand.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{cand.name}</td>
                        <td className="px-4 py-3 text-gray-600">{cand.position}</td>
                        <td className="px-4 py-3 text-right font-semibold text-primary">{cand.votes_count}</td>
                      </tr>
                    ))}
                    {(!electionReportData?.candidates || electionReportData.candidates.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-400">No candidates registered.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {previewReport === 'Partner Contributions' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl text-center">
                  <span className="text-sm font-semibold text-primary">Total Sponsorship Value</span>
                  <p className="text-3xl font-extrabold text-primary mt-1">
                    ₱{(partnerReportData?.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                  <span className="text-sm font-semibold text-green-700">Logged Contributions</span>
                  <p className="text-3xl font-extrabold text-green-700 mt-1">
                    {partnerReportData?.contributions?.length || 0} Deals
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Summary By Type</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(partnerReportData?.summary || []).map((item: any) => (
                    <div key={item.contribution_type} className="bg-gray-50 border border-gray-150 p-3 rounded-lg text-center">
                      <span className="text-xs font-medium text-gray-500 capitalize">{item.contribution_type}</span>
                      <p className="text-sm font-bold text-gray-800 mt-1">₱{Number(item.total_value).toLocaleString()}</p>
                      <span className="text-[10px] text-gray-400">{item.count} items</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Partner</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Deal Title</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Value (PHP)</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Target Event</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {(partnerReportData?.contributions || []).map((pc: any) => (
                      <tr key={pc.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-medium text-gray-900">{pc.partner_name}</td>
                        <td className="px-3 py-2 text-gray-700">{pc.deal_title}</td>
                        <td className="px-3 py-2 text-gray-600 capitalize">{pc.contribution_type}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800">
                          ₱{Number(pc.value_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-gray-500 truncate max-w-[120px]">{pc.event_title || 'General Support'}</td>
                      </tr>
                    ))}
                    {(!partnerReportData?.contributions || partnerReportData.contributions.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-400">No contributions logged yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {previewReport !== 'Membership Growth' && previewReport !== 'Revenue by Method' && previewReport !== 'Election Tally' && previewReport !== 'Partner Contributions' && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Preview is based on the current dashboard dataset. Additional detailed reports can be added as separate endpoints under `GET /api/reports/*`.
            </div>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
};
