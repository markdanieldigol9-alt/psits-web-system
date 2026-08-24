import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input, TextArea, Select, Badge } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Heart, MessageSquare, Plus, Pin, Pencil, Trash2 } from 'lucide-react';

type PostType = 'announcement' | 'news' | 'story' | 'blog' | 'discussion' | 'question';

export const ForumPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const canModerate = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  const parsePostContent = (content: string) => {
    if (!content) return { body: '', isStructured: false };
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          body: parsed.body || '',
          tags: parsed.tags || [],
          allowComments: parsed.allowComments !== false,
          isUrgent: !!parsed.isUrgent,
          mood: parsed.mood || 'Inspiring',
          emoji: parsed.emoji || '🚀',
          subtitle: parsed.subtitle || '',
          category: parsed.category || 'General',
          readTime: parsed.readTime || '3 min',
          priority: parsed.priority || 'Normal',
          citation: parsed.citation || '',
          audience: parsed.audience || 'All',
          isStructured: true,
        };
      } catch {
        // fallback
      }
    }
    return {
      body: content,
      tags: [],
      allowComments: true,
      isUrgent: false,
      mood: 'Inspiring',
      emoji: '🚀',
      subtitle: '',
      category: 'General',
      readTime: '3 min',
      priority: 'Normal',
      citation: '',
      audience: 'All',
      isStructured: false,
    };
  };

  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | PostType>('all');
  const [posts, setPosts] = useState<any[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [postForm, setPostForm] = useState({ type: 'discussion' as PostType, title: '', content: '', videoUrl: '' });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);

  const [discussionTags, setDiscussionTags] = useState('');
  const [discussionAllowComments, setDiscussionAllowComments] = useState(true);

  const [questionTags, setQuestionTags] = useState('');
  const [questionUrgent, setQuestionUrgent] = useState(false);

  const [storyMood, setStoryMood] = useState('Inspiring');
  const [storyEmoji, setStoryEmoji] = useState('🚀');

  const [blogSubtitle, setBlogSubtitle] = useState('');
  const [blogCategory, setBlogCategory] = useState('General');
  const [blogReadTime, setBlogReadTime] = useState('3 min');

  const [newsPriority, setNewsPriority] = useState('Normal');
  const [newsCitation, setNewsCitation] = useState('');
  const [newsAudience, setNewsAudience] = useState('All');

  const resetCustomFields = () => {
    setDiscussionTags('');
    setDiscussionAllowComments(true);
    setQuestionTags('');
    setQuestionUrgent(false);
    setStoryMood('Inspiring');
    setStoryEmoji('🚀');
    setBlogSubtitle('');
    setBlogCategory('General');
    setBlogReadTime('3 min');
    setNewsPriority('Normal');
    setNewsCitation('');
    setNewsAudience('All');
  };

  const [activePost, setActivePost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

  // Edit & Delete Post State
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    content: string;
    type: PostType;
    imageUrl: string;
    videoUrl: string;
  }>({
    title: '',
    content: '',
    type: 'discussion',
    imageUrl: '',
    videoUrl: '',
  });

  const [deletingPost, setDeletingPost] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const openEditPost = (p: any) => {
    const parsed = parsePostContent(p.content);
    setEditingPost(p);
    setEditForm({
      title: p.title || '',
      content: parsed.body || p.content || '',
      type: p.type || 'discussion',
      imageUrl: p.imageUrl || '',
      videoUrl: p.videoUrl || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    if (!editForm.title.trim()) {
      addNotification({ userId: 'current', title: 'Validation', message: 'Title is required.', type: 'error', isRead: false });
      return;
    }
    if (!editForm.content.trim()) {
      addNotification({ userId: 'current', title: 'Validation', message: 'Content is required.', type: 'error', isRead: false });
      return;
    }

    setIsLoading(true);
    try {
      await api.updateForumPost(String(editingPost.id), {
        title: editForm.title.trim(),
        content: editForm.content.trim(),
        type: editForm.type,
        imageUrl: editForm.imageUrl.trim() || null,
        videoUrl: editForm.videoUrl.trim() || null,
      });
      addNotification({ userId: 'current', title: 'Success', message: 'Post updated successfully!', type: 'success', isRead: false });
      setShowEditModal(false);
      setEditingPost(null);
      await load();
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to update post.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

  const openDeletePost = (p: any) => {
    setDeletingPost(p);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPost) return;
    setIsLoading(true);
    try {
      await api.deleteForumPost(String(deletingPost.id));
      addNotification({ userId: 'current', title: 'Deleted', message: 'Post deleted successfully.', type: 'success', isRead: false });
      setShowDeleteConfirm(false);
      setDeletingPost(null);
      await load();
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to delete post.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

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

      let structuredContent = '';
      if (postForm.type === 'discussion') {
        structuredContent = JSON.stringify({
          body: postForm.content,
          tags: discussionTags.split(',').map(t => t.trim()).filter(Boolean),
          allowComments: discussionAllowComments
        });
      } else if (postForm.type === 'question') {
        structuredContent = JSON.stringify({
          body: postForm.content,
          tags: questionTags.split(',').map(t => t.trim()).filter(Boolean),
          isUrgent: questionUrgent
        });
      } else if (postForm.type === 'story') {
        structuredContent = JSON.stringify({
          body: postForm.content,
          mood: storyMood,
          emoji: storyEmoji
        });
      } else if (postForm.type === 'blog') {
        structuredContent = JSON.stringify({
          body: postForm.content,
          subtitle: blogSubtitle,
          category: blogCategory,
          readTime: blogReadTime
        });
      } else if (postForm.type === 'news') {
        structuredContent = JSON.stringify({
          body: postForm.content,
          priority: newsPriority,
          citation: newsCitation,
          audience: newsAudience
        });
      } else {
        structuredContent = postForm.content;
      }

      const { data } = await api.createForumPost({
        ...postForm,
        content: structuredContent,
        videoUrl: finalVideoUrl
      });

      if (data?.success) {
        addNotification({ userId: 'current', title: 'Posted', message: 'Post created successfully.', type: 'success', isRead: false });
        setShowCreate(false);
        setPostForm({ type: 'discussion', title: '', content: '', videoUrl: '' });
        setVideoFile(null);
        resetCustomFields();
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
            {filtered.map((p) => {
              const info = parsePostContent(p.content);
              
              // Determine card styling based on post type and urgency
              let cardClass = "p-5 border border-gray-200 transition-all hover:shadow-md bg-white ";
              if (p.type === 'question' && info.isUrgent) {
                cardClass += "border-l-4 border-l-amber-500 bg-amber-50/5 shadow-[0_0_15px_-4px_rgba(245,158,11,0.25)] ";
              } else if (p.type === 'story') {
                cardClass += "bg-gradient-to-br from-violet-50/10 to-indigo-50/5 border-l-4 border-l-violet-500 ";
              } else if (p.type === 'news') {
                cardClass += "border-l-4 border-l-red-600 bg-white ";
              } else if (p.type === 'blog') {
                cardClass += "border border-slate-200 bg-slate-50/30 ";
              } else {
                cardClass += "bg-white ";
              }

              return (
                <Card key={p.id} className={cardClass}>
                  {/* News Alert Top Header */}
                  {p.type === 'news' && info.priority === 'Breaking' && (
                    <div className="bg-red-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-t-md -mx-5 -mt-5 mb-4 uppercase tracking-widest animate-pulse flex items-center justify-between">
                      <span>🚨 Breaking News Alert</span>
                      <span>Audience: {info.audience}</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 w-full space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.isPinned && (
                          <span className="inline-flex items-center gap-1 text-xs text-primary font-bold">
                            <Pin size={14} className="fill-current" /> Pinned
                          </span>
                        )}
                        <Badge variant={badgeVariant(p.type)}>{String(p.type).toUpperCase()}</Badge>

                        {/* Custom Badges per post type */}
                        {p.type === 'question' && info.isUrgent && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span> Urgent Help Needed
                          </span>
                        )}
                        {p.type === 'story' && (
                          <Badge variant="secondary">
                            ✨ {info.mood}
                          </Badge>
                        )}
                        {p.type === 'blog' && (
                          <Badge variant="info">
                            📚 {info.category}
                          </Badge>
                        )}
                        {p.type === 'discussion' && !info.allowComments && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-semibold bg-gray-100 px-2 py-0.5 rounded-full">
                            🔒 Comments Locked
                          </span>
                        )}
                      </div>

                      {/* Title display */}
                      <p className="font-bold text-lg text-gray-900 flex items-center gap-2 mt-1">
                        {p.type === 'question' && <span className="text-xl">❓</span>}
                        {p.type === 'story' && <span className="text-xl">{info.emoji}</span>}
                        {p.title}
                      </p>

                      {/* Subtitle summary for blogs */}
                      {p.type === 'blog' && info.subtitle && (
                        <p className="text-sm text-gray-500 italic font-medium -mt-1 pl-1 border-l-2 border-slate-300">
                          {info.subtitle}
                        </p>
                      )}

                      {/* Body Content display */}
                      <div className="mt-2 text-sm text-gray-700 leading-relaxed pl-0.5">
                        {p.type === 'story' ? (
                          <blockquote className="border-l-4 border-violet-200/80 pl-3 italic text-gray-800 text-[15px] my-2">
                            {info.body || p.content}
                          </blockquote>
                        ) : (
                          <p className="whitespace-pre-wrap">{info.body || p.content}</p>
                        )}
                      </div>

                      {/* Media Display */}
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

                      {/* Citations/Links for news & footer stats */}
                      <div className="flex flex-wrap items-center justify-between gap-4 mt-3 pt-1 text-xs text-gray-500 border-t border-gray-100/50">
                        <div className="flex items-center gap-2">
                          <span>By <span className="font-semibold text-gray-700">{p.authorName || 'User'}</span></span>
                          <span>•</span>
                          <span>{p.createdAt ? String(p.createdAt).slice(0, 19).replace('T', ' ') : ''}</span>
                          {p.type === 'blog' && (
                            <>
                              <span>•</span>
                              <span className="font-medium text-slate-600">⏱️ {info.readTime} read</span>
                            </>
                          )}
                        </div>

                        {p.type === 'news' && info.citation && (
                          <a
                            href={info.citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            Read Official Source &rarr;
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void api.setForumLike(String(p.id), true).then(load).catch(() => null)}
                      className="hover:text-red-500 hover:border-red-200 transition-colors"
                    >
                      <Heart size={15} className="text-red-500" /> Like ({p.likesCount || 0})
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void openComments(p)}>
                      <MessageSquare size={15} /> Comments ({p.commentsCount || 0})
                    </Button>
                    {canModerate && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void api.updateForumPost(String(p.id), { isPinned: !p.isPinned }).then(load).catch(() => null)}
                      >
                        <Pin size={15} /> {p.isPinned ? 'Unpin' : 'Pin'}
                      </Button>
                    )}
                    {(canModerate || String(p.authorId) === String(user?.id)) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditPost(p)}
                          className="hover:text-blue-600 hover:border-blue-200 transition-colors"
                        >
                          <Pencil size={15} /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeletePost(p)}
                          className="hover:text-red-600 hover:border-red-200 transition-colors text-red-600"
                        >
                          <Trash2 size={15} /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
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
          <Input
            label={
              postForm.type === 'question' ? 'What is your question?' :
              postForm.type === 'story' ? 'Story Title' :
              postForm.type === 'blog' ? 'Blog Article Title' :
              postForm.type === 'news' ? 'Headline / News Title' :
              'Discussion Title'
            }
            placeholder={
              postForm.type === 'question' ? 'e.g. How to pass ref down to child?' :
              'Enter post title...'
            }
            value={postForm.title}
            onChange={(e) => setPostForm((p) => ({ ...p, title: e.target.value }))}
          />
          
          <TextArea
            label={
              postForm.type === 'question' ? 'Details & Context' :
              postForm.type === 'story' ? 'Write your story...' :
              postForm.type === 'blog' ? 'Write your blog post...' :
              'Content'
            }
            rows={7}
            value={postForm.content}
            onChange={(e) => setPostForm((p) => ({ ...p, content: (e.target as HTMLTextAreaElement).value }))}
          />

          {/* Dynamic uniqueness inputs based on selected Post Type */}
          {postForm.type === 'discussion' && (
            <div className="space-y-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Discussion Settings</p>
              <Input
                label="Tags"
                placeholder="Comma-separated (e.g. general, help, suggestions)"
                value={discussionTags}
                onChange={(e) => setDiscussionTags((e.target as HTMLInputElement).value)}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowComments"
                  checked={discussionAllowComments}
                  onChange={(e) => setDiscussionAllowComments(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="allowComments" className="text-sm text-gray-700">Allow comments on this thread</label>
              </div>
            </div>
          )}

          {postForm.type === 'question' && (
            <div className="space-y-3 p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Question details</p>
              <Input
                label="Topic Tags"
                placeholder="Comma-separated (e.g. react, javascript, node)"
                value={questionTags}
                onChange={(e) => setQuestionTags((e.target as HTMLInputElement).value)}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgentQuestion"
                  checked={questionUrgent}
                  onChange={(e) => setQuestionUrgent(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <label htmlFor="urgentQuestion" className="text-sm font-semibold text-red-600">Mark as URGENT (flashes glowing border in feed)</label>
              </div>
            </div>
          )}

          {postForm.type === 'story' && (
            <div className="space-y-3 p-3 bg-violet-50/30 border border-violet-200 rounded-lg">
              <p className="text-xs font-semibold text-violet-800 uppercase tracking-wider">Story Mood & Highlights</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Story Mood Emoji"
                  options={[
                    { value: '🚀', label: '🚀 Launching / Career' },
                    { value: '✨', label: '✨ Inspiring / Spark' },
                    { value: '🎓', label: '🎓 Student Success / Graduation' },
                    { value: '💡', label: '💡 Great Idea / Solution' },
                    { value: '🏆', label: '🏆 Competition Victory' },
                    { value: '🤝', label: '🤝 Teamwork / Collaboration' },
                  ]}
                  value={storyEmoji}
                  onChange={(e) => setStoryEmoji(e.target.value)}
                />
                <Select
                  label="Story Mood Type"
                  options={[
                    { value: 'Inspiring', label: 'Inspiring' },
                    { value: 'Joyful', label: 'Joyful' },
                    { value: 'Success Story', label: 'Success Story' },
                    { value: 'Technical Journey', label: 'Technical Journey' },
                  ]}
                  value={storyMood}
                  onChange={(e) => setStoryMood(e.target.value)}
                />
              </div>
            </div>
          )}

          {postForm.type === 'blog' && (
            <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Blog Settings & Stats</p>
              <Input
                label="Subtitle / Brief Summary"
                placeholder="Write a catchy summary headline..."
                value={blogSubtitle}
                onChange={(e) => setBlogSubtitle((e.target as HTMLInputElement).value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Estimated Read Time"
                  placeholder="e.g. 5 min"
                  value={blogReadTime}
                  onChange={(e) => setBlogReadTime((e.target as HTMLInputElement).value)}
                />
                <Select
                  label="Blog Category"
                  options={[
                    { value: 'Development', label: 'Development' },
                    { value: 'Design', label: 'Design' },
                    { value: 'Networking', label: 'Networking' },
                    { value: 'AI / Data Science', label: 'AI / Data Science' },
                    { value: 'Career & Growth', label: 'Career & Growth' },
                    { value: 'General', label: 'General' },
                  ]}
                  value={blogCategory}
                  onChange={(e) => setBlogCategory(e.target.value)}
                />
              </div>
            </div>
          )}

          {postForm.type === 'news' && (
            <div className="space-y-3 p-3 bg-red-50/30 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wider">News metadata</p>
              <Input
                label="Citation / Source Link (Optional)"
                placeholder="https://example.com/source"
                value={newsCitation}
                onChange={(e) => setNewsCitation((e.target as HTMLInputElement).value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="News Priority"
                  options={[
                    { value: 'Normal', label: 'Normal' },
                    { value: 'High', label: 'High Priority' },
                    { value: 'Breaking', label: 'BREAKING NEWS (Flashing banner)' },
                  ]}
                  value={newsPriority}
                  onChange={(e) => setNewsPriority(e.target.value)}
                />
                <Select
                  label="Target Audience"
                  options={[
                    { value: 'All', label: 'All Members' },
                    { value: 'Students', label: 'Students Only' },
                    { value: 'Faculty', label: 'Faculty / Advisors Only' },
                    { value: 'Alumni', label: 'Alumni Only' },
                  ]}
                  value={newsAudience}
                  onChange={(e) => setNewsAudience(e.target.value)}
                />
              </div>
            </div>
          )}
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
          {(() => {
            const activePostInfo = activePost ? parsePostContent(activePost.content) : null;
            const allowComments = activePostInfo ? activePostInfo.allowComments : true;

            return (
              <>
                {activePost && (
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <p className="font-semibold text-gray-900">{activePost.title}</p>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{activePostInfo?.body || activePost.content}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-lg border border-gray-200 p-3 bg-white">
                      <p className="text-xs text-gray-500">{c.authorName || 'User'} • {c.createdAt ? String(c.createdAt).slice(0, 19).replace('T', ' ') : ''}</p>
                      <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))}
                  {!comments.length && <div className="text-sm text-gray-500 text-center py-4">No comments yet.</div>}
                </div>

                {allowComments ? (
                  <div className="border-t border-gray-200 pt-3 space-y-2">
                    <TextArea label="Add a comment" rows={3} value={commentText} onChange={(e) => setCommentText((e.target as HTMLTextAreaElement).value)} />
                    <div className="flex justify-end gap-2">
                      <Button variant="primary" onClick={() => void addComment()} isLoading={isLoading}>Comment</Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 pt-4 text-center text-sm font-semibold text-gray-500 bg-gray-100/60 p-4 rounded-lg border border-gray-200 flex items-center justify-center gap-2">
                    <span>🔒 Comments are disabled for this discussion.</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </Modal>

      {/* Edit Post Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit / Update Post" size="lg">
        <div className="space-y-4">
          <Select
            label="Post Category"
            options={[
              { value: 'discussion', label: 'Discussion' },
              { value: 'question', label: 'Question' },
              { value: 'story', label: 'Story' },
              { value: 'blog', label: 'Blog' },
              ...(canModerate ? [{ value: 'news', label: 'News' }] : []),
            ]}
            value={editForm.type}
            onChange={(e) => setEditForm((p) => ({ ...p, type: (e.target as HTMLSelectElement).value as PostType }))}
          />
          <Input
            label="Title"
            value={editForm.title}
            onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
            required
          />
          <TextArea
            label="Content"
            rows={5}
            value={editForm.content}
            onChange={(e) => setEditForm((p) => ({ ...p, content: (e.target as HTMLTextAreaElement).value }))}
            required
          />
          <Input
            label="Image URL (optional)"
            placeholder="https://..."
            value={editForm.imageUrl}
            onChange={(e) => setEditForm((p) => ({ ...p, imageUrl: e.target.value }))}
          />
          <Input
            label="Video URL (optional)"
            placeholder="https://youtu.be/..."
            value={editForm.videoUrl}
            onChange={(e) => setEditForm((p) => ({ ...p, videoUrl: e.target.value }))}
          />

          <div className="border-t border-gray-200 pt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleSaveEdit()} isLoading={isLoading}>
              Update Post
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Post Confirmation Modal */}
      <VerifyActionModal
        isOpen={showDeleteConfirm}
        title="Delete Post"
        message={`Are you sure you want to delete the post "${deletingPost?.title}"? This action cannot be undone.`}
        confirmLabel="Yes, Delete Post"
        confirmVariant="danger"
        onCancel={() => setShowDeleteConfirm(false)}
        onVerified={() => void handleConfirmDelete()}
      />
    </MainLayout>
  );
};
