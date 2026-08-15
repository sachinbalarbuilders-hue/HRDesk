/**
 * Utility to export an array of records to a formatted CSV file and trigger download.
 */
export function exportToCSV(filename: string, rows: Record<string, any>[], headers?: { key: string; label: string }[]) {
  if (!rows || !rows.length) {
    alert('No data records available to export.');
    return;
  }

  const columns = headers || Object.keys(rows[0]).map(k => ({ key: k, label: k }));
  const headerLine = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');

  const dataLines = rows.map(row => {
    return columns.map(c => {
      const val = row[c.key];
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
