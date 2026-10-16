import { useMemo, useState } from 'react';
import { exportToCSV } from '@/shared/utils/export';
import logo from '@/assets/image/PSITS_Logo.png';
import {
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  FileCheck2,
  DollarSign,
  CreditCard,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export interface PaymentRecord {
  id: string | number;
  memberId?: string | number;
  memberName?: string;
  fullName?: string;
  userFullName?: string;
  memberEmail?: string;
  email?: string;
  userEmail?: string;
  amount: number | string;
  method?: string;
  paymentMethod?: string;
  paymentKind?: string;
  referenceNumber?: string | null;
  referenceNo?: string | null;
  paymentStatus?: string;
  processStatus?: string;
  verificationStatus?: string;
  status?: string;
  proofUrl?: string | null;
  rejectionReason?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  grossAmount?: number | null;
  discountAmount?: number | null;
  netAmount?: number | null;
  partialAmount?: number | null;
  remainingBalance?: number | null;
  isPartial?: boolean;
  event?: string;
  eventTitle?: string;
  eventId?: string | number | null;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface FinancialReportViewProps {
  payments: PaymentRecord[];
  reportTitle?: string;
  dateRangeFilter?: 'all' | 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year' | 'custom';
  startDateFilter?: string;
  endDateFilter?: string;
  preparedBy?: string;
  userRole?: string;
  onExportCSV?: (records: PaymentRecord[]) => void;
}

export const FinancialReportView = ({
  payments = [],
  reportTitle = 'Financial Summary',
  dateRangeFilter = 'all',
  startDateFilter = '',
  endDateFilter = '',
  preparedBy = 'Finance Officer',
  userRole = 'Officer',
  onExportCSV,
}: FinancialReportViewProps) => {
  // In-document Interactive Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'verified' | 'pending' | 'partial' | 'rejected'>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedPurpose, setSelectedPurpose] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);

  // Helper formatters
  const formatPHP = (val: number | string | null | undefined) => {
    const n = Number(val || 0);
    return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const normalizeMethod = (rawMethod?: string): string => {
    const m = String(rawMethod || '').toLowerCase();
    if (m.includes('gcash')) return 'GCash';
    if (m.includes('bank') || m.includes('card')) return 'Bank Transfer';
    if (m.includes('officer') || m.includes('cash')) return 'Through Officer (OR)';
    if (m.includes('cheque')) return 'Cheque';
    if (m.includes('paymaya')) return 'PayMaya';
    if (m.includes('paypal')) return 'PayPal';
    return rawMethod ? rawMethod.toUpperCase() : 'Other';
  };

  const getPurposeLabel = (p: PaymentRecord): string => {
    if (p.event || p.eventTitle) {
      return p.event || p.eventTitle || 'Event Registration';
    }
    const kind = String(p.paymentKind || '').toLowerCase();
    if (kind.includes('renewal')) return 'Membership Renewal';
    if (kind.includes('batch')) return 'Institution Batch Registration';
    if (kind.includes('partial')) return 'Institution Partial Payment';
    if (kind.includes('member')) return 'Membership Registration';
    if (kind.includes('sponsor')) return 'Partner Sponsorship';
    return 'General Fee';
  };

  const getStatusCategory = (p: PaymentRecord): 'verified' | 'pending' | 'partial' | 'rejected' => {
    const st = String(p.status || p.verificationStatus || p.paymentStatus || '').toLowerCase();
    if (st === 'rejected') return 'rejected';
    if (p.isPartial || st === 'partial' || (p.remainingBalance !== null && p.remainingBalance !== undefined && p.remainingBalance > 0)) {
      if (st === 'verified' || st === 'approved' || st === 'paid') return 'partial';
    }
    if (st === 'verified' || st === 'approved' || st === 'paid') return 'verified';
    if (st === 'pending' || p.paymentStatus === 'pending') return 'pending';
    return 'pending';
  };

  // 1. Filter by Date Range (from Step 1)
  const dateFilteredPayments = useMemo(() => {
    return payments.filter((record) => {
      if (dateRangeFilter === 'all') return true;
      const recordDateStr = record.createdAt || record.date;
      if (!recordDateStr) return true;
      const d = new Date(recordDateStr);
      const now = new Date();

      if (dateRangeFilter === 'this_month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (dateRangeFilter === 'last_30_days') {
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 30;
      }
      if (dateRangeFilter === 'this_quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const recordQuarter = Math.floor(d.getMonth() / 3);
        return d.getFullYear() === now.getFullYear() && currentQuarter === recordQuarter;
      }
      if (dateRangeFilter === 'this_year') {
        return d.getFullYear() === now.getFullYear();
      }
      if (dateRangeFilter === 'custom') {
        if (startDateFilter && d < new Date(startDateFilter)) return false;
        if (endDateFilter) {
          const end = new Date(endDateFilter);
          end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
      }
      return true;
    });
  }, [payments, dateRangeFilter, startDateFilter, endDateFilter]);

  // 2. Compute Executive Financial Metrics over date-filtered payments
  const executiveMetrics = useMemo(() => {
    let grossTotal = 0;
    let verifiedTotal = 0;
    let pendingTotal = 0;
    let rejectedTotal = 0;
    let remainingReceivables = 0;

    let verifiedCount = 0;
    let pendingCount = 0;
    let partialCount = 0;
    let rejectedCount = 0;

    dateFilteredPayments.forEach((p) => {
      const amt = Number(p.amount || 0);
      grossTotal += amt;

      const cat = getStatusCategory(p);
      if (cat === 'verified') {
        verifiedTotal += amt;
        verifiedCount += 1;
      } else if (cat === 'partial') {
        verifiedTotal += amt;
        partialCount += 1;
        if (p.remainingBalance && p.remainingBalance > 0) {
          remainingReceivables += Number(p.remainingBalance);
        }
      } else if (cat === 'pending') {
        pendingTotal += amt;
        pendingCount += 1;
      } else if (cat === 'rejected') {
        rejectedTotal += amt;
        rejectedCount += 1;
      }
    });

    const clearanceRate = grossTotal > 0 ? (verifiedTotal / grossTotal) * 100 : 0;

    return {
      grossTotal,
      verifiedTotal,
      pendingTotal,
      rejectedTotal,
      remainingReceivables,
      totalCount: dateFilteredPayments.length,
      verifiedCount,
      pendingCount,
      partialCount,
      rejectedCount,
      clearanceRate,
    };
  }, [dateFilteredPayments]);

  // 3. Breakdown by Payment Method
  const methodBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; totalGross: number; verifiedTotal: number }>();

    // Initial buckets
    const channels = ['GCash', 'Bank Transfer', 'Through Officer (OR)', 'Cheque', 'PayMaya', 'Other'];
    channels.forEach((c) => map.set(c, { count: 0, totalGross: 0, verifiedTotal: 0 }));

    dateFilteredPayments.forEach((p) => {
      const methodLabel = normalizeMethod(p.method || p.paymentMethod);
      const existing = map.get(methodLabel) || { count: 0, totalGross: 0, verifiedTotal: 0 };
      const amt = Number(p.amount || 0);

      existing.count += 1;
      existing.totalGross += amt;

      const cat = getStatusCategory(p);
      if (cat === 'verified' || cat === 'partial') {
        existing.verifiedTotal += amt;
      }
      map.set(methodLabel, existing);
    });

    return Array.from(map.entries())
      .map(([channel, data]) => {
        const shareOfVerified = executiveMetrics.verifiedTotal > 0
          ? (data.verifiedTotal / executiveMetrics.verifiedTotal) * 100
          : 0;
        return {
          channel,
          count: data.count,
          totalGross: data.totalGross,
          verifiedTotal: data.verifiedTotal,
          sharePercentage: shareOfVerified,
        };
      })
      .filter((m) => m.count > 0 || ['GCash', 'Bank Transfer', 'Through Officer (OR)'].includes(m.channel));
  }, [dateFilteredPayments, executiveMetrics.verifiedTotal]);

  // 4. Breakdown by Purpose / Activity
  const purposeBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; totalGross: number; verifiedTotal: number }>();

    dateFilteredPayments.forEach((p) => {
      let category = 'Other Fees';
      const kind = String(p.paymentKind || '').toLowerCase();
      const eventName = p.event || p.eventTitle;

      if (kind.includes('renewal')) {
        category = 'Membership Renewals';
      } else if (kind.includes('batch')) {
        category = 'Institution Batch Registrations';
      } else if (kind.includes('member') || (!eventName && !p.eventId)) {
        category = 'Individual Membership Dues';
      } else if (p.eventId || eventName) {
        category = 'Event & Competition Fees';
      } else if (kind.includes('sponsor')) {
        category = 'Partner & Sponsorships';
      }

      const existing = map.get(category) || { count: 0, totalGross: 0, verifiedTotal: 0 };
      const amt = Number(p.amount || 0);
      existing.count += 1;
      existing.totalGross += amt;

      const cat = getStatusCategory(p);
      if (cat === 'verified' || cat === 'partial') {
        existing.verifiedTotal += amt;
      }
      map.set(category, existing);
    });

    return Array.from(map.entries()).map(([category, data]) => {
      const shareOfTotal = executiveMetrics.grossTotal > 0
        ? (data.totalGross / executiveMetrics.grossTotal) * 100
        : 0;
      return {
        category,
        count: data.count,
        totalGross: data.totalGross,
        verifiedTotal: data.verifiedTotal,
        sharePercentage: shareOfTotal,
      };
    });
  }, [dateFilteredPayments, executiveMetrics.grossTotal]);

  // 5. In-Document Interactive Filtering (Search + Status + Method + Purpose)
  const filteredLedger = useMemo(() => {
    return dateFilteredPayments.filter((p) => {
      // Status filter
      if (selectedStatus !== 'all') {
        const cat = getStatusCategory(p);
        if (cat !== selectedStatus) return false;
      }

      // Method filter
      if (selectedMethod !== 'all') {
        const m = normalizeMethod(p.method || p.paymentMethod);
        if (m !== selectedMethod) return false;
      }

      // Purpose filter
      if (selectedPurpose !== 'all') {
        const purpose = getPurposeLabel(p).toLowerCase();
        if (selectedPurpose === 'membership' && !purpose.includes('member')) return false;
        if (selectedPurpose === 'events' && !purpose.includes('event') && !p.eventId) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = String(p.memberName || p.fullName || p.userFullName || '').toLowerCase();
        const email = String(p.memberEmail || p.email || p.userEmail || '').toLowerCase();
        const refNo = String(p.referenceNumber || p.referenceNo || '').toLowerCase();
        const purpose = getPurposeLabel(p).toLowerCase();
        const method = normalizeMethod(p.method || p.paymentMethod).toLowerCase();

        if (!name.includes(q) && !email.includes(q) && !refNo.includes(q) && !purpose.includes(q) && !method.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [dateFilteredPayments, selectedStatus, selectedMethod, selectedPurpose, searchQuery]);

  // Totals for visible filtered ledger
  const visibleLedgerTotals = useMemo(() => {
    let gross = 0;
    let verified = 0;
    let balance = 0;
    filteredLedger.forEach((p) => {
      gross += Number(p.amount || 0);
      const cat = getStatusCategory(p);
      if (cat === 'verified' || cat === 'partial') {
        verified += Number(p.amount || 0);
      }
      if (p.remainingBalance && p.remainingBalance > 0) {
        balance += Number(p.remainingBalance);
      }
    });
    return { gross, verified, balance, count: filteredLedger.length };
  }, [filteredLedger]);

  // Pagination
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredLedger.length / pageSize);
  const paginatedLedger = useMemo(() => {
    if (pageSize === 'all') return filteredLedger;
    const start = (currentPage - 1) * pageSize;
    return filteredLedger.slice(start, start + pageSize);
  }, [filteredLedger, currentPage, pageSize]);

  // Trigger Excel Export for the current audit dataset
  const handleExportSpreadsheet = () => {
    if (onExportCSV) {
      onExportCSV(filteredLedger);
      return;
    }
    const exportData = filteredLedger.map((p) => ({
      'Transaction ID': p.id,
      'Date & Time': p.createdAt || p.date || '—',
      'Payor Full Name': p.memberName || p.fullName || p.userFullName || '—',
      'Payor Email': p.memberEmail || p.email || p.userEmail || '—',
      'Payment Particulars / Purpose': getPurposeLabel(p),
      'Payment Channel / Method': normalizeMethod(p.method || p.paymentMethod),
      'Reference / OR Number': p.referenceNumber || p.referenceNo || '—',
      'Gross Amount (PHP)': Number(p.amount || 0).toFixed(2),
      'Is Partial Payment': p.isPartial ? 'YES' : 'NO',
      'Remaining Balance (PHP)': p.remainingBalance ? Number(p.remainingBalance).toFixed(2) : '0.00',
      'Audit Status': getStatusCategory(p).toUpperCase(),
      'Proof Document Uploaded': p.proofUrl ? 'YES' : 'NO',
      'Verified By': p.verifiedBy || '—',
      'Verified Date': p.verifiedAt || '—',
    }));
    exportToCSV(`${reportTitle.replace(/\s+/g, '_')}_Audit_Report`, exportData);
  };

  // Date range label for letterhead
  const dateRangeDisplay = useMemo(() => {
    if (dateRangeFilter === 'this_month') return 'Current Accounting Month';
    if (dateRangeFilter === 'last_30_days') return 'Last 30 Days';
    if (dateRangeFilter === 'this_quarter') return 'Current Fiscal Quarter';
    if (dateRangeFilter === 'this_year') return 'Fiscal Year-to-Date (YTD)';
    if (dateRangeFilter === 'custom' && (startDateFilter || endDateFilter)) {
      return `${startDateFilter || 'Earliest'} to ${endDateFilter || 'Latest'}`;
    }
    return 'All Recorded Transactions (Complete Ledger)';
  }, [dateRangeFilter, startDateFilter, endDateFilter]);

  const isRevenueByMethodReport = reportTitle === 'Revenue by Method';

  // Chart data for Revenue By Method
  const chartColors = ['#003D82', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'];
  const methodChartData = methodBreakdown.map((m) => ({
    name: m.channel,
    'Verified Collections': m.verifiedTotal,
    'Total Volume': m.totalGross,
  }));

  return (
    <div className="space-y-6 text-gray-900">
      {/* ============================================================== */}
      {/* 1. OFFICIAL PSITS AUDIT LETTERHEAD (Print & Screen Compliant)  */}
      {/* ============================================================== */}
      <div className="border-b-2 border-primary/90 pb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img src={logo} alt="PSITS Logo" className="h-14 w-14 object-contain shadow-xs rounded-full p-1 border border-primary/20 bg-white" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary/80 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  Official Accounting Document
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  REF: PSITS-FIN-{new Date().getFullYear()}-{String(payments.length).padStart(4, '0')}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight mt-0.5">
                PHILIPPINE SOCIETY OF INFORMATION TECHNOLOGY STUDENTS
              </h1>
              <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider">
                Regional Executive Council • Financial Audit & Treasury Office
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-gray-600 space-y-1 bg-gray-50/80 p-2.5 rounded-lg border border-gray-200 min-w-[200px]">
            <p>
              <strong className="text-gray-800">Statement:</strong>{' '}
              <span className="font-semibold text-primary">{reportTitle.toUpperCase()}</span>
            </p>
            <p>
              <strong className="text-gray-800">Audit Period:</strong> {dateRangeDisplay}
            </p>
            <p>
              <strong className="text-gray-800">Generated:</strong> {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p>
              <strong className="text-gray-800">Prepared By:</strong> {preparedBy} ({userRole})
            </p>
          </div>
        </div>

        {/* Subtitle Bar */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-primary/5 border border-primary/15 px-3 py-1.5 rounded-lg">
          <div className="flex items-center gap-2 text-primary font-medium">
            <FileCheck2 size={15} />
            <span>Review total collections, approved payments, and balances.</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>Ledger Scope: <strong>{dateFilteredPayments.length} transactions</strong></span>
            <span>•</span>
            <span>Clearance Rate: <strong className="text-emerald-700">{executiveMetrics.clearanceRate.toFixed(1)}%</strong></span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. EXECUTIVE FINANCIAL KPIS SCOREBOARD                         */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Gross Inflows Logged */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">Gross Inflows</span>
            <Wallet size={16} className="text-primary" />
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-primary tracking-tight">
              {formatPHP(executiveMetrics.grossTotal)}
            </p>
            <p className="text-[11px] text-blue-700 mt-0.5">
              Across <strong>{executiveMetrics.totalCount}</strong> transactions
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-blue-200/60 text-[10px] text-blue-800 font-medium">
            Total submissions logged
          </div>
        </div>

        {/* Verified Net Revenue */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">Verified Net</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
              {formatPHP(executiveMetrics.verifiedTotal)}
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              <strong>{executiveMetrics.verifiedCount + executiveMetrics.partialCount}</strong> cleared receipts
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-emerald-200/60 text-[10px] text-emerald-800 font-medium">
            {executiveMetrics.clearanceRate.toFixed(1)}% of gross collections
          </div>
        </div>

        {/* Pending Clearance (In-Review Exposure) */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Pending Review</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight">
              {formatPHP(executiveMetrics.pendingTotal)}
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              <strong>{executiveMetrics.pendingCount}</strong> awaiting officer verification
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-amber-200/60 text-[10px] text-amber-800 font-medium">
            Unverified remittances
          </div>
        </div>

        {/* Outstanding Receivables (Partial Balance) */}
        <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wide">Receivables Balance</span>
            <DollarSign size={16} className="text-purple-600" />
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-purple-800 tracking-tight">
              {formatPHP(executiveMetrics.remainingReceivables)}
            </p>
            <p className="text-[11px] text-purple-700 mt-0.5">
              <strong>{executiveMetrics.partialCount}</strong> partial payments active
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-purple-200/60 text-[10px] text-purple-800 font-medium">
            Outstanding balance due
          </div>
        </div>

        {/* Rejected / Disapproved */}
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wide">Voided / Rejected</span>
            <AlertCircle size={16} className="text-rose-600" />
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight">
              {formatPHP(executiveMetrics.rejectedTotal)}
            </p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              <strong>{executiveMetrics.rejectedCount}</strong> invalid proofs flagged
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-rose-200/60 text-[10px] text-rose-800 font-medium">
            Disapproved submissions
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. VISUAL ANALYTICS & BREAKDOWN SECTION                       */}
      {/* ============================================================== */}
      {isRevenueByMethodReport && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              <h3 className="text-sm font-bold text-gray-900">Payment Channel Settlement Comparison</h3>
            </div>
            <span className="text-xs text-gray-500">Verified Collections vs Total Inflows</span>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methodChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any) => [formatPHP(value), '']} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Verified Collections" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Total Volume" fill="#003D82" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Channel Settlement Breakdown Table */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard size={15} className="text-primary" /> Payment Channel Distribution
            </h4>
            <span className="text-[11px] text-gray-500">By Cleared Inflows</span>
          </div>
          <div className="space-y-2.5">
            {methodBreakdown.map((m, idx) => (
              <div key={m.channel} className="text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors[idx % chartColors.length] }}></span>
                    {m.channel}
                    <span className="text-[10px] text-gray-500 font-normal">({m.count} txns)</span>
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">{formatPHP(m.verifiedTotal)}</span>
                    <span className="text-[10px] text-gray-500 ml-1.5 font-medium">({m.sharePercentage.toFixed(1)}%)</span>
                  </div>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, m.sharePercentage))}%`,
                      backgroundColor: chartColors[idx % chartColors.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Stream Breakdown by Purpose */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={15} className="text-primary" /> Revenue Stream by Purpose
            </h4>
            <span className="text-[11px] text-gray-500">By Gross Inflows</span>
          </div>
          <div className="space-y-2.5">
            {purposeBreakdown.map((p) => (
              <div key={p.category} className="text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800">
                    {p.category}
                    <span className="text-[10px] text-gray-500 font-normal ml-1">({p.count} txns)</span>
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">{formatPHP(p.totalGross)}</span>
                    <span className="text-[10px] text-emerald-700 ml-1.5 font-medium">
                      ({formatPHP(p.verifiedTotal)} cleared)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, p.sharePercentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. ITEMIZED TRANSACTION AUDIT LEDGER                          */}
      {/* ============================================================== */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden space-y-0">
        {/* Ledger Control & In-Document Filtering Header */}
        <div className="p-4 bg-gray-50/70 border-b border-gray-200 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Receipt size={17} className="text-primary" /> Itemized Transaction Audit Ledger
              </h3>
              <p className="text-xs text-gray-500">
                Audited payment register with reference/OR tracking, verification timestamps, and payor records.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* In-Document Search Bar */}
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, ref #, event..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white text-gray-900"
                />
              </div>

              {/* Print Button */}
              <button
                type="button"
                onClick={() => {
                  setPageSize('all');
                  setTimeout(() => window.print(), 150);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
              >
                <Printer size={14} /> Print
              </button>

              {/* Excel Export Button */}
              <button
                type="button"
                onClick={handleExportSpreadsheet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
              >
                <FileSpreadsheet size={14} /> Export CSV
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs no-print">
            <span className="text-[11px] font-semibold text-gray-500 mr-1">Status Filter:</span>
            {[
              { id: 'all', label: `All (${dateFilteredPayments.length})` },
              { id: 'verified', label: `Verified (${executiveMetrics.verifiedCount})` },
              { id: 'pending', label: `Pending (${executiveMetrics.pendingCount})` },
              { id: 'partial', label: `Partial Balances (${executiveMetrics.partialCount})` },
              { id: 'rejected', label: `Rejected (${executiveMetrics.rejectedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSelectedStatus(tab.id as any);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  selectedStatus === tab.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <div className="hidden sm:block border-l border-gray-300 h-4 mx-1"></div>

            <span className="text-[11px] font-semibold text-gray-500 mr-1">Method:</span>
            <select
              value={selectedMethod}
              onChange={(e) => {
                setSelectedMethod(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-0.5 rounded border border-gray-300 text-[11px] bg-white text-gray-700 focus:outline-none focus:border-primary"
            >
              <option value="all">All Channels</option>
              <option value="GCash">GCash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Through Officer (OR)">Through Officer (OR)</option>
              <option value="Cheque">Cheque</option>
              <option value="PayMaya">PayMaya</option>
            </select>

            <span className="text-[11px] font-semibold text-gray-500 ml-2 mr-1">Purpose:</span>
            <select
              value={selectedPurpose}
              onChange={(e) => {
                setSelectedPurpose(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-0.5 rounded border border-gray-300 text-[11px] bg-white text-gray-700 focus:outline-none focus:border-primary"
            >
              <option value="all">All Streams</option>
              <option value="membership">Membership</option>
              <option value="events">Events & Activities</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto print:overflow-visible print:max-h-none">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="px-3 py-2.5">Ref / OR No.</th>
                <th className="px-3 py-2.5">Date & Time</th>
                <th className="px-3 py-2.5">Payor Information</th>
                <th className="px-3 py-2.5">Particulars / Purpose</th>
                <th className="px-3 py-2.5">Method</th>
                <th className="px-3 py-2.5 text-right">Amount (₱)</th>
                <th className="px-3 py-2.5 text-center">Settlement Status</th>
                <th className="px-3 py-2.5 text-center">Audit Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedLedger.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 italic">
                    No transactions match the selected filter parameters.
                  </td>
                </tr>
              ) : (
                paginatedLedger.map((p, idx) => {
                  const statusCat = getStatusCategory(p);
                  const isOfficerMethod = normalizeMethod(p.method || p.paymentMethod).includes('Officer');
                  const isGcashMethod = normalizeMethod(p.method || p.paymentMethod).includes('GCash');

                  return (
                    <tr key={p.id || idx} className="hover:bg-blue-50/40 transition-colors">
                      {/* Ref / OR No */}
                      <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isOfficerMethod ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              OR
                            </span>
                          ) : isGcashMethod ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              GCASH
                            </span>
                          ) : null}
                          <span>{p.referenceNumber || p.referenceNo || `TX-${String(p.id).padStart(5, '0')}`}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-[11px]">
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : (p.date || '—')}
                      </td>

                      {/* Payor */}
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-gray-900 leading-tight">
                          {p.memberName || p.fullName || p.userFullName || 'Authorized Member'}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {p.memberEmail || p.email || p.userEmail || '—'}
                        </div>
                      </td>

                      {/* Purpose */}
                      <td className="px-3 py-2.5 text-gray-800 font-medium max-w-[200px] truncate">
                        {getPurposeLabel(p)}
                      </td>

                      {/* Method */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                          {normalizeMethod(p.method || p.paymentMethod)}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-2.5 text-right font-black text-gray-900 whitespace-nowrap">
                        {formatPHP(p.amount)}
                        {p.isPartial && p.remainingBalance && p.remainingBalance > 0 ? (
                          <div className="text-[10px] font-normal text-purple-700">
                            Bal: {formatPHP(p.remainingBalance)}
                          </div>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {statusCat === 'verified' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={11} /> Verified
                          </span>
                        )}
                        {statusCat === 'partial' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                            <Clock size={11} /> Partial Paid
                          </span>
                        )}
                        {statusCat === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock size={11} /> Pending Review
                          </span>
                        )}
                        {statusCat === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertCircle size={11} /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Audit Verification */}
                      <td className="px-3 py-2.5 text-center text-[10px] text-gray-500 whitespace-nowrap">
                        {p.proofUrl ? (
                          <span className="text-primary font-medium flex items-center justify-center gap-1">
                            <Receipt size={12} /> Receipt Attached
                          </span>
                        ) : (
                          <span className="text-gray-400">No Receipt</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Total Row Summary */}
            <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 text-gray-900 sticky bottom-0">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px]">
                  Total for Visible Records ({visibleLedgerTotals.count} entries):
                </td>
                <td className="px-3 py-2.5 text-right font-black text-sm text-primary">
                  {formatPHP(visibleLedgerTotals.gross)}
                </td>
                <td colSpan={2} className="px-3 py-2.5 text-left text-[11px] text-emerald-700">
                  Verified: {formatPHP(visibleLedgerTotals.verified)}
                  {visibleLedgerTotals.balance > 0 ? ` • Bal Due: ${formatPHP(visibleLedgerTotals.balance)}` : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Ledger Pagination Bar */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span>Show:</span>
            {[15, 30, 50, 'all'].map((sz) => (
              <button
                key={String(sz)}
                type="button"
                onClick={() => {
                  setPageSize(sz as any);
                  setCurrentPage(1);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  pageSize === sz ? 'bg-primary text-white' : 'bg-white border text-gray-700 hover:bg-gray-100'
                }`}
              >
                {sz === 'all' ? 'All' : sz}
              </button>
            ))}
            <span className="text-gray-400">|</span>
            <span>
              Showing {filteredLedger.length > 0 ? (currentPage - 1) * (pageSize === 'all' ? filteredLedger.length : pageSize) + 1 : 0} to{' '}
              {pageSize === 'all' ? filteredLedger.length : Math.min(currentPage * (pageSize as number), filteredLedger.length)} of {filteredLedger.length} filtered entries
            </span>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:hover:bg-white"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[11px] font-semibold px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:hover:bg-white"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. OFFICIAL AUDIT CERTIFICATION & TRIPLE SIGN-OFF             */}
      {/* ============================================================== */}
      <div className="border border-gray-300 rounded-xl p-5 bg-gray-50/50 space-y-4 certification-block">
        <div className="text-xs text-gray-700 italic border-l-4 border-primary pl-3">
          <p className="font-semibold text-gray-900 not-italic uppercase tracking-wide text-[11px] mb-0.5">
            Official Certification Statement
          </p>
          "I hereby certify under official oath that this financial statement, revenue distribution, and itemized transaction ledger represent a true, faithful, and accurate record of all monetary collections, verified bank remittances, official receipts (OR), and outstanding balances recorded in the PSITS Regional Information System for the specified accounting period."
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-xs">
          {/* Prepared By */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Prepared & Audited By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-full sm:w-48"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">{preparedBy}</p>
            <p className="text-[11px] text-gray-500 capitalize">{userRole} / Financial Reporter</p>
            <p className="text-[10px] text-gray-400">Date: {new Date().toLocaleDateString()}</p>
          </div>

          {/* Certified Correct by Treasurer */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Certified Correct By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-full sm:w-48"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">Regional Organization Treasurer</p>
            <p className="text-[11px] text-gray-500">Committee on Treasury & Audit</p>
            <p className="text-[10px] text-gray-400">Official Signature & Date</p>
          </div>

          {/* Approved by President */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Noted & Approved By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-full sm:w-48"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">Regional Organization President</p>
            <p className="text-[11px] text-gray-500">PSITS Regional Executive Council</p>
            <p className="text-[10px] text-gray-400">Official Seal & Ratification</p>
          </div>
        </div>
      </div>
    </div>
  );
};
