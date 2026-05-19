export type ResumeExportLimitInfo = {
  limit: number | null;
  used: number;
  remaining: number | null;
  mode: 'unlimited' | 'monthly' | 'trial' | 'blocked';
};

export async function fetchResumeExportLimit(): Promise<ResumeExportLimitInfo | null> {
  const r = await fetch('/api/resume-export-limit', { credentials: 'same-origin' });
  if (!r.ok) return null;
  return (await r.json()) as ResumeExportLimitInfo;
}

export function formatResumeExportLimitLabel(info: ResumeExportLimitInfo | null): string {
  if (!info) return '';
  if (info.mode === 'unlimited') return 'PDF exports this month (UTC): unlimited';
  if (info.mode === 'trial') return '1 complimentary PDF export available — then a plan or admin limit applies';
  if (info.mode === 'blocked') {
    return 'No PDF exports remaining this month — upgrade in Pricing or ask an admin to set your limit';
  }
  const lim = info.limit != null ? info.limit : 0;
  const rem = info.remaining != null ? info.remaining : Math.max(0, lim - (info.used || 0));
  return `PDF exports this month (UTC): ${lim} (${rem} remaining)`;
}

export async function requestResumeExportSlot(): Promise<void> {
  const r = await fetch('/api/resume-export', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Export not allowed');
  }
}

export function canExportResume(info: ResumeExportLimitInfo | null): boolean {
  if (!info) return true;
  if (info.mode === 'unlimited' || info.mode === 'trial') return true;
  if (info.mode === 'monthly' && info.limit != null) return info.used < info.limit;
  return false;
}
