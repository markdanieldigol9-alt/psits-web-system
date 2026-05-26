import { useState } from 'react';
import { Alert } from '@/shared/components/Common';
import { Button, Input, Select } from '@/shared/components/Form';
import { validateEmail, validatePhoneNumber } from '@/shared/utils/helpers';
import type { MemberType, RegisterData } from '@/shared/types';
import api from '@/shared/services/api';
import { X } from 'lucide-react';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (memberData: any) => void;
  isLoading?: boolean;
}

type AddMemberFormData = Partial<RegisterData> & {
  birthDate?: string;
  renewAccountId?: string;
};

const initialForm: AddMemberFormData = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  memberType: '' as MemberType,
  sector: 'institution',
  sectorDetails: '',
  address: '',
  gender: '',
  occupation: '',
  representativeName: '',
  representativeName2: '',
  position: '',
  representativePosition2: '',
  companyEmail: '',
  website: '',
  contactNumber: '',
  membershipMode: '' as 'new' | 'renew',
  renewAccountId: '',
  birthDate: '',
};

export const AddMemberModal = ({ isOpen, onClose, onSubmit, isLoading = false }: AddMemberModalProps) => {
  const [formData, setFormData] = useState<AddMemberFormData>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const type = formData.memberType;

    if (!type) nextErrors.memberType = 'Member type is required';
    if (!formData.email?.trim()) nextErrors.email = 'Email is required';
    else if (!validateEmail(formData.email)) nextErrors.email = 'Invalid email format';
    
    if (!formData.password) {
      nextErrors.password = 'Password is required';
    } else {
      if (formData.password.length < 10) {
        nextErrors.password = 'Password must be at least 10 characters';
      } else if (!/[A-Z]/.test(formData.password)) {
        nextErrors.password = 'Password must include at least one uppercase letter';
      } else if (!/[a-z]/.test(formData.password)) {
        nextErrors.password = 'Password must include at least one lowercase letter';
      } else if (!/[0-9]/.test(formData.password)) {
        nextErrors.password = 'Password must include at least one number';
      } else if (!/[^\w\s]/.test(formData.password)) {
        nextErrors.password = 'Password must include at least one special character';
      }
    }
    
    if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';

    if (!formData.contactNumber?.trim()) nextErrors.contactNumber = 'Contact number is required';
    else if (!validatePhoneNumber(formData.contactNumber)) nextErrors.contactNumber = 'Invalid phone number';
    if (!formData.address?.trim()) nextErrors.address = 'Address is required';
    if (!formData.membershipMode) nextErrors.membershipMode = 'Membership type is required';
    if (formData.membershipMode === 'renew' && !formData.renewAccountId?.trim()) {
      nextErrors.renewAccountId = 'Previous account email or ID is required for renewal';
    }

    if (type === 'individual') {
      if (!formData.fullName?.trim()) nextErrors.fullName = 'Full name is required';
      if (!formData.gender?.trim()) nextErrors.gender = 'Gender is required';
    }

    if (type === 'institution') {
      if (!formData.sectorDetails?.trim()) nextErrors.sectorDetails = 'Institution name is required';
      if (!formData.representativeName?.trim()) nextErrors.representativeName = 'Representative name is required';
      if (!formData.representativeName2?.trim()) nextErrors.representativeName2 = '2nd representative is required';
      if (!formData.position?.trim()) nextErrors.position = 'Representative 1 position is required';
      if (!formData.representativePosition2?.trim()) nextErrors.representativePosition2 = 'Representative 2 position is required';
      if (!formData.companyEmail?.trim()) nextErrors.companyEmail = 'Institution email is required';
      else if (!validateEmail(formData.companyEmail)) nextErrors.companyEmail = 'Invalid email format';
    }

    if (type === 'industry') {
      if (!formData.sectorDetails?.trim()) nextErrors.sectorDetails = 'Company name is required';
      if (!formData.representativeName?.trim()) nextErrors.representativeName = 'Representative name is required';
      if (!formData.gender?.trim()) nextErrors.gender = 'Gender is required';
      if (!formData.position?.trim()) nextErrors.position = 'Position is required';
      if (!formData.companyEmail?.trim()) nextErrors.companyEmail = 'Company email is required';
      else if (!validateEmail(formData.companyEmail)) nextErrors.companyEmail = 'Invalid email format';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleClose = () => {
    setFormData(initialForm);
    setErrors({});
    setError(null);
    setIsLookingUp(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    let finalSector: 'school' | 'industry' | 'institution' = 'institution';
    if (formData.memberType === 'industry') finalSector = 'industry';
    if (formData.memberType === 'student') finalSector = 'school';

    const fullName =
      String(formData.fullName || '').trim() ||
      String(formData.representativeName || '').trim() ||
      String(formData.sectorDetails || '').trim() ||
      'Member';

    const email = String(formData.email || '').trim();

    try {
      setError(null);
      await onSubmit({
        ...formData,
        fullName,
        email,
        username: String(formData.username || email.split('@')[0] || '').trim(),
        sector: finalSector,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900">Add New Member</h2>
          <button
            onClick={handleClose}
            aria-label="Close modal"
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {error && <Alert type="error" message={error} />}

          <Select
            label="Member Type"
            options={[
              { value: 'individual', label: 'Individual' },
              { value: 'industry', label: 'Industry' },
              { value: 'institution', label: 'Institution' },
            ]}
            value={formData.memberType || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, memberType: e.target.value as MemberType }))}
            error={errors.memberType}
          />

          {formData.memberType === 'individual' && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-2">
              <Input label="Full Name" value={formData.fullName || ''} onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))} error={errors.fullName} />
              <Input label="Email Address" type="email" value={formData.email || ''} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} error={errors.email} />
              <Input label="Birthdate" type="date" value={formData.birthDate || ''} onChange={(e) => setFormData((p) => ({ ...p, birthDate: e.target.value }))} />
              <Select
                label="Gender"
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Prefer not to say', label: 'Prefer not to say' },
                ]}
                value={formData.gender || ''}
                onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value }))}
                error={errors.gender}
              />
              <Input label="Address" value={formData.address || ''} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} error={errors.address} className="md:col-span-2" />
              <Input label="Contact Number" value={formData.contactNumber || ''} onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))} error={errors.contactNumber} />
              <Input label="Password" type="password" value={formData.password || ''} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} error={errors.password} />
              <Input label="Confirm Password" type="password" value={formData.confirmPassword || ''} onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))} error={errors.confirmPassword} />
            </div>
          )}

          {formData.memberType === 'institution' && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-2">
              <Input label="Institution Name" value={formData.sectorDetails || ''} onChange={(e) => setFormData((p) => ({ ...p, sectorDetails: e.target.value }))} error={errors.sectorDetails} />
              <Input label="Institution Address" value={formData.address || ''} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} error={errors.address} />
              <Input label="Institution Email" type="email" value={formData.companyEmail || ''} onChange={(e) => setFormData((p) => ({ ...p, companyEmail: e.target.value, email: p.email || e.target.value }))} error={errors.companyEmail} />
              <Input label="Institution Contact Number" value={formData.contactNumber || ''} onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))} error={errors.contactNumber} />
              <Input label="1st Institution Representative Name" value={formData.representativeName || ''} onChange={(e) => setFormData((p) => ({ ...p, representativeName: e.target.value, fullName: p.fullName || e.target.value }))} error={errors.representativeName} />
              <Input label="Representative 1 Position" value={formData.position || ''} onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))} error={errors.position} />
              <Input label="2nd Institution Representative Name" value={formData.representativeName2 || ''} onChange={(e) => setFormData((p) => ({ ...p, representativeName2: e.target.value }))} error={errors.representativeName2} />
              <Input label="Representative 2 Position" value={formData.representativePosition2 || ''} onChange={(e) => setFormData((p) => ({ ...p, representativePosition2: e.target.value }))} error={errors.representativePosition2} />
              <p className="text-xs text-gray-500 md:col-span-2">Set default password below for the representative account.</p>
              <Input label="Password" type="password" value={formData.password || ''} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} error={errors.password} />
              <Input label="Confirm Password" type="password" value={formData.confirmPassword || ''} onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))} error={errors.confirmPassword} />
            </div>
          )}

          {formData.memberType === 'industry' && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-2">
              <Input label="Company Name" value={formData.sectorDetails || ''} onChange={(e) => setFormData((p) => ({ ...p, sectorDetails: e.target.value }))} error={errors.sectorDetails} />
              <Input label="Company Address" value={formData.address || ''} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} error={errors.address} />
              <Input label="Representative Name" value={formData.representativeName || ''} onChange={(e) => setFormData((p) => ({ ...p, representativeName: e.target.value, fullName: p.fullName || e.target.value }))} error={errors.representativeName} />
              <Select
                label="Gender"
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Prefer not to say', label: 'Prefer not to say' },
                ]}
                value={formData.gender || ''}
                onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value }))}
                error={errors.gender}
              />
              <Input label="Contact Number" value={formData.contactNumber || ''} onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))} error={errors.contactNumber} />
              <Input label="Position" value={formData.position || ''} onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))} error={errors.position} />
              <Input label="Company Email" type="email" value={formData.companyEmail || ''} onChange={(e) => setFormData((p) => ({ ...p, companyEmail: e.target.value, email: p.email || e.target.value }))} error={errors.companyEmail} />
              <Input label="Company Website (Optional)" value={formData.website || ''} onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))} />
              <Input label="Password" type="password" value={formData.password || ''} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} error={errors.password} />
              <Input label="Confirm Password" type="password" value={formData.confirmPassword || ''} onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))} error={errors.confirmPassword} />
            </div>
          )}

          <Select
            label="Membership Type (New, Renew)"
            options={[
              { value: 'new', label: 'New' },
              { value: 'renew', label: 'Renew' },
            ]}
            value={formData.membershipMode || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                membershipMode: e.target.value as 'new' | 'renew',
              }))
            }
            error={errors.membershipMode}
          />

          {formData.membershipMode === 'renew' && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-3">
              <Input
                required
                label="Previous Account ID or Email"
                value={formData.renewAccountId || ''}
                onChange={(e) => setFormData((p) => ({ ...p, renewAccountId: e.target.value }))}
                error={errors.renewAccountId}
                helperText="Use this to pull existing account details for renewal."
                className="md:col-span-2"
              />
              <Button
                type="button"
                variant="outline"
                className="mt-6"
                isLoading={isLookingUp}
                disabled={isLoading}
                onClick={async () => {
                  if (!formData.renewAccountId?.trim() || !formData.contactNumber?.trim()) {
                    setErrors((prev) => ({
                      ...prev,
                      renewAccountId: formData.renewAccountId?.trim() ? '' : 'Previous Account Email or ID is required',
                      contactNumber: formData.contactNumber?.trim() ? '' : 'Contact number is required for lookup',
                    }));
                    return;
                  }

                  setIsLookingUp(true);
                  try {
                    const { data } = await api.renewLookup({
                      renewAccountId: formData.renewAccountId.trim(),
                      contactNumber: formData.contactNumber.trim(),
                    });
                    if (data?.member) {
                      const m = data.member;
                      setFormData((prev) => ({
                        ...prev,
                        fullName: prev.fullName || m.fullName || '',
                        email: prev.email || m.email || '',
                        sector: (m.sector || prev.sector) as any,
                        sectorDetails: prev.sectorDetails || m.sectorDetails || '',
                        memberType: (m.memberType || prev.memberType) as MemberType,
                        address: prev.address || m.address || '',
                        gender: prev.gender || m.gender || '',
                        occupation: prev.occupation || m.occupation || '',
                        representativeName: prev.representativeName || m.representativeName || '',
                        representativeName2: prev.representativeName2 || m.representativeName2 || '',
                        position: prev.position || m.position || '',
                        representativePosition2: prev.representativePosition2 || m.representativePosition2 || '',
                        companyEmail: prev.companyEmail || m.companyEmail || '',
                        website: prev.website || m.website || '',
                      }));
                      setError(null);
                    } else {
                      setError('No matching account found.');
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Lookup failed.');
                  } finally {
                    setIsLookingUp(false);
                  }
                }}
              >
                Lookup
              </Button>
            </div>
          )}

          <div className="flex gap-3 border-t border-gray-200 pt-6">
            <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="flex-1">
              {isLoading ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
