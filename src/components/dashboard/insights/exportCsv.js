// Tiny CSV export. Wraps fields containing commas/quotes/newlines per RFC 4180.
// Triggers a browser download via an object URL.
export function downloadCsv(filename, rows, headers) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const cols = headers ?? Object.keys(rows[0]);

  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    cols.map(esc).join(','),
    ...rows.map((r) => cols.map((k) => esc(r[k])).join(',')),
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
