
// Author: Mark Daniel Digol
import { useEffect, useMemo, useState, useRef } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input, TextArea, Select, Badge } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { useAuth } from '@/shared/context/AuthContext';
import { Users, MapPin, Plus, Pencil, Power, FileSpreadsheet, Upload, CheckCircle, Megaphone, Eye, Sparkles, ChevronRight, ChevronLeft, Layers, Trophy, Trash2, Download, Search, Play, UserCheck, ShieldCheck, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '@/shared/services/api';
import { useNotification } from '@/shared/context/NotificationContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { PaymentInstructionsCard } from '@/shared/components/PaymentInstructionsCard';

type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
type RegistrationOverride = '' | 'open' | 'closed';

export const EVENT_CATEGORIES = [
  { value: 'competition', label: 'Competition' },
  { value: 'contest', label: 'Contest' },
  { value: 'esports', label: 'Esports' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'conference', label: 'Conference' },
  { value: 'other', label: 'Other' },
];

export const getCategoryLabel = (val?: string) => {
  if (!val) return 'Seminar';
  const found = EVENT_CATEGORIES.find((c) => c.value.toLowerCase() === val.toLowerCase());
  return found ? found.label : (val.charAt(0).toUpperCase() + val.slice(1));
};

export const getParticipantCapacityLabel = (mode?: string) => {
  const m = String(mode || '').toLowerCase();
  if (m === 'pair') return 'Pair Participant';
  if (m === 'team') return 'Team Participant';
  return 'Participant';
};

const PARTICIPANT_TEMPLATE =
  'fullName,email,contactNumber,gender,position,eventTitle,notes\nJuan Dela Cruz,juan@example.com,09123456789,Male,Participant,Sample Event,Team A';

const PARTICIPANT_TEMPLATES: Record<string, { label: string; content: string }> = {
  default: {
    label: 'Default Participants (CSV)',
    content: PARTICIPANT_TEMPLATE,
  },
  minimal: {
    label: 'Minimal Participants (CSV)',
    content: 'fullName,email,contactNumber,eventTitle\nJuan Dela Cruz,juan@example.com,09123456789,Sample Event',
  },
};

const TEMPLATE_STORAGE_KEY = 'psits_participant_templates_v1';
type StoredTemplate = {
  label: string;
  kind: 'text' | 'dataUrl';
  content: string;
  filename?: string;
};

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });


const parseSpreadsheetFile = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return rawData.map((row) => {
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
      fullName: findField('fullname', 'name', 'participantname', 'membername'),
      email: findField('email', 'emailaddress'),
      contactNumber: findField('contactnumber', 'contact', 'phone', 'phonenumber'),
      gender: findField('gender', 'sex'),
      position: findField('position', 'role'),
      eventTitle: findField('eventtitle', 'event'),
      notes: findField('notes', 'remarks'),
    };
  }).filter((x) => Boolean(x.fullName));
};

const formatCurrency = (value: number) => `PHP ${Number(value || 0).toLocaleString()}`;

const splitIsoToDateTime = (iso?: string | null) => {
  if (!iso) return { date: '', time: '' };
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
};

