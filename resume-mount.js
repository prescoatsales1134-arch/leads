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

  function showMissingBundleFallback() {
    var root = resumeHost();
    if (!root || root.dataset.rbMounted === '1' || root.dataset.rbMissingMsg === '1') return;
    root.dataset.rbMissingMsg = '1';
    root.innerHTML =
      '<div class="card resume-bundle-missing" style="max-width: 42rem; border-color: rgba(239, 68, 68, 0.35);">' +
      '<h2 class="card-title" style="margin-top: 0;">Résumé UI not loaded</h2>' +
      '<p class="text-muted" style="margin-bottom: 0.75rem;">The file <code>resume-dist/resume-builder.js</code> did not load, so the builder cannot start. ' +
      'On the server, from the project root, run:</p>' +
      '<pre style="overflow:auto;font-size:0.85rem;padding:0.75rem;border-radius:8px;background:rgba(0,0,0,0.35);border:1px solid var(--border);">' +
      'npm run build:resume\n' +
      '</pre>' +
      '<p class="text-muted" style="margin-bottom: 0;">Then refresh this page (or redeploy so <code>resume-dist/</code> is present).</p>' +
      '</div>';
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
    if (mountIfNeeded()) return;
    if (typeof window.mountResumeBuilder !== 'function') {
      window.setTimeout(function () {
        if (!resumeHashActive()) return;
        if (typeof window.mountResumeBuilder === 'function') {
          var host = resumeHost();
          if (host) {
            delete host.dataset.rbMissingMsg;
            host.innerHTML = '';
          }
          mountIfNeeded();
          return;
        }
        showMissingBundleFallback();
      }, 600);
    }
  }

  window.addEventListener('hashchange', tryMountSoon);
  window.addEventListener('DOMContentLoaded', tryMountSoon);
  tryMountSoon();
})();
