import { useEffect, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, TextArea, Select } from '@/shared/components/Form';
import { Badge, Modal } from '@/shared/components/Common';
import { useAuth } from '@/shared/context/AuthContext';
import { Plus, Edit2, Trash2, Eye, Heart, Send, MessageCircle, ImagePlus, X } from 'lucide-react';
import api from '@/shared/services/api';
import { useNotification } from '@/shared/context/NotificationContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';

const mockAnnouncements: any[] = [];
const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

export const AnnouncementsPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [announcements, setAnnouncements] = useState<any[]>(mockAnnouncements);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInteractionLoading, setIsInteractionLoading] = useState(false);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [likes, setLikes] = useState<{ count: number; likedByMe: boolean }>({ count: 0, likedByMe: false });
  const [commentText, setCommentText] = useState('');
  const [verifyAction, setVerifyAction] = useState<'create' | 'update' | 'delete' | null>(null);
  const [pendingPayload, setPendingPayload] = useState<any | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [createImagePreview, setCreateImagePreview] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    audience: 'all',
    status: 'published' as 'published' | 'draft',
    imageUrl: '',
  });
  const [editFormData, setEditFormData] = useState({
    title: '',
    content: '',
    audience: 'all',
    status: 'published' as 'published' | 'draft',
    imageUrl: '',
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.getAnnouncements();
        if (!cancelled && data?.success) {
          setAnnouncements(data.announcements || []);
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

  useEffect(() => () => {
    if (createImagePreview) URL.revokeObjectURL(createImagePreview);
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
  }, [createImagePreview, editImagePreview]);

  const filteredAnnouncements = announcements.filter(
    (ann) => selectedStatus === 'all' || ann.status === selectedStatus
  );

  const canCreateAnnouncements = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';
  const isMember = user?.role === 'member';
  const canModerateComments = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  useEffect(() => {
    if (!showViewModal || !selectedAnnouncement?.id) return;

    let cancelled = false;
    const load = async () => {
      setIsInteractionLoading(true);
      try {
        const [commentsRes, likesRes] = await Promise.all([
          api.getAnnouncementComments(String(selectedAnnouncement.id)),
          api.getAnnouncementLikes(String(selectedAnnouncement.id)),
        ]);

        if (cancelled) return;
        if (commentsRes?.data?.success) setComments(commentsRes.data.comments || []);
        if (likesRes?.data?.success) setLikes(likesRes.data.likes || { count: 0, likedByMe: false });
      } catch {
        if (!cancelled) {
          setComments([]);
          setLikes({ count: 0, likedByMe: false });
        }
      } finally {
        if (!cancelled) setIsInteractionLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [showViewModal, selectedAnnouncement?.id]);

  const formatTimestamp = (value: any) => {
    if (!value) return '';
    const raw = String(value);
    // MySQL often returns "YYYY-MM-DDTHH:mm:ss.sssZ" or "YYYY-MM-DD HH:mm:ss"
    return raw.replace('T', ' ').slice(0, 19);
  };

  const getInitials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'PS';

  const resetCreateAnnouncementForm = () => {
    if (createImagePreview) URL.revokeObjectURL(createImagePreview);
    setCreateImagePreview('');
    setCreateImageFile(null);
    setFormData({ title: '', content: '', audience: 'all', status: 'published', imageUrl: '' });
  };

  const resetEditAnnouncementForm = () => {
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImagePreview('');
    setEditImageFile(null);
    setEditFormData({ title: '', content: '', audience: 'all', status: 'published', imageUrl: '' });
  };

  const handleImageSelection = (
    file: File | null,
    currentPreview: string,
    setFile: (file: File | null) => void,
    setPreview: (preview: string) => void
  ) => {
    if (currentPreview) URL.revokeObjectURL(currentPreview);
    if (!file) {
      setFile(null);
      setPreview('');
      return;
    }

    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      addNotification({
        userId: 'current',
        title: 'Invalid Image',
        message: 'Please select a PNG, JPG, or WebP image.',
        type: 'error',
        isRead: false,
      });
      setFile(null);
      setPreview('');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      addNotification({
        userId: 'current',
        title: 'Image Too Large',
        message: 'Announcement images must be 8MB or below.',
        type: 'error',
        isRead: false,
      });
      setFile(null);
      setPreview('');
      return;
    }

    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const onToggleLike = async (announcementId: string) => {
    const target = announcements.find((item) => String(item.id) === String(announcementId));
    const next = !target?.likedByMe;

    setAnnouncements((prev) =>
      prev.map((item) =>
        String(item.id) === String(announcementId)
          ? {
              ...item,
              likedByMe: next,
              likeCount: Math.max(0, Number(item.likeCount || 0) + (next ? 1 : -1)),
            }
          : item
      )
    );

    if (selectedAnnouncement && String(selectedAnnouncement.id) === String(announcementId)) {
      setSelectedAnnouncement((prev: any) =>
        prev
          ? {
              ...prev,
              likedByMe: next,
              likeCount: Math.max(0, Number(prev.likeCount || 0) + (next ? 1 : -1)),
            }
          : prev
      );
      setLikes((prev) => ({
        likedByMe: next,
        count: Math.max(0, Number(prev.count || 0) + (next ? 1 : -1)),
      }));
    }

    try {
      const { data } = await api.setAnnouncementLike(announcementId, next);
      if (data?.success && data?.likes) {
        setAnnouncements((prev) =>
          prev.map((item) =>
            String(item.id) === String(announcementId)
              ? { ...item, likedByMe: Boolean(data.likes.likedByMe), likeCount: Number(data.likes.count || 0) }
              : item
          )
        );
        if (selectedAnnouncement && String(selectedAnnouncement.id) === String(announcementId)) {
          setSelectedAnnouncement((prev: any) =>
            prev ? { ...prev, likedByMe: Boolean(data.likes.likedByMe), likeCount: Number(data.likes.count || 0) } : prev
          );
          setLikes(data.likes);
        }
      }
    } catch {
      setAnnouncements((prev) => prev.map((item) => (String(item.id) === String(target?.id) ? target : item)));
      try {
        const { data } = await api.getAnnouncementLikes(announcementId);
        if (data?.success && data?.likes) {
          setAnnouncements((prev) =>
            prev.map((item) =>
              String(item.id) === String(announcementId)
                ? { ...item, likedByMe: Boolean(data.likes.likedByMe), likeCount: Number(data.likes.count || 0) }
                : item
            )
          );
          if (selectedAnnouncement && String(selectedAnnouncement.id) === String(announcementId)) {
            setSelectedAnnouncement((prev: any) =>
              prev ? { ...prev, likedByMe: Boolean(data.likes.likedByMe), likeCount: Number(data.likes.count || 0) } : prev
            );
            setLikes(data.likes);
          }
        }
      } catch {
        // ignore
      }
    }
  };

  const onSubmitComment = async () => {
    if (!selectedAnnouncement?.id) return;
    const id = String(selectedAnnouncement.id);
    const content = commentText.trim();
    if (!content) return;

    setIsCommentSubmitting(true);
    try {
      const { data } = await api.createAnnouncementComment(id, content);
      const created = data?.comment;
      if (created) {
        setComments((prev) => [...prev, created]);
        setAnnouncements((prev) =>
          prev.map((item) =>
            String(item.id) === id ? { ...item, commentCount: Number(item.commentCount || 0) + 1 } : item
          )
        );
        setSelectedAnnouncement((prev: any) =>
          prev ? { ...prev, commentCount: Number(prev.commentCount || 0) + 1 } : prev
        );
      }
      setCommentText('');
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Comment Failed',
        message: err instanceof Error ? err.message : 'Failed to post comment.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const onDeleteComment = async (commentId: string) => {
    if (!selectedAnnouncement?.id) return;
    const id = String(selectedAnnouncement.id);
    try {
      await api.deleteAnnouncementComment(id, String(commentId));
      setComments((prev) => prev.filter((c) => String(c.id) !== String(commentId)));
      setAnnouncements((prev) =>
        prev.map((item) =>
          String(item.id) === id ? { ...item, commentCount: Math.max(0, Number(item.commentCount || 0) - 1) } : item
        )
      );
      setSelectedAnnouncement((prev: any) =>
        prev ? { ...prev, commentCount: Math.max(0, Number(prev.commentCount || 0) - 1) } : prev
      );
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Failed to delete comment.',
        type: 'error',
        isRead: false,
      });
    }
  };

  const audienceToArray = (value: string) => {
    if (value === 'all') return ['all'];
    if (value === 'members') return ['member'];
    if (value === 'admin') return ['super_admin', 'admin', 'officer'];
    return ['all'];
  };

  const audienceArrayToValue = (audience: any) => {
    const values = Array.isArray(audience) ? audience : [];
    if (values.includes('all')) return 'all';
    if (values.includes('member') || values.includes('members')) return 'members';
    if (values.includes('super_admin') || values.includes('admin') || values.includes('officer')) return 'admin';
    return 'all';
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        status: formData.status,
        audience: audienceToArray(formData.audience),
        imageUrl: formData.imageUrl || '',
      };
      setPendingPayload(payload);
      setPendingId(null);
      setVerifyAction('create');
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to create announcement.', type: 'error', isRead: false });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnnouncement?.id) return;
    try {
      const payload = {
        title: editFormData.title.trim(),
        content: editFormData.content.trim(),
        status: editFormData.status,
        audience: audienceToArray(editFormData.audience),
        imageUrl: editFormData.imageUrl || '',
      };
      setPendingPayload(payload);
      setPendingId(String(selectedAnnouncement.id));
      setVerifyAction('update');
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to update announcement.', type: 'error', isRead: false });
    }
  };

  const iconButtonClassName =
    'p-2 hover:bg-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
            <p className="text-gray-600 mt-2">
              {isMember ? 'View published system announcements.' : 'Create and manage system announcements'}
            </p>
          </div>
          {canCreateAnnouncements && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                resetCreateAnnouncementForm();
                setShowModal(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus size={20} />
              New Announcement
            </Button>
          )}
        </div>

        {/* Filter */}
        {isMember ? (
          <div className="inline-flex rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            Showing: Published announcements for members
          </div>
        ) : (
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Announcements</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        )}

        {/* Announcements List */}
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => (
            <Card key={announcement.id} className="p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {getInitials(announcement.postedBy?.name || 'PSITS Hub')}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-900">{announcement.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {announcement.postedBy?.name || 'PSITS Hub'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Posted on {announcement.date}
                    </p>
                  </div>
                </div>
                <Badge variant={announcement.status === 'published' ? 'success' : 'warning'}>
                  {announcement.status.charAt(0).toUpperCase() + announcement.status.slice(1)}
                </Badge>
              </div>

              <p className="mb-4 whitespace-pre-wrap text-gray-700">{announcement.content}</p>

              {announcement.imageUrl && (
                <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img
                    src={announcement.imageUrl}
                    alt={announcement.title}
                    className="max-h-[420px] w-full object-cover"
                  />
                </div>
              )}

              <div className="mb-3 flex items-center justify-between border-y border-gray-100 py-3 text-sm text-gray-500">
                <span>{Number(announcement.likeCount || 0)} like(s)</span>
                <span>{Number(announcement.commentCount || 0)} comment(s)</span>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void onToggleLike(String(announcement.id))}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                    announcement.likedByMe
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Heart size={16} className={announcement.likedByMe ? 'fill-red-600 text-red-600' : 'text-gray-600'} />
                  Like
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnnouncement(announcement);
                    setComments([]);
                    setLikes({ count: Number(announcement.likeCount || 0), likedByMe: Boolean(announcement.likedByMe) });
                    setCommentText('');
                    setShowViewModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <MessageCircle size={16} className="text-gray-600" />
                  Comment
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-gray-500">
                  {isMember ? `System announcement` : `Audience: ${announcement.audience.join(', ')}`}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={iconButtonClassName}
                    onClick={() => {
                      setSelectedAnnouncement(announcement);
                      setComments([]);
                      setLikes({ count: Number(announcement.likeCount || 0), likedByMe: Boolean(announcement.likedByMe) });
                      setCommentText('');
                      setShowViewModal(true);
                    }}
                    aria-label="View announcement"
                    title="View / Comments"
                  >
                    <Eye size={16} className="text-gray-600" />
                  </button>

                  {canCreateAnnouncements && (
                    <>
                      <button
                        type="button"
                        className={iconButtonClassName}
                        onClick={() => {
                          setSelectedAnnouncement(announcement);
                          resetEditAnnouncementForm();
                          setEditFormData({
                            title: announcement.title || '',
                            content: announcement.content || '',
                            audience: audienceArrayToValue(announcement.audience),
                            status: announcement.status === 'draft' ? 'draft' : 'published',
                            imageUrl: announcement.imageUrl || '',
                          });
                          setShowEditModal(true);
                        }}
                        aria-label="Edit announcement"
                        title="Edit"
                      >
                        <Edit2 size={16} className="text-blue-600" />
                      </button>
                      <button
                        type="button"
                        className={iconButtonClassName}
                        onClick={() => {
                          setPendingId(String(announcement.id));
                          setPendingPayload(null);
                          setVerifyAction('delete');
                        }}
                        aria-label="Delete announcement"
                        title="Delete"
                      >
                        <Trash2 size={16} className="text-red-600" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredAnnouncements.length === 0 && (
          <Card className="p-8 text-center text-gray-500">
            {isLoading ? 'Loading...' : 'No announcements found.'}
          </Card>
        )}

        {/* View Modal */}
        <Modal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedAnnouncement(null);
            setComments([]);
            setLikes({ count: 0, likedByMe: false });
            setCommentText('');
          }}
          title="Announcement"
          size="lg"
        >
          {selectedAnnouncement ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedAnnouncement.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Posted on {selectedAnnouncement.date}
                    {selectedAnnouncement.postedBy?.name ? ` - by ${selectedAnnouncement.postedBy.name}` : ''}
                  </p>
                </div>
                <Badge variant={selectedAnnouncement.status === 'published' ? 'success' : 'warning'}>
                  {String(selectedAnnouncement.status || '').charAt(0).toUpperCase() +
                    String(selectedAnnouncement.status || '').slice(1)}
                </Badge>
              </div>

              <div className="text-sm text-gray-500">
                Audience:{' '}
                {Array.isArray(selectedAnnouncement.audience) ? selectedAnnouncement.audience.join(', ') : ''}
              </div>

              <div className="whitespace-pre-wrap text-gray-800">{selectedAnnouncement.content}</div>

              {selectedAnnouncement.imageUrl && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img
                    src={selectedAnnouncement.imageUrl}
                    alt={selectedAnnouncement.title}
                    className="max-h-[480px] w-full object-cover"
                  />
                </div>
              )}

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void onToggleLike(String(selectedAnnouncement.id))}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      likes.likedByMe ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                    disabled={isInteractionLoading}
                    aria-label="Like announcement"
                  >
                    <Heart size={16} className={likes.likedByMe ? 'fill-red-600 text-red-600' : 'text-gray-600'} />
                    Like ({Number(likes.count || 0)})
                  </button>

                  <div className="text-xs text-gray-500">
                    {isInteractionLoading ? 'Loading interactions...' : `${comments.length} comment(s)`}
                  </div>
                </div>

                <div className="max-h-64 overflow-auto space-y-3">
                  {comments.length === 0 && !isInteractionLoading && (
                    <div className="text-sm text-gray-500">No comments yet. Be the first to comment.</div>
                  )}
                  {comments.map((c) => {
                    const canDelete = canModerateComments || String(c?.user?.id || '') === String(user?.id || '');
                    return (
                      <div key={String(c.id)} className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{c?.user?.name || 'User'}</div>
                            <div className="text-xs text-gray-500">{formatTimestamp(c?.createdAt)}</div>
                          </div>
                          {canDelete && (
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-700 hover:underline"
                              onClick={() => void onDeleteComment(String(c.id))}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{String(c.content || '')}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <TextArea
                    label="Add a comment"
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText((e.target as HTMLTextAreaElement).value)}
                    placeholder="Write a comment..."
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      isLoading={isCommentSubmitting}
                      disabled={!commentText.trim() || isCommentSubmitting}
                      onClick={() => void onSubmitComment()}
                    >
                      <Send size={16} />
                      Post
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
              </div>
            </div>
          ) : (
            <div className="text-gray-600">No announcement selected.</div>
          )}
        </Modal>

        {/* Create Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Create Announcement"
          size="lg"
        >
          <form className="space-y-4" onSubmit={handleCreate}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                placeholder="Announcement title"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <TextArea
              label="Content"
              placeholder="Write your announcement here..."
              rows={5}
              value={formData.content}
              onChange={(e) => setFormData((p) => ({ ...p, content: (e.target as HTMLTextAreaElement).value }))}
            />

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Announcement Image</p>
                  <p className="text-xs text-gray-500">Optional. PNG, JPG, or WebP up to 8MB.</p>
                </div>
                {(createImagePreview || formData.imageUrl) && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm font-medium text-red-600"
                    onClick={() => {
                      handleImageSelection(null, createImagePreview, setCreateImageFile, setCreateImagePreview);
                      setFormData((p) => ({ ...p, imageUrl: '' }));
                    }}
                  >
                    <X size={14} />
                    Remove
                  </button>
                )}
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-blue-50">
                <ImagePlus size={16} />
                Upload Image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handleImageSelection(file, createImagePreview, setCreateImageFile, setCreateImagePreview);
                  }}
                />
              </label>

              {(createImagePreview || formData.imageUrl) && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img
                    src={createImagePreview || formData.imageUrl}
                    alt="Announcement preview"
                    className="max-h-72 w-full object-cover"
                  />
                </div>
              )}
            </div>

            <Select
              label="Target Audience"
              options={[
                { value: 'all', label: 'All Users' },
                { value: 'members', label: 'Members Only' },
                { value: 'admin', label: 'Admin & Officers' },
              ]}
              value={formData.audience}
              onChange={(e) => setFormData((p) => ({ ...p, audience: (e.target as HTMLSelectElement).value }))}
            />

            <div className="flex gap-3">
              <Button type="submit" variant="primary" isLoading={isLoading}>
                {formData.status === 'draft' ? 'Save Draft' : 'Publish'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            if (isLoading) return;
            setShowEditModal(false);
          }}
          title="Edit Announcement"
          size="lg"
        >
          <form className="space-y-4" onSubmit={handleEditSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                placeholder="Announcement title"
                value={editFormData.title}
                onChange={(e) => setEditFormData((p) => ({ ...p, title: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <TextArea
              label="Content"
              placeholder="Write your announcement here..."
              rows={5}
              value={editFormData.content}
              onChange={(e) => setEditFormData((p) => ({ ...p, content: (e.target as HTMLTextAreaElement).value }))}
            />

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Announcement Image</p>
                  <p className="text-xs text-gray-500">Optional. Upload a new image or keep the current one.</p>
                </div>
                {(editImagePreview || editFormData.imageUrl) && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm font-medium text-red-600"
                    onClick={() => {
                      handleImageSelection(null, editImagePreview, setEditImageFile, setEditImagePreview);
                      setEditFormData((p) => ({ ...p, imageUrl: '' }));
                    }}
                  >
                    <X size={14} />
                    Remove
                  </button>
                )}
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-blue-50">
                <ImagePlus size={16} />
                Upload Image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handleImageSelection(file, editImagePreview, setEditImageFile, setEditImagePreview);
                  }}
                />
              </label>

              {(editImagePreview || editFormData.imageUrl) && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img
                    src={editImagePreview || editFormData.imageUrl}
                    alt="Announcement preview"
                    className="max-h-72 w-full object-cover"
                  />
                </div>
              )}
            </div>

            <Select
              label="Target Audience"
              options={[
                { value: 'all', label: 'All Users' },
                { value: 'members', label: 'Members Only' },
                { value: 'admin', label: 'Admin & Officers' },
              ]}
              value={editFormData.audience}
              onChange={(e) => setEditFormData((p) => ({ ...p, audience: (e.target as HTMLSelectElement).value }))}
            />

            <div className="flex gap-3">
              <Button type="submit" variant="primary" isLoading={isLoading}>
                Update
              </Button>
            </div>
          </form>
        </Modal>

        <VerifyActionModal
          isOpen={verifyAction !== null}
          title={
            verifyAction === 'delete'
              ? 'Verify Delete'
              : verifyAction === 'update'
                ? 'Verify Update'
                : 'Verify Announcement'
          }
          message={
            verifyAction === 'delete'
              ? 'Are you sure you want to delete this announcement?'
              : verifyAction === 'update'
                ? 'Are you sure you want to update this announcement?'
                : 'Are you sure you want to publish this announcement?'
          }
          confirmLabel={verifyAction === 'delete' ? 'Delete' : 'Accept'}
          confirmVariant={verifyAction === 'delete' ? 'danger' : 'primary'}
          onCancel={() => {
            if (isLoading) return;
            setVerifyAction(null);
            setPendingPayload(null);
            setPendingId(null);
          }}
          onVerified={async () => {
            if (verifyAction === 'create' && !pendingPayload) return;
            if (verifyAction === 'update' && (!pendingPayload || !pendingId)) return;
            if (verifyAction === 'delete' && !pendingId) return;
            setIsLoading(true);
            try {
              if (verifyAction === 'create') {
                let imageUrl = pendingPayload.imageUrl || '';
                if (createImageFile) {
                  const dataUrl = await readAsDataUrl(createImageFile);
                  const { data: upload } = await api.uploadAnnouncementImage(dataUrl);
                  imageUrl = upload?.url || imageUrl;
                }
                const { data } = await api.createAnnouncement({ ...pendingPayload, imageUrl });
                const created = data?.announcement;
                if (created) setAnnouncements((prev) => [created, ...prev]);
                addNotification({ userId: 'current', title: 'Announcement Created', message: 'Announcement saved successfully.', type: 'success', isRead: false });
                setShowModal(false);
                resetCreateAnnouncementForm();
              } else if (verifyAction === 'update') {
                let imageUrl = pendingPayload.imageUrl || '';
                if (editImageFile) {
                  const dataUrl = await readAsDataUrl(editImageFile);
                  const { data: upload } = await api.uploadAnnouncementImage(dataUrl);
                  imageUrl = upload?.url || imageUrl;
                }
                const { data } = await api.updateAnnouncement(pendingId!, { ...pendingPayload, imageUrl });
                const updated = data?.announcement;
                if (updated) {
                  setAnnouncements((prev) => prev.map((x) => (String(x.id) === String(updated.id) ? updated : x)));
                  setSelectedAnnouncement((prev: any) => (prev && String(prev.id) === String(updated.id) ? updated : prev));
                } else {
                  setAnnouncements((prev) => prev.map((x) => (String(x.id) === String(pendingId) ? { ...x, ...pendingPayload, imageUrl } : x)));
                }
                addNotification({ userId: 'current', title: 'Announcement Updated', message: 'Announcement updated successfully.', type: 'success', isRead: false });
                setShowEditModal(false);
                resetEditAnnouncementForm();
              } else if (verifyAction === 'delete') {
                await api.deleteAnnouncement(pendingId!);
                // Refresh from DB to ensure the record is truly gone (avoids UI-only deletes)
                try {
                  const { data } = await api.getAnnouncements();
                  if (data?.success) setAnnouncements(data.announcements || []);
                  else setAnnouncements((prev) => prev.filter((x) => String(x.id) !== String(pendingId)));
                } catch {
                  setAnnouncements((prev) => prev.filter((x) => String(x.id) !== String(pendingId)));
                }
                addNotification({ userId: 'current', title: 'Announcement Deleted', message: 'Announcement deleted successfully.', type: 'success', isRead: false });
              }
              setVerifyAction(null);
              setPendingPayload(null);
              setPendingId(null);
            } catch (err) {
              addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.', type: 'error', isRead: false });
            } finally {
              setIsLoading(false);
            }
          }}
        />
      </div>
    </MainLayout>
  );
};
