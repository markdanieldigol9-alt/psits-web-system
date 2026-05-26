import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/shared/layouts';
import { Card, Button } from '@/shared/components/Form';
import { Badge, Modal } from '@/shared/components/Common';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { LiveSessionModal } from '@/features/live-events/components/LiveSessionModal';
import type { LiveSession, LiveSessionFormState, LiveSessionStatus } from '@/features/live-events/types/liveSessions';
import { Calendar, Clock, Copy, ExternalLink, MonitorPlay, Pencil, Plus, Send, Trash2, Users, Video } from 'lucide-react';

function toMysqlDatetime(value: string) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (v.includes('T')) {
    const [d, t] = v.split('T');
    const tt = t.length === 5 ? `${t}:00` : t;
    return `${d} ${tt}`;
  }
  return v;
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toSafeRoomName(value: string) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toJoinLink(sessionId: string) {
  return `/live-events?session=${encodeURIComponent(sessionId)}`;
}

function safeUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw).toString();
  } catch {
    return null;
  }
}

function toYouTubeEmbedUrl(url?: string | null) {
  const u = String(url || '').trim();
  if (!u) return null;
  try {
    const parsed = new URL(u);
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function generateSessionIdentifier(title: string) {
  const prefix = toSafeRoomName(title).replace(/-/g, '').toUpperCase().slice(0, 6) || 'PSITS';
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LS-${prefix}-${suffix}`;
}

function generateSessionToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function createEmptySessionFormState(hostLabel: string): LiveSessionFormState {
  return {
    title: '',
    description: '',
    eventId: '',
    hostLabel,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    status: 'scheduled',
    privacy: 'public',
    allowChat: true,
    streamSource: 'built_in',
    streamUrl: '',
    roomCode: '',
    sessionId: '',
    joinLink: '',
    sessionToken: '',
    recordingEnabled: false,
    recordingVisibility: 'host_only',
    saveMode: 'create',
  };
}

export const LiveEventsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const location = useLocation();

  const canManage = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  const [isLoading, setIsLoading] = useState(true);
  const [liveEvents, setLiveEvents] = useState<LiveSession[]>([]);
  const [eventOptions, setEventOptions] = useState<Array<{ id: string; title: string }>>([]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LiveSession | null>(null);
  const [formData, setFormData] = useState<LiveSessionFormState>(() => createEmptySessionFormState(user?.fullName || ''));
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof LiveSessionFormState | 'schedule', string>>>({});

  const [confirmDelete, setConfirmDelete] = useState<LiveSession | null>(null);

  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [recordingUploadPct, setRecordingUploadPct] = useState(0);

  const getStatusVariant = (status: LiveSessionStatus) => {
    switch (status) {
      case 'live':
        return 'error';
      case 'scheduled':
        return 'info';
      case 'ended':
        return 'warning';
      case 'cancelled':
        return 'warning';
      default:
        return 'info';
    }
  };

  const refresh = async () => {
    const { data } = await api.getLiveSessions();
    if (data?.success) setLiveEvents(((data.liveEvents || []) as LiveSession[]).filter((x) => x.sessionType === 'livestream'));
  };

  const refreshActiveSession = async (id: string) => {
    try {
      const { data } = await api.getLiveEvent(id);
      if (data?.success && data.liveEvent) setActiveSession(data.liveEvent as LiveSession);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const [sessionsRes, eventsRes] = await Promise.all([
          api.getLiveSessions(),
          api.getEvents({ status: 'all' }),
        ]);
        if (!cancelled && sessionsRes.data?.success) {
          setLiveEvents(((sessionsRes.data.liveEvents || []) as LiveSession[]).filter((x) => x.sessionType === 'livestream'));
        }
        if (!cancelled && eventsRes.data?.success) {
          setEventOptions((eventsRes.data.events || []).map((event: any) => ({
            id: String(event.id),
            title: String(event.title || 'Untitled Event'),
          })));
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
  }, []);

  useEffect(() => {
    setFormData((prev) => {
      const nextRoomCode = toSafeRoomName(prev.title || prev.roomCode || 'psits-live-session').toUpperCase();
      const nextSessionId = prev.sessionId || generateSessionIdentifier(prev.title);
      const nextJoinLink = toJoinLink(nextSessionId);
      const nextToken = prev.sessionToken || generateSessionToken();

      if (
        prev.roomCode === nextRoomCode &&
        prev.sessionId === nextSessionId &&
        prev.joinLink === nextJoinLink &&
        prev.sessionToken === nextToken
      ) {
        return prev;
      }

      return {
        ...prev,
        roomCode: nextRoomCode,
        sessionId: nextSessionId,
        joinLink: nextJoinLink,
        sessionToken: nextToken,
      };
    });
  }, [formData.title]);

  useEffect(() => {
    if (!activeSession?.id) return;

    let cancelled = false;
    const loadChat = async () => {
      setIsLoadingChat(true);
      try {
        const { data } = await api.getLiveEventChatMessages(activeSession.id);
        if (!cancelled && data?.success) setChatMessages(data.messages || []);
      } catch {
        if (!cancelled) setChatMessages([]);
      } finally {
        if (!cancelled) setIsLoadingChat(false);
      }
    };

    void loadChat();
    const timer = window.setInterval(() => void loadChat(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSession?.id]);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const sessionKey = search.get('session');
    if (!sessionKey || !liveEvents.length) return;
    const found = liveEvents.find((s) => String(s.sessionId || s.id) === sessionKey || String(s.id) === sessionKey);
    if (found) setActiveSession(found);
  }, [location.search, liveEvents]);

  const sorted = useMemo(() => {
    const copy = [...liveEvents];
    copy.sort((a, b) => {
      const s = (x: LiveSession) => (x.status === 'live' ? 0 : x.status === 'scheduled' ? 1 : x.status === 'ended' ? 2 : 3);
      const ds = s(a) - s(b);
      if (ds) return ds;
      const at = a.startAt ? new Date(a.startAt).getTime() : 0;
      const bt = b.startAt ? new Date(b.startAt).getTime() : 0;
      return bt - at;
    });
    return copy;
  }, [liveEvents]);

  const openCreate = () => {
    setEditing(null);
    setFormErrors({});
    setFormData(createEmptySessionFormState(user?.fullName || ''));
    setShowModal(true);
  };

  const openEdit = (e: LiveSession) => {
    setEditing(e);
    setFormErrors({});
    const startLocal = toDatetimeLocal(e.startAt || null);
    const endLocal = toDatetimeLocal(e.endAt || null);
    const [startDate = '', startTime = ''] = startLocal ? startLocal.split('T') : ['', ''];
    const [endDate = '', endTime = ''] = endLocal ? endLocal.split('T') : ['', ''];
    setFormData({
      title: e.title || '',
      description: e.description || '',
      eventId: String(e.eventId || ''),
      hostLabel: e.hostLabel || '',
      startDate,
      startTime,
      endDate,
      endTime,
      status: e.status || 'scheduled',
      privacy: e.privacy || 'public',
      allowChat: Boolean(e.chatEnabled),
      streamSource: e.streamSource === 'external' ? 'external' : 'built_in',
      streamUrl: String(e.streamUrl || e.meetingUrl || ''),
      roomCode: String(e.roomCode || ''),
      sessionId: String(e.sessionId || e.id),
      joinLink: String(e.joinLink || toJoinLink(String(e.sessionId || e.id))),
      sessionToken: String(e.sessionToken || generateSessionToken()),
      recordingEnabled: Boolean(e.recordingEnabled),
      recordingVisibility: e.recordingVisibility || 'host_only',
      saveMode: 'create',
    });
    setShowModal(true);
  };

  const submit = async () => {
    const nextErrors: Partial<Record<keyof LiveSessionFormState | 'schedule', string>> = {};
    if (!formData.title.trim()) nextErrors.title = 'Session title is required.';
    if (!formData.eventId) nextErrors.eventId = 'Linked event is required.';
    if (!formData.startDate || !formData.startTime) nextErrors.startDate = 'Start date and time are required.';
    if (!formData.privacy) nextErrors.privacy = 'Privacy is required.';
    
    if (formData.streamSource === 'external') {
      if (!formData.streamUrl.trim()) {
        nextErrors.streamUrl = 'Stream URL is required for external streams.';
      } else if (!safeUrl(formData.streamUrl)) {
        nextErrors.streamUrl = 'Please provide a valid stream URL.';
      }
    }

    const startAt = formData.startDate && formData.startTime ? `${formData.startDate}T${formData.startTime}` : '';
    const endAt = formData.endDate && formData.endTime ? `${formData.endDate}T${formData.endTime}` : '';
    if (startAt && endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
      nextErrors.schedule = 'End time must not be earlier than start time.';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) throw new Error('Please fix the live session form errors.');

    const streamUrl = safeUrl(formData.streamUrl);
    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      eventId: formData.eventId,
      sessionId: formData.sessionId,
      hostLabel: formData.hostLabel.trim(),
      startAt: toMysqlDatetime(startAt),
      endAt: endAt ? toMysqlDatetime(endAt) : null,
      status: formData.saveMode === 'draft' ? 'scheduled' : formData.status,
      meetingUrl: streamUrl,
      streamUrl,
      streamSource: formData.streamSource,
      joinLink: formData.joinLink,
      roomCode: formData.roomCode,
      sessionToken: formData.sessionToken,
      sessionType: 'livestream',
      privacy: formData.privacy,
      chatEnabled: formData.allowChat,
      recordingEnabled: formData.recordingEnabled,
      recordingVisibility: formData.recordingVisibility,
    };

    if (editing) {
      await api.updateLiveSession(editing.id, payload);
      addNotification({ userId: 'current', title: 'Updated', message: 'Live session updated.', type: 'success', isRead: false });
    } else {
      await api.createLiveSession(payload);
      addNotification({
        userId: 'current',
        title: formData.saveMode === 'draft' ? 'Draft Saved' : 'Session Created',
        message: formData.saveMode === 'draft' ? 'Live session draft saved.' : 'Live session created.',
        type: 'success',
        isRead: false,
      });
    }

    setShowModal(false);
    setEditing(null);
    await refresh();
  };

  const copyInvite = async (session: LiveSession) => {
    const inviteText = `${session.title}\nSession ID: ${session.sessionId || session.id}\nRoom Code: ${session.roomCode || 'N/A'}\nJoin Link: ${session.joinLink || ''}\nStream URL: ${session.streamUrl || session.meetingUrl || ''}`;
    try {
      await navigator.clipboard.writeText(inviteText);
      addNotification({ userId: 'current', title: 'Invite Copied', message: 'Session invite details copied to clipboard.', type: 'success', isRead: false });
    } catch {
      addNotification({ userId: 'current', title: 'Copy Failed', message: 'Unable to copy invite details.', type: 'error', isRead: false });
    }
  };

  const sendChatMessage = async () => {
    if (!activeSession?.id) return;
    const message = chatInput.trim();
    if (!message) return;

    setIsSendingChat(true);
    try {
      const { data } = await api.createLiveEventChatMessage(activeSession.id, message);
      if (data?.success && data?.message) {
        setChatMessages((prev) => [...prev, data.message]);
        setChatInput('');
      }
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Chat Failed',
        message: err instanceof Error ? err.message : 'Unable to send message.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsSendingChat(false);
    }
  };

  const downloadRecording = async (session: LiveSession) => {
    try {
      const res = await api.downloadLiveEventRecording(session.id);
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(session.title || 'live-session').replace(/[/\\\\?%*:|\"<>]/g, '_')}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Download Failed',
        message: err instanceof Error ? err.message : 'Unable to download recording.',
        type: 'error',
        isRead: false,
      });
    }
  };

  const activeEmbed = useMemo(() => toYouTubeEmbedUrl(activeSession?.streamUrl || activeSession?.meetingUrl || null), [activeSession?.id]);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Events</h1>
            <p className="mt-2 text-gray-600">Livestream sessions for PSITS activities.</p>
          </div>
          {canManage && (
            <Button variant="primary" onClick={openCreate} className="inline-flex items-center gap-2">
              <Plus size={18} />
              Create Live Session
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {sorted.map((e) => (
            <Card key={e.id} className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-slate-50 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getStatusVariant(e.status)}>{e.status}</Badge>
                    {e.eventTitle && <Badge variant="info">{e.eventTitle}</Badge>}
                  </div>
                  <div className="text-xl font-bold text-gray-900">{e.title}</div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <div className="inline-flex items-center gap-1">
                      <Video size={16} />
                      Live Stream
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <Users size={16} />
                      {Number(e.viewersCount || 0)} viewers
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(e)} className="inline-flex items-center gap-2">
                      <Pencil size={16} />
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setConfirmDelete(e)} className="inline-flex items-center gap-2">
                      <Trash2 size={16} />
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-5 px-6 py-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {e.startAt && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <Calendar size={14} />
                        Schedule
                      </div>
                      <div className="mt-2 text-sm font-medium text-gray-900">{new Date(e.startAt).toLocaleString()}</div>
                    </div>
                  )}

                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <Clock size={14} />
                      Session ID
                    </div>
                    <div className="mt-2 text-sm font-medium text-gray-900">{e.sessionId || e.id}</div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <Users size={14} />
                      Room Code
                    </div>
                    <div className="mt-2 text-sm font-medium text-gray-900">{e.roomCode || 'Pending'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (e.streamSource === 'built_in') {
                        navigate(`/live-events/studio/${e.id}`);
                      } else {
                        setActiveSession(e);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
                  >
                    <MonitorPlay size={18} />
                    Watch
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyInvite(e)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Copy size={18} />
                    Copy Invite
                  </button>

                  {e.streamSource === 'built_in' ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/live-events/studio/${e.id}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Video size={18} />
                      Enter Studio
                    </button>
                  ) : (
                    <a
                      href={e.streamUrl || e.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink size={18} />
                      Open Link
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {!isLoading && sorted.length === 0 && (
            <Card className="p-10 text-center text-gray-600">
              No live sessions yet.
              {canManage ? ' Create one to get started.' : ' Please check back later.'}
            </Card>
          )}
        </div>

        {activeSession && (
          <Modal
            title={activeSession.title}
            isOpen={Boolean(activeSession)}
            onClose={() => setActiveSession(null)}
            size="lg"
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getStatusVariant(activeSession.status)}>{activeSession.status}</Badge>
                  {activeSession.eventTitle && <Badge variant="info">{activeSession.eventTitle}</Badge>}
                </div>

                {activeEmbed ? (
                  <div className="aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-black">
                    <iframe
                      title="Live Stream"
                      className="h-full w-full"
                      src={activeEmbed}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <Card className="p-6 text-sm text-gray-700">
                    This stream link cannot be embedded. Open it in a new tab:
                    <div className="mt-3">
                      <a className="text-primary hover:underline" href={activeSession.streamUrl || activeSession.meetingUrl} target="_blank" rel="noreferrer">
                        {activeSession.streamUrl || activeSession.meetingUrl}
                      </a>
                    </div>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Recording (15 days)</div>
                  <div className="space-y-3 px-4 py-4 text-sm text-gray-700">
                    {activeSession.recordingUrl ? (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">Available</div>
                          <div className="text-xs text-gray-500">
                            Expires: {activeSession.recordingExpiresAt ? new Date(activeSession.recordingExpiresAt).toLocaleString() : '15 days after upload'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void downloadRecording(activeSession)}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
                        >
                          Download
                        </button>
                      </div>
                    ) : (
                      <div className="text-gray-500">No recording uploaded yet.</div>
                    )}

                    {canManage && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Upload Recording</label>
                        <div className="mt-2">
                          <input
                            type="file"
                            accept="video/*"
                            disabled={isUploadingRecording}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.currentTarget.value = '';
                              if (!file) return;
                              void (async () => {
                                setIsUploadingRecording(true);
                                setRecordingUploadPct(0);
                                try {
                                  await api.uploadLiveEventRecording(activeSession.id, file, setRecordingUploadPct);
                                  addNotification({ userId: 'current', title: 'Uploaded', message: 'Recording uploaded. It will be kept for 15 days.', type: 'success', isRead: false });
                                  await refreshActiveSession(activeSession.id);
                                } catch (err) {
                                  addNotification({
                                    userId: 'current',
                                    title: 'Upload Failed',
                                    message: err instanceof Error ? err.message : 'Unable to upload recording.',
                                    type: 'error',
                                    isRead: false,
                                  });
                                } finally {
                                  setIsUploadingRecording(false);
                                }
                              })();
                            }}
                            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-60"
                          />
                        </div>
                        {isUploadingRecording && (
                          <div className="mt-2 text-xs text-gray-500">Uploading… {recordingUploadPct}%</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Chat</div>
                  <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4 text-sm">
                    {isLoadingChat ? (
                      <div className="text-gray-500">Loading chat…</div>
                    ) : chatMessages.length === 0 ? (
                      <div className="text-gray-500">No messages yet.</div>
                    ) : (
                      chatMessages.map((m: any) => (
                        <div key={m.id} className="rounded-lg bg-gray-50 px-3 py-2">
                          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">{m.user?.name || 'User'}</span>
                            <span>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
                          </div>
                          <div className="mt-1 text-gray-800">{m.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-gray-100 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type a message…"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void sendChatMessage();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void sendChatMessage()}
                        disabled={isSendingChat || !chatInput.trim()}
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-60"
                        aria-label="Send message"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {activeSession.streamSource === 'built_in' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSession(null);
                      navigate(`/live-events/studio/${activeSession.id}`);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Video size={18} />
                    Enter Studio
                  </button>
                ) : (
                  <a
                    href={activeSession.streamUrl || activeSession.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <ExternalLink size={18} />
                    Open Stream
                  </a>
                )}
              </div>
            </div>
          </Modal>
        )}

        {showModal && (
          <LiveSessionModal
            isOpen={showModal}
            editing={editing}
            formData={formData}
            formErrors={formErrors}
            eventOptions={eventOptions}
            onClose={() => setShowModal(false)}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
            onSaveDraft={() => {
              setFormData((prev) => ({ ...prev, saveMode: 'draft' }));
              void submit().catch((err) => {
                addNotification({ userId: 'current', title: 'Save Failed', message: err instanceof Error ? err.message : 'Unable to save draft.', type: 'error', isRead: false });
              });
            }}
            onCreate={() => {
              setFormData((prev) => ({ ...prev, saveMode: 'create' }));
              void submit().catch((err) => {
                addNotification({ userId: 'current', title: 'Create Failed', message: err instanceof Error ? err.message : 'Unable to create session.', type: 'error', isRead: false });
              });
            }}
          />
        )}

        {confirmDelete && (
          <VerifyActionModal
            isOpen={Boolean(confirmDelete)}
            title="Delete Live Session"
            message={`Are you sure you want to delete "${confirmDelete.title}"? This cannot be undone.`}
            confirmLabel="Delete"
            confirmVariant="danger"
            onCancel={() => setConfirmDelete(null)}
            onVerified={async () => {
              await api.deleteLiveSession(confirmDelete.id);
              addNotification({ userId: 'current', title: 'Deleted', message: 'Live session deleted.', type: 'success', isRead: false });
              if (activeSession?.id === confirmDelete.id) setActiveSession(null);
              setConfirmDelete(null);
              await refresh();
            }}
          />
        )}
      </div>
    </MainLayout>
  );
};
