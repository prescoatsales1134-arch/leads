import { v4 as uuid } from 'uuid';
import type { Resume } from '@/types/resume';

export function newResume(): Resume {
  return {
    personalInfo: {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      portfolio: '',
      website: '',
      photo: '',
    },
    summary: '',
    experience: [
      {
        id: uuid(),
        jobTitle: '',
        company: '',
        location: '',
        startDate: '',
        endDate: 'Present',
        currentlyWorking: true,
        description: '',
        achievements: [''],
      },
    ],
    education: [
      {
        id: uuid(),
        degree: '',
        institution: '',
        location: '',
        startDate: '',
        endDate: 'Present',
        gpa: '',
        achievements: [],
      },
    ],
    skills: { technical: [''], soft: [''], languages: [{ language: '', proficiency: 'Professional' }] },
    certifications: [],
    projects: [],
    references: [],
  };
}

export const STORAGE_KEY = 'lead-ai-resume-builder-v1';

export function parseStoredResume(raw: string | null): Resume | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Resume;
    if (!j?.personalInfo || !Array.isArray(j.experience)) return null;
    return j;
  } catch {
    return null;
  }
}

function skillList(ar: string[] | undefined, fallback: string[]): string[] {
  if (!ar?.length) return [...fallback];
  const trimmed = ar.map((s) => String(s ?? '').trim());
  return trimmed.some(Boolean) ? trimmed : [...fallback];
}

function langList(arr: Resume['skills']['languages'] | undefined): Resume['skills']['languages'] {
  if (!arr?.length) return [{ language: '', proficiency: 'Professional' }];
  return arr.filter((l) => l.language.trim()).length ? arr : [{ language: '', proficiency: 'Professional' }];
}

/** Merge partial localStorage JSON into sane defaults without dropping required IDs */
export function hydrateResume(parsed: Resume | null): Resume {
  const n = newResume();
  if (!parsed) return n;
  return {
    personalInfo: { ...n.personalInfo, ...parsed.personalInfo },
    summary: parsed.summary ?? '',
    experience:
      parsed.experience?.length && parsed.experience.some((x) => x.jobTitle.trim() || x.company.trim())
        ? parsed.experience
        : n.experience,
    education:
      parsed.education?.length && parsed.education.some((x) => x.degree.trim() || x.institution.trim())
        ? parsed.education
        : n.education,
    skills: {
      technical: skillList(parsed.skills?.technical, n.skills.technical),
      soft: skillList(parsed.skills?.soft, n.skills.soft),
      languages: langList(parsed.skills?.languages),
    },
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    references: Array.isArray(parsed.references) ? parsed.references : [],
  };
}
