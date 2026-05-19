import { useEffect, useMemo, useRef } from 'react';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuid } from 'uuid';
import type { Resume, ResumeTemplateId } from '@/types/resume';
import { STORAGE_KEY, hydrateResume, newResume, parseStoredResume } from '@/defaultResume';
import { resumeSchema } from '@/schemas/resumeSchema';
import { PhotoUpload } from '@/components/PhotoUpload';
import { ResumeHtmlPreview } from '@/preview/ResumeHtmlPreview';
import { useDebouncedResume } from '@/hooks/useDebouncedResume';
import { useResumeUiStore } from '@/store/uiStore';
import { exportResumePdf } from '@/pdf/exportPdf';
import { dashboardToast } from '@/utils/dashboardToast';
import { estimateResumePages } from '@/utils/previewEstimate';

function formatRelative(ms: number | null): string {
  if (ms == null) return 'Autosave queued';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 5) return 'Saved just now';
  if (s < 3600) return `Saved ~${Math.max(1, Math.floor(s / 60))} min ago`;
  return `Saved earlier today`;
}

function LanguageRows() {
  const { control, register } = useFormContext<Resume>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'skills.languages',
  });
  return (
    <div style={{ marginTop: '0.35rem' }}>
      {fields.map((f, i) => (
        <div key={f.id} className="rb-row-2" style={{ marginBottom: '0.5rem', alignItems: 'end' }}>
          <label>
            <span className="rb-label">Language</span>
            <input className="rb-input" {...register(`skills.languages.${i}.language`)} placeholder="Spanish" />
          </label>
          <div style={{ display: 'flex', gap: '0.35rem', flex: 1 }}>
            <label style={{ flex: 1 }}>
              <span className="rb-label">Level</span>
              <select className="rb-select" {...register(`skills.languages.${i}.proficiency`)}>
                {(['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'] as const).map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <button type="button" className="rb-btn rb-btn-secondary" onClick={() => remove(i)}>
              ✕
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="rb-btn rb-btn-secondary" onClick={() => append({ language: '', proficiency: 'Professional' })}>
        + Language
      </button>
    </div>
  );
}

function RepeatableCerts() {
  const { control, register } = useFormContext<Resume>();
  const { fields, append, remove } = useFieldArray({ control, name: 'certifications' });
  return (
    <div style={{ marginTop: '0.35rem' }}>
      {fields.map((f, i) => (
        <div key={f.id} className="rb-card-lite">
          <div className="rb-row-2">
            <label>
              <span className="rb-label">Name</span>
              <input className="rb-input" {...register(`certifications.${i}.name`)} />
            </label>
            <label>
              <span className="rb-label">Issuer</span>
              <input className="rb-input" {...register(`certifications.${i}.issuer`)} />
            </label>
          </div>
          <div className="rb-row-2" style={{ marginTop: '0.5rem' }}>
            <label>
              <span className="rb-label">Date earned</span>
              <input className="rb-input" {...register(`certifications.${i}.date`)} placeholder="MM/YYYY" />
            </label>
            <label>
              <span className="rb-label">Expiry (optional)</span>
              <input className="rb-input" {...register(`certifications.${i}.expiryDate`)} />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: '0.5rem' }}>
            <span className="rb-label">Credential ID</span>
            <input className="rb-input" {...register(`certifications.${i}.credentialId`)} />
          </label>
          <button type="button" className="rb-btn rb-btn-secondary" style={{ marginTop: '0.65rem' }} onClick={() => remove(i)}>
            Remove certification
          </button>
        </div>
      ))}
      <button
        type="button"
        className="rb-btn rb-btn-secondary"
        onClick={() =>
          append({ id: uuid(), name: '', issuer: '', date: '', expiryDate: '', credentialId: '' })
        }
      >
        + Certification
      </button>
    </div>
  );
}

function newProjectStub(): Resume['projects'][number] {
  return {
    id: uuid(),
    name: '',
    description: '',
    technologies: [],
    link: '',
    startDate: '',
    endDate: '',
  };
}

function RepeatableProjects() {
  const { control, register } = useFormContext<Resume>();
  const { fields, append, remove } = useFieldArray({ control, name: 'projects' });
  return (
    <div style={{ marginTop: '0.35rem' }}>
      {fields.map((f, i) => (
        <div key={f.id} className="rb-card-lite">
          <label>
            <span className="rb-label">Project name</span>
            <input className="rb-input" {...register(`projects.${i}.name`)} />
          </label>
          <label style={{ marginTop: '0.35rem', display: 'block' }}>
            <span className="rb-label">Summary</span>
            <textarea className="rb-textarea" {...register(`projects.${i}.description`)} />
          </label>
          <div className="rb-row-2" style={{ marginTop: '0.5rem' }}>
            <label>
              <span className="rb-label">Tech (comma-separated)</span>
              <Controller
                name={`projects.${i}.technologies`}
                control={control}
                render={({ field }) => (
                  <input
                    className="rb-input"
                    value={field.value.join(', ')}
                    onChange={(ev) =>
                      field.onChange(
                        ev.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean)
                      )
                    }
                  />
                )}
              />
            </label>
            <label>
              <span className="rb-label">Link (optional)</span>
              <input className="rb-input" {...register(`projects.${i}.link`)} placeholder="https://…" />
            </label>
          </div>
          <button type="button" className="rb-btn rb-btn-secondary" style={{ marginTop: '0.65rem' }} onClick={() => remove(i)}>
            Remove project
          </button>
        </div>
      ))}
      <button type="button" className="rb-btn rb-btn-secondary" onClick={() => append(newProjectStub())}>
        + Project
      </button>
    </div>
  );
}

