import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { MainLayout } from '@/shared/layouts';
import { Card, Input, Button, Badge, Select, TextArea } from '@/shared/components/Form';
import { Pagination, Modal } from '@/shared/components/Common';
import { PaymentInstructionsCard } from '@/shared/components/PaymentInstructionsCard';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import {
  Upload,
  Users,
  Search,
  Download,
  Plus,
  Key,
  FileSpreadsheet,
  Receipt,
  Gift,
  CreditCard,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  UserCheck,
} from 'lucide-react';
import { exportToCSV } from '@/shared/utils/export';

type InstitutionMember = {
  id: string;
  institutionUserId?: string;
  institutionName: string;
  fullName: string;
  email?: string;
  contactNumber?: string;
  gender?: string;
  position?: string;
  eventTitle?: string;
  status?: 'pending' | 'approved' | 'rejected';
  date: string;
};

const parseSpreadsheetFile = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return rawData
    .map((row) => {
      const findField = (...names: string[]) => {
        for (const k of Object.keys(row)) {
          const norm = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const n of names) {
            if (norm === n.toLowerCase().replace(/[^a-z0-9]/g, '')) {
              return String(row[k] ?? '').trim();
            }
          }
        }
        return '';
      };

      return {
        fullName: findField('fullname', 'name', 'participantname', 'membername', 'studentname'),
        email: findField('email', 'emailaddress', 'institutionemail', 'useremail'),
        password: findField('password', 'pass', 'initialpassword', 'userpassword', 'loginpassword'),
        contactNumber: findField('contactnumber', 'contact', 'phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactno'),
        gender: findField('gender', 'sex') || 'Male',
        position: findField('position', 'role', 'membertype', 'designation') || 'Student',
        eventTitle: findField('eventtitle', 'event', 'eventname'),
        notes: findField('notes', 'note', 'remarks', 'remark'),
      };
    })
    .filter((x) => Boolean(x.fullName));
};

