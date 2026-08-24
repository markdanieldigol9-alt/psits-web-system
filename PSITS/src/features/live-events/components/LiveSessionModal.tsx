import { Modal } from '@/shared/components/Common';
import { Button, Input, TextArea } from '@/shared/components/Form';
import type { LiveSession, LiveSessionFormState, LiveSessionStatus } from '@/features/live-events/types/liveSessions';

// removed unused helper function

type LiveSessionModalProps = {
  isOpen: boolean;
  editing: LiveSession | null;
  formData: LiveSessionFormState;
  formErrors: Partial<Record<keyof LiveSessionFormState | 'schedule', string>>;
  eventOptions: Array<{ id: string; title: string }>;
  onClose: () => void;
  onChange: (patch: Partial<LiveSessionFormState>) => void;
  onSaveDraft: () => void;
  onCreate: () => void;
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
  <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
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

export function LiveSessionModal({
  isOpen,
  editing,
  formData,
  formErrors,
  eventOptions,
  onClose,
  onChange,
  onSaveDraft,
  onCreate,
}: LiveSessionModalProps) {
  // const streamPreview = toYouTubeEmbedUrl(formData.streamUrl);

  return (
    <Modal
      title={editing ? 'Edit Live Session' : 'Create Live Session'}
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">Basic Information</h4>
                <p className="mt-1 text-sm text-gray-600">Define the session identity, event link, and host ownership.</p>
              </div>

              <Input
                label="Session Title"
                value={formData.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="e.g., PSITS Region XII General Assembly"
                helperText={formErrors.title}
              />

              <TextArea
                label="Description"
                value={formData.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Add agenda, session purpose, or moderation notes"
                rows={3}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Linked Event</label>
                  <select
                    value={formData.eventId}
                    onChange={(e) => onChange({ eventId: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select an event</option>
                    {eventOptions.map((event) => (
                      <option key={event.id} value={event.id}>{event.title}</option>
                    ))}
                  </select>
                  {formErrors.eventId && <p className="text-xs text-red-600">{formErrors.eventId}</p>}
                </div>
              </div>

              <Input
                label="Host Label / Hosted By"
                value={formData.hostLabel}
                onChange={(e) => onChange({ hostLabel: e.target.value })}
                placeholder="e.g., Admin / President"
              />

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Stream Source</label>
                <div className="flex rounded-xl bg-gray-100 p-1 max-w-sm">
                  <button
                    type="button"
                    onClick={() => onChange({ streamSource: 'external' })}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${formData.streamSource === 'external' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    External URL
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ streamSource: 'built_in' })}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${formData.streamSource === 'built_in' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Built-In Studio
                  </button>
                </div>
              </div>

              {formData.streamSource === 'external' ? (
                <Input
                  label="Stream URL"
                  value={formData.streamUrl}
                  onChange={(e) => onChange({ streamUrl: e.target.value })}
                  placeholder="e.g., https://youtu.be/... or https://www.youtube.com/watch?v=..."
                  helperText={formErrors.streamUrl}
                />
              ) : (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
                  <strong>Built-In Studio selected.</strong> You will be able to go live using your camera, share your screen, or play a pre-recorded scene directly from the system after creating the session.
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => onChange({ status: e.target.value as LiveSessionStatus })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="live">Live</option>
                  <option value="ended">Ended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">Access Control</h4>
                <p className="mt-1 text-sm text-gray-600">Choose who can view the session and whether chat is enabled.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Privacy</label>
                <select
                  value={formData.privacy}
                  onChange={(e) => onChange({ privacy: e.target.value as LiveSessionFormState['privacy'] })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="event_registered_only">Event Registered Only</option>
                </select>
                {formErrors.privacy && <p className="text-xs text-red-600">{formErrors.privacy}</p>}
              </div>

              <ToggleRow label="Allow Chat" checked={formData.allowChat} onToggle={() => onChange({ allowChat: !formData.allowChat })} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">Auto-Generated Session Details</h4>
                <p className="mt-1 text-sm text-gray-600">These are generated inside the system and stored with the live session.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input label="Room Code" value={formData.roomCode} readOnly />
                <Input label="Session ID" value={formData.sessionId} readOnly />
                <Input label="Join Link" value={formData.joinLink} readOnly />
                <Input label="Internal Session Token" value={formData.sessionToken} readOnly />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">Optional Recording</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Upload a session recording after the stream ends. Recordings are stored for <span className="font-semibold">15 days</span>, then auto-deleted.
                  You can download it anytime within the retention window.
                </p>
              </div>

              <ToggleRow label="Enable Recording (15-day retention)" checked={formData.recordingEnabled} onToggle={() => onChange({ recordingEnabled: !formData.recordingEnabled })} />

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Recording Visibility</label>
                <select
                  value={formData.recordingVisibility}
                  disabled={!formData.recordingEnabled}
                  onChange={(e) => onChange({ recordingVisibility: e.target.value as LiveSessionFormState['recordingVisibility'] })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                >
                  <option value="host_only">Host Only</option>
                  <option value="registered_members">Registered Members</option>
                  <option value="public_replay">Public Replay</option>
                </select>
              </div>
            </div>


        <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row">
          <Button variant="outline" size="lg" className="sm:flex-1" onClick={onSaveDraft}>
            Save Draft
          </Button>
          <Button variant="primary" size="lg" className="sm:flex-1" onClick={onCreate}>
            {editing ? 'Update Session' : 'Create Session'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
