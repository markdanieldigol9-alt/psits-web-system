import React from 'react';
import { Film, Radio, Video, CheckCircle2 } from 'lucide-react';
import type { LiveSessionStatus, VideoSourceType } from '../types/liveSessions';

interface VideoStatusBadgeProps {
  status?: LiveSessionStatus;
  sourceType?: VideoSourceType;
  hasRecording?: boolean;
  className?: string;
}

export const VideoStatusBadge: React.FC<VideoStatusBadgeProps> = ({
  status,
  sourceType,
  hasRecording,
  className = '',
}) => {
  if (status === 'live') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <Radio size={12} />
        LIVE STREAM
      </span>
    );
  }

  if (hasRecording || sourceType === 'uploaded') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 ${className}`}
      >
        <Film size={12} />
        RECORDING READY
      </span>
    );
  }

  if (sourceType === 'youtube' || sourceType === 'vimeo' || sourceType === 'direct') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-cyan-400 border border-blue-500/25 ${className}`}
      >
        <Video size={12} />
        {sourceType === 'youtube' ? 'YOUTUBE STREAM' : sourceType === 'vimeo' ? 'VIMEO STREAM' : 'STREAM LINK'}
      </span>
    );
  }

  if (status === 'scheduled') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 ${className}`}
      >
        <CheckCircle2 size={12} />
        UPCOMING
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25 ${className}`}
    >
      SESSION ENDED
    </span>
  );
};
