/**
 * Competitor Analysis tab: URL → server → n8n; tabbed report with card-based layout.
 * UI patterns aligned with hierarchy, elevation, and spacing best practices (dashboard / SaaS).
 */
(function (global) {
  var TAB_SPECS = [
    { id: 'overview', label: 'Overview', subtitle: 'Executive snapshot & data coverage' },
    { id: 'sentiment', label: 'Sentiment', subtitle: 'Scores, themes, and sources' },
    { id: 'brand', label: 'Brand perception', subtitle: 'Position, UVPs, weaknesses' },
    { id: 'competitors', label: 'Competitors', subtitle: 'Landscape & intelligence' },
    { id: 'pr_risk', label: 'PR & risks', subtitle: 'Issues, threats, readiness' },
    { id: 'viral', label: 'Viral & trends', subtitle: 'Topics, campaigns, momentum' },
    { id: 'customers', label: 'Customer voice', subtitle: 'Pain points, churn, NPS' },
    { id: 'market', label: 'Market opportunities', subtitle: 'Gaps, segments, whitespace' },
    { id: 'strategy', label: 'Strategy & actions', subtitle: 'Recommendations & monitoring' },
    { id: 'platforms', label: 'Platform breakdown', subtitle: 'Channel-level insights' },
    { id: 'data_quality', label: 'Data quality', subtitle: 'Confidence & limitations' },
    { id: 'complete', label: 'Complete report', subtitle: 'Full structure (workflow metadata omitted)' }
  ];

  var TITLE_KEYS = [
    'theme',
    'title',
    'action',
    'issue',
    'threat',
    'priority',
    'uvp',
    'weakness',
    'advantage',
    'disadvantage',
    'gap',
    'segment',
    'need',
    'opportunity',
    'metric',
    'campaign',
    'topic',
    'influencer',
    'name',
    'request',
    'pain_point',
    'indicator',
    'vulnerability',
    'factor',
    'strategy',
    'label',
    'controversy',
    'headline'
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function getPageId() {
    var hash = (window.location.hash || '#dashboard').slice(1).toLowerCase();
    return hash || 'dashboard';
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Readable label: spaces, sentence case (first letter uppercase). */
  function humanizeKey(key) {
    var raw = String(key)
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, function (_, a, b) {
        return a + ' ' + b;
      })
      .trim();
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function formatLabel(key) {
    return escapeHtml(humanizeKey(key));
  }

  /** First character only; rest unchanged (for API-provided titles). */
  function capitalizeFirst(str) {
    if (str == null || str === '') return '';
    var s = String(str);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Keys omitted from competitor report UI (workflow / plumbing). */
  function isHiddenUiKey(k) {
    var id = String(k)
      .toLowerCase()
      .replace(/-/g, '_');
    return id === 'report_metadata' || id === 'parsing_status';
  }

  function cloneWithoutReportMetadata(node) {
    if (node == null) return node;
    if (Array.isArray(node)) {
      return node.map(cloneWithoutReportMetadata);
    }
    if (typeof node !== 'object') return node;
    var out = {};
    Object.keys(node).forEach(function (k) {
      if (isHiddenUiKey(k)) return;
      out[k] = cloneWithoutReportMetadata(node[k]);
    });
    return out;
  }

  function isFlatObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    return Object.keys(obj).every(function (k) {
      var t = typeof obj[k];
      return obj[k] === null || t === 'string' || t === 'number' || t === 'boolean';
    });
  }

  function isPercentBreakdownObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    var keys = Object.keys(obj);
    if (keys.length < 2) return false;
    if (!keys.every(function (k) { return typeof obj[k] === 'number'; })) return false;
    return keys.some(function (k) {
      return /percentage|percent$/i.test(k) || /^positive|^neutral|^negative/i.test(k);
    });
  }

  function renderPercentBreakdownUi(obj) {
    var entries = Object.keys(obj).map(function (k) {
      return { key: k, val: obj[k], label: formatLabel(k) };
    });
    return (
      '<div class="ca-breakdown-bars">' +
      entries
        .map(function (e) {
          var w = Math.min(100, Math.max(0, Number(e.val) || 0));
          var tone = /positive/i.test(e.key) ? 'pos' : /negative/i.test(e.key) ? 'neg' : 'mid';
          return (
            '<div class="ca-bar-row">' +
            '<div class="ca-bar-label"><span>' +
            e.label +
            '</span><span class="ca-bar-pct">' +
            w +
            '%</span></div>' +
            '<div class="ca-bar-track" role="presentation"><div class="ca-bar-fill ca-bar-' +
            tone +
            '" style="width:' +
            w +
            '%"></div></div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderKeyValueGrid(obj) {
    return (
      '<div class="ca-kv-grid">' +
      Object.keys(obj)
        .filter(function (k) {
          return !isHiddenUiKey(k);
        })
        .map(function (k) {
          return (
            '<div class="ca-kv-cell">' +
            '<span class="ca-kv-k">' +
            formatLabel(k) +
            '</span>' +
            '<div class="ca-kv-v">' +
            renderValueForCard(obj[k], 0) +
            '</div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function pickInsightTitleKey(item) {
    if (!item || typeof item !== 'object') return { key: null, title: null };
    for (var i = 0; i < TITLE_KEYS.length; i++) {
      var k = TITLE_KEYS[i];
      if (item[k] != null && String(item[k]).trim()) {
        return { key: k, title: String(item[k]).trim() };
      }
    }
    return { key: null, title: null };
  }

  function renderInsightCard(item, depth) {
    if (!item || typeof item !== 'object') {
      return (
        '<article class="ca-insight-card ca-insight-card--simple"><div class="ca-insight-body">' +
        renderValueForCard(item, depth) +
        '</div></article>'
      );
    }
    var picked = pickInsightTitleKey(item);
    var titleKey = picked.key;
    var title = picked.title;
    var rows = Object.keys(item)
      .filter(function (k) {
        return !isHiddenUiKey(k);
      })
      .map(function (k) {
        if (k === titleKey) return '';
        var v = item[k];
        return (
          '<div class="ca-insight-row">' +
          '<span class="ca-insight-k">' +
          formatLabel(k) +
          '</span>' +
          '<div class="ca-insight-v">' +
          renderValueForCard(v, depth + 1) +
          '</div></div>'
        );
      })
      .join('');
    return (
      '<article class="ca-insight-card">' +
      (title ? '<h4 class="ca-insight-title">' + escapeHtml(capitalizeFirst(title)) + '</h4>' : '') +
      '<div class="ca-insight-body">' +
      rows +
      '</div></article>'
    );
  }

  function renderArrayAsInsightCards(arr, depth) {
    return (
      '<div class="ca-insight-stack">' +
      arr
        .map(function (item) {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            return renderInsightCard(item, depth);
          }
          return (
            '<article class="ca-insight-card ca-insight-card--simple"><div class="ca-insight-body">' +
            renderValueForCard(item, depth) +
            '</div></article>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function wrapSubsection(titlePlain, innerHtml) {
    if (!innerHtml || !String(innerHtml).trim()) return '';
    return (
      '<div class="ca-subsection">' +
      '<h5 class="ca-subsection-title">' +
      escapeHtml(titlePlain) +
      '</h5>' +
      '<div class="ca-subsection-body">' +
      innerHtml +
      '</div></div>'
    );
  }

  function renderObjectInner(obj, depth) {
    if (depth > 12) return '<span class="ca-muted">…</span>';
    if (!obj || typeof obj !== 'object') return '<span class="ca-muted">—</span>';
    var keys = Object.keys(obj).filter(function (k) {
      return obj[k] !== undefined && !isHiddenUiKey(k);
    });
    if (keys.length === 0) return '<span class="ca-muted">—</span>';
    if (isPercentBreakdownObject(obj)) {
      return renderPercentBreakdownUi(obj);
    }
    if (isFlatObject(obj)) {
      return renderKeyValueGrid(obj);
    }
    return keys
      .map(function (k) {
        var v = obj[k];
        return wrapSubsection(humanizeKey(k), renderValueForCard(v, depth + 1));
      })
      .join('');
  }

  function renderValueForCard(val, depth) {
    if (depth > 14) return '<span class="ca-muted">…</span>';
    if (val === null || val === undefined) return '<span class="ca-null">—</span>';
    if (typeof val === 'boolean') {
      return val ? '<span class="ca-bool">Yes</span>' : '<span class="ca-bool">No</span>';
    }
    if (typeof val === 'number') {
      return '<span class="ca-num">' + escapeHtml(String(val)) + '</span>';
    }
    if (typeof val === 'string') {
      var s = val;
      if (s.length > 1200) {
        return '<p class="ca-para">' + escapeHtml(s) + '</p>';
      }
      return '<span class="ca-str">' + escapeHtml(s) + '</span>';
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return '<span class="ca-muted">Empty list</span>';
      if (val.every(function (x) {
        return x !== null && typeof x === 'object' && !Array.isArray(x);
      })) {
        return renderArrayAsInsightCards(val, depth);
      }
      return (
        '<ul class="ca-list">' +
        val
          .map(function (x) {
            return '<li>' + renderValueForCard(x, depth + 1) + '</li>';
          })
          .join('') +
        '</ul>'
      );
    }
    if (typeof val === 'object') {
      return '<div class="ca-inline-nest">' + renderObjectInner(val, depth + 1) + '</div>';
    }
    return escapeHtml(String(val));
  }

  function renderDataCollectionStats(obj) {
    return (
      '<div class="ca-stat-grid">' +
      Object.keys(obj)
        .filter(function (k) {
          return !isHiddenUiKey(k);
        })
        .map(function (k) {
          return (
            '<div class="ca-stat-cell">' +
            '<span class="ca-stat-cell-label">' +
            formatLabel(k) +
            '</span>' +
            '<span class="ca-stat-cell-value">' +
            escapeHtml(String(obj[k])) +
            '</span></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderExecutiveSummaryHero(ex) {
    if (!ex || typeof ex !== 'object') return '';
    var brand = ex.brand || '';
    var domain = ex.domain || '';
    var score = ex.overall_sentiment_score;
    var risk = ex.risk_level || '';
    var pos = ex.market_position || '';
    var social = ex.social_momentum || '';
    var findings = Array.isArray(ex.key_findings) ? ex.key_findings : [];

    var eyebrowParts = [];
    if (brand) eyebrowParts.push(brand);
    if (domain) eyebrowParts.push(domain);
    var eyebrowLine = eyebrowParts.length ? eyebrowParts.join(' · ') : '';
    if (eyebrowLine) {
      eyebrowLine = capitalizeFirst(eyebrowLine);
    }
    var eyebrow = eyebrowLine
      ? '<div class="ca-hero-eyebrow">' + escapeHtml(eyebrowLine) + '</div>'
      : '';

    var metrics = '';
    if (score !== undefined && score !== null) {
      metrics +=
        '<div class="ca-hero-stat ca-hero-stat--score">' +
        '<span class="ca-hero-stat-label">Sentiment score</span>' +
        '<span class="ca-hero-stat-value">' +
        escapeHtml(String(score)) +
        '</span></div>';
    }
    if (risk) {
      metrics +=
        '<div class="ca-hero-stat">' +
        '<span class="ca-hero-stat-label">Risk level</span>' +
        '<span class="ca-badge ca-badge-risk ca-risk--' +
        escapeHtml(String(risk).toLowerCase().replace(/[^a-z0-9]+/g, '-')) +
        '">' +
        escapeHtml(String(risk)) +
        '</span></div>';
    }
    if (pos) {
      metrics +=
        '<div class="ca-hero-stat">' +
        '<span class="ca-hero-stat-label">Market position</span>' +
        '<span class="ca-badge ca-badge-neutral">' +
        escapeHtml(String(pos)) +
        '</span></div>';
    }
    if (social) {
      metrics +=
        '<div class="ca-hero-stat">' +
        '<span class="ca-hero-stat-label">Social momentum</span>' +
        '<span class="ca-badge ca-badge-muted">' +
        escapeHtml(String(social)) +
        '</span></div>';
    }

    var breakdown =
      ex.sentiment_breakdown && isPercentBreakdownObject(ex.sentiment_breakdown)
        ? '<div class="ca-hero-breakdown">' + renderPercentBreakdownUi(ex.sentiment_breakdown) + '</div>'
        : '';

    var findHtml = '';
    if (findings.length) {
      findHtml =
        '<div class="ca-hero-findings">' +
        '<span class="ca-hero-findings-label">Key findings</span>' +
        '<ul class="ca-findings-list">' +
        findings
          .map(function (f) {
            return '<li>' + escapeHtml(String(f)) + '</li>';
          })
          .join('') +
        '</ul></div>';
    }

    var rest = {};
    Object.keys(ex).forEach(function (k) {
      if (
        [
          'brand',
          'domain',
          'overall_sentiment_score',
          'risk_level',
          'market_position',
          'social_momentum',
          'key_findings',
          'sentiment_breakdown',
          'parsing_status'
        ].indexOf(k) >= 0
      ) {
        return;
      }
      rest[k] = ex[k];
    });
    var more =
      Object.keys(rest).length > 0
        ? '<div class="ca-hero-more">' + renderObjectInner(rest, 1) + '</div>'
        : '';

    return (
      '<div class="ca-hero-card">' +
      eyebrow +
      (metrics ? '<div class="ca-hero-metrics">' + metrics + '</div>' : '') +
      breakdown +
      findHtml +
      more +
      '</div>'
    );
  }

  function wrapSectionCard(titlePlain, innerHtml) {
    var t = escapeHtml(titlePlain);
    return (
      '<section class="ca-section-card" aria-label="' +
      t +
      '"><header class="ca-section-card-head"><h3 class="ca-section-card-title">' +
      t +
      '</h3></header><div class="ca-section-card-body">' +
      innerHtml +
      '</div></section>'
    );
  }

  function renderSectionByKey(key, val, depth) {
    if (isHiddenUiKey(key)) return '';
    var titlePlain = humanizeKey(key);
    if (key === 'executive_summary' && val && typeof val === 'object' && !Array.isArray(val)) {
      return wrapSectionCard(titlePlain, renderExecutiveSummaryHero(val));
    }
    if (key === 'data_collection_summary' && val && typeof val === 'object' && !Array.isArray(val)) {
      return wrapSectionCard(titlePlain, renderDataCollectionStats(val));
    }
    if (Array.isArray(val)) {
      return wrapSectionCard(titlePlain, renderValueForCard(val, depth));
    }
    if (val && typeof val === 'object') {
      return wrapSectionCard(titlePlain, renderObjectInner(val, depth));
    }
    return wrapSectionCard(titlePlain, renderValueForCard(val, depth));
  }

  function renderPayloadAsSections(payload) {
    if (payload == null) return '<span class="ca-muted">—</span>';
    if (typeof payload !== 'object' || Array.isArray(payload)) {
      return wrapSectionCard('Details', renderValueForCard(payload, 0));
    }
    var keys = Object.keys(payload).filter(function (k) {
      return (
        payload[k] !== undefined &&
        payload[k] !== null &&
        !isHiddenUiKey(k)
      );
    });
    if (keys.length === 0) return '<span class="ca-muted">—</span>';
    return (
      '<div class="ca-section-stack">' +
      keys
        .map(function (k) {
          return renderSectionByKey(k, payload[k], 0);
        })
        .join('') +
      '</div>'
    );
  }

  function sliceEmpty(obj) {
    if (obj == null) return true;
    if (typeof obj !== 'object') return false;
    var keys = Object.keys(obj).filter(function (k) {
      return !isHiddenUiKey(k);
    });
    if (keys.length === 0) return true;
    return keys.every(function (k) {
      var v = obj[k];
      if (v === undefined || v === null) return true;
      if (Array.isArray(v)) return v.length === 0;
      if (typeof v === 'object') return Object.keys(v).length === 0;
      return false;
    });
  }

  function buildTabPayload(tabId, r) {
    var da = r && r.detailed_analysis ? r.detailed_analysis : {};
    switch (tabId) {
      case 'overview':
        return {
          executive_summary: r.executive_summary,
          data_collection_summary: r.data_collection_summary
        };
      case 'sentiment':
        return { sentiment_analysis: da.sentiment_analysis };
      case 'brand':
        return { brand_perception: da.brand_perception };
      case 'competitors':
        return {
          competitor_intelligence_detailed: da.competitor_intelligence,
          competitive_intelligence: r.competitive_intelligence
        };
      case 'pr_risk':
        return {
          pr_risk_assessment: da.pr_risk_assessment,
          risk_dashboard: r.risk_dashboard
        };
      case 'viral':
        return { viral_trends: da.viral_trends };
      case 'customers':
        return {
          customer_insights: da.customer_insights,
          customer_voice: r.customer_voice
        };
      case 'market':
        return {
          market_opportunities_detailed: da.market_opportunities,
          market_opportunities_top_level: r.market_opportunities
        };
      case 'strategy':
        return {
          strategic_recommendations: da.strategic_recommendations,
          actionable_insights: r.actionable_insights
        };
      case 'platforms':
        return {
          platform_breakdown: da.platform_breakdown,
          platform_insights: r.platform_insights
        };
      case 'data_quality':
        return { data_quality_assessment: da.data_quality_assessment };
      case 'complete':
        return r;
      default:
        return r;
    }
  }

  function renderReportInto(panelsEl, report) {
    if (!panelsEl || !report) return;
    panelsEl.innerHTML = TAB_SPECS.map(function (spec) {
      var payload = buildTabPayload(spec.id, report);
      if (spec.id === 'complete') {
        payload = cloneWithoutReportMetadata(payload);
      }
      var body = sliceEmpty(payload)
        ? '<p class="ca-empty-note">No data in this section for this report.</p>'
        : '<div class="ca-report-canvas">' + renderPayloadAsSections(payload) + '</div>';
      return (
        '<div class="ca-panel" id="ca-panel-' +
        spec.id +
        '" role="tabpanel" hidden data-tab="' +
        spec.id +
        '">' +
        '<p class="ca-panel-sub">' +
        escapeHtml(spec.subtitle) +
        '</p>' +
        '<div class="ca-panel-body">' +
        body +
        '</div>' +
        '</div>'
      );
    }).join('');
  }

  function activateTab(tabId) {
    var tabs = document.querySelectorAll('.ca-tab-btn');
    var panels = document.querySelectorAll('.ca-panel');
    tabs.forEach(function (btn) {
      var id = btn.getAttribute('data-tab');
      var on = id === tabId;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (p) {
      var id = p.getAttribute('data-tab');
      p.hidden = id !== tabId;
    });
  }

  function mountTabsHeader(wrapEl) {
    if (!wrapEl) return;
    wrapEl.innerHTML =
      '<div class="ca-tabs-scroll" role="tablist" aria-label="Report sections">' +
      TAB_SPECS.map(function (spec) {
        return (
          '<button type="button" class="ca-tab-btn" role="tab" data-tab="' +
          spec.id +
          '" aria-selected="false" aria-controls="ca-panel-' +
          spec.id +
          '" id="ca-tab-' +
          spec.id +
          '">' +
          '<span class="ca-tab-label">' +
          escapeHtml(spec.label) +
          '</span>' +
          '</button>'
        );
      }).join('') +
      '</div>';
    wrapEl.querySelectorAll('.ca-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateTab(btn.getAttribute('data-tab'));
      });
    });
  }

  function updateLimitDisplay() {
    var el = $('competitor-limit-display');
    if (!el) return;
    fetch('/api/competitor-analysis-limit', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        if (!data) {
          el.textContent = '';
          return;
        }
        if (data.mode === 'unlimited') {
          el.textContent = 'Competitor analyses (UTC): unlimited';
          return;
        }
        if (data.mode === 'trial') {
          el.textContent = '1 complimentary report available — then a plan or admin limit applies';
          return;
        }
        if (data.mode === 'blocked') {
          el.textContent = 'No analyses remaining — upgrade or ask an admin to set your daily limit';
          return;
        }
        var lim = data.limit != null ? data.limit : 0;
        var rem = data.remaining != null ? data.remaining : Math.max(0, lim - (data.used || 0));
        el.textContent = 'Analyses today (UTC): ' + lim + ' (' + rem + ' remaining)';
      })
      .catch(function () {
        el.textContent = '';
      });
  }

  function showLoading(on) {
    var ov = $('competitor-loading');
    if (ov) ov.hidden = !on;
  }

  function showError(msg) {
    var el = $('competitor-error');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  }

  function runAnalyze() {
    var input = $('competitor-url-input');
    var btn = $('competitor-analyze-btn');
    var results = $('competitor-results');
    var tabsHost = $('competitor-report-tabs');
    var panelsHost = $('competitor-report-panels');
    if (!input || !btn) return;
    var raw = input.value.trim();
    showError('');
    if (!raw) {
      showError('Enter a competitor website URL.');
      input.focus();
      return;
    }
    btn.disabled = true;
    showLoading(true);
    fetch('/api/competitor-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ url: raw })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j };
        });
      })
      .then(function (ref) {
        btn.disabled = false;
        showLoading(false);
        if (!ref.ok) {
          showError((ref.body && ref.body.error) || 'Analysis failed');
          return;
        }
        var reports = ref.body.reports || [];
        var report = reports[0];
        if (!report) {
          showError('No report in response');
          return;
        }
        updateLimitDisplay();
        if (results) results.hidden = false;
        if (tabsHost) mountTabsHeader(tabsHost);
        if (panelsHost) renderReportInto(panelsHost, report);
        activateTab('overview');
        var meta = report.report_metadata || {};
        if (meta.brand_name && $('competitor-report-title')) {
          $('competitor-report-title').textContent = 'Report: ' + meta.brand_name;
        } else if ($('competitor-report-title')) {
          $('competitor-report-title').textContent = 'Analysis complete';
        }
      })
      .catch(function () {
        btn.disabled = false;
        showLoading(false);
        showError('Network error — try again');
      });
  }

  function onPageVisible() {
    if (getPageId() !== 'competitor') return;
    updateLimitDisplay();
  }

  function bind() {
    var btn = $('competitor-analyze-btn');
    var input = $('competitor-url-input');
    if (btn) btn.addEventListener('click', runAnalyze);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') runAnalyze();
      });
    }
    window.addEventListener('hashchange', onPageVisible);
    onPageVisible();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  global.competitorAnalysis = {
    updateLimitDisplay: updateLimitDisplay,
    runAnalyze: runAnalyze
  };
})(typeof window !== 'undefined' ? window : this);
