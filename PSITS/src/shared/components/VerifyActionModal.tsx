import { useEffect, useState } from 'react';
import { Modal } from '@/shared/components/Common';
import { Button, Input } from '@/shared/components/Form';
import api from '@/shared/services/api';

interface VerifyActionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  requireText?: string;
  requirePassword?: boolean;
  onCancel: () => void;
  onVerified: () => Promise<void> | void;
}

export const VerifyActionModal = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  requireText,
  requirePassword = false,
  onCancel,
  onVerified,
}: VerifyActionModalProps) => {
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTyped('');
      setPassword('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const canConfirmText = requireText
    ? typed.trim().toLowerCase() === requireText.trim().toLowerCase()
    : true;

  const canSubmit =
    canConfirmText && (!requirePassword || password.trim().length > 0) && !isLoading;

  return (
    <Modal isOpen={isOpen} onClose={() => !isLoading && onCancel()} title={title} size="md">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          void (async () => {
            setIsLoading(true);
            setError(null);
            try {
              if (requirePassword) {
                const { data } = await api.verifyPassword(password);
                if (!data?.success) throw new Error(data?.message || 'Verification failed.');
              }
              await onVerified();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Verification failed.');
            } finally {
              setIsLoading(false);
            }
          })();
        }}
      >
        <p className="text-sm text-gray-700">{message}</p>

        {requireText && (
          <Input
            label={`Type "${requireText}" to continue`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requireText}
          />
        )}

        {requirePassword && (
          <Input
            label="Confirm with your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
            disabled={!canSubmit}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
