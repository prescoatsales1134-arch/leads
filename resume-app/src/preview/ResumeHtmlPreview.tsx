import type { Resume, ResumeTemplateId } from '@/types/resume';
import { estimateResumePages } from '@/utils/previewEstimate';

export function ResumeHtmlPreview({
  resume,
  template,
  zoomPct,
}: {
  resume: Resume;
  template: ResumeTemplateId;
  zoomPct: number;
}) {
  const pages = estimateResumePages(resume);
  return (
    <div className="rb-preview-sheet-wrap">
      <div className="rb-prev-meta">
        Estimated ~{pages} page{pages === 1 ? '' : 's'} · template matches PDF layout (margins/spacing approximate)
      </div>
      <div className="rb-preview-zoom-shell" style={{ transform: `scale(${zoomPct / 100})` }}>
        {template === 'ats' ? <AtsResumeHtml resume={resume} /> : null}
        {template === 'modern' ? <ModernResumeHtml resume={resume} /> : null}
        {template === 'classic' ? <ClassicResumeHtml resume={resume} /> : null}
      </div>
    </div>
  );
}

function contactBits(pi: Resume['personalInfo']) {
  return [pi.email, pi.phone, pi.location].filter(Boolean).join('  ·  ');
}

function AchievementList({ bullets }: { bullets: string[] }) {
  const items = bullets.map((x) => x.trim()).filter(Boolean);
  if (!items.length) return null;
  return (
    <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1rem' }}>
      {items.map((t, i) => (
        <li key={`l-${i}`} style={{ marginBottom: '0.15rem' }}>
          {t}
        </li>
      ))}
    </ul>
  );
}

function AtsResumeHtml({ resume }: { resume: Resume }) {
  return (
    <div className="rb-sheet rb-sheet--ats rb-sheet--letter">
      <h2 className="rb-sheet-title">{resume.personalInfo.fullName || 'Your name'}</h2>
      <div className="rb-sheet-muted">{contactBits(resume.personalInfo)}</div>
      {resume.personalInfo.linkedin ? <div className="rb-sheet-muted rb-sheet-link">{resume.personalInfo.linkedin}</div> : null}
      <div className="rb-sheet-rule" />
      {!!resume.summary.trim() && (
        <>
          <h3 className="rb-sheet-heading">SUMMARY</h3>
          <p className="rb-sheet-body">{resume.summary.trim()}</p>
        </>
      )}
      <h3 className="rb-sheet-heading">EXPERIENCE</h3>
      {resume.experience.map((ex) => (
        <article key={ex.id} style={{ marginBottom: '0.65rem' }}>
          <strong>{ex.jobTitle}</strong>
          <div className="rb-sheet-muted">{[ex.company, ex.location].filter(Boolean).join(' · ')}</div>
          <div className="rb-sheet-muted">
            {ex.startDate} — {ex.endDate}
          </div>
          {!!ex.description.trim() ? <p className="rb-sheet-body">{ex.description.trim()}</p> : null}
          <AchievementList bullets={ex.achievements} />
        </article>
      ))}
      <h3 className="rb-sheet-heading">EDUCATION</h3>
      {resume.education.map((ed) => (
        <article key={ed.id} style={{ marginBottom: '0.65rem' }}>
          <strong>{ed.degree}</strong>
          <div className="rb-sheet-muted">{[ed.institution, ed.location].filter(Boolean).join(' · ')}</div>
          <div className="rb-sheet-muted">
            {ed.startDate} — {ed.endDate}
            {ed.gpa ? ` · GPA ${ed.gpa}` : ''}
          </div>
          <AchievementList bullets={ed.achievements || []} />
        </article>
      ))}
      <h3 className="rb-sheet-heading">SKILLS</h3>
      <p className="rb-sheet-body">
        {resume.skills.technical.filter(Boolean).length ? <span>{resume.skills.technical.filter(Boolean).join(', ')}</span> : null}
        <br />
        {resume.skills.soft.filter(Boolean).join(', ') || ''}
        <br />
        {resume.skills.languages
          .filter((l) => l.language.trim())
          .map((l) => `${l.language} (${l.proficiency})`)
          .join(' · ') || ''}
      </p>
      {resume.certifications.filter((c) => c.name.trim()).length ? (
        <>
          <h3 className="rb-sheet-heading">CERTIFICATIONS</h3>
          {resume.certifications.map(
            (c) =>
              c.name.trim() && (
                <p key={c.id} className="rb-sheet-body">
                  {c.name} · {c.issuer} ({c.date})
                </p>
              )
          )}
        </>
      ) : null}
      {resume.projects.filter((p) => p.name.trim()).length ? (
        <>
          <h3 className="rb-sheet-heading">PROJECTS</h3>
          {resume.projects.map(
            (p) =>
              p.name.trim() && (
                <div key={p.id} style={{ marginBottom: '0.65rem' }}>
                  <strong>{p.name}</strong>
                  <p className="rb-sheet-body">{p.description}</p>
                </div>
              )
          )}
        </>
      ) : null}
      {resume.references.filter((r) => r.name.trim()).length ? (
        <>
          <h3 className="rb-sheet-heading">REFERENCES</h3>
          {resume.references.map((r) =>
            r.name.trim() ? (
              <p key={r.id} className="rb-sheet-body">
                {r.name} — {r.position}, {r.email}
              </p>
            ) : null
          )}
        </>
      ) : null}
    </div>
  );
}

