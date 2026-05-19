import { z } from 'zod';

export const MMYYYY_REGEX = /^(\d{2})\/(\d{4})$/;
const dateOrEmpty = z.union([z.literal(''), z.string().regex(MMYYYY_REGEX)]);
const dateEndOrPresent = z.union([
  z.literal(''),
  z.literal('Present'),
  z.string().regex(MMYYYY_REGEX),
]);

export const proficiencySchema = z.enum(['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic']);

export const personalInfoSchema = z.object({
  fullName: z.string().max(160),
  email: z.string().max(200),
  phone: z.string().max(40),
  location: z.string().max(160),
  linkedin: z.string().max(500).optional().or(z.literal('')),
  portfolio: z.string().max(500).optional().or(z.literal('')),
  website: z.string().max(500).optional().or(z.literal('')),
  photo: z.string().optional().or(z.literal('')),
});

export const experienceSchema = z.object({
  id: z.string(),
  jobTitle: z.string().max(200),
  company: z.string().max(200),
  location: z.string().max(200).optional().or(z.literal('')),
  startDate: dateOrEmpty,
  endDate: dateEndOrPresent,
  currentlyWorking: z.boolean(),
  description: z.string().max(6000),
  achievements: z.array(z.string()).default([]),
});

export const educationSchema = z.object({
  id: z.string(),
  degree: z.string().max(200),
  institution: z.string().max(200),
  location: z.string().max(200).optional().or(z.literal('')),
  startDate: dateOrEmpty,
  endDate: dateEndOrPresent,
  gpa: z.string().max(20).optional().or(z.literal('')),
  achievements: z.array(z.string()).optional().default([]),
});

export const skillsSchema = z.object({
  technical: z.array(z.string().max(120)).default([]),
  soft: z.array(z.string().max(120)).default([]),
  languages: z
    .array(
      z.object({
        language: z.string().max(80),
        proficiency: proficiencySchema,
      })
    )
    .default([]),
});

/** Draft rows (often blank while composing) — validated strictly at PDF export */
export const certificationDraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string(),
  date: z.string(),
  expiryDate: z.string().optional().or(z.literal('')),
  credentialId: z.string().optional().or(z.literal('')),
});

export const certificationSchema = certificationDraftSchema.extend({
  name: z.string().min(1),
  issuer: z.string().min(1),
});

export const projectDraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().max(4000),
  technologies: z.array(z.string()),
  link: z.string().max(500).optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
});

export const projectSchema = projectDraftSchema.extend({
  name: z.string().min(1),
});

export const referenceDraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  company: z.string(),
  email: z.string(),
  phone: z.string(),
});

export const referenceSchema = referenceDraftSchema.extend({
  name: z.string().min(1),
  email: z.string().email(),
});

export const resumeSchema = z.object({
  personalInfo: personalInfoSchema,
  summary: z.string().max(4000),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  skills: skillsSchema,
  certifications: z.array(certificationDraftSchema).default([]),
  projects: z.array(projectDraftSchema).default([]),
  references: z.array(referenceDraftSchema).default([]),
});

const personalPdf = personalInfoSchema.extend({
  fullName: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email'),
  phone: z.string().min(6, 'Phone'),
  location: z.string().min(2, 'Location'),
});

const experiencePdf = experienceSchema.extend({
  jobTitle: z.string().min(2, 'Job title'),
  company: z.string().min(2, 'Company'),
  startDate: z.string().regex(MMYYYY_REGEX, 'Start: MM/YYYY'),
  endDate: z.union([
    z.literal('Present'),
    z.string().regex(MMYYYY_REGEX, 'End: MM/YYYY or Present'),
  ]),
});

const educationPdf = educationSchema.extend({
  degree: z.string().min(2),
  institution: z.string().min(2),
  startDate: z.string().regex(MMYYYY_REGEX),
  endDate: z.union([z.literal('Present'), z.string().regex(MMYYYY_REGEX)]),
});

/** Stricter validation before PDF generation */
export const resumePdfSchema = z.object({
  personalInfo: personalPdf,
  summary: z.string().max(4000),
  experience: z.array(experiencePdf).min(1, 'Add work experience'),
  education: z.array(educationPdf).min(1, 'Add education'),
  skills: skillsSchema,
  certifications: z.array(certificationSchema),
  projects: z.array(projectSchema),
  references: z.array(referenceSchema),
});

export type ResumeFormValues = z.infer<typeof resumeSchema>;

export function formatPdfValidationErrors(err: z.ZodError): string {
  return err.issues
    .slice(0, 6)
    .map((i) => i.path.join('.') + ': ' + i.message)
    .join(' · ');
}
