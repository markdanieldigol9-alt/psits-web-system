import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Tv,
  RotateCcw,
  AlertCircle,
  Loader2,
  Film,
} from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import { parseVideoSource } from '../utils/videoSource';
import type { VideoQuality, ParsedVideoSource } from '../types/liveSessions';

export interface CustomVideoPlayerProps {
  recordingUrl?: string | null;
  streamUrl?: string | null;
  streamSource?: 'external' | 'built_in';
  title?: string;
  autoPlay?: boolean;
  sessionId?: string | number;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  onQualityChange?: (quality: VideoQuality) => void;
}

const AVAILABLE_QUALITIES: VideoQuality[] = ['720p', '480p', '360p', '240p', '144p', 'Auto'];
const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  recordingUrl,
  streamUrl,
  title,
  autoPlay = false,
  sessionId,
  isTheaterMode = false,
  onToggleTheater,
  onQualityChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Source resolution
  const parsedSource: ParsedVideoSource = parseVideoSource(streamUrl || recordingUrl);
  const isEmbed = parsedSource.isValid && (parsedSource.type === 'youtube' || parsedSource.type === 'vimeo');
  const rawVideoUrl = recordingUrl || (parsedSource.type === 'direct' ? streamUrl : null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality>('Auto');

  // UI state
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed'>('main');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [playError, setPlayError] = useState<boolean>(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Construct video source URL with quality query parameter when applicable
  const getQualityVideoUrl = useCallback(
    (quality: VideoQuality) => {
      if (!rawVideoUrl) return '';
      if (quality === 'Auto' || !rawVideoUrl.includes('/recording/stream')) {
        return rawVideoUrl;
      }
      const separator = rawVideoUrl.includes('?') ? '&' : '?';
      return `${rawVideoUrl}${separator}quality=${quality}`;
    },
    [rawVideoUrl]
  );

  const activeVideoSrc = getQualityVideoUrl(selectedQuality);

  // Handle Quality Selection while preserving currentTime and play state
  const handleSelectQuality = (quality: VideoQuality) => {
    if (quality === selectedQuality) {
      setShowSettingsMenu(false);
      return;
    }

    const video = videoRef.current;
    const wasPlaying = video ? !video.paused : false;
    const preservedTime = video ? video.currentTime : currentTime;

    setPlayError(false);
    setSelectedQuality(quality);
    onQualityChange?.(quality);
    setShowSettingsMenu(false);
    setSettingsTab('main');

    if (video) {
      // Re-apply timestamp once metadata loads
      const onLoadedMetadata = () => {
        video.currentTime = preservedTime;
        if (wasPlaying) {
          video.play().catch(() => {});
        }
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
    }
  };

  // Toggle play/pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => setPlayError(true));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Seek handler
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const targetTime = Math.max(0, Math.min(pos * duration, duration));
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Volume handler
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
    setIsMuted(newVol === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const target = !isMuted;
    setIsMuted(target);
    video.muted = target;
  };

  // Speed handler
  const handleSelectSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSettingsMenu(false);
    setSettingsTab('main');
  };

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Controls auto-hide on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsMenu) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);

    // Buffer range
    if (videoRef.current.buffered.length > 0) {
      setBufferedTime(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
    setPlayError(false);
  };

  // 1. EMBED RENDERER (YouTube / Vimeo)
  if (isEmbed && parsedSource.embedUrl) {
    return (
      <div className={`relative w-full overflow-hidden rounded-2xl bg-black shadow-2xl border border-slate-800 transition-all duration-300 ${isTheaterMode ? 'aspect-[21/9] max-h-[75vh]' : 'aspect-video'}`}>
        <iframe
          src={parsedSource.embedUrl}
          title={title || 'Stream Video Event'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  // 2. NO SOURCE AVAILABLE
  if (!rawVideoUrl) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-obsidian-card p-8 text-center">
        <Film className="h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No Stream Video or Clip Available</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          Organizers can upload a video clip (.mp4, .webm) or link a stream URL (YouTube, Vimeo) in the session settings.
        </p>
      </div>
    );
  }

  // 3. CUSTOM VIDEO PLAYER (HTML5 Direct & Uploaded Range Streaming)
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`group relative w-full overflow-hidden rounded-2xl bg-black select-none shadow-2xl border border-slate-800 flex items-center justify-center ${
        isTheaterMode ? 'aspect-[21/9] max-h-[75vh]' : 'aspect-video'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        key={`${sessionId || 'video'}-${activeVideoSrc}`}
        src={activeVideoSrc}
        autoPlay={autoPlay}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setIsBuffering(false);
          setPlayError(true);
        }}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="h-12 w-12 text-cyan-400 animate-spin" />
        </div>
      )}

      {/* Play Error State */}
      {playError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center z-20">
          <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
          <p className="text-sm font-semibold text-white">Playback Error</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Unable to stream this video clip. The file may be converting or unreadable.
          </p>
          <button
            type="button"
            onClick={() => {
              setPlayError(false);
              videoRef.current?.load();
              videoRef.current?.play().catch(() => {});
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition shadow-md"
          >
            <RotateCcw size={14} /> Retry Playback
          </button>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between text-white drop-shadow-md">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {selectedQuality}
            </span>
            {title && <span className="text-xs sm:text-sm font-semibold truncate max-w-md">{title}</span>}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="pointer-events-auto space-y-2">
          {/* Custom Interactive Scrub Bar */}
          <div
            onClick={handleSeek}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              setHoverPosition(pos * duration);
            }}
            onMouseLeave={() => setHoverPosition(null)}
            className="relative h-2 w-full bg-white/20 hover:h-3 rounded-full cursor-pointer transition-all flex items-center group/scrub"
          >
            {/* Buffered Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Played Progress Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full flex items-center justify-end"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md scale-0 group-hover/scrub:scale-100 transition-transform -mr-1.5" />
            </div>

            {/* Hover Tooltip */}
            {hoverPosition !== null && (
              <div
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 text-white text-[10px] font-mono shadow-md pointer-events-none"
                style={{ left: `${(hoverPosition / duration) * 100}%` }}
              >
                {formatTime(hoverPosition)}
              </div>
            )}
          </div>

          {/* Control Buttons Bar */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {/* Play / Pause Button */}
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="text-white hover:text-cyan-400 transition cursor-pointer p-1"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="fill-current" />}
              </button>

              {/* Volume Controls */}
              <div className="flex items-center gap-2 group/vol">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="text-white hover:text-cyan-400 transition cursor-pointer p-1"
                >
                  {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-20 h-1 bg-white/30 accent-cyan-400 rounded-lg cursor-pointer"
                />
              </div>

              {/* Time Display */}
              <span className="text-[11px] sm:text-xs font-mono text-slate-300">
                {formatTime(currentTime)} <span className="text-slate-500">/</span> {formatTime(duration)}
              </span>
            </div>

            <div className="relative flex items-center gap-2 sm:gap-3">
              {/* Theater Mode Toggle */}
              {onToggleTheater && (
                <button
                  type="button"
                  onClick={onToggleTheater}
                  title={isTheaterMode ? 'Standard View' : 'Theater Mode'}
                  className={`text-white hover:text-cyan-400 transition cursor-pointer p-1.5 rounded-lg ${
                    isTheaterMode ? 'bg-white/20 text-cyan-300' : ''
                  }`}
                >
                  <Tv size={18} />
                </button>
              )}

              {/* Settings Dropdown Button (Quality & Speed) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSettingsMenu((prev) => !prev)}
                  title="Player Settings (Quality, Speed)"
                  className={`text-white hover:text-cyan-400 transition cursor-pointer p-1.5 rounded-lg ${
                    showSettingsMenu ? 'bg-white/20 text-cyan-300' : ''
                  }`}
                >
                  <Settings size={18} />
                </button>

                {/* Settings Popover Menu */}
                {showSettingsMenu && (
                  <div className="absolute bottom-10 right-0 w-48 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-2 shadow-2xl text-xs text-white z-30 animate-scale-up">
                    {settingsTab === 'main' && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setSettingsTab('quality')}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                        >
                          <span className="text-slate-300">Quality</span>
                          <span className="font-mono text-cyan-400 font-bold">{selectedQuality} ›</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettingsTab('speed')}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                        >
                          <span className="text-slate-300">Speed</span>
                          <span className="font-mono text-cyan-400 font-bold">{playbackSpeed}x ›</span>
                        </button>
                      </div>
                    )}

                    {settingsTab === 'quality' && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setSettingsTab('main')}
                          className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
                        >
                          ‹ Back to Settings
                        </button>
                        <div className="pt-1 border-t border-slate-800 max-h-48 overflow-y-auto space-y-0.5">
                          {AVAILABLE_QUALITIES.map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => handleSelectQuality(q)}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition cursor-pointer ${
                                selectedQuality === q ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'hover:bg-slate-800 text-slate-300'
                              }`}
                            >
                              <span>{q}</span>
                              {selectedQuality === q && <span className="text-cyan-400">✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {settingsTab === 'speed' && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setSettingsTab('main')}
                          className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
                        >
                          ‹ Back to Settings
                        </button>
                        <div className="pt-1 border-t border-slate-800 space-y-0.5">
                          {PLAYBACK_SPEEDS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleSelectSpeed(s)}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition cursor-pointer ${
                                playbackSpeed === s ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'hover:bg-slate-800 text-slate-300'
                              }`}
                            >
                              <span>{s === 1 ? 'Normal (1x)' : `${s}x`}</span>
                              {playbackSpeed === s && <span className="text-cyan-400">✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                className="text-white hover:text-cyan-400 transition cursor-pointer p-1.5"
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
