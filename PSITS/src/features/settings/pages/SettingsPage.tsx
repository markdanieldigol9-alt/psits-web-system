import { useEffect, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Input, Button, Select, Card } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { useNotification } from '@/shared/context/NotificationContext';
import { useAuth } from '@/shared/context/AuthContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import api from '@/shared/services/api';

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

export const SettingsPage = () => {
  const { user, updateUser } = useAuth();
  const { addNotification } = useNotification();

  const [isLoading, setIsLoading] = useState(false);
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
  });

  useEffect(() => {
    if (!user) return;
    setFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      contactNumber: user.contactNumber || '',
      sectorDetails: user.sectorDetails || '',
      memberType: user.memberType || '',
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

  if (!user) return null;

  const isMember = user.role === 'member';
  const hasExpiryWindow = isMember;
  const expiresAt = user.membershipExpiresAt ? new Date(user.membershipExpiresAt) : null;
  const isExpired = hasExpiryWindow && expiresAt ? expiresAt.getTime() < Date.now() : false;
  const daysLeft =
    hasExpiryWindow && expiresAt
      ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const payload: any = {
        fullName: formData.fullName,
        contactNumber: formData.contactNumber,
      };

      if (isMember) {
        payload.sectorDetails = formData.sectorDetails;
        payload.memberType = formData.memberType;
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
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-2">Update your account information.</p>
        </div>

        <Card className="p-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={formData.fullName}
              onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
            />
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              disabled
            />
            <Input
              label="Contact Number"
              value={formData.contactNumber}
              onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value }))}
            />

            {isMember && (
              <>
                <Select
                  label="Member Type"
                  disabled
                  options={[
                    { value: 'student', label: 'Student' },
                    { value: 'individual', label: 'Individual' },
                    { value: 'industry', label: 'Industry' },
                    { value: 'institution', label: 'Institution' },
                  ]}
                  value={formData.memberType}
                  onChange={(e) => setFormData((p) => ({ ...p, memberType: e.target.value }))}
                />
                <Input
                  label={user.sector === 'school' ? 'School / University' : user.sector === 'industry' ? 'Industry' : 'Institution'}
                  value={formData.sectorDetails}
                  onChange={(e) => setFormData((p) => ({ ...p, sectorDetails: e.target.value }))}
                />
              </>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <Button variant="primary" onClick={() => setConfirmSave(true)} isLoading={isLoading}>
              Save Changes
            </Button>
          </div>
        </Card>

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
