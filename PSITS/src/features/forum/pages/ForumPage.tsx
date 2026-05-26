import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input, TextArea, Select, Badge } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Heart, MessageSquare, Plus, Pin } from 'lucide-react';

type PostType = 'announcement' | 'news' | 'story' | 'blog' | 'discussion' | 'question';

export const ForumPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const canModerate = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | PostType>('all');
  const [posts, setPosts] = useState<any[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [postForm, setPostForm] = useState({ type: 'discussion' as PostType, title: '', content: '', videoUrl: '' });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);

  const [activePost, setActivePost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.getForumPosts({ type: typeFilter });
      if (data?.success) setPosts(data.posts || []);
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to load forum.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const createPost = async () => {
    setIsLoading(true);
    try {
      let finalVideoUrl = postForm.videoUrl;
      if (videoFile) {
        const uploadRes = await api.uploadForumVideo(videoFile);
        if (uploadRes.data?.success) {
          finalVideoUrl = uploadRes.data.url;
        } else {
          throw new Error(uploadRes.data?.message || 'Video upload failed.');
        }
      }
      const { data } = await api.createForumPost({ ...postForm, videoUrl: finalVideoUrl });
      if (data?.success) {
        addNotification({ userId: 'current', title: 'Posted', message: 'Post created successfully.', type: 'success', isRead: false });
        setShowCreate(false);
        setPostForm({ type: 'discussion', title: '', content: '', videoUrl: '' });
        setVideoFile(null);
        await load();
      }
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to create post.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

  const openComments = async (post: any) => {
    setActivePost(post);
    setComments([]);
    setCommentText('');
    setShowComments(true);
    try {
      const { data } = await api.getForumComments(String(post.id));
      if (data?.success) setComments(data.comments || []);
    } catch {
      // ignore
    }
  };

  const addComment = async () => {
    if (!activePost) return;
    const text = commentText.trim();
    if (!text) return;
    setIsLoading(true);
    try {
      const { data } = await api.addForumComment(String(activePost.id), text);
      if (data?.success) {
        const refreshed = await api.getForumComments(String(activePost.id));
        if (refreshed.data?.success) setComments(refreshed.data.comments || []);
        setCommentText('');
      }
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to comment.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => posts, [posts]);

  const badgeVariant = (t: string) => {
    if (t === 'announcement') return 'info';
    if (t === 'news') return 'primary';
    if (t === 'story') return 'info';
    if (t === 'blog') return 'secondary';
    if (t === 'question') return 'warning';
    return 'success';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Community Forum</h1>
            <p className="mt-2 text-gray-600">News, stories, and discussions.</p>
          </div>
          <Button variant="primary" size="lg" onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
            <Plus size={18} /> Create Post
          </Button>
        </div>

        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="rounded-lg border border-gray-300 px-3 py-2">
              <option value="all">All</option>
              <option value="news">News</option>
              <option value="story">Stories</option>
              <option value="blog">Blogs</option>
              <option value="discussion">Discussions</option>
              <option value="question">Questions</option>
            </select>
            <Button variant="outline" onClick={() => void load()} isLoading={isLoading}>Refresh</Button>
          </div>

          <div className="mt-4 space-y-4">
            {filtered.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.isPinned && <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold"><Pin size={14} /> Pinned</span>}
                      <Badge variant={badgeVariant(p.type)}>{String(p.type).toUpperCase()}</Badge>
                    </div>
                    <p className="mt-2 font-semibold text-gray-900">{p.title}</p>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{p.content}</p>
                    {p.videoUrl && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                        {p.videoUrl.includes('youtube.com') || p.videoUrl.includes('youtu.be') ? (
                          <iframe
                            className="w-full aspect-video"
                            src={p.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                            title="YouTube video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video controls className="w-full max-h-[400px] bg-black">
                            <source src={p.videoUrl} />
                            Your browser does not support the video tag.
                          </video>
                        )}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-gray-500">By {p.authorName || 'User'} • {p.createdAt ? String(p.createdAt).slice(0, 19).replace('T', ' ') : ''}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void api.setForumLike(String(p.id), true).then(load).catch(() => null)}>
                    <Heart size={16} /> Like ({p.likesCount || 0})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void openComments(p)}>
                    <MessageSquare size={16} /> Comments ({p.commentsCount || 0})
                  </Button>
                  {canModerate && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void api.updateForumPost(String(p.id), { isPinned: !p.isPinned }).then(load).catch(() => null)}
                    >
                      <Pin size={16} /> {p.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            {!filtered.length && (
              <div className="p-6 text-sm text-gray-500">No posts yet.</div>
            )}
          </div>
        </Card>
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Post" size="lg">
        <div className="space-y-4">
          <Select
            label="Post Type"
            options={[
              { value: 'discussion', label: 'Discussion' },
              { value: 'question', label: 'Question' },
              { value: 'story', label: 'Story' },
              { value: 'blog', label: 'Blog' },
              ...(canModerate ? [
                { value: 'news', label: 'News' },
              ] : []),
            ]}
            value={postForm.type}
            onChange={(e) => setPostForm((p) => ({ ...p, type: (e.target as HTMLSelectElement).value as PostType }))}
          />
          <Input label="Title" value={postForm.title} onChange={(e) => setPostForm((p) => ({ ...p, title: e.target.value }))} />
          <TextArea label="Content" rows={7} value={postForm.content} onChange={(e) => setPostForm((p) => ({ ...p, content: (e.target as HTMLTextAreaElement).value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Video (Optional)</label>
            <input 
              type="file" 
              accept="video/*"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 border border-gray-300 rounded-lg p-2"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            />
            <p className="mt-2 text-xs text-gray-500 text-center">- OR -</p>
            <Input className="mt-2" label="Video URL (e.g. YouTube)" placeholder="Paste a link here instead" value={postForm.videoUrl} onChange={(e) => setPostForm((p) => ({ ...p, videoUrl: e.target.value }))} disabled={!!videoFile} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="primary" onClick={() => setConfirmCreate(true)} isLoading={isLoading}>Post</Button>
          </div>
        </div>
      </Modal>

      <VerifyActionModal
        isOpen={confirmCreate}
        title="Verify Post"
        message="Publish this post?"
        confirmLabel="Accept"
        confirmVariant="primary"
        onCancel={() => setConfirmCreate(false)}
        onVerified={async () => {
          setConfirmCreate(false);
          await createPost();
        }}
      />

      <Modal isOpen={showComments} onClose={() => setShowComments(false)} title="Comments" size="lg">
        <div className="space-y-4">
          {activePost && (
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="font-semibold text-gray-900">{activePost.title}</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{activePost.content}</p>
            </div>
          )}

          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500">{c.authorName || 'User'} • {c.createdAt ? String(c.createdAt).slice(0, 19).replace('T', ' ') : ''}</p>
                <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            {!comments.length && <div className="text-sm text-gray-500">No comments yet.</div>}
          </div>

          <div className="border-t border-gray-200 pt-3 space-y-2">
            <TextArea label="Add a comment" rows={3} value={commentText} onChange={(e) => setCommentText((e.target as HTMLTextAreaElement).value)} />
            <div className="flex justify-end gap-2">
              <Button variant="primary" onClick={() => void addComment()} isLoading={isLoading}>Comment</Button>
            </div>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
};
