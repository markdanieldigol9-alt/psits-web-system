import { useEffect, useState } from 'react';
import api from '@/shared/services/api';
import { resolveImageUrl } from '@/shared/utils/helpers';
import { QrCode, Building2, Wallet, Banknote, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';


export interface PaymentSettingsData {
  gcash_qr_code?: string;
  paymaya_qr_code?: string;
  bank_transfer_qr_code?: string;
  bank_transfer_details?: string;
  cash_instructions?: string;
  officer_instructions?: string;
  cheque_details?: string;
  cheque_instructions?: string;
}

interface PaymentInstructionsCardProps {
  method: string;
  settings?: PaymentSettingsData | null;
  className?: string;
}

export const PaymentInstructionsCard = ({
  method,
  settings: initialSettings,
  className = '',
}: PaymentInstructionsCardProps) => {
  const [settings, setSettings] = useState<PaymentSettingsData | null>(initialSettings || null);
  const [isLoading, setIsLoading] = useState(!initialSettings);

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const { data } = await api.getPublicSettings();
        if (isMounted && data?.success && data.settings) {
          setSettings(data.settings);
        }
      } catch {
        // ignore fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchSettings();
    return () => {
      isMounted = false;
    };
  }, [initialSettings]);

  if (!method) return null;

  if (isLoading) {
    return (
      <div className={`p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-center animate-pulse text-xs text-gray-500 dark:text-slate-400 ${className}`}>
        Loading payment details & QR code...
      </div>
    );
  }

  const normalizedMethod = String(method).toLowerCase();

  return (
    <div className={`rounded-2xl border border-blue-100 dark:border-slate-800 bg-blue-50/40 dark:bg-slate-900/60 p-4 sm:p-5 transition-all duration-200 ${className}`}>
      {/* GCash */}
      {normalizedMethod === 'gcash' && (
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold text-base">
            <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span>Scan & Pay via GCash</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-300 max-w-md">
            Scan the official GCash QR code below using your GCash app. After completing the payment, you <strong className="text-blue-700 dark:text-blue-300">must upload the receipt screenshot</strong> and <strong className="text-blue-700 dark:text-blue-300">enter the Reference Number</strong>.
          </p>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100/70 dark:bg-blue-950/60 text-[11px] text-blue-800 dark:text-blue-300 font-medium">
            <CheckCircle2 size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <span>Requirements: Upload Receipt + Reference Number</span>
          </div>

          {settings?.gcash_qr_code ? (
            <div className="p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xs">
              <img
                src={resolveImageUrl(settings.gcash_qr_code)}
                alt="GCash QR Code"
                className="h-56 w-56 sm:h-64 sm:w-64 object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="p-3.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 max-w-md">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>No GCash QR Code uploaded yet by Admin. You may still proceed by entering your payment reference number and uploading your receipt screenshot.</span>
            </div>
          )}
        </div>
      )}

      {/* Bank Transfer */}
      {normalizedMethod === 'bank_transfer' && (
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-base">
            <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Bank Transfer Payment</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-300 max-w-md">
            Transfer your payment using the bank details or QR code below. After transferring, <strong className="text-indigo-700 dark:text-indigo-300">upload the bank transfer receipt or deposit slip</strong> as proof.
          </p>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-100/70 dark:bg-indigo-950/60 text-[11px] text-indigo-800 dark:text-indigo-300 font-medium">
            <CheckCircle2 size={13} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>Requirements: Upload Bank Transfer Receipt</span>
          </div>

          {settings?.bank_transfer_qr_code && (
            <div className="p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xs">
              <img
                src={resolveImageUrl(settings.bank_transfer_qr_code)}
                alt="Bank Transfer QR Code"
                className="h-56 w-56 sm:h-64 sm:w-64 object-contain rounded-lg"
              />
            </div>
          )}

          {settings?.bank_transfer_details ? (
            <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl max-w-md text-left text-xs text-gray-800 dark:text-slate-200 whitespace-pre-line w-full shadow-2xs font-mono">
              <span className="font-bold text-gray-900 dark:text-slate-100 block mb-1 font-sans text-sm">
                Bank Account Details:
              </span>
              {settings.bank_transfer_details}
            </div>
          ) : !settings?.bank_transfer_qr_code ? (
            <div className="p-3.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 max-w-md">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>No bank account details or QR code configured by Admin. Please contact administration for bank details.</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Cheque */}
      {(normalizedMethod === 'cheque' || normalizedMethod === 'check') && (
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200 font-bold text-base">
            <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <span>Cheque Payment</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-300 max-w-md">
            Issue a cheque payable to the designated PSITS account or authorized representative. Once issued or deposited, <strong className="text-teal-700 dark:text-teal-300">upload the cheque receipt or deposit slip</strong> as proof.
          </p>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-100/70 dark:bg-teal-950/60 text-[11px] text-teal-800 dark:text-teal-300 font-medium">
            <CheckCircle2 size={13} className="shrink-0 text-teal-600 dark:text-teal-400" />
            <span>Requirements: Upload Cheque Receipt / Copy</span>
          </div>

          {(settings?.cheque_details || settings?.cheque_instructions) ? (
            <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl max-w-md text-left text-xs text-gray-800 dark:text-slate-200 whitespace-pre-line w-full shadow-2xs font-mono">
              <span className="font-bold text-gray-900 dark:text-slate-100 block mb-1 font-sans text-sm">
                Cheque Payment Guidelines:
              </span>
              {settings.cheque_details || settings.cheque_instructions}
            </div>
          ) : (
            <div className="p-3.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 max-w-md">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Ensure the cheque is crossed and issued in the name of Philippine Society of Information Technology Students. Attach a photo of the cheque/receipt.</span>
            </div>
          )}
        </div>
      )}

      {/* Through Officer */}
      {(normalizedMethod === 'through_officer' || normalizedMethod === 'cash_officer' || normalizedMethod === 'officer') && (
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-base">
            <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span>Payment Through Officer</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-300 max-w-md">
            Pay directly in cash or in-person to an authorized PSITS officer. Obtain your official receipt, and <strong className="text-amber-700 dark:text-amber-300">upload the Official Receipt (OR)</strong> as proof.
          </p>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/60 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
            <CheckCircle2 size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Requirements: Upload Official Receipt (OR)</span>
          </div>

          {(settings?.officer_instructions || settings?.cash_instructions) && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl max-w-md text-left text-xs text-gray-800 dark:text-slate-200 whitespace-pre-line w-full shadow-2xs">
              <span className="font-bold text-gray-900 dark:text-slate-100 block mb-1">
                Officer Payment Guidelines:
              </span>
              {settings.officer_instructions || settings.cash_instructions}
            </div>
          )}
        </div>
      )}

      {/* PayMaya / Maya (backward compatibility) */}
      {normalizedMethod === 'paymaya' && (
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold text-base">
            <QrCode className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span>Scan & Pay via PayMaya / Maya</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-300 max-w-md">
            Scan the official PayMaya / Maya QR code below using your Maya app. After paying, save your receipt screenshot and record the Reference Number.
          </p>

          {settings?.paymaya_qr_code ? (
            <div className="p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xs">
              <img
                src={resolveImageUrl(settings.paymaya_qr_code)}
                alt="PayMaya / Maya QR Code"
                className="h-56 w-56 sm:h-64 sm:w-64 object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="p-3.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 max-w-md">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>No PayMaya QR Code uploaded yet by Admin. You may still proceed by uploading your transaction proof.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

