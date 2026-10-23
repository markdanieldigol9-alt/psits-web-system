import Tesseract from 'tesseract.js';

export interface ReceiptScanResult {
  rawText: string;
  confidence: number;
  detectedAmounts: number[];
  primaryAmount: number | null;
  detectedRefNumber: string | null;
  detectedDate: string | null;
  isMatch: (expectedAmount: number, tolerance?: number) => {
    matches: boolean;
    difference: number;
    detected: number | null;
    status: 'match' | 'mismatch' | 'not_found';
    message: string;
  };
}

/**
 * Extracts reference / transaction numbers from receipt OCR text.
 * Covers standard Philippine payment channels: GCash (13 digits), Maya, Bank transfers (Trace #), and Official Receipts (OR #).
 */
export function extractReferenceNumber(text: string): string | null {
  if (!text) return null;

  // 1. Standard 13-digit GCash pattern (often grouped as 1002 3498 1723 or contiguous 100234981723)
  const gcashMatch = text.match(/\b(1\d{3}\s*\d{4}\s*\d{4,6})\b/);
  if (gcashMatch) {
    return gcashMatch[1].replace(/\s+/g, '');
  }

  // 2. Labeled reference / OR / Trace patterns
  const labeledPatterns = [
    /(?:OR|Official\s*Receipt)\s*(?:No\.?|#)?\s*[:.]?\s*([A-Za-z0-9-]{3,24})/i,
    /(?:Ref(?:erence)?\.?\s*(?:No|Number)?\.?|Trace\s*(?:No|Number)?\.?|Trans(?:action)?\.?\s*(?:ID|No)?\.?|Approval\s*Code)\s*[:.]?\s*([A-Za-z0-9-]{4,24})/i,
  ];

  for (const pat of labeledPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const clean = match[1].trim();
      if (!/^(the|date|amount|total|from|received|psits|payment|paid|details)$/i.test(clean)) {
        return clean;
      }
    }
  }

  return null;
}

/**
 * Extracts currency payment amounts from receipt OCR text.
 * Prioritizes labeled amounts ("Amount Sent", "Total Paid", "₱", "PHP"), followed by standard numeric decimal amounts.
 */
export function extractAmounts(text: string): number[] {
  if (!text) return [];

  const foundAmounts: number[] = [];
  const currentYear = new Date().getFullYear();

  const addAmount = (num: number) => {
    // Basic sanity checks: must be positive, reasonable amount for membership/event fees, not a year like 2024-2027
    if (
      num > 0 &&
      num <= 5000000 &&
      num !== currentYear &&
      num !== currentYear - 1 &&
      num !== currentYear + 1 &&
      !foundAmounts.includes(num)
    ) {
      foundAmounts.push(num);
    }
  };

  // Priority 1: Specifically labeled amounts (Amount, Total, Sum of, Fee, Sent, Paid)
  const labeledRegex = /(?:Total\s*Amount|Amount\s*Sent|Amount\s*Paid|Total\s*Paid|Amount|Total|Sum\s*of|Fee)\s*[:.]?\s*(?:PHP|Php|php|₱|P)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/gi;
  let match: RegExpExecArray | null;
  while ((match = labeledRegex.exec(text)) !== null) {
    const parsed = parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isNaN(parsed)) addAmount(parsed);
  }

  // Priority 2: Explicit currency symbols (₱ 500.00 or PHP 500.00)
  const currencyRegex = /(?:PHP|Php|₱)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/gi;
  while ((match = currencyRegex.exec(text)) !== null) {
    const parsed = parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isNaN(parsed)) addAmount(parsed);
  }

  // Priority 3: Standalone 2-decimal numbers (e.g. 250.00, 1,500.00)
  const decimalRegex = /\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/g;
  while ((match = decimalRegex.exec(text)) !== null) {
    const parsed = parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isNaN(parsed)) addAmount(parsed);
  }

  return foundAmounts;
}

/**
 * Extracts visible date/time strings from receipts.
 */
