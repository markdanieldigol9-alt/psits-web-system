import { useEffect, useState } from 'react';
import api from '@/shared/services/api';
import { QrCode, Building2, Wallet, Banknote, ShieldAlert } from 'lucide-react';

export interface PaymentSettingsData {
  gcash_qr_code?: string;
  paymaya_qr_code?: string;
  bank_transfer_qr_code?: string;
  bank_transfer_details?: string;
  cash_instructions?: string;
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
            Scan the official GCash QR code below using your GCash app. After making the payment, take a screenshot of your transaction receipt and enter the Reference Number.
          </p>

          {settings?.gcash_qr_code ? (
            <div className="p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xs">
              <img
                src={settings.gcash_qr_code}
                alt="GCash QR Code"
                className="h-56 w-56 sm:h-64 sm:w-64 object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="p-3.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 max-w-md">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>No GCash QR Code uploaded yet by Admin. You may still proceed by entering your payment reference number.</span>
            </div>
          )}
        </div>
      )}

      {/* PayMaya / Maya */}
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
                src={settings.paymaya_qr_code}
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

      {/* Bank Transfer */}
      {normalizedMethod === 'bank_transfer' && (
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-base">
            <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Bank Transfer Payment</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-300 max-w-md">
            Transfer your payment using the bank details or QR code below. After transferring, upload your bank confirmation screenshot or deposit slip.
          </p>

          {settings?.bank_transfer_qr_code && (
            <div className="p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xs">
              <img
                src={settings.bank_transfer_qr_code}
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
              <span>No bank account details or QR code configured by Admin. Please contact administration if needed.</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Cash through Officer */}
      {normalizedMethod === 'cash_officer' && (
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-base">
            <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span>Cash through Officer</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-300 max-w-md">
            Pay directly in cash to an authorized PSITS officer. Obtain your official receipt and reference number, then upload a photo of the receipt as proof.
          </p>

          {settings?.cash_instructions && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl max-w-md text-left text-xs text-gray-800 dark:text-slate-200 whitespace-pre-line w-full shadow-2xs">
              <span className="font-bold text-gray-900 dark:text-slate-100 block mb-1">
                Cash Payment Guidelines:
              </span>
              {settings.cash_instructions}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
