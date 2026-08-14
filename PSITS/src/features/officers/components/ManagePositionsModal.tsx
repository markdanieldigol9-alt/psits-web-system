import { useEffect, useState } from 'react';
import { Input, Button, TextArea } from '@/shared/components/Form';
import { Alert, Badge } from '@/shared/components/Common';
import api from '@/shared/services/api';
import { X, Plus, Trash2, ShieldAlert } from 'lucide-react';

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

export const ManagePositionsModal = ({
  isOpen,
  onClose,
  onPositionsChange,
}: ManagePositionsModalProps) => {
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
        setPositions(data.positions || []);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full mx-auto max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage Officer Positions</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Define custom officer titles for your organization
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && <Alert type="error" message={error} />}
          {successMsg && <Alert type="success" message={successMsg} />}

          {/* Add position section toggle */}
          {!showAddForm ? (
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">
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
            <form onSubmit={handleCreate} className="p-4 rounded-lg border border-blue-100 bg-blue-50/40 space-y-3">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-bold text-blue-900">Create New Position</h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
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
            <div className="py-8 text-center text-sm text-gray-500">Loading positions...</div>
          ) : positions.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No officer positions found.</div>
          ) : (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden bg-white">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className="p-3.5 flex items-start justify-between hover:bg-gray-50/80 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{pos.name}</span>
                      {pos.isDefault ? (
                        <Badge variant="info">Default</Badge>
                      ) : (
                        <Badge variant="success">Custom</Badge>
                      )}
                    </div>
                    {pos.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">{pos.description}</p>
                    )}
                  </div>

                  {!pos.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(pos)}
                      disabled={isSubmitting}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title={`Delete "${pos.name}" position`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200 bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Sub-Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <ShieldAlert size={24} />
              <h3 className="text-lg font-bold text-gray-900">Delete Position?</h3>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete the officer position <strong className="text-gray-900">"{deleteTarget.name}"</strong>?
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
                onClick={() => void handleDelete(deleteTarget)}
                isLoading={isSubmitting}
              >
                Delete Position
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
