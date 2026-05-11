/**
 * Dashboard Content tab: multi-step AI social copy (server-side OpenAI + daily cap).
 *
 * Image pipeline runs only on the server (see server.js POST /api/content-generate):
 *   const hctiResult = await renderImageViaHCTI(html);
 *   const enhanced = await enhanceImageFromDataUri(hctiResult.base64, ctx);
 *   const finalBase64 = enhanced ? enhanced.base64 : hctiResult.base64;
 *   const permanentUrl = await uploadImageToSupabase(finalBase64, postId);
 *   const finalImageUrl = permanentUrl || hctiResult.url;
 * The API returns posts with imageBase64 and imageUrl (Supabase public URL when upload succeeds).
 */
(function (global) {
  var currentStep = 1;
  var selectedPlatforms = [];
  var loadingMsgInterval = null;

  var PLATFORM_LABELS = {
    linkedin: 'LinkedIn',
    twitter: 'Twitter / X',
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok'
  };

  var LOADING_MESSAGES = [
    'Analyzing your brand voice…',
    'Studying platform best practices…',
    'Crafting compelling hooks…',
    'Optimizing hashtag strategy…',
    'Designing your visual…',
    'Rendering card artwork…',
    'Polishing visuals with AI…',
    'Generating post graphics…',
    'Rendering brand imagery…',
    'Polishing the final copy…',
    'Almost there…'
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function updateContentPostLimitDisplay() {
    var el = $('content-post-limit-display');
    if (!el) return;
    fetch('/api/content-post-limit', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return;
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        var used = data.used != null ? data.used : 0;
        if (data.limit == null && data.mode === 'unlimited') {
          el.textContent = 'Posts per day: unlimited';
        } else {
          var limit = data.limit != null ? data.limit : 0;
          var rem = data.remaining != null ? data.remaining : Math.max(0, limit - used);
          el.textContent = 'Posts per day: ' + limit + ' (' + rem + ' remaining)';
        }
      })
      .catch(function () {
        el.textContent = '';
      });
  }

  function shakeField(id) {
    var el = $(id);
    if (!el) return;
    el.classList.add('content-tool-input-shake');
    el.style.borderColor = 'var(--error)';
    el.focus();
    setTimeout(function () {
      el.classList.remove('content-tool-input-shake');
      el.style.borderColor = '';
    }, 600);
  }

  function goStep(step) {
    if (step === 2) {
      var name = $('content-bizName').value.trim();
      var desc = $('content-bizDesc').value.trim();
      if (!name || !desc) {
        shakeField(!name ? 'content-bizName' : 'content-bizDesc');
        return;
      }
    }
    if (step === 3) {
      if (selectedPlatforms.length === 0) {
        var pe = $('content-platform-error');
        if (pe) pe.hidden = false;
        return;
      }
      var pe2 = $('content-platform-error');
      if (pe2) pe2.hidden = true;
    }

    document.querySelectorAll('.content-tool-panel').forEach(function (p) {
      p.classList.toggle('visible', p.id === 'content-panel' + step);
    });
    var i;
    for (i = 1; i <= 4; i++) {
      var dot = $('content-dot' + i);
      if (dot) {
        dot.className = 'content-tool-step-dot ' + (i < step ? 'done' : i === step ? 'active' : 'inactive');
      }
    }
    for (i = 1; i <= 3; i++) {
      var conn = $('content-conn' + i);
      if (conn) {
        conn.className = 'content-tool-step-connector' + (i < step ? ' filled' : '');
      }
    }
    currentStep = step;
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { /* ignore */ }
  }

  function togglePlatformCard(btn, platform) {
    var idx = selectedPlatforms.indexOf(platform);
    if (idx !== -1) {
      selectedPlatforms.splice(idx, 1);
      btn.classList.remove('selected');
    } else {
      selectedPlatforms.push(platform);
      btn.classList.add('selected');
    }
    var pe = $('content-platform-error');
    if (pe) pe.hidden = true;
  }

  function generateContent() {
    var topic = $('content-topic').value.trim();
    if (!topic) {
      shakeField('content-topic');
      return;
    }

    var payload = {
      businessName: $('content-bizName').value.trim(),
      businessDescription: $('content-bizDesc').value.trim(),
      targetAudience: $('content-bizAudience').value.trim(),
      platforms: selectedPlatforms.slice(),
      contentTopic: topic,
      tone: $('content-tone').value,
      contentGoal: $('content-goal').value
    };

    var overlay = $('content-loading-overlay');
    var loadingText = $('content-loading-text');
    var btn = $('content-generate-btn');
    if (overlay) overlay.hidden = false;
    if (btn) btn.disabled = true;

    var msgIdx = 0;
    if (loadingMsgInterval) clearInterval(loadingMsgInterval);
    loadingMsgInterval = setInterval(function () {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      if (loadingText) loadingText.textContent = LOADING_MESSAGES[msgIdx];
    }, 2800);

    fetch('/api/content-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) {
            var msg = (d && d.error) ? d.error : 'Generation failed';
            throw new Error(msg);
          }
          return d;
        });
      })
      .then(function (data) {
        var posts = data.posts || [];
        renderResults(posts);
        goStep(4);
        updateContentPostLimitDisplay();
      })
      .catch(function (err) {
        if (global.utils && global.utils.toast) {
          global.utils.toast(err.message || 'Generation failed', 'error');
        } else {
          alert(err.message || 'Generation failed');
        }
      })
      .finally(function () {
        if (loadingMsgInterval) clearInterval(loadingMsgInterval);
        loadingMsgInterval = null;
        if (overlay) overlay.hidden = true;
        if (btn) btn.disabled = false;
      });
  }

  function renderResults(platforms) {
    var tabsEl = $('content-result-tabs');
    var contentEl = $('content-result-body');
    if (!tabsEl || !contentEl) return;
    tabsEl.innerHTML = '';
    contentEl.innerHTML = '';

    platforms.forEach(function (p, i) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'content-tool-result-tab' + (i === 0 ? ' active' : '');
      tab.textContent = PLATFORM_LABELS[p.platform] || p.platform;
      tab.setAttribute('data-platform', p.platform);
      tab.addEventListener('click', function () {
        switchContentTab(p.platform);
      });
      tabsEl.appendChild(tab);

      var div = document.createElement('div');
      div.className = 'content-tool-output' + (i === 0 ? ' visible' : '');
      div.id = 'content-output-' + p.platform;

      var hashtags = (p.hashtags || []).map(function (h) {
        return '<span class="content-tool-hashtag">' + escapeHtml(String(h)) + '</span>';
      }).join('');
      var charCount = p.characterCount || (p.content && p.content.length) || 0;
      var safeContent = escapeHtml(p.content || '').replace(/\n/g, '<br>');
      var platLabel = PLATFORM_LABELS[p.platform] || p.platform;
      var imageBlock = '';
      if (p.imageBase64 || p.imageUrl) {
        var imgSrc =
          p.imageUrl && /^https?:/gi.test(p.imageUrl) ? p.imageUrl : p.imageBase64 || '';
        var dlHref = p.imageUrl && /^https?:/i.test(p.imageUrl) ? p.imageUrl : p.imageBase64 || '';
        imageBlock =
          '<div class="content-tool-image-wrapper">' +
          '<img src="' +
          escapeHtml(imgSrc) +
          '" class="content-tool-post-image" alt="Generated post image for ' +
          escapeHtml(platLabel) +
          '">' +
          '<a href="' +
          escapeHtml(dlHref) +
          '" download="post-' +
          escapeHtml(p.platform) +
          '.png" class="btn btn-secondary btn-sm content-tool-download-btn">⬇ Download Image</a>' +
          '</div>';
      }

      div.innerHTML =
        imageBlock +
        '<div class="content-tool-result-box">' +
        '<div class="content-tool-result-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm content-tool-copy-btn" data-copy-platform="' +
        escapeHtml(p.platform) +
        '">Copy</button>' +
        '</div>' +
        '<div class="content-tool-result-text" id="content-text-' +
        escapeHtml(p.platform) +
        '">' +
        safeContent +
        '</div>' +
        (hashtags ? '<div class="content-tool-hashtag-row">' + hashtags + '</div>' : '') +
        (p.callToAction
          ? '<div class="content-tool-cta"><strong>CTA:</strong> ' + escapeHtml(p.callToAction) + '</div>'
          : '') +
        '<div class="content-tool-meta-row">' +
        '<span class="content-tool-meta-pill">' +
        charCount +
        ' characters</span>' +
        '<span class="content-tool-meta-pill">' +
        escapeHtml(p.postType || 'text') +
        '</span>' +
        '<span class="content-tool-meta-pill">' +
        escapeHtml(PLATFORM_LABELS[p.platform] || p.platform) +
        '</span>' +
        '</div></div>';
      contentEl.appendChild(div);
    });

    contentEl.querySelectorAll('.content-tool-copy-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var plat = b.getAttribute('data-copy-platform');
        copyContentText(plat, b);
      });
    });
  }

  function switchContentTab(platform) {
    document.querySelectorAll('.content-tool-result-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-platform') === platform);
    });
    document.querySelectorAll('.content-tool-output').forEach(function (o) {
      o.classList.toggle('visible', o.id === 'content-output-' + platform);
    });
  }

  function copyContentText(platform, btn) {
    var textEl = $('content-text-' + platform);
    if (!textEl || !btn) return;
    var text = textEl.textContent || '';
    navigator.clipboard.writeText(text).then(function () {
      var prev = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function () {
        btn.textContent = prev;
      }, 2000);
    });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function onContentPageVisible() {
    if (getPageId() !== 'content') return;
    updateContentPostLimitDisplay();
  }

  function getPageId() {
    var hash = (window.location.hash || '#dashboard').slice(1).toLowerCase();
    return hash || 'dashboard';
  }

  function bind() {
    var g2 = $('content-go-step2');
    if (g2) g2.addEventListener('click', function () { goStep(2); });
    var g3 = $('content-go-step3');
    if (g3) g3.addEventListener('click', function () { goStep(3); });
    var b1 = $('content-back-1');
    if (b1) b1.addEventListener('click', function () { goStep(1); });
    var b2 = $('content-back-2');
    if (b2) b2.addEventListener('click', function () { goStep(2); });
    var b3 = $('content-back-3');
    if (b3) b3.addEventListener('click', function () { goStep(3); });
    var gen = $('content-generate-btn');
    if (gen) gen.addEventListener('click', generateContent);
    var so = $('content-start-over');
    if (so) {
      so.addEventListener('click', function () {
        selectedPlatforms = [];
        document.querySelectorAll('.content-tool-platform-card').forEach(function (c) {
          c.classList.remove('selected');
        });
        goStep(1);
      });
    }
    var grid = $('content-platform-grid');
    if (grid) {
      grid.querySelectorAll('.content-tool-platform-card').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var plat = btn.getAttribute('data-platform');
          if (plat) togglePlatformCard(btn, plat);
        });
      });
    }
    window.addEventListener('hashchange', onContentPageVisible);
    onContentPageVisible();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  global.contentTool = {
    updateContentPostLimitDisplay: updateContentPostLimitDisplay,
    goStep: goStep
  };
})(typeof window !== 'undefined' ? window : this);
