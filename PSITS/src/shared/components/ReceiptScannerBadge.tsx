import React, { useState, useEffect, useCallback } from 'react';
import {
  Scan,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react';
import {
  scanReceiptImage,
  type ReceiptScanResult,
} from '../utils/receiptScanner';

export interface ReceiptScannerBadgeProps {
  imageSource?: File | Blob | string | null;
  expectedAmount?: number | null;
  referenceNumber?: string | null;
  autoScan?: boolean;
  onApplyReferenceNumber?: (refNumber: string) => void;
  onScanComplete?: (result: ReceiptScanResult) => void;
  className?: string;
  label?: string;
}

export const ReceiptScannerBadge: React.FC<ReceiptScannerBadgeProps> = ({
  imageSource,
  expectedAmount,
  referenceNumber,
  autoScan = false,
  onApplyReferenceNumber,
  onScanComplete,
  className = '',
  label,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  const performScan = useCallback(async () => {
    if (!imageSource) return;

    setIsScanning(true);
    setProgress(5);
    setStatusMessage('Initializing scanner engine...');
    setScanError(null);

    try {
      const result = await scanReceiptImage(imageSource, (prog, msg) => {
        setProgress(prog);
        setStatusMessage(msg);
      });

      setScanResult(result);
      if (onScanComplete) {
        onScanComplete(result);
      }
    } catch (err: any) {
      console.error('Receipt OCR error:', err);
      setScanError(err?.message || 'Failed to scan receipt image. Please verify manually.');
    } finally {
      setIsScanning(false);
    }
  }, [imageSource, onScanComplete]);

  // Handle image changes & optional autoScan
  useEffect(() => {
    setScanResult(null);
    setScanError(null);
    setProgress(0);
    setStatusMessage('');

    if (imageSource && autoScan) {
      performScan();
    }
  }, [imageSource, autoScan, performScan]);

  const handleCopyRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  if (!imageSource) {
    return null;
  }

  // Verification matching calculation
  const matchEvaluation =
    scanResult && typeof expectedAmount === 'number' && expectedAmount > 0
      ? scanResult.isMatch(expectedAmount)
      : null;

  // Reference number match check
  const refMatches =
    scanResult?.detectedRefNumber && referenceNumber
      ? scanResult.detectedRefNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() ===
        referenceNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      : null;

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-card p-4 shadow-sm space-y-3 transition-all ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Scan size={16} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              {label || 'AI Receipt OCR Verification'}
            </span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              Scans receipt for payment amount, reference number, and date
            </p>
          </div>
        </div>

        {!isScanning && (
          <button
            type="button"
            onClick={performScan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 dark:border-primary/50 bg-primary/5 dark:bg-primary/20 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            {scanResult ? (
              <>
                <RefreshCw size={13} />
                Re-scan
              </>
            ) : (
              <>
                <Scan size={13} />
                Scan Receipt
              </>
            )}
          </button>
        )}
      </div>

      {/* Progress bar during scan */}
      {isScanning && (
        <div className="space-y-1.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <RefreshCw size={13} className="animate-spin text-blue-600 dark:text-blue-400" />
              {statusMessage || 'Analyzing receipt image...'}
            </span>
            <span className="font-bold text-blue-700 dark:text-blue-300 tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-blue-200 dark:bg-blue-950 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.max(8, progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {scanError && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">Scanner Notice</p>
            <p>{scanError}</p>
          </div>
        </div>
      )}

      {/* Scan Results */}
      {scanResult && !isScanning && (
        <div className="space-y-2.5 pt-1">
          {/* Amount Match Card */}
          {matchEvaluation ? (
            matchEvaluation.status === 'match' ? (
              <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-3 text-xs text-emerald-900 dark:text-emerald-100 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Payment Amount Verified</span>
                </div>
                <p className="text-emerald-800 dark:text-emerald-200">
                  Detected receipt amount of{' '}
                  <strong className="underline decoration-emerald-500 font-bold tabular-nums">
                    ₱{Number(matchEvaluation.detected ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>{' '}
                  matches the expected amount.
                </p>
              </div>
            ) : matchEvaluation.status === 'mismatch' ? (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-100 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                  <span>Amount Discrepancy Detected</span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-md bg-white/70 dark:bg-slate-900/70 p-2 border border-amber-200/80 dark:border-amber-900/60">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-600 dark:text-slate-300 block">
                      Expected Amount
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      ₱{expectedAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-600 dark:text-slate-300 block">
                      Receipt Shows
                    </span>
                    <span className="font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                      ₱{Number(matchEvaluation.detected ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 tabular-nums">
                  {matchEvaluation.difference > 0
                    ? `Receipt shows ₱${matchEvaluation.difference.toFixed(2)} higher than recorded amount.`
                    : `Receipt shows ₱${Math.abs(matchEvaluation.difference).toFixed(2)} less than recorded amount.`}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2.5 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <HelpCircle size={15} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Amount Not Recognized</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    The scanner could not extract a distinct payment amount from this image. Please review the receipt proof manually.
                  </p>
                </div>
              </div>
            )
          ) : (
            // When no expected amount is provided (e.g. initial upload before amount is set)
            scanResult.primaryAmount !== null && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-2.5 text-xs text-blue-900 dark:text-blue-100">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 block">
                    Detected Receipt Amount
                  </span>
                  <span className="text-sm font-bold text-blue-950 dark:text-blue-50 tabular-nums">
                    ₱{scanResult.primaryAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )
          )}

          {/* Reference Number Detection */}
          {scanResult.detectedRefNumber && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Detected Reference / OR #
                </span>
                {refMatches === true && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={12} /> Matches entered ref
                  </span>
                )}
                {refMatches === false && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={12} /> Differs from entered
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs tabular-nums">
                  {scanResult.detectedRefNumber}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopyRef(scanResult.detectedRefNumber!)}
                    title="Copy reference number"
                    className="p-1 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    {copiedRef ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>

                  {onApplyReferenceNumber && (!referenceNumber || !refMatches) && (
                    <button
                      type="button"
                      onClick={() => onApplyReferenceNumber(scanResult.detectedRefNumber!)}
                      className="inline-flex items-center gap-1 rounded bg-primary/10 hover:bg-primary/20 text-primary dark:text-primary-light px-2 py-0.5 text-[11px] font-bold transition-colors"
                    >
                      <span>Use this Ref</span>
                      <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Date info if available */}
          {scanResult.detectedDate && (
            <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between px-1">
              <span>Detected Date/Time:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{scanResult.detectedDate}</span>
            </div>
          )}

          {/* Collapsible raw OCR text inspection */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowRawText((v) => !v)}
              className="text-[11px] text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 font-medium"
            >
              {showRawText ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showRawText ? 'Hide scanned raw text' : 'View scanned raw text'}
            </button>

            {showRawText && (
              <div className="mt-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2">
                <pre className="text-[10px] text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {scanResult.rawText.trim() || '(No textual characters detected)'}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default ReceiptScannerBadge;
