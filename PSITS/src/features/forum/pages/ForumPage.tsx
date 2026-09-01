import { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input, TextArea, Select, Badge } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import {
  Heart,
  MessageSquare,
  Plus,
  Pin,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Video as VideoIcon,
  Link2,
  Code2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Eye,
  Edit3,
  Sparkles,
  Check,
  X,
  Tag,
  Palette,
  Flame,
  HelpCircle,
  FileText,
  Newspaper,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from 'lucide-react';

type PostType = 'announcement' | 'news' | 'story' | 'blog' | 'discussion' | 'question';
type AccentColor = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate';

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
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          allowComments: parsed.allowComments !== false,
          isUrgent: !!parsed.isUrgent,
          language: parsed.language || '',
          mood: parsed.mood || 'Inspiring',
          emoji: parsed.emoji || '🚀',
          subtitle: parsed.subtitle || '',
          category: parsed.category || 'General',
          readTime: parsed.readTime || '3 min',
          priority: parsed.priority || 'Normal',
          citation: parsed.citation || '',
          audience: parsed.audience || 'All',
          accentColor: (parsed.accentColor as AccentColor) || 'blue',
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
      language: '',
      mood: 'Inspiring',
      emoji: '🚀',
      subtitle: '',
      category: 'General',
      readTime: '3 min',
      priority: 'Normal',
      citation: '',
      audience: 'All',
      accentColor: 'blue' as AccentColor,
      isStructured: false,
    };
  };

  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | PostType>('all');
  const [posts, setPosts] = useState<any[]>([]);

  // Create Post Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [createTab, setCreateTab] = useState<'edit' | 'preview'>('edit');
  const [postForm, setPostForm] = useState<{
    type: PostType;
    title: string;
    content: string;
    imageUrl: string;
    videoUrl: string;
  }>({
    type: 'discussion',
    title: '',
    content: '',
    imageUrl: '',
    videoUrl: '',
  });

  const [accentColor, setAccentColor] = useState<AccentColor>('blue');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [confirmCreate, setConfirmCreate] = useState(false);

  // Dynamic Type-Specific Fields
  const [discussionCategory, setDiscussionCategory] = useState('Tech Talk');
  const [discussionAllowComments, setDiscussionAllowComments] = useState(true);

  const [questionLanguage, setQuestionLanguage] = useState('JavaScript');
  const [questionUrgent, setQuestionUrgent] = useState(false);

  const [storyMood, setStoryMood] = useState('Inspiring');
  const [storyEmoji, setStoryEmoji] = useState('🚀');

  const [blogSubtitle, setBlogSubtitle] = useState('');
  const [blogCategory, setBlogCategory] = useState('Development');
  const [blogReadTime, setBlogReadTime] = useState('3 min');

  const [newsPriority, setNewsPriority] = useState('Normal');
  const [newsCitation, setNewsCitation] = useState('');
  const [newsAudience, setNewsAudience] = useState('All');

  // Interactive Tags State
  const [selectedTags, setSelectedTags] = useState<string[]>(['#General']);
  const [customTagInput, setCustomTagInput] = useState<string>('');

  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const availableTagSuggestions: Record<PostType, string[]> = {
    discussion: ['#WebDev', '#React', '#Python', '#AI', '#Career', '#OpenSource', '#Networking', '#TechTalk', '#CampusLife'],
    question: ['#JavaScript', '#React', '#Python', '#NodeJS', '#Database', '#CSS', '#TypeScript', '#BugFix', '#API'],
    story: ['#StudentLife', '#Internship', '#Graduation', '#Victory', '#Hackathon', '#Inspiration', '#Achievement'],
    blog: ['#Tutorial', '#FullStack', '#Architecture', '#BestPractices', '#DevOps', '#Security', '#SystemDesign'],
    news: ['#PSITSNews', '#EventAnnouncement', '#Workshop', '#Competition', '#CampusUpdate', '#Officers'],
    announcement: ['#Official', '#Important', '#Update', '#Schedule', '#Deadline'],
  };

  const handleToggleTag = (tag: string) => {
    const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
    setSelectedTags((prev) =>
      prev.includes(cleanTag) ? prev.filter((t) => t !== cleanTag) : [...prev, cleanTag]
    );
  };

  const handleAddCustomTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (('key' in e && (e.key === 'Enter' || e.key === ',')) || e.type === 'click') {
      e.preventDefault();
      const raw = customTagInput.trim().replace(/^#+/, '');
      if (raw) {
        const clean = `#${raw}`;
        if (!selectedTags.includes(clean)) {
          setSelectedTags((prev) => [...prev, clean]);
        }
        setCustomTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const insertFormatting = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const el = contentTextareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = postForm.content;
    const selected = current.substring(start, end) || defaultPlaceholder;
    const replacement = `${prefix}${selected}${suffix}`;
    const nextContent = current.substring(0, start) + replacement + current.substring(end);

    setPostForm((prev) => ({ ...prev, content: nextContent }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      addNotification({
        userId: 'current',
        title: 'File Too Large',
        message: 'Image size should be under 10MB.',
        type: 'error',
        isRead: false,
      });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setPostForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleRemoveVideo = () => {
    setVideoFile(null);
    setVideoPreview('');
    setPostForm((prev) => ({ ...prev, videoUrl: '' }));
  };

  const resetCustomFields = () => {
    setCreateTab('edit');
    setAccentColor('blue');
    setImageFile(null);
    setImagePreview('');
    setVideoFile(null);
    setVideoPreview('');
    setSelectedTags(['#General']);
    setCustomTagInput('');
    setDiscussionCategory('Tech Talk');
    setDiscussionAllowComments(true);
    setQuestionLanguage('JavaScript');
    setQuestionUrgent(false);
    setStoryMood('Inspiring');
    setStoryEmoji('🚀');
    setBlogSubtitle('');
    setBlogCategory('Development');
    setBlogReadTime('3 min');
    setNewsPriority('Normal');
    setNewsCitation('');
    setNewsAudience('All');
  };

  const [activePost, setActivePost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string; rootParentId: string } | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
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
    if (!postForm.title.trim()) {
      addNotification({ userId: 'current', title: 'Validation', message: 'Please enter a post title.', type: 'error', isRead: false });
      return;
    }
    if (!postForm.content.trim()) {
      addNotification({ userId: 'current', title: 'Validation', message: 'Please enter post content.', type: 'error', isRead: false });
      return;
    }

    setIsLoading(true);
    try {
      let finalImageUrl = postForm.imageUrl.trim();
      if (imageFile) {
        const imgRes = await api.uploadForumImage(imageFile);
        if (imgRes.data?.success) {
          finalImageUrl = imgRes.data.url;
        } else {
          throw new Error(imgRes.data?.message || 'Image upload failed.');
        }
      }

      let finalVideoUrl = postForm.videoUrl.trim();
      if (videoFile) {
        const uploadRes = await api.uploadForumVideo(videoFile);
        if (uploadRes.data?.success) {
          finalVideoUrl = uploadRes.data.url;
        } else {
          throw new Error(uploadRes.data?.message || 'Video upload failed.');
        }
      }

      const structuredContent = JSON.stringify({
        body: postForm.content,
        tags: selectedTags,
        allowComments: discussionAllowComments,
        isUrgent: questionUrgent,
        language: questionLanguage,
        mood: storyMood,
        emoji: storyEmoji,
        subtitle: blogSubtitle,
        category: blogCategory,
        readTime: blogReadTime,
        priority: newsPriority,
        citation: newsCitation,
        audience: newsAudience,
        accentColor: accentColor,
      });

      const { data } = await api.createForumPost({
        type: postForm.type,
        title: postForm.title.trim(),
        content: structuredContent,
        imageUrl: finalImageUrl || null,
        videoUrl: finalVideoUrl || null,
      });

      if (data?.success) {
        addNotification({ userId: 'current', title: 'Posted', message: 'Post created successfully!', type: 'success', isRead: false });
        setShowCreate(false);
        setPostForm({ type: 'discussion', title: '', content: '', imageUrl: '', videoUrl: '' });
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
    setReplyingTo(null);
    setExpandedComments({});
    setShowComments(true);
    try {
      const { data } = await api.getForumComments(String(post.id));
      if (data?.success) setComments(data.comments || []);
    } catch {
      // ignore
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const handleStartReply = (c: any) => {
    const rootId = c.parentId ? c.parentId : c.id;
    setReplyingTo({ id: c.id, authorName: c.authorName || 'User', rootParentId: rootId });
    setExpandedComments((prev) => ({ ...prev, [rootId]: true }));
  };

  const addComment = async () => {
    if (!activePost) return;
    const text = commentText.trim();
    if (!text) return;
    setIsLoading(true);
    try {
      const targetParentId = replyingTo ? (replyingTo.rootParentId || replyingTo.id) : null;
      const { data } = await api.addForumComment(String(activePost.id), text, targetParentId);
      if (data?.success) {
        const refreshed = await api.getForumComments(String(activePost.id));
        if (refreshed.data?.success) setComments(refreshed.data.comments || []);
        if (targetParentId) {
          setExpandedComments((prev) => ({ ...prev, [targetParentId]: true }));
        }
        setCommentText('');
        setReplyingTo(null);
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">PSITS Community</h1>
            <p className="mt-2 text-gray-600 dark:text-slate-400">News, stories, and discussions.</p>
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
              const postAccent = info.accentColor || 'blue';
              const accentBorder =
                postAccent === 'violet' ? 'border-l-violet-500' :
                postAccent === 'emerald' ? 'border-l-emerald-500' :
                postAccent === 'amber' ? 'border-l-amber-500' :
                postAccent === 'rose' ? 'border-l-rose-500' :
                postAccent === 'cyan' ? 'border-l-cyan-500' :
                postAccent === 'slate' ? 'border-l-slate-600' :
                'border-l-blue-500';
              
              // Determine card styling based on post type and urgency
              let cardClass = `p-5 border border-gray-200 transition-all hover:shadow-md bg-white border-l-4 ${accentBorder} `;
              if (p.type === 'question' && info.isUrgent) {
                cardClass += "bg-amber-50/10 shadow-[0_0_15px_-4px_rgba(245,158,11,0.25)] ";
              } else if (p.type === 'story') {
                cardClass += "bg-gradient-to-br from-violet-50/10 to-indigo-50/5 ";
              } else if (p.type === 'news') {
                cardClass += "bg-white ";
              } else if (p.type === 'blog') {
                cardClass += "bg-slate-50/30 ";
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
                        {p.type === 'question' && info.language && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                            <Code2 size={12} /> {info.language}
                          </span>
                        )}

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

                      {/* Cover Image Display */}
                      {p.imageUrl && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 shadow-2xs max-h-[420px]">
                          <img
                            src={p.imageUrl}
                            alt={p.title}
                            className="w-full h-full object-cover max-h-[420px] hover:scale-[1.01] transition-transform duration-300"
                          />
                        </div>
                      )}

                      {/* Media Video Display */}
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

                      {/* Tags List */}
                      {Array.isArray(info.tags) && info.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          {info.tags.map((tg: string, i: number) => (
                            <span
                              key={i}
                              className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900"
                            >
                              {tg}
                            </span>
                          ))}
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

      {/* Dynamic & Customizable Create Post Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Post" size="lg">
        <div className="space-y-4">
          {/* Header Mode Tabs: Edit vs Preview */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setCreateTab('edit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  createTab === 'edit'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                }`}
              >
                <Edit3 size={14} />
                <span>Edit Post</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('preview')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  createTab === 'preview'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                }`}
              >
                <Eye size={14} />
                <span>Live Preview</span>
              </button>
            </div>

            {/* Accent Theme Color Dot Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1">
                <Palette size={13} /> Theme:
              </span>
              <div className="flex items-center gap-1.5">
                {(['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'slate'] as AccentColor[]).map((c) => {
                  const bgClass =
                    c === 'blue' ? 'bg-blue-500' :
                    c === 'violet' ? 'bg-violet-500' :
                    c === 'emerald' ? 'bg-emerald-500' :
                    c === 'amber' ? 'bg-amber-500' :
                    c === 'rose' ? 'bg-rose-500' :
                    c === 'cyan' ? 'bg-cyan-500' :
                    'bg-slate-700';
                  const isSelected = accentColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccentColor(c)}
                      title={`Accent: ${c}`}
                      className={`h-5 w-5 rounded-full ${bgClass} transition-transform flex items-center justify-center ${
                        isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      {isSelected && <Check size={10} className="text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {createTab === 'edit' ? (
            <div className="space-y-4">
              {/* Dynamic Post Type Selector Cards */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-2">
                  Select Post Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {[
                    { type: 'discussion' as PostType, label: 'Discussion', icon: MessageSquare, color: 'text-blue-600', activeBg: 'border-blue-500 bg-blue-50/75 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200' },
                    { type: 'question' as PostType, label: 'Question', icon: HelpCircle, color: 'text-amber-600', activeBg: 'border-amber-500 bg-amber-50/75 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200' },
                    { type: 'story' as PostType, label: 'Story', icon: Sparkles, color: 'text-violet-600', activeBg: 'border-violet-500 bg-violet-50/75 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200' },
                    { type: 'blog' as PostType, label: 'Blog', icon: FileText, color: 'text-emerald-600', activeBg: 'border-emerald-500 bg-emerald-50/75 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200' },
                    ...(canModerate ? [
                      { type: 'news' as PostType, label: 'News', icon: Newspaper, color: 'text-rose-600', activeBg: 'border-rose-500 bg-rose-50/75 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200' },
                    ] : []),
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = postForm.type === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => {
                          setPostForm((p) => ({ ...p, type: item.type }));
                          setSelectedTags(availableTagSuggestions[item.type].slice(0, 2));
                        }}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all shadow-2xs ${
                          isSelected
                            ? `${item.activeBg} font-bold ring-2 ring-primary border-transparent`
                            : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300'
                        }`}
                      >
                        <Icon size={18} className={isSelected ? 'text-current' : item.color} />
                        <span className="text-xs">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Type-Specific Settings Panel */}
              {postForm.type === 'discussion' && (
                <div className="p-3.5 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare size={14} /> Discussion Settings
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={discussionAllowComments}
                        onChange={(e) => setDiscussionAllowComments(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-xs font-medium text-gray-700 dark:text-slate-300">Allow community replies</span>
                    </label>
                  </div>
                  <Select
                    label="Discussion Category"
                    options={[
                      { value: 'Tech Talk', label: 'Tech Talk & Code' },
                      { value: 'General', label: 'General / Watercooler' },
                      { value: 'Career & Jobs', label: 'Career Advice & Internships' },
                      { value: 'Campus Life', label: 'Campus & Club Activities' },
                      { value: 'Project Showcase', label: 'Project Ideas & Feedback' },
                    ]}
                    value={discussionCategory}
                    onChange={(e) => setDiscussionCategory(e.target.value)}
                  />
                </div>
              )}

              {postForm.type === 'question' && (
                <div className="p-3.5 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle size={14} /> Question Details & Stack
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select
                      label="Programming Language / Stack"
                      options={[
                        { value: 'JavaScript', label: 'JavaScript' },
                        { value: 'TypeScript', label: 'TypeScript' },
                        { value: 'Python', label: 'Python' },
                        { value: 'Java', label: 'Java' },
                        { value: 'C# / .NET', label: 'C# / .NET' },
                        { value: 'C / C++', label: 'C / C++' },
                        { value: 'PHP', label: 'PHP' },
                        { value: 'SQL / Database', label: 'SQL / Database' },
                        { value: 'React / Next.js', label: 'React / Next.js' },
                        { value: 'Mobile / Flutter', label: 'Mobile / Flutter' },
                        { value: 'DevOps / Cloud', label: 'DevOps / Cloud' },
                        { value: 'General Tech', label: 'General Tech' },
                      ]}
                      value={questionLanguage}
                      onChange={(e) => setQuestionLanguage(e.target.value)}
                    />
                    <div className="flex items-center sm:pt-6">
                      <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 w-full">
                        <input
                          type="checkbox"
                          checked={questionUrgent}
                          onChange={(e) => setQuestionUrgent(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                        />
                        <span className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1">
                          <Flame size={14} /> Mark as URGENT (Flashing badge)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {postForm.type === 'story' && (
                <div className="p-3.5 bg-violet-50/40 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/60 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-violet-800 dark:text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} /> Story Mood & Milestone
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select
                      label="Story Mood Emoji"
                      options={[
                        { value: '🚀', label: '🚀 Launching / Career' },
                        { value: '✨', label: '✨ Inspiring / Spark' },
                        { value: '🎓', label: '🎓 Student Success / Graduation' },
                        { value: '💡', label: '💡 Great Idea / Solution' },
                        { value: '🏆', label: '🏆 Competition Victory' },
                        { value: '🤝', label: '🤝 Teamwork / Collaboration' },
                        { value: '💼', label: '💼 First Job / Internship' },
                      ]}
                      value={storyEmoji}
                      onChange={(e) => setStoryEmoji(e.target.value)}
                    />
                    <Select
                      label="Story Mood Vibe"
                      options={[
                        { value: 'Inspiring', label: 'Inspiring' },
                        { value: 'Joyful', label: 'Joyful' },
                        { value: 'Success Story', label: 'Success Story' },
                        { value: 'Technical Journey', label: 'Technical Journey' },
                        { value: 'Milestone', label: 'Milestone' },
                      ]}
                      value={storyMood}
                      onChange={(e) => setStoryMood(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {postForm.type === 'blog' && (
                <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} /> Blog Article Settings
                  </p>
                  <Input
                    label="Subtitle / Summary Teaser"
                    placeholder="Write a catchy summary headline..."
                    value={blogSubtitle}
                    onChange={(e) => setBlogSubtitle((e.target as HTMLInputElement).value)}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select
                      label="Estimated Read Time"
                      options={[
                        { value: '1 min', label: '⚡ 1 min quick read' },
                        { value: '3 min', label: '⏱️ 3 min standard' },
                        { value: '5 min', label: '📖 5 min article' },
                        { value: '10 min', label: '📚 10 min in-depth guide' },
                      ]}
                      value={blogReadTime}
                      onChange={(e) => setBlogReadTime(e.target.value)}
                    />
                    <Select
                      label="Blog Category"
                      options={[
                        { value: 'Development', label: 'Development' },
                        { value: 'Design', label: 'Design' },
                        { value: 'Networking', label: 'Networking' },
                        { value: 'AI / Data Science', label: 'AI / Data Science' },
                        { value: 'Cybersecurity', label: 'Cybersecurity' },
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
                <div className="p-3.5 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Newspaper size={14} /> Official News Metadata
                  </p>
                  <Input
                    label="Citation / Source Link (Optional)"
                    placeholder="https://example.com/official-announcement"
                    value={newsCitation}
                    onChange={(e) => setNewsCitation((e.target as HTMLInputElement).value)}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select
                      label="News Priority"
                      options={[
                        { value: 'Normal', label: 'Normal' },
                        { value: 'High', label: 'High Priority' },
                        { value: 'Breaking', label: '🚨 BREAKING NEWS (Flashing banner)' },
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

              {/* Title Field */}
              <Input
                label={
                  postForm.type === 'question' ? 'What is your question?' :
                  postForm.type === 'story' ? 'Story Title / Headline' :
                  postForm.type === 'blog' ? 'Blog Article Title' :
                  postForm.type === 'news' ? 'Headline / News Title' :
                  'Discussion Title'
                }
                placeholder={
                  postForm.type === 'question' ? 'e.g. How to resolve CORS policy error with Express & React?' :
                  postForm.type === 'story' ? 'e.g. How I built my first full-stack system and landed an internship' :
                  postForm.type === 'blog' ? 'e.g. Mastering TailwindCSS: From zero to responsive master' :
                  'Enter post title...'
                }
                value={postForm.title}
                onChange={(e) => setPostForm((p) => ({ ...p, title: e.target.value }))}
              />

              {/* Rich Markdown Formatting Toolbar & Content Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300">
                    Content
                  </label>
                  <span className="text-[11px] text-gray-400">Markdown formatting supported</span>
                </div>

                {/* Formatting Action Buttons Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-1.5 bg-gray-100 dark:bg-slate-800 rounded-t-xl border border-b-0 border-gray-300 dark:border-slate-700">
                  <button
                    type="button"
                    title="Bold"
                    onClick={() => insertFormatting('**', '**', 'bold text')}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
                  >
                    <Bold size={15} />
                  </button>
                  <button
                    type="button"
                    title="Italic"
                    onClick={() => insertFormatting('*', '*', 'italic text')}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
                  >
                    <Italic size={15} />
                  </button>
                  <button
                    type="button"
                    title="Code"
                    onClick={() => insertFormatting('`', '`', 'code')}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
                  >
                    <Code2 size={15} />
                  </button>
                  <button
                    type="button"
                    title="Quote"
                    onClick={() => insertFormatting('> ', '', 'quoted message')}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
                  >
                    <Quote size={15} />
                  </button>
                  <button
                    type="button"
                    title="Bullet List"
                    onClick={() => insertFormatting('\n- ', '', 'List item')}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
                  >
                    <List size={15} />
                  </button>
                  <button
                    type="button"
                    title="Numbered List"
                    onClick={() => insertFormatting('\n1. ', '', 'Step item')}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
                  >
                    <ListOrdered size={15} />
                  </button>
                  <button
                    type="button"
                    title="Link"
                    onClick={() => insertFormatting('[', '](https://example.com)', 'link description')}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
                  >
                    <Link2 size={15} />
                  </button>

                  {postForm.type === 'question' && (
                    <button
                      type="button"
                      onClick={() => insertFormatting('\n```' + (questionLanguage.toLowerCase().replace(/[^a-z0-9]/g, '') || 'js') + '\n// Paste code here\n', '\n```\n')}
                      className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 hover:bg-amber-200"
                    >
                      <Code2 size={13} /> + Insert Code Snippet
                    </button>
                  )}
                </div>

                <textarea
                  ref={contentTextareaRef}
                  rows={6}
                  value={postForm.content}
                  onChange={(e) => setPostForm((p) => ({ ...p, content: e.target.value }))}
                  placeholder={
                    postForm.type === 'question' ? 'Describe the problem context, what you have tried, and any error logs...' :
                    postForm.type === 'story' ? 'Share your journey, milestones, and personal reflection...' :
                    postForm.type === 'blog' ? 'Write your tutorial, deep dive, or tech article here...' :
                    'Write your discussion content...'
                  }
                  className="w-full text-sm p-3 rounded-b-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none resize-y"
                />
              </div>

              {/* Dynamic Interactive Tag Chips & Custom Tag Adder */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag size={13} /> Tags & Topics
                </label>

                {/* Selected Tag Badges */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-lg">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 shadow-2xs"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-red-600 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag Quick Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-500 font-medium">Quick suggestions:</span>
                  {(availableTagSuggestions[postForm.type] || []).map((suggestion) => {
                    const isSelected = selectedTags.includes(suggestion);
                    return (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleToggleTag(suggestion)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-blue-400'
                        }`}
                      >
                        {suggestion}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Tag Input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={handleAddCustomTag}
                    placeholder="Add custom tag (e.g. DevOps, MySQL) and press Enter..."
                    className="text-xs p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 flex-1 focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomTag}
                  >
                    + Add Tag
                  </Button>
                </div>
              </div>

              {/* Attachments: Cover Image & Video */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-slate-800">
                {/* Image / Cover Photo Attachment */}
                <div className="space-y-2 p-3 bg-gray-50/50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-800">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon size={14} /> Attach Cover Image (Optional)
                  </label>

                  {imagePreview || postForm.imageUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 max-h-36">
                      <img
                        src={imagePreview || postForm.imageUrl}
                        alt="Preview"
                        className="w-full h-36 object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-md transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileSelect}
                        className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 border border-gray-300 dark:border-slate-700 rounded-lg p-1.5 bg-white dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="Or paste image URL (https://...)"
                        value={postForm.imageUrl}
                        onChange={(e) => setPostForm((p) => ({ ...p, imageUrl: e.target.value }))}
                        className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Video Attachment */}
                <div className="space-y-2 p-3 bg-gray-50/50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-800">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300 flex items-center gap-1.5">
                    <VideoIcon size={14} /> Attach Video (Optional)
                  </label>

                  {videoPreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-black">
                      <video controls className="w-full max-h-36">
                        <source src={videoPreview} />
                      </video>
                      <button
                        type="button"
                        onClick={handleRemoveVideo}
                        className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-md transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileSelect}
                        className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 border border-gray-300 dark:border-slate-700 rounded-lg p-1.5 bg-white dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="Or paste YouTube / Video URL"
                        value={postForm.videoUrl}
                        onChange={(e) => setPostForm((p) => ({ ...p, videoUrl: e.target.value }))}
                        className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Live Post Preview Card */
            <div className="space-y-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Eye size={14} /> Feed Live Preview:
                </span>
                <span className="text-[11px]">This is how your post will look to the community</span>
              </div>

              {/* Rendered Preview Card */}
              {(() => {
                const accentBorder =
                  accentColor === 'violet' ? 'border-l-violet-500' :
                  accentColor === 'emerald' ? 'border-l-emerald-500' :
                  accentColor === 'amber' ? 'border-l-amber-500' :
                  accentColor === 'rose' ? 'border-l-rose-500' :
                  accentColor === 'cyan' ? 'border-l-cyan-500' :
                  accentColor === 'slate' ? 'border-l-slate-600' :
                  'border-l-blue-500';

                return (
                  <div className={`p-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 ${accentBorder} shadow-md space-y-3`}>
                    {/* Header Ribbon for News */}
                    {postForm.type === 'news' && newsPriority === 'Breaking' && (
                      <div className="bg-red-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-t-lg -mx-5 -mt-5 mb-3 uppercase tracking-widest animate-pulse flex items-center justify-between">
                        <span>🚨 Breaking News Alert</span>
                        <span>Audience: {newsAudience}</span>
                      </div>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={badgeVariant(postForm.type)}>{postForm.type.toUpperCase()}</Badge>

                      {postForm.type === 'question' && questionLanguage && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                          <Code2 size={12} /> {questionLanguage}
                        </span>
                      )}

                      {postForm.type === 'question' && questionUrgent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600 animate-pulse">
                          🔥 Urgent Help Needed
                        </span>
                      )}

                      {postForm.type === 'story' && (
                        <Badge variant="secondary">✨ {storyMood}</Badge>
                      )}

                      {postForm.type === 'blog' && (
                        <Badge variant="info">📚 {blogCategory}</Badge>
                      )}

                      {postForm.type === 'discussion' && !discussionAllowComments && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          🔒 Comments Locked
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-lg text-gray-900 dark:text-slate-100 flex items-center gap-2">
                      {postForm.type === 'question' && <span>❓</span>}
                      {postForm.type === 'story' && <span>{storyEmoji}</span>}
                      {postForm.title || <span className="italic text-gray-400">Untitled Post</span>}
                    </h3>

                    {/* Subtitle for blog */}
                    {postForm.type === 'blog' && blogSubtitle && (
                      <p className="text-sm text-gray-500 italic border-l-2 border-slate-300 pl-2">
                        {blogSubtitle}
                      </p>
                    )}

                    {/* Content */}
                    <div className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {postForm.content || <span className="italic text-gray-400">Post content will appear here...</span>}
                    </div>

                    {/* Image Preview */}
                    {(imagePreview || postForm.imageUrl) && (
                      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 max-h-60">
                        <img
                          src={imagePreview || postForm.imageUrl}
                          alt="Attached Cover"
                          className="w-full h-full object-cover max-h-60"
                        />
                      </div>
                    )}

                    {/* Video Preview */}
                    {(videoPreview || postForm.videoUrl) && (
                      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-black">
                        {postForm.videoUrl && (postForm.videoUrl.includes('youtube.com') || postForm.videoUrl.includes('youtu.be')) ? (
                          <iframe
                            className="w-full aspect-video"
                            src={postForm.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                            title="YouTube video"
                          />
                        ) : (
                          <video controls className="w-full max-h-60">
                            <source src={videoPreview || postForm.videoUrl} />
                          </video>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {selectedTags.map((tg, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900"
                          >
                            {tg}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Author & Footer */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-slate-800">
                      <span>By <strong className="text-gray-700 dark:text-slate-300">{user?.fullName || 'Current User'}</strong> • Just now</span>
                      {postForm.type === 'blog' && <span>⏱️ {blogReadTime} read</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-200 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                resetCustomFields();
              }}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => setConfirmCreate(true)}
                isLoading={isLoading}
                className="px-6"
              >
                <Plus size={16} className="mr-1.5" />
                Publish Post
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <VerifyActionModal
        isOpen={confirmCreate}
        title="Verify Post"
        message="Publish this post to the community?"
        confirmLabel="Publish Now"
        confirmVariant="primary"
        onCancel={() => setConfirmCreate(false)}
        onVerified={async () => {
          setConfirmCreate(false);
          await createPost();
        }}
      />

      <Modal isOpen={showComments} onClose={() => { setShowComments(false); setReplyingTo(null); }} title="Comments" size="lg">
        <div className="space-y-4">
          {(() => {
            const activePostInfo = activePost ? parsePostContent(activePost.content) : null;
            const allowComments = activePostInfo ? activePostInfo.allowComments : true;
            const topLevelComments = comments.filter((c) => !c.parentId);
            const repliesByParent = comments.reduce((acc: Record<string, any[]>, c) => {
              if (c.parentId) {
                acc[c.parentId] = acc[c.parentId] || [];
                acc[c.parentId].push(c);
              }
              return acc;
            }, {});

            return (
              <>
                {activePost && (
                  <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-3.5 bg-gray-50/80 dark:bg-slate-900/60">
                    <p className="font-bold text-gray-900 dark:text-slate-100">{activePost.title}</p>
                    <p className="text-sm text-gray-700 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{activePostInfo?.body || activePost.content}</p>
                  </div>
                )}

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {topLevelComments.map((c) => {
                    const replies = repliesByParent[c.id] || [];
                    return (
                      <div key={c.id} className="space-y-2">
                        {/* Parent Comment */}
                        <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-3.5 bg-white dark:bg-slate-900/90 shadow-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center border border-blue-200 dark:border-blue-800">
                                {(c.authorName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-xs text-gray-900 dark:text-slate-100">{c.authorName || 'User'}</span>
                            </div>
                            <span className="text-[11px] text-gray-400">
                              {c.createdAt ? String(c.createdAt).slice(0, 19).replace('T', ' ') : ''}
                            </span>
                          </div>

                          <p className="text-sm text-gray-800 dark:text-slate-200 mt-2 whitespace-pre-wrap leading-relaxed pl-9">
                            {c.content}
                          </p>

                          {/* Action Bar with Reply and Collapsible Replies Dropdown */}
                          <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                            {replies.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => toggleReplies(c.id)}
                                className="text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                {expandedComments[c.id] ? (
                                  <>
                                    <ChevronUp size={14} className="text-blue-600 dark:text-blue-400" />
                                    <span>Hide {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={14} className="text-blue-600 dark:text-blue-400" />
                                    <span>View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <div />
                            )}

                            {allowComments && (
                              <button
                                type="button"
                                onClick={() => handleStartReply(c)}
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                              >
                                <CornerDownRight size={13} /> Reply
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Child Replies Thread */}
                        {replies.length > 0 && expandedComments[c.id] && (
                          <div className="ml-5 sm:ml-9 pl-3.5 sm:pl-4 border-l-2 border-blue-200 dark:border-blue-800/60 space-y-2 pt-0.5 animate-fadeIn">
                            {replies.map((r) => (
                              <div key={r.id} className="rounded-xl border border-gray-200/80 dark:border-slate-800/80 p-3 bg-gray-50/70 dark:bg-slate-900/50 shadow-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                                      {(r.authorName || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                      <span className="font-bold text-gray-900 dark:text-slate-100">{r.authorName || 'User'}</span>
                                      <ChevronRight size={13} className="text-gray-400 dark:text-slate-500 shrink-0 stroke-[2.5]" />
                                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                                        {r.parentAuthorName || c.authorName || 'User'}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-gray-400 shrink-0">
                                    {r.createdAt ? String(r.createdAt).slice(0, 19).replace('T', ' ') : ''}
                                  </span>
                                </div>

                                <p className="text-xs sm:text-sm text-gray-800 dark:text-slate-200 mt-1.5 whitespace-pre-wrap leading-relaxed pl-8">
                                  {r.content}
                                </p>

                                {allowComments && (
                                  <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-slate-800/50 flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleStartReply(r)}
                                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 py-0.5 px-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                    >
                                      <CornerDownRight size={12} /> Reply
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!comments.length && (
                    <div className="text-sm text-gray-500 text-center py-6">
                      No comments yet. Be the first to share your thoughts!
                    </div>
                  )}
                </div>

                {allowComments ? (
                  <div className="border-t border-gray-200 dark:border-slate-800 pt-3 space-y-2">
                    {replyingTo && (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 animate-fadeIn">
                        <span className="flex items-center gap-1.5">
                          <CornerDownRight size={14} className="text-blue-600 dark:text-blue-400" />
                          Replying to <strong className="text-blue-950 dark:text-blue-100">@{replyingTo.authorName}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="text-gray-500 hover:text-red-600 p-0.5 rounded flex items-center gap-1 font-medium transition-colors cursor-pointer"
                          title="Cancel reply"
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    )}
                    <TextArea
                      label={replyingTo ? `Replying to @${replyingTo.authorName}` : 'Add a comment'}
                      placeholder={replyingTo ? `Write your reply to @${replyingTo.authorName}...` : 'Write a comment...'}
                      rows={3}
                      value={commentText}
                      onChange={(e) => setCommentText((e.target as HTMLTextAreaElement).value)}
                    />
                    <div className="flex justify-end gap-2">
                      {replyingTo && (
                        <Button variant="outline" size="sm" onClick={() => setReplyingTo(null)}>
                          Cancel
                        </Button>
                      )}
                      <Button variant="primary" onClick={() => void addComment()} isLoading={isLoading}>
                        {replyingTo ? 'Post Reply' : 'Comment'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 dark:border-slate-800 pt-4 text-center text-sm font-semibold text-gray-500 bg-gray-100/60 dark:bg-slate-900/60 p-4 rounded-lg border border-gray-200 dark:border-slate-800 flex items-center justify-center gap-2">
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
