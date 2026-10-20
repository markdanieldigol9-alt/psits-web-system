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

  if (onBeforePrint) {
    try {
      onBeforePrint();
    } catch {
      // ignore
    }
  }

  // Delay ensures any unpaginated tables, chart reflows, and preview state settle
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  }, 200);
};