function referenceStub(): Resume['references'][number] {
  return { id: uuid(), name: '', position: '', company: '', email: '', phone: '' };
}

function RepeatableReferences() {
  const { control, register } = useFormContext<Resume>();
  const { fields, append, remove } = useFieldArray({ control, name: 'references' });
  return (
    <div style={{ marginTop: '0.35rem' }}>
      {fields.map((f, i) => (
        <div key={f.id} className="rb-card-lite">
          <div className="rb-row-2">
            <label>
              <span className="rb-label">Full name</span>
              <input className="rb-input" {...register(`references.${i}.name`)} />
            </label>
            <label>
              <span className="rb-label">Title</span>
              <input className="rb-input" {...register(`references.${i}.position`)} />
            </label>
          </div>
          <div className="rb-row-2" style={{ marginTop: '0.5rem' }}>
            <label>
              <span className="rb-label">Company</span>
              <input className="rb-input" {...register(`references.${i}.company`)} />
            </label>
            <label>
              <span className="rb-label">Email</span>
              <input className="rb-input" type="email" {...register(`references.${i}.email`)} />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: '0.5rem' }}>
            <span className="rb-label">Phone</span>
            <input className="rb-input" {...register(`references.${i}.phone`)} />
          </label>
          <button type="button" className="rb-btn rb-btn-secondary" style={{ marginTop: '0.65rem' }} onClick={() => remove(i)}>
            Remove reference
          </button>
        </div>
      ))}
      <button type="button" className="rb-btn rb-btn-secondary" onClick={() => append(referenceStub())}>
        + Reference
      </button>
    </div>
  );
}

function newExperienceStub(): Resume['experience'][number] {
  return {
    id: uuid(),
    jobTitle: '',
    company: '',
    location: '',
    startDate: '',
    endDate: 'Present',
    currentlyWorking: true,
    description: '',
    achievements: [''],
  };
}

function educationStub(): Resume['education'][number] {
  return {
    id: uuid(),
    degree: '',
    institution: '',
    location: '',
    startDate: '',
    endDate: 'Present',
    gpa: '',
    achievements: [],
  };
}

