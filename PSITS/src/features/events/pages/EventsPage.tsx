
// Author: Mark Daniel Digol
import { useEffect, useMemo, useState, useRef } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input, TextArea, Select, Badge } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { useAuth } from '@/shared/context/AuthContext';
import { Users, MapPin, Plus, Pencil, Power, FileSpreadsheet, Upload, CheckCircle, Megaphone, Eye, Sparkles, ChevronRight, ChevronLeft, Layers, Trophy, Trash2, Download, Search, Play } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '@/shared/services/api';
import { useNotification } from '@/shared/context/NotificationContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { PaymentInstructionsCard } from '@/shared/components/PaymentInstructionsCard';

type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
type LiveSessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
type RegistrationOverride = '' | 'open' | 'closed';

export const EVENT_CATEGORIES = [
  { value: 'competition', label: 'Competition' },
  { value: 'contest', label: 'Contest' },
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

type LiveSession = {
  id: string;
  eventId?: string | null;
  title: string;
  description?: string | null;
  hostLabel?: string | null;
  startAt?: string | null;
  durationMinutes?: number;
  sessionType: 'livestream';
  privacy: 'public' | 'private' | 'event_registered_only';
  status: LiveSessionStatus;
  roomCode?: string | null;
  participantCount?: number;
  activeViewerCount?: number;
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | 'draft'>('all');
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
  const [eventLiveSessions, setEventLiveSessions] = useState<LiveSession[]>([]);
  const [isLoadingDetailsLists, setIsLoadingDetailsLists] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{
    kind: 'registration' | 'participant';
    id: string;
    approve: boolean;
    name: string;
  } | null>(null);

  const [memberPayments, setMemberPayments] = useState<any[]>([]);

  const [paymentForm, setPaymentForm] = useState<{
    method: 'gcash' | 'paypal' | 'paymaya' | 'bank_transfer';
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
    guidelineFileName: '',
    registrationMode: '',
    registrationOverride: '' as RegistrationOverride,
    registrationStartDate: '',
    registrationStartTime: '',
    registrationEndDate: '',
    registrationEndTime: '',
    eventType: '',
    location: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    fee: 0,
    capacity: 0,
    status: '' as EventStatus,
    isEsports: false,
    esportsGame: '',
    esportsBracketFormat: '',
    bannerUrl: '',
    bannerFile: null as File | null,
    bannerPreviewUrl: '',
    themeColor: '#2563eb',
    customBadge: '',
  });

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
    setSelectedInstitutionMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
    if (!detailsEvent) {
      setEventLiveSessions([]);
      return;
    }

    let cancelled = false;
    const loadLiveSessions = async () => {
      try {
        const { data } = await api.getLiveEventsByEvent(String(detailsEvent.id));
        if (!cancelled && data?.success) {
          setEventLiveSessions(data.liveEvents || []);
        }
      } catch {
        if (!cancelled) setEventLiveSessions([]);
      }
    };

    void loadLiveSessions();
    return () => {
      cancelled = true;
    };
  }, [detailsEvent]);

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

  const openCreateModal = () => {
    setEditingEventId(null);
    setActiveFormTab('basic');
    setFormData({
      title: '',
      description: '',
      guidelines: '',
      guidelineFileName: '',
      registrationMode: '',
      registrationOverride: '' as RegistrationOverride,
      registrationStartDate: '',
      registrationStartTime: '',
      registrationEndDate: '',
      registrationEndTime: '',
      eventType: '',
      location: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      fee: 0,
      capacity: 0,
      status: '' as EventStatus,
      isEsports: false,
      esportsGame: '',
      esportsBracketFormat: '',
      bannerUrl: '',
      bannerFile: null,
      bannerPreviewUrl: '',
      themeColor: '#2563eb',
      customBadge: '',
    });
    setShowEventModal(true);
  };

  const openEditModal = (event: any) => {
    setEditingEventId(String(event.id));
    setActiveFormTab('basic');
    const regStart = splitIsoToDateTime(event.registrationStartAt);
    const regEnd = splitIsoToDateTime(event.registrationEndAt);
    setFormData({
      title: event.title || '',
      description: event.description || '',
      guidelines: event.guidelines || '',
      guidelineFileName: '',
      registrationMode: event.registrationMode || 'individual',
      registrationOverride: (event.registrationOverride || '') as RegistrationOverride,
      registrationStartDate: regStart.date,
      registrationStartTime: regStart.time,
      registrationEndDate: regEnd.date,
      registrationEndTime: regEnd.time,
      eventType: event.eventType || 'seminar',
      location: event.location || '',
      startDate: event.date || '',
      startTime: event.time || '',
      endDate: event.endDate || '',
      endTime: event.endTime || '',
      fee: Number(event.fee || 0),
      capacity: Number(event.capacity || 0),
      status: (['draft', 'cancelled'].includes(String(event.status)) ? String(event.status) : 'upcoming') as EventStatus,
      isEsports: Boolean(event.isEsports),
      esportsGame: event.esportsGame || '',
      esportsBracketFormat: event.esportsBracketFormat || '',
      bannerUrl: event.bannerUrl || '',
      bannerFile: null,
      bannerPreviewUrl: event.bannerUrl || '',
      themeColor: event.themeColor || '#2563eb',
      customBadge: event.customBadge || '',
    });
    setShowEventModal(true);
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
      if (formData.isEsports) {
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
      if (Number(formData.capacity) < 0) {
        addNotification({ userId: 'current', title: 'Validation', message: `${getParticipantCapacityLabel(formData.registrationMode)} must be 0 or greater.`, type: 'error', isRead: false });
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
      return true;
    }
    if (tab === 'guidelines') {
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

  const openLiveSessionFromEvent = async (session: LiveSession) => {
    try {
      await api.joinLiveEvent(session.id);
      addNotification({
        userId: 'current',
        title: 'Livestream Ready',
        message: `${session.title} is ready in the Stream Events module.`,
        type: 'success',
        isRead: false,
      });
      window.location.href = `/stream-events?session=${encodeURIComponent(session.id)}`;
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Access Denied',
        message: err instanceof Error ? err.message : 'Unable to open this live session.',
        type: 'error',
        isRead: false,
      });
    }
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Events Management</h1>
            <p className="text-gray-600 mt-2">Events Activites managements</p>
          </div>
          {canManageEvents && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button variant="outline" onClick={() => openTemplateUpload()} className="w-full sm:w-auto">
                <Upload size={16} />
                Upload Spreadsheet Template
              </Button>
              <Button variant="primary" size="lg" onClick={openCreateModal} className="w-full sm:w-auto">
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
              <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-all border-l-4" style={{ borderLeftColor: cardThemeColor }}>
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
                        <Badge variant={['competition', 'contest', 'hackathon'].includes(event.eventType) ? 'error' : 'info'}>
                          {getCategoryLabel(event.eventType)}
                        </Badge>
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
                  <div className="flex items-center gap-2"><Users size={16} className="text-gray-400" /> <span><strong>{getParticipantCapacityLabel(event.registrationMode)}:</strong> {event.registrations} / {event.capacity}</span></div>
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
              setActiveFormTab('guidelines');
              return;
            }
            if ((formData.registrationEndDate && !formData.registrationEndTime) || (!formData.registrationEndDate && formData.registrationEndTime)) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Registration end must include both date and time.', type: 'error', isRead: false });
              setActiveFormTab('guidelines');
              return;
            }
            if (registrationStartAt && registrationEndAt) {
              const rs = new Date(registrationStartAt);
              const re = new Date(registrationEndAt);
              if (!Number.isNaN(rs.getTime()) && !Number.isNaN(re.getTime()) && re < rs) {
                addNotification({ userId: 'current', title: 'Validation', message: 'Registration end must be after registration start.', type: 'error', isRead: false });
                setActiveFormTab('guidelines');
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

            if (formData.isEsports) {
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

              setPendingEventPayload({
                title: formData.title.trim(),
                description: formData.description.trim(),
                guidelines: formData.guidelines.trim(),
                registrationMode: formData.registrationMode || 'individual',
                registrationOverride: formData.registrationOverride || null,
                ...(registrationStartAt ? { registrationStartAt } : {}),
                ...(registrationEndAt ? { registrationEndAt } : {}),
                location: formData.location.trim(),
                eventType: formData.eventType || 'seminar',
                startAt,
                ...(endAt ? { endAt } : {}),
                fee: Number(formData.fee) || 0,
                capacity: Number(formData.capacity) || 0,
                status: formData.status || 'upcoming',
                isEsports: formData.isEsports,
                esportsGame: formData.esportsGame,
                esportsBracketFormat: formData.esportsBracketFormat,
                bannerUrl: finalBannerUrl,
                themeColor: formData.themeColor || '#2563eb',
                customBadge: formData.customBadge.trim() || null,
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
                  options={[
                    { value: '', label: 'Select an option' },
                    ...EVENT_CATEGORIES,
                  ]}
                  value={formData.eventType}
                  onChange={(e) => setFormData((p) => ({ ...p, eventType: (e.target as HTMLSelectElement).value }))}
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
              <TextArea
                label="Description"
                rows={4}
                placeholder="Provide a compelling overview of what participants can expect..."
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: (e.target as HTMLTextAreaElement).value }))}
              />
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-purple-600" />
                  <span className="text-sm font-medium text-gray-800">This is for Esports Events</span>
                </div>
                <input
                  type="checkbox"
                  id="isEsportsTab"
                  checked={formData.isEsports}
                  onChange={(e) => setFormData((p) => ({ ...p, isEsports: e.target.checked }))}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                />
              </div>

              {formData.isEsports && (
                <div className="space-y-4 animate-fadeIn bg-purple-50/60 p-4 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy size={18} className="text-purple-600" />
                    <h4 className="text-sm font-bold text-purple-900">eSports Tournament Settings</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">eSports Game *</label>
                      <select
                        value={formData.esportsGame}
                        onChange={(e) => setFormData((p) => ({ ...p, esportsGame: e.target.value }))}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="">Select Game...</option>
                        <optgroup label="Mobile Games">
                          <option value="Mobile Legends: Bang Bang">Mobile Legends: Bang Bang</option>
                          <option value="PUBG Mobile">PUBG Mobile</option>
                          <option value="Arena of Valor">Arena of Valor</option>
                          <option value="Call of Duty: Mobile">Call of Duty: Mobile</option>
                        </optgroup>
                        <optgroup label="PC Games">
                          <option value="VALORANT">VALORANT</option>
                          <option value="Dota 2">Dota 2</option>
                          <option value="League of Legends">League of Legends</option>
                          <option value="CrossFire">CrossFire</option>
                        </optgroup>
                      </select>
                    </div>
                    <Select
                      label="Tournament Bracket Format *"
                      options={[
                        { value: '', label: 'Select Format...' },
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Registration Fee (₱)" type="number" min="0" value={String(formData.fee)} onChange={(e) => setFormData((p) => ({ ...p, fee: Number(e.target.value) }))} />
                <Input label={getParticipantCapacityLabel(formData.registrationMode)} type="number" min="0" value={String(formData.capacity)} onChange={(e) => setFormData((p) => ({ ...p, capacity: Number(e.target.value) }))} />
                <Select
                  label="Event Status"
                  options={[
                    { value: 'upcoming', label: 'Automatic (default)' },
                    { value: 'draft', label: 'Draft (Manual)' },
                  ]}
                  value={formData.status}
                  onChange={(e) => setFormData((p) => ({ ...p, status: (e.target as HTMLSelectElement).value as EventStatus }))}
                />
              </div>
              <p className="text-xs text-gray-500">
                Automatic status preview: <strong>{getAutoStatusPreview()}</strong>.
              </p>
            </div>
          )}

          {/* TAB 3: GUIDELINES */}
          {activeFormTab === 'guidelines' && (
            <div className="space-y-5 animate-fadeIn">

              {/* Registration Window */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Registration Window (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border">
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
                <p className="text-xs text-gray-500">Leave blank to keep registration open based on event status.</p>
              </div>

              {/* Registration Override */}
              <Select
                label="Registration Override"
                options={[
                  { value: '', label: 'Auto (based on schedule)' },
                  { value: 'open', label: 'Force Open' },
                  { value: 'closed', label: 'Force Closed' },
                ]}
                value={formData.registrationOverride}
                onChange={(e) => setFormData((p) => ({ ...p, registrationOverride: (e.target as HTMLSelectElement).value as RegistrationOverride }))}
              />

              {/* Guidelines */}
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

            <div className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Registration Mode:</span>{' '}
              {String(detailsEvent.registrationMode || 'individual').replace(/^./, (x: string) => x.toUpperCase())}
            </div>

            {detailsEvent.description && (
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-2">Description</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{detailsEvent.description}</div>
              </div>
            )}

            {detailsEvent.guidelines && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-900">Guidelines</div>
                  <Button size="sm" variant="outline" onClick={() => setShowGuidelinesModal(true)}>
                    View Guidelines
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Open the guidelines in a separate view.</p>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Live Sessions</p>
                  <p className="text-xs text-gray-500">Livestream sessions linked to this event.</p>
                </div>
                {canManageEvents && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      localStorage.setItem('psits_live_event_manage_event', String(detailsEvent.id));
                      window.location.href = '/stream-events';
                    }}
                  >
                    Manage in Stream Events
                  </Button>
                )}
              </div>

              {eventLiveSessions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                  No live sessions are linked to this event yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {eventLiveSessions.map((session) => (
                    <div key={session.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{session.title}</p>
                            <Badge variant={getStatusColor(session.status)}>
                              {String(session.status || '').replace(/^./, (x: string) => x.toUpperCase())}
                            </Badge>
                            <Badge variant="info">
                              Livestream
                            </Badge>
                          </div>
                          {session.description && (
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{session.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                            {session.startAt && <span>Schedule: {new Date(session.startAt).toLocaleString()}</span>}
                            <span>Privacy: {String(session.privacy || 'public').replace(/_/g, ' ')}</span>
                            {session.roomCode && <span>Room Code: {session.roomCode}</span>}
                            <span>Viewers: {Number(session.activeViewerCount || session.participantCount || 0)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => void openLiveSessionFromEvent(session)}
                            disabled={session.status === 'ended' || session.status === 'cancelled'}
                          >
                            {session.sessionType === 'livestream' ? 'Watch Livestream' : 'Join Session'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                                  <span className="shrink-0 text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
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
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            {detailsEvent?.title ? `Event: ${detailsEvent.title}` : 'Guidelines'}
          </p>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-wrap">
            {detailsEvent?.guidelines ? String(detailsEvent.guidelines) : 'No guidelines available.'}
          </div>
          <div className="flex justify-end">
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
            if (!paymentForm.referenceNumber.trim()) {
              setPaymentError('Please enter the transaction reference number.');
              return;
            }
            if (!paymentForm.file) {
              setPaymentError('Please upload a screenshot/photo of the transaction.');
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
                { value: 'gcash', label: 'GCash' },
                { value: 'paymaya', label: 'PayMaya' },
                { value: 'paypal', label: 'PayPal' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
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
                label="Reference Number"
                type="text"
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm((p) => ({ ...p, referenceNumber: (e.target as HTMLInputElement).value }))}
                placeholder="Enter transaction reference number"
                required
              />
            </div>
          </div>

          {/* QR Code and Payment Instructions Card */}
          <PaymentInstructionsCard method={paymentForm.method} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Screenshot / Photo</label>
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