export const EventsPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | 'draft'>('upcoming');
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<any | null>(null);

  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [confirmSaveEvent, setConfirmSaveEvent] = useState(false);
  const [pendingEventPayload, setPendingEventPayload] = useState<any | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ eventId: string; nextStatus: EventStatus; title: string } | null>(null);
  const [confirmStartEvent, setConfirmStartEvent] = useState<{ eventId: string; title: string } | null>(null);
  const [confirmCompleteEvent, setConfirmCompleteEvent] = useState<{ eventId: string; title: string } | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmPaymentSubmit, setConfirmPaymentSubmit] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentEvent, setPaymentEvent] = useState<any | null>(null);
  const [paymentFlow, setPaymentFlow] = useState<'pre_register' | 'post_register'>('post_register');
  const [teamProfileFile, setTeamProfileFile] = useState<File | null>(null);
  const [teamProfilePreview, setTeamProfilePreview] = useState('');
  const [teamProfileError, setTeamProfileError] = useState<string | null>(null);
  const teamProfileInputRef = useRef<HTMLInputElement>(null);

  const [participantFileName, setParticipantFileName] = useState('');
  const [participantUploadCount, setParticipantUploadCount] = useState(0);
  const [isUploadingParticipants, setIsUploadingParticipants] = useState(false);
  const [institutionRoster, setInstitutionRoster] = useState<any[]>([]);
  const [isLoadingInstitutionRoster, setIsLoadingInstitutionRoster] = useState(false);
  const [selectedInstitutionMemberIds, setSelectedInstitutionMemberIds] = useState<string[]>([]);
  const [registrationSource, setRegistrationSource] = useState<'select' | 'upload'>('select');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [pendingInstitutionParticipants, setPendingInstitutionParticipants] = useState<any[]>([]);
  const [registeredEventIds, setRegisteredEventIds] = useState<Record<string, boolean>>({});
  const [memberStatusByEvent, setMemberStatusByEvent] = useState<Record<string, string>>({});
  const [eventRegistrations, setEventRegistrations] = useState<any[]>([]);
  const [eventParticipants, setEventParticipants] = useState<any[]>([]);
  const [isLoadingDetailsLists, setIsLoadingDetailsLists] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{
    kind: 'registration' | 'participant';
    id: string;
    approve: boolean;
    name: string;
  } | null>(null);

  const [memberPayments, setMemberPayments] = useState<any[]>([]);

  const [paymentForm, setPaymentForm] = useState<{
    method: 'through_officer' | 'bank_transfer' | 'cheque' | 'gcash' | string;
    amount: number;
    referenceNumber: string;
    file: File | null;
    previewUrl: string;
  }>({
    method: 'gcash',
    amount: 0,
    referenceNumber: '',
    file: null,
    previewUrl: '',
  });

  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'schedule' | 'guidelines'>('basic');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    guidelines: '',
    guidelinesFile: null as File | null,
    guidelinesFileUrl: '',
    guidelinesFileName: '',
    guidelineFileName: '',
    registrationMode: '',
    registrationOverride: '' as RegistrationOverride,
    registrationStartDate: '',
    registrationStartTime: '',
    registrationEndDate: '',
    registrationEndTime: '',
    eventType: '',
    categorySelect: '',
    customCategoryText: '',
    location: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    fee: 0,
    capacity: 0,
    isUnlimitedCapacity: true,
    status: '' as EventStatus,
    isEsports: false,
    esportsGame: '',
    esportsBracketFormat: '',
    bannerUrl: '',
    bannerFile: null as File | null,
    bannerPreviewUrl: '',
    themeColor: '#2563eb',
    customBadge: '',
    requiresCoach: false,
    hasOfficerModerator: false,
    moderatorOfficerId: '',
    moderatorOfficerName: '',
    moderatorOfficerIds: [] as string[],
  });

  const [selectedCoachMemberId, setSelectedCoachMemberId] = useState<string>('');
  const [officersList, setOfficersList] = useState<any[]>([]);
  const [isLoadingOfficers, setIsLoadingOfficers] = useState<boolean>(false);

  const canManageEvents = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';
  const isMember = user?.role === 'member';
  const isInstitution = isMember && user?.memberType === 'institution';

  const uniqueInstitutionMembers = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of institutionRoster) {
      const key = (m.email || m.fullName || '').trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, m);
      }
    }
    return Array.from(map.values());
  }, [institutionRoster]);

  const filteredInstitutionMembers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return uniqueInstitutionMembers;
    return uniqueInstitutionMembers.filter((m) =>
      [m.fullName, m.email, m.contactNumber, m.position].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [uniqueInstitutionMembers, memberSearchQuery]);

  const selectedMembers = useMemo(() => {
    return uniqueInstitutionMembers.filter((m) => selectedInstitutionMemberIds.includes(String(m.id)));
  }, [uniqueInstitutionMembers, selectedInstitutionMemberIds]);

  const toggleSelectMember = (id: string) => {
    setSelectedInstitutionMemberIds((prev) => {
      const willSelect = !prev.includes(id);
      const member = uniqueInstitutionMembers.find((m) => String(m.id) === id);
      const isCoach = (member?.position || '').toLowerCase().includes('coach');
      if (willSelect && isCoach && !selectedCoachMemberId) {
        setSelectedCoachMemberId(id);
      } else if (!willSelect && selectedCoachMemberId === id) {
        setSelectedCoachMemberId('');
      }
      return willSelect ? [...prev, id] : prev.filter((x) => x !== id);
    });
    setTeamProfileError(null);
  };
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);
  const [showTemplateUploadModal, setShowTemplateUploadModal] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('default');
  const [templateContextTitle, setTemplateContextTitle] = useState('Sample Event');
  const [customTemplates, setCustomTemplates] = useState<Record<string, StoredTemplate>>({});
  const resetPaymentForm = (amount = 0) => {
    if (paymentForm.previewUrl) URL.revokeObjectURL(paymentForm.previewUrl);
    setPaymentForm({ method: 'gcash', amount, referenceNumber: '', file: null, previewUrl: '' });
  };
  const closePaymentModal = () => {
    if (isSubmittingPayment) return;
    setPaymentError(null);
    setPaymentEvent(null);
    setPaymentFlow('post_register');
    setConfirmPaymentSubmit(false);
    setShowPaymentModal(false);
    resetPaymentForm(0);
  };
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.getEvents({ status: filterStatus });
        if (!cancelled && data?.success) setEvents(data.events || []);
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
    return () => {
      if (paymentForm.previewUrl) URL.revokeObjectURL(paymentForm.previewUrl);
    };
  }, [paymentForm.previewUrl]);

  useEffect(() => {
    return () => {
      if (teamProfilePreview) URL.revokeObjectURL(teamProfilePreview);
    };
  }, [teamProfilePreview]);

  const getEventPaymentStats = (eventId: string | number, fee: number) => {
    const eventPays = memberPayments.filter(
      (p) => String(p.eventId) === String(eventId)
    );
    const totalVerifiedPaid = eventPays
      .filter((p) => String(p.verificationStatus || p.status || '').toLowerCase() === 'verified')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPendingPaid = eventPays
      .filter((p) => String(p.verificationStatus || p.status || '').toLowerCase() === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remainingBalance = Math.max(0, fee - totalVerifiedPaid);
    const percentPaid = fee > 0 ? Math.min(100, Math.round((totalVerifiedPaid / fee) * 100)) : 0;
    return {
      totalVerifiedPaid,
      totalPendingPaid,
      remainingBalance,
      percentPaid,
    };
  };

  useEffect(() => {
    if (!isMember) return;
    let cancelled = false;
    const loadMyData = async () => {
      try {
        const [regRes, payRes] = await Promise.all([
          api.getMyEventRegistrations(),
          api.getPayments()
        ]);
        if (!cancelled) {
          if (regRes.data?.success) {
            const regs = regRes.data.registrations || [];
            const registeredMap: Record<string, boolean> = {};
            const statusMap: Record<string, string> = {};
            regs.forEach((reg: any) => {
              registeredMap[String(reg.eventId)] = true;
              statusMap[String(reg.eventId)] = reg.status;
            });
            setRegisteredEventIds(registeredMap);
            setMemberStatusByEvent(statusMap);
          }
          if (payRes.data?.success) {
            setMemberPayments(payRes.data.payments || []);
          }
        }
      } catch {
        // ignore
      }
    };
    void loadMyData();
    return () => {
      cancelled = true;
    };
  }, [isMember]);

  useEffect(() => {
    if (!detailsEvent || !canManageEvents) return;
    let cancelled = false;
    const loadApprovalLists = async () => {
      setIsLoadingDetailsLists(true);
      try {
        const [regRes, partRes] = await Promise.all([
          api.getEventRegistrations(String(detailsEvent.id)),
          api.getInstitutionMembers({ eventId: detailsEvent.id }),
        ]);
        if (!cancelled) {
          setEventRegistrations(regRes.data?.registrations || []);
          setEventParticipants(partRes.data?.members || []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoadingDetailsLists(false);
      }
    };
    void loadApprovalLists();
    return () => {
      cancelled = true;
    };
  }, [detailsEvent, canManageEvents]);

  useEffect(() => {
    if (!detailsEvent || !isInstitution) {
      if (!detailsEvent) {
        setInstitutionRoster([]);
        setSelectedInstitutionMemberIds([]);
        setMemberSearchQuery('');
        setRegistrationSource('select');
      }
      return;
    }

    let cancelled = false;
    const loadInstitutionMembers = async () => {
      setIsLoadingInstitutionRoster(true);
      try {
        const { data } = await api.getInstitutionMembers();
        if (!cancelled && data?.success) {
          setInstitutionRoster(data.members || []);
        }
      } catch {
        if (!cancelled) setInstitutionRoster([]);
      } finally {
        if (!cancelled) setIsLoadingInstitutionRoster(false);
      }
    };

    void loadInstitutionMembers();
    return () => {
      cancelled = true;
    };
  }, [detailsEvent, isInstitution]);

  useEffect(() => {
    if (!isInstitution || registrationSource !== 'select' || !detailsEvent) return;

    if (selectedMembers.length === 0) {
      if (participantFileName.startsWith('Selected_')) {
        setParticipantFileName('');
        setTeamProfileFile(null);
        setParticipantUploadCount(0);
        if (teamProfilePreview) {
          URL.revokeObjectURL(teamProfilePreview);
          setTeamProfilePreview('');
        }
      }
      return;
    }

    setParticipantUploadCount(selectedMembers.length);
    const csvRows = [
      'fullName,email,contactNumber,gender,position,eventTitle',
      ...selectedMembers.map((m) =>
        `"${(m.fullName || '').replace(/"/g, '""')}","${(m.email || '').replace(/"/g, '""')}","${(m.contactNumber || '').replace(/"/g, '""')}","${(m.gender || '').replace(/"/g, '""')}","${(m.position || 'Participant').replace(/"/g, '""')}","${(detailsEvent.title || '').replace(/"/g, '""')}"`
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const sanitizedTitle = (detailsEvent.title || 'Event').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const fileName = `Selected_${sanitizedTitle}_Members.csv`;
    const file = new File([blob], fileName, { type: 'text/csv' });
    setParticipantFileName(fileName);
    setTeamProfileFile(file);
    setTeamProfileError(null);
    if (teamProfilePreview) URL.revokeObjectURL(teamProfilePreview);
    setTeamProfilePreview(URL.createObjectURL(file));
  }, [selectedMembers, registrationSource, isInstitution, detailsEvent]);


  const filteredEvents = useMemo(
    () => events.filter((event) => filterStatus === 'all' || event.status === filterStatus),
    [events, filterStatus]
  );

  const getStatusColor = (status: string): 'primary' | 'success' | 'warning' | 'error' | 'info' => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      case 'upcoming':
      case 'ongoing':
        return 'info';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'draft':
        return 'warning';
      default:
        return 'primary';
    }
  };

  const getRegistrationState = (event: any): { key: 'not_yet_open' | 'open' | 'closed' | 'finished'; label: string; variant: 'info' | 'success' | 'warning' | 'error' } => {
    const now = new Date();
    const status = String(event?.status || '').toLowerCase();

    if (status === 'completed') {
      return { key: 'finished', label: 'Event Finished', variant: 'error' };
    }
    if (status === 'cancelled') {
      return { key: 'closed', label: 'Event Cancelled', variant: 'error' };
    }
    // Phase 2: If event has started (ongoing), registration is closed!
    if (status === 'ongoing') {
      return { key: 'closed', label: 'Registration Closed (Event Started)', variant: 'warning' };
    }

    const override = String(event?.registrationOverride || '').toLowerCase();
    if (override === 'closed') return { key: 'closed', label: 'Registration Closed', variant: 'warning' };
    if (override === 'open') return { key: 'open', label: 'Open for Registration', variant: 'success' };

    const regStart = event?.registrationStartAt ? new Date(String(event.registrationStartAt)) : null;
    const regEnd = event?.registrationEndAt ? new Date(String(event.registrationEndAt)) : null;
    const endAt = event?.endDate && event?.endTime ? new Date(`${event.endDate}T${event.endTime}:00`) : (event?.endAt ? new Date(String(event.endAt)) : null);

    if (endAt && !Number.isNaN(endAt.getTime()) && endAt.getTime() <= now.getTime()) {
      return { key: 'finished', label: 'Event Finished', variant: 'error' };
    }

    if (regStart && !Number.isNaN(regStart.getTime()) && now < regStart) return { key: 'not_yet_open', label: 'Not Yet Open', variant: 'info' };
    if (regEnd && !Number.isNaN(regEnd.getTime()) && now > regEnd) return { key: 'closed', label: 'Registration Closed', variant: 'warning' };

    // Default: open until event starts
    const startAt = event?.date && event?.time ? new Date(`${event.date}T${event.time}:00`) : (event?.startAt ? new Date(String(event.startAt)) : null);
    if (startAt && !Number.isNaN(startAt.getTime()) && now >= startAt) return { key: 'closed', label: 'Registration Closed (Event Started)', variant: 'warning' };

    return { key: 'open', label: 'Open for Registration', variant: 'success' };
  };

  useEffect(() => {
    let cancelled = false;
    const fetchOfficers = async () => {
      setIsLoadingOfficers(true);
      try {
        const { data } = await api.getOfficers('active');
        if (!cancelled && data?.success) {
          setOfficersList(data.officers || []);
        }
      } catch (err) {
        console.warn('Failed to load officers for event wizard:', err);
      } finally {
        if (!cancelled) setIsLoadingOfficers(false);
      }
    };
    if (showEventModal) {
      void fetchOfficers();
    }
    return () => {
      cancelled = true;
    };
  }, [showEventModal]);

  const openCreateModal = () => {
    setEditingEventId(null);
    setActiveFormTab('basic');
    setFormData({
      title: '',
      description: '',
      guidelines: '',
      guidelinesFile: null,
      guidelinesFileUrl: '',
      guidelinesFileName: '',
      guidelineFileName: '',
      registrationMode: '',
      registrationOverride: '' as RegistrationOverride,
      registrationStartDate: '',
      registrationStartTime: '',
      registrationEndDate: '',
      registrationEndTime: '',
      eventType: '',
      categorySelect: '',
      customCategoryText: '',
      location: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      fee: 0,
      capacity: 0,
      isUnlimitedCapacity: true,
      status: 'upcoming' as EventStatus,
      isEsports: false,
      esportsGame: '',
      esportsBracketFormat: '',
      bannerUrl: '',
      bannerFile: null,
      bannerPreviewUrl: '',
      themeColor: '#2563eb',
      customBadge: '',
      requiresCoach: false,
      hasOfficerModerator: false,
      moderatorOfficerId: '',
      moderatorOfficerName: '',
      moderatorOfficerIds: [],
    });
    setShowEventModal(true);
  };

  const openEditModal = (event: any) => {
    setEditingEventId(String(event.id));
    setActiveFormTab('basic');
    const regStart = splitIsoToDateTime(event.registrationStartAt);
    const regEnd = splitIsoToDateTime(event.registrationEndAt);
    const rawType = (event.eventType || '').trim();
    const isEsp = Boolean(event.isEsports || rawType.toLowerCase() === 'esports');
    const isStandardCat = ['competition', 'contest', 'esports', 'seminar', 'conference'].includes(rawType.toLowerCase());
    const isOtherCat = Boolean(rawType && !isStandardCat);
    const catSelect = isEsp ? 'esports' : (isStandardCat ? rawType.toLowerCase() : (rawType ? 'other' : ''));
    const customText = (!isEsp && isOtherCat) ? (rawType.toLowerCase() === 'other' ? '' : rawType) : '';
    const isUnlimited = !event.capacity || Number(event.capacity) <= 0;

    const initialModIds: string[] = Array.isArray(event.moderatorIds)
      ? event.moderatorIds.map(String)
      : event.moderatorOfficerId
      ? [String(event.moderatorOfficerId)]
      : [];

    setFormData({
      title: event.title || '',
      description: event.description || '',
      guidelines: event.guidelines || '',
      guidelinesFile: null,
      guidelinesFileUrl: event.guidelinesFileUrl || '',
      guidelinesFileName: event.guidelinesFileName || '',
      guidelineFileName: '',
      registrationMode: event.registrationMode || 'individual',
      registrationOverride: (event.registrationOverride || '') as RegistrationOverride,
      registrationStartDate: regStart.date,
      registrationStartTime: regStart.time,
      registrationEndDate: regEnd.date,
      registrationEndTime: regEnd.time,
      eventType: rawType || 'seminar',
      categorySelect: catSelect,
      customCategoryText: customText,
      location: event.location || '',
      startDate: event.date || '',
      startTime: event.time || '',
      endDate: event.endDate || '',
      endTime: event.endTime || '',
      fee: Number(event.fee || 0),
      capacity: Number(event.capacity || 0),
      isUnlimitedCapacity: isUnlimited,
      status: (['draft', 'cancelled'].includes(String(event.status)) ? String(event.status) : 'upcoming') as EventStatus,
      isEsports: isEsp,
      esportsGame: event.esportsGame || '',
      esportsBracketFormat: event.esportsBracketFormat || '',
      bannerUrl: event.bannerUrl || '',
      bannerFile: null,
      bannerPreviewUrl: event.bannerUrl || '',
      themeColor: event.themeColor || '#2563eb',
      customBadge: event.customBadge || '',
      requiresCoach: Boolean(event.requiresCoach ?? event.requires_coach),
      hasOfficerModerator: Boolean(event.hasModerator ?? event.has_moderator ?? event.moderatorOfficerName ?? event.moderator_officer_name),
      moderatorOfficerId: event.moderatorOfficerId || event.moderator_officer_id || '',
      moderatorOfficerName: event.moderatorOfficerName || event.moderator_officer_name || '',
      moderatorOfficerIds: initialModIds,
    });
    setShowEventModal(true);
  };

  const handleCategoryChange = (val: string) => {
    if (val === 'esports') {
      setFormData((p) => ({
        ...p,
        categorySelect: 'esports',
        eventType: 'esports',
        customCategoryText: '',
        isEsports: true,
      }));
    } else if (val === 'other') {
      setFormData((p) => ({
        ...p,
        categorySelect: 'other',
        eventType: p.customCategoryText.trim() || 'other',
        isEsports: false,
      }));
    } else {
      setFormData((p) => ({
        ...p,
        categorySelect: val,
        eventType: val,
        customCategoryText: '',
        isEsports: false,
      }));
    }
  };

  const getAutoStatusPreview = () => {
    if (!formData.startDate || !formData.startTime) return 'Auto: Draft';
    const startAt = new Date(`${formData.startDate}T${formData.startTime}:00`);
    if (Number.isNaN(startAt.getTime())) return 'Auto: Draft';
    const endAt =
      formData.endDate && formData.endTime ? new Date(`${formData.endDate}T${formData.endTime}:00`) : null;
    const now = new Date();
    if (endAt && !Number.isNaN(endAt.getTime()) && endAt.getTime() <= now.getTime()) return 'Auto: Completed';
    return startAt.getTime() > now.getTime() ? 'Auto: Upcoming' : 'Auto: Ongoing';
  };

  const isFinalFormStep = activeFormTab === 'guidelines';

  const validateCurrentFormStep = (tab: typeof activeFormTab) => {
    if (tab === 'basic') {
      if (!formData.title.trim()) {
        addNotification({ userId: 'current', title: 'Validation', message: 'Event title is required.', type: 'error', isRead: false });
        return false;
      }
      if (!formData.categorySelect) {
        addNotification({ userId: 'current', title: 'Validation', message: 'Event category is required.', type: 'error', isRead: false });
        return false;
      }
      if (formData.categorySelect === 'other' && !formData.customCategoryText.trim()) {
        addNotification({ userId: 'current', title: 'Validation', message: 'Please specify the custom category name.', type: 'error', isRead: false });
        return false;
      }
      const isEsportsActive = formData.categorySelect === 'esports';
      if (isEsportsActive) {
        if (!formData.esportsGame) {
          addNotification({ userId: 'current', title: 'Validation', message: 'eSports Game is required.', type: 'error', isRead: false });
          return false;
        }
        if (!formData.esportsBracketFormat) {
          addNotification({ userId: 'current', title: 'Validation', message: 'Tournament Bracket Format is required.', type: 'error', isRead: false });
          return false;
        }
      }
      return true;
    }
    if (tab === 'schedule') {
      if (!formData.location.trim()) {
        addNotification({ userId: 'current', title: 'Validation', message: 'Location / venue is required.', type: 'error', isRead: false });
        return false;
      }
      if (Number(formData.fee) < 0) {
        addNotification({ userId: 'current', title: 'Validation', message: 'Event fee must be 0 or greater.', type: 'error', isRead: false });
        return false;
      }
      if (!formData.isUnlimitedCapacity && (!formData.capacity || Number(formData.capacity) <= 0)) {
        addNotification({ userId: 'current', title: 'Validation', message: `${getParticipantCapacityLabel(formData.registrationMode)} limit must be greater than 0 when set to Limited.`, type: 'error', isRead: false });
        return false;
      }
      if (!formData.startDate || !formData.startTime) {
        addNotification({ userId: 'current', title: 'Validation', message: 'Start date and start time are required.', type: 'error', isRead: false });
        return false;
      }
      if ((formData.endDate && !formData.endTime) || (!formData.endDate && formData.endTime)) {
        addNotification({ userId: 'current', title: 'Validation', message: 'End date/time must include both date and time.', type: 'error', isRead: false });
        return false;
      }
      if (formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
        const startCheck = new Date(`${formData.startDate}T${formData.startTime}:00`);
        const endCheck = new Date(`${formData.endDate}T${formData.endTime}:00`);
        if (!Number.isNaN(startCheck.getTime()) && !Number.isNaN(endCheck.getTime()) && endCheck < startCheck) {
          addNotification({ userId: 'current', title: 'Validation', message: 'End date/time must be after start date/time.', type: 'error', isRead: false });
          return false;
        }
      }
      if ((formData.registrationStartDate && !formData.registrationStartTime) || (!formData.registrationStartDate && formData.registrationStartTime)) {
        addNotification({ userId: 'current', title: 'Validation', message: 'Registration start must include both date and time.', type: 'error', isRead: false });
        return false;
      }
      if ((formData.registrationEndDate && !formData.registrationEndTime) || (!formData.registrationEndDate && formData.registrationEndTime)) {
        addNotification({ userId: 'current', title: 'Validation', message: 'Registration end must include both date and time.', type: 'error', isRead: false });
        return false;
      }
      if (formData.registrationStartDate && formData.registrationStartTime && formData.registrationEndDate && formData.registrationEndTime) {
        const rs = new Date(`${formData.registrationStartDate}T${formData.registrationStartTime}:00`);
        const re = new Date(`${formData.registrationEndDate}T${formData.registrationEndTime}:00`);
        if (!Number.isNaN(rs.getTime()) && !Number.isNaN(re.getTime()) && re < rs) {
          addNotification({ userId: 'current', title: 'Validation', message: 'Registration end must be after registration start.', type: 'error', isRead: false });
          return false;
        }
      }
      return true;
    }
    if (tab === 'guidelines') {
      return true;
    }
    return true;
  };

  const handleNextFormStep = () => {
    if (!validateCurrentFormStep(activeFormTab)) return;

    if (activeFormTab === 'basic') setActiveFormTab('schedule');
    else if (activeFormTab === 'schedule') setActiveFormTab('guidelines');
  };

  const handlePrevFormStep = () => {
    if (activeFormTab === 'schedule') setActiveFormTab('basic');
    else if (activeFormTab === 'guidelines') setActiveFormTab('schedule');
  };

  const allTemplates = useMemo(() => {
    const base: Record<string, StoredTemplate> = Object.fromEntries(
      Object.entries(PARTICIPANT_TEMPLATES).map(([key, t]) => [
        key,
        { label: t.label, kind: 'text', content: t.content },
      ])
    );
    return { ...base, ...customTemplates };
  }, [customTemplates]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      const migrated: Record<string, StoredTemplate> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!value || typeof value !== 'object') continue;
        const v: any = value;
        const label = typeof v.label === 'string' ? v.label : String(key);
        const content = typeof v.content === 'string' ? v.content : '';
        const kind = v.kind === 'dataUrl' ? 'dataUrl' : 'text';
        const filename = typeof v.filename === 'string' ? v.filename : undefined;
        if (!content) continue;
        migrated[String(key)] = { label, kind, content, filename };
      }
      setCustomTemplates(migrated);
    } catch {
      // ignore
    }
  }, []);

  const persistCustomTemplates = (next: Record<string, StoredTemplate>) => {
    setCustomTemplates(next);
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const downloadTemplate = (eventTitle = 'Sample Event', templateKey = 'default') => {
    const template = allTemplates[templateKey] || PARTICIPANT_TEMPLATES.default;
    if (template && (template as any).kind === 'dataUrl') {
      const a = document.createElement('a');
      a.href = String((template as any).content || '');
      a.download = String((template as any).filename || `event-template-${templateKey}`);
      a.click();
      return;
    }

    const csv = String((template as any)?.content || PARTICIPANT_TEMPLATE).replace(/Sample Event/g, eventTitle);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-participants-template-${templateKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openTemplateUpload = (contextTitle?: string) => {
    setSelectedTemplateKey('default');
    setTemplateContextTitle(contextTitle ? String(contextTitle) : 'Sample Event');
    setShowTemplateUploadModal(true);
  };

  const registerForEvent = async (event: any, silent = false) => {
    try {
      const mode = String(event?.registrationMode || 'individual');
      if (!isInstitution && ['team', 'pair'].includes(mode) && !teamProfileFile) {
        const modeLabel = mode === 'pair' ? 'Pair / Duo' : 'Team';
        setTeamProfileError(`${modeLabel} batch upload file is required for this registration mode.`);
        addNotification({
          userId: 'current',
          title: 'Validation',
          message: `Please batch upload ${modeLabel.toLowerCase()} members before registering.`,
          type: 'error',
          isRead: false,
        });
        return;
      }

      const participantsToUpload =
        pendingInstitutionParticipants.length > 0
          ? pendingInstitutionParticipants
          : isInstitution && registrationSource === 'select' && selectedMembers.length > 0
          ? selectedMembers.map((m) => ({
              eventId: event.id,
              eventTitle: event.title,
              fullName: m.fullName,
              email: m.email,
              contactNumber: m.contactNumber,
              gender: m.gender,
              position: m.position,
              notes: m.notes || 'Selected from Institution Members',
            }))
          : [];

      if (participantsToUpload.length > 0) {
        try {
          await api.bulkUploadInstitutionMembers(participantsToUpload);
        } catch {
          // ignore
        }
      }

      let teamProfileUrl: string | null = null;
      if (teamProfileFile) {
        const dataUrl = await readAsDataUrl(teamProfileFile);
        const { data: upload } = await api.uploadTeamProfile(dataUrl, teamProfileFile.name);
        teamProfileUrl = upload?.url || null;
      }

      const countToSubmit = Math.max(
        1,
        Number(participantUploadCount || participantsToUpload.length || selectedMembers.length || 1)
      );

      const { data } = await api.registerForEvent(String(event.id), {
        participantCount: countToSubmit,
        teamProfileUrl: teamProfileUrl || undefined,
      });
      const registration = data?.registration;
      if (registration) {
        setRegisteredEventIds((prev) => ({ ...prev, [String(event.id)]: true }));
        setMemberStatusByEvent((prev) => ({ ...prev, [String(event.id)]: registration.status || 'pending' }));
      }
      if (!silent) {
        addNotification({
          userId: 'current',
          title: 'Registration Submitted',
          message:
            isInstitution && countToSubmit > 1
              ? `${countToSubmit} institution members registered for ${event.title}.`
              : Number(event?.fee || 0) > 0
              ? `You are now registered for ${event.title}.`
              : `You are now registered for ${event.title}. Waiting for approval.`,
          type: 'success',
          isRead: false,
        });
      }

      setPendingInstitutionParticipants([]);
      setSelectedInstitutionMemberIds([]);
      setTeamProfileFile(null);
      if (teamProfilePreview) {
        URL.revokeObjectURL(teamProfilePreview);
        setTeamProfilePreview('');
      }
      setTeamProfileError(null);
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to register for event.',
        type: 'error',
        isRead: false,
      });
    }
  };

  const openPaymentForEvent = (event: any, flow: 'pre_register' | 'post_register' = 'post_register') => {
    setPaymentError(null);
    setPaymentEvent(event);
    setPaymentFlow(flow);
    const stats = getEventPaymentStats(event.id, Number(event.fee || 0));
    resetPaymentForm(stats.remainingBalance);
    setShowPaymentModal(true);
  };

  const handleRegister = async (event: any) => {
    const mode = String(event?.registrationMode || 'individual');

    if (isInstitution) {
      if (registrationSource === 'select') {
        if (selectedMembers.length === 0) {
          setTeamProfileError('Please select at least one institution member to register.');
          return;
        }
        if (mode === 'pair' && selectedMembers.length !== 2) {
          setTeamProfileError(`Pair / Duo registration requires exactly 2 members (currently selected: ${selectedMembers.length}).`);
          return;
        }
        if (mode === 'team' && selectedMembers.length < 2) {
          setTeamProfileError(`Team registration requires at least 2 members (currently selected: ${selectedMembers.length}).`);
          return;
        }
        if (Boolean(event?.requiresCoach ?? event?.requires_coach)) {
          const hasCoach = selectedMembers.some(
            (m) => (m.position || '').toLowerCase().includes('coach') || String(m.id) === String(selectedCoachMemberId)
          );
          if (!hasCoach) {
            setTeamProfileError('This event requires an assigned Coach. Please select a Coach from your institution members.');
            return;
          }
        }
      } else {
        if (['team', 'pair'].includes(mode) && !teamProfileFile) {
          setTeamProfileError(`${mode === 'pair' ? 'Pair / Duo' : 'Team'} batch upload file is required for this registration mode.`);
          return;
        }
      }
    } else if (['team', 'pair'].includes(mode) && !teamProfileFile) {
      setDetailsEvent(event);
      setTeamProfileError(`${mode === 'pair' ? 'Pair / Duo' : 'Team'} batch upload file is required for this registration mode.`);
      return;
    }

    if (isInstitution && registrationSource === 'select' && selectedMembers.length > 0) {
      setPendingInstitutionParticipants(
        selectedMembers.map((m) => ({
          eventId: event.id,
          eventTitle: event.title,
          fullName: m.fullName,
          email: m.email,
          contactNumber: m.contactNumber,
          gender: m.gender,
          position: m.position,
          notes: m.notes || 'Selected from Institution Members',
        }))
      );
    }

    const isPaidEvent = Number(event?.fee || 0) > 0;
    if (isPaidEvent) {
      if (detailsEvent && String(detailsEvent.id) === String(event.id)) setDetailsEvent(null);
      openPaymentForEvent(event, 'pre_register');
      return;
    }
    await registerForEvent(event);
  };

  const runApproval = async (approval: { kind: 'registration' | 'participant'; id: string; approve: boolean }) => {
    const status = approval.approve ? 'approved' : 'rejected';
    if (approval.kind === 'registration') {
      const { data } = await api.approveEventRegistration(approval.id, { status });
      const updated = data?.registration;
      if (updated) {
        setEventRegistrations((prev) => prev.map((x) => (String(x.id) === String(updated.id) ? updated : x)));
      }
      return;
    }

    const { data } = await api.approveInstitutionMember(approval.id, { status });
    const updated = data?.member;
    if (updated) {
      setEventParticipants((prev) => prev.map((x) => (String(x.id) === String(updated.id) ? updated : x)));
    }
  };

  if (!user) return null;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-r from-blue-900/40 via-cyan-900/20 to-slate-900/60 p-6 rounded-2xl border border-cyan-500/20 shadow-lg backdrop-blur-md">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="telemetry-chip text-cyan-400 border-cyan-500/30 bg-cyan-950/40">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                MODULE.EVENTS
              </span>
              <span className="text-xs text-slate-400 font-mono">SYS.OK</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Events Management</h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Conventions, seminars, hackathons, and esports tournament activities.</p>
          </div>
          {canManageEvents && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button variant="outline" onClick={() => openTemplateUpload()} className="w-full sm:w-auto border-cyan-500/30 hover:border-cyan-400">
                <Upload size={16} />
                Upload Spreadsheet Template
              </Button>
              <Button variant="cyber" size="lg" onClick={openCreateModal} className="w-full sm:w-auto">
                <Plus size={20} />
                Create Event
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Select
            label="Filter Status"
            options={[
              { value: 'all', label: 'All Events' },
              { value: 'draft', label: 'Draft' },
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'ongoing', label: 'Ongoing' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={filterStatus}
            onChange={(e) => setFilterStatus((e.target as HTMLSelectElement).value as any)}
          />
        </div>

        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const isRegistered = !!registeredEventIds[String(event.id)];
            const statusText = memberStatusByEvent[String(event.id)] || event.status;
            const isPaidEvent = Number(event?.fee || 0) > 0;
            const regState = getRegistrationState(event);
            const cardThemeColor = event.themeColor || '#2563eb';
            return (
              <Card key={event.id} variant="cyber" className="overflow-hidden transition-all duration-300 hover:border-cyan-500/40 hover:shadow-cyan-500/10 border-l-4" style={{ borderLeftColor: cardThemeColor }}>
                {event.bannerUrl && (
                  <div className="w-full h-44 sm:h-52 bg-gray-100 relative overflow-hidden border-b border-gray-200">
                    <img
                      src={event.bannerUrl}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    {event.customBadge && (
                      <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1 border border-white/20">
                        <Sparkles size={12} className="text-amber-400" />
                        {event.customBadge}
                      </span>
                    )}
                  </div>
                )}
                <div className="p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                        style={{ backgroundColor: cardThemeColor }}
                      >
                        EV
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-gray-900">{event.title}</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          PSITS Event
                        </p>
                        <p className="text-xs text-gray-500">
                          Scheduled on {event.date} at {event.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {event.customBadge && !event.bannerUrl && (
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-amber-200">
                          <Sparkles size={12} /> {event.customBadge}
                        </span>
                      )}
                      {isRegistered && <Badge variant="success">Registered</Badge>}
                      {isPaidEvent && <Badge variant="warning">With Fee</Badge>}
                      {event.eventType && (
                        <Badge variant={['competition', 'contest', 'hackathon', 'esports'].includes(event.eventType.toLowerCase()) ? 'error' : 'info'}>
                          {getCategoryLabel(event.eventType)}
                        </Badge>
                      )}
                      {event.requiresCoach && (
                        <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-indigo-200">
                          <UserCheck size={12} /> Coach Required
                        </span>
                      )}
                      {Boolean(event.hasModerator || event.moderatorOfficerName) && (
                        <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                          <ShieldCheck size={12} /> Moderator: {event.moderatorOfficerName || 'Officer Assigned'}
                        </span>
                      )}
                      {/* 2-Phase Lifecycle Badge */}
                      {event.status === 'upcoming' && (
                        <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-200">
                          Phase 1: Open for Registration
                        </Badge>
                      )}
                      {event.status === 'ongoing' && (
                        <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                          Phase 2: Event Started (Registration Closed)
                        </Badge>
                      )}
                      {event.status === 'completed' && (
                        <Badge variant="secondary">Completed</Badge>
                      )}
                      {event.status === 'cancelled' && (
                        <Badge variant="error">Cancelled</Badge>
                      )}
                      {event.status === 'draft' && (
                        <Badge variant="warning">Draft</Badge>
                      )}
                      {isMember && <Badge variant={regState.variant}>{regState.label}</Badge>}
                    </div>
                  </div>

                {event.description && (
                  <p className="mb-4 whitespace-pre-wrap text-gray-700 text-sm">{event.description}</p>
                )}

                <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 rounded-lg bg-gray-50 border border-gray-100 p-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2"><MapPin size={16} className="text-gray-400" /> <span><strong>Location:</strong> {event.location}</span></div>
                  <div className="flex items-center gap-2"><Users size={16} className="text-gray-400" /> <span><strong>{getParticipantCapacityLabel(event.registrationMode)}:</strong> {event.registrations} / {Number(event.capacity) > 0 ? event.capacity : 'Unlimited'}</span></div>
                  <div className="flex items-center gap-2"><Megaphone size={16} className="text-gray-400" /> <span><strong>Mode:</strong> {String(event.registrationMode || 'individual').replace(/^./, (x: string) => x.toUpperCase())}</span></div>
                  {isMember && (event.registrationStartAt || event.registrationEndAt) && (
                    <div className="sm:col-span-2 md:col-span-3 text-xs text-gray-500 border-t border-gray-200/60 pt-2 mt-1">
                      <strong>Registration Window:</strong> {event.registrationStartAt ? String(event.registrationStartAt).replace('T', ' ').slice(0, 16) : '—'} to {event.registrationEndAt ? String(event.registrationEndAt).replace('T', ' ').slice(0, 16) : '—'}
                    </div>
                  )}
                </div>

                {isMember && isPaidEvent && isRegistered && (() => {
                  const stats = getEventPaymentStats(event.id, Number(event.fee || 0));
                  return (
                    <div className="mb-4 space-y-1 text-xs bg-blue-50/20 p-3 rounded-lg border border-blue-100/30">
                      <div className="flex justify-between font-semibold text-gray-600">
                        <span>Paid: {formatCurrency(stats.totalVerifiedPaid)} ({stats.percentPaid}%)</span>
                        {stats.totalPendingPaid > 0 && (
                          <span className="text-yellow-600 italic">({formatCurrency(stats.totalPendingPaid)} pending)</span>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-500"
                          style={{ width: `${stats.percentPaid}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4 mt-4">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-primary">Fee: {formatCurrency(event.fee)}</span>
                    {isMember && (
                      <span className="text-sm text-gray-600">
                        <strong>Registration Status:</strong> {String(statusText).charAt(0).toUpperCase() + String(statusText).slice(1)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetailsEvent(event)}>
                      <Eye size={16} /> View Details
                    </Button>

                    {canManageEvents && (
                      <>
                        {event.status === 'upcoming' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              setConfirmStartEvent({
                                eventId: String(event.id),
                                title: event.title,
                              })
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                          >
                            <Play size={15} /> Start Event
                          </Button>
                        )}
                        {event.status === 'ongoing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setConfirmCompleteEvent({
                                eventId: String(event.id),
                                title: event.title,
                              })
                            }
                            className="text-indigo-700 border-indigo-300 hover:bg-indigo-50 font-semibold flex items-center gap-1.5"
                          >
                            <CheckCircle size={15} /> Complete Event
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openEditModal(event)}>
                          <Pencil size={16} /> Edit / Update
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setConfirmToggle({
                              eventId: String(event.id),
                              nextStatus: event.status === 'cancelled' ? 'upcoming' : 'cancelled',
                              title: event.title,
                            })
                          }
                        >
                          <Power size={16} /> {event.status === 'cancelled' ? 'Turn On' : 'Turn Off'}
                        </Button>
                      </>
                    )}

                    {isMember && (
                      <Button
                        variant={isRegistered ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => void handleRegister(event)}
                        disabled={isRegistered || regState.key !== 'open'}
                        className="min-w-[140px]"
                      >
                        <CheckCircle size={16} /> {isRegistered ? 'Registered (Ready)' : (isPaidEvent ? 'Register & Upload Proof' : 'Register for Event')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
            );
          })}
        </div>

        {filteredEvents.length === 0 && (
          <Card className="p-8 text-center text-gray-500">
            {isLoading ? 'Loading...' : 'No events found matching your criteria.'}
          </Card>
        )}
      </div>
      <Modal isOpen={showEventModal} onClose={() => setShowEventModal(false)} title={editingEventId ? 'Edit Event' : 'Create Event Wizard'} size="lg">
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar gap-1 bg-gray-50/80 p-1.5 rounded-xl border">
          <button
            type="button"
            onClick={() => setActiveFormTab('basic')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeFormTab === 'basic' ? 'bg-white text-primary shadow-sm border border-gray-200/80' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
          >
            <Layers size={15} /> 1. Basic Info
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('schedule')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeFormTab === 'schedule' ? 'bg-white text-primary shadow-sm border border-gray-200/80' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
          >
            <MapPin size={15} /> 2. Schedule & Venue
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('guidelines')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeFormTab === 'guidelines' ? 'bg-white text-primary shadow-sm border border-gray-200/80' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
          >
            <FileSpreadsheet size={15} /> 3. Guidelines
          </button>
        </div>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isFinalFormStep) {
              handleNextFormStep();
              return;
            }

            if (!validateCurrentFormStep('basic')) { setActiveFormTab('basic'); return; }
            if (!validateCurrentFormStep('schedule')) { setActiveFormTab('schedule'); return; }
            if (!validateCurrentFormStep('guidelines')) { setActiveFormTab('guidelines'); return; }

            const startAt = formData.startDate && formData.startTime ? `${formData.startDate}T${formData.startTime}:00` : null;
            if (!startAt) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Start date/time is required.', type: 'error', isRead: false });
              setActiveFormTab('schedule');
              return;
            }

            const registrationStartAt =
              formData.registrationStartDate && formData.registrationStartTime
                ? `${formData.registrationStartDate}T${formData.registrationStartTime}:00`
                : null;
            const registrationEndAt =
              formData.registrationEndDate && formData.registrationEndTime
                ? `${formData.registrationEndDate}T${formData.registrationEndTime}:00`
                : null;

            if ((formData.registrationStartDate && !formData.registrationStartTime) || (!formData.registrationStartDate && formData.registrationStartTime)) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Registration start must include both date and time.', type: 'error', isRead: false });
              setActiveFormTab('schedule');
              return;
            }
            if ((formData.registrationEndDate && !formData.registrationEndTime) || (!formData.registrationEndDate && formData.registrationEndTime)) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Registration end must include both date and time.', type: 'error', isRead: false });
              setActiveFormTab('schedule');
              return;
            }
            if (registrationStartAt && registrationEndAt) {
              const rs = new Date(registrationStartAt);
              const re = new Date(registrationEndAt);
              if (!Number.isNaN(rs.getTime()) && !Number.isNaN(re.getTime()) && re < rs) {
                addNotification({ userId: 'current', title: 'Validation', message: 'Registration end must be after registration start.', type: 'error', isRead: false });
                setActiveFormTab('schedule');
                return;
              }
            }
            if ((formData.endDate && !formData.endTime) || (!formData.endDate && formData.endTime)) {
              addNotification({ userId: 'current', title: 'Validation', message: 'End date/time must include both date and time.', type: 'error', isRead: false });
              setActiveFormTab('schedule');
              return;
            }
            const endAt =
              formData.endDate && formData.endTime ? `${formData.endDate}T${formData.endTime}:00` : null;
            if (endAt) {
              const startCheck = new Date(startAt);
              const endCheck = new Date(endAt);
              if (!Number.isNaN(startCheck.getTime()) && !Number.isNaN(endCheck.getTime()) && endCheck < startCheck) {
                addNotification({ userId: 'current', title: 'Validation', message: 'End date/time must be after start date/time.', type: 'error', isRead: false });
                setActiveFormTab('schedule');
                return;
              }
            }

            const isEsportsActive = formData.categorySelect === 'esports';
            if (isEsportsActive) {
              if (!formData.esportsGame) {
                addNotification({ userId: 'current', title: 'Validation', message: 'eSports Game is required.', type: 'error', isRead: false });
                setActiveFormTab('basic');
                return;
              }
              if (!formData.esportsBracketFormat) {
                addNotification({ userId: 'current', title: 'Validation', message: 'Tournament Bracket Format is required.', type: 'error', isRead: false });
                setActiveFormTab('basic');
                return;
              }
            }

            (async () => {
              let finalBannerUrl = formData.bannerUrl || null;
              if (formData.bannerFile) {
                try {
                  const dataUrl = await readAsDataUrl(formData.bannerFile);
                  const { data: upload } = await api.uploadEventBanner(dataUrl);
                  if (upload?.url) {
                    finalBannerUrl = upload.url;
                  }
                } catch (err) {
                  console.error('Banner upload error:', err);
                  addNotification({ userId: 'current', title: 'Banner Upload Warning', message: 'Failed to upload banner image. Event saved with default design.', type: 'warning', isRead: false });
                }
              }

              let finalGuidelinesFileUrl = formData.guidelinesFileUrl || null;
              let finalGuidelinesFileName = formData.guidelinesFileName || null;
              if (formData.guidelinesFile) {
                try {
                  const dataUrl = await readAsDataUrl(formData.guidelinesFile);
                  const { data: uploadG } = await api.uploadEventGuidelines(dataUrl, formData.guidelinesFile.name);
                  if (uploadG?.url) {
                    finalGuidelinesFileUrl = uploadG.url;
                    finalGuidelinesFileName = uploadG.fileName || formData.guidelinesFile.name;
                  }
                } catch (err) {
                  console.error('Guidelines upload error:', err);
                  addNotification({ userId: 'current', title: 'Guidelines Upload Warning', message: 'Failed to upload guidelines file. Saved text guidelines only.', type: 'warning', isRead: false });
                }
              }

              const finalEventType = formData.categorySelect === 'other'
                ? (formData.customCategoryText.trim() || 'other')
                : (formData.categorySelect || formData.eventType || 'seminar');
              const finalIsEsports = formData.categorySelect === 'esports';

              setPendingEventPayload({
                title: formData.title.trim(),
                description: formData.description.trim(),
                guidelines: formData.guidelines.trim(),
                guidelinesFileUrl: finalGuidelinesFileUrl,
                guidelinesFileName: finalGuidelinesFileName,
                registrationMode: formData.registrationMode || 'individual',
                registrationOverride: null,
                ...(registrationStartAt ? { registrationStartAt } : {}),
                ...(registrationEndAt ? { registrationEndAt } : {}),
                location: formData.location.trim(),
                eventType: finalEventType,
                startAt,
                ...(endAt ? { endAt } : {}),
                fee: Number(formData.fee) || 0,
                capacity: formData.isUnlimitedCapacity ? 0 : (Number(formData.capacity) || 0),
                status: formData.status || 'upcoming',
                isEsports: finalIsEsports,
                esportsGame: finalIsEsports ? formData.esportsGame : null,
                esportsBracketFormat: finalIsEsports ? formData.esportsBracketFormat : null,
                bannerUrl: finalBannerUrl,
                themeColor: formData.themeColor || '#2563eb',
                customBadge: formData.customBadge.trim() || null,
                requiresCoach: formData.requiresCoach,
                hasModerator: formData.hasOfficerModerator,
                moderatorOfficerId: formData.hasOfficerModerator ? (formData.moderatorOfficerId || null) : null,
                moderatorOfficerName: formData.hasOfficerModerator ? (formData.moderatorOfficerName || null) : null,
                moderatorIds: formData.hasOfficerModerator ? formData.moderatorOfficerIds : [],
                moderatorNames: formData.hasOfficerModerator ? (formData.moderatorOfficerName || null) : null,
              });
              setConfirmSaveEvent(true);
            })();
          }}
        >
          {/* TAB 1: BASIC INFO */}
          {activeFormTab === 'basic' && (
            <div className="space-y-4 animate-fadeIn">
              <Input
                label="Event Title"
                placeholder="e.g. PSITS Regional IT Convention 2026"
                required
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Event Category"
                  required
                  placeholder="Select an option"
                  options={EVENT_CATEGORIES}
                  value={formData.categorySelect}
                  onChange={(e) => handleCategoryChange((e.target as HTMLSelectElement).value)}
                />
                <Select
                  label="Registration Mode"
                  options={[
                    { value: 'individual', label: 'Individual Registration' },
                    { value: 'pair', label: 'Pair (2 Members)' },
                    { value: 'team', label: 'Team / Group' },
                  ]}
                  value={formData.registrationMode}
                  onChange={(e) => setFormData((p) => ({ ...p, registrationMode: (e.target as HTMLSelectElement).value }))}
                />
              </div>

              {/* If "Other" category is selected, allow user to type what is needed */}
              {formData.categorySelect === 'other' && (
                <div className="animate-fadeIn">
                  <Input
                    label="Specify Category"
                    placeholder="Type what is needed for this category (e.g. Hackathon, Workshop, Boot Camp...)"
                    required
                    value={formData.customCategoryText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({
                        ...p,
                        customCategoryText: val,
                        eventType: val.trim() || 'other',
                      }));
                    }}
                  />
                </div>
              )}

              <TextArea
                label="Description"
                rows={4}
                placeholder="Provide a compelling overview of what participants can expect..."
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: (e.target as HTMLTextAreaElement).value }))}
              />

              {/* Coach Requirement Checkbox Button */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <UserCheck size={18} className="text-blue-600 shrink-0" />
                  <div>
                    <span className="text-sm font-bold text-gray-900 block">Require Coach for this Event</span>
                    <span className="text-xs text-gray-500">Check if institutions must designate an official Coach from their roster during registration.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="requiresCoachTab"
                  checked={formData.requiresCoach}
                  onChange={(e) => setFormData((p) => ({ ...p, requiresCoach: e.target.checked }))}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer shrink-0"
                />
              </div>

              {/* Officer Moderator Checkbox Card */}
              <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/50 rounded-xl flex items-center justify-between transition-all">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 block">Assign Officer as Event Moderator</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Designate official PSITS officer(s) to moderate, oversee, and facilitate this event.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="hasOfficerModeratorTab"
                  checked={formData.hasOfficerModerator}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData((p) => ({
                      ...p,
                      hasOfficerModerator: checked,
                    }));
                  }}
                  className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0"
                />
              </div>

              {/* Officer Moderator Selection (when Assign Officer as Event Moderator is checked) */}
              {formData.hasOfficerModerator && (
                <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/50 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                        Select Officer Moderator(s)
                      </span>
                    </div>
                    {formData.moderatorOfficerIds.length > 0 && (
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-900/50 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700">
                        {formData.moderatorOfficerIds.length} {formData.moderatorOfficerIds.length === 1 ? 'Officer' : 'Officers'} Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Select the officer(s) who will act as moderator for this event:
                  </p>

                  {isLoadingOfficers ? (
                    <div className="flex items-center justify-center py-4 text-xs text-gray-500">
                      <RefreshCw size={15} className="animate-spin mr-2 text-indigo-600" />
                      Loading active officers...
                    </div>
                  ) : officersList.length === 0 ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                      No active officers currently found in the system. You can add officers under the PSITS Officers module.
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 border border-indigo-100 dark:border-indigo-900/40 p-2 rounded-lg bg-white/70 dark:bg-slate-900/60">
                      {officersList.map((officer) => {
                        const isChecked = formData.moderatorOfficerIds.includes(String(officer.id));
                        return (
                          <label
                            key={officer.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-xs'
                                : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setFormData((prev) => {
                                    const currentIds = prev.moderatorOfficerIds || [];
                                    const nextIds = checked
                                      ? [...currentIds, String(officer.id)]
                                      : currentIds.filter((id) => id !== String(officer.id));

                                    const selectedOfficers = officersList.filter((o) => nextIds.includes(String(o.id)));
                                    const names = selectedOfficers.map((o) => `${o.fullName} (${o.position || 'Officer'})`).join(', ');
                                    const primaryId = nextIds[0] || '';
                                    const primaryName = selectedOfficers[0] ? selectedOfficers[0].fullName : '';

                                    return {
                                      ...prev,
                                      moderatorOfficerIds: nextIds,
                                      moderatorOfficerId: primaryId,
                                      moderatorOfficerName: names || primaryName,
                                    };
                                  });
                                }}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">
                                  {officer.fullName}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {officer.position || 'Officer'} {officer.email ? `• ${officer.email}` : ''}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100/70 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                              {officer.position || 'Officer'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {formData.moderatorOfficerIds.length > 0 && (
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-100/60 dark:bg-indigo-950/40 p-2 rounded-lg flex items-center gap-1.5 border border-indigo-200/50">
                      <ShieldCheck size={14} className="shrink-0" />
                      <span><strong>Designated Moderator(s):</strong> {formData.moderatorOfficerName}</span>
                    </div>
                  )}
                </div>
              )}

              {/* eSports Tournament Settings (shown when Event Category is Esports) */}
              {formData.categorySelect === 'esports' && (
                <div className="space-y-4 animate-fadeIn bg-purple-50/60 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy size={18} className="text-purple-600 dark:text-purple-400" />
                    <h4 className="text-sm font-bold text-purple-900 dark:text-purple-200">eSports Tournament Settings</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="eSports Game"
                      required
                      placeholder="Select Game..."
                      options={[
                        { value: 'Mobile Legends: Bang Bang', label: 'Mobile Legends: Bang Bang' },
                        { value: 'PUBG Mobile', label: 'PUBG Mobile' },
                        { value: 'Arena of Valor', label: 'Arena of Valor' },
                        { value: 'Call of Duty: Mobile', label: 'Call of Duty: Mobile' },
                        { value: 'VALORANT', label: 'VALORANT' },
                        { value: 'Dota 2', label: 'Dota 2' },
                        { value: 'League of Legends', label: 'League of Legends' },
                        { value: 'CrossFire', label: 'CrossFire' },
                        ...(formData.esportsGame && ![
                          'Mobile Legends: Bang Bang',
                          'PUBG Mobile',
                          'Arena of Valor',
                          'Call of Duty: Mobile',
                          'VALORANT',
                          'Dota 2',
                          'League of Legends',
                          'CrossFire',
                        ].includes(formData.esportsGame) ? [{ value: formData.esportsGame, label: formData.esportsGame }] : []),
                      ]}
                      value={formData.esportsGame}
                      onChange={(e) => setFormData((p) => ({ ...p, esportsGame: (e.target as HTMLSelectElement).value }))}
                    />
                    <Select
                      label="Tournament Bracket Format"
                      required
                      placeholder="Select an option"
                      options={[
                        { value: 'Single Elimination', label: 'Single Elimination' },
                        { value: 'Double Elimination', label: 'Double Elimination' },
                        { value: 'Swiss System', label: 'Swiss System' },
                      ]}
                      value={formData.esportsBracketFormat}
                      onChange={(e) => setFormData((p) => ({ ...p, esportsBracketFormat: (e.target as HTMLSelectElement).value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCHEDULE & LOCATION */}
          {activeFormTab === 'schedule' && (
            <div className="space-y-4 animate-fadeIn">
              <Input
                label="Location / Venue"
                placeholder="e.g. Main Auditorium / Online via Zoom"
                required
                value={formData.location}
                onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border">
                <Input label="Start Date *" type="date" value={formData.startDate} onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))} />
                <Input label="Start Time *" type="time" value={formData.startTime} onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))} />
                <Input label="End Date" type="date" value={formData.endDate} onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))} />
                <Input label="End Time" type="time" value={formData.endTime} onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))} />
              </div>

              <div className="text-xs text-gray-500 flex items-center justify-between px-1">
                <span>Calculated Event Status:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{getAutoStatusPreview()}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-2 border-t border-gray-200 dark:border-slate-800">
                <Input label="Registration Fee (₱)" type="number" min="0" value={String(formData.fee)} onChange={(e) => setFormData((p) => ({ ...p, fee: Number(e.target.value) }))} />
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
                    {getParticipantCapacityLabel(formData.registrationMode)}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, isUnlimitedCapacity: true, capacity: 0 }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                        formData.isUnlimitedCapacity
                          ? 'bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-950/60 dark:border-cyan-500 dark:text-cyan-300 shadow-xs ring-1 ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 hover:bg-gray-50'
                      }`}
                    >
                      Unlimited
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({
                        ...p,
                        isUnlimitedCapacity: false,
                        capacity: p.capacity > 0 ? p.capacity : 50,
                      }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                        !formData.isUnlimitedCapacity
                          ? 'bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-950/60 dark:border-cyan-500 dark:text-cyan-300 shadow-xs ring-1 ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 hover:bg-gray-50'
                      }`}
                    >
                      Limited
                    </button>
                  </div>

                  {!formData.isUnlimitedCapacity ? (
                    <div className="pt-1">
                      <Input
                        label="Maximum Limit *"
                        type="number"
                        min="1"
                        placeholder="e.g. 50"
                        value={formData.capacity > 0 ? String(formData.capacity) : ''}
                        onChange={(e) => setFormData((p) => ({ ...p, capacity: Number(e.target.value) }))}
                        helperText="Registration closes automatically when this limit is reached."
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-slate-400 pt-0.5">
                      No participant capacity limit (unlimited registrations allowed).
                    </p>
                  )}
                </div>
              </div>

              {/* Registration Window (Moved to Step 2) */}
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                    Registration Window (Optional)
                  </h4>
                  <span className="text-[11px] text-gray-400">Controls registration schedule</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-900/60 p-3 rounded-xl border border-gray-200 dark:border-slate-800">
                  <Input
                    label="Registration Start Date"
                    type="date"
                    value={formData.registrationStartDate}
                    onChange={(e) => setFormData((p) => ({ ...p, registrationStartDate: e.target.value }))}
                  />
                  <Input
                    label="Registration Start Time"
                    type="time"
                    value={formData.registrationStartTime}
                    onChange={(e) => setFormData((p) => ({ ...p, registrationStartTime: e.target.value }))}
                  />
                  <Input
                    label="Registration End Date"
                    type="date"
                    value={formData.registrationEndDate}
                    onChange={(e) => setFormData((p) => ({ ...p, registrationEndDate: e.target.value }))}
                  />
                  <Input
                    label="Registration End Time"
                    type="time"
                    value={formData.registrationEndTime}
                    onChange={(e) => setFormData((p) => ({ ...p, registrationEndTime: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Leave blank to naturally keep registration open based on event schedule.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: GUIDELINES */}
          {activeFormTab === 'guidelines' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Guidelines */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <TextArea
                    label="Guidelines"
                    rows={5}
                    placeholder="Enter event rules, mechanics, and important reminders for participants..."
                    value={formData.guidelines}
                    onChange={(e) => setFormData((p) => ({ ...p, guidelines: (e.target as HTMLTextAreaElement).value }))}
                  />
                  <p className="text-xs text-gray-500">
                    Provide clear rules and mechanics that participants must follow.
                  </p>
                </div>

                {/* Upload Guidelines Document Option */}
                <div className="p-4 bg-slate-50 dark:bg-obsidian-surface/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div>
                    <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider block">
                      Upload Guidelines Document (Optional)
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      Upload an official PDF, Word (.docx/.doc), Markdown (.md), Text (.txt), or Image guidelines document.
                    </span>
                  </div>

                  {(formData.guidelinesFile || formData.guidelinesFileUrl) ? (
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-obsidian-card rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
                          <FileSpreadsheet size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {formData.guidelinesFile?.name || formData.guidelinesFileName || 'Uploaded Guidelines Document'}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400">
                            {formData.guidelinesFile
                              ? `${(formData.guidelinesFile.size / 1024).toFixed(1)} KB • Attached`
                              : 'Attached Document'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {formData.guidelinesFileUrl && !formData.guidelinesFile && (
                          <a
                            href={formData.guidelinesFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline font-medium px-2 py-1"
                          >
                            Preview ↗
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, guidelinesFile: null, guidelinesFileUrl: '', guidelinesFileName: '' }))}
                          className="text-xs text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Remove guidelines file"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-cyber-cyan rounded-xl p-4 text-center transition-colors bg-white/50 dark:bg-obsidian-card/40">
                      <Upload size={20} className="text-slate-400" />
                      <div>
                        <span className="text-xs font-semibold text-primary dark:text-cyber-cyan hover:underline">
                          Click to upload guidelines document
                        </span>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          PDF, DOCX, DOC, TXT, MD, or Image (max 15MB)
                        </span>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.md,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 15 * 1024 * 1024) {
                            addNotification({ userId: 'current', title: 'File Too Large', message: 'Guidelines file must be 15MB or less.', type: 'error', isRead: false });
                            return;
                          }
                          if ((file.name.endsWith('.txt') || file.name.endsWith('.md')) && !formData.guidelines.trim()) {
                            try {
                              const text = await file.text();
                              if (text) {
                                setFormData((p) => ({ ...p, guidelines: text.trim(), guidelinesFile: file, guidelinesFileName: file.name }));
                                return;
                              }
                            } catch {
                              // ignore
                            }
                          }
                          setFormData((p) => ({ ...p, guidelinesFile: file, guidelinesFileName: file.name }));
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Event Banner */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Event Banner (Optional)</label>
                {formData.bannerPreviewUrl && (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 h-32 bg-gray-100">
                    <img
                      src={formData.bannerPreviewUrl}
                      alt="Banner preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, bannerFile: null, bannerPreviewUrl: '', bannerUrl: '' }))}
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-700 rounded-full p-1 shadow text-xs"
                      title="Remove banner"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 hover:border-primary rounded-lg px-4 py-3 text-sm text-gray-600 hover:text-primary transition-colors">
                  <Upload size={16} />
                  <span>{formData.bannerPreviewUrl ? 'Change Banner Image' : 'Upload Banner Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setFormData((p) => ({
                        ...p,
                        bannerFile: file,
                        bannerPreviewUrl: URL.createObjectURL(file),
                      }));
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {/* Theme Color & Custom Badge */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Theme Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.themeColor}
                      onChange={(e) => setFormData((p) => ({ ...p, themeColor: e.target.value }))}
                      className="h-10 w-16 rounded-lg border border-gray-300 cursor-pointer p-1"
                    />
                    <span className="text-sm text-gray-500 font-mono">{formData.themeColor}</span>
                  </div>
                </div>
                <Input
                  label="Custom Badge (Optional)"
                  placeholder="e.g. #NatlQuals2026"
                  value={formData.customBadge}
                  onChange={(e) => setFormData((p) => ({ ...p, customBadge: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Modal Footer Navigation Bar */}
          <div className="border-t border-gray-200 pt-4 flex items-center justify-between gap-3">
            <div>
              {activeFormTab !== 'basic' && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handlePrevFormStep}
                  className="flex items-center gap-1.5 px-4"
                >
                  <ChevronLeft size={16} /> Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isFinalFormStep ? (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleNextFormStep}
                  className="flex items-center gap-1.5 px-6 font-semibold"
                >
                  Next <ChevronRight size={16} />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isLoading}
                  className="px-6 font-bold"
                >
                  {editingEventId ? 'Update Event' : 'Create Event'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <VerifyActionModal
        isOpen={confirmSaveEvent}
        title={editingEventId ? 'Verify Event Update' : 'Verify Event Creation'}
        message={editingEventId ? 'Are you sure you want to update this event?' : 'Are you sure you want to create this event?'}
        confirmLabel="Accept"
        confirmVariant="primary"
        onCancel={() => {
          if (isLoading) return;
          setConfirmSaveEvent(false);
          setPendingEventPayload(null);
        }}
        onVerified={async () => {
          if (!pendingEventPayload) return;
          setIsLoading(true);
          try {
            if (editingEventId) {
              const { data } = await api.updateEvent(editingEventId, pendingEventPayload);
              const updated = data?.event;
              if (updated) setEvents((prev) => prev.map((e) => (String(e.id) === String(updated.id) ? updated : e)));
              addNotification({ userId: 'current', title: 'Event Updated', message: 'Event updated successfully.', type: 'success', isRead: false });
            } else {
              const { data } = await api.createEvent(pendingEventPayload);
              const created = data?.event;
              if (created) setEvents((prev) => [created, ...prev]);
              addNotification({ userId: 'current', title: 'Event Created', message: 'Event created successfully.', type: 'success', isRead: false });
            }
            setShowEventModal(false);
            setConfirmSaveEvent(false);
            setPendingEventPayload(null);
          } catch (err) {
            addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to save event.', type: 'error', isRead: false });
          } finally {
            setIsLoading(false);
          }
        }}
      />

      <VerifyActionModal
        isOpen={!!confirmToggle}
        title="Verify Event Status Change"
        message={confirmToggle ? `Set ${confirmToggle.title} to ${confirmToggle.nextStatus === 'cancelled' ? 'OFF' : 'ON'}?` : ''}
        confirmLabel="Accept"
        confirmVariant="primary"
        onCancel={() => setConfirmToggle(null)}
        onVerified={async () => {
          if (!confirmToggle) return;
          try {
            const { data } = await api.updateEvent(confirmToggle.eventId, { status: confirmToggle.nextStatus });
            const updated = data?.event;
            if (updated) setEvents((prev) => prev.map((e) => (String(e.id) === String(updated.id) ? updated : e)));
            addNotification({ userId: 'current', title: 'Event Updated', message: 'Event status changed.', type: 'success', isRead: false });
          } catch (err) {
            addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to update event status.', type: 'error', isRead: false });
          } finally {
            setConfirmToggle(null);
          }
        }}
      />

      <VerifyActionModal
        isOpen={!!confirmStartEvent}
        title="Start Event"
        message={confirmStartEvent ? `Are you ready to start "${confirmStartEvent.title}"? This will advance the event to Phase 2 (Event Started). All participants are assumed ready, and registration will be immediately closed.` : ''}
        confirmLabel="Start Event"
        confirmVariant="primary"
        onCancel={() => setConfirmStartEvent(null)}
        onVerified={async () => {
          if (!confirmStartEvent) return;
          try {
            const { data } = await api.updateEvent(confirmStartEvent.eventId, { status: 'ongoing', registrationOverride: 'closed' });
            const updated = data?.event;
            if (updated) {
              setEvents((prev) => prev.map((e) => (String(e.id) === String(updated.id) ? updated : e)));
              if (detailsEvent && String(detailsEvent.id) === String(updated.id)) {
                setDetailsEvent(updated);
              }
            }
            addNotification({
              userId: 'current',
              title: 'Event Started',
              message: `Event "${confirmStartEvent.title}" has started! Registration is now closed.`,
              type: 'success',
              isRead: false,
            });
            setConfirmStartEvent(null);
          } catch (err) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err instanceof Error ? err.message : 'Failed to start event.',
              type: 'error',
              isRead: false,
            });
          }
        }}
      />

      <VerifyActionModal
        isOpen={!!confirmCompleteEvent}
        title="Complete Event"
        message={confirmCompleteEvent ? `Are you sure you want to mark "${confirmCompleteEvent.title}" as completed?` : ''}
        confirmLabel="Complete Event"
        confirmVariant="primary"
        onCancel={() => setConfirmCompleteEvent(null)}
        onVerified={async () => {
          if (!confirmCompleteEvent) return;
          try {
            const { data } = await api.updateEvent(confirmCompleteEvent.eventId, { status: 'completed' });
            const updated = data?.event;
            if (updated) {
              setEvents((prev) => prev.map((e) => (String(e.id) === String(updated.id) ? updated : e)));
              if (detailsEvent && String(detailsEvent.id) === String(updated.id)) {
                setDetailsEvent(updated);
              }
            }
            addNotification({
              userId: 'current',
              title: 'Event Completed',
              message: `Event "${confirmCompleteEvent.title}" has been marked as completed.`,
              type: 'success',
              isRead: false,
            });
            setConfirmCompleteEvent(null);
          } catch (err) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err instanceof Error ? err.message : 'Failed to complete event.',
              type: 'error',
              isRead: false,
            });
          }
        }}
      />
      <Modal
        isOpen={!!detailsEvent}
        onClose={() => setDetailsEvent(null)}
        title={detailsEvent?.title ? String(detailsEvent.title) : 'Event Details'}
        size="lg"
      >
        {detailsEvent && (
          <div className="space-y-5">
            {(() => {
              const isTeamRegistration = ['team', 'pair'].includes(String(detailsEvent.registrationMode || 'individual'));
              const isRegistered = !!registeredEventIds[String(detailsEvent.id)];
              const detailsEventId = String(detailsEvent.id);
              const detailsRegistrationStatus = memberStatusByEvent[detailsEventId] || '';
              const isPaidEvent = Number(detailsEvent.fee || 0) > 0;
              const stats = getEventPaymentStats(detailsEventId, Number(detailsEvent.fee || 0));
              const hasPaymentSubmitted = detailsRegistrationStatus === 'Payment Submitted' || stats.totalPendingPaid > 0;
              const canUploadPaymentProof = isRegistered && isPaidEvent && stats.remainingBalance > 0;

              return (
                <>
            <div className="text-sm text-gray-600">
              {detailsEvent.date}{detailsEvent.time ? ` • ${detailsEvent.time}` : ''}{detailsEvent.location ? ` • ${detailsEvent.location}` : ''}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Event Status:</span>
              <Badge variant={getStatusColor(detailsEvent.status)}>
                {String((memberStatusByEvent[String(detailsEvent.id)] || detailsEvent.status) || '').replace(/^./, (x: string) => x.toUpperCase())}
              </Badge>
            </div>

            {/* 2-Phase Lifecycle Process Stepper */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>Event Process Lifecycle</span>
                <Badge variant={detailsEvent.status === 'ongoing' ? 'success' : detailsEvent.status === 'upcoming' ? 'info' : 'secondary'}>
                  {detailsEvent.status === 'ongoing' ? 'Phase 2: Event Started' : detailsEvent.status === 'upcoming' ? 'Phase 1: Registration Open' : (String(detailsEvent.status).charAt(0).toUpperCase() + String(detailsEvent.status).slice(1))}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg border transition-all ${detailsEvent.status === 'upcoming' ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-sm' : 'bg-white border-gray-200 opacity-60'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${detailsEvent.status === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>1</span>
                    <span className="font-semibold text-sm text-gray-900">Phase 1: Open for Registration</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 pl-8">Registration is active. Preparing participants and rosters.</p>
                </div>
                <div className={`p-3 rounded-lg border transition-all ${detailsEvent.status === 'ongoing' ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm' : 'bg-white border-gray-200 opacity-60'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${detailsEvent.status === 'ongoing' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>2</span>
                    <span className="font-semibold text-sm text-gray-900">Phase 2: Event Started</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 pl-8">All participants are ready. Registration is closed.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <div>
                <span className="font-semibold text-gray-900">Registration Mode:</span>{' '}
                {String(detailsEvent.registrationMode || 'individual').replace(/^./, (x: string) => x.toUpperCase())}
              </div>
              {detailsEvent.requiresCoach && (
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-indigo-200">
                  <UserCheck size={12} /> Coach Required
                </span>
              )}
              {Boolean(detailsEvent.hasModerator || detailsEvent.moderatorOfficerName) && (
                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                  <ShieldCheck size={12} /> Moderator: {detailsEvent.moderatorOfficerName || 'Officer Assigned'}
                </span>
              )}
            </div>

            {detailsEvent.description && (
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-2">Description</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{detailsEvent.description}</div>
              </div>
            )}

            {(detailsEvent.guidelines || detailsEvent.guidelinesFileUrl) && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <span>Guidelines</span>
                    {detailsEvent.guidelinesFileUrl && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-800 font-medium">
                        Document Attached
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowGuidelinesModal(true)}>
                    View Guidelines
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Open the guidelines in a separate view.</p>
              </div>
            )}

            {canManageEvents && (
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900">Admin/Officer Tools</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {detailsEvent.status === 'upcoming' && (
                    <Button
                      variant="primary"
                      onClick={() =>
                        setConfirmStartEvent({
                          eventId: String(detailsEvent.id),
                          title: detailsEvent.title,
                        })
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <Play size={16} /> Start Event (Close Registration & Begin)
                    </Button>
                  )}
                  {detailsEvent.status === 'ongoing' && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setConfirmCompleteEvent({
                          eventId: String(detailsEvent.id),
                          title: detailsEvent.title,
                        })
                      }
                      className="text-indigo-700 border-indigo-300 hover:bg-indigo-50 font-semibold flex items-center gap-1.5"
                    >
                      <CheckCircle size={16} /> Complete Event
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => downloadTemplate(detailsEvent.title)}>
                    <FileSpreadsheet size={16} /> Generate registration spreadsheet format
                  </Button>
                  <Button variant="outline" onClick={() => openEditModal(detailsEvent)}>
                    <Pencil size={16} /> Edit / Update event
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const content = [
                          `Event: ${detailsEvent.title}`,
                          detailsEvent.date ? `Date: ${detailsEvent.date}` : '',
                          detailsEvent.time ? `Time: ${detailsEvent.time}` : '',
                          detailsEvent.location ? `Location: ${detailsEvent.location}` : '',
                          detailsEvent.description ? `Details: ${detailsEvent.description}` : '',
                        ].filter(Boolean).join('\n');

                        const { data } = await api.createAnnouncement({
                          title: `Event Announcement: ${detailsEvent.title}`,
                          content,
                          audience: ['all'],
                          status: 'published',
                        });
                        if (data?.success) {
                          addNotification({
                            userId: 'current',
                            title: 'Announcement Posted',
                            message: 'Event announcement has been published.',
                            type: 'success',
                            isRead: false,
                          });
                        }
                      } catch (err) {
                        addNotification({
                          userId: 'current',
                          title: 'Error',
                          message: err instanceof Error ? err.message : 'Failed to post announcement.',
                          type: 'error',
                          isRead: false,
                        });
                      }
                    }}
                  >
                    <Megaphone size={16} /> Post Announcement
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Registration Approvals</p>
                    {isLoadingDetailsLists ? (
                      <p className="text-sm text-gray-500">Loading...</p>
                    ) : (
                      <div className="space-y-2">
                        {eventRegistrations
                          .filter((r) => String(r.status) === 'pending')
                          .slice(0, 6)
                          .map((registration) => (
                            <div key={registration.id} className="rounded border border-gray-200 p-2">
                              <p className="text-sm font-semibold text-gray-900">{registration.memberName || registration.memberEmail}</p>
                              <p className="text-xs text-gray-600">Participants: {registration.participantCount || 1}</p>
                              {registration.teamProfileUrl && (
                                <a
                                  href={registration.teamProfileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-primary underline"
                                >
                                  View Attached File (Team / Pair)
                                </a>
                              )}
                              <div className="mt-2 flex gap-2">
                                <Button size="sm" variant="success" onClick={() => setPendingApproval({ kind: 'registration', id: String(registration.id), approve: true, name: registration.memberName || registration.memberEmail || 'Registration' })}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => setPendingApproval({ kind: 'registration', id: String(registration.id), approve: false, name: registration.memberName || registration.memberEmail || 'Registration' })}>
                                  Reject
                                </Button>
                              </div>
                            </div>
                          ))}
                        {!eventRegistrations.filter((r) => String(r.status) === 'pending').length && (
                          <p className="text-sm text-gray-500">No pending registrations.</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Participant Profile Approvals</p>
                    {isLoadingDetailsLists ? (
                      <p className="text-sm text-gray-500">Loading...</p>
                    ) : (
                      <div className="space-y-2">
                        {eventParticipants
                          .filter((p) => String(p.status) === 'pending')
                          .slice(0, 6)
                          .map((participant) => (
                            <div key={participant.id} className="rounded border border-gray-200 p-2">
                              <p className="text-sm font-semibold text-gray-900">{participant.fullName}</p>
                              <p className="text-xs text-gray-600">{participant.institutionName || '-'} • {participant.position || '-'}</p>
                              <div className="mt-2 flex gap-2">
                                <Button size="sm" variant="success" onClick={() => setPendingApproval({ kind: 'participant', id: String(participant.id), approve: true, name: participant.fullName || 'Participant' })}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => setPendingApproval({ kind: 'participant', id: String(participant.id), approve: false, name: participant.fullName || 'Participant' })}>
                                  Reject
                                </Button>
                              </div>
                            </div>
                          ))}
                        {!eventParticipants.filter((p) => String(p.status) === 'pending').length && (
                          <p className="text-sm text-gray-500">No pending participants.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {canManageEvents && (
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900">Participants List</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Event Registrations</p>
                    {eventRegistrations.length === 0 ? (
                      <p className="text-sm text-gray-500">No registrations yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {eventRegistrations.slice(0, 8).map((registration) => (
                          <div key={registration.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium text-gray-900">{registration.memberName || registration.memberEmail}</span>
                            <Badge variant={getStatusColor(registration.status)}>{registration.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Institution Members</p>
                    {eventParticipants.length === 0 ? (
                      <p className="text-sm text-gray-500">No institution participants yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {eventParticipants.slice(0, 8).map((participant) => (
                          <div key={participant.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium text-gray-900">{participant.fullName}</span>
                            <Badge variant={getStatusColor(participant.status)}>{participant.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isMember && (
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900">Member Registration Actions</p>
                {isPaidEvent && !isRegistered && (
                  <p className="text-xs text-gray-500">Paid events require a transaction proof upload to complete registration.</p>
                )}
                {isPaidEvent && isRegistered && hasPaymentSubmitted && (
                  <p className="text-xs text-gray-500">Payment proof already submitted. Waiting for verification.</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {canUploadPaymentProof && (
                    <Button variant="primary" onClick={() => openPaymentForEvent(detailsEvent)}>
                      <Upload size={16} /> Upload Transaction Proof
                    </Button>
                  )}
                </div>

                {(isTeamRegistration || isInstitution) && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            {isInstitution && registrationSource === 'select' ? (
                              <Users size={16} className="text-primary" />
                            ) : (
                              <FileSpreadsheet size={16} className="text-primary" />
                            )}
                            {detailsEvent.registrationMode === 'pair'
                              ? 'Pair / Duo Registration'
                              : detailsEvent.registrationMode === 'team'
                              ? 'Team Registration'
                              : 'Institution Member Registration'}
                          </p>
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            {detailsEvent.registrationMode === 'pair'
                              ? 'Required for Pair / Duo'
                              : detailsEvent.registrationMode === 'team'
                              ? 'Required for Team'
                              : 'Institution Entry'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {isInstitution
                            ? 'Select participating members from your institution or upload a spreadsheet file.'
                            : `Upload your ${detailsEvent.registrationMode === 'pair' ? 'pair / duo' : 'team'} members in CSV, Excel, or spreadsheet format only (.csv, .xlsx, .xls).`}
                        </p>
                      </div>
                      {(!isInstitution || registrationSource === 'upload') && (
                        <button
                          type="button"
                          onClick={() => downloadTemplate(detailsEvent.title, 'default')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline self-start sm:self-auto cursor-pointer"
                          title="Download sample spreadsheet template"
                        >
                          <Download size={13} />
                          Download Template
                        </button>
                      )}
                    </div>

                    {isInstitution && (
                      <div className="flex flex-wrap items-center gap-2 border-b border-blue-200/80 pb-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setRegistrationSource('select');
                            setTeamProfileError(null);
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                            registrationSource === 'select'
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <Users size={14} />
                          Select from Institution Members
                          {uniqueInstitutionMembers.length > 0 && (
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                registrationSource === 'select' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {uniqueInstitutionMembers.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRegistrationSource('upload');
                            setTeamProfileError(null);
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                            registrationSource === 'upload'
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <FileSpreadsheet size={14} />
                          Upload Spreadsheet (CSV / Excel)
                        </button>
                      </div>
                    )}

                    {isInstitution && registrationSource === 'select' ? (
                      <div className="space-y-3">
                        {/* Event Coach Selection (when requiresCoach is true) */}
                        {detailsEvent.requiresCoach && (
                          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <UserCheck size={17} className="text-indigo-600 shrink-0" />
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                                  Event Coach Required
                                </span>
                              </div>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800">
                                Official Coach
                              </span>
                            </div>
                            <p className="text-xs text-indigo-900 leading-relaxed">
                              This event requires an assigned Coach. Select your designated Coach from your institution members below:
                            </p>

                            <div className="space-y-2">
                              <select
                                value={selectedCoachMemberId}
                                onChange={(e) => {
                                  const coachId = e.target.value;
                                  setSelectedCoachMemberId(coachId);
                                  if (coachId && !selectedInstitutionMemberIds.includes(coachId)) {
                                    setSelectedInstitutionMemberIds((prev) => [...prev, coachId]);
                                  }
                                  setTeamProfileError(null);
                                }}
                                className="w-full text-xs rounded-lg border border-indigo-300 bg-white px-3 py-2 text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                              >
                                <option value="">-- Choose Coach from Institution Members --</option>
                                {uniqueInstitutionMembers.map((m) => {
                                  const isCoachPos = (m.position || '').toLowerCase().includes('coach');
                                  return (
                                    <option key={m.id} value={String(m.id)}>
                                      {isCoachPos ? '⭐ [COACH] ' : ''}{m.fullName} ({m.position || 'Member'}) {m.email ? `• ${m.email}` : ''}
                                    </option>
                                  );
                                })}
                              </select>

                              {selectedCoachMemberId ? (
                                <div className="flex items-center gap-2 text-xs text-indigo-800 font-semibold bg-indigo-100/80 px-2.5 py-1.5 rounded-lg border border-indigo-200">
                                  <CheckCircle size={14} className="text-indigo-600 shrink-0" />
                                  <span>
                                    Designated Coach: <strong>{uniqueInstitutionMembers.find((m) => String(m.id) === String(selectedCoachMemberId))?.fullName || 'Selected Member'}</strong>
                                  </span>
                                </div>
                              ) : (
                                <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                                  ⚠️ Please select an official Coach for this event.
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search members by name, email, or role..."
                              value={memberSearchQuery}
                              onChange={(e) => setMemberSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                          {filteredInstitutionMembers.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const allFilteredIds = filteredInstitutionMembers.map((m) => String(m.id));
                                const isAllSelected = allFilteredIds.every((id) => selectedInstitutionMemberIds.includes(id));
                                if (isAllSelected) {
                                  setSelectedInstitutionMemberIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
                                } else {
                                  setSelectedInstitutionMemberIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
                                }
                                setTeamProfileError(null);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer shrink-0"
                            >
                              {filteredInstitutionMembers.every((m) => selectedInstitutionMemberIds.includes(String(m.id)))
                                ? 'Deselect All'
                                : 'Select All'}
                            </button>
                          )}
                        </div>

                        {isLoadingInstitutionRoster ? (
                          <div className="py-6 text-center text-xs text-gray-500">Loading institution members...</div>
                        ) : filteredInstitutionMembers.length === 0 ? (
                          <div className="py-6 text-center text-xs text-gray-500 rounded-lg border border-dashed border-gray-300 bg-white p-4 space-y-2">
                            <Users size={28} className="mx-auto text-gray-400 mb-1" />
                            <p className="font-semibold text-gray-700">
                              {memberSearchQuery ? 'No members match your search.' : 'No institution members registered yet.'}
                            </p>
                            {!memberSearchQuery && (
                              <p className="text-[11px] text-gray-500">
                                You can register members under your institution in{' '}
                                <a href="/institution-members" target="_blank" rel="noreferrer" className="text-primary underline font-medium">
                                  Institution Members
                                </a>{' '}
                                or use the "Upload Spreadsheet" tab.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-lg border border-gray-200 bg-white p-2">
                            {filteredInstitutionMembers.map((member) => {
                              const isSelected = selectedInstitutionMemberIds.includes(String(member.id));
                              const isCoach = (member.position || '').toLowerCase().includes('coach');
                              return (
                                <div
                                  key={member.id}
                                  onClick={() => toggleSelectMember(String(member.id))}
                                  className={`flex items-center justify-between gap-3 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'border-primary/50 bg-blue-50/60 font-medium text-gray-900'
                                      : 'border-transparent hover:bg-gray-50 text-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectMember(String(member.id))}
                                      onClick={(e) => e.stopPropagation()}
                                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                    />
                                    <div className="min-w-0 truncate">
                                      <p className="font-semibold text-gray-900 truncate">{member.fullName}</p>
                                      <p className="text-[11px] text-gray-500 truncate">
                                        {member.email || 'No email'} {member.contactNumber ? `• ${member.contactNumber}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <span className={`shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                                    isCoach
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {isCoach && <UserCheck size={11} />}
                                    {member.position || 'Member'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {selectedInstitutionMemberIds.length > 0 && (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-900">
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle size={18} className="text-green-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 truncate">
                                  {selectedInstitutionMemberIds.length} member{selectedInstitutionMemberIds.length === 1 ? '' : 's'} selected for this event
                                </p>
                                <p className="text-[11px] text-green-700">
                                  {detailsEvent.registrationMode === 'pair' ? (
                                    selectedInstitutionMemberIds.length === 2 ? (
                                      '✓ Ready for Pair / Duo event'
                                    ) : (
                                      `⚠️ Exactly 2 members required for Pair / Duo (currently ${selectedInstitutionMemberIds.length})`
                                    )
                                  ) : detailsEvent.registrationMode === 'team' ? (
                                    selectedInstitutionMemberIds.length >= 2 ? (
                                      `✓ Ready for Team event (${selectedInstitutionMemberIds.length} members)`
                                    ) : (
                                      `⚠️ Minimum 2 members required for Team (currently ${selectedInstitutionMemberIds.length})`
                                    )
                                  ) : (
                                    '✓ Ready to register'
                                  )}
                                </p>
                                {detailsEvent.requiresCoach && (
                                  <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                                    {selectedMembers.some((m) => (m.position || '').toLowerCase().includes('coach') || String(m.id) === String(selectedCoachMemberId))
                                      ? '✓ Official Coach designated'
                                      : '⚠️ Coach required: Please select a member with position Coach'}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInstitutionMemberIds([]);
                                setTeamProfileError(null);
                              }}
                              className="text-red-600 hover:text-red-800 text-xs font-semibold underline self-start sm:self-auto cursor-pointer shrink-0"
                            >
                              Clear Selection
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {!teamProfileFile && !participantFileName ? (
                          <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-primary bg-white px-4 py-3 text-sm font-semibold text-primary shadow-xs transition-all hover:bg-blue-50">
                            <Upload size={16} />
                            {isUploadingParticipants
                              ? 'Processing Spreadsheet...'
                              : `Batch Upload ${detailsEvent.registrationMode === 'pair' ? 'Pair / Duo' : 'Team'} (CSV / Excel / Spreadsheet)`}
                            <input
                              ref={teamProfileInputRef}
                              type="file"
                              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                              className="hidden"
                              disabled={isUploadingParticipants}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                setTeamProfileError(null);
                                if (!file) return;

                                const allowedExts = ['.csv', '.xlsx', '.xls'];
                                const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                                if (!allowedExts.includes(fileExt)) {
                                  setTeamProfileError('Invalid file format. Please upload CSV (.csv) or Excel / Spreadsheet (.xlsx, .xls) file.');
                                  e.currentTarget.value = '';
                                  return;
                                }
                                if (file.size > 15 * 1024 * 1024) {
                                  setTeamProfileError('File must be 15MB or below.');
                                  e.currentTarget.value = '';
                                  return;
                                }

                                setParticipantFileName(file.name);
                                setTeamProfileFile(file);
                                if (teamProfilePreview) URL.revokeObjectURL(teamProfilePreview);
                                setTeamProfilePreview(URL.createObjectURL(file));

                                setIsUploadingParticipants(true);
                                try {
                                  const parsed = (await parseSpreadsheetFile(file))
                                    .map((x) => ({ ...x, eventId: detailsEvent.id, eventTitle: x.eventTitle || detailsEvent.title }))
                                    .filter((x) => String(x.fullName || '').trim());
                                  setParticipantUploadCount(parsed.length);

                                  if (parsed.length > 0) {
                                    await api.bulkUploadInstitutionMembers(parsed);
                                  }

                                  addNotification({
                                    userId: 'current',
                                    title: 'Batch Upload Successful',
                                    message: `${parsed.length > 0 ? `${parsed.length} participants registered from ` : ''}${file.name}.`,
                                    type: 'success',
                                    isRead: false,
                                  });
                                } catch (err) {
                                  addNotification({
                                    userId: 'current',
                                    title: 'Upload Notice',
                                    message: err instanceof Error ? err.message : `Spreadsheet attached for ${detailsEvent.registrationMode === 'pair' ? 'pair / duo' : 'team'} registration.`,
                                    type: 'info',
                                    isRead: false,
                                  });
                                } finally {
                                  setIsUploadingParticipants(false);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                          </label>
                        ) : (
                          <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-900">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileSpreadsheet size={20} className="text-green-700 shrink-0" />
                              <div className="min-w-0 truncate">
                                <p className="font-bold text-gray-900 truncate">
                                  {teamProfileFile?.name || participantFileName}
                                </p>
                                <p className="text-[11px] text-green-700">
                                  ✓ {detailsEvent.registrationMode === 'pair' ? 'Pair / Duo' : 'Team'} file attached {participantUploadCount > 0 ? `• ${participantUploadCount} participant${participantUploadCount === 1 ? '' : 's'} registered` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                <Upload size={13} />
                                Change
                                <input
                                  type="file"
                                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                  className="hidden"
                                  disabled={isUploadingParticipants}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    setTeamProfileError(null);
                                    if (!file) return;

                                    const allowedExts = ['.csv', '.xlsx', '.xls'];
                                    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                                    if (!allowedExts.includes(fileExt)) {
                                      setTeamProfileError('Invalid file format. Please upload CSV (.csv) or Excel / Spreadsheet (.xlsx, .xls) file.');
                                      e.currentTarget.value = '';
                                      return;
                                    }

                                    setParticipantFileName(file.name);
                                    setTeamProfileFile(file);
                                    if (teamProfilePreview) URL.revokeObjectURL(teamProfilePreview);
                                    setTeamProfilePreview(URL.createObjectURL(file));

                                    setIsUploadingParticipants(true);
                                    try {
                                      const parsed = (await parseSpreadsheetFile(file))
                                        .map((x) => ({ ...x, eventId: detailsEvent.id, eventTitle: x.eventTitle || detailsEvent.title }))
                                        .filter((x) => String(x.fullName || '').trim());
                                      setParticipantUploadCount(parsed.length);

                                      if (parsed.length > 0) {
                                        await api.bulkUploadInstitutionMembers(parsed);
                                      }

                                      addNotification({
                                        userId: 'current',
                                        title: 'Batch Upload Updated',
                                        message: `${parsed.length > 0 ? `${parsed.length} participants registered from ` : ''}${file.name}.`,
                                        type: 'success',
                                        isRead: false,
                                      });
                                    } catch (err) {
                                      // ignore
                                    } finally {
                                      setIsUploadingParticipants(false);
                                      e.currentTarget.value = '';
                                    }
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  if (teamProfilePreview) URL.revokeObjectURL(teamProfilePreview);
                                  setTeamProfilePreview('');
                                  setTeamProfileFile(null);
                                  setParticipantFileName('');
                                  setParticipantUploadCount(0);
                                  setTeamProfileError(null);
                                  if (teamProfileInputRef.current) teamProfileInputRef.current.value = '';
                                }}
                                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                title="Remove attached file"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {teamProfileError && <p className="text-xs text-red-600 font-semibold">{teamProfileError}</p>}
                  </div>
                )}

                <div className="text-sm text-gray-600">Registration Fee: <span className="font-semibold text-gray-900">{formatCurrency(detailsEvent.fee)}</span></div>
                {isMember && isPaidEvent && (
                  <div className="space-y-1.5 mt-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span>Payment Progress</span>
                      <span>{formatCurrency(stats.totalVerifiedPaid)} / {formatCurrency(detailsEvent.fee)} Paid ({stats.percentPaid}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${stats.percentPaid}%` }}
                      ></div>
                    </div>
                    {stats.totalPendingPaid > 0 && (
                      <p className="text-xs text-yellow-600 italic font-medium">
                        * PHP {stats.totalPendingPaid.toLocaleString()} pending verification
                      </p>
                    )}
                  </div>
                )}

              </div>
            )}

            {isMember && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant={isRegistered ? 'secondary' : 'primary'}
                  onClick={() => {
                    void handleRegister(detailsEvent);
                  }}
                  disabled={isRegistered}
                  className="w-full sm:w-auto"
                >
                  <CheckCircle size={16} /> {isRegistered ? 'Registered' : (isPaidEvent ? 'Register & Upload Proof' : 'Register for Event')}
                </Button>
              </div>
            )}
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showGuidelinesModal}
        onClose={() => setShowGuidelinesModal(false)}
        title="Event Guidelines"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            {detailsEvent?.title ? `Event: ${detailsEvent.title}` : 'Guidelines'}
          </p>

          {/* Attached Guidelines Document */}
          {detailsEvent?.guidelinesFileUrl && (
            <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 shrink-0">
                  <FileSpreadsheet size={22} />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-gray-900 dark:text-white block truncate">
                    {detailsEvent.guidelinesFileName || 'Official Guidelines Document'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">Attached file for participant review & reference</span>
                </div>
              </div>
              <a
                href={detailsEvent.guidelinesFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors shrink-0"
              >
                <Download size={15} />
                View / Download Document ↗
              </a>
            </div>
          )}

          {/* Text Guidelines */}
          {detailsEvent?.guidelines && (
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 dark:border-slate-800 p-4 text-sm text-gray-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-obsidian-card">
              {String(detailsEvent.guidelines)}
            </div>
          )}

          {!detailsEvent?.guidelines && !detailsEvent?.guidelinesFileUrl && (
            <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 dark:bg-obsidian-surface rounded-lg border border-gray-200 dark:border-slate-800">
              No guidelines available for this event.
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-slate-800">
            <Button variant="primary" onClick={() => setShowGuidelinesModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showTemplateUploadModal}
        onClose={() => !isUploadingParticipants && setShowTemplateUploadModal(false)}
        title="Upload Spreadsheet Template"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Select a template and download it. {canManageEvents ? 'Admins/Officers can upload new templates here.' : ''}
          </p>

          <Select
            label="Template"
            options={Object.entries(allTemplates).map(([key, t]) => ({ value: key, label: t.label }))}
            value={String(selectedTemplateKey)}
            onChange={(e) => setSelectedTemplateKey((e.target as HTMLSelectElement).value)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                downloadTemplate(String(templateContextTitle || 'Sample Event'), String(selectedTemplateKey));
              }}
            >
              <FileSpreadsheet size={16} /> Download Selected Template
            </Button>

            {canManageEvents && (
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-primary px-4 py-2 text-primary hover:bg-blue-50">
                <Upload size={16} /> Upload New Template
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const isCsv = file.name.toLowerCase().endsWith('.csv') || String(file.type || '').includes('csv');
                      const content = isCsv ? await file.text() : await readAsDataUrl(file);
                      const base = String(file.name || 'template').replace(/\.[^.]+$/, '').trim() || 'template';
                      let key = base.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
                      if (!key) key = 'template';
                      let nextKey = key;
                      let i = 2;
                      while (Object.prototype.hasOwnProperty.call(allTemplates, nextKey)) {
                        nextKey = `${key}-${i}`;
                        i += 1;
                      }
                      const newTemplate: StoredTemplate = {
                        label: `${base} (Uploaded)`,
                        kind: isCsv ? 'text' : 'dataUrl',
                        content: isCsv ? content.slice(0, 20000) : content,
                        filename: file.name,
                      };
                      const next = {
                        ...customTemplates,
                        [nextKey]: newTemplate,
                      };
                      persistCustomTemplates(next);
                      setSelectedTemplateKey(nextKey);
                      addNotification({
                        userId: 'current',
                        title: 'Template Added',
                        message: `"${base}" template is now available.`,
                        type: 'success',
                        isRead: false,
                      });
                    } catch (err) {
                      addNotification({
                        userId: 'current',
                        title: 'Upload Error',
                        message: err instanceof Error ? err.message : 'Failed to upload template file.',
                        type: 'error',
                        isRead: false,
                      });
                    } finally {
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </label>
            )}
          </div>

          {templateContextTitle && (
            <div className="text-xs text-gray-600">
              Template event title placeholder: <span className="font-semibold text-gray-900">{templateContextTitle}</span>
            </div>
          )}

          {participantFileName && (
            <div className="text-xs text-gray-600">
              Last upload: {participantFileName} ({participantUploadCount} rows){isUploadingParticipants ? ' - Processing...' : ''}
            </div>
          )}

          {canManageEvents && Object.keys(customTemplates).length > 0 && (
            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Uploaded Templates</p>
              <div className="space-y-2">
                {Object.entries(customTemplates).map(([key, t]) => (
                  <div key={key} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{t.label}</div>
                      <div className="text-xs text-gray-500">Key: {key}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        const next = { ...customTemplates };
                        delete next[key];
                        persistCustomTemplates(next);
                        if (selectedTemplateKey === key) setSelectedTemplateKey('default');
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showPaymentModal}
        onClose={closePaymentModal}
        title={paymentFlow === 'pre_register' ? 'Complete Registration' : 'Upload Transaction Proof'}
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const targetEvent = paymentEvent || detailsEvent;
            if (!targetEvent) return;
            const stats = getEventPaymentStats(targetEvent.id, Number(targetEvent.fee || 0));
            const amt = Number(paymentForm.amount);
            if (!amt || amt <= 0) {
              setPaymentError('Please enter a valid amount greater than 0.');
              return;
            }
            if (amt > stats.remainingBalance + 0.01) {
              setPaymentError(`Amount cannot exceed the remaining balance of PHP ${stats.remainingBalance.toLocaleString()}.`);
              return;
            }
            if (!paymentForm.file) {
              if (paymentForm.method === 'through_officer') {
                setPaymentError('Please upload an Official Receipt (OR) photo or scan.');
              } else {
                setPaymentError('Please upload a screenshot/photo of your payment receipt.');
              }
              return;
            }
            if (paymentForm.method === 'gcash' && !paymentForm.referenceNumber.trim()) {
              setPaymentError('Please enter the GCash transaction reference number.');
              return;
            }
            setConfirmPaymentSubmit(true);
          }}
        >
          {paymentError && <div className="text-sm text-red-600">{paymentError}</div>}

          {paymentEvent && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-900">{paymentEvent.title}</p>
              <p className="text-xs text-gray-600">Registration fee: {formatCurrency(Number(paymentEvent.fee || 0))}</p>
              {paymentFlow === 'pre_register' && (
                <p className="text-xs text-gray-600 mt-1">Upload transaction proof to submit your registration.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Payment Method"
              options={[
                { value: 'through_officer', label: 'Through Officer' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'gcash', label: 'GCash' },
              ]}
              value={paymentForm.method}
              onChange={(e) => setPaymentForm((p) => ({ ...p, method: (e.target as HTMLSelectElement).value as any }))}
            />
            <Input
              label="Amount"
              type="number"
              value={String(paymentForm.amount)}
              onChange={(e) => setPaymentForm((p) => ({ ...p, amount: Number((e.target as HTMLInputElement).value) || 0 }))}
              helperText="You can adjust this amount to make a partial payment."
            />
            <div className="md:col-span-2">
              <Input
                label={
                  paymentForm.method === 'gcash'
                    ? 'GCash Reference Number'
                    : paymentForm.method === 'through_officer'
                    ? 'Official Receipt (OR) Number (optional)'
                    : paymentForm.method === 'bank_transfer'
                    ? 'Bank Reference / Trace Number (optional)'
                    : 'Cheque Number (optional)'
                }
                type="text"
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm((p) => ({ ...p, referenceNumber: (e.target as HTMLInputElement).value }))}
                placeholder={
                  paymentForm.method === 'gcash'
                    ? 'Enter 13-digit GCash reference number'
                    : paymentForm.method === 'through_officer'
                    ? 'e.g. OR-2026-0042'
                    : paymentForm.method === 'bank_transfer'
                    ? 'e.g. BNK-837492'
                    : 'e.g. CHQ-0012394'
                }
                required={paymentForm.method === 'gcash'}
                helperText={
                  paymentForm.method === 'gcash'
                    ? 'Required: Enter the reference number from your GCash receipt.'
                    : undefined
                }
              />
            </div>
          </div>

          {/* QR Code and Payment Instructions Card */}
          <PaymentInstructionsCard method={paymentForm.method} />

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {paymentForm.method === 'through_officer'
                ? 'Official Receipt (OR) Photo / Scan *'
                : paymentForm.method === 'bank_transfer'
                ? 'Bank Transfer Receipt / Deposit Slip *'
                : paymentForm.method === 'cheque'
                ? 'Cheque Receipt / Copy *'
                : 'GCash Transaction Receipt / Screenshot *'}
            </label>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              {paymentForm.method === 'through_officer'
                ? 'Please upload a clear photo or scanned image of the Official Receipt (OR) issued by the PSITS officer.'
                : paymentForm.method === 'bank_transfer'
                ? 'Please upload your bank deposit slip or mobile banking transfer confirmation receipt.'
                : paymentForm.method === 'cheque'
                ? 'Please upload a clear photo of the cheque or bank deposit receipt.'
                : 'Please upload the full transaction receipt or screenshot from your GCash app.'}
            </p>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-primary px-4 py-2 text-primary hover:bg-blue-50">
              <Upload size={16} /> Choose File
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0] || null;
                  setPaymentError(null);
                  if (!file) return;
                  if (file.size > 8 * 1024 * 1024) {
                    setPaymentError('File must be 8MB or below.');
                    return;
                  }
                  if (paymentForm.previewUrl) URL.revokeObjectURL(paymentForm.previewUrl);
                  const previewUrl = URL.createObjectURL(file);
                  setPaymentForm((p) => ({ ...p, file, previewUrl }));
                }}
              />
            </label>
            {paymentForm.file && <p className="text-xs text-gray-600 mt-2">Selected: {paymentForm.file.name}</p>}
          </div>

          {paymentForm.previewUrl && (
            <div className="rounded-lg border border-gray-200 p-3">
              <img src={paymentForm.previewUrl} alt="Transaction proof preview" className="w-full max-h-80 object-contain" />
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={isSubmittingPayment} onClick={closePaymentModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingPayment}>
              {paymentFlow === 'pre_register' ? 'Submit Registration' : 'Submit for Verification'}
            </Button>
          </div>
        </form>
      </Modal>

      <VerifyActionModal
        isOpen={confirmPaymentSubmit}
        title={paymentFlow === 'pre_register' ? 'Verify Registration Submission' : 'Verify Payment Submission'}
        message={paymentFlow === 'pre_register' ? 'Submit your registration with this transaction proof?' : 'Are you sure you want to submit this payment proof for verification?'}
        confirmLabel="Submit"
        confirmVariant="primary"
        onCancel={() => {
          if (isSubmittingPayment) return;
          setConfirmPaymentSubmit(false);
        }}
        onVerified={async () => {
          const targetEvent = paymentEvent || detailsEvent;
          if (!targetEvent || !paymentForm.file) return;
          setIsSubmittingPayment(true);
          setPaymentError(null);
          try {
            const dataUrl = await readAsDataUrl(paymentForm.file);
            const { data: upload } = await api.uploadPaymentProof(dataUrl);
            const proofUrl = upload?.url;
            if (!proofUrl) throw new Error('Upload failed.');

            if (paymentFlow === 'pre_register') {
              await registerForEvent(targetEvent, true);
            }

            await api.createPayment({
              eventId: targetEvent.id,
              amount: Number(paymentForm.amount) || Number(targetEvent.fee) || 0,
              method: paymentForm.method,
              referenceNumber: paymentForm.referenceNumber,
              proofUrl,
            });

            if (isMember) {
              const { data: payRes } = await api.getPayments();
              if (payRes?.success) {
                setMemberPayments(payRes.payments || []);
              }
            }

            setMemberStatusByEvent((prev) => ({ ...prev, [String(targetEvent.id)]: 'Payment Submitted' }));
            addNotification({
              userId: 'current',
              title: paymentFlow === 'pre_register' ? 'Registration Completed' : 'Submitted',
              message: paymentFlow === 'pre_register'
                ? 'Transaction proof uploaded and registration submitted. Waiting for verification.'
                : 'Transaction proof uploaded. Waiting for verification.',
              type: 'success',
              isRead: false,
            });

            closePaymentModal();
          } catch (err) {
            setPaymentError(err instanceof Error ? err.message : 'Failed to submit payment.');
          } finally {
            setIsSubmittingPayment(false);
          }
        }}
      />

      <VerifyActionModal
        isOpen={!!pendingApproval}
        title={pendingApproval?.approve ? 'Approve Entry' : 'Reject Entry'}
        message={
          pendingApproval
            ? `${pendingApproval.approve ? 'Approve' : 'Reject'} ${pendingApproval.name}?`
            : ''
        }
        confirmLabel="Accept"
        confirmVariant={pendingApproval?.approve ? 'primary' : 'danger'}
        onCancel={() => setPendingApproval(null)}
        onVerified={async () => {
          if (!pendingApproval) return;
          try {
            await runApproval(pendingApproval);
            addNotification({
              userId: 'current',
              title: pendingApproval.approve ? 'Approved' : 'Rejected',
              message: `${pendingApproval.name} has been ${pendingApproval.approve ? 'approved' : 'rejected'}.`,
              type: 'success',
              isRead: false,
            });
          } catch (err) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err instanceof Error ? err.message : 'Failed to update approval status.',
              type: 'error',
              isRead: false,
            });
          } finally {
            setPendingApproval(null);
          }
        }}
      />
    </MainLayout>
  );
};
