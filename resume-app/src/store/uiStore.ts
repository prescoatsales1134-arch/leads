import { create } from 'zustand';
import type { ResumeTemplateId } from '@/types/resume';

type UiState = {
  template: ResumeTemplateId;
  previewZoomPct: number;
  lastSavedAt: number | null;
  pdfGeneration: boolean;
  setTemplate: (t: ResumeTemplateId) => void;
  setPreviewZoomPct: (z: number) => void;
  setLastSavedAt: (t: number) => void;
  setPdfGeneration: (b: boolean) => void;
};

export const useResumeUiStore = create<UiState>((set) => ({
  template: 'modern',
  previewZoomPct: 90,
  lastSavedAt: null,
  pdfGeneration: false,
  setTemplate: (template) => set({ template }),
  setPreviewZoomPct: (previewZoomPct) => set({ previewZoomPct }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  setPdfGeneration: (pdfGeneration) => set({ pdfGeneration }),
}));
