import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/shared/layouts';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { Alert } from '@/shared/components/Common';
import { Button, Input, Select } from '@/shared/components/Form';
import { validateEmail, validatePhoneNumber } from '@/shared/utils/helpers';
import type { MemberType, RegisterData } from '@/shared/types';

type RegisterFormData = RegisterData & {
  birthDate?: string;
};

export const RegisterPage = () => {
  const { register, isLoading, error } = useAuth();
  const { addNotification } = useNotification();

  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: '',
    username: '',
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
    paymentProof: '',
    referenceNumber: '',
    termsAccepted: false,
    birthDate: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  // Renewal is handled inside the system after account creation (Settings → Membership).

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const type = formData.memberType;
    const passwordValue = formData.password || '';
    const namePattern = /^[A-Za-z\s.'-]+$/;

    if (!type) nextErrors.memberType = 'Member type is required';

    if (!formData.email.trim()) nextErrors.email = 'Email address is required';
    else if (!validateEmail(formData.email)) nextErrors.email = 'Invalid email address';

    if (!formData.contactNumber.trim()) nextErrors.contactNumber = 'Contact number is required';
    else if (!validatePhoneNumber(formData.contactNumber)) nextErrors.contactNumber = 'Invalid contact number';

    if (!formData.address?.trim()) nextErrors.address = 'Address is required';
    if (!passwordValue) nextErrors.password = 'Password is required';
    else if (passwordValue.length < 10) nextErrors.password = 'Password must be at least 10 characters';
    else if (!/[A-Z]/.test(passwordValue)) nextErrors.password = 'Password must include at least one uppercase letter';
    else if (!/[a-z]/.test(passwordValue)) nextErrors.password = 'Password must include at least one lowercase letter';
    else if (!/[0-9]/.test(passwordValue)) nextErrors.password = 'Password must include at least one number';
    else if (!/[^\w\s]/.test(passwordValue)) nextErrors.password = 'Password must include at least one special character';
    if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    if (!formData.paymentProof) nextErrors.paymentProof = 'Payment proof is required';
    if (!formData.referenceNumber?.trim()) nextErrors.referenceNumber = 'Reference number is required';
    if (!formData.termsAccepted) nextErrors.termsAccepted = 'You must accept the terms and conditions';

    if (type === 'individual') {
      if (!formData.fullName.trim()) nextErrors.fullName = 'Full name is required';
      else if (!namePattern.test(formData.fullName.trim())) nextErrors.fullName = 'Full name must contain letters only';
      if (!formData.gender?.trim()) nextErrors.gender = 'Gender is required';
      if (!formData.birthDate?.trim()) nextErrors.birthDate = 'Birthdate is required';
      if (formData.birthDate) {
        const birth = new Date(`${formData.birthDate}T00:00:00`);
        if (!Number.isNaN(birth.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age -= 1;
          }
          if (age < 16) nextErrors.birthDate = 'Individual membership requires age 16 or older';
        }
      }
    }

    if (type === 'institution') {
      if (!formData.sectorDetails?.trim()) nextErrors.sectorDetails = 'Institution name is required';
      if (!formData.representativeName?.trim()) nextErrors.representativeName = 'Representative name is required';
      else if (!namePattern.test(formData.representativeName.trim())) nextErrors.representativeName = 'Representative name must contain letters only';
      if (!formData.representativeName2?.trim()) nextErrors.representativeName2 = '2nd representative is required';
      else if (!namePattern.test(formData.representativeName2.trim())) nextErrors.representativeName2 = '2nd representative must contain letters only';
      if (!formData.position?.trim()) nextErrors.position = 'Representative 1 position is required';
      if (!formData.representativePosition2?.trim()) nextErrors.representativePosition2 = 'Representative 2 position is required';
      if (!formData.companyEmail?.trim()) nextErrors.companyEmail = 'Institution email is required';
      else if (!validateEmail(formData.companyEmail)) nextErrors.companyEmail = 'Invalid email address';
    }

    if (type === 'industry') {
      if (!formData.sectorDetails?.trim()) nextErrors.sectorDetails = 'Company name is required';
      if (!formData.representativeName?.trim()) nextErrors.representativeName = 'Representative name is required';
      else if (!namePattern.test(formData.representativeName.trim())) nextErrors.representativeName = 'Representative name must contain letters only';
      if (!formData.gender?.trim()) nextErrors.gender = 'Gender is required';
      if (!formData.position?.trim()) nextErrors.position = 'Position is required';
      if (!formData.companyEmail?.trim()) nextErrors.companyEmail = 'Company email is required';
      else if (!validateEmail(formData.companyEmail)) nextErrors.companyEmail = 'Invalid email address';
      if (formData.website && !/^https?:\/\//i.test(formData.website)) {
        nextErrors.website = 'Website must start with http:// or https://';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, paymentProof: 'File must be 8MB or below' }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, paymentProof: String(reader.result || '') }));
      setErrors((prev) => ({ ...prev, paymentProof: '' }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!validateForm()) return;

    let sector: 'school' | 'industry' | 'institution' = 'institution';
    if (formData.memberType === 'industry') sector = 'industry';
    if (formData.memberType === 'student') sector = 'school';

    const fallbackFullName =
      formData.fullName.trim() ||
      formData.representativeName?.trim() ||
      formData.sectorDetails?.trim() ||
      'Member';

    try {
      await register({
        ...formData,
        fullName: fallbackFullName,
        username: formData.username?.trim() || formData.email.split('@')[0].trim(),
        email: formData.email.trim(),
        sector,
      });

      const successMessage =
        'Your registration is successful. You will be notified once admin approves your account.';

      addNotification({
        userId: 'current',
        title: 'Registration Submitted',
        message: successMessage,
        type: 'success',
        isRead: false,
      });

      setSubmitSuccess(successMessage);
      setFormData({
        fullName: '',
        username: '',
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
        paymentProof: '',
        referenceNumber: '',
        termsAccepted: false,
        birthDate: '',
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed.');
    }
  };

  return (
    <AuthLayout title="Registration Page">
      <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-6xl mx-auto">
        {submitSuccess && <Alert type="success" message={submitSuccess} />}
        {!submitSuccess && (submitError || error) && <Alert type="error" message={submitError || error || 'Registration failed.'} />}

        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900">Member Information</h3>
          <p className="mt-1 text-sm text-gray-600">Choose member type to show required fields. Fields marked with <span className="text-red-500">*</span> are required.</p>
        </div>

        <Select
          label="Member Type"
          required
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
            <Input label="Full Name" required value={formData.fullName} onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))} error={errors.fullName} />
            <Input label="Email Address" required type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} error={errors.email} />
            <Input
              label="Birthdate"
              required
              type="date"
              value={formData.birthDate || ''}
              onChange={(e) => setFormData((p) => ({ ...p, birthDate: e.target.value }))}
              error={errors.birthDate}
              helperText="Must be age 16 or older."
            />
            <Select
              label="Gender"
              required
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]}
              value={formData.gender || ''}
              onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value }))}
              error={errors.gender}
            />
            <Input label="Address" required value={formData.address || ''} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} error={errors.address} className="md:col-span-2" />
            <Input label="Contact Number" required value={formData.contactNumber} onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))} error={errors.contactNumber} />
            <Input label="Password" required type="password" value={formData.password || ''} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} error={errors.password} helperText="At least 10 characters, 1 uppercase, 1 lowercase, 1 number, 1 special." />
            <Input label="Confirm Password" required type="password" value={formData.confirmPassword || ''} onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))} error={errors.confirmPassword} />
          </div>
        )}

        {formData.memberType === 'institution' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
            <Input label="Institution Name" required value={formData.sectorDetails || ''} onChange={(e) => setFormData((p) => ({ ...p, sectorDetails: e.target.value }))} error={errors.sectorDetails} />
            <Input label="Institution Address" required value={formData.address || ''} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} error={errors.address} />
            <Input label="Institution Email" required type="email" value={formData.companyEmail || ''} onChange={(e) => setFormData((p) => ({ ...p, companyEmail: e.target.value, email: e.target.value }))} error={errors.companyEmail} />
            <Input label="Institution Contact Number" required value={formData.contactNumber || ''} onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))} error={errors.contactNumber} />
            <Input label="1st Institution Representative Name" required value={formData.representativeName || ''} onChange={(e) => setFormData((p) => ({ ...p, representativeName: e.target.value, fullName: p.fullName || e.target.value }))} error={errors.representativeName} />
            <Input label="Representative 1 Position" required value={formData.position || ''} onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))} error={errors.position} />
            <Input label="2nd Institution Representative Name" required value={formData.representativeName2 || ''} onChange={(e) => setFormData((p) => ({ ...p, representativeName2: e.target.value }))} error={errors.representativeName2} />
            <Input label="Representative 2 Position" required value={formData.representativePosition2 || ''} onChange={(e) => setFormData((p) => ({ ...p, representativePosition2: e.target.value }))} error={errors.representativePosition2} />
            <p className="text-xs text-gray-500 md:col-span-2">Set default password below for the representative account.</p>
            <Input label="Password" required type="password" value={formData.password || ''} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} error={errors.password} helperText="At least 10 characters, 1 uppercase, 1 lowercase, 1 number, 1 special." />
            <Input label="Confirm Password" required type="password" value={formData.confirmPassword || ''} onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))} error={errors.confirmPassword} />
          </div>
        )}

        {formData.memberType === 'industry' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
            <Input label="Company Name" required value={formData.sectorDetails || ''} onChange={(e) => setFormData((p) => ({ ...p, sectorDetails: e.target.value }))} error={errors.sectorDetails} />
            <Input label="Company Address" required value={formData.address || ''} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} error={errors.address} />
            <Input label="Representative Name" required value={formData.representativeName || ''} onChange={(e) => setFormData((p) => ({ ...p, representativeName: e.target.value, fullName: p.fullName || e.target.value }))} error={errors.representativeName} />
            <Select
              label="Gender"
              required
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]}
              value={formData.gender || ''}
              onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value }))}
              error={errors.gender}
            />
            <Input label="Contact Number" required value={formData.contactNumber || ''} onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))} error={errors.contactNumber} />
            <Input label="Position" required value={formData.position || ''} onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))} error={errors.position} />
             <Input label="Company Email" required type="email" value={formData.companyEmail || ''} onChange={(e) => setFormData((p) => ({ ...p, companyEmail: e.target.value, email: e.target.value }))} error={errors.companyEmail} />
            <Input label="Company Website (Optional)" value={formData.website || ''} onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))} error={errors.website} />
            <Input label="Password" required type="password" value={formData.password || ''} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} error={errors.password} helperText="At least 10 characters, 1 uppercase, 1 lowercase, 1 number, 1 special." />
            <Input label="Confirm Password" required type="password" value={formData.confirmPassword || ''} onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))} error={errors.confirmPassword} />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Payment Proof (Upload Transaction Screenshot)</label>
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleImageUpload}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {errors.paymentProof && <p className="mt-1 text-sm text-red-600">{errors.paymentProof}</p>}
          {formData.paymentProof && <img src={formData.paymentProof} alt="Payment proof" className="mt-2 h-28 rounded border object-contain" />}
        </div>

        <Input
          label="Reference Number"
          required
          value={formData.referenceNumber || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, referenceNumber: e.target.value }))}
          error={errors.referenceNumber}
          placeholder="Enter GCash/Transaction Reference Number"
        />

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={Boolean(formData.termsAccepted)}
            onChange={(e) => setFormData((prev) => ({ ...prev, termsAccepted: e.target.checked }))}
            className="mt-1"
          />
          <span className="text-sm text-gray-700">
            I agree to the{' '}
            <span className="font-semibold text-primary underline underline-offset-2">
              Terms and Conditions
            </span>
            .
          </span>
        </label>
        {errors.termsAccepted && <p className="text-sm text-red-600">{errors.termsAccepted}</p>}

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Submit Registration
        </Button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Login here
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
