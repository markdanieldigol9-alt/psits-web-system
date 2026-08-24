import { useEffect, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Button, Card, Input, Select } from '@/shared/components/Form';

import api from '@/shared/services/api';
import { Modal } from '@/shared/components/Common';
import { exportToCSV } from '@/shared/utils/export';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import logo from '@/assets/image/PSITS_Logo.png';
import {
  FileDown,
  FileSpreadsheet,
  Printer,
  Users,
  CalendarCheck2,
  Wallet,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Filter,
  Eye,
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
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [previewReport, setPreviewReport] = useState<string | null>(null);

  // Wizard Modal State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'this_month' | 'last_30_days' | 'custom'>('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [detailedRecords, setDetailedRecords] = useState<any[]>([]);

  const [elections, setElections] = useState<any[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [electionReportData, setElectionReportData] = useState<any | null>(null);
  const [partnerReportData, setPartnerReportData] = useState<any | null>(null);

  const openReportWizard = async (title: string, step: 1 | 2 = 1) => {
    setWizardStep(step);
    setPreviewReport(title);
    setIsLoading(true);

    try {
      if (title === 'Membership Growth') {
        const { data } = await api.getMembers();
        setDetailedRecords(data?.members || []);
      } else if (title === 'Event Participation' || title === 'Complete Event') {
        const { data } = await api.getEvents();
        setDetailedRecords(data?.events || []);
      } else if (title === 'Financial Summary' || title === 'Revenue by Method') {
        const { data } = await api.getPayments();
        setDetailedRecords(data?.payments || []);
      } else if (title === 'Partner Contributions') {
        const { data } = await api.getPartnerContributionsReport();
        if (data?.success) setPartnerReportData(data);
        setDetailedRecords(data?.contributions || []);
      } else if (title === 'Election Tally') {
        if (selectedElectionId) {
          const { data } = await api.getElectionReport(selectedElectionId);
          if (data?.success) setElectionReportData(data);
        }
      }
    } catch {
      // keep UI functional
    } finally {
      setIsLoading(false);
    }
  };


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
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => void openReportWizard(report.title, 2)}>
                      <Eye size={14} /> View
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full"
                      onClick={() => void openReportWizard(report.title, 1)}
                    >
                      <Sparkles size={14} /> Generate
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

      {/* STEP-BY-STEP REPORT WIZARD & PREVIEW MODAL */}
      <Modal
        isOpen={!!previewReport}
        onClose={() => setPreviewReport(null)}
        title={previewReport ? `${previewReport} - Step ${wizardStep} of 3` : 'Report Wizard'}
        size="lg"
      >
        <div className="space-y-5">
          {/* Print Optimization Style Tag */}
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #printable-report-area, #printable-report-area * { visibility: visible; }
              #printable-report-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white;
                color: black;
                padding: 24px;
              }
            }
          `}</style>

          {/* Wizard Step Navigation Indicator */}
          <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1.5 rounded-xl text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => setWizardStep(1)}
              className={`py-2 rounded-lg transition-all ${
                wizardStep === 1 ? 'bg-white text-primary shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              1. ⚙️ Parameters & Filters
            </button>
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              className={`py-2 rounded-lg transition-all ${
                wizardStep === 2 ? 'bg-white text-primary shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              2. 👁️ Detailed Document Preview
            </button>
            <button
              type="button"
              onClick={() => setWizardStep(3)}
              className={`py-2 rounded-lg transition-all ${
                wizardStep === 3 ? 'bg-white text-primary shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              3. 🖨️ Export & Submit
            </button>
          </div>

          {/* STEP 1: CONFIGURE PARAMETERS & FILTERS */}
          {wizardStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-1">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Filter size={16} className="text-primary" /> Filter & Configure Report Details
                </h4>
                <p className="text-xs text-gray-600">
                  Select date range and parameters before generating the official detailed preview document.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Date Range Filter"
                  options={[
                    { value: 'all', label: 'All Time Records' },
                    { value: 'this_month', label: 'This Month' },
                    { value: 'last_30_days', label: 'Last 30 Days' },
                    { value: 'custom', label: 'Custom Date Range' },
                  ]}
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter((e.target as HTMLSelectElement).value as any)}
                />

                {previewReport === 'Election Tally' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Election *</label>
                    <select
                      value={selectedElectionId}
                      onChange={(e) => setSelectedElectionId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {elections.map((el) => (
                        <option key={el.id} value={el.id}>{el.title} ({el.status})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {dateRangeFilter === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border">
                  <Input label="Start Date" type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} />
                  <Input label="End Date" type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} />
                </div>
              )}

              <div className="border-t border-gray-200 pt-4 flex justify-end">
                <Button variant="primary" size="lg" onClick={() => setWizardStep(2)} className="px-6">
                  Preview Detailed Report <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: INTERACTIVE DETAILED DOCUMENT PREVIEW */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div id="printable-report-area" className="bg-white border border-gray-300 rounded-xl p-6 shadow-xs text-gray-900 space-y-6">
                {/* Official Letterhead Header */}
                <div className="flex items-center justify-between border-b-2 border-primary/80 pb-4">
                  <div className="flex items-center gap-3">
                    <img src={logo} alt="PSITS Logo" className="h-12 w-12 object-contain" />
                    <div>
                      <h2 className="text-xl font-extrabold text-primary tracking-tight">PSITS REGIONAL ORGANIZATION</h2>
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Official Executive & Operations Report</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500 space-y-0.5">
                    <p><strong>Report:</strong> {previewReport}</p>
                    <p><strong>Generated Date:</strong> {new Date().toLocaleString()}</p>
                    <p><strong>Prepared By:</strong> {user?.fullName || 'Administrator'}</p>
                  </div>
                </div>

                {/* Report Specific Details */}
                {previewReport === 'Membership Growth' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                        <span className="text-xs text-gray-500 font-semibold">Total Members</span>
                        <p className="text-2xl font-bold text-primary mt-1">{report?.summary?.totalMembers || detailedRecords.length}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                        <span className="text-xs text-gray-500 font-semibold">Approved Members</span>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">{report?.summary?.activeMembers || 0}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                        <span className="text-xs text-gray-500 font-semibold">Pending Approvals</span>
                        <p className="text-2xl font-bold text-amber-700 mt-1">{report?.summary?.pendingApprovals || 0}</p>
                      </div>
                    </div>

                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={memberGrowth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="members" stroke="#003D82" strokeWidth={3} name="Signups" />
                          <Line type="monotone" dataKey="active" stroke="#10B981" strokeWidth={3} name="Approved" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="border rounded-xl overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold">Month</th>
                            <th className="px-3 py-2 text-right font-bold">New Registrations</th>
                            <th className="px-3 py-2 text-right font-bold">Approved</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {memberGrowth.map((row: any) => (
                            <tr key={row.month}>
                              <td className="px-3 py-2 font-medium">{row.month}</td>
                              <td className="px-3 py-2 text-right">{row.members}</td>
                              <td className="px-3 py-2 text-right text-emerald-700 font-bold">{row.active}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {previewReport === 'Financial Summary' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                        <span className="text-xs text-gray-500 font-semibold">Total Verified Collections</span>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">₱{Number(report?.summary?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                        <span className="text-xs text-gray-500 font-semibold">Transactions Logged</span>
                        <p className="text-2xl font-bold text-primary mt-1">{detailedRecords.length} records</p>
                      </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold">Member</th>
                            <th className="px-3 py-2 text-left font-bold">Method</th>
                            <th className="px-3 py-2 text-left font-bold">Ref No</th>
                            <th className="px-3 py-2 text-right font-bold">Amount (₱)</th>
                            <th className="px-3 py-2 text-center font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {detailedRecords.slice(0, 15).map((p: any) => (
                            <tr key={p.id}>
                              <td className="px-3 py-2 font-medium">{p.memberName || p.fullName || 'Member'}</td>
                              <td className="px-3 py-2 uppercase">{p.method}</td>
                              <td className="px-3 py-2 font-mono text-[11px]">{p.referenceNo || p.referenceNumber || '—'}</td>
                              <td className="px-3 py-2 text-right font-bold">₱{Number(p.amount || 0).toLocaleString()}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {previewReport === 'Election Tally' && (
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-bold text-purple-900">{electionReportData?.election?.title || 'Election Tally'}</h4>
                        <p className="text-xs text-purple-700">Status: <span className="font-bold uppercase">{electionReportData?.election?.status}</span></p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500 font-semibold">Total Votes Cast</span>
                        <p className="text-2xl font-extrabold text-purple-900">{electionReportData?.totalVotes || 0}</p>
                      </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold">Candidate Name</th>
                            <th className="px-3 py-2 text-left font-bold">Position</th>
                            <th className="px-3 py-2 text-right font-bold">Votes</th>
                            <th className="px-3 py-2 text-right font-bold">Share %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(electionReportData?.candidates || []).map((c: any) => {
                            const pct = electionReportData?.totalVotes > 0 ? ((c.votes_count / electionReportData.totalVotes) * 100).toFixed(1) : '0.0';
                            return (
                              <tr key={c.id}>
                                <td className="px-3 py-2 font-bold text-gray-900">{c.name}</td>
                                <td className="px-3 py-2 text-gray-600">{c.position}</td>
                                <td className="px-3 py-2 text-right font-extrabold text-primary">{c.votes_count}</td>
                                <td className="px-3 py-2 text-right font-semibold">{pct}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {previewReport === 'Partner Contributions' && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex justify-between items-center text-center">
                      <div>
                        <span className="text-xs font-semibold text-gray-500">Total Sponsorship Value</span>
                        <p className="text-2xl font-extrabold text-emerald-700">₱{(partnerReportData?.totalValue || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500">Total Deals</span>
                        <p className="text-2xl font-extrabold text-primary">{partnerReportData?.contributions?.length || 0}</p>
                      </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold">Partner</th>
                            <th className="px-3 py-2 text-left font-bold">Deal Title</th>
                            <th className="px-3 py-2 text-left font-bold">Type</th>
                            <th className="px-3 py-2 text-right font-bold">Value (₱)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(partnerReportData?.contributions || []).map((pc: any) => (
                            <tr key={pc.id}>
                              <td className="px-3 py-2 font-bold">{pc.partner_name}</td>
                              <td className="px-3 py-2">{pc.deal_title}</td>
                              <td className="px-3 py-2 capitalize">{pc.contribution_type}</td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-700">₱{Number(pc.value_amount || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {previewReport !== 'Membership Growth' && previewReport !== 'Financial Summary' && previewReport !== 'Election Tally' && previewReport !== 'Partner Contributions' && (
                  <div className="border rounded-xl p-4 text-xs space-y-2">
                    <h4 className="font-bold text-gray-900">{previewReport} Data Summary</h4>
                    <p className="text-gray-600">Total records compiled: {detailedRecords.length} entries.</p>
                  </div>
                )}

                {/* Signatures & Certification Section */}
                <div className="border-t border-gray-200 pt-6 grid grid-cols-2 gap-8 text-xs text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-800">Prepared & Verified By:</p>
                    <div className="mt-8 border-b border-gray-400 w-48"></div>
                    <p className="mt-1 font-bold text-gray-900">{user?.fullName || 'Authorized Administrator'}</p>
                    <p className="text-[11px] text-gray-500 capitalize">{user?.role || 'Officer'} / Reporter</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">Approved By Organization:</p>
                    <div className="mt-8 border-b border-gray-400 w-48 ml-auto"></div>
                    <p className="mt-1 font-bold text-gray-900">PSITS Regional Secretariat</p>
                    <p className="text-[11px] text-gray-500">Official Stamp & Date</p>
                  </div>
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(1)}>
                  <ChevronLeft size={16} /> Edit Parameters
                </Button>
                <Button variant="primary" size="lg" onClick={() => setWizardStep(3)} className="px-6">
                  Proceed to Export & Submit <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PRINT, EXPORT & SUBMIT */}
          {wizardStep === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600" /> Report Ready for Action
                </h4>
                <p className="text-xs text-emerald-700 mt-1">
                  You can now print this official document directly, export to PDF or Excel, or submit the record into system archives.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex flex-col items-center justify-center p-5 border-2 border-gray-200 hover:border-primary rounded-xl bg-white hover:bg-primary/5 transition-all text-center group cursor-pointer"
                >
                  <Printer size={28} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-gray-900">🖨️ Print Report</span>
                  <span className="text-xs text-gray-500 mt-0.5">Triggers print window</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateExcel(previewReport || '')}
                  className="flex flex-col items-center justify-center p-5 border-2 border-emerald-200 hover:border-emerald-500 rounded-xl bg-white hover:bg-emerald-50/50 transition-all text-center group cursor-pointer"
                >
                  <FileSpreadsheet size={28} className="text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-gray-900">📊 Export Excel</span>
                  <span className="text-xs text-gray-500 mt-0.5">Download CSV spreadsheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex flex-col items-center justify-center p-5 border-2 border-blue-200 hover:border-blue-500 rounded-xl bg-white hover:bg-blue-50/50 transition-all text-center group cursor-pointer"
                >
                  <FileDown size={28} className="text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-gray-900">📄 Save PDF</span>
                  <span className="text-xs text-gray-500 mt-0.5">Print-to-PDF format</span>
                </button>
              </div>

              <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(2)}>
                  <ChevronLeft size={16} /> Back to Preview
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    addNotification({
                      userId: 'current',
                      title: 'Report Submitted',
                      message: `${previewReport} report has been recorded and submitted.`,
                      type: 'success',
                      isRead: false,
                    });
                    setPreviewReport(null);
                  }}
                  className="px-6"
                >
                  <CheckCircle2 size={18} /> Submit & Record Report
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
};
