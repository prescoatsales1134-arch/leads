import type { ReactNode } from 'react';

export type FormStepId = 'profile' | 'experience' | 'education' | 'extras';

const STEPS: { id: FormStepId; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'extras', label: 'Skills & more' },
];

type Props = {
  current: FormStepId;
  onChange: (id: FormStepId) => void;
  children: ReactNode;
};

function getStepIndex(id: FormStepId): number {
  return STEPS.findIndex((s) => s.id === id);
}

export function SectionStepper({ current, onChange, children }: Props) {
  const idx = getStepIndex(current);
  const go = (delta: number) => {
    const next = Math.min(STEPS.length - 1, Math.max(0, idx + delta));
    onChange(STEPS[next].id);
  };

  return (
    <div>
      <div className="rb-stepper" aria-label="Resume sections">
        <div className="rb-stepper-track">
          {STEPS.map((s, i) => {
            const active = s.id === current;
            const done = i < idx;
            return (
              <button
                key={s.id}
                type="button"
                className={'rb-step-pill' + (active ? ' is-active' : '') + (done ? ' is-done' : '')}
                onClick={() => onChange(s.id)}
                aria-current={active ? 'step' : undefined}
              >
                <span className="rb-step-num">{done ? '✓' : i + 1}</span>
                <span className="rb-step-label">{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="rb-stepper-nav">
          <button type="button" className="rb-btn rb-btn-secondary" disabled={idx <= 0} onClick={() => go(-1)}>
            ← Back
          </button>
          <button type="button" className="rb-btn rb-btn-secondary" disabled={idx >= STEPS.length - 1} onClick={() => go(1)}>
            Next →
          </button>
        </div>
      </div>
      <div className="rb-step-body">{children}</div>
    </div>
  );
}

export { STEPS };
