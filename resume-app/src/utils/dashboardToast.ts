export function dashboardToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  if (typeof window === 'undefined') return;
  if (!window.utils?.toast) {
    window.alert(message);
    return;
  }
  window.utils.toast(message, type);
}

export function dashboardDownload(blob: Blob, filename: string): void {
  if (typeof window !== 'undefined' && window.utils?.downloadBlob) {
    window.utils.downloadBlob(blob, filename);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

declare global {
  interface Window {
    utils?: {
      toast(message: string, type?: 'success' | 'error' | 'info'): void;
      downloadBlob(blob: Blob, filename: string): void;
    };
  }
}
