import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/shared/layouts';

import { Card, Button, TextArea, Input, Select } from '@/shared/components/Form';
import { Badge, Pagination, Modal } from '@/shared/components/Common';
import { CheckCircle, XCircle, Clock, Eye, Edit2, Download, Search, DollarSign, Upload, Building2, User, CheckCircle2, Plus } from 'lucide-react';
import { exportToCSV } from '@/shared/utils/export';
import api from '@/shared/services/api';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { PaymentInstructionsCard } from '@/shared/components/PaymentInstructionsCard';
import { formatPaymentMethod, PAYMENT_METHOD_OPTIONS } from '@/shared/utils/helpers';

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

const mockPayments: any[] = [];

export const PaymentsPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || searchParams.get('member') || '';
  const initialCategory = (searchParams.get('category') as any) || 'all';
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'institution' | 'individual' | 'event' | 'sponsorship'>(
    ['institution', 'individual', 'event', 'sponsorship'].includes(initialCategory) ? initialCategory : 'all'
  );
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [payments, setPayments] = useState<any[]>(mockPayments);
  const [isLoading, setIsLoading] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ payment: any; status: 'verified' | 'rejected'; rejectionReason?: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const isMember = user?.role === 'member';

  // State for submitting a new payment / membership dues
  const [showPayFeeModal, setShowPayFeeModal] = useState(false);
  const [isSubmittingFee, setIsSubmittingFee] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState<{
    method: string;
    amount: number;
    paymentKind: string;
    referenceNumber: string;
    file: File | null;
    previewUrl: string;
  }>({
    method: 'gcash',
    amount: 250,
    paymentKind: 'membership_registration',
    referenceNumber: '',
    file: null,
    previewUrl: '',
  });

  // State for Admin / Officer offline & direct payment recording
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState<{
    entityType: 'institution' | 'member';
    institutionName: string;
    memberName: string;
    category: 'institution_partial_payment' | 'institution_batch_registration' | 'membership_registration' | 'event' | 'partner_sponsorship';
    eventTitle: string;
    amount: number | '';
    isPartial: boolean;
    remainingBalance: number | '';
    method: string;
    referenceNumber: string;
    markAsVerified: boolean;
    file: File | null;
    previewUrl: string;
  }>({
    entityType: 'institution',
    institutionName: '',
    memberName: '',
    category: 'institution_partial_payment',
    eventTitle: '',
    amount: '',
    isPartial: false,
    remainingBalance: '',
    method: 'through_officer',
    referenceNumber: '',
    markAsVerified: true,
    file: null,
    previewUrl: '',
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.getPayments({ status: filterStatus });
        if (!cancelled && data?.success) setPayments(data.payments || []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [filterStatus]);

  useEffect(() => {
    if (!viewing?.id) {
      setPaymentLogs([]);
      return;
    }
    let cancelled = false;
    const loadLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const { data } = await api.getPaymentStatusLogs(viewing.id);
        if (!cancelled && data?.success) {
          setPaymentLogs(data.logs || []);
        }
      } catch {
        if (!cancelled) setPaymentLogs([]);
      } finally {
        if (!cancelled) setIsLoadingLogs(false);
      }
    };
    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [viewing?.id]);

  useEffect(() => {
    const s = searchParams.get('search') || searchParams.get('member') || '';
    if (s && s !== searchTerm) {
      setSearchTerm(s);
    }
    const cat = searchParams.get('category');
    if (cat && ['institution', 'individual', 'event', 'sponsorship'].includes(cat)) {
      setFilterCategory(cat as any);
    }
  }, [searchParams]);

  const scopedPayments = isMember
    ? payments.filter((payment) => String(payment.memberId) === String(user?.id || ''))
    : payments;

  const getVerificationStatus = (payment: any) =>
    String(payment?.verificationStatus || payment?.status || 'pending').toLowerCase();

  const filteredPayments = scopedPayments.filter((payment) => {
    const status = getVerificationStatus(payment);
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    if (!matchesStatus) return false;

    if (filterCategory !== 'all') {
      const kind = String(payment.paymentKind || '').toLowerCase();
      const isInst = kind.includes('institution') || Boolean(payment.institutionName);
      if (filterCategory === 'institution' && !isInst) return false;
      if (filterCategory === 'individual' && (isInst || payment.eventId || kind === 'partner_sponsorship')) return false;
      if (filterCategory === 'event' && (!payment.eventId && kind !== 'event')) return false;
      if (filterCategory === 'sponsorship' && kind !== 'partner_sponsorship') return false;
    }

    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase().trim();
    return (
      (payment.memberName && String(payment.memberName).toLowerCase().includes(term)) ||
      (payment.institutionName && String(payment.institutionName).toLowerCase().includes(term)) ||
      (payment.memberEmail && String(payment.memberEmail).toLowerCase().includes(term)) ||
      (payment.event && String(payment.event).toLowerCase().includes(term)) ||
      (payment.paymentKind && String(payment.paymentKind).toLowerCase().includes(term)) ||
      (payment.referenceNumber && String(payment.referenceNumber).toLowerCase().includes(term)) ||
      (payment.method && String(payment.method).toLowerCase().includes(term)) ||
      (payment.paymentMethod && String(payment.paymentMethod).toLowerCase().includes(term)) ||
      (payment.memberId && String(payment.memberId) === term)
    );
  });

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSubmitFee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeeError(null);

    if (!feeForm.amount || Number(feeForm.amount) <= 0) {
      setFeeError('Please enter a valid amount.');
      return;
    }

    if (!feeForm.file) {
      if (feeForm.method === 'through_officer' || feeForm.method === 'cash_officer') {
        setFeeError('Official Receipt (OR) image is required.');
      } else {
        setFeeError('Receipt image is required.');
      }
      return;
    }

    if (feeForm.method === 'gcash' && !feeForm.referenceNumber.trim()) {
      setFeeError('GCash Reference Number is required.');
      return;
    }

    setIsSubmittingFee(true);
    try {
      const dataUrl = await readAsDataUrl(feeForm.file);
      const { data: uploadData } = await api.uploadPaymentProof(dataUrl);
      const proofUrl = uploadData?.url;
      if (!proofUrl) {
        throw new Error('Failed to upload proof image.');
      }

      const { data } = await api.createPayment({
        paymentKind: feeForm.paymentKind,
        amount: Number(feeForm.amount),
        method: feeForm.method,
        paymentMethod: feeForm.method,
        referenceNumber: feeForm.referenceNumber.trim() || undefined,
        proofUrl,
      });

      if (data?.success) {
        addNotification({
          userId: 'current',
          title: 'Payment Submitted',
          message: 'Your payment proof has been submitted for officer verification.',
          type: 'success',
          isRead: false,
        });

        // Refresh list
        const res = await api.getPayments({ status: filterStatus });
        if (res.data?.success) {
          setPayments(res.data.payments || []);
        }

        setShowPayFeeModal(false);
        setFeeForm({
          method: 'gcash',
          amount: 250,
          paymentKind: 'membership_registration',
          referenceNumber: '',
          file: null,
          previewUrl: '',
        });
      } else {
        throw new Error(data?.message || 'Failed to submit payment.');
      }
    } catch (err: any) {
      setFeeError(err?.response?.data?.message || err?.message || 'Failed to submit payment.');
    } finally {
      setIsSubmittingFee(false);
    }
  };

  const handleRecordOfflinePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordError(null);

    const amountNum = Number(recordForm.amount || 0);
    if (!amountNum || amountNum <= 0) {
      setRecordError('Please enter a valid amount greater than 0.');
      return;
    }

    if (recordForm.entityType === 'institution' && !recordForm.institutionName.trim()) {
      setRecordError('Please enter or select the institution name.');
      return;
    }

    if (recordForm.entityType === 'member' && !recordForm.memberName.trim()) {
      setRecordError('Please enter the member name.');
      return;
    }

    setIsSubmittingRecord(true);
    try {
      let uploadedProofUrl: string | null = null;
      if (recordForm.file) {
        const dataUrl = await readAsDataUrl(recordForm.file);
        const { data: uploadData } = await api.uploadPaymentProof(dataUrl);
        uploadedProofUrl = uploadData?.url || null;
      }

      const generatedRef = recordForm.referenceNumber.trim() || `REC-${Date.now().toString(36).toUpperCase()}`;

      const { data } = await api.createPayment({
        paymentKind: recordForm.category,
        eventTitle: recordForm.eventTitle.trim() || (recordForm.entityType === 'institution' ? `Institution Payment: ${recordForm.institutionName}` : undefined),
        amount: amountNum,
        method: recordForm.method,
        paymentMethod: recordForm.method,
        referenceNumber: generatedRef,
        proofUrl: uploadedProofUrl || undefined,
        institutionName: recordForm.entityType === 'institution' ? recordForm.institutionName.trim() : undefined,
        memberName: recordForm.memberName.trim() || (recordForm.entityType === 'institution' ? recordForm.institutionName.trim() : undefined),
        isPartial: recordForm.isPartial,
        remainingBalance: recordForm.isPartial ? Number(recordForm.remainingBalance || 0) : 0,
        verified: recordForm.markAsVerified,
        isDirectlyVerified: recordForm.markAsVerified,
      });

      if (data?.success) {
        addNotification({
          userId: 'current',
          title: 'Payment Recorded',
          message: `Payment of ₱${amountNum.toLocaleString()} for ${recordForm.entityType === 'institution' ? recordForm.institutionName : recordForm.memberName} was successfully recorded in Payment Tracking.`,
          type: 'success',
          isRead: false,
        });

        // Refresh list
        const res = await api.getPayments({ status: filterStatus });
        if (res.data?.success) {
          setPayments(res.data.payments || []);
        }

        setShowRecordModal(false);
        setRecordForm({
          entityType: 'institution',
          institutionName: '',
          memberName: '',
          category: 'institution_partial_payment',
          eventTitle: '',
          amount: '',
          isPartial: false,
          remainingBalance: '',
          method: 'through_officer',
          referenceNumber: '',
          markAsVerified: true,
          file: null,
          previewUrl: '',
        });
      } else {
        throw new Error(data?.message || 'Failed to record payment.');
      }
    } catch (err: any) {
      setRecordError(err?.response?.data?.message || err?.message || 'Failed to record payment.');
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = filteredPayments.map(p => ({
      'Member / Institution': p.institutionName || p.memberName || 'N/A',
      'Affiliation / School': p.institutionName || 'Individual',
      'Member Email': p.memberEmail || 'N/A',
      'Payment Type / Event': p.event || (p.paymentKind === 'membership_renewal' ? 'Membership Renewal' : p.paymentKind === 'membership_registration' ? 'Membership Registration' : p.paymentKind === 'institution_batch_registration' ? `Batch Registration (${p.totalHeads || 'Batch'} Heads)` : 'Membership Fee'),
      'Total Amount / Bill': p.netAmount || p.amount || 0,
      'Amount Paid': (p.paymentKind === 'institution_batch_registration' ? (p.partialAmount || (p.isPartial ? 0 : p.amount)) : p.amount) || 0,
      'Remaining Balance': p.remainingBalance || 0,
      'Total Heads': p.totalHeads || '-',
      'Payment Method': formatPaymentMethod(p.method || p.paymentMethod),
      'Reference Number': p.referenceNumber || '-',
      'Status': getVerificationStatus(p),
      'Date Submitted': p.date || 'N/A',
    }));
    exportToCSV('Payment_Transactions_Export', dataToExport);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={18} className="text-green-600" />;
      case 'rejected':
        return <XCircle size={18} className="text-red-600" />;
      case 'pending':
        return <Clock size={18} className="text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'info';
    }
  };

  // 1. Collections from individual memberships, renewals, events, sponsorships
  const verifiedIndividualAndEventRevenue = payments
    .filter((p) => getVerificationStatus(p) === 'verified' && !((p.paymentKind || '').includes('institution')))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // 2. All payments belonging to institutions
  const institutionPaymentsList = payments.filter((p) => (p.paymentKind || '').includes('institution') || Boolean(p.institutionName));

  // 3. Institution total assessed bill (the batch registration billing net amount)
  const institutionTotalBilled = institutionPaymentsList
    .filter((p) => p.paymentKind === 'institution_batch_registration')
    .reduce((sum, p) => sum + Number(p.netAmount || p.grossAmount || p.amount || 0), 0);

  // 4. Institution amount paid/verified so far
  const institutionTotalPaid = institutionPaymentsList
    .reduce((sum, p) => {
      const isVerified = getVerificationStatus(p) === 'verified' || p.paymentStatus === 'paid';
      if (!isVerified) return sum;
      if (p.paymentKind === 'institution_batch_registration') {
        return sum + (Number(p.partialAmount) || (p.isPartial ? 0 : Number(p.amount)) || 0);
      }
      return sum + Number(p.amount || 0);
    }, 0);

  const institutionRemainingBalance = Math.max(0, institutionTotalBilled - institutionTotalPaid);

  // Total Verified Revenue: reflects all verified collections (individual + institution)
  const totalVerifiedRevenue = verifiedIndividualAndEventRevenue + institutionTotalPaid;
  const totalFinancialVolume = verifiedIndividualAndEventRevenue + (institutionTotalBilled > 0 ? institutionTotalBilled : institutionTotalPaid);

  const canVerify = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Module Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-obsidian-card via-obsidian-surface to-obsidian-card border border-cyber-cyan/20 p-6 shadow-glow-sm">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-cyber-cyan/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="telemetry-chip font-mono text-[11px] text-cyber-cyan">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-pulse" />
                  MODULE.FINANCE
                </span>
                <span className="text-xs text-slate-500 font-mono">AUDIT_LOG_ENABLED</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 dark:text-white tracking-tight">
                {isMember ? 'My Payment History' : 'Financial Ledger & Verification'}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {isMember ? 'Track your membership dues, event registrations, and digital receipts.' : 'Monitor transactions, verify digital receipts, and audit collegiate cash flows.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              {isMember && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowPayFeeModal(true)}
                  className="w-full sm:w-auto shrink-0 font-medium"
                >
                  <DollarSign size={18} />
                  Submit Payment / Pay Fee
                </Button>
              )}
              {canVerify && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowRecordModal(true)}
                  className="w-full sm:w-auto shrink-0 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <Plus size={18} />
                  Record Payment
                </Button>
              )}
              <Button variant="cyber" size="lg" onClick={handleExportCSV} className="w-full sm:w-auto shrink-0 font-medium">
                <Download size={18} />
                Export CSV Ledger
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-cyber p-5 bg-white dark:bg-obsidian-card/90 rounded-xl border border-slate-200 dark:border-cyber-blue/30 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Verified Revenue</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyber-blue/10 text-cyber-blue dark:text-cyber-cyan font-bold">SYS.REV</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-display text-cyber-blue dark:text-cyber-cyan mt-3">
              PHP {totalVerifiedRevenue.toLocaleString()}
            </p>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-col gap-0.5">
              <span>Audited platform & institution collections</span>
              {institutionTotalBilled > 0 && (
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Includes ₱{institutionTotalPaid.toLocaleString()} paid • ₱{totalFinancialVolume.toLocaleString()} total volume
                </span>
              )}
            </div>
          </div>

          <div className="card-cyber p-5 bg-white dark:bg-obsidian-card/90 rounded-xl border border-slate-200 dark:border-indigo-500/30 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Institution Members Total</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">INST.BILL</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-display text-indigo-600 dark:text-indigo-400 mt-3">
              ₱{institutionTotalBilled.toLocaleString()}
            </p>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-col gap-0.5">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ₱{institutionTotalPaid.toLocaleString()} Paid & Verified
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                ₱{institutionRemainingBalance.toLocaleString()} Outstanding Balance
              </span>
            </div>
          </div>

          <div className="card-cyber p-5 bg-white dark:bg-obsidian-card/90 rounded-xl border border-slate-200 dark:border-amber-500/30 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending Verification</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">IN_REVIEW</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-display text-amber-600 dark:text-gold-accent mt-3">
              {payments.filter((p) => getVerificationStatus(p) === 'pending').length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Awaiting officer confirmation</p>
          </div>

          <div className="card-cyber p-5 bg-white dark:bg-obsidian-card/90 rounded-xl border border-slate-200 dark:border-emerald-500/30 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Verified Transactions</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">SETTLED</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-600 dark:text-emerald-400 mt-3">
              {payments.filter((p) => getVerificationStatus(p) === 'verified').length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Confirmed with reference IDs</p>
          </div>
        </div>

        {/* Category Navigation Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: `All Transactions (${payments.length})` },
            { id: 'institution', label: `🏛️ Institution Payments (${payments.filter(p => (p.paymentKind || '').includes('institution') || Boolean(p.institutionName)).length})` },
            { id: 'individual', label: `👤 Individual Membership (${payments.filter(p => !((p.paymentKind || '').includes('institution') || Boolean(p.institutionName)) && !p.eventId && (p.paymentKind !== 'partner_sponsorship')).length})` },
            { id: 'event', label: `🎯 Event Registrations (${payments.filter(p => Boolean(p.eventId) || p.paymentKind === 'event').length})` },
            { id: 'sponsorship', label: `🤝 Partner Sponsorships (${payments.filter(p => p.paymentKind === 'partner_sponsorship').length})` },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setFilterCategory(cat.id as any);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-obsidian-card text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white dark:bg-obsidian-card/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by member, institution, ref #, event, or method..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
                if (e.target.value) {
                  setSearchParams({ search: e.target.value });
                } else {
                  setSearchParams({});
                }
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-obsidian-surface border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyber-cyan text-sm text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 bg-slate-50 dark:bg-obsidian-surface border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyber-cyan text-sm text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">All Verification Statuses</option>
            <option value="pending">Pending Verification</option>
            <option value="verified">Verified (Settled)</option>
            <option value="rejected">Rejected (Flagged)</option>
          </select>
        </div>

        {/* Payments Table */}
        <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {!isMember && (
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                      Member / Institution
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Payment Type / Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedPayments.map((payment) => {
                  const status = getVerificationStatus(payment);
                  const formattedMethod = formatPaymentMethod(payment.method || payment.paymentMethod || '');
                  const renderPaymentKindBadge = () => {
                    if (payment.eventId && payment.event) {
                      return (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                          Event: {payment.event}
                        </span>
                      );
                    }
                    if (payment.paymentKind === 'membership_renewal') {
                      return (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800">
                          Membership Renewal
                        </span>
                      );
                    }
                    if (payment.paymentKind === 'membership_registration' || payment.paymentKind === 'membership') {
                      return (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                          Membership Registration
                        </span>
                      );
                    }
                    if (payment.paymentKind === 'partner_sponsorship') {
                      return (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                          Partner Sponsorship
                        </span>
                      );
                    }
                    if (payment.paymentKind === 'institution_batch_registration') {
                      return (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                          Batch Registration ({payment.totalHeads ? `${payment.totalHeads} Heads` : 'Institution'})
                        </span>
                      );
                    }
                    if (payment.paymentKind === 'institution_partial_payment') {
                      return (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                          🏛️ Institution Partial / Settlement
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                        {payment.event || 'Membership Fee'}
                      </span>
                    );
                  };

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    {!isMember && (
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-slate-100">
                        <div className="font-semibold">{payment.memberName || 'Member'}</div>
                        {payment.institutionName && (
                          <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                            🏫 {payment.institutionName}
                          </div>
                        )}
                        {payment.memberEmail && (
                          <div className="text-xs text-gray-500 font-normal mt-0.5">{payment.memberEmail}</div>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm">{renderPaymentKindBadge()}</td>
                    <td className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400">
                      {payment.paymentKind === 'institution_batch_registration' ? (
                        <div>
                          <div className="text-sm font-black text-gray-900 dark:text-white">
                            ₱{Number(payment.netAmount || payment.amount || 0).toLocaleString()}
                          </div>
                          <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Paid: ₱{Number(payment.partialAmount || (payment.isPartial ? 0 : payment.amount) || 0).toLocaleString()}
                          </div>
                          {Number(payment.remainingBalance) > 0 ? (
                            <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                              Balance: ₱{Number(payment.remainingBalance).toLocaleString()}
                            </div>
                          ) : (
                            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              ✓ Fully Settled
                            </div>
                          )}
                          <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                            ₱250/head • {payment.totalHeads || 'Batch'} heads
                          </div>
                        </div>
                      ) : payment.paymentKind === 'institution_partial_payment' ? (
                        <div>
                          <div className="text-sm font-black text-amber-600 dark:text-amber-400">
                            ₱{Number(payment.amount || 0).toLocaleString()}
                          </div>
                          {Number(payment.remainingBalance) > 0 && (
                            <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                              Balance left: ₱{Number(payment.remainingBalance).toLocaleString()}
                            </div>
                          )}
                          <div className="text-[10px] text-gray-400 font-normal">
                            Partial Remittance
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div>₱{Number(payment.amount || 0).toLocaleString()}</div>
                          {payment.isPartial && payment.remainingBalance ? (
                            <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              Remaining: ₱{Number(payment.remainingBalance).toLocaleString()}
                            </div>
                          ) : (payment.paymentKind === 'membership_registration' || payment.paymentKind === 'membership' || (!payment.eventId && !payment.paymentKind)) ? (
                            <div className="text-[11px] font-normal text-gray-500 dark:text-slate-400">
                              ₱250 / person
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="text-gray-950 font-medium">{formattedMethod}</span>
                      {payment.referenceNumber && (
                        <div className="text-xs text-gray-500 font-mono mt-0.5">Ref: {payment.referenceNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        <Badge variant={getStatusColor(status)}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{payment.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          className="p-2 hover:bg-gray-100 rounded transition-colors"
                          aria-label="View payment"
                          onClick={() => setViewing(payment)}
                        >
                          <Eye size={16} className="text-gray-600" />
                        </button>
                        {canVerify && status === 'pending' && (
                          <button
                            className="p-2 hover:bg-gray-100 rounded transition-colors"
                            aria-label="Verify payment"
                            onClick={() => setConfirmAction({ payment, status: 'verified' })}
                          >
                            <Edit2 size={16} className="text-blue-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {paginatedPayments.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {isLoading ? 'Loading...' : 'No payments found matching your criteria.'}
            </div>
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </Card>
      </div>

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Payment Details"
        size="lg"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {!isMember && (
                <div>
                  <span className="font-semibold">Member:</span> {viewing.memberName}
                  {viewing.memberEmail && <span className="text-gray-500 text-xs block">{viewing.memberEmail}</span>}
                </div>
              )}
              <div>
                <span className="font-semibold">Institution / Affiliation:</span>{' '}
                {viewing.institutionName ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-xs">
                      🏫 {viewing.institutionName}
                    </span>
                    <a
                      href={`/institution-members?search=${encodeURIComponent(viewing.institutionName)}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      View in Roster ↗
                    </a>
                  </div>
                ) : (
                  <span className="text-gray-500 text-xs block italic">Individual / General Member</span>
                )}
              </div>
              <div><span className="font-semibold">Payment Type:</span> {viewing.event || (viewing.paymentKind === 'institution_batch_registration' ? 'Institution Batch Member Registration' : viewing.paymentKind === 'institution_partial_payment' ? 'Institution Partial / Settlement' : viewing.paymentKind === 'membership_renewal' ? 'Membership Renewal' : viewing.paymentKind === 'membership_registration' ? 'Membership Registration' : 'Membership Fee')}</div>
              <div><span className="font-semibold">Amount Paid:</span> <strong className="text-blue-600 dark:text-blue-400">₱{Number(viewing.amount || 0).toLocaleString()}</strong></div>
              <div><span className="font-semibold">Method:</span> {formatPaymentMethod(viewing.method || viewing.paymentMethod)}</div>
              <div><span className="font-semibold">Reference Number:</span> <span className="font-mono">{viewing.referenceNumber || 'N/A'}</span></div>
              <div><span className="font-semibold">Status:</span> {getVerificationStatus(viewing)}</div>
              <div><span className="font-semibold">Date Submitted:</span> {viewing.date}</div>
            </div>

            {/* Batch Registration Official Billing Breakdown */}
            {(viewing.totalHeads || viewing.paymentKind === 'institution_batch_registration' || viewing.billingBreakdown) && (
              <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-200/60 dark:border-indigo-800/60 pb-2">
                  <div className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                    <span>📄 Official Billing Breakdown</span>
                    {viewing.isPartial ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        Partial Payment
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        Full Payment
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    Rate: ₱250.00 / head
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-gray-700 dark:text-slate-300">
                  <div className="flex justify-between items-center">
                    <span>Total Members Uploaded:</span>
                    <span className="font-semibold">{viewing.totalHeads || (viewing.billingBreakdown?.totalHeads) || 'N/A'} Persons</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Amount Per Head ({viewing.totalHeads || viewing.billingBreakdown?.totalHeads || 0} × ₱250.00):</span>
                    <span className="font-medium">
                      ₱{(viewing.grossAmount ?? ((viewing.totalHeads || 0) * 250)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Complimentary Discount ({viewing.freeSlots ?? 2} Free Slots):</span>
                    <span>-₱{(viewing.discountAmount ?? ((viewing.freeSlots ?? 2) * 250)).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-indigo-200/60 dark:border-indigo-800/60 pt-1.5 flex justify-between items-center text-sm font-bold text-gray-900 dark:text-slate-100">
                    <span>Total Bill (Net Payable):</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      ₱{(viewing.netAmount ?? Math.max(0, ((viewing.totalHeads || 0) * 250) - ((viewing.freeSlots ?? 2) * 250))).toLocaleString()}
                    </span>
                  </div>

                  {viewing.isPartial && (
                    <div className="pt-2 border-t border-dashed border-indigo-200 dark:border-indigo-800 space-y-1">
                      <div className="flex justify-between items-center text-blue-700 dark:text-blue-300 font-semibold">
                        <span>Partial Amount Paid:</span>
                        <span>₱{Number(viewing.partialAmount ?? viewing.amount ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-amber-700 dark:text-amber-300 font-semibold">
                        <span>Remaining Balance:</span>
                        <span>₱{Number(viewing.remainingBalance ?? 0).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {viewing.proofUrl ? (
              <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900">
                    {['through_officer', 'cash_officer'].includes(String(viewing.method || viewing.paymentMethod).toLowerCase())
                      ? 'Official Receipt (OR) Proof'
                      : 'Transaction Proof / Receipt'}
                  </div>
                  <a
                    href={viewing.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    Open Full Size ↗
                  </a>
                </div>
                <img
                  src={viewing.proofUrl}
                  alt="Transaction proof"
                  className="w-full max-h-96 object-contain rounded border bg-gray-50"
                />
              </div>
            ) : (
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border">No transaction proof uploaded.</div>
            )}

            {/* Payment Audit Logs & Status History */}
            <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900">Payment Audit & Status Logs</h4>
                {viewing.memberName && (
                  <button
                    type="button"
                    onClick={() => {
                      const name = viewing.memberName;
                      setViewing(null);
                      setSearchTerm(name);
                      setSearchParams({ search: name });
                    }}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    Filter All Payments for {viewing.memberName}
                  </button>
                )}
              </div>

              {isLoadingLogs ? (
                <p className="text-xs text-gray-500">Loading logs...</p>
              ) : paymentLogs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {paymentLogs.map((log) => (
                    <div key={log.id} className="text-xs border-l-2 border-primary pl-3 py-1 bg-white rounded shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-800">
                          {log.oldStatus ? `${log.oldStatus.toUpperCase()} → ${log.newStatus.toUpperCase()}` : log.newStatus.toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-[11px]">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <div className="text-gray-600 mt-0.5">By: {log.changedByName}</div>
                      {log.remarks && <div className="text-red-600 italic mt-0.5">Note: {log.remarks}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">No status changes logged yet for this payment.</p>
              )}
            </div>

            {canVerify && getVerificationStatus(viewing) === 'pending' && (
              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setRejecting(viewing);
                    setRejectionReason('');
                  }}
                >
                  Reject
                </Button>
                <Button type="button" variant="success" onClick={() => setConfirmAction({ payment: viewing, status: 'verified' })}>
                  Verify
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!rejecting}
        onClose={() => !isUpdating && setRejecting(null)}
        title="Reject Payment"
        size="lg"
      >
        {rejecting && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">Add a reason for rejection (shown to the member).</p>
            <TextArea
              label="Rejection Reason"
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason((e.target as HTMLTextAreaElement).value)}
              placeholder="e.g. Amount mismatch / unclear screenshot / wrong reference number"
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setRejecting(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setConfirmAction({ payment: rejecting, status: 'rejected', rejectionReason });
                  setRejecting(null);
                }}
                disabled={!rejectionReason.trim()}
              >
                Continue
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <VerifyActionModal
        isOpen={!!confirmAction}
        title={confirmAction?.status === 'verified' ? 'Verify Payment' : 'Reject Payment'}
        message={
          confirmAction?.status === 'verified'
            ? 'Are you sure you want to verify this payment?'
            : 'Are you sure you want to reject this payment?'
        }
        confirmLabel="Accept"
        confirmVariant={confirmAction?.status === 'verified' ? 'primary' : 'danger'}
        onCancel={() => {
          if (isUpdating) return;
          setConfirmAction(null);
        }}
        onVerified={async () => {
          if (!confirmAction) return;
          setIsUpdating(true);
          try {
            const payload: any = { status: confirmAction.status };
            if (confirmAction.status === 'rejected') payload.rejectionReason = String(confirmAction.rejectionReason || '').trim();
            const { data } = await api.verifyPayment(confirmAction.payment.id, payload);
            const updated = data?.payment;
            if (updated) setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            addNotification({
              userId: 'current',
              title: confirmAction.status === 'verified' ? 'Verified' : 'Rejected',
              message: confirmAction.status === 'verified' ? 'Payment verified.' : 'Payment rejected.',
              type: 'success',
              isRead: false,
            });
            setConfirmAction(null);
            setViewing(null);
          } catch (err) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err instanceof Error ? err.message : 'Failed to update payment.',
              type: 'error',
              isRead: false,
            });
          } finally {
            setIsUpdating(false);
          }
        }}
      />

      {/* Member Submit Payment / Pay Fee Modal */}
      <Modal
        isOpen={showPayFeeModal}
        onClose={() => {
          if (isSubmittingFee) return;
          setShowPayFeeModal(false);
          setFeeError(null);
        }}
        title="Submit Payment / Pay Membership Fee"
        size="lg"
      >
        <form onSubmit={handleSubmitFee} className="space-y-4">
          {feeError && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
              {feeError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Payment Purpose"
              required
              options={[
                { value: 'membership_registration', label: 'Membership Fee (₱250.00)' },
                { value: 'membership_renewal', label: 'Membership Renewal (₱250.00)' },
              ]}
              value={feeForm.paymentKind}
              onChange={(e) => {
                const kind = e.target.value;
                setFeeForm((prev) => ({
                  ...prev,
                  paymentKind: kind,
                  amount: 250,
                }));
              }}
            />

            <Input
              label="Amount (PHP)"
              type="number"
              min="1"
              required
              value={feeForm.amount}
              onChange={(e) => setFeeForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
            />
          </div>

          <Select
            label="Payment Method"
            required
            options={PAYMENT_METHOD_OPTIONS}
            value={feeForm.method}
            onChange={(e) => {
              setFeeForm((prev) => ({ ...prev, method: e.target.value }));
              setFeeError(null);
            }}
          />

          {/* Dynamic Instructions Card */}
          <PaymentInstructionsCard method={feeForm.method} />

          {/* Reference Number: strictly required for GCash, optional for others */}
          <Input
            label={
              feeForm.method === 'gcash'
                ? 'GCash Reference Number'
                : feeForm.method === 'cheque'
                ? 'Cheque Number (Optional)'
                : feeForm.method === 'through_officer'
                ? 'Official Receipt (OR) Number (Optional)'
                : 'Reference / Transaction ID (Optional)'
            }
            required={feeForm.method === 'gcash'}
            placeholder={
              feeForm.method === 'gcash'
                ? 'e.g. 100234981723'
                : feeForm.method === 'cheque'
                ? 'e.g. CHQ-0012398'
                : feeForm.method === 'through_officer'
                ? 'e.g. OR-2026-0045'
                : 'e.g. Ref # or Transaction ID'
            }
            value={feeForm.referenceNumber}
            onChange={(e) => setFeeForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
            helperText={
              feeForm.method === 'gcash'
                ? 'Required: Enter the exact reference number shown on your GCash transaction receipt.'
                : undefined
            }
          />

          {/* Dynamic Proof / Receipt File Upload */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
              {feeForm.method === 'through_officer'
                ? 'Upload Official Receipt (OR) *'
                : feeForm.method === 'bank_transfer'
                ? 'Upload Bank Transfer Receipt *'
                : feeForm.method === 'cheque'
                ? 'Upload Cheque Receipt / Copy *'
                : 'Upload GCash Receipt *'}
            </label>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              {feeForm.method === 'through_officer'
                ? 'Please upload a clear scan or photo of your PSITS Officer-issued Official Receipt (OR).'
                : feeForm.method === 'bank_transfer'
                ? 'Please upload a screenshot or photo of your bank deposit slip or transfer confirmation receipt.'
                : feeForm.method === 'cheque'
                ? 'Please upload a clear photo or copy of your issued cheque receipt.'
                : 'Please upload a clear screenshot of your completed GCash payment receipt.'}
            </p>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (!file) return;
                setFeeForm((prev) => ({
                  ...prev,
                  file,
                  previewUrl: URL.createObjectURL(file),
                }));
              }}
              className="block w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100"
            />
            {feeForm.previewUrl && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Receipt Preview:</p>
                <img
                  src={feeForm.previewUrl}
                  alt="Receipt preview"
                  className="max-h-48 rounded border border-gray-200 dark:border-slate-700 object-contain bg-white dark:bg-slate-900 p-1"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingFee}
              onClick={() => {
                setShowPayFeeModal(false);
                setFeeError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingFee}>
              <Upload size={16} />
              Submit Payment Proof
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admin / Officer Record Payment Modal */}
      <Modal
        isOpen={showRecordModal}
        onClose={() => {
          if (!isSubmittingRecord) setShowRecordModal(false);
        }}
        title="Record Payment / Remittance (Admin & Officer Tracking)"
        size="lg"
      >
        <form onSubmit={handleRecordOfflinePayment} className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Log official receipts, cheques, institution partial remittances, batch registrations, or direct member dues into the central Financial Ledger.
          </p>

          {recordError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {recordError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                Payor / Entity Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecordForm(prev => ({
                      ...prev,
                      entityType: 'institution',
                      category: 'institution_partial_payment',
                    }));
                  }}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    recordForm.entityType === 'institution'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-950/50 dark:border-blue-400 dark:text-blue-200'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-800'
                  }`}
                >
                  <Building2 size={15} /> Institution
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecordForm(prev => ({
                      ...prev,
                      entityType: 'member',
                      category: 'membership_registration',
                    }));
                  }}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    recordForm.entityType === 'member'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-950/50 dark:border-blue-400 dark:text-blue-200'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-800'
                  }`}
                >
                  <User size={15} /> Member
                </button>
              </div>
            </div>

            {recordForm.entityType === 'institution' ? (
              <Input
                label="Institution / School Name *"
                placeholder="e.g. STI Gensan, Inc or Villamor College"
                value={recordForm.institutionName}
                onChange={(e) => setRecordForm(prev => ({ ...prev, institutionName: e.target.value }))}
                required
              />
            ) : (
              <Input
                label="Member Full Name *"
                placeholder="e.g. Juan Dela Cruz"
                value={recordForm.memberName}
                onChange={(e) => setRecordForm(prev => ({ ...prev, memberName: e.target.value }))}
                required
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Transaction Category"
              value={recordForm.category}
              options={
                recordForm.entityType === 'institution'
                  ? [
                      { value: 'institution_partial_payment', label: '🏛️ Institution Partial / Settlement' },
                      { value: 'institution_batch_registration', label: '🏫 Institution Batch Registration' },
                      { value: 'event', label: '🎯 Event Delegation Fee' },
                    ]
                  : [
                      { value: 'membership_registration', label: '👤 Membership Registration Fee' },
                      { value: 'membership_renewal', label: '🔄 Membership Renewal' },
                      { value: 'event', label: '🎯 Event Registration Fee' },
                      { value: 'partner_sponsorship', label: '🤝 Partner Sponsorship' },
                    ]
              }
              onChange={(e) => setRecordForm(prev => ({ ...prev, category: e.target.value as any }))}
            />

            <Input
              label="Amount Paid (PHP) *"
              type="number"
              min={1}
              step="any"
              placeholder="e.g. 2500"
              value={recordForm.amount}
              onChange={(e) => setRecordForm(prev => ({ ...prev, amount: e.target.value ? Number(e.target.value) : '' }))}
              required
            />
          </div>

          {/* Partial payment toggle */}
          <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-800 dark:text-slate-200 block">Is Partial Payment / Downpayment?</span>
                <span className="text-[11px] text-gray-500">Record an installment with outstanding balance.</span>
              </div>
              <input
                type="checkbox"
                checked={recordForm.isPartial}
                onChange={(e) => setRecordForm(prev => ({ ...prev, isPartial: e.target.checked }))}
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
            {recordForm.isPartial && (
              <Input
                label="Remaining Balance (PHP)"
                type="number"
                min={0}
                placeholder="e.g. 5000"
                value={recordForm.remainingBalance}
                onChange={(e) => setRecordForm(prev => ({ ...prev, remainingBalance: e.target.value ? Number(e.target.value) : '' }))}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Payment Method"
              options={[
                { value: 'through_officer', label: 'Cash via Officer (OR Issued)' },
                { value: 'cheque', label: 'Cheque / Bank Draft' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'gcash', label: 'GCash' },
                { value: 'paymaya', label: 'PayMaya' },
              ]}
              value={recordForm.method}
              onChange={(e) => setRecordForm(prev => ({ ...prev, method: e.target.value }))}
            />

            <Input
              label="Official Receipt (OR) # / Reference No."
              placeholder="e.g. OR-2026-0089 or Ref #"
              value={recordForm.referenceNumber}
              onChange={(e) => setRecordForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <input
              type="checkbox"
              id="markVerified"
              checked={recordForm.markAsVerified}
              onChange={(e) => setRecordForm(prev => ({ ...prev, markAsVerified: e.target.checked }))}
              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="markVerified" className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 cursor-pointer">
              Directly mark transaction as Verified (Settled) in Financial Ledger
            </label>
          </div>

          {/* Optional proof receipt */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
              Attach Receipt / Cheque / Slip (Optional for Officers)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (!file) return;
                setRecordForm((prev) => ({
                  ...prev,
                  file,
                  previewUrl: URL.createObjectURL(file),
                }));
              }}
              className="block w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-gray-900 dark:text-slate-100"
            />
            {recordForm.previewUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={recordForm.previewUrl} alt="Preview" className="h-12 w-12 object-cover rounded-lg border" />
                <span className="text-xs text-emerald-600 font-medium">Receipt image attached</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingRecord}
              onClick={() => {
                setShowRecordModal(false);
                setRecordError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingRecord} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <CheckCircle2 size={16} />
              Save to Ledger
            </Button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
};
