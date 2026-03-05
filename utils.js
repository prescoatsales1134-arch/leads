/**
 * Shared utilities: env, toasts, loading, etc.
 */
(function (global) {
  function getEnv() {
    return global.__ENV__ || {};
  }

  function getEnvVar(name) {
    return getEnv()[name] || '';
  }

  /**
   * Show a toast message.
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   */
  function toast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', 'status');
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 4000);
  }

  /**
   * Show loading skeleton in element, hide others.
   * @param {string} loadingId - id of loading element
   * @param {string[]} hideIds - ids to hide while loading
   */
  function showLoading(loadingId, hideIds) {
    var loading = document.getElementById(loadingId);
    if (loading) loading.hidden = false;
    (hideIds || []).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  function hideLoading(loadingId, showIds) {
    var loading = document.getElementById(loadingId);
    if (loading) loading.hidden = true;
    (showIds || []).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = false;
    });
  }

  /**
   * Escape for CSV cell (wrap in quotes if contains comma/newline).
   */
  function escapeCsvCell(str) {
    if (str == null) return '';
    var s = String(str);
    if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  /**
   * Build CSV string from array of row objects. First row keys = header.
   */
  function toCSV(rows, columns) {
    if (!rows.length) return '';
    var cols = columns || Object.keys(rows[0]);
    var header = cols.map(escapeCsvCell).join(',');
    var lines = rows.map(function (row) {
      return cols.map(function (k) { return escapeCsvCell(row[k]); }).join(',');
    });
    return [header].concat(lines).join('\r\n');
  }

  /**
   * Trigger download of a blob as file.
   */
  function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  global.utils = {
    getEnv: getEnv,
    getEnvVar: getEnvVar,
    toast: toast,
    showLoading: showLoading,
    hideLoading: hideLoading,
    toCSV: toCSV,
    downloadBlob: downloadBlob,
    escapeCsvCell: escapeCsvCell
  };
})(typeof window !== 'undefined' ? window : this);
