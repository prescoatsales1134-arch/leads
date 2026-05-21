import { create } from 'zustand';
import type { ResumeTemplateId } from '@/types/resume';
import type { CareerFocusId } from '@/utils/resumeAssistApi';

type UiState = {
  template: ResumeTemplateId;
  previewZoomPct: number;
  lastSavedAt: number | null;
  pdfGeneration: boolean;
  careerFocus: CareerFocusId;
  setTemplate: (t: ResumeTemplateId) => void;
  setPreviewZoomPct: (z: number) => void;
  setLastSavedAt: (t: number) => void;
  setPdfGeneration: (b: boolean) => void;
  setCareerFocus: (f: CareerFocusId) => void;
};

export const useResumeUiStore = create<UiState>((set) => ({
  template: 'ats',
  previewZoomPct: 90,
  lastSavedAt: null,
  pdfGeneration: false,
  careerFocus: 'b2b_sales',
  setTemplate: (template) => set({ template }),
  setPreviewZoomPct: (previewZoomPct) => set({ previewZoomPct }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  setPdfGeneration: (pdfGeneration) => set({ pdfGeneration }),
  setCareerFocus: (careerFocus) => set({ careerFocus }),
}));
