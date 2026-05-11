/**
 * Dark editorial social cards: HTML → PNG via HCTI (htmlcsstoimage.com).
 */

'use strict';

var ALLOWED_LAYOUTS = ['hero', 'split', 'quote', 'listicle', 'three_col'];

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHexColor(val, fallback) {
  var v = String(val || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v) || /^#[0-9A-Fa-f]{3}$/.test(v)) return v;
  return fallback;
}

/**
 * @param {object} aiPost — raw post from model
 * @param {string} fallbackHeadline
 */
function normalizeDesign(aiPost, fallbackHeadline) {
  var d = aiPost || {};
  var bullets = Array.isArray(d.bullets)
    ? d.bullets.slice(0, 3).map(function (b) {
      return String(b);
    })
    : [];
  var rawLayout = String(d.layout_style || 'hero')
    .toLowerCase()
    .trim();
  var layout = ALLOWED_LAYOUTS.indexOf(rawLayout) >= 0 ? rawLayout : 'hero';

  var colInput = Array.isArray(d.columns) ? d.columns.slice(0, 3) : [];
  var columns = colInput.map(function (c) {
    return {
      num: String((c && c.num) != null ? c.num : ''),
      label: String((c && c.label) != null ? c.label : '').toUpperCase(),
      title: String((c && c.title) != null ? c.title : ''),
      desc: String((c && c.desc) != null ? c.desc : '')
    };
  });

  if (layout === 'three_col' && columns.length < 3) {
    var need = 3 - columns.length;
    var startNum = columns.length + 1;
    for (var j = 0; j < need; j++) {
      var idx = columns.length;
      var b = bullets[idx] || bullets[j] || 'Key takeaway ' + (idx + 1);
      columns.push({
        num: (function (n) {
          var s = String(Number(n));
          return s.length >= 2 ? s : '0' + s;
        })(startNum + j),
        label: 'INSIGHT',
        title: b.length > 48 ? b.slice(0, 45) + '…' : b,
        desc: 'Supporting detail aligned with your topic.'
      });
    }
  }

  return {
    headline: String(d.headline || fallbackHeadline || 'Your message').slice(0, 220),
    headline_crossout: String(d.headline_crossout || '').slice(0, 80),
    headline_highlight: String(d.headline_highlight || '').slice(0, 80),
    subheadline: String(d.subheadline || '').slice(0, 520),
    bullets: bullets,
    columns: columns,
    cta: String(d.cta || d.cta_button || 'Learn More').slice(0, 80),
    accent_color: sanitizeHexColor(d.accent_color, '#84cc16'),
    bg_color: sanitizeHexColor(d.bg_color, '#0d0d0d'),
    layout_style: layout,
    category_tag: String(d.category_tag || 'INSIGHTS')
      .slice(0, 80)
      .toUpperCase(),
    meta_left: String(d.meta_left || '').slice(0, 60),
    meta_right: String(d.meta_right || '').slice(0, 60),
    vol_label: String(d.vol_label || '').slice(0, 40),
    emoji: String(d.emoji || '').slice(0, 6)
  };
}

