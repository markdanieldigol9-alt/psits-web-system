import { useEffect, useState } from 'react';
import { Input, Button, Select } from '@/shared/components/Form';
import { Alert } from '@/shared/components/Common';
import api from '@/shared/services/api';
import { X } from 'lucide-react';

interface AddOfficerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
  initialPosition?: string;
  lockPosition?: boolean;
  title?: string;
}

type MemberOption = {
  id: string;
  fullName: string;
  email: string;
  sector?: string;
  status?: string;
};

export const AddOfficerModal = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  initialPosition,
  lockPosition = false,
  title,
}: AddOfficerModalProps) => {
  const [formData, setFormData] = useState({
    position: '',
    startDate: '',
  });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [error, setError] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<MemberOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null);
  const [takenPositions, setTakenPositions] = useState<Set<string>>(new Set());

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedMember) newErrors.member = 'Select a member';
    if (!formData.position) newErrors.position = 'Position is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialPosition) {
      setFormData((p) => ({ ...p, position: initialPosition }));
    }
  }, [isOpen, initialPosition]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedMember) return;

    const q = memberQuery.trim();
    if (q.length < 2) {
      setMemberResults([]);
      setIsSearching(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.getMembers({ search: q, status: 'active' });
        const members = (data?.members || []) as any[];
        const normalized: MemberOption[] = members
          .map((m) => ({
            id: String(m.id),
            fullName: String(m.fullName || ''),
            email: String(m.email || ''),
            sector: m.sector,
            status: m.status,
          }))
          .filter((m) => m.fullName && m.email);
        setMemberResults(normalized.slice(0, 8));
      } catch {
        setMemberResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(handle);
    };
  }, [isOpen, memberQuery, selectedMember]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadPositions = async () => {
      try {
        const { data } = await api.getOfficers();
        const officers = (data?.officers || []) as any[];
        const active = officers.filter((o) => o.status === 'active');
        const positions = new Set(active.map((o) => String(o.position || '').trim()).filter(Boolean));
        if (!cancelled) setTakenPositions(positions);
      } catch {
        if (!cancelled) setTakenPositions(new Set());
      }
    };

    void loadPositions();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setError(null);
      await onSubmit({ userId: selectedMember!.id, position: formData.position, startDate: formData.startDate || undefined });
      // reset
      setFormData({ position: '', startDate: '' });
      setErrors({});
      setMemberQuery('');
      setMemberResults([]);
      setSelectedMember(null);
      onClose();
    } catch (err:any) {
      setError(err.message || 'Failed to add officer');
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{title || 'Assign Officer Position'}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <Alert type="error" message={error} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="w-full md:col-span-2 relative">
              <Input
                label="Member (Search)"
                placeholder="Search by full name or email..."
                value={selectedMember ? `${selectedMember.fullName} (${selectedMember.email})` : memberQuery}
                onChange={(e) => {
                  if (selectedMember) return;
                  setMemberQuery(e.target.value);
                  setErrors((prev) => ({ ...prev, member: '' }));
                }}
                onFocus={() => {
                  if (!selectedMember && memberQuery.trim().length >= 2) {
                    // keep dropdown visible when focused
                    setMemberResults((prev) => prev);
                  }
                }}
                readOnly={!!selectedMember}
                error={errors.member}
                helperText={selectedMember ? 'Selected member will be promoted to officer.' : 'Type at least 2 characters.'}
              />

              {selectedMember && (
                <button
                  type="button"
                  className="mt-2 text-sm text-primary hover:underline"
                  onClick={() => {
                    setSelectedMember(null);
                    setMemberQuery('');
                    setMemberResults([]);
                  }}
                >
                  Change selected member
                </button>
              )}

              {!selectedMember && (isSearching || memberResults.length > 0) && (
                <div className="absolute z-10 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-auto">
                  {isSearching && (
                    <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                  )}
                  {!isSearching && memberResults.length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500">No active members found.</div>
                  )}
                  {!isSearching &&
                    memberResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-gray-50"
                        onClick={() => {
                          setSelectedMember(m);
                          setMemberQuery('');
                          setMemberResults([]);
                          setErrors((prev) => ({ ...prev, member: '' }));
                        }}
                      >
                        <div className="text-sm font-medium text-gray-900">{m.fullName}</div>
                        <div className="text-xs text-gray-600">{m.email}</div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <Select
              label="Position"
              options={[
                { value: 'President', label: takenPositions.has('President') ? 'President (Assigned)' : 'President' },
                { value: 'Vice President', label: takenPositions.has('Vice President') ? 'Vice President (Assigned)' : 'Vice President' },
                { value: 'Treasurer', label: takenPositions.has('Treasurer') ? 'Treasurer (Assigned)' : 'Treasurer' },
                { value: 'Secretary', label: takenPositions.has('Secretary') ? 'Secretary (Assigned)' : 'Secretary' },
                { value: 'Member', label: takenPositions.has('Member') ? 'Member (Assigned)' : 'Member' }
              ]}
              value={formData.position}
              onChange={(e) => {
                if (lockPosition) return;
                if (takenPositions.has(e.target.value)) {
                  setErrors((prev) => ({ ...prev, position: 'Position already assigned.' }));
                  return;
                }
                setErrors((prev) => ({ ...prev, position: '' }));
                setFormData({ ...formData, position: e.target.value });
              }}
              disabled={lockPosition}
              error={errors.position}
            />
            {takenPositions.size > 0 && (
              <p className="text-xs text-gray-500 md:col-span-2">Positions marked as assigned are unavailable until cleared.</p>
            )}
            {lockPosition && (
              <p className="text-xs text-gray-500 md:col-span-2">Position is locked for this change.</p>
            )}

            <Input
              label="Service Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              helperText="Optional. Leave blank to use today."
            />

            <Input
              label="Email"
              placeholder="Select a member first"
              value={selectedMember?.email || ''}
              readOnly
              className="bg-gray-50"
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="primary" size="lg" type="submit" disabled={isLoading}>{isLoading ? 'Assigning...' : 'Assign Officer'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