function ModernResumeHtml({ resume }: { resume: Resume }) {
  const pi = resume.personalInfo;
  return (
    <div className="rb-sheet rb-sheet--modern grid">
      <aside className="rb-modern-side">
        {pi.photo ? <img className="rb-modern-photo" src={pi.photo} alt="" /> : null}
        <h2 className="rb-modern-name">{pi.fullName || 'Your name'}</h2>
        <div className="rb-modern-small">{pi.location}</div>
        <div className="rb-modern-label">CONTACT</div>
        <div className="rb-modern-small">{pi.email}</div>
        <div className="rb-modern-small">{pi.phone}</div>
        {pi.linkedin ? <div className="rb-modern-small">{pi.linkedin}</div> : null}
        <div className="rb-modern-label">TECHNICAL</div>
        {resume.skills.technical.filter(Boolean).map((s, i) => (
          <div key={`t-${i}`} style={{ marginTop: '0.35rem' }}>
            <div className="rb-modern-small">{s}</div>
            <div className="rb-modern-bar-track">
              <div className="rb-modern-bar-fill" />
            </div>
          </div>
        ))}
        <div className="rb-modern-label">LANGUAGES</div>
        {resume.skills.languages.map(
          (l, i) =>
            l.language.trim() && (
              <div key={`lang-${i}`} className="rb-modern-small">
                {l.language} — {l.proficiency}
              </div>
            )
        )}
      </aside>
      <div className="rb-modern-main">
        {!!resume.summary.trim() ? (
          <>
            <div className="rb-modern-label alt">PROFILE</div>
            <p>{resume.summary.trim()}</p>
          </>
        ) : null}
        <div className="rb-modern-label alt">EXPERIENCE</div>
        {resume.experience.map((ex) => (
          <article key={ex.id} style={{ marginBottom: '0.85rem' }}>
            <strong>{ex.jobTitle}</strong>
            <div className="rb-modern-muted">
              {ex.company} · {ex.startDate} — {ex.endDate}
            </div>
            {!!ex.description.trim() ? <p style={{ marginTop: '0.35rem' }}>{ex.description.trim()}</p> : null}
            <AchievementList bullets={ex.achievements} />
          </article>
        ))}
        <div className="rb-modern-label alt">EDUCATION</div>
        {resume.education.map((ed) => (
          <article key={ed.id} style={{ marginBottom: '0.85rem' }}>
            <strong>{ed.degree}</strong>
            <div className="rb-modern-muted">{[ed.institution, ed.location].filter(Boolean).join(' · ')}</div>
            <AchievementList bullets={ed.achievements || []} />
          </article>
        ))}
      </div>
    </div>
  );
}

function ClassicResumeHtml({ resume }: { resume: Resume }) {
  return (
    <div className="rb-sheet rb-sheet--classic">
      <h2 style={{ margin: '0 0 0.25rem', fontFamily: `'Libre Baskerville', Georgia, serif`, fontWeight: 700 }}>
        {resume.personalInfo.fullName || 'Applicant'}
      </h2>
      <div className="rb-classic-sub">{contactBits(resume.personalInfo)}</div>
      <div className="rb-sheet-rule" />
      <h3 className="rb-classic-sec">Summary</h3>
      <p>{resume.summary.trim() || 'Compose a concise elevator pitch in the form.'}</p>
      <h3 className="rb-classic-sec">Experience</h3>
      {resume.experience.map((ex) => (
        <article key={ex.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <strong>{ex.jobTitle}</strong>
            <span className="rb-classic-muted">
              {ex.startDate} — {ex.endDate}
            </span>
          </div>
          <div className="rb-classic-muted">{ex.company}</div>
          {!!ex.description.trim() ? <p>{ex.description.trim()}</p> : null}
          <AchievementList bullets={ex.achievements} />
        </article>
      ))}
      <h3 className="rb-classic-sec">Education</h3>
      {resume.education.map((ed) => (
        <article key={ed.id}>
          <strong>{ed.degree}</strong>
          <div className="rb-classic-muted">
            {ed.institution} · {ed.startDate} — {ed.endDate}
          </div>
          <AchievementList bullets={ed.achievements || []} />
        </article>
      ))}
      <h3 className="rb-classic-sec">Skills</h3>
      <p>{[...resume.skills.technical, ...resume.skills.soft].filter(Boolean).join(' · ') || ''}</p>

      {resume.certifications.some((c) => c.name.trim()) ? (
        <>
          <h3 className="rb-classic-sec">Certifications</h3>
          {resume.certifications.map((c) =>
            c.name.trim() ? (
              <p key={c.id}>
                <strong>{c.name}</strong> — {c.issuer} ({c.date})
              </p>
            ) : null,
          )}
        </>
      ) : null}

      {resume.projects.some((p) => p.name.trim()) ? (
        <>
          <h3 className="rb-classic-sec">Projects</h3>
          {resume.projects.map((p) =>
            p.name.trim() ? (
              <div key={p.id} style={{ marginBottom: '0.65rem' }}>
                <strong>{p.name}</strong>
                <p>{p.description}</p>
              </div>
            ) : null,
          )}
        </>
      ) : null}

      {resume.references.some((r) => r.name.trim()) ? (
        <>
          <h3 className="rb-classic-sec">References</h3>
          {resume.references.map((r) =>
            r.name.trim() ? (
              <p key={r.id}>
                {r.name} ({r.company}) · {r.position} · {r.email}
              </p>
            ) : null,
          )}
        </>
      ) : null}
    </div>
  );
}