function suggestBrandHandle(businessName) {
  var slug = String(businessName || '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
    .slice(0, 22);
  if (!slug) slug = 'brand';
  return '@' + slug;
}

function issueNumFromVol(vol) {
  var m = String(vol || '').match(/VOL\.?\s*(\d+)/i);
  return m ? m[1] : '01';
}

function metaRightLines(metaRight) {
  var raw = String(metaRight || '').trim();
  var parts = raw.split(/\r?\n/);
  return {
    line1: (parts[0] || '').trim(),
    line2: (parts[1] || '').trim()
  };
}

function renderHeadline(d) {
  var raw = esc(d.headline);
  if (d.headline_crossout) {
    var x = esc(d.headline_crossout);
    raw = raw.replace(x, '<span class="hl-cross">' + x + '</span>');
  }
  if (d.headline_highlight) {
    var h = esc(d.headline_highlight);
    raw = raw.replace(h, '<span class="hl-accent">' + h + '</span>');
  }
  return raw;
}

function buildThreeCol(d) {
  var cols = d.columns.slice(0, 3);
  function oneCol(c) {
    return (
      '<div class="col">' +
      '<div class="col-header"><span class="col-num">' +
      esc(c.num) +
      '</span><span class="col-label">' +
      esc(c.label) +
      '</span></div>' +
      '<div class="col-title">' +
      esc(c.title) +
      '</div>' +
      '<div class="col-desc">' +
      esc(c.desc) +
      '</div>' +
      '</div>'
    );
  }
  return (
    '<div class="three-col">' +
    oneCol(cols[0]) +
    '<div class="col-divider"></div>' +
    oneCol(cols[1]) +
    '<div class="col-divider"></div>' +
    oneCol(cols[2]) +
    '</div>'
  );
}

function buildListicle(d) {
  if (!d.bullets.length) return '';
  return (
    '<ul class="bullets">' +
    d.bullets
      .map(function (b, i) {
        return (
          '<li><span class="bullet-num">' +
          (i + 1) +
          '</span><span>' +
          esc(b) +
          '</span></li>'
        );
      })
      .join('') +
    '</ul>'
  );
}

function buildQuote(d) {
  return (
    '<div class="quote-block"><div class="quote-mark">"</div><p class="sub">' +
    esc(d.subheadline) +
    '</p></div>'
  );
}

function buildSplit(d) {
  if (!d.bullets.length) return '';
  return (
    '<div class="chips">' +
    d.bullets
      .map(function (b) {
        return '<span class="chip">' + esc(b) + '</span>';
      })
      .join('') +
    '</div>'
  );
}

function buildLayoutBlock(d) {
  if (d.layout_style === 'three_col' && d.columns.length >= 3) {
    return buildThreeCol(d);
  }
  if (d.layout_style === 'listicle') {
    return buildListicle(d);
  }
  if (d.layout_style === 'quote') {
    return buildQuote(d);
  }
  if (d.layout_style === 'split') {
    return buildSplit(d);
  }
  return '';
}

/**
 * Full-bleed 540×540 HTML for HCTI (viewport 540, device_scale 2 → 1080×1080 PNG).
 */
function buildPostHtml(design, brandName, brandHandle) {
  var d = design;
  var bn = String(brandName || 'Brand');
  var bh = String(brandHandle || suggestBrandHandle(bn));
  var ac = d.accent_color;
  var bg = d.bg_color;
  var firstLetter = esc(bn.charAt(0) || 'B');
  var issueNum = issueNumFromVol(d.vol_label);
  var metaR = metaRightLines(d.meta_right);
  var showTop = !!(d.meta_left || d.meta_right || d.vol_label);

  var volHtml = d.vol_label
    ? '<div class="vol-label">' + esc(d.vol_label.toUpperCase()) + '</div>'
    : '';

  var topBar = '';
  if (showTop) {
    var rightInner =
      (metaR.line1 ? '<strong>' + esc(metaR.line1) + '</strong>' : '') +
      (metaR.line2 ? '<br>' + esc(metaR.line2) : '');
    topBar =
      '<div class="top-bar">' +
      '<div class="meta-left">' +
      '<span class="meta-num"># ' +
      esc(issueNum) +
      '</span>' +
      '<div class="meta-dash"></div>' +
      '<span>' +
      esc(d.meta_left) +
      '</span>' +
      '</div>' +
      (rightInner
        ? '<div class="meta-right">' + rightInner + '</div>'
        : '<div class="meta-right"></div>') +
      '</div>';
  }

  var middle = buildLayoutBlock(d);

  var fonts =
    'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,700;1,700&family=Inter:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap';

  var style =
    '* { box-sizing: border-box; margin: 0; padding: 0; }\n' +
    'html, body {\n' +
    '  width: 540px;\n' +
    '  height: 540px;\n' +
    '  overflow: hidden;\n' +
    "  font-family: 'Inter', sans-serif;\n" +
    '  color: #fff;\n' +
    '  -webkit-font-smoothing: antialiased;\n' +
    '}\n' +
    '.card {\n' +
    '  width: 540px;\n' +
    '  height: 540px;\n' +
    '  background: ' +
    bg +
    ';\n' +
    '  position: relative;\n' +
    '  overflow: hidden;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '}\n' +
    '.card::before {\n' +
    "  content: '';\n" +
    '  position: absolute;\n' +
    '  inset: 0;\n' +
    '  background-image:\n' +
    '    linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),\n' +
    '    linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);\n' +
    '  background-size: 27px 27px;\n' +
    '  pointer-events: none;\n' +
    '  z-index: 0;\n' +
    '}\n' +
    '.card::after {\n' +
    "  content: '';\n" +
    '  position: absolute;\n' +
    '  top: -60px;\n' +
    '  right: -60px;\n' +
    '  width: 280px;\n' +
    '  height: 280px;\n' +
    '  background: radial-gradient(circle, ' +
    ac +
    '77 0%, ' +
    ac +
    '33 40%, transparent 68%);\n' +
    '  pointer-events: none;\n' +
    '  z-index: 0;\n' +
    '}\n' +
    '.corner { position: absolute; width: 10px; height: 10px; z-index: 2; }\n' +
    '.corner-tl { top: 10px; left: 10px; border-top: 1px solid ' +
    ac +
    '; border-left: 1px solid ' +
    ac +
    '; }\n' +
    '.corner-tr { top: 10px; right: 10px; border-top: 1px solid ' +
    ac +
    '; border-right: 1px solid ' +
    ac +
    '; }\n' +
    '.corner-bl { bottom: 10px; left: 10px; border-bottom: 1px solid ' +
    ac +
    '; border-left: 1px solid ' +
    ac +
    '; }\n' +
    '.corner-br { bottom: 10px; right: 10px; border-bottom: 1px solid ' +
    ac +
    '; border-right: 1px solid ' +
    ac +
    '; }\n' +
    '.vol-label {\n' +
    '  position: absolute;\n' +
    '  right: -2px;\n' +
    '  top: 50%;\n' +
    '  transform: translateY(-50%) rotate(90deg);\n' +
    '  font-size: 5px;\n' +
    '  font-weight: 500;\n' +
    '  letter-spacing: 0.16em;\n' +
    '  color: rgba(255,255,255,0.22);\n' +
    '  white-space: nowrap;\n' +
    '  text-transform: uppercase;\n' +
    '  z-index: 2;\n' +
    "}\n" +
    '.circle-1, .circle-2 {\n' +
    '  position: absolute;\n' +
    '  border-radius: 50%;\n' +
    '  border: 1px solid rgba(255,255,255,0.05);\n' +
    '  pointer-events: none;\n' +
    '  z-index: 0;\n' +
    '}\n' +
    '.circle-1 { width: 150px; height: 150px; bottom: -40px; left: -40px; }\n' +
    '.circle-2 { width: 250px; height: 250px; bottom: -90px; left: -90px; }\n' +
    '.inner {\n' +
    '  position: relative;\n' +
    '  z-index: 1;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  height: 100%;\n' +
    '  padding: 28px 32px 28px;\n' +
    '}\n' +
    '.top-bar {\n' +
    '  display: flex;\n' +
    '  align-items: flex-start;\n' +
    '  justify-content: space-between;\n' +
    '  margin-bottom: 16px;\n' +
    '}\n' +
    '.meta-left {\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  gap: 6px;\n' +
    '  font-size: 6px;\n' +
    '  font-weight: 600;\n' +
    '  letter-spacing: 0.14em;\n' +
    '  color: rgba(255,255,255,0.52);\n' +
    '  text-transform: uppercase;\n' +
    "}\n" +
    ".meta-num {\n  font-family: 'Space Grotesk', sans-serif;\n  font-size: 8px;\n  font-weight: 700;\n  color: " +
    ac +
    ';\n}\n' +
    '.meta-dash {\n' +
    '  width: 16px;\n' +
    '  height: 1px;\n' +
    '  background: rgba(255,255,255,0.25);\n' +
    '  margin: 0 2px;\n' +
    '}\n' +
    '.meta-right {\n' +
    '  text-align: right;\n' +
    '  font-size: 5.5px;\n' +
    '  font-weight: 500;\n' +
    '  letter-spacing: 0.08em;\n' +
    '  color: rgba(255,255,255,0.48);\n' +
    '  text-transform: uppercase;\n' +
    '  line-height: 1.7;\n' +
    '}\n' +
    '.meta-right strong {\n' +
    '  color: #fff;\n' +
    '  font-weight: 700;\n' +
    '}\n' +
    '.tag {\n' +
    '  display: inline-flex;\n' +
    '  align-items: center;\n' +
    '  gap: 6px;\n' +
    '  padding: 4px 10px;\n' +
    '  background: ' +
    ac +
    '1F;\n' +
    '  border: 1px solid ' +
    ac +
    '55;\n' +
    '  border-radius: 999px;\n' +
    "  font-family: 'Space Grotesk', sans-serif;\n" +
    '  font-size: 7px;\n' +
    '  font-weight: 600;\n' +
    '  letter-spacing: 0.1em;\n' +
    '  color: ' +
    ac +
    ';\n' +
    '  margin-bottom: 18px;\n' +
    '  width: fit-content;\n' +
    '}\n' +
    '.tag .dot {\n' +
    '  width: 5px; height: 5px;\n' +
    '  border-radius: 50%;\n' +
    '  background: ' +
    ac +
    ';\n' +
    '  box-shadow: 0 0 6px ' +
    ac +
    ';\n' +
    '}\n' +
    '.headline {\n' +
    "  font-family: 'Bebas Neue', 'Space Grotesk', sans-serif;\n" +
    '  font-size: 54px;\n' +
    '  font-weight: 400;\n' +
    '  line-height: 1.0;\n' +
    '  letter-spacing: 0.01em;\n' +
    '  color: #fff;\n' +
    '  margin-bottom: 14px;\n' +
    '}\n' +
    '.hl-cross {\n' +
    '  color: rgba(255,255,255,0.42);\n' +
    '  text-decoration: line-through;\n' +
    '  text-decoration-color: rgba(255,255,255,0.28);\n' +
    '  text-decoration-thickness: 1.5px;\n' +
    '}\n' +
    '.hl-accent {\n' +
    "  font-family: 'Cormorant Garamond', Georgia, serif;\n" +
    '  font-style: italic;\n' +
    '  font-weight: 700;\n' +
    '  color: ' +
    ac +
    ';\n' +
    '  letter-spacing: -0.01em;\n' +
    '}\n' +
    '.sub {\n' +
    '  font-size: 12px;\n' +
    '  font-weight: 400;\n' +
    '  line-height: 1.55;\n' +
    '  color: rgba(255,255,255,0.78);\n' +
    '  max-width: 85%;\n' +
    '  margin-bottom: 0px;\n' +
    '}\n' +
    '.three-col {\n' +
    '  display: flex;\n' +
    '  align-items: flex-start;\n' +
    '  border-top: 1px solid rgba(255,255,255,0.12);\n' +
    '  padding-top: 14px;\n' +
    '  margin-top: auto;\n' +
    '  margin-bottom: 0;\n' +
    '  gap: 0;\n' +
    '}\n' +
    '.col { flex: 1; padding-right: 14px; }\n' +
    '.col:last-child { padding-right: 0; }\n' +
    '.col-divider {\n' +
    '  width: 1px;\n' +
    '  background: rgba(255,255,255,0.12);\n' +
    '  align-self: stretch;\n' +
    '  margin: 0 14px;\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    '.col-header {\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  gap: 5px;\n' +
    '  margin-bottom: 7px;\n' +
    '}\n' +
    ".col-num {\n  font-family: 'Space Grotesk', sans-serif;\n  font-size: 11px;\n  font-weight: 700;\n  color: " +
    ac +
    ';\n  font-style: italic;\n}\n' +
    '.col-label {\n' +
    '  font-size: 5.5px;\n' +
    '  font-weight: 600;\n' +
    '  letter-spacing: 0.14em;\n' +
    '  color: rgba(255,255,255,0.45);\n' +
    '  text-transform: uppercase;\n' +
    '}\n' +
    '.col-title {\n' +
    '  font-size: 11px;\n' +
    '  font-weight: 700;\n' +
    '  color: #ffffff;\n' +
    '  text-shadow: none;\n' +
    '  line-height: 1.2;\n' +
    '  margin-bottom: 6px;\n' +
    '}\n' +
    '.col-desc {\n' +
    '  font-size: 7px;\n' +
    '  font-weight: 400;\n' +
    '  color: rgba(255,255,255,0.65);\n' +
    '  line-height: 1.45;\n' +
    '}\n' +
    '.bullets { list-style: none; display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }\n' +
    '.bullets li { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.9); }\n' +
    '.bullet-num {\n' +
    '  flex-shrink: 0;\n' +
    '  width: 20px; height: 20px;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  background: ' +
    ac +
    ';\n' +
    '  color: #0a0a0a;\n' +
    '  border-radius: 5px;\n' +
    "  font-family: 'Space Grotesk', sans-serif;\n" +
    '  font-weight: 700; font-size: 10px;\n' +
    '}\n' +
    '.quote-block { position: relative; padding-left: 20px; margin-bottom: 12px; }\n' +
    '.quote-mark {\n' +
    '  position: absolute; left: -4px; top: -16px;\n' +
    "  font-family: 'Cormorant Garamond', serif;\n" +
    '  font-size: 72px; line-height: 1;\n' +
    '  color: ' +
    ac +
    '; opacity: 0.5;\n' +
    '}\n' +
    '.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }\n' +
    '.chip {\n' +
    '  padding: 4px 8px;\n' +
    '  border: 1px solid rgba(255,255,255,0.12);\n' +
    '  border-radius: 999px;\n' +
    '  font-size: 6px;\n' +
    '  color: rgba(255,255,255,0.85);\n' +
    '}\n' +
    '.bottom {\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  justify-content: space-between;\n' +
    '  padding-top: 12px;\n' +
    '  border-top: 1px solid rgba(255,255,255,0.08);\n' +
    '  margin-top: auto;\n' +
    '}\n' +
    '.brand { display: flex; align-items: center; gap: 8px; }\n' +
    '.brand-mark {\n' +
    '  width: 24px; height: 24px;\n' +
    '  border-radius: 6px;\n' +
    '  background: #ffffff;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    "  font-family: 'Space Grotesk', sans-serif;\n" +
    '  font-weight: 800; font-size: 11px; color: #000000;\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    '.brand-text { display: flex; flex-direction: column; }\n' +
    '.brand-name { font-weight: 700; font-size: 12px; color: #ffffff; }\n' +
    '.brand-tagline {\n' +
    '  font-size: 6px; font-weight: 500;\n' +
    '  letter-spacing: 0.1em;\n' +
    '  color: rgba(255,255,255,0.35);\n' +
    '  text-transform: uppercase;\n' +
    '}\n' +
    '.cta {\n' +
    '  display: inline-flex; align-items: center; gap: 6px;\n' +
    '  padding: 8px 16px;\n' +
    '  background: ' +
    ac +
    ';\n' +
    '  color: #000000;\n' +
    '  border-radius: 999px;\n' +
    "  font-family: 'Space Grotesk', sans-serif;\n" +
    '  font-weight: 700; font-size: 8.5px;\n' +
    '  white-space: nowrap;\n' +
    '}\n' +
    '.cta-arrow {\n' +
    '  width: 16px; height: 16px;\n' +
    '  background: rgba(0,0,0,0.25);\n' +
    '  border-radius: 50%;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  font-size: 9px;\n' +
    '}\n';

  return (
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<link href="' +
    fonts +
    '" rel="stylesheet">\n' +
    '<style>\n' +
    style +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<div class="card">\n' +
    '<div class="corner corner-tl"></div>\n' +
    '<div class="corner corner-tr"></div>\n' +
    '<div class="corner corner-bl"></div>\n' +
    '<div class="corner corner-br"></div>\n' +
    '<div class="circle-1"></div>\n' +
    '<div class="circle-2"></div>\n' +
    volHtml +
    '<div class="inner">\n' +
    topBar +
    '<div class="tag"><span class="dot"></span>' +
    esc(d.category_tag) +
    '</div>\n' +
    '<h1 class="headline">' +
    renderHeadline(d) +
    '</h1>\n' +
    (d.layout_style === 'quote'
      ? ''
      : '<p class="sub">' + esc(d.subheadline) + '</p>\n') +
    middle +
    '<div class="bottom">\n' +
    '<div class="brand">\n' +
    '<div class="brand-mark">' +
    firstLetter +
    '</div>\n' +
    '<div class="brand-text">\n' +
    '<div class="brand-name">' +
    esc(bn) +
    '</div>\n' +
    '<div class="brand-tagline">' +
    esc(bh.toUpperCase()) +
    '</div>\n' +
    '</div>\n' +
    '</div>\n' +
    '<div class="cta"><span>' +
    esc(d.cta) +
    '</span><span class="cta-arrow">→</span></div>\n' +
    '</div>\n' +
    '</div>\n' +
    '</div>\n' +
    '</body>\n' +
    '</html>'
  );
}

/**
 * 1. POST HTML to HCTI → 2. j.url → 3. fetch buffer → 4. data URI → 5. { url, base64 }
 */
async function renderImageViaHCTI(htmlString) {
  var userId = (process.env.HCTI_USER_ID || '').trim();
  var apiKey = (process.env.HCTI_API_KEY || '').trim();
  if (!userId || !apiKey) {
    throw new Error('HCTI_USER_ID and HCTI_API_KEY must be set');
  }
  var auth = Buffer.from(userId + ':' + apiKey, 'utf8').toString('base64');
  var resp = await fetch('https://hcti.io/v1/image', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      html: htmlString,
      viewport_width: 540,
      viewport_height: 540,
      device_scale: 2
    })
  });
  var txt = await resp.text();
  var json;
  try {
    json = JSON.parse(txt);
  } catch (e) {
    throw new Error('HCTI response not JSON: ' + txt.slice(0, 300));
  }
  if (!resp.ok) {
    var errMsg = json.error || json.message || txt || 'HCTI request failed';
    throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
  }
  var imageUrl = json.url;
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('HCTI response missing url');
  }
  var imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error('Failed to download HCTI image');
  }
  var buf = Buffer.from(await imgRes.arrayBuffer());
  return {
    url: imageUrl,
    base64: 'data:image/png;base64,' + buf.toString('base64')
  };
}

module.exports = {
  normalizeDesign: normalizeDesign,
  suggestBrandHandle: suggestBrandHandle,
  buildPostHtml: buildPostHtml,
  renderImageViaHCTI: renderImageViaHCTI
};
