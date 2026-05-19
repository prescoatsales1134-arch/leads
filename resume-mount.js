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
    var bundleUrl =
      typeof location !== 'undefined' && location.origin
        ? location.origin + '/resume-dist/resume-builder.js'
        : '/resume-dist/resume-builder.js';
    root.innerHTML =
      '<div class="card resume-bundle-missing" style="max-width: 46rem; border-color: rgba(239, 68, 68, 0.35);">' +
      '<h2 class="card-title" style="margin-top: 0;">Résumé UI not loaded</h2>' +
      '<p class="text-muted" style="margin-bottom: 0.75rem;">The browser could not load the compiled bundle (so <code>window.mountResumeBuilder</code> never appears). Usually the file is missing on the server or a reverse proxy is blocking it.</p>' +
      '<p style="margin-bottom: 0.5rem;"><strong>Quick check:</strong> open this URL in a new tab. You should see JavaScript (very long line), not a 404 page:</p>' +
      '<p style="word-break: break-all; margin-bottom: 0.75rem;"><a href="' +
      bundleUrl +
      '" target="_blank" rel="noopener">' +
      bundleUrl +
      '</a></p>' +
      '<p class="text-muted" style="margin-bottom: 0.75rem;"><strong>On the VPS</strong>, from the same folder as <code>server.js</code>:</p>' +
      '<pre style="overflow:auto;font-size:0.85rem;padding:0.75rem;border-radius:8px;background:rgba(0,0,0,0.35);border:1px solid var(--border);">' +
      'git pull origin main\n' +
      'ls -la resume-dist/resume-builder.js\n' +
      'npm run build:resume   # only if ls shows missing files\n' +
      'pm2 restart leads-linked\n' +
      '</pre>' +
      '<p class="text-muted" style="margin-bottom: 0;">After <code>ls</code> shows the file, hard-refresh this dashboard (Ctrl+Shift+R).</p>' +
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
