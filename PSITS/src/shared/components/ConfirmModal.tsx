import { useEffect, useState } from 'react';
import { Modal } from '@/shared/components/Common';
import { Button, Input } from '@/shared/components/Form';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  requireText?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  requireText,
  onCancel,
  onConfirm,
  isLoading = false,
}: ConfirmModalProps) => {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!isOpen) setTyped('');
  }, [isOpen]);

  const canConfirm = requireText ? typed.trim().toLowerCase() === requireText.trim().toLowerCase() : true;

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{message}</p>

        {requireText && (
          <Input
            label={`Type "${requireText}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requireText}
          />
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
            onClick={() => void onConfirm()}
            disabled={!canConfirm || isLoading}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

