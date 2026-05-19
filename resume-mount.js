(function () {
  /**
   * Mount the React resume builder once #resume-root is reachable.
   * The JS bundle attaches window.mountResumeBuilder from resume-dist/resume-builder.js.
   */
  function resumeHost() {
    return document.getElementById('resume-root');
  }

  function resumeHashActive() {
    var raw = window.location.hash || '#dashboard';
    var page = String(raw.slice(1) || 'dashboard').toLowerCase();
    return page === 'resume';
  }

  function mountIfNeeded() {
    var root = resumeHost();
    if (!root || !window.mountResumeBuilder) return false;
    if (root.dataset.rbMounted === '1') return true;
    window.mountResumeBuilder(root);
    root.dataset.rbMounted = '1';
    return true;
  }

  function tryMountSoon() {
    if (!resumeHashActive()) return;
    mountIfNeeded();
  }

  window.addEventListener('hashchange', tryMountSoon);
  window.addEventListener('DOMContentLoaded', tryMountSoon);
  // If scripts load deferred after DOM ready
  tryMountSoon();
})();
