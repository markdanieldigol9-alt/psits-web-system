import { useRef } from 'react';
import { Modal } from '@/shared/components/Common';
import { Button, Input, TextArea } from '@/shared/components/Form';
import type { LiveSession, LiveSessionFormState } from '@/features/live-events/types/liveSessions';
import { Film, Upload, X, Clock, CheckCircle2 } from 'lucide-react';

type LiveSessionModalProps = {
  isOpen: boolean;
  editing: LiveSession | null;
  formData: LiveSessionFormState;
  formErrors: Partial<Record<keyof LiveSessionFormState | 'videoFile', string>>;
  eventOptions: Array<{ id: string; title: string }>;
  videoFile: File | null;
  onVideoFileChange: (file: File | null) => void;
  isUploading: boolean;
  uploadProgress: number;
  onClose: () => void;
  onChange: (patch: Partial<LiveSessionFormState>) => void;
  onSubmit: () => void;
};

const ToggleRow = ({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) => (
  <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 cursor-pointer">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? 'bg-primary' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  </label>
);

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function LiveSessionModal({
  isOpen,
  editing,
  formData,
  formErrors,
  eventOptions,
  videoFile,
  onVideoFileChange,
  isUploading,
  uploadProgress,
  onClose,
  onChange,
  onSubmit,
}: LiveSessionModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      onVideoFileChange(null);
      return;
    }
    const validVideoExts = ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi'];
    const fileExt = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isVideo = file.type.startsWith('video/') || validVideoExts.includes(fileExt);
    if (!isVideo) {
      alert('Only video clips (.mp4, .webm, .mov, etc.) are allowed.');
      return;
    }
    onVideoFileChange(file);
  };

  return (
    <Modal
      title={editing ? 'Edit Recorded Video Event' : 'Upload Recorded Video Event'}
      isOpen={isOpen}
      onClose={isUploading ? () => {} : onClose}
      size="lg"
    >
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900">Video Information</h4>
            <p className="mt-1 text-sm text-gray-600">Provide details for this recorded event video or clip.</p>
          </div>

          <Input
            label="Video Title"
            value={formData.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g., PSITS Region XII General Assembly Highlights"
            helperText={formErrors.title}
          />

          <TextArea
            label="Description"
            value={formData.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Add summary, agenda covered, or remarks about this recorded video"
            rows={3}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Linked Event (Optional)</label>
              <select
                value={formData.eventId}
                onChange={(e) => onChange({ eventId: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">Select an event (Optional)</option>
                {eventOptions.map((event) => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>
            </div>

            <Input
              label="Host / Uploader"
              value={formData.hostLabel}
              onChange={(e) => onChange({ hostLabel: e.target.value })}
              placeholder="e.g., Admin / President"
            />
          </div>
        </div>

        {/* Video Clip Upload Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Film size={18} className="text-primary" />
              Video Clip
            </h4>
            <p className="mt-1 text-sm text-gray-600">
              Upload the recorded video or clip (.mp4, .webm, .mov).
            </p>
          </div>

          {editing?.recordingUrl && !videoFile && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-blue-600 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-blue-900">Current Video Available</div>
                  <div className="text-xs text-blue-700">
                    {editing.recordingExpiresAt
                      ? `Expires: ${new Date(editing.recordingExpiresAt).toLocaleDateString()} (1-month retention)`
                      : 'Stored for 1 month'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-primary hover:underline bg-white border border-primary/30 px-3 py-1.5 rounded-lg"
              >
                Replace Video
              </button>
            </div>
          )}

          {videoFile ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Film size={24} className="text-green-600 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-green-900 truncate max-w-[280px] sm:max-w-md">
                    {videoFile.name}
                  </div>
                  <div className="text-xs text-green-700">
                    {formatBytes(videoFile.size)} • Ready to upload
                  </div>
                </div>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => onVideoFileChange(null)}
                  className="p-1.5 rounded-lg hover:bg-green-100 text-green-700"
                  aria-label="Remove selected video"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-primary hover:bg-gray-50/50 cursor-pointer transition ${
                formErrors.videoFile ? 'border-red-400 bg-red-50/30' : ''
              }`}
            >
              <Upload size={32} className="mx-auto text-gray-400" />
              <div className="mt-2 text-sm font-semibold text-gray-700">
                Click to browse or drop your video clip here
              </div>
              <p className="mt-1 text-xs text-gray-500">
                MP4, WebM, MOV video files only
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              e.currentTarget.value = '';
              handleFileSelect(file);
            }}
          />

          {formErrors.videoFile && (
            <p className="text-xs text-red-600 font-medium">{formErrors.videoFile}</p>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex items-start gap-2.5 text-xs text-amber-900">
            <Clock size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">1-Month Storage Policy: </span>
              Uploaded video clips are stored on the server for <strong>1 month</strong>. After 1 month, the video file will be permanently deleted automatically.
            </div>
          </div>
        </div>

        {/* Access Control */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900">Access & Comments</h4>
            <p className="mt-1 text-sm text-gray-600">Control who can view this video event and allow discussions.</p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Visibility</label>
            <select
              value={formData.privacy}
              onChange={(e) => onChange({ privacy: e.target.value as LiveSessionFormState['privacy'] })}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="public">Public (All Users)</option>
              <option value="private">Private (Admins & Officers Only)</option>
              <option value="event_registered_only">Event Registered Only</option>
            </select>
          </div>

          <ToggleRow
            label="Allow User Comments & Discussion"
            checked={formData.allowChat}
            onToggle={() => onChange({ allowChat: !formData.allowChat })}
          />
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
              <span>Uploading video clip...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row">
          <Button
            variant="outline"
            size="lg"
            className="sm:flex-1"
            disabled={isUploading}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="sm:flex-1"
            disabled={isUploading}
            onClick={onSubmit}
          >
            {isUploading ? `Uploading (${uploadProgress}%)` : editing ? 'Save Changes' : 'Upload Video Event'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
