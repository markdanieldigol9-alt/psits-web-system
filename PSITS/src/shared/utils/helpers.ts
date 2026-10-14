// Common utility functions

export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
};

import QRCode from 'qrcode';

export const generateQRCode = async (data: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(data);
  } catch (err) {
    console.error('Failed to generate QR code', err);
    return '';
  }
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhoneNumber = (phone: string): boolean => {
  // Philippine phone number format
  const phoneRegex = /^(\+63|0)?9\d{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const groupBy = <T,>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

export const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'through_officer', label: 'Through Officer' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'gcash', label: 'GCash' },
];

export const formatPaymentMethod = (method: string): string => {
  if (!method) return '-';
  const m = String(method).toLowerCase();
  if (m === 'through_officer' || m === 'cash_officer' || m === 'officer') return 'Through Officer';
  if (m === 'bank_transfer') return 'Bank Transfer';
  if (m === 'cheque' || m === 'check') return 'Cheque';
  if (m === 'gcash') return 'GCash';
  if (m === 'paymaya') return 'PayMaya';
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const resolveImageUrl = (url?: string | null): string => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';

  // Already a full or embedded URL
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  // Determine production/development backend origin
  const envApiUrl = (import.meta as any)?.env?.VITE_API_URL || (globalThis as any).__VITE_API_URL__ || '';
  let serverBase = envApiUrl ? String(envApiUrl).replace(/\/api\/?$/, '') : '';

  // In production (when not on localhost), ensure we point to the Render backend domain if relative
  if (!serverBase && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    serverBase = 'https://psits-web-system.onrender.com';
  }

  if (serverBase) {
    return trimmed.startsWith('/') ? `${serverBase}${trimmed}` : `${serverBase}/${trimmed}`;
  }

  return trimmed;
};

/**
 * Returns a numerical rank for an officer position title where President is the highest rank (lowest numerical value, e.g. 10).
 * Ordering follows standard executive board hierarchy:
 * 1. President
 * 2. Vice President (Internal, External, Academic, Executive, etc.)
 * 3. Secretary / Assistant Secretary
 * 4. Treasurer / Assistant Treasurer
 * 5. Auditor / Assistant Auditor
 * 6. Business Manager
 * 7. Public Information Officer / Press Relations Officer (PIO / PRO)
 * 8. Protocol Officer
 * 9. Sergeant-at-Arms / Peace Officer / Marshal
 * 10. Representative (Year level, college, sector)
 * 11. Member / Committee
 */
export const getPositionRank = (positionName?: string | null): number => {
  if (!positionName) return 999;
  const pos = String(positionName).trim().toLowerCase();

  // 1. President (must not be Vice President or VP)
  if (pos.includes('president') && !pos.includes('vice') && !/\bvp\b/.test(pos)) return 10;

  // 2. Vice President
  if (
    pos.includes('vice president') ||
    pos.includes('vice-president') ||
    /\bvp\b/.test(pos) ||
    pos.includes('v-pres')
  ) {
    return 20;
  }

  // 3. Secretary
  if (pos.includes('assistant secretary') || pos.includes('asst secretary') || pos.includes('asst. secretary')) return 35;
  if (pos.includes('secretary')) return 30;

  // 4. Treasurer
  if (pos.includes('assistant treasurer') || pos.includes('asst treasurer') || pos.includes('asst. treasurer')) return 45;
  if (pos.includes('treasurer') || pos.includes('finance')) return 40;

  // 5. Auditor
  if (pos.includes('assistant auditor') || pos.includes('asst auditor') || pos.includes('asst. auditor')) return 55;
  if (pos.includes('auditor')) return 50;

  // 6. Business Manager
  if (pos.includes('business')) return 60;

  // 7. Public Information Officer / Press Relations Officer (PIO / PRO)
  if (pos.includes('public information') || /\bpio\b/.test(pos)) return 70;
  if (pos.includes('press relations') || pos.includes('public relations') || /\bpro\b/.test(pos)) return 75;
  if ((pos.includes('information') || pos.includes('relations')) && !pos.includes('protocol')) return 78;

  // 8. Protocol Officer
  if (pos.includes('protocol')) return 80;

  // 9. Sergeant-at-Arms / Peace Officer / Marshal
  if (
    pos.includes('sergeant') ||
    pos.includes('sgt') ||
    pos.includes('peace') ||
    pos.includes('marshal') ||
    pos.includes('arms')
  ) {
    return 90;
  }

  // 10. Representative
  if (pos.includes('representative') || pos.includes('rep')) return 100;

  // 11. Board / Committee / Member
  if (pos.includes('member') || pos.includes('committee')) return 110;

  return 200;
};

