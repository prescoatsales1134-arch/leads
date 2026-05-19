import { pdf } from '@react-pdf/renderer';
import type { ResumeTemplateId } from '@/types/resume';
import type { Resume } from '@/types/resume';
import { formatPdfValidationErrors, resumePdfSchema } from '@/schemas/resumeSchema';
import { normalizeResumeForPdf } from '@/utils/normalizeResumeForPdf';
import { dashboardDownload } from '@/utils/dashboardToast';
import { pdfResumeFilename } from '@/utils/pdfFilename';
import { resumePdfDocFor } from '@/pdf/ResumePdfDocument';

export async function exportResumePdf(resumeRaw: Resume, template: ResumeTemplateId): Promise<void> {
  const normalized = normalizeResumeForPdf(resumeRaw);
  const parsed = resumePdfSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error(formatPdfValidationErrors(parsed.error));
  }
  const data = parsed.data as Resume;
  const blob = await pdf(resumePdfDocFor(template, data)).toBlob();
  dashboardDownload(blob, pdfResumeFilename(data.personalInfo.fullName.trim()));
}
