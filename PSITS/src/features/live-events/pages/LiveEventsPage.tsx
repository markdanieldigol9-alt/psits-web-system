import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from '@/shared/layouts';
import { Card, Button } from '@/shared/components/Form';
import { Badge, Modal } from '@/shared/components/Common';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { LiveSessionModal } from '@/features/live-events/components/LiveSessionModal';
import type { LiveSession, LiveSessionFormState } from '@/features/live-events/types/liveSessions';
import { Download, Film, MonitorPlay, Pencil, Plus, Send, Trash2, Video } from 'lucide-react';

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
    status: 'ended',
    privacy: 'public',
    allowChat: true,
    streamSource: 'built_in',
    streamUrl: '',
    roomCode: '',
    sessionId: '',
    joinLink: '',
    sessionToken: '',
    recordingEnabled: true,
    recordingVisibility: 'public_replay',
    saveMode: 'create',
  };
}

export const LiveEventsPage = () => {
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
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof LiveSessionFormState | 'videoFile', string>>>({});

  const [confirmDelete, setConfirmDelete] = useState<LiveSession | null>(null);
  const [confirmDeleteRecording, setConfirmDeleteRecording] = useState<LiveSession | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [recordingUploadPct, setRecordingUploadPct] = useState(0);

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
      const at = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : a.startAt ? new Date(a.startAt).getTime() : 0;
      const bt = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : b.startAt ? new Date(b.startAt).getTime() : 0;
      return bt - at;
    });
    return copy;
  }, [liveEvents]);

  const openCreate = () => {
    setEditing(null);
    setFormErrors({});
    setVideoFile(null);
    setFormData(createEmptySessionFormState(user?.fullName || ''));
    setShowModal(true);
  };

  const openEdit = (e: LiveSession) => {
    setEditing(e);
    setFormErrors({});
    setVideoFile(null);
    setFormData({
      ...createEmptySessionFormState(e.hostLabel || user?.fullName || ''),
      title: e.title || '',
      description: e.description || '',
      eventId: String(e.eventId || ''),
      hostLabel: e.hostLabel || '',
      privacy: e.privacy || 'public',
      allowChat: Boolean(e.chatEnabled),
      recordingEnabled: true,
      saveMode: 'create',
    });
    setShowModal(true);
  };

  const submit = async () => {
    const nextErrors: Partial<Record<keyof LiveSessionFormState | 'videoFile', string>> = {};
    if (!formData.title.trim()) nextErrors.title = 'Video title is required.';
    if (!editing && !videoFile) {
      nextErrors.videoFile = 'Please select a video clip to upload.';
    }

    setFormErrors(nextErrors as any);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      eventId: formData.eventId || null,
      hostLabel: formData.hostLabel.trim() || user?.fullName || 'PSITS Officer',
      privacy: formData.privacy || 'public',
      chatEnabled: formData.allowChat,
      recordingEnabled: true,
      status: 'ended',
      sessionType: 'livestream',
    };

    setIsUploadingRecording(true);
    setRecordingUploadPct(0);
    try {
      if (editing) {
        await api.updateLiveSession(editing.id, payload);
        if (videoFile) {
          await api.uploadLiveEventRecording(editing.id, videoFile, setRecordingUploadPct);
        }
        addNotification({
          userId: 'current',
          title: 'Video Event Updated',
          message: 'Video event details updated successfully.',
          type: 'success',
          isRead: false,
        });
      } else {
        const res = await api.createLiveSession(payload);
        const newId = res.data?.liveEvent?.id;
        if (newId && videoFile) {
          await api.uploadLiveEventRecording(newId, videoFile, setRecordingUploadPct);
        }
        addNotification({
          userId: 'current',
          title: 'Video Event Uploaded',
          message: 'Video clip uploaded. It will be stored for 1 month, then deleted permanently.',
          type: 'success',
          isRead: false,
        });
      }

      setShowModal(false);
      setEditing(null);
      setVideoFile(null);
      await refresh();
    } catch (err) {
      addNotification({
        userId: 'current',
        title: editing ? 'Update Failed' : 'Upload Failed',
        message: err instanceof Error ? err.message : 'Unable to save video event.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsUploadingRecording(false);
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
      a.download = `${String(session.title || 'video-event').replace(/[/\\?%*:|"<>]/g, '_')}.mp4`;
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

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recorded Video Events</h1>
            <p className="mt-2 text-gray-600">
              Upload and watch recorded activity clips and event videos. All uploaded videos are retained for 1 month and then permanently deleted.
            </p>
          </div>
          {canManage && (
            <Button variant="primary" onClick={openCreate} className="inline-flex items-center gap-2">
              <Plus size={18} />
              Upload Video Event
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {sorted.map((e) => (
            <Card key={e.id} className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-slate-50 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {e.eventTitle && <Badge variant="info">{e.eventTitle}</Badge>}
                    {e.recordingUrl ? (
                      <Badge variant="success" className="inline-flex items-center gap-1">
                        <Film size={12} />
                        Video Clip Ready
                      </Badge>
                    ) : (
                      <Badge variant="warning">No Video File</Badge>
                    )}
                  </div>
                  <div className="text-xl font-bold text-gray-900">{e.title}</div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <div className="inline-flex items-center gap-1 font-medium text-gray-700">
                      <Video size={16} className="text-primary" />
                      Uploaded by {e.hostLabel || 'PSITS'}
                    </div>
                    {((e as any).createdAt || e.startAt) && (
                      <span className="text-xs text-gray-500">
                        Date: {new Date(((e as any).createdAt || e.startAt)!).toLocaleDateString()}
                      </span>
                    )}
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

              <div className="space-y-4 px-6 py-5">
                {e.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{e.description}</p>
                )}

                {e.recordingUrl && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-medium text-amber-900">
                      <Film size={14} className="text-amber-700" />
                      <span>Video clip stored for 1 month</span>
                    </div>
                    {e.recordingExpiresAt && (
                      <span className="text-amber-800 font-medium">
                        Expires: {new Date(e.recordingExpiresAt).toLocaleDateString()} ({Math.max(0, Math.ceil((new Date(e.recordingExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining before permanent deletion)
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveSession(e)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
                  >
                    <MonitorPlay size={18} />
                    Watch Video
                  </button>

                  {e.recordingUrl && (
                    <button
                      type="button"
                      onClick={() => void downloadRecording(e)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Download size={18} />
                      Download
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {!isLoading && sorted.length === 0 && (
            <Card className="p-10 text-center text-gray-600">
              No recorded video events yet.
              {canManage ? ' Click "Upload Video Event" to get started.' : ' Please check back later.'}
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
                  {activeSession.eventTitle && <Badge variant="info">{activeSession.eventTitle}</Badge>}
                  {activeSession.recordingUrl ? (
                    <Badge variant="success" className="inline-flex items-center gap-1">
                      <Film size={12} />
                      Video Clip
                    </Badge>
                  ) : (
                    <Badge variant="warning">No Video File</Badge>
                  )}
                </div>

                {activeSession.recordingUrl ? (
                  <div className="aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-black">
                    <video
                      key={activeSession.recordingUrl}
                      controls
                      autoPlay
                      playsInline
                      className="h-full w-full object-contain"
                      src={api.getLiveEventRecordingStreamUrl(activeSession.id)}
                    >
                      Your browser does not support HTML5 video streaming.
                    </video>
                  </div>
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-500">
                    <Film size={40} className="text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">No video clip uploaded yet</p>
                    {canManage && (
                      <p className="text-xs text-gray-500 mt-1">Upload a video clip using the panel on the right.</p>
                    )}
                  </div>
                )}

                {activeSession.description && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Description</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{activeSession.description}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Film size={16} className="text-primary" />
                      Video Clip Info
                    </span>
                    <span className="text-xs font-normal text-gray-500">1-month retention</span>
                  </div>
                  <div className="space-y-3 px-4 py-4 text-sm text-gray-700">
                    {activeSession.recordingUrl ? (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-green-900 text-xs uppercase tracking-wide">Video Available</span>
                            {activeSession.recordingExpiresAt && (
                              <span className="text-xs text-amber-700 font-medium">
                                {Math.max(0, Math.ceil((new Date(activeSession.recordingExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d left
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            Expires: {activeSession.recordingExpiresAt ? new Date(activeSession.recordingExpiresAt).toLocaleDateString() : '1 month after upload'}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Permanently deleted once the 1-month period ends.
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void downloadRecording(activeSession)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
                          >
                            <Download size={15} />
                            Download
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRecording(activeSession)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500 text-xs">No video clip uploaded yet.</div>
                    )}

                    {canManage && (
                      <div className="border-t border-gray-100 pt-3">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700">
                          {activeSession.recordingUrl ? 'Replace Video Clip' : 'Upload Video Clip'}
                        </label>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Only video clips (.mp4, .webm, .mov) are allowed. Stored for 1 month then permanently deleted.
                        </p>
                        <div className="mt-2">
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/*"
                            disabled={isUploadingRecording}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.currentTarget.value = '';
                              if (!file) return;

                              const validExts = ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi'];
                              const fileExt = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                              const isVideo = file.type.startsWith('video/') || validExts.includes(fileExt);
                              if (!isVideo) {
                                addNotification({
                                  userId: 'current',
                                  title: 'Invalid File',
                                  message: 'Only video clips (.mp4, .webm, .mov, etc.) are allowed.',
                                  type: 'error',
                                  isRead: false,
                                });
                                return;
                              }

                              void (async () => {
                                setIsUploadingRecording(true);
                                setRecordingUploadPct(0);
                                try {
                                  await api.uploadLiveEventRecording(activeSession.id, file, setRecordingUploadPct);
                                  addNotification({
                                    userId: 'current',
                                    title: 'Video Clip Uploaded',
                                    message: 'Video clip uploaded. It will be stored for 1 month, then deleted permanently.',
                                    type: 'success',
                                    isRead: false,
                                  });
                                  await refreshActiveSession(activeSession.id);
                                  await refresh();
                                } catch (err) {
                                  addNotification({
                                    userId: 'current',
                                    title: 'Upload Failed',
                                    message: err instanceof Error ? err.message : 'Unable to upload video clip.',
                                    type: 'error',
                                    isRead: false,
                                  });
                                } finally {
                                  setIsUploadingRecording(false);
                                }
                              })();
                            }}
                            className="block w-full text-xs text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-60"
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
                  <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Comments & Chat</div>
                  <div className="max-h-[380px] space-y-3 overflow-y-auto px-4 py-4 text-sm">
                    {isLoadingChat ? (
                      <div className="text-gray-500">Loading chat…</div>
                    ) : chatMessages.length === 0 ? (
                      <div className="text-gray-500">No comments yet.</div>
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
                        placeholder="Type a comment…"
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
            videoFile={videoFile}
            onVideoFileChange={setVideoFile}
            isUploading={isUploadingRecording}
            uploadProgress={recordingUploadPct}
            onClose={() => setShowModal(false)}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
            onSubmit={() => void submit()}
          />
        )}

        {confirmDelete && (
          <VerifyActionModal
            isOpen={Boolean(confirmDelete)}
            title="Delete Stream Session"
            message={`Are you sure you want to delete "${confirmDelete.title}"? This cannot be undone.`}
            confirmLabel="Delete"
            confirmVariant="danger"
            onCancel={() => setConfirmDelete(null)}
            onVerified={async () => {
              await api.deleteLiveSession(confirmDelete.id);
              addNotification({ userId: 'current', title: 'Deleted', message: 'Stream session deleted.', type: 'success', isRead: false });
              if (activeSession?.id === confirmDelete.id) setActiveSession(null);
              setConfirmDelete(null);
              await refresh();
            }}
          />
        )}

        {confirmDeleteRecording && (
          <VerifyActionModal
            isOpen={Boolean(confirmDeleteRecording)}
            title="Delete Video Clip"
            message={`Are you sure you want to permanently delete the video clip for "${confirmDeleteRecording.title}"? The file will be removed from storage immediately and cannot be recovered.`}
            confirmLabel="Delete Permanently"
            confirmVariant="danger"
            onCancel={() => setConfirmDeleteRecording(null)}
            onVerified={async () => {
              try {
                await api.deleteLiveEventRecording(confirmDeleteRecording.id);
                addNotification({
                  userId: 'current',
                  title: 'Deleted',
                  message: 'Video clip was permanently deleted.',
                  type: 'success',
                  isRead: false,
                });
                await refreshActiveSession(confirmDeleteRecording.id);
                await refresh();
              } catch (err) {
                addNotification({
                  userId: 'current',
                  title: 'Delete Failed',
                  message: err instanceof Error ? err.message : 'Unable to delete video clip.',
                  type: 'error',
                  isRead: false,
                });
              } finally {
                setConfirmDeleteRecording(null);
              }
            }}
          />
        )}
      </div>
    </MainLayout>
  );
};