export const InstitutionMembersPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<InstitutionMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [singleForm, setSingleForm] = useState({
    fullName: '',
    email: '',
    password: '',
    contactNumber: '',
    gender: 'Male',
    position: 'Student',
    eventTitle: '',
    notes: '',
  });

  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        'Full Name': 'Coach Alex Rivera',
        'Email Address': 'alex.rivera@example.com',
        'Login Password': 'Password123!',
        'Contact Number': '09171234567',
        'Gender': 'Male',
        'Position': 'Coach',
        'Event Title': 'PSITS Regional Assembly 2026',
        'Notes': 'Official Coach',
      },
      {
        'Full Name': 'Juan Dela Cruz',
        'Email Address': 'juan.delacruz@example.com',
        'Login Password': 'Password123!',
        'Contact Number': '09181234567',
        'Gender': 'Male',
        'Position': 'Student',
        'Event Title': 'PSITS Regional Assembly 2026',
        'Notes': 'Participant',
      },
      {
        'Full Name': 'Maria Clara',
        'Email Address': 'maria.clara@example.com',
        'Login Password': 'Password123!',
        'Contact Number': '09191234567',
        'Gender': 'Female',
        'Position': 'Student',
        'Event Title': 'PSITS Regional Assembly 2026',
        'Notes': 'Participant',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'institution_members_template.xlsx');
  };

  const handleDownloadCsvTemplate = () => {
    const templateContent = 'fullName,email,password,contactNumber,gender,position,eventTitle,notes\n' +
      'Coach Alex Rivera,alex.rivera@example.com,Password123!,09171234567,Male,Coach,PSITS Regional Assembly 2026,Official Coach\n' +
      'Juan Dela Cruz,juan.delacruz@example.com,Password123!,09181234567,Male,Student,PSITS Regional Assembly 2026,Participant\n' +
      'Maria Clara,maria.clara@example.com,Password123!,09181234567,Female,Student,PSITS Regional Assembly 2026,Participant';
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'institution_members_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSingleAdd = async () => {
    if (!singleForm.fullName.trim()) {
      addNotification({ userId: 'current', title: 'Validation', message: 'Full Name is required.', type: 'error', isRead: false });
      return;
    }

    setIsUploading(true);
    try {
      await api.bulkUploadInstitutionMembers([singleForm]);
      const { data } = await api.getInstitutionMembers();
      if (data?.success) setMembers(data.members || []);
      addNotification({
        userId: 'current',
        title: 'Member Added',
        message: `${singleForm.fullName} added successfully & portal login account provisioned!`,
        type: 'success',
        isRead: false,
      });
      setShowAddModal(false);
      setSingleForm({
        fullName: '',
        email: '',
        password: '',
        contactNumber: '',
        gender: 'Male',
        position: 'Student',
        eventTitle: '',
        notes: '',
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to add institution member.';
      addNotification({
        userId: 'current',
        title: 'Failed',
        message: msg,
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const isInstitutionMember = user?.role === 'member' && user?.memberType === 'institution';
  const canViewAll = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';
  const canApprove = canViewAll;

  const [institutionPayments, setInstitutionPayments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    if (!isInstitutionMember && !canViewAll) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const [membersRes, paymentsRes] = await Promise.allSettled([
          api.getInstitutionMembers(),
          api.getPayments(),
        ]);
        if (!cancelled && membersRes.status === 'fulfilled' && membersRes.value.data?.success) {
          setMembers(membersRes.value.data.members || []);
        }
        if (!cancelled && paymentsRes.status === 'fulfilled' && paymentsRes.value.data?.success) {
          setInstitutionPayments(paymentsRes.value.data.payments || []);
        }
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
  }, [user, isInstitutionMember, canViewAll]);

  // Financial aggregates for the institution
  const totalInstitutionHeads = members.length;
  const ratePerPerson = 250;
  const grossInstitutionAmount = totalInstitutionHeads * ratePerPerson;
  const freeInstitutionSlots = totalInstitutionHeads > 0 ? Math.min(totalInstitutionHeads, 2) : 0;
  const discountInstitutionAmount = freeInstitutionSlots * ratePerPerson;
  const totalInstitutionBill = Math.max(0, grossInstitutionAmount - discountInstitutionAmount);

  const relevantPayments = institutionPayments.filter(
    (p) =>
      p.paymentKind === 'institution_batch_registration' ||
      (!p.eventId && ['membership_registration', 'membership_renewal', 'membership'].includes(p.paymentKind)) ||
      (!p.eventId && !p.paymentKind)
  );

  const totalPaidAmount = relevantPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const hasPartialPayment = relevantPayments.some(
    (p) => p.isPartial || p.paymentStatus === 'partial' || (Number(p.partialAmount) > 0 && Number(p.remainingBalance) > 0)
  ) || (totalPaidAmount > 0 && totalPaidAmount < totalInstitutionBill);

  const partialPaidAmount = hasPartialPayment
    ? relevantPayments.reduce((sum, p) => sum + (Number(p.partialAmount || p.amount) || 0), 0)
    : 0;

  const remainingBalanceAmount = Math.max(0, totalInstitutionBill - totalPaidAmount);

  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.fullName, m.email, m.contactNumber, m.position, m.eventTitle, m.institutionName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [members, searchTerm]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginated = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Batch Upload & Billing State
  const [pendingBatchMembers, setPendingBatchMembers] = useState<any[]>([]);
  const [pendingFileName, setPendingFileName] = useState('');
  const [showBatchBillingModal, setShowBatchBillingModal] = useState(false);
  const [showRosterPreview, setShowRosterPreview] = useState(false);
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [partialAmountInput, setPartialAmountInput] = useState('');
  const [batchPaymentMethod, setBatchPaymentMethod] = useState('gcash');
  const [batchReferenceNumber, setBatchReferenceNumber] = useState('');
  const [batchProofFile, setBatchProofFile] = useState<File | null>(null);
  const [batchProofPreview, setBatchProofPreview] = useState('');
  const [batchReceiptModal, setBatchReceiptModal] = useState<any | null>(null);

  // Reactive Financial Computation
  const batchCount = pendingBatchMembers.length;
  const ratePerHead = 250;
  const grossAmount = batchCount * ratePerHead;
  const freeSlots = Math.min(batchCount, 2);
  const discountAmount = freeSlots * ratePerHead;
  const netAmount = Math.max(0, grossAmount - discountAmount);

  const enteredPartial = parseFloat(partialAmountInput) || 0;
  const isPartialMode = paymentType === 'partial';
  const isPartialValid = isPartialMode && enteredPartial > 0 && enteredPartial < netAmount;
  const finalAmountToPay = isPartialMode && isPartialValid ? enteredPartial : netAmount;
  const remainingBalance = Math.max(0, netAmount - finalAmountToPay);

  const onSelectSpreadsheet = async (file: File) => {
    const allowedExts = ['.csv', '.xlsx', '.xls'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExts.includes(fileExt)) {
      addNotification({
        userId: 'current',
        title: 'Invalid File',
        message: 'Please upload a CSV (.csv) or Excel spreadsheet (.xlsx, .xls) file.',
        type: 'error',
        isRead: false,
      });
      return;
    }

    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.length) {
        addNotification({
          userId: 'current',
          title: 'Invalid Spreadsheet',
          message: 'No valid rows found. Please ensure the spreadsheet has at least a "Full Name" or "Name" column.',
          type: 'error',
          isRead: false,
        });
        return;
      }

      setPendingBatchMembers(parsed);
      setPendingFileName(file.name);
      setPaymentType('full');
      setPartialAmountInput('');
      setBatchPaymentMethod('gcash');
      setBatchReferenceNumber('');
      setBatchProofFile(null);
      setBatchProofPreview('');
      setShowRosterPreview(false);
      setShowBatchBillingModal(true);
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Parsing Failed',
        message: err?.message || 'Could not parse spreadsheet file.',
        type: 'error',
        isRead: false,
      });
    }
  };

  const handleConfirmBatchUpload = async () => {
    if (!pendingBatchMembers.length) return;

    if (isPartialMode) {
      if (!enteredPartial || enteredPartial <= 0) {
        addNotification({
          userId: 'current',
          title: 'Validation Error',
          message: 'Please enter a valid partial amount to pay.',
          type: 'error',
          isRead: false,
        });
        return;
      }
      if (enteredPartial >= netAmount) {
        addNotification({
          userId: 'current',
          title: 'Validation Error',
          message: `Partial amount must be less than the total bill (₱${netAmount.toLocaleString()}). Select Full Payment to pay in full.`,
          type: 'error',
          isRead: false,
        });
        return;
      }
    }

    if (finalAmountToPay > 0 && !batchProofFile) {
      addNotification({
        userId: 'current',
        title: 'Receipt Proof Required',
        message: (batchPaymentMethod === 'through_officer' || batchPaymentMethod === 'cash_officer')
          ? 'Please attach a photo or scan of the Official Receipt (OR) issued by the officer.'
          : 'Please attach a photo or screenshot of your payment receipt.',
        type: 'error',
        isRead: false,
      });
      return;
    }

    if (batchPaymentMethod === 'gcash' && !batchReferenceNumber.trim()) {
      addNotification({
        userId: 'current',
        title: 'Reference Number Required',
        message: 'Please enter your GCash transaction reference number.',
        type: 'error',
        isRead: false,
      });
      return;
    }

    setIsUploading(true);
    try {
      let uploadedProofUrl: string | null = null;
      if (batchProofFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(batchProofFile);
        const base64 = await base64Promise;
        try {
          const uploadRes = await api.uploadPaymentProof(base64);
          if (uploadRes?.data?.url) {
            uploadedProofUrl = uploadRes.data.url;
          } else {
            uploadedProofUrl = base64;
          }
        } catch {
          uploadedProofUrl = base64;
        }
      }

      const generatedRef = batchReferenceNumber.trim() || `BATCH-REG-${Date.now().toString(36).toUpperCase()}`;
      const billingData = {
        isPartial: isPartialMode && isPartialValid,
        partialAmount: isPartialMode && isPartialValid ? enteredPartial : null,
        paymentMethod: batchPaymentMethod,
        referenceNumber: generatedRef,
        proofUrl: uploadedProofUrl,
        eventTitle: pendingBatchMembers[0]?.eventTitle || `Batch Upload (${pendingBatchMembers.length} Members)`,
      };

      const res = await api.bulkUploadInstitutionMembers({
        members: pendingBatchMembers,
        billing: billingData,
      });

      const { data } = await api.getInstitutionMembers();
      if (data?.success) setMembers(data.members || []);

      setShowBatchBillingModal(false);
      setBatchReceiptModal(
        res.data?.billing || {
          totalHeads: batchCount,
          ratePerHead: 250,
          grossAmount,
          freeSlots,
          discountAmount,
          netAmount,
          isPartial: isPartialMode && isPartialValid,
          partialAmount: isPartialMode && isPartialValid ? enteredPartial : null,
          amountPaid: finalAmountToPay,
          remainingBalance,
          referenceNumber: generatedRef,
          paymentMethod: batchPaymentMethod,
          date: new Date().toISOString().slice(0, 10),
        }
      );

      addNotification({
        userId: 'current',
        title: 'Batch Registration Successful',
        message: `${pendingBatchMembers.length} institution member(s) uploaded & official billing generated!`,
        type: 'success',
        isRead: false,
      });

      setPendingBatchMembers([]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to process batch upload and billing.';
      addNotification({
        userId: 'current',
        title: 'Upload Failed',
        message: msg,
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const updateStatus = async (id: string, approve: boolean) => {
    try {
      const { data } = await api.approveInstitutionMember(id, { status: approve ? 'approved' : 'rejected' });
      const updated = data?.member;
      if (updated) {
        setMembers((prev) => prev.map((m) => (String(m.id) === String(updated.id) ? updated : m)));
      }
      addNotification({
        userId: 'current',
        title: approve ? 'Approved' : 'Rejected',
        message: `Member has been ${approve ? 'approved' : 'rejected'}.`,
        type: 'success',
        isRead: false,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update member status.';
      addNotification({
        userId: 'current',
        title: 'Error',
        message: msg,
        type: 'error',
        isRead: false,
      });
    }
  };

  const handleExportCSV = () => {
    const dataToExport = filteredMembers.map((m) => ({
      'Member Name': m.fullName || 'N/A',
      'Institution': m.institutionName || 'N/A',
      'Email': m.email || 'N/A',
      'Contact Number': m.contactNumber || 'N/A',
      'Position': m.position || 'N/A',
      'Fee / Rate': 'PHP 250.00',
      'Event Title': m.eventTitle || 'N/A',
      'Status': m.status || 'pending',
      'Date Added': m.date || 'N/A',
    }));
    exportToCSV('Institution_Members_Export', dataToExport);
  };

  if (!isInstitutionMember && !canViewAll) {
    return (
      <MainLayout>
        <Card className="p-6">
          <p className="text-gray-700">You do not have access to Institution Members.</p>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Institution Members</h1>
            <p className="text-gray-600 mt-2">
              {isInstitutionMember
                ? 'Upload and manage your institution members for event participation and system access.'
                : 'View and manage institution-uploaded member records.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {(isInstitutionMember || canViewAll) && (
              <Button variant="primary" size="lg" onClick={() => setShowAddModal(true)}>
                <Plus size={20} />
                Add Member
              </Button>
            )}
            <Button variant="secondary" size="lg" onClick={handleExportCSV}>
              <Download size={20} />
              Export CSV
            </Button>
          </div>
        </div>

        {(isInstitutionMember || canViewAll) && (
          <Card
            title="Upload Institution Members & Portal Login Setup"
            subtitle="Standard Fee: ₱250.00 / person • Supported Formats: CSV (.csv), Excel (.xlsx, .xls) • Columns: fullName, email, password (optional), contactNumber, gender, position, eventTitle, notes"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-gray-700">
                  Upload your institution participants in bulk via Excel or CSV at <strong>₱250.00 per person</strong> (includes <strong>2 Free Slots</strong> discount per batch registration). Include an <strong>email</strong> and <strong>password</strong> so members can log in directly as <strong>Individual Members</strong> to the PSITS portal.
                </p>
                <div className="flex flex-wrap gap-4 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet size={14} /> Download Excel Template (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download size={14} /> Download CSV Template (.csv)
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 shadow-sm transition-all">
                  <Upload size={16} />
                  {isUploading ? 'Uploading...' : 'Upload Excel / CSV File'}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    disabled={isUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await onSelectSpreadsheet(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Institution Live Billing & Financial Status Breakdown */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-800">
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasPartialPayment ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3.5`}>
                {/* 1. Total Amount */}
                <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                      <Receipt size={13} />
                      Total Amount
                    </div>
                    <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                      ₱{totalInstitutionBill.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      {totalInstitutionHeads} person(s) @ ₱250 {freeInstitutionSlots > 0 ? `• ${freeInstitutionSlots} Free` : ''}
                    </div>
                  </div>
                </div>

                {/* 2. Partial Amount Paid (Included ONLY when partial payment was made) */}
                {hasPartialPayment && (
                  <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Coins size={13} />
                        Partial Amount Paid
                      </div>
                      <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                        ₱{partialPaidAmount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-amber-700/80 font-medium mt-0.5">
                        Initial Downpayment
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Remaining Balance */}
                <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  remainingBalanceAmount > 0
                    ? 'border-rose-200/80 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30'
                    : 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30'
                }`}>
                  <div>
                    <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      remainingBalanceAmount > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                    }`}>
                      <CreditCard size={13} />
                      Remaining Balance
                    </div>
                    <div className={`text-xl font-black mt-0.5 ${
                      remainingBalanceAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      ₱{remainingBalanceAmount.toLocaleString()}
                    </div>
                    <div className={`text-[11px] font-medium mt-0.5 ${
                      remainingBalanceAmount > 0 ? 'text-rose-600/80' : 'text-emerald-600/80'
                    }`}>
                      {remainingBalanceAmount > 0 ? 'To be settled' : 'All balances settled ✓'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <div className="p-6 border-b border-gray-200">
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search member, institution, event, email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Member</th>
                  {canViewAll && (
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Institution</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Fee / Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Date</th>
                  {canApprove && <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginated.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{member.fullName}</td>
                    {canViewAll && <td className="px-6 py-4 text-sm text-gray-600">{member.institutionName || '-'}</td>}
                    <td className="px-6 py-4 text-sm text-gray-600">{member.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.contactNumber || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.position || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-blue-600 dark:text-blue-400">
                      <div>₱250.00</div>
                      <span className="text-[10px] text-gray-400 font-normal">per person</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.eventTitle || '-'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={member.status === 'approved' ? 'success' : member.status === 'rejected' ? 'error' : 'warning'}>
                        {String(member.status || 'pending').charAt(0).toUpperCase() + String(member.status || 'pending').slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.date || '-'}</td>
                    {canApprove && (
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button size="sm" variant="success" onClick={() => updateStatus(String(member.id), true)} disabled={member.status === 'approved'}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => updateStatus(String(member.id), false)} disabled={member.status === 'rejected'}>
                            Reject
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginated.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {isLoading ? 'Loading member list...' : 'No member records found.'}
            </div>
          )}

          <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <Users size={16} />
              {filteredMembers.length} member(s)
            </div>
            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}
          </div>
        </Card>
      </div>

      {/* Add Institution Member Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Institution Member" size="lg">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSingleAdd();
          }}
        >
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3">
            <Key size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong>Individual Member Login Account:</strong> Members added here automatically receive an Individual Member portal login account.
              Set an optional initial password below (or leave blank to allow login using the institution password).
            </div>
          </div>

          <Input
            label="Full Name *"
            placeholder="e.g. Juan Dela Cruz"
            required
            value={singleForm.fullName}
            onChange={(e) => setSingleForm((p) => ({ ...p, fullName: e.target.value }))}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email Address *"
              type="email"
              placeholder="e.g. member@institution.edu.ph"
              required
              value={singleForm.email}
              onChange={(e) => setSingleForm((p) => ({ ...p, email: e.target.value }))}
            />
            <Input
              label="Login Password (optional)"
              type="password"
              placeholder="Set custom login password..."
              value={singleForm.password}
              onChange={(e) => setSingleForm((p) => ({ ...p, password: e.target.value }))}
              helperText="If blank, member can log in using institution password."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Contact Number"
              placeholder="e.g. 09171234567"
              value={singleForm.contactNumber}
              onChange={(e) => setSingleForm((p) => ({ ...p, contactNumber: e.target.value }))}
            />
            <Select
              label="Gender"
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]}
              value={singleForm.gender}
              onChange={(e) => setSingleForm((p) => ({ ...p, gender: (e.target as HTMLSelectElement).value }))}
            />
            <Select
              label="Position / Role"
              options={[
                { value: 'Coach', label: 'Coach' },
                { value: 'Student', label: 'Student' },
                { value: 'Faculty', label: 'Faculty / Adviser' },
                { value: 'Officer', label: 'Student Officer' },
                { value: 'Member', label: 'Member' },
                { value: 'President', label: 'President' },
                { value: 'Vice President', label: 'Vice President' },
                { value: 'Secretary', label: 'Secretary' },
                { value: 'Treasurer', label: 'Treasurer' },
              ]}
              value={singleForm.position}
              onChange={(e) => setSingleForm((p) => ({ ...p, position: (e.target as HTMLSelectElement).value }))}
            />
          </div>

          <Input
            label="Event Title (optional)"
            placeholder="e.g. PSITS Regional Assembly 2026"
            value={singleForm.eventTitle}
            onChange={(e) => setSingleForm((p) => ({ ...p, eventTitle: e.target.value }))}
          />

          <TextArea
            label="Notes / Remarks (optional)"
            rows={2}
            placeholder="Add any specific notes or department details..."
            value={singleForm.notes}
            onChange={(e) => setSingleForm((p) => ({ ...p, notes: (e.target as HTMLTextAreaElement).value }))}
          />

          <div className="border-t border-gray-200 pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isUploading}>
              Add & Provision Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Batch Registration & Official Billing Modal */}
      <Modal
        isOpen={showBatchBillingModal}
        onClose={() => !isUploading && setShowBatchBillingModal(false)}
        title="Batch Member Registration & Billing Assessment"
        size="lg"
      >
        <div className="space-y-5">
          {/* Header Description */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/40 border border-blue-200/80 dark:border-blue-900 rounded-2xl p-4 flex items-start gap-3.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0 mt-0.5">
              <Receipt size={22} />
            </div>
            <div className="text-xs text-gray-800 dark:text-slate-200 leading-relaxed">
              <div className="font-bold text-sm text-gray-900 dark:text-white mb-0.5">
                Batch Upload File: <span className="font-mono text-primary">{pendingFileName}</span>
              </div>
              <div>
                Standard rate is <strong>₱250.00 per head</strong> with <strong>2 Free Slots</strong> automatically applied to every batch registration. Review your calculation below and choose Full or Partial payment.
              </div>
            </div>
          </div>

          {/* 4 Financial Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
              <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-blue-600" />
                Uploaded Heads
              </div>
              <div className="text-xl font-black text-gray-900 dark:text-white mt-1">
                {batchCount} <span className="text-xs font-normal text-gray-500">persons</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
              <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Coins size={14} className="text-indigo-600" />
                Rate Per Head
              </div>
              <div className="text-xl font-black text-gray-900 dark:text-white mt-1">
                ₱{ratePerHead.toLocaleString()}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gift size={14} />
                Complimentary
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {freeSlots} Free <span className="text-xs font-normal">(-₱{discountAmount.toLocaleString()})</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 shadow-xs">
              <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt size={14} />
                Total Bill
              </div>
              <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
                ₱{netAmount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Payment Type Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-700 dark:text-slate-300 tracking-wider">
              Select Payment Option
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType('full')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  paymentType === 'full'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">Full Payment</span>
                  <span className="font-black text-blue-600 dark:text-blue-400">₱{netAmount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Pay the total bill in full today.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('partial')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  paymentType === 'partial'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">Partial Payment</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Flexible
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Pay an initial partial amount and settle the remaining balance later.
                </p>
              </button>
            </div>

            {paymentType === 'partial' && (
              <div className="mt-3 p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-3 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="w-full sm:w-1/2">
                    <Input
                      label="Enter Partial Amount to Pay Now (PHP) *"
                      type="number"
                      min="1"
                      max={Math.max(1, netAmount - 1)}
                      placeholder="e.g. 2000"
                      value={partialAmountInput}
                      onChange={(e) => setPartialAmountInput(e.target.value)}
                      helperText={`Must be between ₱1 and ₱${Math.max(1, netAmount - 1).toLocaleString()}`}
                    />
                  </div>
                  <div className="w-full sm:w-1/2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200 dark:border-amber-800/40 text-right">
                    <div className="text-xs text-gray-500 dark:text-slate-400">Remaining Balance Later</div>
                    <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      ₱{remainingBalance.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Official Total Billing Card (Exact User Requirement) */}
          <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/80 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Official Total Billing Statement
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {paymentType === 'partial' && isPartialValid ? 'Partial Billing' : 'Full Billing'}
              </span>
            </div>

            <div className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
              {/* 1. Total Amount Per Head */}
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600 dark:text-slate-400">
                  Total Amount Per Head (<strong>{batchCount} persons</strong> × <strong>₱250.00</strong>):
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ₱{grossAmount.toLocaleString()}
                </span>
              </div>

              {/* 2. Free 2 Slots Discount */}
              <div className="flex justify-between items-center py-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Gift size={15} />
                  Complimentary Discount ({freeSlots} Free Slots):
                </span>
                <span>-₱{discountAmount.toLocaleString()}</span>
              </div>

              {/* 3. Total Bill */}
              <div className="border-t border-gray-200 dark:border-slate-800 pt-2 flex justify-between items-center text-base font-black text-gray-900 dark:text-white">
                <span>Total Bill (Net Payable):</span>
                <span className="text-indigo-600 dark:text-indigo-400 text-lg">
                  ₱{netAmount.toLocaleString()}
                </span>
              </div>

              {/* 4. Partial Amount (Included ONLY if partial payment is selected) */}
              {paymentType === 'partial' && isPartialValid && (
                <div className="pt-2.5 border-t border-dashed border-indigo-200 dark:border-indigo-800/80 space-y-1.5 bg-indigo-50/40 dark:bg-indigo-950/20 p-2.5 rounded-xl">
                  <div className="flex justify-between items-center text-sm font-bold text-blue-700 dark:text-blue-300">
                    <span>Partial Amount to Pay Now:</span>
                    <span>₱{enteredPartial.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <span>Remaining Balance to Settle Later:</span>
                    <span>₱{remainingBalance.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method & Proof Section */}
          <div className="space-y-3 pt-1">
            <label className="text-xs font-bold uppercase text-gray-700 dark:text-slate-300 tracking-wider flex items-center gap-2">
              <CreditCard size={15} />
              Payment Details & Verification Proof
            </label>

            <Select
              label="Payment Method"
              options={[
                { value: 'through_officer', label: 'Through Officer' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'gcash', label: 'GCash' },
              ]}
              value={batchPaymentMethod}
              onChange={(e) => setBatchPaymentMethod((e.target as HTMLSelectElement).value)}
            />

            <PaymentInstructionsCard method={batchPaymentMethod} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={
                  batchPaymentMethod === 'gcash'
                    ? 'GCash Reference Number *'
                    : batchPaymentMethod === 'through_officer' || batchPaymentMethod === 'cash_officer'
                    ? 'Official Receipt (OR) Number (optional)'
                    : batchPaymentMethod === 'bank_transfer'
                    ? 'Bank Reference Number (optional)'
                    : 'Cheque Number (optional)'
                }
                placeholder={
                  batchPaymentMethod === 'gcash'
                    ? 'e.g. 100234857219'
                    : batchPaymentMethod === 'through_officer' || batchPaymentMethod === 'cash_officer'
                    ? 'e.g. OR-2026-0042'
                    : batchPaymentMethod === 'bank_transfer'
                    ? 'e.g. BNK-837492'
                    : 'e.g. CHQ-0012394'
                }
                value={batchReferenceNumber}
                onChange={(e) => setBatchReferenceNumber(e.target.value)}
                required={batchPaymentMethod === 'gcash'}
                helperText={
                  batchPaymentMethod === 'gcash'
                    ? 'Required: Enter the official reference number from your GCash receipt.'
                    : undefined
                }
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
                  {batchPaymentMethod === 'through_officer' || batchPaymentMethod === 'cash_officer'
                    ? 'Attach Official Receipt (OR) Photo / Scan *'
                    : batchPaymentMethod === 'bank_transfer'
                    ? 'Attach Bank Transfer Receipt / Deposit Slip *'
                    : batchPaymentMethod === 'cheque'
                    ? 'Attach Cheque Receipt / Copy *'
                    : 'Attach GCash Receipt / Screenshot *'}
                </label>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {batchPaymentMethod === 'through_officer' || batchPaymentMethod === 'cash_officer'
                    ? 'Please upload a photo or scan of the Official Receipt (OR) issued by the PSITS officer.'
                    : batchPaymentMethod === 'bank_transfer'
                    ? 'Please upload your bank deposit slip or mobile banking transfer confirmation receipt.'
                    : batchPaymentMethod === 'cheque'
                    ? 'Please upload a photo of the cheque or bank deposit confirmation receipt.'
                    : 'Please upload the full transaction receipt or screenshot from your GCash app.'}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBatchProofFile(file);
                    const reader = new FileReader();
                    reader.onload = () => setBatchProofPreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-slate-300"
                />
                {batchProofPreview && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={batchProofPreview} alt="Proof preview" className="h-12 w-12 object-cover rounded-lg border" />
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 size={14} /> Proof attached
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Roster Preview Accordion */}
          <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRosterPreview((p) => !p)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Users size={15} />
                Preview Uploaded Member Roster ({batchCount} Persons)
              </span>
              {showRosterPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showRosterPreview && (
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {pendingBatchMembers.map((m, idx) => (
                  <div key={idx} className="px-4 py-2 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">
                        {idx + 1}. {m.fullName}
                      </div>
                      <div className="text-gray-500 dark:text-slate-400 text-[11px] truncate">
                        {m.email || 'No email'} • {m.contactNumber || 'No contact'}
                      </div>
                    </div>
                    <div>
                      {String(m.position || '').toLowerCase() === 'coach' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 inline-flex items-center gap-1">
                          <UserCheck size={11} /> COACH
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                          {m.position || 'Student'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-200 dark:border-slate-800 pt-4 flex flex-col sm:flex-row justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowBatchBillingModal(false);
                setPendingBatchMembers([]);
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={isUploading}
              onClick={handleConfirmBatchUpload}
            >
              <CheckCircle2 size={16} />
              Submit Registration & Confirm Billing (₱{finalAmountToPay.toLocaleString()})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Official Billing Receipt Modal */}
      <Modal
        isOpen={Boolean(batchReceiptModal)}
        onClose={() => setBatchReceiptModal(null)}
        title="Official Registration & Billing Receipt"
        size="lg"
      >
        {batchReceiptModal && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="mx-auto w-14 h-14 bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                Batch Registration & Billing Confirmed
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Your institution members roster and billing have been registered in the system.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Reference Number:</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{batchReceiptModal.referenceNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total Registered Members:</span>
                <span className="font-bold text-gray-900 dark:text-white">{batchReceiptModal.totalHeads} Persons</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Rate Per Head:</span>
                <span className="font-semibold text-gray-900 dark:text-white">₱{batchReceiptModal.ratePerHead || 250}.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Gross Amount ({batchReceiptModal.totalHeads} × ₱250.00):</span>
                <span className="font-semibold text-gray-900 dark:text-white">₱{Number(batchReceiptModal.grossAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 font-semibold">
                <span>Complimentary ({batchReceiptModal.freeSlots || 2} Free Slots):</span>
                <span>-₱{Number(batchReceiptModal.discountAmount || 0).toLocaleString()}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-slate-800 pt-2 flex justify-between items-center text-sm font-black text-gray-900 dark:text-white">
                <span>Total Bill:</span>
                <span className="text-indigo-600 dark:text-indigo-400">₱{Number(batchReceiptModal.netAmount || 0).toLocaleString()}</span>
              </div>

              {batchReceiptModal.isPartial && (
                <div className="pt-2 border-t border-dashed border-gray-300 dark:border-slate-700 space-y-1">
                  <div className="flex justify-between items-center font-bold text-blue-600 dark:text-blue-400">
                    <span>Partial Amount Paid:</span>
                    <span>₱{Number(batchReceiptModal.partialAmount || batchReceiptModal.amountPaid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center font-semibold text-amber-600 dark:text-amber-400">
                    <span>Remaining Balance:</span>
                    <span>₱{Number(batchReceiptModal.remainingBalance || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="primary" onClick={() => setBatchReceiptModal(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
};
