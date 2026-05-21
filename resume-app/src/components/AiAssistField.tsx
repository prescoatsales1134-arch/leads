import { useState } from 'react';
import { dashboardToast } from '@/utils/dashboardToast';
import {
  requestResumeAssist,
  type CareerFocusId,
  type ResumeAssistFieldType,
} from '@/utils/resumeAssistApi';

type Props = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  fieldType: ResumeAssistFieldType;
  careerFocus: CareerFocusId;
  rows?: number;
  placeholder?: string;
  context?: { jobTitle?: string; company?: string; location?: string };
};

export function AiAssistField({
  label,
  value,
  onChange,
  fieldType,
  careerFocus,
  rows = 5,
  placeholder,
  context,
}: Props) {
  const [busy, setBusy] = useState(false);

  const runAssist = async () => {
    const draft = value.trim();
    if (draft.length < 8) {
      dashboardToast('Write a few words first so AI has something to improve.', 'info');
      return;
    }
    setBusy(true);
    try {
      let improved = await requestResumeAssist({
        text: draft,
        fieldType,
        careerFocus,
        context,
      });
      if (fieldType === 'achievements') {
        improved = improved
          .replace(/\r\n/g, '\n')
          .split('\n')
          .map((l) => l.replace(/^[\s•\-*]+/, '').trim())
          .filter(Boolean)
          .join('\n');
      }
      onChange(improved);
      dashboardToast('AI suggestion applied — review and edit if needed.', 'success');
    } catch (e: unknown) {
      dashboardToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <label style={{ display: 'block', marginTop: '0.5rem' }}>
      <span className="rb-label-row">
        <span className="rb-label">{label}</span>
        <button
          type="button"
          className="rb-btn rb-btn-ai"
          disabled={busy}
          onClick={() => void runAssist()}
          title="Rephrase in a professional, ATS-friendly tone for your target role"
        >
          {busy ? 'Improving…' : '✨ Improve with AI'}
        </button>
      </span>
      <textarea
        className="rb-textarea"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
