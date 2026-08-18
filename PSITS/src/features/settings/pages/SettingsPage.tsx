import { useEffect, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Input, Button, Select, Card } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { useNotification } from '@/shared/context/NotificationContext';
import { useAuth } from '@/shared/context/AuthContext';
import { useTheme } from '@/shared/context/ThemeContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import api from '@/shared/services/api';
import { validateEmail, validatePhoneNumber } from '@/shared/utils/helpers';
import { Sun, Moon, Monitor } from 'lucide-react';
import { PaymentInstructionsCard } from '@/shared/components/PaymentInstructionsCard';

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString();
};

const formatDateForInput = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const SettingsPage = () => {
  const { user, updateUser } = useAuth();
  const { addNotification } = useNotification();
  const { themeMode, setThemeMode } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    gcash_qr_code: '',
    paymaya_qr_code: '',
    bank_transfer_qr_code: '',
    bank_transfer_details: '',
    cash_instructions: '',
  });
  const [qrFiles, setQrFiles] = useState<Record<string, File | null>>({});
  const [qrPreviews, setQrPreviews] = useState<Record<string, string>>({});
  const [activePaymentTab, setActivePaymentTab] = useState<'gcash' | 'paymaya' | 'bank_transfer' | 'cash_officer'>('gcash');
  const [isPaymentSettingsLoading, setIsPaymentSettingsLoading] = useState(false);
  const [paymentSettingsError, setPaymentSettingsError] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [isRenewalOpen, setIsRenewalOpen] = useState(false);
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [renewalForm, setRenewalForm] = useState({
    amount: '',
    method: 'gcash',
    referenceNumber: '',
    file: null as File | null,
    previewUrl: '',
  });

  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    contactNumber: user?.contactNumber || '',
    sectorDetails: user?.sectorDetails || '',
    memberType: user?.memberType || '',
    birthDate: formatDateForInput(user?.birthdate),
    gender: user?.gender || '',
    address: user?.address || '',
    occupation: user?.occupation || '',
    representativeName: user?.representativeName || '',
    representativeName2: user?.representativeName2 || '',
    position: user?.position || '',
    representativePosition2: user?.representativePosition2 || '',
    companyEmail: user?.companyEmail || '',
    website: user?.website || '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const isMember = user?.role === 'member';

  useEffect(() => {
    if (!user) return;
    setFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      contactNumber: user.contactNumber || '',
      sectorDetails: user.sectorDetails || '',
      memberType: user.memberType || '',
      birthDate: formatDateForInput(user.birthdate),
      gender: user.gender || '',
      address: user.address || '',
      occupation: user.occupation || '',
      representativeName: user.representativeName || '',
      representativeName2: user.representativeName2 || '',
      position: user.position || '',
      representativePosition2: user.representativePosition2 || '',
      companyEmail: user.companyEmail || '',
      website: user.website || '',
      password: '',
      confirmPassword: '',
    });

    // Refresh from server (in case details changed)
    (async () => {
      try {
        const { data } = await api.getMe();
        if (data?.success && data.user) {
          updateUser({
            ...user,
            fullName: data.user.fullName,
            email: data.user.email,
            contactNumber: data.user.contactNumber,
            sector: data.user.sector,
            sectorDetails: data.user.sectorDetails,
            memberType: data.user.memberType,
            birthdate: data.user.birthdate,
            address: data.user.address,
            gender: data.user.gender,
            occupation: data.user.occupation,
            representativeName: data.user.representativeName,
            representativeName2: data.user.representativeName2,
            position: data.user.position,
            representativePosition2: data.user.representativePosition2,
            companyEmail: data.user.companyEmail,
            website: data.user.website,
            membershipStartedAt: data.user.membershipStartedAt ?? null,
            membershipExpiresAt: data.user.membershipExpiresAt ?? null,
            status: data.user.status ?? null,
            isActive: data.user.isActive,
            createdAt: new Date(data.user.createdAt),
            updatedAt: new Date(data.user.updatedAt),
          });
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      const fetchSettings = async () => {
        try {
          const { data } = await api.getPublicSettings();
          if (data?.success && data.settings) {
            setPaymentSettings({
              gcash_qr_code: data.settings.gcash_qr_code || '',
              paymaya_qr_code: data.settings.paymaya_qr_code || '',
              bank_transfer_qr_code: data.settings.bank_transfer_qr_code || '',
              bank_transfer_details: data.settings.bank_transfer_details || '',
              cash_instructions: data.settings.cash_instructions || '',
            });
            setQrPreviews({
              gcash: data.settings.gcash_qr_code || '',
              paymaya: data.settings.paymaya_qr_code || '',
              bank_transfer: data.settings.bank_transfer_qr_code || '',
            });
          }
        } catch (err) {
          console.error('Failed to load settings', err);
        }
      };
      fetchSettings();
    }
  }, [user?.role]);

  const handleQrFileSelect = (method: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setPaymentSettingsError('File must be 8MB or below');
      return;
    }

    setPaymentSettingsError(null);
    setQrFiles((prev) => ({ ...prev, [method]: file }));
    setQrPreviews((prev) => ({ ...prev, [method]: URL.createObjectURL(file) }));
  };

  const handleSavePaymentSettings = async () => {
    setIsPaymentSettingsLoading(true);
    setPaymentSettingsError(null);
    try {
      const updatedSettings = { ...paymentSettings };

      for (const key of ['gcash', 'paymaya', 'bank_transfer'] as const) {
        const file = qrFiles[key];
        if (file) {
          const dataUrl = await readAsDataUrl(file);
          const { data } = await api.uploadQrCode(dataUrl);
          if (data?.success && data.url) {
            const settingKey = `${key}_qr_code` as keyof typeof updatedSettings;
            updatedSettings[settingKey] = data.url;
          }
        }
      }

      const { data: updateRes } = await api.updateSettings(updatedSettings);
      if (!updateRes?.success) {
        throw new Error(updateRes?.message || 'Failed to save payment settings');
      }

      setPaymentSettings(updatedSettings);
      setQrPreviews({
        gcash: updatedSettings.gcash_qr_code,
        paymaya: updatedSettings.paymaya_qr_code,
        bank_transfer: updatedSettings.bank_transfer_qr_code,
      });
      setQrFiles({});

      addNotification({
        userId: 'current',
        title: 'Settings Saved',
        message: 'Payment method settings have been updated successfully.',
        type: 'success',
        isRead: false,
      });
    } catch (err) {
      setPaymentSettingsError(err instanceof Error ? err.message : 'Failed to save payment settings');
    } finally {
      setIsPaymentSettingsLoading(false);
    }
  };

  if (!user) return null;

  const hasExpiryWindow = isMember;
  const expiresAt = user.membershipExpiresAt ? new Date(user.membershipExpiresAt) : null;
  const isExpired = hasExpiryWindow && expiresAt ? expiresAt.getTime() < Date.now() : false;
  const daysLeft =
    hasExpiryWindow && expiresAt
      ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const namePattern = /^[A-Za-z\s.'-]+$/;

    if (!isMember) {
      if (!formData.fullName.trim()) nextErrors.fullName = 'Full name is required';
      if (!formData.contactNumber.trim()) nextErrors.contactNumber = 'Contact number is required';
    } else {
      const type = formData.memberType;
      
      if (!formData.contactNumber.trim()) nextErrors.contactNumber = 'Contact number is required';
      else if (!validatePhoneNumber(formData.contactNumber)) nextErrors.contactNumber = 'Invalid contact number';

      if (!formData.address?.trim()) nextErrors.address = 'Address is required';

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
    }

    if (formData.password) {
      const passwordValue = formData.password;
      if (passwordValue.length < 10) nextErrors.password = 'Password must be at least 10 characters';
      else if (!/[A-Z]/.test(passwordValue)) nextErrors.password = 'Password must include at least one uppercase letter';
      else if (!/[a-z]/.test(passwordValue)) nextErrors.password = 'Password must include at least one lowercase letter';
      else if (!/[0-9]/.test(passwordValue)) nextErrors.password = 'Password must include at least one number';
      else if (!/[^\w\s]/.test(passwordValue)) nextErrors.password = 'Password must include at least one special character';
      if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const payload: any = {};

      if (!isMember) {
        payload.fullName = formData.fullName;
        payload.contactNumber = formData.contactNumber;
      } else {
        const type = formData.memberType;
        payload.contactNumber = formData.contactNumber;
        payload.address = formData.address;

        if (type === 'individual') {
          payload.fullName = formData.fullName;
          payload.birthdate = formData.birthDate;
          payload.gender = formData.gender;
        }

        if (type === 'institution') {
          payload.sectorDetails = formData.sectorDetails;
          payload.companyEmail = formData.companyEmail;
          payload.representativeName = formData.representativeName;
          payload.fullName = formData.representativeName;
          payload.position = formData.position;
          payload.representativeName2 = formData.representativeName2;
          payload.representativePosition2 = formData.representativePosition2;
        }

        if (type === 'industry') {
          payload.sectorDetails = formData.sectorDetails;
          payload.representativeName = formData.representativeName;
          payload.fullName = formData.representativeName;
          payload.gender = formData.gender;
          payload.position = formData.position;
          payload.companyEmail = formData.companyEmail;
          payload.website = formData.website;
        }
      }

      if (formData.password) {
        payload.password = formData.password;
      }

      const { data } = await api.updateMe(payload);
      if (!data?.success) throw new Error(data?.message || 'Update failed');

      updateUser({
        ...user,
        fullName: data.user.fullName,
        email: data.user.email,
        contactNumber: data.user.contactNumber,
        sector: data.user.sector,
        sectorDetails: data.user.sectorDetails,
        memberType: data.user.memberType,
        birthdate: data.user.birthdate,
        address: data.user.address,
        gender: data.user.gender,
        occupation: data.user.occupation,
        representativeName: data.user.representativeName,
        representativeName2: data.user.representativeName2,
        position: data.user.position,
        representativePosition2: data.user.representativePosition2,
        companyEmail: data.user.companyEmail,
        website: data.user.website,
        membershipStartedAt: data.user.membershipStartedAt ?? null,
        membershipExpiresAt: data.user.membershipExpiresAt ?? null,
        status: data.user.status ?? null,
        isActive: data.user.isActive,
        createdAt: new Date(data.user.createdAt),
        updatedAt: new Date(data.user.updatedAt),
      });

      addNotification({
        userId: 'current',
        title: 'Profile Updated',
        message: 'Your profile information has been saved.',
        type: 'success',
        isRead: false,
      });

      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update profile.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Settings</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-2">Manage your account preferences, theme, and profile details.</p>
        </div>

        {/* Theme & Appearance Settings */}
        <Card className="p-6 w-full">
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 p-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Appearance & Theme</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                Customize how PSITS Hub looks on your device.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Light Mode option */}
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  themeMode === 'light'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 ring-2 ring-blue-600'
                    : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                    <Sun size={20} />
                  </div>
                  {themeMode === 'light' && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">Active</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-slate-100">Light Mode</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Bright, crisp standard view</p>
                </div>
              </button>

              {/* Dark Mode option */}
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  themeMode === 'dark'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 ring-2 ring-blue-600'
                    : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <Moon size={20} />
                  </div>
                  {themeMode === 'dark' && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">Active</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-slate-100">Dark Mode</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Easy on the eyes in low light</p>
                </div>
              </button>

              {/* System Default option */}
              <button
                type="button"
                onClick={() => setThemeMode('system')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  themeMode === 'system'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 ring-2 ring-blue-600'
                    : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <Monitor size={20} />
                  </div>
                  {themeMode === 'system' && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">Active</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-slate-100">System Default</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Match device OS preference</p>
                </div>
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-6 w-full">
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Member Profile Information</h3>
              <p className="mt-1 text-sm text-gray-600">
                Update your account details. Fields marked with <span className="text-red-500">*</span> are required.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Member Type"
                disabled
                options={[
                  { value: 'individual', label: 'Individual' },
                  { value: 'industry', label: 'Industry' },
                  { value: 'institution', label: 'Institution' },
                ]}
                value={formData.memberType || ''}
                onChange={() => {}}
              />
              <Input
                label="Email Address"
                type="email"
                value={formData.email}
                disabled
                helperText="Email address cannot be changed."
              />
            </div>

            {/* Non-member Profile Form */}
            {!isMember && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
                <Input
                  label="Full Name"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                  error={errors.fullName}
                />
                <Input
                  label="Contact Number"
                  required
                  value={formData.contactNumber}
                  onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))}
                  error={errors.contactNumber}
                />
              </div>
            )}

            {/* Member: Individual Form */}
            {isMember && formData.memberType === 'individual' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
                <Input
                  label="Full Name"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                  error={errors.fullName}
                />
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
                <Input
                  label="Contact Number"
                  required
                  value={formData.contactNumber}
                  onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))}
                  error={errors.contactNumber}
                />
                <Input
                  label="Address"
                  required
                  value={formData.address || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  error={errors.address}
                  className="md:col-span-2"
                />
              </div>
            )}

            {/* Member: Institution Form */}
            {isMember && formData.memberType === 'institution' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
                <Input
                  label="Institution Name"
                  required
                  value={formData.sectorDetails || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, sectorDetails: e.target.value }))}
                  error={errors.sectorDetails}
                />
                <Input
                  label="Institution Address"
                  required
                  value={formData.address || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  error={errors.address}
                />
                <Input
                  label="Institution Email"
                  required
                  type="email"
                  value={formData.companyEmail || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, companyEmail: e.target.value }))}
                  error={errors.companyEmail}
                />
                <Input
                  label="Institution Contact Number"
                  required
                  value={formData.contactNumber || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))}
                  error={errors.contactNumber}
                />
                <Input
                  label="1st Institution Representative Name"
                  required
                  value={formData.representativeName || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, representativeName: e.target.value }))}
                  error={errors.representativeName}
                />
                <Input
                  label="Representative 1 Position"
                  required
                  value={formData.position || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))}
                  error={errors.position}
                />
                <Input
                  label="2nd Institution Representative Name"
                  required
                  value={formData.representativeName2 || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, representativeName2: e.target.value }))}
                  error={errors.representativeName2}
                />
                <Input
                  label="Representative 2 Position"
                  required
                  value={formData.representativePosition2 || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, representativePosition2: e.target.value }))}
                  error={errors.representativePosition2}
                />
              </div>
            )}

            {/* Member: Industry Form */}
            {isMember && formData.memberType === 'industry' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
                <Input
                  label="Company Name"
                  required
                  value={formData.sectorDetails || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, sectorDetails: e.target.value }))}
                  error={errors.sectorDetails}
                />
                <Input
                  label="Company Address"
                  required
                  value={formData.address || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  error={errors.address}
                />
                <Input
                  label="Representative Name"
                  required
                  value={formData.representativeName || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, representativeName: e.target.value }))}
                  error={errors.representativeName}
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
                <Input
                  label="Contact Number"
                  required
                  value={formData.contactNumber || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))}
                  error={errors.contactNumber}
                />
                <Input
                  label="Position"
                  required
                  value={formData.position || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))}
                  error={errors.position}
                />
                <Input
                  label="Company Email"
                  required
                  type="email"
                  value={formData.companyEmail || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, companyEmail: e.target.value }))}
                  error={errors.companyEmail}
                />
                <Input
                  label="Company Website (Optional)"
                  value={formData.website || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
                  error={errors.website}
                />
              </div>
            )}

            {/* Password Update Section */}
            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Change Password</h3>
              <p className="text-xs text-gray-500">Leave blank if you do not wish to change your password.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="New Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  error={errors.password}
                  helperText="At least 10 characters, 1 uppercase, 1 lowercase, 1 number, 1 special."
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))}
                  error={errors.confirmPassword}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button
              variant="primary"
              onClick={() => {
                if (validateForm()) {
                  setConfirmSave(true);
                }
              }}
              isLoading={isLoading}
            >
              Save Changes
            </Button>
          </div>
        </Card>

        {(user.role === 'admin' || user.role === 'super_admin') && (
          <Card className="p-6">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Payment Method Settings</h3>
              <p className="mt-1 text-sm text-gray-600">
                Configure payment QR codes and instructions for all accepted payment methods during registration and renewals.
              </p>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="flex border-b border-gray-200 mb-6 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActivePaymentTab('gcash')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activePaymentTab === 'gcash'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                GCash
              </button>
              <button
                type="button"
                onClick={() => setActivePaymentTab('paymaya')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activePaymentTab === 'paymaya'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                PayMaya / Maya
              </button>
              <button
                type="button"
                onClick={() => setActivePaymentTab('bank_transfer')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activePaymentTab === 'bank_transfer'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Bank Transfer
              </button>
              <button
                type="button"
                onClick={() => setActivePaymentTab('cash_officer')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activePaymentTab === 'cash_officer'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Cash through Officer
              </button>
            </div>

            {paymentSettingsError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {paymentSettingsError}
              </div>
            )}

            <div className="space-y-4">
              {activePaymentTab === 'gcash' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">GCash QR Code</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => handleQrFileSelect('gcash', e)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  {qrPreviews.gcash && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1">Current / Preview GCash QR Code:</p>
                      <img
                        src={qrPreviews.gcash}
                        alt="GCash QR Code"
                        className="h-48 rounded border object-contain bg-white p-2"
                      />
                    </div>
                  )}
                </div>
              )}

              {activePaymentTab === 'paymaya' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">PayMaya / Maya QR Code</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => handleQrFileSelect('paymaya', e)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  {qrPreviews.paymaya && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1">Current / Preview Maya QR Code:</p>
                      <img
                        src={qrPreviews.paymaya}
                        alt="PayMaya / Maya QR Code"
                        className="h-48 rounded border object-contain bg-white p-2"
                      />
                    </div>
                  )}
                </div>
              )}

              {activePaymentTab === 'bank_transfer' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Bank Transfer QR Code (Optional)</label>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => handleQrFileSelect('bank_transfer', e)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    {qrPreviews.bank_transfer && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">Current / Preview Bank QR Code:</p>
                        <img
                          src={qrPreviews.bank_transfer}
                          alt="Bank Transfer QR Code"
                          className="h-48 rounded border object-contain bg-white p-2"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Bank Account Details / Instructions</label>
                    <textarea
                      rows={3}
                      value={paymentSettings.bank_transfer_details}
                      onChange={(e) =>
                        setPaymentSettings((prev) => ({ ...prev, bank_transfer_details: e.target.value }))
                      }
                      placeholder="e.g. Bank Name: BDO&#10;Account Name: PSITS Region XII&#10;Account Number: 1234-5678-9012"
                      className="block w-full rounded-lg border border-gray-300 p-2.5 text-sm"
                    />
                  </div>
                </div>
              )}

              {activePaymentTab === 'cash_officer' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Cash Payment Instructions</label>
                  <textarea
                    rows={3}
                    value={paymentSettings.cash_instructions}
                    onChange={(e) =>
                      setPaymentSettings((prev) => ({ ...prev, cash_instructions: e.target.value }))
                    }
                    placeholder="e.g. Hand over payment to your school's authorized PSITS officer or treasurer and ask for the official receipt number."
                    className="block w-full rounded-lg border border-gray-300 p-2.5 text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  onClick={handleSavePaymentSettings}
                  isLoading={isPaymentSettingsLoading}
                >
                  Save Payment Settings
                </Button>
              </div>
            </div>
          </Card>
        )}

        {hasExpiryWindow && (
          <Card className="p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Membership Validity</h2>
                <p className="text-sm text-gray-600">Memberships require renewal every year.</p>
              </div>
              <Button variant="outline" onClick={() => setIsRenewalOpen(true)}>
                Request Renewal
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">Status</div>
                <div className="mt-1 font-semibold text-gray-900">{user.status || (user.isActive ? 'active' : 'pending')}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">Expires On</div>
                <div className="mt-1 font-semibold text-gray-900">{formatDate(user.membershipExpiresAt) || '-'}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-semibold uppercase text-gray-500">Remaining</div>
                <div className={`mt-1 font-semibold ${isExpired ? 'text-red-700' : 'text-gray-900'}`}>
                  {daysLeft === null ? '-' : isExpired ? 'Expired' : `${daysLeft} day(s)`}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <VerifyActionModal
        isOpen={confirmSave}
        title="Verify Changes"
        message="Are you sure you want to save profile changes?"
        confirmLabel="Accept"
        confirmVariant="primary"
        onCancel={() => {
          if (isLoading) return;
          setConfirmSave(false);
        }}
        onVerified={async () => {
          await handleSave();
          setConfirmSave(false);
        }}
      />

      <Modal
        isOpen={isRenewalOpen}
        onClose={() => {
          if (renewalSubmitting) return;
          setIsRenewalOpen(false);
          setRenewalError(null);
          setRenewalForm({ amount: '', method: 'gcash', referenceNumber: '', file: null, previewUrl: '' });
        }}
        title="Membership Renewal Request"
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setRenewalError(null);
            if (!renewalForm.amount || Number(renewalForm.amount) <= 0) {
              setRenewalError('Amount is required.');
              return;
            }
            if (!renewalForm.file) {
              setRenewalError('Transaction proof image is required.');
              return;
            }
            setRenewalSubmitting(true);
            (async () => {
              try {
                const dataUrl = await readAsDataUrl(renewalForm.file as File);
                const { data: upload } = await api.uploadPaymentProof(dataUrl);
                const proofUrl = upload?.url;
                if (!proofUrl) throw new Error('Upload failed.');

                await api.createPayment({
                  paymentKind: 'membership_renewal',
                  amount: Number(renewalForm.amount),
                  method: renewalForm.method,
                  paymentMethod: renewalForm.method,
                  referenceNumber: renewalForm.referenceNumber || undefined,
                  proofUrl,
                });

                addNotification({
                  userId: 'current',
                  title: 'Renewal Submitted',
                  message: 'Renewal payment submitted. Waiting for admin verification.',
                  type: 'success',
                  isRead: false,
                });

                setIsRenewalOpen(false);
                setRenewalError(null);
                setRenewalForm({ amount: '', method: 'gcash', referenceNumber: '', file: null, previewUrl: '' });
              } catch (err) {
                setRenewalError(err instanceof Error ? err.message : 'Failed to submit renewal.');
              } finally {
                setRenewalSubmitting(false);
              }
            })();
          }}
        >
          {renewalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{renewalError}</div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Amount"
              type="number"
              min="1"
              value={renewalForm.amount}
              onChange={(e) => setRenewalForm((p) => ({ ...p, amount: e.target.value }))}
              required
            />
            <Select
              label="Payment Method"
              required
              options={[
                { value: 'gcash', label: 'GCash' },
                { value: 'paymaya', label: 'PayMaya / Maya' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cash_officer', label: 'Cash through Officer' },
              ]}
              value={renewalForm.method}
              onChange={(e) => setRenewalForm((p) => ({ ...p, method: e.target.value }))}
            />
          </div>

          {/* QR Code & Payment Guidelines Display */}
          <PaymentInstructionsCard method={renewalForm.method} />

          <Input
            label="Reference Number (Optional)"
            value={renewalForm.referenceNumber}
            onChange={(e) => setRenewalForm((p) => ({ ...p, referenceNumber: e.target.value }))}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Payment Proof</label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (!file) return;
                setRenewalForm((p) => ({ ...p, file, previewUrl: URL.createObjectURL(file) }));
              }}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {renewalForm.previewUrl && (
              <img src={renewalForm.previewUrl} alt="Proof preview" className="mt-2 h-28 rounded border object-contain" />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (renewalSubmitting) return;
                setIsRenewalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={renewalSubmitting}>
              Submit for Approval
            </Button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
};
