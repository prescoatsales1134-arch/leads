export type CareerFocusId =
  | 'general'
  | 'b2b_sales'
  | 'retail_sales'
  | 'account_management'
  | 'saas_sales'
  | 'field_sales'
  | 'caribbean'
  | 'international_remote';

export type ResumeAssistFieldType = 'summary' | 'experience' | 'achievements';

export const CAREER_FOCUS_OPTIONS: { id: CareerFocusId; label: string }[] = [
  { id: 'general', label: 'General professional' },
  { id: 'b2b_sales', label: 'B2B sales' },
  { id: 'retail_sales', label: 'Retail sales' },
  { id: 'account_management', label: 'Account management' },
  { id: 'saas_sales', label: 'SaaS sales' },
  { id: 'field_sales', label: 'Field sales' },
  { id: 'caribbean', label: 'Caribbean opportunities' },
  { id: 'international_remote', label: 'International remote roles' },
];

export async function requestResumeAssist(input: {
  text: string;
  fieldType: ResumeAssistFieldType;
  careerFocus: CareerFocusId;
  context?: { jobTitle?: string; company?: string; location?: string };
}): Promise<string> {
  const r = await fetch('/api/resume-assist', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!r.ok) throw new Error(data.error || 'AI assist failed');
  const text = (data.text || '').trim();
  if (!text) throw new Error('AI returned empty text');
  return text;
}
