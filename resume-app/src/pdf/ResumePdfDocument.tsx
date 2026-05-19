/**
 * Three @react-pdf/renderer templates (Helvetica / Times-Roman, print margins).
 */
import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Resume, ResumeTemplateId } from '@/types/resume';

const M = 40;

function contactLine(pi: Resume['personalInfo']): string {
  const bits = [pi.email, pi.phone, pi.location].filter(Boolean);
  if (pi.linkedin) bits.push(`LinkedIn ${pi.linkedin}`);
  if (pi.portfolio) bits.push(pi.portfolio);
  if (pi.website) bits.push(pi.website);
  return bits.join('  ·  ');
}

function AchievementLines({
  bullets,
  textStyle,
}: {
  bullets: string[];
  textStyle?: { fontSize?: number; lineHeight?: number };
}) {
  const items = bullets.map((x) => x.trim()).filter(Boolean);
  if (!items.length) return null;
  const bulletStyle = textStyle ?? { fontSize: 9, lineHeight: 1.35 };
  return (
    <View wrap={false} style={{ marginTop: 4 }}>
      {items.map((line, i) => (
        <View key={`b-${i}`} style={{ flexDirection: 'row', marginBottom: 2 }}>
          <Text style={bulletStyle}>• </Text>
          <Text style={[bulletStyle, { flex: 1, paddingLeft: 2 }]}>
            {line}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Plain ATS-focused single column — US Letter, no graphics, Helvetica (parser-safe) */
export function AtsPdfDocument({ resume }: { resume: Resume }) {
  const s = StyleSheet.create({
    page: { padding: M, fontSize: 10, fontFamily: 'Helvetica', color: '#111' },
    h1: { fontSize: 15, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
    contact: { fontSize: 9, marginBottom: 10 },
    rule: { height: 1, backgroundColor: '#333', marginBottom: 8 },
    sec: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 5, textTransform: 'uppercase' },
    meta: { fontSize: 9, color: '#333', marginBottom: 2 },
    body: { fontSize: 9, lineHeight: 1.4 },
    sub: { fontSize: 9, marginTop: 6, marginBottom: 3, fontFamily: 'Helvetica-Bold' },
  });

  return (
    <Document title="Resume">
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>{resume.personalInfo.fullName || 'Applicant Name'}</Text>
        <Text style={s.contact}>{contactLine(resume.personalInfo)}</Text>
        <View style={s.rule} />

        {!!resume.summary.trim() && (
          <>
            <Text style={s.sec}>Summary</Text>
            <Text style={s.body}>{resume.summary.trim()}</Text>
          </>
        )}

        <Text style={s.sec}>Experience</Text>
        {resume.experience.map((ex) => (
          <View key={ex.id} wrap={false} style={{ marginBottom: 8 }}>
            <Text style={s.sub}>{ex.jobTitle}</Text>
            <Text style={s.meta}>{[ex.company, ex.location].filter(Boolean).join(' · ')}</Text>
            <Text style={s.meta}>{`${ex.startDate} — ${ex.endDate}`}</Text>
            {!!ex.description.trim() && (
              <Text style={[s.body, { marginTop: 3 }]}>
                {ex.description.trim().replace(/\s+/gm, ' ')}
              </Text>
            )}
            <AchievementLines bullets={ex.achievements} textStyle={s.body} />
          </View>
        ))}

        <Text style={s.sec}>Education</Text>
        {resume.education.map((ed) => (
          <View key={ed.id} style={{ marginBottom: 6 }}>
            <Text style={s.sub}>{ed.degree}</Text>
            <Text style={s.meta}>{[ed.institution, ed.location].filter(Boolean).join(' · ')}</Text>
            <Text style={s.meta}>{`${ed.startDate} — ${ed.endDate}${ed.gpa ? ` · GPA ${ed.gpa}` : ''}`}</Text>
            <AchievementLines bullets={ed.achievements || []} textStyle={s.body} />
          </View>
        ))}

        <Text style={s.sec}>Skills</Text>
        <Text style={s.body}>
          {resume.skills.technical.filter(Boolean).length
            ? `Technical: ${resume.skills.technical.join(', ')}\n`
            : ''}
          {resume.skills.soft.filter(Boolean).length ? `Soft: ${resume.skills.soft.join(', ')}\n` : ''}
          {resume.skills.languages
            .filter((l) => l.language.trim())
            .map((l) => `${l.language}: ${l.proficiency}`)
            .join(' · ') || ''}
        </Text>

        {!!resume.certifications.length && (
          <>
            <Text style={s.sec}>Certifications</Text>
            {resume.certifications.map((c) => (
              <Text key={c.id} style={s.body}>
                {`${c.name} — ${c.issuer} (${c.date})`}
                {c.credentialId ? ` · ID ${c.credentialId}` : ''}
              </Text>
            ))}
          </>
        )}

        {!!resume.projects.length && (
          <>
            <Text style={s.sec}>Projects</Text>
            {resume.projects.map((p) => (
              <View key={p.id} style={{ marginBottom: 6 }}>
                <Text style={s.sub}>{p.name}</Text>
                <Text style={s.body}>{p.description}</Text>
                {p.technologies.filter(Boolean).length ? (
                  <Text style={[s.meta, { marginTop: 3 }]}>Stack: {p.technologies.join(', ')}</Text>
                ) : null}
              </View>
            ))}
          </>
        )}

        {!!resume.references.length && (
          <>
            <Text style={s.sec}>References</Text>
            {resume.references.map((r) => (
              <Text key={r.id} style={s.body}>
                {r.name} ({r.company}) · {r.position} · {r.email}
              </Text>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}

/** Two-column violet accent layout */
export function ModernPdfDocument({ resume }: { resume: Resume }) {
  const violet = '#6d28d9';
  const s = StyleSheet.create({
    page: { flexDirection: 'row', padding: 0 },
    sidebar: {
      width: '32%',
      backgroundColor: '#1e1e24',
      color: '#f4f4f5',
      padding: M - 10,
      minHeight: '100%',
    },
    body: {
      flex: 1,
      padding: M,
      fontSize: 9,
      fontFamily: 'Helvetica',
      backgroundColor: '#ffffff',
      color: '#171717',
    },
    name: { fontSize: 18, marginBottom: 6, fontFamily: 'Helvetica-Bold', color: '#fafafa' },
    sideLabel: {
      marginTop: 10,
      fontSize: 9,
      color: violet,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
    },
    sideText: { fontSize: 8, marginTop: 4, color: '#d4d4d8', lineHeight: 1.35 },
    photo: {
      alignSelf: 'center',
      width: 90,
      height: 112,
      objectFit: 'cover',
      marginBottom: 8,
      backgroundColor: '#333',
    },
    sec: {
      marginTop: 10,
      fontSize: 10,
      color: violet,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
    },
    hJob: { fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 2 },
    meta: { fontSize: 8, color: '#525252', marginBottom: 2 },
  });

  const photo = resume.personalInfo.photo?.trim();

  return (
    <Document title="Resume">
      <Page size="A4" style={s.page}>
        <View style={s.sidebar}>
          {photo?.startsWith('data:') ? <Image src={photo} style={s.photo} /> : null}
          <Text style={s.name}>{resume.personalInfo.fullName}</Text>
          <Text style={[s.sideText, { fontStyle: 'italic' }]}>{resume.personalInfo.location}</Text>
          <Text style={s.sideLabel}>Contact</Text>
          <Text style={s.sideText}>{resume.personalInfo.email}</Text>
          <Text style={s.sideText}>{resume.personalInfo.phone}</Text>
          {resume.personalInfo.linkedin ? <Text style={s.sideText}>{resume.personalInfo.linkedin}</Text> : null}
          {resume.personalInfo.portfolio ? <Text style={s.sideText}>{resume.personalInfo.portfolio}</Text> : null}
          <Text style={s.sideLabel}>Skills</Text>
          {resume.skills.technical.filter(Boolean).map((t, i) => (
            <View key={`t-${i}`} style={{ marginTop: 4 }}>
              <Text style={[s.sideText, { marginBottom: 2 }]}>{t}</Text>
              <View style={{ height: 3, backgroundColor: '#3f3f46', borderRadius: 10 }}>
                <View style={{ width: '92%', height: 3, backgroundColor: violet, borderRadius: 10 }} />
              </View>
            </View>
          ))}
          {resume.skills.soft.filter(Boolean).slice(0, 6).length ? (
            <>
              <Text style={[s.sideLabel, { marginTop: 12 }]}>Soft Skills</Text>
              {resume.skills.soft.filter(Boolean).slice(0, 6).map((t, i) => (
                <Text key={`sf-${i}`} style={[s.sideText, { marginTop: 4 }]}>
                  • {t}
                </Text>
              ))}
            </>
          ) : null}
          {resume.skills.languages.filter((l) => l.language.trim()).length ? (
            <>
              <Text style={s.sideLabel}>Languages</Text>
              {resume.skills.languages.map(
                (l, i) =>
                  l.language.trim() && (
                    <Text key={`lang-${i}`} style={[s.sideText, { marginTop: 3 }]}>
                      {l.language} — {l.proficiency}
                    </Text>
                  )
              )}
            </>
          ) : null}
        </View>

        <View style={s.body}>
          {!!resume.summary.trim() && (
            <>
              <Text style={[s.sec, { marginTop: 0 }]}>Professional summary</Text>
              <Text style={{ marginTop: 4, lineHeight: 1.45 }}>{resume.summary.trim()}</Text>
            </>
          )}

          <Text style={s.sec}>Experience</Text>
          {resume.experience.map((ex) => (
            <View key={ex.id} style={{ marginBottom: 10 }}>
              <Text style={s.hJob}>{ex.jobTitle}</Text>
              <Text style={s.meta}>{`${ex.company} · ${ex.startDate} — ${ex.endDate}`}</Text>
              <Text style={{ marginTop: 4, lineHeight: 1.42 }}>{ex.description.trim()}</Text>
              <AchievementLines bullets={ex.achievements} />
            </View>
          ))}

          <Text style={s.sec}>Education</Text>
          {resume.education.map((ed) => (
            <View key={ed.id} style={{ marginBottom: 8 }}>
              <Text style={s.hJob}>{ed.degree}</Text>
              <Text style={s.meta}>
                {[ed.institution, ed.location].filter(Boolean).join(' · ')}{' · '}
                {ed.startDate} — {ed.endDate}
                {ed.gpa ? ` · GPA ${ed.gpa}` : ''}
              </Text>
              <AchievementLines bullets={ed.achievements || []} />
            </View>
          ))}

          {!!resume.certifications.length ? (
            <>
              <Text style={s.sec}>Certifications</Text>
              {resume.certifications.map((c) => (
                <Text key={c.id} style={{ marginTop: 3 }}>
                  • {`${c.name} — ${c.issuer} (${c.date})`}
                </Text>
              ))}
            </>
          ) : null}
          {!!resume.projects.length ? (
            <>
              <Text style={s.sec}>Projects</Text>
              {resume.projects.map((p) => (
                <View key={p.id} wrap={false} style={{ marginBottom: 6 }}>
                  <Text style={[s.hJob, { marginTop: 6 }]}>{p.name}</Text>
                  <Text style={{ lineHeight: 1.4 }}>{p.description}</Text>
                  {!!p.link && <Text style={s.meta}>{p.link}</Text>}
                </View>
              ))}
            </>
          ) : null}
          {!!resume.references.length ? (
            <>
              <Text style={s.sec}>References</Text>
              {resume.references.map((r) => (
                <Text key={r.id} style={{ marginTop: 5 }}>
                  {r.name}, {r.position} — {r.company}: {r.email}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

/** Conservative single column Times */
export function ClassicPdfDocument({ resume }: { resume: Resume }) {
  const s = StyleSheet.create({
    page: { padding: M, fontFamily: 'Times-Roman', fontSize: 10, color: '#1a1a1a', lineHeight: 1.4 },
    h1: { fontSize: 19, marginBottom: 4, fontFamily: 'Times-Bold' },
    sub: { fontSize: 9, marginBottom: 10, fontFamily: 'Times-Italic', color: '#444' },
    rule: { height: 0.75, backgroundColor: '#111', marginBottom: 12 },
    sec: { fontFamily: 'Times-Bold', fontSize: 10, letterSpacing: 1, marginTop: 14, marginBottom: 8, borderBottomWidth: 0.75, borderBottomColor: '#111', paddingBottom: 4 },
    job: { fontFamily: 'Times-Bold', marginTop: 8 },
    meta: { fontSize: 9, color: '#444' },
  });

  return (
    <Document title="Resume">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{resume.personalInfo.fullName}</Text>
        <Text style={s.sub}>{contactLine(resume.personalInfo)}</Text>
        <View style={s.rule} />
        <Text style={[s.sec, { marginTop: 4 }]}>SUMMARY</Text>
        <Text>{resume.summary.trim()}</Text>
        <Text style={s.sec}>EXPERIENCE</Text>
        {resume.experience.map((ex) => (
          <View key={ex.id} wrap={false}>
            <Text style={s.job}>{ex.jobTitle}</Text>
            <Text style={s.meta}>{`${ex.company} · ${ex.startDate} — ${ex.endDate}`}</Text>
            {!!ex.description.trim() ? <Text style={{ marginTop: 6 }}>{ex.description.trim()}</Text> : null}
            <AchievementLines bullets={ex.achievements} />
          </View>
        ))}
        <Text style={s.sec}>EDUCATION</Text>
        {resume.education.map((ed) => (
          <View key={ed.id} wrap={false} style={{ marginBottom: 6 }}>
            <Text style={s.job}>{ed.degree}</Text>
            <Text style={s.meta}>
              {[ed.institution, ed.location].filter(Boolean).join(', ')}
              {' — '}
              {ed.startDate} — {ed.endDate}
            </Text>
            <AchievementLines bullets={ed.achievements || []} />
          </View>
        ))}
        <Text style={s.sec}>SKILLS</Text>
        <Text>{resume.skills.technical.concat(resume.skills.soft).filter(Boolean).join('; ')}</Text>
        <Text style={{ marginTop: 10 }}>
          {resume.skills.languages
            .filter((l) => l.language.trim())
            .map((l) => `${l.language} (${l.proficiency})`)
            .join('; ')}
        </Text>

        {!!resume.certifications.length ? (
          <>
            <Text style={s.sec}>CERTIFICATIONS</Text>
            {resume.certifications.map((c) => (
              <Text key={c.id} style={{ marginBottom: 4 }}>
                {c.name}, {c.issuer} — {c.date}
              </Text>
            ))}
          </>
        ) : null}

        {!!resume.projects.length ? (
          <>
            <Text style={s.sec}>SELECTED PROJECTS</Text>
            {resume.projects.map((p) => (
              <View key={p.id} wrap={false} style={{ marginBottom: 6 }}>
                <Text style={[s.job, { marginTop: 4 }]}>{p.name}</Text>
                <Text>{p.description}</Text>
                {p.link ? <Text style={s.meta}>{p.link}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {!!resume.references.length ? (
          <>
            <Text style={s.sec}>REFERENCES</Text>
            {resume.references.map((r) => (
              <Text key={r.id} style={{ marginBottom: 4 }}>
                {r.name} — {r.position}, {r.company}: {r.email}
              </Text>
            ))}
          </>
        ) : null}
      </Page>
    </Document>
  );
}

export function resumePdfDocFor(template: ResumeTemplateId, resume: Resume) {
  switch (template) {
    case 'ats':
      return <AtsPdfDocument resume={resume} />;
    case 'classic':
      return <ClassicPdfDocument resume={resume} />;
    default:
      return <ModernPdfDocument resume={resume} />;
  }
}
