
// Author: Mark Daniel Digol
import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input, TextArea, Select, Badge } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { useAuth } from '@/shared/context/AuthContext';
import { Calendar, Users, MapPin, Clock, Plus, Pencil, Power, FileSpreadsheet, Upload, CheckCircle, Megaphone } from 'lucide-react';
import api from '@/shared/services/api';
import { useNotification } from '@/shared/context/NotificationContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';

type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
type LiveSessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
type RegistrationOverride = '' | 'open' | 'closed';

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

const splitCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
};

const parseCsvParticipants = (text: string) => {
  const rows = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (rows.length < 2) return [];
  const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const headers = splitCsvLine(rows[0]).map((h) => normalizeHeader(h));
  const idx = (name: string) => headers.indexOf(normalizeHeader(name));
  return rows.slice(1).map((row) => {
    const cols = splitCsvLine(row);
    return {
      fullName: idx('fullname') >= 0 ? cols[idx('fullname')] : cols[0] || '',
      email: idx('email') >= 0 ? cols[idx('email')] : '',
      contactNumber: idx('contactnumber') >= 0 ? cols[idx('contactnumber')] : '',
      gender: idx('gender') >= 0 ? cols[idx('gender')] : '',
      position: idx('position') >= 0 ? cols[idx('position')] : '',
      eventTitle: idx('eventtitle') >= 0 ? cols[idx('eventtitle')] : '',
      notes: idx('notes') >= 0 ? cols[idx('notes')] : '',
    };
  });
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

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmPaymentSubmit, setConfirmPaymentSubmit] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentEvent, setPaymentEvent] = useState<any | null>(null);
  const [paymentFlow, setPaymentFlow] = useState<'pre_register' | 'post_register'>('post_register');
  const [teamProfileFile, setTeamProfileFile] = useState<File | null>(null);
  const [teamProfilePreview, setTeamProfilePreview] = useState('');
  const [teamProfileError, setTeamProfileError] = useState<string | null>(null);

  const [participantFileName, setParticipantFileName] = useState('');
  const [participantUploadCount, setParticipantUploadCount] = useState(0);
  const [isUploadingParticipants, setIsUploadingParticipants] = useState(false);
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

  const [paymentForm, setPaymentForm] = useState<{
    method: 'gcash' | 'paypal' | 'paymaya' | 'card';
    amount: number;
    file: File | null;
    previewUrl: string;
  }>({
    method: 'gcash',
    amount: 0,
    file: null,
    previewUrl: '',
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    guidelines: '',
    guidelineFileName: '',
    registrationMode: 'individual',
    registrationOverride: '' as RegistrationOverride,
    registrationStartDate: '',
    registrationStartTime: '',
    registrationEndDate: '',
    registrationEndTime: '',
    location: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    fee: 0,
    capacity: 0,
    status: 'draft' as EventStatus,
    isEsports: false,
    esportsGame: '',
    esportsBracketFormat: '',
  });

  const canManageEvents = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';
  const isMember = user?.role === 'member';
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);
  const [showTemplateUploadModal, setShowTemplateUploadModal] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('default');
  const [templateContextTitle, setTemplateContextTitle] = useState('Sample Event');
  const [customTemplates, setCustomTemplates] = useState<Record<string, StoredTemplate>>({});
  const resetPaymentForm = (amount = 0) => {
    if (paymentForm.previewUrl) URL.revokeObjectURL(paymentForm.previewUrl);
    setPaymentForm({ method: 'gcash', amount, file: null, previewUrl: '' });
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

  useEffect(() => {
    if (!isMember) return;
    let cancelled = false;
    const loadMyRegistrations = async () => {
      try {
        const { data } = await api.getMyEventRegistrations();
        if (!cancelled && data?.success) {
          const regs = data.registrations || [];
          const registeredMap: Record<string, boolean> = {};
          const statusMap: Record<string, string> = {};
          regs.forEach((reg: any) => {
            registeredMap[String(reg.eventId)] = true;
            statusMap[String(reg.eventId)] = reg.status;
          });
          setRegisteredEventIds(registeredMap);
          setMemberStatusByEvent(statusMap);
        }
      } catch {
        // ignore
      }
    };
    void loadMyRegistrations();
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
    const override = String(event?.registrationOverride || '').toLowerCase();
    const regStart = event?.registrationStartAt ? new Date(String(event.registrationStartAt)) : null;
    const regEnd = event?.registrationEndAt ? new Date(String(event.registrationEndAt)) : null;
    const endAt = event?.endDate && event?.endTime ? new Date(`${event.endDate}T${event.endTime}:00`) : null;

    if (endAt && !Number.isNaN(endAt.getTime()) && endAt.getTime() <= now.getTime()) {
      return { key: 'finished', label: 'Event Finished', variant: 'error' };
    }

    if (override === 'closed') return { key: 'closed', label: 'Closed', variant: 'warning' };
    if (override === 'open') return { key: 'open', label: 'Open', variant: 'success' };

    if (regStart && !Number.isNaN(regStart.getTime()) && now < regStart) return { key: 'not_yet_open', label: 'Not Yet Open', variant: 'info' };
    if (regEnd && !Number.isNaN(regEnd.getTime()) && now > regEnd) return { key: 'closed', label: 'Closed', variant: 'warning' };

    // Default: open until event starts
    const startAt = event?.date && event?.time ? new Date(`${event.date}T${event.time}:00`) : null;
    if (startAt && !Number.isNaN(startAt.getTime()) && now > startAt) return { key: 'closed', label: 'Closed', variant: 'warning' };

    return { key: 'open', label: 'Open', variant: 'success' };
  };

  const openCreateModal = () => {
    setEditingEventId(null);
    setFormData({
      title: '',
      description: '',
      guidelines: '',
      guidelineFileName: '',
      registrationMode: 'individual',
      registrationOverride: '' as RegistrationOverride,
      registrationStartDate: '',
      registrationStartTime: '',
      registrationEndDate: '',
      registrationEndTime: '',
      location: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      fee: 0,
      capacity: 0,
      status: 'upcoming',
      isEsports: false,
      esportsGame: '',
      esportsBracketFormat: '',
    });
    setShowEventModal(true);
  };

  const openEditModal = (event: any) => {
    setEditingEventId(String(event.id));
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
      if (['team', 'pair'].includes(mode) && !teamProfileFile) {
        setTeamProfileError('Team profile file is required for this registration mode.');
        addNotification({
          userId: 'current',
          title: 'Validation',
          message: 'Please upload a team profile before registering.',
          type: 'error',
          isRead: false,
        });
        return;
      }

      let teamProfileUrl: string | null = null;
      if (teamProfileFile) {
        const dataUrl = await readAsDataUrl(teamProfileFile);
        const { data: upload } = await api.uploadTeamProfile(dataUrl);
        teamProfileUrl = upload?.url || null;
      }

      const { data } = await api.registerForEvent(String(event.id), {
        participantCount: Math.max(1, Number(participantUploadCount || 1)),
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
          message: Number(event?.fee || 0) > 0 ? `You are now registered for ${event.title}.` : `You are now registered for ${event.title}. Waiting for approval.`,
          type: 'success',
          isRead: false,
        });
      }

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
    resetPaymentForm(Number(event?.fee || 0));
    setShowPaymentModal(true);
  };

  const handleRegister = async (event: any) => {
    const mode = String(event?.registrationMode || 'individual');
    if (['team', 'pair'].includes(mode) && !teamProfileFile) {
      setDetailsEvent(event);
      setTeamProfileError('Team profile file is required for this registration mode.');
      return;
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
        message: `${session.title} is ready in the Live Events module.`,
        type: 'success',
        isRead: false,
      });
      window.location.href = `/live-events?session=${encodeURIComponent(session.id)}`;
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.map((event) => {
            const isRegistered = !!registeredEventIds[String(event.id)];
            const statusText = memberStatusByEvent[String(event.id)] || event.status;
            const isPaidEvent = Number(event?.fee || 0) > 0;
            const regState = getRegistrationState(event);
            return (
              <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold text-gray-900">{event.title}</h3>
                    <div className="flex items-center gap-2">
                      {isRegistered && <Badge variant="success">Registered</Badge>}
                      {isPaidEvent && <Badge variant="warning">With Fee</Badge>}
                      {isMember && <Badge variant={regState.variant}>{regState.label}</Badge>}
                      <Badge variant={getStatusColor(event.status)}>
                        {String(event.status).charAt(0).toUpperCase() + String(event.status).slice(1)}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2"><Calendar size={16} /> {event.date}</div>
                    <div className="flex items-center gap-2"><Clock size={16} /> {event.time}</div>
                    <div className="flex items-center gap-2"><MapPin size={16} /> {event.location}</div>
                    <div className="flex items-center gap-2"><Users size={16} /> {event.registrations} / {event.capacity} participants</div>
                    <div className="flex items-center gap-2"><Megaphone size={16} /> Mode: {String(event.registrationMode || 'individual').replace(/^./, (x: string) => x.toUpperCase())}</div>
                    {isMember && (event.registrationStartAt || event.registrationEndAt) && (
                      <div className="text-xs text-gray-500">
                        Registration: {event.registrationStartAt ? String(event.registrationStartAt).replace('T', ' ').slice(0, 16) : '—'} → {event.registrationEndAt ? String(event.registrationEndAt).replace('T', ' ').slice(0, 16) : '—'}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                    <span className="font-bold text-primary">{formatCurrency(event.fee)}</span>
                    <Button variant="outline" size="sm" onClick={() => setDetailsEvent(event)}>View Details</Button>
                  </div>

                  {canManageEvents && (
                    <div className="grid grid-cols-2 gap-2">
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
                    </div>
                  )}

                  {isMember && (
                    <div className="space-y-2">
                      <Button
                        variant={isRegistered ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => void handleRegister(event)}
                        disabled={isRegistered || regState.key !== 'open'}
                      >
                        <CheckCircle size={16} /> {isRegistered ? 'Registered' : (isPaidEvent ? 'Register & Upload Proof' : 'Register for Event')}
                      </Button>
                      <div className="text-xs text-gray-600">Status: {String(statusText).charAt(0).toUpperCase() + String(statusText).slice(1)}</div>
                    </div>
                  )}
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
      <Modal isOpen={showEventModal} onClose={() => setShowEventModal(false)} title={editingEventId ? 'Edit Event' : 'Create Event'} size="lg">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!formData.title.trim()) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Event title is required.', type: 'error', isRead: false });
              return;
            }
            if (!formData.location.trim()) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Event location is required.', type: 'error', isRead: false });
              return;
            }
            if (Number(formData.fee) < 0) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Event fee must be 0 or greater.', type: 'error', isRead: false });
              return;
            }
            if (Number(formData.capacity) < 0) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Capacity must be 0 or greater.', type: 'error', isRead: false });
              return;
            }
            const startAt = formData.startDate && formData.startTime ? `${formData.startDate}T${formData.startTime}:00` : null;
            if (!startAt) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Start date/time is required.', type: 'error', isRead: false });
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
              return;
            }
            if ((formData.registrationEndDate && !formData.registrationEndTime) || (!formData.registrationEndDate && formData.registrationEndTime)) {
              addNotification({ userId: 'current', title: 'Validation', message: 'Registration end must include both date and time.', type: 'error', isRead: false });
              return;
            }
            if (registrationStartAt && registrationEndAt) {
              const rs = new Date(registrationStartAt);
              const re = new Date(registrationEndAt);
              if (!Number.isNaN(rs.getTime()) && !Number.isNaN(re.getTime()) && re < rs) {
                addNotification({ userId: 'current', title: 'Validation', message: 'Registration end must be after registration start.', type: 'error', isRead: false });
                return;
              }
            }
            if ((formData.endDate && !formData.endTime) || (!formData.endDate && formData.endTime)) {
              addNotification({ userId: 'current', title: 'Validation', message: 'End date/time must include both date and time.', type: 'error', isRead: false });
              return;
            }
            const endAt =
              formData.endDate && formData.endTime ? `${formData.endDate}T${formData.endTime}:00` : null;
            if (endAt) {
              const startCheck = new Date(startAt);
              const endCheck = new Date(endAt);
              if (!Number.isNaN(startCheck.getTime()) && !Number.isNaN(endCheck.getTime()) && endCheck < startCheck) {
                addNotification({ userId: 'current', title: 'Validation', message: 'End date/time must be after start date/time.', type: 'error', isRead: false });
                return;
              }
            }

            if (formData.isEsports) {
              if (!formData.esportsGame) {
                addNotification({ userId: 'current', title: 'Validation', message: 'eSports Game is required.', type: 'error', isRead: false });
                return;
              }
              if (!formData.esportsBracketFormat) {
                addNotification({ userId: 'current', title: 'Validation', message: 'Tournament Bracket Format is required.', type: 'error', isRead: false });
                return;
              }
            }

            setPendingEventPayload({
              title: formData.title.trim(),
              description: formData.description.trim(),
              guidelines: formData.guidelines.trim(),
              registrationMode: formData.registrationMode,
              registrationOverride: formData.registrationOverride || null,
              ...(registrationStartAt ? { registrationStartAt } : {}),
              ...(registrationEndAt ? { registrationEndAt } : {}),
              location: formData.location.trim(),
              startAt,
              ...(endAt ? { endAt } : {}),
              fee: Number(formData.fee) || 0,
              capacity: Number(formData.capacity) || 0,
              status: formData.status,
              isEsports: formData.isEsports,
              esportsGame: formData.esportsGame,
              esportsBracketFormat: formData.esportsBracketFormat,
            });
            setConfirmSaveEvent(true);
          }}
        >
          <Input label="Title" required value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} />
          <TextArea label="Description" rows={4} value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: (e.target as HTMLTextAreaElement).value }))} />

          <div className="space-y-2">
            <TextArea
              label="Guidelines"
              rows={4}
              placeholder="Add event guidelines"
              value={formData.guidelines}
              onChange={(e) => setFormData((p) => ({ ...p, guidelines: (e.target as HTMLTextAreaElement).value }))}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Guidelines File</label>
              <input
                type="file"
                accept=".txt,.md,.pdf,.doc,.docx"
                onChange={async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0] || null;
                  if (!file) return;
                  setFormData((p) => ({ ...p, guidelineFileName: file.name }));
                  if (file.type.startsWith('text/')) {
                    const text = await file.text();
                    setFormData((p) => ({ ...p, guidelines: text.slice(0, 5000), guidelineFileName: file.name }));
                  }
                }}
              />
              {formData.guidelineFileName && <p className="text-xs text-gray-500 mt-1">Selected: {formData.guidelineFileName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Registration Control"
              options={[
                { value: '', label: 'Automatic (by dates)' },
                { value: 'open', label: 'Force Open (Manual)' },
                { value: 'closed', label: 'Force Closed (Manual)' },
              ]}
              value={formData.registrationOverride}
              onChange={(e) => setFormData((p) => ({ ...p, registrationOverride: (e.target as HTMLSelectElement).value as RegistrationOverride }))}
            />
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Reg Start Date" type="date" value={formData.registrationStartDate} onChange={(e) => setFormData((p) => ({ ...p, registrationStartDate: e.target.value }))} />
              <Input label="Reg Start Time" type="time" value={formData.registrationStartTime} onChange={(e) => setFormData((p) => ({ ...p, registrationStartTime: e.target.value }))} />
              <Input label="Reg End Date" type="date" value={formData.registrationEndDate} onChange={(e) => setFormData((p) => ({ ...p, registrationEndDate: e.target.value }))} />
              <Input label="Reg End Time" type="time" value={formData.registrationEndTime} onChange={(e) => setFormData((p) => ({ ...p, registrationEndTime: e.target.value }))} />
            </div>
          </div>

          <Select
            label="Registration Mode"
            options={[
              { value: 'individual', label: 'Individual' },
              { value: 'pair', label: 'Pair' },
              { value: 'team', label: 'Team' },
            ]}
            value={formData.registrationMode}
            onChange={(e) => setFormData((p) => ({ ...p, registrationMode: (e.target as HTMLSelectElement).value }))}
          />

          <div className="flex items-center gap-2 mb-4 mt-2">
            <input
              type="checkbox"
              id="isEsports"
              checked={formData.isEsports}
              onChange={(e) => setFormData((p) => ({ ...p, isEsports: e.target.checked }))}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label htmlFor="isEsports" className="text-sm font-medium text-gray-700">
              Is this an eSports Event?
            </label>
          </div>

          {formData.isEsports && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-primary/5 p-4 rounded-lg mb-4 border border-primary/20">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">eSports Game</label>
                <select
                  value={formData.esportsGame}
                  onChange={(e) => setFormData((p) => ({ ...p, esportsGame: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                label="Tournament Bracket Format"
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
          )}

          <Input label="Location" required value={formData.location} onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={formData.startDate} onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))} />
            <Input label="Start Time" type="time" value={formData.startTime} onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="End Date (optional)" type="date" value={formData.endDate} onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))} />
            <Input label="End Time (optional)" type="time" value={formData.endTime} onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Registration Fee" type="number" value={String(formData.fee)} onChange={(e) => setFormData((p) => ({ ...p, fee: Number(e.target.value) }))} />
            <Input label="Capacity" type="number" value={String(formData.capacity)} onChange={(e) => setFormData((p) => ({ ...p, capacity: Number(e.target.value) }))} />
            <Select
              label="Event Status"
              options={[
                { value: 'upcoming', label: 'Automatic (default)' },
                { value: 'draft', label: 'Draft (Manual)' },
                { value: 'cancelled', label: 'Cancelled (Manual)' },
              ]}
              value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: (e.target as HTMLSelectElement).value as EventStatus }))}
            />
            <p className="text-xs text-gray-500 md:col-span-3">
              Automatic status is based on Start Date/Time. {getAutoStatusPreview()}.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
              {editingEventId ? 'Update Event' : 'Create Event'}
            </Button>
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
              const hasPaymentSubmitted = detailsRegistrationStatus === 'Payment Submitted';
              const canUploadPaymentProof = isRegistered && isPaidEvent && !hasPaymentSubmitted;

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
                      window.location.href = '/live-events';
                    }}
                  >
                    Manage in Live Events
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
                                  View Team Profile
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

                {['team', 'pair'].includes(String(detailsEvent.registrationMode || 'individual')) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => openTemplateUpload(detailsEvent.title)}>
                      <FileSpreadsheet size={16} /> Use Spreadsheet Template
                    </Button>

                    {user?.memberType === 'institution' && (
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-primary px-4 py-2 text-primary hover:bg-blue-50">
                        <Upload size={16} /> Upload Participants (CSV)
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setParticipantFileName(file.name);
                            setIsUploadingParticipants(true);
                            try {
                              const text = await file.text();
                              const parsed = parseCsvParticipants(text)
                                .map((x) => ({ ...x, eventId: detailsEvent.id, eventTitle: x.eventTitle || detailsEvent.title }))
                                .filter((x) => String(x.fullName || '').trim());
                              setParticipantUploadCount(parsed.length);

                              if (parsed.length > 0) {
                                await api.bulkUploadInstitutionMembers(parsed);
                              }

                              addNotification({
                                userId: 'current',
                                title: 'Participants Uploaded',
                                message: `${parsed.length} participants uploaded from ${file.name}.`,
                                type: 'success',
                                isRead: false,
                              });
                            } catch (err) {
                              addNotification({
                                userId: 'current',
                                title: 'Upload Error',
                                message: err instanceof Error ? err.message : 'Failed to upload participants file.',
                                type: 'error',
                                isRead: false,
                              });
                            } finally {
                              setIsUploadingParticipants(false);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}

                {isTeamRegistration && (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <p className="text-sm font-semibold text-gray-900">Team Profile (required for team/pair)</p>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setTeamProfileError(null);
                        if (!file) {
                          setTeamProfileFile(null);
                          return;
                        }
                        if (file.size > 8 * 1024 * 1024) {
                          setTeamProfileError('File must be 8MB or below.');
                          return;
                        }
                        if (teamProfilePreview) URL.revokeObjectURL(teamProfilePreview);
                        setTeamProfilePreview(URL.createObjectURL(file));
                        setTeamProfileFile(file);
                      }}
                    />
                    {teamProfileError && <p className="text-sm text-red-600">{teamProfileError}</p>}
                    {teamProfileFile && <p className="text-xs text-gray-600">Selected: {teamProfileFile.name}</p>}
                  </div>
                )}

                <div className="text-sm text-gray-600">Registration Fee: <span className="font-semibold text-gray-900">{formatCurrency(detailsEvent.fee)}</span></div>
                {participantFileName && (
                  <div className="text-xs text-gray-600">Uploaded file: {participantFileName} ({participantUploadCount} rows){isUploadingParticipants ? ' - Processing...' : ''}</div>
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
                { value: 'card', label: 'Card' },
              ]}
              value={paymentForm.method}
              onChange={(e) => setPaymentForm((p) => ({ ...p, method: (e.target as HTMLSelectElement).value as any }))}
            />
            <Input
              label="Amount"
              type="number"
              value={String(paymentForm.amount)}
              readOnly
              helperText="Amount is fixed by the event registration fee."
            />
          </div>

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
              proofUrl,
            });

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
