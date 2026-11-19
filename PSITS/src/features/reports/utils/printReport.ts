import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export const PSITS_BEFORE_PRINT_EVENT = 'psits:before-print';
export const PSITS_AFTER_PRINT_EVENT = 'psits:after-print';

/**
 * Coordinates unpagination across paginated report views when printing via
 * printReportDocument(), native window.print() / Ctrl+P, or print media emulation.
 */
export const usePrintExpansion = (): boolean => {
  const [isPrinting, setIsPrinting] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('print').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyPrintState = (next: boolean) => {
      try {
        flushSync(() => {
          setIsPrinting(next);
        });
      } catch {
        setIsPrinting(next);
      }
    };

    const handleBeforePrint = () => applyPrintState(true);
    const handleAfterPrint = () => applyPrintState(false);

    window.addEventListener(PSITS_BEFORE_PRINT_EVENT, handleBeforePrint);
    window.addEventListener(PSITS_AFTER_PRINT_EVENT, handleAfterPrint);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    const mediaQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('print') : null;
    const handleMediaChange = (event: MediaQueryListEvent) => {
      applyPrintState(event.matches);
    };

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleMediaChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleMediaChange);
      }
    }

    return () => {
      window.removeEventListener(PSITS_BEFORE_PRINT_EVENT, handleBeforePrint);
      window.removeEventListener(PSITS_AFTER_PRINT_EVENT, handleAfterPrint);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', handleMediaChange);
        } else if (typeof mediaQuery.removeListener === 'function') {
          mediaQuery.removeListener(handleMediaChange);
        }
      }
    };
  }, []);

  return isPrinting;
};

/**
 * Triggers clean browser print / Print-to-PDF with appropriate document title
 * so the default PDF filename matches the official report name and date.
 */
export const printReportDocument = (reportTitle?: string, onBeforePrint?: () => void) => {
  const originalTitle = document.title;
  if (reportTitle) {
    const cleanTitle = reportTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const dateStr = new Date().toISOString().split('T')[0];
    document.title = `PSITS - ${cleanTitle} (${dateStr})`;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PSITS_BEFORE_PRINT_EVENT));
  }

  if (onBeforePrint) {
    try {
      onBeforePrint();
    } catch {
      // ignore
    }
  }

  // Delay ensures any unpaginated tables, chart reflows, and preview state settle
  setTimeout(() => {
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      window.removeEventListener('afterprint', cleanup);
      document.title = originalTitle;
      window.dispatchEvent(new CustomEvent(PSITS_AFTER_PRINT_EVENT));
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    try {
      window.print();
    } finally {
      setTimeout(cleanup, 1500);
    }
  }, 200);
};
