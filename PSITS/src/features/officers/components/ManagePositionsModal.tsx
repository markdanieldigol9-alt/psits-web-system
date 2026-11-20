import { useEffect, useState } from 'react';
import { Input, Button, TextArea } from '@/shared/components/Form';
import { Alert, Badge, Modal } from '@/shared/components/Common';
import api from '@/shared/services/api';
import { getPositionRank } from '@/shared/utils/helpers';
import { useAuth } from '@/shared/context/AuthContext';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';

interface ManagePositionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPositionsChange?: () => void;
}

export type OfficerPositionItem = {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt?: string;
};

/**
 * ManagePositionsModal Component
 * Purpose: Allows Administrators & Super Admins to view, create, and remove custom officer positions.
 * Debugging: Displays list of positions with default/custom tags. Deletion is validated server-side.
 */
export const ManagePositionsModal = ({
  isOpen,
  onClose,
  onPositionsChange,
}: ManagePositionsModalProps) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const [positions, setPositions] = useState<OfficerPositionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OfficerPositionItem | null>(null);

  const loadPositions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.getOfficerPositions();
      if (data?.success) {
        const sorted = (data.positions || []).toSorted((a: OfficerPositionItem, b: OfficerPositionItem) => {
          const rankA = getPositionRank(a.name);
          const rankB = getPositionRank(b.name);
          if (rankA !== rankB) return rankA - rankB;
          return a.name.localeCompare(b.name);
        });
        setPositions(sorted);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load officer positions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadPositions();
      setNewName('');
      setNewDesc('');
      setShowAddForm(false);
      setError(null);
      setSuccessMsg(null);
      setDeleteTarget(null);
    }
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError('Position name is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data } = await api.createOfficerPosition({ name, description: newDesc.trim() || undefined });
      if (data?.success) {
        setSuccessMsg(`Position "${name}" created successfully.`);
        setNewName('');
        setNewDesc('');
        setShowAddForm(false);
        await loadPositions();
        if (onPositionsChange) onPositionsChange();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create officer position.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (pos: OfficerPositionItem) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data } = await api.deleteOfficerPosition(pos.id);
      if (data?.success) {
        setSuccessMsg(`Position "${pos.name}" deleted successfully.`);
        setDeleteTarget(null);
        await loadPositions();
        if (onPositionsChange) onPositionsChange();
      }
    } catch (err: any) {
      setError(err.message || `Failed to delete position "${pos.name}".`);
      setDeleteTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Officer Positions"
      subtitle="Define custom officer titles for your organization"
      size="md"
    >
      <div className="space-y-4">
        {error && <Alert type="error" message={error} />}
        {successMsg && <Alert type="success" message={successMsg} />}

        {/* Add position section toggle */}
        {!showAddForm ? (
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
              Available Positions ({positions.length})
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowAddForm(true);
                setError(null);
                setSuccessMsg(null);
              }}
            >
              <Plus size={16} />
              Create Position
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="p-4 rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200">Create New Position</h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
            <Input
              label="Position Title *"
              placeholder="e.g., Public Relations Officer, Auditor, Event Coordinator"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <TextArea
              label="Description (Optional)"
              placeholder="Briefly describe the responsibilities of this position..."
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc((e.target as HTMLTextAreaElement).value)}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowAddForm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                Save Position
              </Button>
            </div>
          </form>
        )}

        {/* Positions List */}
        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">Loading positions...</div>
        ) : positions.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">No officer positions found.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800 rounded-lg border border-gray-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-obsidian-card">
            {positions.map((pos) => (
              <div
                key={pos.id}
                className="p-3.5 flex items-start justify-between hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{pos.name}</span>
                    {pos.isDefault ? (
                      <Badge variant="info">Default</Badge>
                    ) : (
                      <Badge variant="success">Custom</Badge>
                    )}
                  </div>
                  {pos.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{pos.description}</p>
                  )}
                </div>

                {!pos.isDefault && isAdmin && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(pos)}
                    disabled={isSubmitting}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                    title={`Delete "${pos.name}" position`}
                    aria-label={`Delete ${pos.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Sub-Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => { if (!isSubmitting) setDeleteTarget(null); }}
        title="Delete Position?"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <ShieldAlert size={24} />
            <span className="text-sm font-semibold">Confirm Permanent Removal</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to delete the officer position <strong className="text-gray-900 dark:text-white">"{deleteTarget?.name}"</strong>?
            This action cannot be undone if no officers are currently assigned to it.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
              isLoading={isSubmitting}
            >
              Delete Position
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
};