export function extractDate(text: string): string | null {
  if (!text) return null;
  // Look for formats like: "Oct 23, 2026", "23 Oct 2026", "2026-10-23", "10/23/2026"
  const datePatterns = [
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?/i,
    /\b\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2})?/,
    /\b\d{1,2}\/\d{1,2}\/\d{4}/,
  ];
  for (const pat of datePatterns) {
    const match = text.match(pat);
    if (match) return match[0].trim();
  }
  return null;
}

/**
 * Parses raw OCR text into a structured ReceiptScanResult.
 */
export function parseReceiptScan(rawText: string, confidence = 0): ReceiptScanResult {
  const detectedAmounts = extractAmounts(rawText);
  const detectedRefNumber = extractReferenceNumber(rawText);
  const detectedDate = extractDate(rawText);
  const primaryAmount = detectedAmounts.length > 0 ? detectedAmounts[0] : null;

  return {
    rawText,
    confidence,
    detectedAmounts,
    primaryAmount,
    detectedRefNumber,
    detectedDate,
    isMatch: (expectedAmount: number, tolerance = 0.05) => {
      if (typeof expectedAmount !== 'number' || Number.isNaN(expectedAmount) || expectedAmount <= 0) {
        return {
          matches: false,
          difference: 0,
          detected: primaryAmount,
          status: 'not_found',
          message: 'Invalid expected amount provided for verification.',
        };
      }

      if (detectedAmounts.length === 0) {
        return {
          matches: false,
          difference: 0,
          detected: null,
          status: 'not_found',
          message: 'No readable amount detected on the receipt image.',
        };
      }

      // Check if primary amount or ANY of the detected amounts match the expected amount within tolerance
      const matched = detectedAmounts.find((a) => Math.abs(a - expectedAmount) <= tolerance);
      if (matched !== undefined) {
        return {
          matches: true,
          difference: 0,
          detected: matched,
          status: 'match',
          message: `Verified: Detected ₱${matched.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} matches the expected amount.`,
        };
      }

      // Mismatch
      const closest = detectedAmounts.reduce((prev, curr) =>
        Math.abs(curr - expectedAmount) < Math.abs(prev - expectedAmount) ? curr : prev
      );
      const diff = closest - expectedAmount;

      return {
        matches: false,
        difference: diff,
        detected: closest,
        status: 'mismatch',
        message: `Amount Discrepancy: Receipt shows ₱${closest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, but expected amount is ₱${expectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${diff > 0 ? `+₱${diff.toFixed(2)}` : `-₱${Math.abs(diff).toFixed(2)}`}).`,
      };
    },
  };
}

/**
 * Main SDK function: Scans an image file, blob, or URL using Tesseract.js OCR.
 */
export async function scanReceiptImage(
  imageSource: File | Blob | string,
  onProgress?: (progress: number, statusText: string) => void
): Promise<ReceiptScanResult> {
  let sourceToRecognize: any = imageSource;

  // If source is a Blob or File, we can pass it directly to Tesseract.js
  // If it's a relative URL (e.g. /uploads/...), fetch it as a blob first to prevent CORS taint
  if (typeof imageSource === 'string' && (imageSource.startsWith('/') || imageSource.startsWith('blob:'))) {
    try {
      const response = await fetch(imageSource);
      if (response.ok) {
        sourceToRecognize = await response.blob();
      }
    } catch {
      // fallback to original string
    }
  }

  const result = await Tesseract.recognize(sourceToRecognize, 'eng', {
    logger: (m) => {
      if (onProgress) {
        if (m.status === 'recognizing text') {
          onProgress(Math.min(100, Math.round((m.progress || 0) * 100)), 'Scanning receipt text...');
        } else if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
          onProgress(15, 'Initializing OCR scanner engine...');
        } else if (m.status === 'loading language traineddata') {
          onProgress(35, 'Loading language recognition models...');
        } else if (m.status === 'initializing api') {
          onProgress(50, 'Analyzing image composition...');
        }
      }
    },
  });

  const rawText = result?.data?.text || '';
  const confidence = result?.data?.confidence || 0;

  return parseReceiptScan(rawText, confidence);
}
