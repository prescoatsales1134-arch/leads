/** Resume CV data model aligned with dashboard resume builder UX */
export type ProficiencyLevel = 'Native' | 'Fluent' | 'Professional' | 'Intermediate' | 'Basic';

export interface LanguageEntry {
  language: string;
  proficiency: ProficiencyLevel;
}

export interface ResumePersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  portfolio?: string;
  website?: string;
  photo?: string;
}

export interface ExperienceEntry {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string | 'Present';
  currentlyWorking: boolean;
  description: string;
  achievements: string[];
}

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string | 'Present';
  gpa?: string;
  achievements?: string[];
}

export interface ResumeSkills {
  technical: string[];
  soft: string[];
  languages: LanguageEntry[];
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  link?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReferenceEntry {
  id: string;
  name: string;
  position: string;
  company: string;
  email: string;
  phone: string;
}

export interface Resume {
  personalInfo: ResumePersonalInfo;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: ResumeSkills;
  certifications: CertificationEntry[];
  projects: ProjectEntry[];
  references: ReferenceEntry[];
}

export type ResumeTemplateId = 'ats' | 'modern' | 'classic';
