import { useState } from 'react';
import { Input, Button, Select } from '@/shared/components/Form';
import { Alert } from '@/shared/components/Common';
import { validateEmail } from '@/shared/utils/helpers';
import { X } from 'lucide-react';

interface AddPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

export const AddPartnerModal = ({ isOpen, onClose, onSubmit, isLoading = false }: AddPartnerModalProps) => {
  const [formData, setFormData] = useState({
    company: '',
    type: '' as string,
    contactPerson: '',
    location: '',
    email: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.company) newErrors.company = 'Company name is required';
    if (!formData.type) newErrors.type = 'Partnership type required';
    if (!formData.contactPerson) newErrors.contactPerson = 'Contact person required';
    if (!formData.location) newErrors.location = 'Location required';
    if (!formData.email) newErrors.email = 'Email required';
    else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email';
    if (!formData.phone) newErrors.phone = 'Phone required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setError(null);
      await onSubmit(formData);
      setFormData({ company:'', type:'', contactPerson:'', location:'', email:'', phone:'' });
      setErrors({});
      onClose();
    } catch (err:any) {
      setError(err.message || 'Failed to add partner');
    }
  };




  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Add New Partner</h2>
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
            <Input
              label="Company Name"
              placeholder="Enter company name"
              value={formData.company}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, company: e.target.value })
              }
              error={errors.company}
            />
            <Select
              label="Partnership Type"
              options={[
                { value: 'Technology', label: 'Technology Partner' },
                { value: 'Industry', label: 'Industry Partner' },
                { value: 'Academic', label: 'Academic Partner' },
              ]}
              value={formData.type}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, type: e.target.value })
              }
              error={errors.type}
            />
            <Input
              label="Contact Person"
              placeholder="Enter contact name"
              value={formData.contactPerson}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, contactPerson: e.target.value })
              }
              error={errors.contactPerson}
            />
            <Input
              label="Location"
              placeholder="Enter location"
              value={formData.location}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, location: e.target.value })
              }
              error={errors.location}
            />
            <Input
              label="Email"
              type="email"
              placeholder="Enter email"
              value={formData.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, email: e.target.value })
              }
              error={errors.email}
            />
            <Input
              label="Phone"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              error={errors.phone}
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="primary" size="lg" type="submit" disabled={isLoading}>{isLoading ? 'Adding...' : 'Add Partner'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
