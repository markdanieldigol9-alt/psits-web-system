import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MainLayout } from '@/shared/layouts';
import { Button, Card, Input, Select } from '@/shared/components/Form';

import api from '@/shared/services/api';
import { Modal } from '@/shared/components/Common';
import { exportToCSV } from '@/shared/utils/export';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import logo from '@/assets/image/PSITS_Logo.png';
import { MemberDirectoryExportTable } from '../components/MemberDirectoryExportTable';
import { FinancialReportView } from '../components/FinancialReportView';
import { EventReportView } from '../components/EventReportView';
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
  ShieldCheck,
  ListFilter,
  LayoutGrid,
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
    title: 'Executive Summary',
    description: 'Consolidated master statement across membership, finance, events, and industry alliances.',
    icon: ShieldCheck,
  },
  {
    title: 'Membership Growth',
    description: 'Track member sign-ups and growth trend by month.',
    icon: Users,
  },
  {
    title: 'Member Directory & Roster',
    description: 'Filter, view, and export member list by individual, institution, industry, and institution name.',
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

  // Report Dropdown & View Mode State
  const [selectedReportTitle, setSelectedReportTitle] = useState<string>(reportCards[0].title);
  const [reportsViewMode, setReportsViewMode] = useState<'dropdown' | 'grid'>('dropdown');

  // Wizard Modal State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year' | 'custom'>('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [selectedMethodFocus, setSelectedMethodFocus] = useState<string>('all');
  const [detailedRecords, setDetailedRecords] = useState<any[]>([]);

  const [elections, setElections] = useState<any[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [electionReportData, setElectionReportData] = useState<any | null>(null);
  const [partnerReportData, setPartnerReportData] = useState<any | null>(null);

  // Unified Members Report State
  const [allMembersData, setAllMembersData] = useState<any[]>([]);
  const [institutionsList, setInstitutionsList] = useState<string[]>([]);
  const [isMemberListLoading, setIsMemberListLoading] = useState(false);
  const [memberCategoryFilter, setMemberCategoryFilter] = useState<'all' | 'individual' | 'institution' | 'industry'>('all');
  const [memberInstitutionFilter, setMemberInstitutionFilter] = useState<string>('all');

  // Event Participation Report State
  const [eventReportData, setEventReportData] = useState<{
    events: any[];
    participants: any[];
    institutions: string[];
    summary: any;
  } | null>(null);
  const [isEventReportLoading, setIsEventReportLoading] = useState(false);

  const loadEventReportData = async () => {
    setIsEventReportLoading(true);
    try {
      const { data } = await api.getEventParticipationReport();
      if (data?.success) {
        setEventReportData(data);
      }
    } catch {
      // fallback
    } finally {
      setIsEventReportLoading(false);
    }
  };

  const loadMembersData = async () => {
    setIsMemberListLoading(true);
    try {
      const { data } = await api.getAllMembersReport();
      if (data?.success) {
        setAllMembersData(data.members || []);
        setInstitutionsList(data.institutions || []);
      }
    } catch {
      try {
        const [membersRes, instRes] = await Promise.allSettled([
          api.getMembers(),
          api.getInstitutionMembers(),
        ]);
        const psitsList = membersRes.status === 'fulfilled' ? (membersRes.value.data?.members || []) : [];
        const instList = instRes.status === 'fulfilled' ? (instRes.value.data?.members || []) : [];
        const combined = [
          ...psitsList.map((m: any) => ({
            unique_id: `u-${m.id}`,
            raw_id: m.id,
            full_name: m.fullName || m.full_name,
            displayName: m.fullName || m.full_name || m.name || m.email,
            email: m.email,
            contact_number: m.contactNumber || m.contact_number,
            category: m.memberType === 'industry' ? 'industry' : (m.memberType === 'institution' ? 'institution' : 'individual'),
            institution_name: m.sectorDetails || m.institutionName || (m.memberType === 'institution' ? m.fullName : null),
            displaySector: m.sector || m.memberType || 'PSITS Individual',
            position: m.occupation || m.sector || m.memberType || 'Member',
            status: m.status,
            created_at: m.createdAt || m.joinDate,
            source: 'PSITS Member',
          })),
          ...instList.map((im: any) => ({
            unique_id: `im-${im.id}`,
            raw_id: im.id,
            full_name: im.fullName || im.full_name,
            displayName: im.full_name || im.fullName || im.email,
            email: im.email,
            contact_number: im.contactNumber || im.contact_number,
            category: 'institution',
            institution_name: im.institutionName || 'Institution Member',
            displaySector: im.institution_name || im.institution_full_name || 'Institution Member',
            position: im.position || 'Participant',
            status: im.status,
            created_at: im.createdAt || im.date,
            source: 'Institution Member',
          })),
        ];
        setAllMembersData(combined);
        const iSet = new Set<string>();
        combined.forEach((c) => { if (c.institution_name) iSet.add(c.institution_name); });
        setInstitutionsList(Array.from(iSet));
      } catch {
        // ignore
      }
    } finally {
      setIsMemberListLoading(false);
    }
  };

  useEffect(() => {
    void loadMembersData();
  }, []);

  const openReportWizard = async (title: string, step: 1 | 2 = 1) => {
    setWizardStep(step);
    setPreviewReport(title);
    try {
      setIsLoading(true);
      if (title === 'Membership Growth' || title === 'Member Directory & Roster') {
        try {
          const { data } = await api.getAllMembersReport();
          if (data?.success) {
            setAllMembersData(data.members || []);
            setInstitutionsList(data.institutions || []);
            setDetailedRecords(data.members || []);
          } else {
            throw new Error('Fallback needed');
          }
        } catch {
          const [membersRes, instRes] = await Promise.allSettled([
            api.getMembers(),
            api.getInstitutionMembers(),
          ]);
          const psitsList = membersRes.status === 'fulfilled' ? (membersRes.value.data?.members || []) : [];
          const instList = instRes.status === 'fulfilled' ? (instRes.value.data?.members || []) : [];
          const combined = [
            ...psitsList.map((m: any) => ({
              unique_id: `u-${m.id}`,
              raw_id: m.id,
              full_name: m.fullName || m.full_name,
              displayName: m.fullName || m.full_name || m.name || m.email,
              email: m.email,
              contact_number: m.contactNumber || m.contact_number,
              category: m.memberType === 'industry' ? 'industry' : (m.memberType === 'institution' ? 'institution' : 'individual'),
              institution_name: m.sectorDetails || m.institutionName || (m.memberType === 'institution' ? m.fullName : null),
              displaySector: m.sector || m.memberType || 'PSITS Individual',
              position: m.occupation || m.sector || m.memberType || 'Member',
              status: m.status,
              created_at: m.createdAt || m.joinDate,
              source: 'PSITS Member',
            })),
            ...instList.map((im: any) => ({
              unique_id: `im-${im.id}`,
              raw_id: im.id,
              full_name: im.fullName || im.full_name,
              displayName: im.full_name || im.fullName || im.email,
              email: im.email,
              contact_number: im.contactNumber || im.contact_number,
              category: 'institution',
              institution_name: im.institutionName || 'Institution Member',
              displaySector: im.institution_name || im.institution_full_name || 'Institution Member',
              position: im.position || 'Participant',
              status: im.status,
              created_at: im.createdAt || im.date,
              source: 'Institution Member',
            })),
          ];
          setAllMembersData(combined);
          setDetailedRecords(combined);
        }
      } else if (title === 'Event Participation') {
        try {
          const { data } = await api.getEventParticipationReport();
          if (data?.success) {
            setEventReportData(data);
            setDetailedRecords(data.events || []);
          } else {
            const { data: evData } = await api.getEvents();
            setDetailedRecords(evData?.events || []);
          }
        } catch {
          const { data: evData } = await api.getEvents();
          setDetailedRecords(evData?.events || []);
        }
      } else if (title === 'Complete Event') {
        try {
          const { data } = await api.getEventParticipationReport();
          if (data?.success) {
            setEventReportData(data);
            setDetailedRecords(data.events || []);
          } else {
            const { data: evData } = await api.getEvents();
            setDetailedRecords(evData?.events || []);
          }
        } catch {
          const { data: evData } = await api.getEvents();
          setDetailedRecords(evData?.events || []);
        }
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
    if (user?.role === 'member') return;
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
    void loadMembersData();
    void loadEventReportData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (previewReport === 'Event Participation') {
      void loadEventReportData();
    }
  }, [previewReport]);

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
      if (title === 'Membership Growth' || title === 'Member Directory & Roster') {
        const sourceList = allMembersData.length > 0 ? allMembersData : detailedRecords;
        if (sourceList.length > 0) {
          const filtered = sourceList.filter((m: any) => {
            if (memberCategoryFilter !== 'all') {
              const cat = (m.category || m.memberType || '').toLowerCase();
              if (memberCategoryFilter === 'individual' && cat !== 'individual' && cat !== 'student') return false;
              if (memberCategoryFilter === 'institution' && cat !== 'institution') return false;
              if (memberCategoryFilter === 'industry' && cat !== 'industry') return false;
            }
            if (memberInstitutionFilter !== 'all') {
              const inst = (m.institution_name || m.institutionName || m.sectorDetails || '').toLowerCase().trim();
              const target = memberInstitutionFilter.toLowerCase().trim();
              if (inst !== target && !inst.includes(target)) return false;
            }
            return true;
          });

          const dataToExport = filtered.map((m: any, idx: number) => ({
            '#': idx + 1,
            'Member ID': m.unique_id || m.raw_id || m.id || '—',
            'Full Name': m.full_name || m.fullName || m.displayName || '—',
            'Email Address': m.email || '—',
            'Contact Number': m.contact_number || m.contactNumber || '—',
            'Member Category': (m.category || m.memberType || 'individual').toUpperCase(),
            'Institution / Affiliation': m.institution_name || m.institutionName || m.sectorDetails || 'Individual',
            'Position / Role': m.position || m.occupation || 'Member',
            'Status': (m.status === 'active' || m.status === 'approved') ? 'Active / Approved' : (m.status || 'Pending'),
            'Registration Date': m.created_at ? new Date(m.created_at).toLocaleDateString() : '—',
          }));
          const suffix = memberInstitutionFilter !== 'all'
            ? `_${memberInstitutionFilter.replace(/[^a-zA-Z0-9_-]/g, '_')}`
            : (memberCategoryFilter !== 'all' ? `_${memberCategoryFilter}` : '');
          exportToCSV(`PSITS_Member_Directory${suffix}`, dataToExport);
        } else {
          const dataToExport = memberGrowth.map((row: any) => ({
            Month: row.month,
            'New Registrations (Combined)': row.members,
            'Approved Members (Combined)': row.active,
          }));
          exportToCSV('Membership_Growth_Report', dataToExport);
        }
      } else if (title === 'Event Participation') {
        let participants = eventReportData?.participants || [];
        let events = eventReportData?.events || [];
        if (participants.length === 0) {
          try {
            const { data } = await api.getEventParticipationReport();
            if (data?.success) {
              participants = data.participants || [];
              events = data.events || [];
            }
          } catch {
            // ignore
          }
        }

        if (participants.length > 0) {
          const dataToExport = participants.map((p: any, idx: number) => ({
            '#': idx + 1,
            'Participant Name': p.full_name || '—',
            'Event Title': p.event_title || '—',
            'Event Category': (p.event_category || '—').toUpperCase(),
            'Where They Belong (Institution / Affiliation)': p.institution_name || 'PSITS Individual Member',
            'Role / Position': p.position || 'Participant',
            'Email Address': p.email || '—',
            'Contact Number': p.contact_number || '—',
            'Registration Source': p.registration_source || 'Individual',
            'Registration Status': (p.registration_status || 'Pending').toUpperCase(),
            'In-Venue Attendance': p.is_checked_in ? 'PRESENT (CHECKED IN)' : 'NOT CHECKED IN',
            'Registration Date': p.registered_at ? new Date(p.registered_at).toLocaleString() : '—',
          }));
          exportToCSV(`PSITS_Event_Participants_Roster_${new Date().toISOString().slice(0, 10)}`, dataToExport);
        } else {
          const dataToExport = events.map((ev: any, idx: number) => ({
            '#': idx + 1,
            'Event Title': ev.title,
            'Category': (ev.category || 'Seminar').toUpperCase(),
            'Status': (ev.status || 'Draft').toUpperCase(),
            'Capacity': ev.capacity || 'Unlimited',
            'Total Participants': ev.total_participants || 0,
            'Direct Individual Registrations': ev.direct_registrations || 0,
            'Institution Registrations': ev.institution_registrations || 0,
            'Start Date': ev.start_at ? new Date(ev.start_at).toLocaleString() : '—',
            'End Date': ev.end_at ? new Date(ev.end_at).toLocaleString() : '—',
          }));
          exportToCSV(`PSITS_Events_Overview_Report_${new Date().toISOString().slice(0, 10)}`, dataToExport);
        }
      } else if (title === 'Financial Summary' || title === 'Revenue by Method') {
        const { data } = await api.getPayments();
        const payments = data?.payments || detailedRecords || [];
        const formatMethod = (m?: string) => {
          const raw = String(m || '').toLowerCase();
          if (raw.includes('gcash')) return 'GCash';
          if (raw.includes('bank') || raw.includes('card')) return 'Bank Transfer';
          if (raw.includes('officer') || raw.includes('cash')) return 'Through Officer (Official Receipt)';
          if (raw.includes('cheque')) return 'Cheque';
          if (raw.includes('paymaya')) return 'PayMaya';
          return m || 'Other';
        };
        const dataToExport = payments.map((p: any) => ({
          'Transaction ID': p.id,
          'Date & Time': p.createdAt || p.date || '—',
          'Payor Full Name': p.memberName || p.fullName || p.userFullName || '—',
          'Payor Email': p.memberEmail || p.email || p.userEmail || '—',
          'Payment Purpose': p.event || p.eventTitle || (p.paymentKind?.replace(/_/g, ' ') || 'General Fee'),
          'Revenue Stream': p.paymentKind || 'Standard Payment',
          'Payment Channel / Method': formatMethod(p.method || p.paymentMethod),
          'Reference / OR Number': p.referenceNumber || p.referenceNo || '—',
          'Gross Amount (PHP)': Number(p.amount || 0).toFixed(2),
          'Is Partial Payment': p.isPartial ? 'YES' : 'NO',
          'Remaining Balance (PHP)': p.remainingBalance ? Number(p.remainingBalance).toFixed(2) : '0.00',
          'Audit Verification Status': (p.status || p.paymentStatus || 'pending').toUpperCase(),
          'Proof Document Uploaded': p.proofUrl ? 'YES' : 'NO',
          'Verified By Officer ID': p.verifiedBy || '—',
          'Verified Date': p.verifiedAt || '—',
        }));
        exportToCSV(`${title.replace(/\s+/g, '_')}_Official_Audit_Report`, dataToExport);
      } else if (title === 'Complete Event') {
        const { data } = await api.getEvents();
        const completed = (data?.events || []).filter((ev: any) => ev.status === 'completed' || ev.status === 'closed');
        const dataToExport = completed.map((ev: any) => ({
          'Event ID': ev.id,
          'Event Title': ev.title,
          'Category / Type': ev.eventType || ev.category || 'General',
          'Status': 'COMPLETED',
          'Capacity': ev.capacity || 'Unlimited',
          'Registered Participants': ev.registrations || ev.participantsCount || 0,
          'Registration Fee (PHP)': Number(ev.fee || 0).toFixed(2),
          'Location': ev.location || '—',
          'Start Date': ev.startDate || ev.date || '—',
          'End Date': ev.endDate || '—',
          'Description': ev.description || '—',
        }));
        exportToCSV('Completed_Events_Report', dataToExport);
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


  if (user && user.role === 'member') {
    return <Navigate to="/unauthorized" replace />;
  }

  const selectedReportObj = reportCards.find((r) => r.title === selectedReportTitle) || reportCards[0];
  const SelectedReportIcon = selectedReportObj.icon;

  return (
    <MainLayout>
      <div className="space-y-6 pb-4">

        <Card
          title="Reports"
          subtitle="Select and generate organization reports, financial summaries, and event audits."
          headerAction={
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setReportsViewMode('dropdown')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                  reportsViewMode === 'dropdown'
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
                }`}
                title="Dropdown Selector View"
              >
                <ListFilter size={14} /> Dropdown
              </button>
              <button
                type="button"
                onClick={() => setReportsViewMode('grid')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                  reportsViewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid size={14} /> Grid
              </button>
            </div>
          }
        >
          {reportsViewMode === 'dropdown' ? (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4 p-4 md:p-5 bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/40 dark:from-slate-900/60 dark:via-slate-800/50 dark:to-indigo-950/20 rounded-xl border border-gray-200 dark:border-slate-700">
                <div className="flex-1 space-y-1.5">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Select Report
                  </label>
                  <div className="relative">
                    <select
                      value={selectedReportTitle}
                      onChange={(e) => setSelectedReportTitle(e.target.value)}
                      className="w-full text-base font-semibold py-2.5 pl-3.5 pr-10 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                    >
                      {reportCards.map((r) => (
                        <option key={r.title} value={r.title}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => void openReportWizard(selectedReportTitle, 2)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold"
                  >
                    <Eye size={16} /> View
                  </Button>
                  <Button
                    size="md"
                    variant="primary"
                    onClick={() => void openReportWizard(selectedReportTitle, 1)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold shadow-sm"
                  >
                    <Sparkles size={16} /> Generate
                  </Button>
                </div>
              </div>

              {selectedReportObj && (
                <div className="flex items-start gap-4 p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-gray-200/80 dark:border-slate-700 shadow-sm transition-all">
                  <div className="p-3 bg-blue-100 dark:bg-blue-950/60 text-primary dark:text-cyan-400 rounded-xl shrink-0">
                    <SelectedReportIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">
                        {selectedReportObj.title}
                      </h4>
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Official Report
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {selectedReportObj.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
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
          )}
        </Card>

        {(isLoading || isEventReportLoading) && (
          <Card>
            <div className="text-sm text-gray-600">Loading report data...</div>
          </Card>
        )}


        {/* Dedicated Members Export Table Section */}
        <MemberDirectoryExportTable
          members={allMembersData}
          institutions={institutionsList}
          isLoading={isMemberListLoading}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            title="Membership Growth"
            subtitle={
              report?.summary?.totalMembers
                ? `${report.summary.totalMembers} total members (${report.summary.psitsMembers ?? 12} PSITS + ${report.summary.institutionMembers ?? 37} Inst.) • Last 6 months`
                : 'Last 6 months'
            }
            className="h-[350px]"
          >
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
        size="2xl"
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
                    { value: 'all', label: '📅 All Time Records' },
                    { value: 'this_month', label: '📅 Current Month' },
                    { value: 'last_30_days', label: '📅 Last 30 Days' },
                    { value: 'this_quarter', label: '📅 Current Quarter' },
                    { value: 'this_year', label: '📅 Fiscal Year-to-Date (YTD)' },
                    { value: 'custom', label: '📅 Custom Date Range' },
                  ]}
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter((e.target as HTMLSelectElement).value as any)}
                />

                {(previewReport === 'Financial Summary' || previewReport === 'Revenue by Method') && (
                  <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Wallet size={15} className="text-emerald-700" />
                      Official Accounting & Audit Configuration
                    </p>
                    <p className="text-emerald-800 leading-relaxed">
                      Compiling statement for verified collections, payment channels (GCash, Bank Transfer, Through Officer, Cheque), and partial balance receivables.
                    </p>
                  </div>
                )}

                {previewReport === 'Revenue by Method' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Primary Payment Channel Focus</label>
                    <select
                      value={selectedMethodFocus}
                      onChange={(e) => setSelectedMethodFocus(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[10px] border border-gray-300 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white text-gray-900"
                    >
                      <option value="all">💳 All Payment Channels (Complete Reconciliation)</option>
                      <option value="GCash">📱 GCash E-Wallet</option>
                      <option value="Bank Transfer">🏛️ Bank Transfer / Deposit</option>
                      <option value="Through Officer (OR)">🏢 Through Officer (Official Receipt)</option>
                      <option value="Cheque">🧾 Cheque / Bank Draft</option>
                      <option value="PayMaya">💳 PayMaya</option>
                    </select>
                  </div>
                )}

                {(previewReport === 'Membership Growth' || previewReport === 'Member Directory & Roster') && (
                  <>
                    <Select
                      label="Member Category Filter"
                      options={[
                        { value: 'all', label: '👥 All Categories (Individual, Institution, Industry)' },
                        { value: 'individual', label: '👤 Individual Members' },
                        { value: 'institution', label: '🏛️ Institution Members' },
                        { value: 'industry', label: '💼 Industry Members' },
                      ]}
                      value={memberCategoryFilter}
                      onChange={(e) => setMemberCategoryFilter((e.target as HTMLSelectElement).value as any)}
                    />

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Filter by Institution Name</label>
                      <select
                        value={memberInstitutionFilter}
                        onChange={(e) => setMemberInstitutionFilter(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-[10px] border border-gray-300 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white text-gray-900"
                      >
                        <option value="all">🏛️ All Institutions ({institutionsList.length} registered)</option>
                        {institutionsList.map((inst) => (
                          <option key={inst} value={inst}>
                            {inst}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

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
                {/* Official Letterhead Header (for general reports) */}
                {previewReport !== 'Financial Summary' && previewReport !== 'Revenue by Method' && previewReport !== 'Event Participation' && previewReport !== 'Complete Event' && (
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
                )}

                {/* Report Specific Details */}
                {previewReport === 'Membership Growth' && (() => {
                  const psitsCount = report?.summary?.psitsMembers ?? detailedRecords.filter((r: any) => r.source === 'PSITS Member').length;
                  const instCount = report?.summary?.institutionMembers ?? detailedRecords.filter((r: any) => r.source === 'Institution Member').length;
                  const totalCount = report?.summary?.totalMembers ?? (psitsCount + instCount);

                  const activePsits = report?.summary?.activePsitsMembers ?? detailedRecords.filter((r: any) => r.source === 'PSITS Member' && (r.status === 'active' || r.status === 'approved')).length;
                  const activeInst = report?.summary?.activeInstitutionMembers ?? detailedRecords.filter((r: any) => r.source === 'Institution Member' && (r.status === 'active' || r.status === 'approved')).length;
                  const activeTotal = report?.summary?.activeMembers ?? (activePsits + activeInst);

                  const pendingPsits = report?.summary?.pendingPsitsMembers ?? detailedRecords.filter((r: any) => r.source === 'PSITS Member' && r.status === 'pending').length;
                  const pendingInst = report?.summary?.pendingInstitutionMembers ?? detailedRecords.filter((r: any) => r.source === 'Institution Member' && r.status === 'pending').length;
                  const pendingTotal = report?.summary?.pendingApprovals ?? (pendingPsits + pendingInst);

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-col justify-between">
                          <div>
                            <span className="text-xs text-gray-500 font-semibold">Total Members</span>
                            <p className="text-2xl font-bold text-primary mt-1">{totalCount}</p>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-blue-200/60 flex items-center justify-center gap-1.5 text-[11px] text-blue-700 font-medium flex-wrap">
                            <span className="bg-white/80 px-1.5 py-0.5 rounded shadow-2xs border border-blue-100">
                              {psitsCount} PSITS
                            </span>
                            <span>+</span>
                            <span className="bg-white/80 px-1.5 py-0.5 rounded shadow-2xs border border-blue-100">
                              {instCount} Institution
                            </span>
                          </div>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex flex-col justify-between">
                          <div>
                            <span className="text-xs text-gray-500 font-semibold">Approved Members</span>
                            <p className="text-2xl font-bold text-emerald-700 mt-1">{activeTotal}</p>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-emerald-200/60 flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 font-medium flex-wrap">
                            <span className="bg-white/80 px-1.5 py-0.5 rounded shadow-2xs border border-emerald-100">
                              {activePsits} PSITS
                            </span>
                            <span>+</span>
                            <span className="bg-white/80 px-1.5 py-0.5 rounded shadow-2xs border border-emerald-100">
                              {activeInst} Institution
                            </span>
                          </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex flex-col justify-between">
                          <div>
                            <span className="text-xs text-gray-500 font-semibold">Pending Approvals</span>
                            <p className="text-2xl font-bold text-amber-700 mt-1">{pendingTotal}</p>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-amber-200/60 flex items-center justify-center gap-1.5 text-[11px] text-amber-700 font-medium flex-wrap">
                            <span className="bg-white/80 px-1.5 py-0.5 rounded shadow-2xs border border-amber-100">
                              {pendingPsits} PSITS
                            </span>
                            <span>+</span>
                            <span className="bg-white/80 px-1.5 py-0.5 rounded shadow-2xs border border-amber-100">
                              {pendingInst} Institution
                            </span>
                          </div>
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

                      <div className="pt-2">
                        <MemberDirectoryExportTable
                          members={allMembersData.length > 0 ? allMembersData : detailedRecords}
                          institutions={institutionsList}
                          initialCategory={memberCategoryFilter}
                          initialInstitution={memberInstitutionFilter}
                          title="Combined Member Directory Table"
                          subtitle="Filter by Individual, Institution, Industry, and specific Institution Name"
                        />
                      </div>
                    </div>
                  );
                })()}

                {previewReport === 'Member Directory & Roster' && (
                  <div className="space-y-4">
                    <MemberDirectoryExportTable
                      members={allMembersData.length > 0 ? allMembersData : detailedRecords}
                      institutions={institutionsList}
                      initialCategory={memberCategoryFilter}
                      initialInstitution={memberInstitutionFilter}
                      title="PSITS Member Directory & Roster"
                      subtitle="Official verified registry of individual, institution, and industry members"
                    />
                  </div>
                )}

                {(previewReport === 'Financial Summary' || previewReport === 'Revenue by Method') && (
                  <FinancialReportView
                    payments={detailedRecords}
                    reportTitle={previewReport}
                    dateRangeFilter={dateRangeFilter as any}
                    startDateFilter={startDateFilter}
                    endDateFilter={endDateFilter}
                    initialMethodFilter={selectedMethodFocus}
                    preparedBy={user?.fullName || 'Financial Officer'}
                    userRole={user?.role || 'Officer'}
                    onExportCSV={() => handleGenerateExcel(previewReport)}
                  />
                )}

                {(previewReport === 'Event Participation' || previewReport === 'Complete Event') && (
                  isEventReportLoading ? (
                    <div className="flex items-center justify-center p-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <EventReportView
                      events={eventReportData?.events || detailedRecords}
                      participants={eventReportData?.participants || []}
                      reportTitle={previewReport}
                      preparedBy={user?.fullName || 'Events Coordinator'}
                      userRole={user?.role || 'Officer'}
                    />
                  )
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

                {previewReport !== 'Membership Growth' &&
                  previewReport !== 'Member Directory & Roster' &&
                  previewReport !== 'Financial Summary' &&
                  previewReport !== 'Revenue by Method' &&
                  previewReport !== 'Event Participation' &&
                  previewReport !== 'Complete Event' &&
                  previewReport !== 'Election Tally' &&
                  previewReport !== 'Partner Contributions' && (
                  <div className="border rounded-xl p-4 text-xs space-y-2">
                    <h4 className="font-bold text-gray-900">{previewReport} Data Summary</h4>
                    <p className="text-gray-600">Total records compiled: {detailedRecords.length} entries.</p>
                  </div>
                )}

                {/* Signatures & Certification Section (for general reports) */}
                {previewReport !== 'Financial Summary' && previewReport !== 'Revenue by Method' && previewReport !== 'Event Participation' && previewReport !== 'Complete Event' && (
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
                )}
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
