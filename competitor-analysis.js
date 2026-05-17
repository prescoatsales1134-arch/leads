/**
 * Competitor Analysis tab: URL → server → n8n; tabbed report renderer.
 */
(function (global) {
  var TAB_SPECS = [
    { id: 'overview', label: 'Overview', subtitle: 'Metadata & executive snapshot' },
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
    { id: 'complete', label: 'Complete report', subtitle: 'Full payload (all fields)' }
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

  function formatLabel(key) {
    return escapeHtml(
      String(key)
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, function (_, a, b) {
          return a + ' ' + b;
        })
    );
  }

  function renderValue(val, depth) {
    if (depth > 14) return '<span class="ca-muted">…</span>';
    if (val === null || val === undefined) return '<span class="ca-null">—</span>';
    if (typeof val === 'boolean') return val ? '<span class="ca-bool">Yes</span>' : '<span class="ca-bool">No</span>';
    if (typeof val === 'number') return '<span class="ca-num">' + escapeHtml(String(val)) + '</span>';
    if (typeof val === 'string') {
      var s = val;
      if (s.length > 500) {
        return '<p class="ca-para">' + escapeHtml(s) + '</p>';
      }
      return '<span class="ca-str">' + escapeHtml(s) + '</span>';
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return '<span class="ca-muted">Empty list</span>';
      var allPrimitive = val.every(function (x) {
        return x === null || ['string', 'number', 'boolean'].indexOf(typeof x) >= 0;
      });
      if (allPrimitive) {
        return (
          '<ul class="ca-list">' +
          val
            .map(function (x) {
              return '<li>' + renderValue(x, depth + 1) + '</li>';
            })
            .join('') +
          '</ul>'
        );
      }
      return (
        '<div class="ca-card-stack">' +
        val
          .map(function (item) {
            return '<article class="ca-nested-card">' + renderValue(item, depth + 1) + '</article>';
          })
          .join('') +
        '</div>'
      );
    }
    if (typeof val === 'object') {
      return renderObject(val, depth + 1);
    }
    return escapeHtml(String(val));
  }

  function renderObject(obj, depth) {
    var keys = Object.keys(obj || {});
    if (keys.length === 0) return '<span class="ca-muted">—</span>';
    return (
      '<dl class="ca-dl">' +
      keys
        .map(function (k) {
          return (
            '<div class="ca-dl-row"><dt>' +
            formatLabel(k) +
            '</dt><dd>' +
            renderValue(obj[k], depth) +
            '</dd></div>'
          );
        })
        .join('') +
      '</dl>'
    );
  }

  function sliceEmpty(obj) {
    if (obj == null) return true;
    if (typeof obj !== 'object') return false;
    var keys = Object.keys(obj);
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
          report_metadata: r.report_metadata,
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
      var body =
        spec.id === 'complete'
          ? '<div class="ca-complete-wrap">' + renderObject(payload, 0) + '</div>'
          : sliceEmpty(payload)
            ? '<p class="ca-empty-note">No data in this section for this report.</p>'
            : renderObject(payload, 0);
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
