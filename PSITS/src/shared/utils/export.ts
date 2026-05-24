export const exportToCSV = (filename: string, rows: Record<string, any>[]) => {
  if (!rows || rows.length === 0) {
    return;
  }

  // Extract headers
  const headers = Object.keys(rows[0]);

  // Build CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...rows.map((row) =>
      headers
        .map((header) => {
          let cellValue = row[header] === null || row[header] === undefined ? '' : String(row[header]);
          // Escape quotes and wrap in quotes if there is a comma, newline, or quote
          if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
            cellValue = `"${cellValue.replace(/"/g, '""')}"`;
          }
          return cellValue;
        })
        .join(',')
    ),
  ].join('\n');

  // Create Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
