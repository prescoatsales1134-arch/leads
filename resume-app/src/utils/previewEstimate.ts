import type { Resume } from '@/types/resume';

/** Rough page estimate for preview UI (does not mirror @react-pdf pagination exactly) */
export function estimateResumePages(resume: Resume): number {
  let u = resume.summary.trim().length / 1400;

  resume.experience.forEach((ex) => {
    u +=
      (ex.jobTitle.trim() ? 1 : 0.2) +
      ex.description.trim().split(/\n/).length * 0.12 +
      ex.achievements.filter((a) => a.trim()).length * 0.12;
  });

  resume.education.forEach((ed) => {
    u +=
      ed.degree.trim() || ed.institution.trim()
        ? 0.85 + (ed.achievements?.filter((a) => a.trim()).length || 0) * 0.08
        : 0;
  });

  const skillsCount =
    resume.skills.technical.filter((s) => s.trim()).length +
    resume.skills.soft.filter((s) => s.trim()).length +
    resume.skills.languages.filter((l) => l.language.trim()).length;
  u += skillsCount * 0.05;

  u +=
    resume.certifications.filter((c) => c.name.trim()).length * 0.25 +
    resume.projects.filter((p) => p.name.trim()).length * 0.4 +
    resume.references.filter((r) => r.name.trim()).length * 0.35 +
    (resume.personalInfo.photo ? 0.15 : 0);

  const pages = Math.ceil(u || 1);
  return Math.min(Math.max(pages, 1), 6);
}