export default function ResumeBuilderRoot() {
  const initialValues = useMemo(() => {
    try {
      return hydrateResume(parseStoredResume(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return newResume();
    }
  }, []);

  const resolver = zodResolver(resumeSchema) as unknown as Resolver<Resume>;
  const methods = useForm<Resume>({
    resolver,
    defaultValues: initialValues,
    mode: 'onBlur',
  });

  const {
    fields: expFields,
    append: appendExp,
    remove: removeExp,
    swap: swapExp,
  } = useFieldArray({ control: methods.control, name: 'experience' });

  const {
    fields: eduFields,
    append: appendEdu,
    remove: removeEdu,
    swap: swapEdu,
  } = useFieldArray({ control: methods.control, name: 'education' });

  const live = useWatch({
    control: methods.control,
    defaultValue: initialValues,
  }) as Resume;
  const previewResume = useDebouncedResume(live, 300);

  const setLastSavedAt = useResumeUiStore((s) => s.setLastSavedAt);
  const savedRef = useRef<number>(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      const values = methods.getValues();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
        const now = Date.now();
        setLastSavedAt(now);
        savedRef.current = now;
      } catch {
        dashboardToast('Could not autosave locally (quota exceeded?).', 'error');
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [methods, setLastSavedAt]);

  const template = useResumeUiStore((s) => s.template);
  const setTemplate = useResumeUiStore((s) => s.setTemplate);
  const previewZoomPct = useResumeUiStore((s) => s.previewZoomPct);
  const setZoom = useResumeUiStore((s) => s.setPreviewZoomPct);
  const pdfBusy = useResumeUiStore((s) => s.pdfGeneration);
  const setPdfBusy = useResumeUiStore((s) => s.setPdfGeneration);
  const lastSavedAtStore = useResumeUiStore((s) => s.lastSavedAt);

  const pages = estimateResumePages(previewResume);

  const onExport = async () => {
    const values = methods.getValues();
    setPdfBusy(true);
    try {
      await exportResumePdf(values, template);
      dashboardToast('PDF exported — check your Downloads.', 'success');
    } catch (e: unknown) {
      dashboardToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const clearAll = () => {
    if (!window.confirm('Erase this resume draft from this browser?')) return;
    localStorage.removeItem(STORAGE_KEY);
    methods.reset(newResume());
    dashboardToast('Cleared draft.', 'info');
  };

  const lastLabel = formatRelative(lastSavedAtStore ?? savedRef.current);

  return (
    <FormProvider {...methods}>
      <div className="rb-toolbar rb-panel" style={{ border: 'none', padding: 0, background: 'transparent' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Resume Builder</h2>
          <p className="rb-muted">{lastLabel}</p>
        </div>
        <div className="rb-toolbar-controls">
          <label style={{ margin: 0 }}>
            <span className="rb-label">Template</span>
            <select className="rb-select" value={template} onChange={(ev) => setTemplate(ev.target.value as ResumeTemplateId)}>
              <option value="ats">ATS‑friendly</option>
              <option value="modern">Modern purple</option>
              <option value="classic">Classic serif</option>
            </select>
          </label>
          <button type="button" className="rb-btn rb-btn-secondary" disabled={previewZoomPct <= 70} onClick={() => setZoom(previewZoomPct - 10)}>
            −
          </button>
          <button type="button" className="rb-btn rb-btn-secondary" disabled={previewZoomPct >= 120} onClick={() => setZoom(previewZoomPct + 10)}>
            +
          </button>
          <span className="rb-muted">Zoom {previewZoomPct}%</span>
          <button type="button" className="rb-btn rb-btn-primary" disabled={pdfBusy} onClick={() => void onExport()}>
            {pdfBusy ? 'Generating…' : 'Download PDF'}
          </button>
          <button type="button" className="rb-btn rb-btn-secondary" onClick={clearAll}>
            Clear draft
          </button>
        </div>
      </div>

      <div className="rb-layout">
        <div className="rb-panel">
          <div className="rb-section-head">
            <h3>Personal</h3>
          </div>
          <div className="rb-row-2">
            <label style={{ gridColumn: '1 / -1' }}>
              <span className="rb-label">Full name</span>
              <input className="rb-input" {...methods.register('personalInfo.fullName')} placeholder="Jane Doe" />
            </label>
            <label>
              <span className="rb-label">Email</span>
              <input className="rb-input" type="email" {...methods.register('personalInfo.email')} />
            </label>
            <label>
              <span className="rb-label">Phone</span>
              <input className="rb-input" {...methods.register('personalInfo.phone')} />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: '0.5rem' }}>
            <span className="rb-label">Location</span>
            <input className="rb-input" {...methods.register('personalInfo.location')} placeholder="City, Country" />
          </label>
          <div className="rb-row-2" style={{ marginTop: '0.35rem' }}>
            <label>
              <span className="rb-label">LinkedIn (optional)</span>
              <input className="rb-input" {...methods.register('personalInfo.linkedin')} />
            </label>
            <label>
              <span className="rb-label">Portfolio (optional)</span>
              <input className="rb-input" {...methods.register('personalInfo.portfolio')} />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: '0.35rem' }}>
            <span className="rb-label">Website</span>
            <input className="rb-input" {...methods.register('personalInfo.website')} />
          </label>
          <Controller
            name="personalInfo.photo"
            control={methods.control}
            render={({ field }) => (
              <PhotoUpload value={field.value || ''} onChange={(jpeg) => field.onChange(jpeg)} />
            )}
          />

          <div className="rb-section-head">
            <h3>Professional summary</h3>
          </div>
          <textarea className="rb-textarea" rows={5} {...methods.register('summary')} />

          <div className="rb-section-head">
            <h3>Experience</h3>
            <button type="button" className="rb-btn rb-btn-secondary" onClick={() => appendExp(newExperienceStub())}>
              + Role
            </button>
          </div>
          {expFields.map((row, idx) => (
            <div key={row.id} className="rb-card-lite">
              <div className="rb-row-2">
                <label>
                  <span className="rb-label">Job title</span>
                  <input className="rb-input" {...methods.register(`experience.${idx}.jobTitle`)} />
                </label>
                <label>
                  <span className="rb-label">Company</span>
                  <input className="rb-input" {...methods.register(`experience.${idx}.company`)} />
                </label>
              </div>
              <label style={{ marginTop: '0.35rem', display: 'block' }}>
                <span className="rb-label">Location</span>
                <input className="rb-input" {...methods.register(`experience.${idx}.location`)} />
              </label>
              <div className="rb-row-2" style={{ marginTop: '0.35rem', alignItems: 'end' }}>
                <label>
                  <span className="rb-label">Start MM/YYYY</span>
                  <input className="rb-input" {...methods.register(`experience.${idx}.startDate`)} placeholder="01/2022" />
                </label>
                <label style={{ opacity: methods.watch(`experience.${idx}.currentlyWorking`) ? 0.65 : 1 }}>
                  <span className="rb-label">End MM/YYYY or Present</span>
                  <input
                    className="rb-input"
                    disabled={methods.watch(`experience.${idx}.currentlyWorking`) === true}
                    {...methods.register(`experience.${idx}.endDate`)}
                  />
                </label>
              </div>
              <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', alignItems: 'center', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={methods.watch(`experience.${idx}.currentlyWorking`)}
                  onChange={(ev) => {
                    methods.setValue(`experience.${idx}.currentlyWorking`, ev.target.checked);
                    if (ev.target.checked) methods.setValue(`experience.${idx}.endDate`, 'Present');
                  }}
                />
                Currently employed here
              </label>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>
                <span className="rb-label">Role narrative</span>
                <textarea
                  className="rb-textarea"
                  {...methods.register(`experience.${idx}.description`)}
                  rows={5}
                  placeholder="Responsibilities, tools, achievements…"
                />
              </label>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>
                <span className="rb-label">Achievement bullets · one per line</span>
                <Controller
                  name={`experience.${idx}.achievements`}
                  control={methods.control}
                  render={({ field }) => (
                    <textarea
                      className="rb-textarea"
                      rows={4}
                      value={field.value.join('\n')}
                      onChange={(e) => field.onChange(e.target.value.replace(/\r\n/g, '\n').split('\n'))}
                      placeholder={`Grew inbound qualified pipeline…\nShipped KPI dashboard…`}
                    />
                  )}
                />
              </label>
              <div className="rb-mini-actions">
                <button type="button" className="rb-btn rb-btn-secondary" disabled={idx === 0} onClick={() => swapExp(idx, idx - 1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="rb-btn rb-btn-secondary"
                  disabled={idx >= expFields.length - 1}
                  onClick={() => swapExp(idx, idx + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="rb-btn rb-btn-secondary"
                  disabled={expFields.length <= 1}
                  onClick={() => removeExp(idx)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="rb-section-head">
            <h3>Education</h3>
            <button type="button" className="rb-btn rb-btn-secondary" onClick={() => appendEdu(educationStub())}>
              + School
            </button>
          </div>
          {eduFields.map((row, idx) => (
            <div key={row.id} className="rb-card-lite">
              <div className="rb-row-2">
                <label>
                  <span className="rb-label">Degree / program</span>
                  <input className="rb-input" {...methods.register(`education.${idx}.degree`)} />
                </label>
                <label>
                  <span className="rb-label">Institution</span>
                  <input className="rb-input" {...methods.register(`education.${idx}.institution`)} />
                </label>
              </div>
              <label style={{ marginTop: '0.35rem', display: 'block' }}>
                <span className="rb-label">Campus location</span>
                <input className="rb-input" {...methods.register(`education.${idx}.location`)} />
              </label>
              <div className="rb-row-2" style={{ marginTop: '0.35rem' }}>
                <label>
                  <span className="rb-label">Start MM/YYYY</span>
                  <input className="rb-input" {...methods.register(`education.${idx}.startDate`)} />
                </label>
                <label>
                  <span className="rb-label">End MM/YYYY / Present</span>
                  <input className="rb-input" {...methods.register(`education.${idx}.endDate`)} />
                </label>
              </div>
              <label style={{ display: 'block', marginTop: '0.35rem' }}>
                <span className="rb-label">GPA (optional)</span>
                <input className="rb-input" {...methods.register(`education.${idx}.gpa`)} />
              </label>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>
                <span className="rb-label">Honours / highlights · one line each</span>
                <Controller
                  name={`education.${idx}.achievements`}
                  control={methods.control}
                  render={({ field }) => (
                    <textarea
                      className="rb-textarea"
                      rows={3}
                      value={(field.value ?? []).join('\n')}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length)
                        )
                      }
                    />
                  )}
                />
              </label>
              <div className="rb-mini-actions">
                <button type="button" className="rb-btn rb-btn-secondary" disabled={idx === 0} onClick={() => swapEdu(idx, idx - 1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="rb-btn rb-btn-secondary"
                  disabled={idx >= eduFields.length - 1}
                  onClick={() => swapEdu(idx, idx + 1)}
                >
                  ↓
                </button>
                <button type="button" className="rb-btn rb-btn-secondary" disabled={eduFields.length <= 1} onClick={() => removeEdu(idx)}>
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="rb-section-head">
            <h3>Skills</h3>
          </div>
          <label style={{ display: 'block' }}>
            <span className="rb-label">Technical · commas or newline</span>
            <Controller
              name="skills.technical"
              control={methods.control}
              render={({ field }) => (
                <textarea
                  className="rb-textarea"
                  rows={4}
                  value={field.value.join('\n')}
                  onChange={(ev) =>
                    field.onChange(
                      ev.target.value.includes(',')
                        ? ev.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        : ev.target.value.replace(/\r\n/g, '\n').split('\n')
                    )
                  }
                />
              )}
            />
          </label>
          <label style={{ display: 'block', marginTop: '0.5rem' }}>
            <span className="rb-label">Soft · commas or newline</span>
            <Controller
              name="skills.soft"
              control={methods.control}
              render={({ field }) => (
                <textarea
                  className="rb-textarea"
                  rows={3}
                  value={field.value.join('\n')}
                  onChange={(ev) =>
                    field.onChange(
                      ev.target.value.includes(',')
                        ? ev.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        : ev.target.value.replace(/\r\n/g, '\n').split('\n')
                    )
                  }
                />
              )}
            />
          </label>
          <span className="rb-label">Languages</span>
          <LanguageRows />

          <div className="rb-section-head">
            <h3>Certifications</h3>
          </div>
          <RepeatableCerts />

          <div className="rb-section-head">
            <h3>Projects</h3>
          </div>
          <RepeatableProjects />

          <div className="rb-section-head">
            <h3>References</h3>
          </div>
          <RepeatableReferences />
        </div>

        <div className="rb-panel rb-preview-shell">
          <div className="rb-section-head">
            <h3>Live preview (~{pages} pg)</h3>
          </div>
          <ResumeHtmlPreview resume={previewResume} template={template} zoomPct={previewZoomPct} />
        </div>
      </div>
    </FormProvider>
  );
}
