import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Trash2,
  Building2,
  Filter,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { exportToCSV } from '@/shared/utils/export';
import { getUserInterfaceKey } from '@/shared/utils/userInterface';

type InstitutionMember = {
  id: string;
  institutionUserId?: string;
  institution_user_id?: string;
  institutionName: string;
  institution_name?: string;
  institutionEmail?: string;
  institution_email?: string;
  fullName: string;
  email?: string;
  password?: string;
  contactNumber?: string;
  gender?: string;
  position?: string;
  eventTitle?: string;
  status?: 'pending' | 'approved' | 'rejected';
  date: string;
};

const generateClientRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let randomPart = '';
  for (let i = 0; i < 6; i += 1) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Psits#${randomPart}`;
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

      let parsedPw = findField('password', 'pass', 'initialpassword', 'userpassword', 'loginpassword');
      if (!parsedPw) {
        parsedPw = generateClientRandomPassword();
      }

      return {
        fullName: findField('fullname', 'name', 'participantname', 'membername', 'studentname'),
        email: findField('email', 'emailaddress', 'institutionemail', 'useremail'),
        password: parsedPw,
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<InstitutionMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [boardTargetInstitution, setBoardTargetInstitution] = useState<any | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [singleForm, setSingleForm] = useState({
    fullName: '',
    email: '',
    password: generateClientRandomPassword(),
    contactNumber: '',
    gender: 'Male',
    position: 'Student',
    eventTitle: '',
    notes: '',
  });

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPassword = async (id: string, pw: string) => {
    try {
      await navigator.clipboard.writeText(pw);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      addNotification({
        userId: 'current',
        title: 'Password Copied',
        message: 'Password copied to clipboard.',
        type: 'info',
        isRead: false,
      });
    } catch {
      // fallback
    }
  };

  const handleRegeneratePassword = async (id: string, memberName: string) => {
    try {
      setRegeneratingId(id);
      const res = await api.generateInstitutionMemberPassword(id);
      if (res.data?.success && res.data.password) {
        const newPw = res.data.password;
        setMembers((prev) =>
          prev.map((m) => (String(m.id) === String(id) ? { ...m, password: newPw } : m))
        );
        setVisiblePasswords((prev) => ({ ...prev, [id]: true }));
        addNotification({
          userId: 'current',
          title: 'Password Generated',
          message: `New random password generated for ${memberName}: ${newPw}`,
          type: 'success',
          isRead: false,
        });
      }
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Generation Failed',
        message: err?.response?.data?.message || 'Could not generate password.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setRegeneratingId(null);
    }
  };

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
        password: generateClientRandomPassword(),
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

  const isInstitutionMember =
    user?.role === 'member' &&
    user?.memberType !== 'individual' &&
    (user?.memberType === 'institution' || getUserInterfaceKey(user) === 'member_institutional');
  const canViewAll = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';
  const canApprove = canViewAll;
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

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

  // Admin Institution Filter & Board State
  const [selectedInstitutionFilter, setSelectedInstitutionFilter] = useState<string>('all');
  const [boardSearchTerm, setBoardSearchTerm] = useState<string>('');
  const [boardStatusFilter, setBoardStatusFilter] = useState<'all' | 'with_balance' | 'settled'>('all');

  // Institution Partial Payment Modal State
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState<boolean>(false);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<string>('');
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<string>('gcash');
  const [partialPaymentRefNumber, setPartialPaymentRefNumber] = useState<string>('');
  const [partialPaymentFile, setPartialPaymentFile] = useState<File | null>(null);
  const [partialPaymentPreview, setPartialPaymentPreview] = useState<string>('');
  const [isSubmittingPartialPayment, setIsSubmittingPartialPayment] = useState<boolean>(false);

  // Financial aggregates for the institution (or global when admin)
  const totalInstitutionHeads = members.length;
  const ratePerPerson = 250;
  const grossInstitutionAmount = totalInstitutionHeads * ratePerPerson;
  const freeInstitutionSlots = totalInstitutionHeads > 0 ? Math.min(totalInstitutionHeads, 2) : 0;
  const discountInstitutionAmount = freeInstitutionSlots * ratePerPerson;
  const totalInstitutionBill = Math.max(0, grossInstitutionAmount - discountInstitutionAmount);

  const relevantPayments = institutionPayments.filter(
    (p) =>
      p.paymentKind === 'institution_batch_registration' ||
      p.paymentKind === 'institution_partial_payment' ||
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

  // Institution Payment List Board breakdown for admin view
  const institutionAccounts = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      email: string;
      headCount: number;
      members: any[];
    }>();

    for (const m of members) {
      const instId = String(m.institutionUserId || m.institution_user_id || m.institutionName || 'unknown');
      const instName = m.institutionName || m.institution_name || 'Unnamed Institution';
      const instEmail = m.institutionEmail || m.institution_email || '';

      if (!map.has(instId)) {
        map.set(instId, {
          id: instId,
          name: instName,
          email: instEmail,
          headCount: 0,
          members: [],
        });
      }
      const entry = map.get(instId)!;
      entry.headCount += 1;
      entry.members.push(m);
      if ((!entry.name || entry.name === 'Unnamed Institution') && instName) entry.name = instName;
      if (!entry.email && instEmail) entry.email = instEmail;
    }

    return Array.from(map.values()).map((inst) => {
      const heads = inst.headCount;
      const rate = 250;
      const gross = heads * rate;
      const free = heads > 0 ? Math.min(heads, 2) : 0;
      const totalAmount = Math.max(0, gross - (free * rate));

      // Match payments belonging to this institution
      const instPayments = institutionPayments.filter((p) => {
        const pMemberId = String(p.memberId || '');
        const pMemberName = String(p.memberName || '').toLowerCase();
        const instNameLower = inst.name.toLowerCase();
        const isKindMatch =
          p.paymentKind === 'institution_batch_registration' ||
          p.paymentKind === 'institution_partial_payment' ||
          (!p.eventId && ['membership_registration', 'membership_renewal', 'membership'].includes(p.paymentKind)) ||
          (!p.eventId && !p.paymentKind);

        return (
          isKindMatch &&
          (pMemberId === inst.id ||
            (instNameLower && pMemberName.includes(instNameLower)) ||
            (pMemberName && instNameLower.includes(pMemberName)))
        );
      });

      const totalPaid = instPayments.reduce((sum, p) => {
        if (p.paymentKind === 'institution_batch_registration') {
          return sum + (Number(p.partialAmount) || (p.isPartial ? 0 : Number(p.amount)) || 0);
        }
        return sum + (Number(p.amount) || 0);
      }, 0);
      const remainingBalance = Math.max(0, totalAmount - totalPaid);
      const hasPartial = totalPaid > 0 && totalPaid < totalAmount;

      return {
        id: inst.id,
        name: inst.name,
        email: inst.email,
        headCount: heads,
        freeSlots: free,
        totalAmount,
        partialAmountPaid: totalPaid,
        remainingBalance,
        hasPartial,
        paymentsCount: instPayments.length,
        status: remainingBalance === 0 && totalPaid > 0 ? 'fully_paid' : (totalPaid > 0 ? 'partial_paid' : 'unpaid'),
      };
    });
  }, [members, institutionPayments]);

  // Selected institution context (when admin selects a specific institution)
  const currentSelectedInst = useMemo(() => {
    if (selectedInstitutionFilter === 'all') return null;
    return institutionAccounts.find((i) => i.id === selectedInstitutionFilter) || null;
  }, [selectedInstitutionFilter, institutionAccounts]);

  // Active metrics to display in the 3 cards
  const displayTotalHeads = currentSelectedInst ? currentSelectedInst.headCount : totalInstitutionHeads;
  const displayTotalBill = currentSelectedInst ? currentSelectedInst.totalAmount : totalInstitutionBill;
  const displayFreeSlots = currentSelectedInst ? currentSelectedInst.freeSlots : freeInstitutionSlots;
  const displayPartialPaid = currentSelectedInst ? currentSelectedInst.partialAmountPaid : partialPaidAmount;
  const displayRemainingBalance = currentSelectedInst ? currentSelectedInst.remainingBalance : remainingBalanceAmount;
  const displayHasPartial = currentSelectedInst ? (currentSelectedInst.hasPartial || displayPartialPaid > 0) : hasPartialPayment;

  // Filtered institution accounts for the Payment List Board
  const filteredBoardAccounts = useMemo(() => {
    return institutionAccounts.filter((inst) => {
      if (boardStatusFilter === 'with_balance' && inst.remainingBalance <= 0) return false;
      if (boardStatusFilter === 'settled' && inst.remainingBalance > 0) return false;
      if (boardSearchTerm.trim()) {
        const term = boardSearchTerm.trim().toLowerCase();
        const matchName = inst.name.toLowerCase().includes(term);
        const matchEmail = (inst.email || '').toLowerCase().includes(term);
        if (!matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [institutionAccounts, boardStatusFilter, boardSearchTerm]);

  const filteredMembers = useMemo(() => {
    let result = members;
    if (canViewAll && selectedInstitutionFilter !== 'all') {
      result = result.filter(
        (m) =>
          String(m.institutionUserId || m.institution_user_id) === selectedInstitutionFilter ||
          m.institutionName === selectedInstitutionFilter
      );
    }
    const q = searchTerm.trim().toLowerCase();
    if (!q) return result;
    return result.filter((m) =>
      [m.fullName, m.email, m.contactNumber, m.gender, m.position, m.eventTitle, m.institutionName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [members, searchTerm, selectedInstitutionFilter, canViewAll]);

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

  const handleConfirmPartialPayment = async () => {
    const amountNum = parseFloat(partialPaymentAmount);
    if (!amountNum || amountNum <= 0) {
      addNotification({
        userId: 'current',
        title: 'Validation Error',
        message: 'Please enter a valid payment amount greater than 0.',
        type: 'error',
        isRead: false,
      });
      return;
    }

    const targetInst = boardTargetInstitution;
    const effectiveRemaining = targetInst ? targetInst.remainingBalance : remainingBalanceAmount;
    const targetInstName = targetInst?.name || user?.fullName || 'Institution';
    const targetUserId = targetInst?.id || user?.id;

    if (amountNum > effectiveRemaining) {
      addNotification({
        userId: 'current',
        title: 'Validation Error',
        message: `Payment amount cannot exceed the remaining balance of ₱${effectiveRemaining.toLocaleString()}.`,
        type: 'error',
        isRead: false,
      });
      return;
    }

    if (partialPaymentMethod === 'gcash' && !partialPaymentRefNumber.trim()) {
      addNotification({
        userId: 'current',
        title: 'Reference Number Required',
        message: 'Please enter the GCash reference number.',
        type: 'error',
        isRead: false,
      });
      return;
    }

    if (!partialPaymentFile && !canViewAll) {
      addNotification({
        userId: 'current',
        title: 'Receipt Required',
        message: (partialPaymentMethod === 'through_officer' || partialPaymentMethod === 'cash_officer')
          ? 'Please attach a photo or scan of the Official Receipt (OR) issued by the officer.'
          : 'Please attach a photo or screenshot of your payment receipt.',
        type: 'error',
        isRead: false,
      });
      return;
    }

    setIsSubmittingPartialPayment(true);
    try {
      let uploadedProofUrl: string | null = null;
      if (partialPaymentFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(partialPaymentFile);
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

      const generatedRef = partialPaymentRefNumber.trim() || `PARTIAL-${Date.now().toString(36).toUpperCase()}`;
      const isStillPartial = amountNum < effectiveRemaining;
      const newRemaining = Math.max(0, effectiveRemaining - amountNum);

      await api.createPayment({
        amount: amountNum,
        paymentMethod: partialPaymentMethod,
        method: partialPaymentMethod,
        referenceNumber: generatedRef,
        proofUrl: uploadedProofUrl,
        paymentKind: 'institution_partial_payment',
        eventTitle: `Partial Payment - ${targetInstName}`,
        isPartial: isStillPartial,
        partialAmount: amountNum,
        remainingBalance: newRemaining,
        totalHeads: targetInst ? targetInst.headCount : totalInstitutionHeads,
        ratePerHead: 250,
        grossAmount: targetInst ? (targetInst.headCount * 250) : grossInstitutionAmount,
        discountAmount: targetInst ? (targetInst.freeSlots * 250) : discountInstitutionAmount,
        netAmount: targetInst ? targetInst.totalAmount : totalInstitutionBill,
        institutionName: targetInstName,
        memberId: targetUserId,
        verified: canViewAll ? true : false,
        isDirectlyVerified: canViewAll ? true : false,
        notes: `Partial payment recorded for ${targetInstName}.`,
      });

      // Reload members & payments
      const [membersRes, paymentsRes] = await Promise.allSettled([
        api.getInstitutionMembers(),
        api.getPayments(),
      ]);
      if (membersRes.status === 'fulfilled' && membersRes.value.data?.success) {
        setMembers(membersRes.value.data.members || []);
      }
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value.data?.success) {
        setInstitutionPayments(paymentsRes.value.data.payments || []);
      }

      setShowPartialPaymentModal(false);
      setBoardTargetInstitution(null);
      setPartialPaymentAmount('');
      setPartialPaymentRefNumber('');
      setPartialPaymentFile(null);
      setPartialPaymentPreview('');

      addNotification({
        userId: 'current',
        title: 'Payment Submitted',
        message: `Partial payment of ₱${amountNum.toLocaleString()} for ${targetInstName} submitted successfully! Outstanding balance is now ₱${newRemaining.toLocaleString()}.`,
        type: 'success',
        isRead: false,
      });
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Submission Failed',
        message: err?.response?.data?.message || err?.message || 'Could not submit partial payment.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsSubmittingPartialPayment(false);
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

  const handleDeleteMember = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from institution members?`)) {
      return;
    }
    try {
      await api.deleteInstitutionMember(id);
      setMembers((prev) => prev.filter((m) => String(m.id) !== String(id)));
      addNotification({
        userId: 'current',
        title: 'Member Removed',
        message: `"${name}" has been removed successfully.`,
        type: 'success',
        isRead: false,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to remove institution member.';
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
      'Password': m.password || 'N/A',
      'Contact Number': m.contactNumber || 'N/A',
      'Position': m.position || 'N/A',
      'Fee / Rate': 'PHP 250.00',
      'Gender': m.gender || 'N/A',
      'Status': m.status || 'pending',
      'Date Added': m.date || 'N/A',
    }));
    exportToCSV('Institution_Members_Export', dataToExport);
  };

  if (!isInstitutionMember && !canViewAll) {
    return (
      <MainLayout>
        <Card className="p-8 text-center max-w-md mx-auto my-12 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-2xl">
              <Building2 size={36} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Access Restricted</h2>
            <p className="text-gray-600 dark:text-slate-400 text-sm max-w-sm">
              You do not have access to Institution Members. This section is reserved for institutional member accounts and administrators.
            </p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => navigate('/dashboard')}
            >
              Return to Dashboard
            </Button>
          </div>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Institution Members</h1>
            <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm">
              {isInstitutionMember
                ? 'Upload and manage your institution members for event participation and system access.'
                : 'View and manage institution-uploaded member records.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {(isInstitutionMember || canViewAll) && (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    setSingleForm((prev) => ({ ...prev, password: prev.password || generateClientRandomPassword() }));
                    setShowAddModal(true);
                  }}
                >
                  <Plus size={20} />
                  Add Member
                </Button>
                <input
                  ref={fileInputRef}
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
                <Button
                  variant="primary"
                  size="lg"
                  disabled={isUploading}
                  isLoading={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={20} />
                  {isUploading ? 'Uploading...' : 'Upload Excel / CSV File'}
                </Button>
              </>
            )}
            {isInstitutionMember && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setPartialPaymentAmount('');
                  setPartialPaymentMethod('gcash');
                  setPartialPaymentRefNumber('');
                  setPartialPaymentFile(null);
                  setPartialPaymentPreview('');
                  setShowPartialPaymentModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-sm"
              >
                <Coins size={20} />
                Make Partial Payment
              </Button>
            )}
            <Button variant="secondary" size="lg" onClick={handleExportCSV}>
              <Download size={20} />
              Export CSV
            </Button>
          </div>
        </div>

        {(isInstitutionMember || canViewAll) && (
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-4">
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

            {/* Institution Live Billing & Financial Status Breakdown */}
              {canViewAll && selectedInstitutionFilter !== 'all' && (
                <div className="mb-3 flex items-center justify-between bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-900 dark:text-blue-200">
                  <span>Filtered Financials: <strong>{currentSelectedInst?.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => setSelectedInstitutionFilter('all')}
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <X size={12} /> Show Combined Totals
                  </button>
                </div>
              )}
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${displayHasPartial ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3.5`}>
                {/* 1. Total Amount */}
                <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                      <Receipt size={13} />
                      Total Amount
                    </div>
                    <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                      ₱{displayTotalBill.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      {displayTotalHeads} person(s) @ ₱250 {displayFreeSlots > 0 ? `• ${displayFreeSlots} Free` : ''}
                    </div>
                  </div>
                </div>

                {/* 2. Partial Amount Paid (Included ONLY when partial payment was made) */}
                {displayHasPartial && (
                  <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Coins size={13} />
                        Partial Amount Paid
                      </div>
                      <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                        ₱{displayPartialPaid.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-amber-700/80 font-medium mt-0.5">
                        Initial Downpayment
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Remaining Balance */}
                <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  displayRemainingBalance > 0
                    ? 'border-rose-200/80 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30'
                    : 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30'
                }`}>
                  <div>
                    <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      displayRemainingBalance > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                    }`}>
                      <CreditCard size={13} />
                      Remaining Balance
                    </div>
                    <div className={`text-xl font-black mt-0.5 ${
                      displayRemainingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      ₱{displayRemainingBalance.toLocaleString()}
                    </div>
                    <div className={`text-[11px] font-medium mt-0.5 ${
                      displayRemainingBalance > 0 ? 'text-rose-600/80' : 'text-emerald-600/80'
                    }`}>
                      {displayRemainingBalance > 0 ? 'To be settled' : 'All balances settled ✓'}
                    </div>
                  </div>

                  {/* Partial Payment Button for Institution Side */}
                  {!canViewAll && displayRemainingBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPartialPaymentAmount('');
                        setPartialPaymentMethod('gcash');
                        setPartialPaymentRefNumber('');
                        setPartialPaymentFile(null);
                        setPartialPaymentPreview('');
                        setShowPartialPaymentModal(true);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Coins size={14} />
                      Make Partial Payment
                    </button>
                  )}
                </div>
              </div>
          </Card>
        )}

        {/* ── Admin Institution Payment List Board ────────────────── */}
        {canViewAll && (
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  <Building2 size={20} />
                </div>
                <div>
                  <div className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                    Institution Payment List Board
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      Admin Tracking
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 font-normal">
                    Track each institution's total amount, partial amount paid, and remaining balance in real time.
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/payments?category=institution')}
                className="text-xs font-bold text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 shrink-0"
              >
                <Receipt size={14} /> Open Payment Tracking Ledger ↗
              </Button>
            </div>
            {/* Top Toolbar: Search and Filter Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search institution..."
                  value={boardSearchTerm}
                  onChange={(e) => setBoardSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center rounded-xl border border-gray-200 dark:border-slate-800 p-1 bg-gray-50 dark:bg-slate-900/60 text-xs">
                <button
                  type="button"
                  onClick={() => setBoardStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    boardStatusFilter === 'all'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                  }`}
                >
                  All ({institutionAccounts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBoardStatusFilter('with_balance')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    boardStatusFilter === 'with_balance'
                      ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                  }`}
                >
                  With Balance ({institutionAccounts.filter((i) => i.remainingBalance > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setBoardStatusFilter('settled')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    boardStatusFilter === 'settled'
                      ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                  }`}
                >
                  Settled ({institutionAccounts.filter((i) => i.remainingBalance === 0).length})
                </button>
              </div>
            </div>

            {/* Board Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 dark:bg-slate-900/80 border-b border-gray-200 dark:border-slate-800 text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Institution Name</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Partial Amount Paid</th>
                    <th className="py-3 px-4">Remaining Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 font-medium">
                  {filteredBoardAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-slate-500">
                        No institutions match the current search or filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBoardAccounts.map((inst) => {
                      const isSelected = selectedInstitutionFilter === inst.id;
                      const percentPaid = inst.totalAmount > 0
                        ? Math.min(100, Math.round((inst.partialAmountPaid / inst.totalAmount) * 100))
                        : 0;

                      return (
                        <tr
                          key={inst.id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/30'
                              : 'hover:bg-gray-50/60 dark:hover:bg-slate-900/40'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-xs shrink-0">
                                {inst.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                                  {inst.name}
                                  {isSelected && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                                      Active Filter
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>{inst.headCount} member(s)</span>
                                  <span>•</span>
                                  <span>{inst.freeSlots} Free Slots</span>
                                  {inst.email && (
                                    <>
                                      <span>•</span>
                                      <span className="text-gray-400">{inst.email}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-black text-indigo-700 dark:text-indigo-400 text-sm">
                              ₱{inst.totalAmount.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {inst.headCount} × ₱250
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-black text-amber-600 dark:text-amber-400 text-sm flex items-center gap-1.5">
                              ₱{inst.partialAmountPaid.toLocaleString()}
                              <span className="text-[10px] font-bold text-gray-400">
                                ({percentPaid}%)
                              </span>
                            </div>
                            <div className="w-28 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div
                                className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${percentPaid}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className={`font-black text-sm ${
                              inst.remainingBalance > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              ₱{inst.remainingBalance.toLocaleString()}
                            </div>
                            <div className={`text-[10px] font-medium ${
                              inst.remainingBalance > 0 ? 'text-rose-600/80' : 'text-emerald-600/80'
                            }`}>
                              {inst.remainingBalance > 0 ? 'Outstanding balance' : 'Fully Settled ✓'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {inst.status === 'fully_paid' && (
                              <Badge variant="success">Fully Settled</Badge>
                            )}
                            {inst.status === 'partial_paid' && (
                              <Badge variant="warning">Partial Paid</Badge>
                            )}
                            {inst.status === 'unpaid' && (
                              <Badge variant="error">Unpaid</Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/payments?category=institution&search=${encodeURIComponent(inst.name)}`)}
                                className="text-xs text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-50"
                                title="View all payments for this institution in Payment Tracking"
                              >
                                <Receipt size={13} /> Ledger
                              </Button>

                              {inst.remainingBalance > 0 && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setBoardTargetInstitution(inst);
                                    setPartialPaymentAmount(String(inst.remainingBalance));
                                    setShowPartialPaymentModal(true);
                                  }}
                                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  title="Record or submit payment for this institution"
                                >
                                  <Coins size={13} /> Pay
                                </Button>
                              )}

                              {isSelected ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedInstitutionFilter('all')}
                                  className="text-xs border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-50"
                                >
                                  <X size={13} /> Clear
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedInstitutionFilter(inst.id);
                                    setCurrentPage(1);
                                  }}
                                  className="text-xs hover:border-blue-400 hover:text-blue-600"
                                >
                                  <Filter size={13} /> Filter
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card>
          {canViewAll && selectedInstitutionFilter !== 'all' && (
            <div className="mx-6 mt-6 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 dark:text-blue-200">
                <Filter size={14} className="text-blue-600 dark:text-blue-400" />
                <span>
                  Showing members for: <strong>{currentSelectedInst?.name || 'Selected Institution'}</strong>
                  {' '}({filteredMembers.length} records)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstitutionFilter('all')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X size={13} />
                Clear Filter (Show All Institutions)
              </button>
            </div>
          )}
          <div className="p-6 border-b border-gray-200">
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search member, institution, gender, email..."
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
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Member</th>
                  {canViewAll && (
                    <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Institution</th>
                  )}
                  <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Email</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Password</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Contact</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Position</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Fee / Rate</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Gender</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Status</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Date</th>
                  {canApprove && <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {paginated.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{member.fullName}</td>
                    {canViewAll && <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{member.institutionName || '-'}</td>}
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{member.email || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      {member.password ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200 select-all border border-slate-200 dark:border-slate-700">
                            {visiblePasswords[member.id] ? member.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(member.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title={visiblePasswords[member.id] ? 'Hide password' : 'Show password'}
                          >
                            {visiblePasswords[member.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(member.id, member.password!)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title="Copy password"
                          >
                            {copiedId === member.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                          <button
                            type="button"
                            disabled={regeneratingId === member.id}
                            onClick={() => handleRegeneratePassword(member.id, member.fullName)}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                            title="Regenerate random password"
                          >
                            <RefreshCw size={14} className={regeneratingId === member.id ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={regeneratingId === member.id}
                          onClick={() => handleRegeneratePassword(member.id, member.fullName)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded hover:underline"
                        >
                          <Key size={12} />
                          {regeneratingId === member.id ? 'Generating...' : 'Generate Password'}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{member.contactNumber || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{member.position || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-blue-600 dark:text-blue-400">
                      <div>₱250.00</div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">per person</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{member.gender || '-'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={member.status === 'approved' ? 'success' : member.status === 'rejected' ? 'error' : 'warning'}>
                        {String(member.status || 'pending').charAt(0).toUpperCase() + String(member.status || 'pending').slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{member.date || '-'}</td>
                    {canApprove && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="success" onClick={() => updateStatus(String(member.id), true)} disabled={member.status === 'approved'}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => updateStatus(String(member.id), false)} disabled={member.status === 'rejected'}>
                            Reject
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-600 hover:text-white hover:bg-rose-600 hover:border-rose-600 dark:text-rose-400 dark:hover:bg-rose-600 px-2 py-1.5"
                              onClick={() => handleDeleteMember(String(member.id), member.fullName || 'Member')}
                              title="Remove Member"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
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
              A random password has been generated below for individual login (you may regenerate or customize it anytime).
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Login Password *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="Generated password..."
                  value={singleForm.password}
                  onChange={(e) => setSingleForm((p) => ({ ...p, password: e.target.value }))}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSingleForm((p) => ({ ...p, password: generateClientRandomPassword() }))}
                  title="Generate New Random Password"
                  className="whitespace-nowrap flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw size={14} />
                  Random
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Random password generated for individual member portal login.
              </p>
            </div>
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
                    ? 'Official Receipt (OR) Number'
                    : batchPaymentMethod === 'bank_transfer'
                    ? 'Bank Reference Number'
                    : 'Cheque Number'
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
                      <div className="text-gray-500 dark:text-slate-400 text-[11px] truncate flex items-center gap-1.5 flex-wrap">
                        <span>{m.email || 'No email'}</span>
                        <span>•</span>
                        <span>{m.contactNumber || 'No contact'}</span>
                        {m.password && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              Pass: {m.password}
                            </span>
                          </>
                        )}
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

      {/* Institution Partial Payment Modal */}
      <Modal
        isOpen={showPartialPaymentModal}
        onClose={() => {
          if (!isSubmittingPartialPayment) {
            setShowPartialPaymentModal(false);
            setBoardTargetInstitution(null);
          }
        }}
        title={boardTargetInstitution ? `Record Payment - ${boardTargetInstitution.name}` : "Institution Partial Payment"}
        size="lg"
      >
        {(() => {
          const modalTargetBill = boardTargetInstitution ? boardTargetInstitution.totalAmount : totalInstitutionBill;
          const modalPaidAmount = boardTargetInstitution ? boardTargetInstitution.paidAmount : partialPaidAmount;
          const modalRemainingBalance = boardTargetInstitution ? boardTargetInstitution.remainingBalance : remainingBalanceAmount;

          return (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {boardTargetInstitution
                  ? `Record or submit a payment for ${boardTargetInstitution.name} to reduce their registration balance. All submitted payments are reflected directly in Payment Tracking.`
                  : "Submit a partial payment to reduce your institution's registration balance. All submitted payments are recorded and will update your remaining balance immediately upon verification."}
              </p>

              {/* Balance Overview Snapshot */}
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Institution Total Bill:</span>
                  <span className="font-bold text-gray-900 dark:text-white">₱{modalTargetBill.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Total Paid So Far:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">₱{modalPaidAmount.toLocaleString()}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-slate-800 pt-2 flex justify-between items-center text-sm font-black">
                  <span className="text-rose-600 dark:text-rose-400">Current Outstanding Balance:</span>
                  <span className="text-rose-600 dark:text-rose-400 text-base">₱{modalRemainingBalance.toLocaleString()}</span>
                </div>
              </div>

              {modalRemainingBalance <= 0 ? (
                <div className="py-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white">All Balances Fully Settled</h4>
                  <p className="text-xs text-gray-500">
                    {boardTargetInstitution
                      ? `${boardTargetInstitution.name} has no remaining balance due.`
                      : 'Your institution has no remaining balance due. Thank you for completing your payments!'}
                  </p>
                  <div className="pt-3">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setShowPartialPaymentModal(false);
                        setBoardTargetInstitution(null);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Payment Amount Input & Quick Select Chips */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                        Payment Amount (₱) *
                      </label>
                      <span className="text-[11px] text-gray-400">
                        Max: ₱{modalRemainingBalance.toLocaleString()}
                      </span>
                    </div>

                    {/* Quick Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {[300, 1000, 2000, 5000]
                        .filter((amt) => amt < modalRemainingBalance)
                        .map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setPartialPaymentAmount(String(amt))}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                              partialPaymentAmount === String(amt)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50'
                            }`}
                          >
                            ₱{amt.toLocaleString()}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => setPartialPaymentAmount(String(modalRemainingBalance))}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-colors cursor-pointer ${
                          partialPaymentAmount === String(modalRemainingBalance)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        Pay Full Balance (₱{modalRemainingBalance.toLocaleString()})
                      </button>
                    </div>

                    <Input
                      type="number"
                      min="1"
                      max={modalRemainingBalance}
                      step="any"
                      placeholder="Enter amount to pay (e.g. 300)"
                      value={partialPaymentAmount}
                      onChange={(e) => setPartialPaymentAmount(e.target.value)}
                    />

                    {parseFloat(partialPaymentAmount) > 0 && (
                      <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-1 text-xs">
                        <div className="flex justify-between items-center text-blue-900 dark:text-blue-200">
                          <span>Amount paying now:</span>
                          <strong className="font-bold text-sm">₱{Number(partialPaymentAmount).toLocaleString()}</strong>
                        </div>
                        <div className="flex justify-between items-center text-amber-700 dark:text-amber-400 font-semibold">
                          <span>Remaining balance after this payment:</span>
                          <strong>₱{Math.max(0, modalRemainingBalance - parseFloat(partialPaymentAmount)).toLocaleString()}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-3 pt-2">
                    <Select
                      label="Payment Method"
                      options={[
                        { value: 'through_officer', label: 'Cash via Officer / On-site' },
                        { value: 'gcash', label: 'GCash' },
                        { value: 'bank_transfer', label: 'Bank Transfer' },
                        { value: 'cheque', label: 'Cheque' },
                      ]}
                      value={partialPaymentMethod}
                      onChange={(e) => setPartialPaymentMethod((e.target as HTMLSelectElement).value)}
                    />

                    <PaymentInstructionsCard method={partialPaymentMethod} />

                    {/* Reference Number Field */}
                    {partialPaymentMethod === 'gcash' ? (
                      <Input
                        label="GCash Reference Number *"
                        placeholder="e.g. 100234567890"
                        value={partialPaymentRefNumber}
                        onChange={(e) => setPartialPaymentRefNumber(e.target.value)}
                        required
                      />
                    ) : (
                      <Input
                        label={
                          partialPaymentMethod === 'through_officer'
                            ? 'Official Receipt (OR) Number'
                            : partialPaymentMethod === 'cheque'
                            ? 'Cheque / Deposit Number'
                            : 'Bank Reference / Transaction Number'
                        }
                        placeholder="Enter reference or OR number"
                        value={partialPaymentRefNumber}
                        onChange={(e) => setPartialPaymentRefNumber(e.target.value)}
                      />
                    )}

                    {/* Receipt Upload Field */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                        {canViewAll ? 'Attach Receipt / Slip (Optional for Admin)' : 'Upload Receipt / Proof *'}
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setPartialPaymentFile(file);
                          const reader = new FileReader();
                          reader.onload = () => setPartialPaymentPreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                        className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-slate-300"
                      />
                      {partialPaymentPreview && (
                        <div className="mt-2 flex items-center gap-2">
                          <img src={partialPaymentPreview} alt="Receipt preview" className="h-12 w-12 object-cover rounded-lg border" />
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 size={14} /> Receipt attached
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-800">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPartialPaymentModal(false);
                        setBoardTargetInstitution(null);
                      }}
                      disabled={isSubmittingPartialPayment}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      isLoading={isSubmittingPartialPayment}
                      onClick={handleConfirmPartialPayment}
                      disabled={
                        isSubmittingPartialPayment ||
                        !partialPaymentAmount ||
                        parseFloat(partialPaymentAmount) <= 0 ||
                        parseFloat(partialPaymentAmount) > modalRemainingBalance ||
                        (!canViewAll && !partialPaymentFile) ||
                        (partialPaymentMethod === 'gcash' && !partialPaymentRefNumber.trim())
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <Coins size={16} />
                      {canViewAll ? 'Record Payment' : 'Submit Payment'} {parseFloat(partialPaymentAmount) > 0 ? `(₱${Number(partialPaymentAmount).toLocaleString()})` : ''}
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </Modal>
    </MainLayout>
  );
};
