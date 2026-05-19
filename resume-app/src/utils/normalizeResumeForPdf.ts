import { MMYYYY_REGEX } from '@/schemas/resumeSchema';
import type { EducationEntry, ExperienceEntry, Resume, ResumeSkills } from '@/types/resume';

function isMmYyyy(s: string): boolean {
  return MMYYYY_REGEX.test(s.trim());
}

function filterExperience(entries: ExperienceEntry[]): ExperienceEntry[] {
  return entries
    .filter(
      (ex) =>
        ex.jobTitle.trim().length >= 2 &&
        ex.company.trim().length >= 2 &&
        isMmYyyy(ex.startDate) &&
        (ex.currentlyWorking || ex.endDate === 'Present' || isMmYyyy(String(ex.endDate)))
    )
    .map((ex) => ({
      ...ex,
      endDate: (ex.currentlyWorking ? 'Present' : ex.endDate) as 'Present' | string,
      achievements: ex.achievements.map((a) => a.trim()).filter(Boolean),
    }));
}

function filterEducation(entries: EducationEntry[]): EducationEntry[] {
  return entries.filter(
    (ed) =>
      ed.degree.trim().length >= 2 &&
      ed.institution.trim().length >= 2 &&
      isMmYyyy(ed.startDate) &&
      (ed.endDate === 'Present' || isMmYyyy(String(ed.endDate)))
  );
}

function filterSkills(skills: ResumeSkills): ResumeSkills {
  return {
    technical: skills.technical.map((s) => s.trim()).filter(Boolean),
    soft: skills.soft.map((s) => s.trim()).filter(Boolean),
    languages: skills.languages
      .filter((l) => l.language.trim())
      .map((l) => ({
        language: l.language.trim(),
        proficiency: l.proficiency,
      })),
  };
}

/** Shape ready for `resumePdfSchema` — drops incomplete drafts; syncs Present when still employed */
export function normalizeResumeForPdf(input: Resume): Resume {
  const certifications = input.certifications
    .filter((c) => c.name.trim() && c.issuer.trim() && String(c.date).trim())
    .map((c) => ({
      ...c,
      expiryDate: c.expiryDate?.trim() || undefined,
      credentialId: c.credentialId?.trim() || undefined,
    }));

  const projects = input.projects.filter((p) => p.name.trim() && p.description.trim().length >= 3);

  const references = input.references.filter((r) => r.name.trim() && r.email.trim() && /\S+@\S+\.\S+/.test(r.email));

  const experience = filterExperience(input.experience);
  const education = filterEducation(input.education);
  const skills = filterSkills(input.skills);

  return {
    personalInfo: {
      ...input.personalInfo,
      fullName: input.personalInfo.fullName.trim(),
      email: input.personalInfo.email.trim(),
      phone: input.personalInfo.phone.trim(),
      location: input.personalInfo.location.trim(),
      linkedin: input.personalInfo.linkedin?.trim(),
      portfolio: input.personalInfo.portfolio?.trim(),
      website: input.personalInfo.website?.trim(),
      photo: input.personalInfo.photo?.trim(),
    },
    summary: input.summary.trim(),
    experience,
    education,
    skills,
    certifications,
    projects,
    references,
  };
}
