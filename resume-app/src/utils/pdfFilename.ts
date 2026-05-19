export function pdfResumeFilename(fullName: string): string {
  const date = formatLocalISODate();
  const slug = sanitizeName(fullName);
  const base = slug || 'Resume';
  return `${base}_Resume_${date}.pdf`;
}

function formatLocalISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sanitizeName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  const clean = (segment: string) =>
    segment
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 40);
  const first = clean(parts[0]);
  const lastPart = parts.length > 1 ? clean(parts[parts.length - 1]) : '';
  if (!lastPart) return first || '';
  return `${first}_${lastPart}`;
}
