import type { ParsedVideoSource } from '../types/liveSessions';

/**
 * Parses, validates, and normalizes a video URL or internal recording path into a ParsedVideoSource.
 * Prevents dangerous protocols (javascript:, data:, vbscript:, file:).
 */
export function parseVideoSource(rawUrl?: string | null): ParsedVideoSource {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      type: 'unknown',
      embedUrl: null,
      videoId: null,
      isValid: false,
      errorMessage: 'Stream URL is required.',
    };
  }

  const url = rawUrl.trim();

  // Internal upload recording URL
  if (url.includes('/recording/stream') || url.includes('/uploads/live-recordings/')) {
    return {
      type: 'uploaded',
      embedUrl: null,
      videoId: null,
      isValid: true,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      type: 'unknown',
      embedUrl: null,
      videoId: null,
      isValid: false,
      errorMessage: 'Invalid URL format.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      type: 'unknown',
      embedUrl: null,
      videoId: null,
      isValid: false,
      errorMessage: 'Invalid URL protocol. Only http: and https: are allowed.',
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. YouTube Detection
  // Matches: youtube.com, www.youtube.com, m.youtube.com, youtu.be, youtube-nocookie.com
  if (hostname.includes('youtube.com') || hostname === 'youtu.be' || hostname.includes('youtube-nocookie.com')) {
    let videoId: string | null = null;

    if (hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('/')[0] || null;
    } else if (parsed.pathname.startsWith('/shorts/')) {
      videoId = parsed.pathname.replace('/shorts/', '').split('/')[0] || null;
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.replace('/embed/', '').split('/')[0] || null;
    } else if (parsed.searchParams.has('v')) {
      videoId = parsed.searchParams.get('v');
    }

    if (videoId && /^[a-zA-Z0-9_-]{6,15}$/.test(videoId)) {
      return {
        type: 'youtube',
        videoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
        isValid: true,
      };
    }
  }

  // 2. Vimeo Detection
  // Matches: vimeo.com, player.vimeo.com
  if (hostname.includes('vimeo.com')) {
    let videoId: string | null = null;
    const segments = parsed.pathname.split('/').filter(Boolean);

    for (let i = segments.length - 1; i >= 0; i--) {
      if (/^\d{5,12}$/.test(segments[i])) {
        videoId = segments[i];
        break;
      }
    }

    if (videoId) {
      return {
        type: 'vimeo',
        videoId,
        embedUrl: `https://player.vimeo.com/video/${videoId}?dnt=1`,
        isValid: true,
      };
    }
  }

  // 3. Direct Video Stream Detection (.mp4, .webm, .ogg, .mov, etc.)
  const pathLower = parsed.pathname.toLowerCase();
  const directExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.ogg', '.ogv'];
  const hasDirectExt = directExtensions.some((ext) => pathLower.endsWith(ext));

  if (hasDirectExt || parsed.pathname.includes('/video/') || parsed.searchParams.has('stream')) {
    return {
      type: 'direct',
      videoId: null,
      embedUrl: null,
      isValid: true,
    };
  }

  return {
    type: 'unknown',
    videoId: null,
    embedUrl: null,
    isValid: false,
    errorMessage: 'Unsupported video stream URL. Supported sources: YouTube, Vimeo, direct MP4/WebM.',
  };
}
