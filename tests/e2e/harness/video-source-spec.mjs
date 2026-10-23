/**
 * video-source-spec.mjs
 * Reference specification parser for Stream Event URL detection and embed normalization.
 * Matches contracts defined in PROJECT.md and ORIGINAL_REQUEST.md.
 */

export function parseVideoSource(rawUrl) {
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

  let parsed;
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
  // Matches: youtube.com, www.youtube.com, m.youtube.com, youtu.be
  if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
    let videoId = null;

    if (hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('/')[0];
    } else if (parsed.pathname.startsWith('/shorts/')) {
      videoId = parsed.pathname.replace('/shorts/', '').split('/')[0];
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.replace('/embed/', '').split('/')[0];
    } else if (parsed.searchParams.has('v')) {
      videoId = parsed.searchParams.get('v');
    }

    if (videoId && /^[a-zA-Z0-9_-]{6,15}$/.test(videoId)) {
      return {
        type: 'youtube',
        videoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        isValid: true,
      };
    }
  }

  // 2. Vimeo Detection
  // Matches: vimeo.com, player.vimeo.com
  if (hostname.includes('vimeo.com')) {
    let videoId = null;
    const segments = parsed.pathname.split('/').filter(Boolean);

    // Formats: /12345678, /video/12345678, /channels/staffpicks/12345678
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
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
        isValid: true,
      };
    }
  }

  // 3. Direct Video Stream Detection
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
