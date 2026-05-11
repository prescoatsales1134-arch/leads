/**
 * Dark editorial social cards: HTML → PNG via Puppeteer (no node-html-to-image:
 * that package calls process.exit(1) on errors and kills the server).
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

function sanitizeHex(val, fallback) {
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
    ? d.bullets.slice(0, 3).map(function (b) { return String(b); })
    : [];
  var rawLayout = String(d.layout_style || 'hero').toLowerCase().trim();
  var layout = ALLOWED_LAYOUTS.indexOf(rawLayout) >= 0 ? rawLayout : 'hero';

  var columns = [];
  if (Array.isArray(d.columns)) {
    columns = d.columns.slice(0, 3).map(function (c) {
      return {
        num: String((c && c.num) != null ? c.num : ''),
        label: String((c && c.label) != null ? c.label : '').toUpperCase(),
        title: String((c && c.title) != null ? c.title : ''),
        desc: String((c && c.desc) != null ? c.desc : '')
      };
    });
  }

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
    headline_crossout: String(d.headline_crossout || '').trim(),
    headline_highlight: String(d.headline_highlight || '').trim(),
    subheadline: String(d.subheadline || '').slice(0, 520),
    bullets: bullets,
    columns: columns,
    cta: String(d.cta || d.cta_button || 'Learn More').slice(0, 80),
    accent_color: sanitizeHex(d.accent_color, '#84cc16'),
    bg_color: sanitizeHex(d.bg_color, '#0a0a0a'),
    layout_style: layout,
    category_tag: String(d.category_tag || 'INSIGHTS')
      .slice(0, 80)
      .toUpperCase(),
    meta_left: String(d.meta_left || '').slice(0, 120),
    meta_right: String(d.meta_right || '').slice(0, 80),
    vol_label: String(d.vol_label || '').trim().slice(0, 80),
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

function headlineToHtml(headline, crossout, highlight) {
  var co = String(crossout || '')
    .toLowerCase()
    .replace(/[^\w\u00C0-\u024F]/g, '');
  var hi = String(highlight || '')
    .toLowerCase()
    .replace(/[^\w\u00C0-\u024F]/g, '');
  var tokens = headline.match(/\S+|\s+/g) || [];
  return tokens
    .map(function (tok) {
      if (/^\s+$/.test(tok)) return esc(tok);
      var m = tok.match(/^([\W]*)([^\W_]+|.+?)([\W]*)$/);
      if (!m) return esc(tok);
      var pre = esc(m[1] || '');
      var wordRaw = m[2] || '';
      var post = esc(m[3] || '');
      var wordNorm = wordRaw.toLowerCase().replace(/[^\w\u00C0-\u024F]/g, '');
      var inner = esc(wordRaw);
      if (co && wordNorm === co) return pre + '<span class="head-cross">' + inner + '</span>' + post;
      if (hi && wordNorm === hi) return pre + '<span class="head-hi">' + inner + '</span>' + post;
      return pre + inner + post;
    })
    .join('');
}

function buildThreeCol(d) {
  var cols = d.columns.slice(0, 3);
  return (
    '<div class="three-col">' +
    cols
      .map(function (c) {
        return (
          '<div class="col">' +
          '<div class="col-num">' +
          esc(c.num) +
          '</div>' +
          '<div class="col-label">' +
          esc(c.label) +
          '</div>' +
          '<div class="col-title">' +
          esc(c.title) +
          '</div>' +
          '<div class="col-desc">' +
          esc(c.desc) +
          '</div>' +
          '</div>'
        );
      })
      .join('') +
    '</div>'
  );
}

function buildListicle(d) {
  if (!d.bullets.length) {
    return '';
  }
  return (
    '<ul class="bullets">' +
    d.bullets
      .map(function (b, i) {
        return (
          '<li><span class="bullet-num">' +
          (i + 1) +
          '</span><span class="bullet-text">' +
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
    '<div class="quote-block">' +
    '<div class="quote-mark">“</div>' +
    '<p class="quote-sub">' +
    esc(d.subheadline) +
    '</p>' +
    '</div>'
  );
}

function buildSplit(d) {
  var chips = d.bullets.length
    ? '<div class="chips">' +
      d.bullets
        .map(function (b) {
          return '<span class="chip">' + esc(b) + '</span>';
        })
        .join('') +
      '</div>'
    : '';
  return '<p class="sub">' + esc(d.subheadline) + '</p>' + chips;
}

function buildPostHtml(design, brandName, brandHandle, width, height) {
  width = width || 1080;
  height = height || 1080;
  var d = design;
  var bn = String(brandName || 'Brand');
  var bh = String(brandHandle || suggestBrandHandle(bn));
  var ac = d.accent_color;
  var bg = d.bg_color;
  var firstLetter = esc(bn.charAt(0) || 'B');
  var hHtml = headlineToHtml(d.headline, d.headline_crossout, d.headline_highlight);
  var bodyMid = '';
  if (d.layout_style === 'hero') {
    bodyMid = '<p class="sub">' + esc(d.subheadline) + '</p>';
  } else if (d.layout_style === 'three_col') {
    bodyMid = '<p class="sub">' + esc(d.subheadline) + '</p>' + buildThreeCol(d);
  } else if (d.layout_style === 'listicle') {
    bodyMid =
      '<p class="sub">' + esc(d.subheadline) + '</p>' + buildListicle(d);
  } else if (d.layout_style === 'quote') {
    bodyMid = buildQuote(d);
  } else if (d.layout_style === 'split') {
    bodyMid = buildSplit(d);
  } else {
    bodyMid = '<p class="sub">' + esc(d.subheadline) + '</p>';
  }
  var volHtml = d.vol_label
    ? '<div class="vol-edge">' + esc(d.vol_label.toUpperCase()) + '</div>'
    : '';
  var metaTop =
    (d.meta_left || d.meta_right)
      ? '<div class="top-meta">' +
        '<span class="meta-left">' +
        esc(d.meta_left) +
        '</span>' +
        '<span class="meta-right">' +
        esc(d.meta_right) +
        '</span>' +
        '</div>'
      : '';

  return (
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@1,500;1,600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">\n' +
    '<style>\n' +
    '  * { box-sizing: border-box; margin: 0; padding: 0; }\n' +
    '  html, body {\n' +
    '    width: ' +
    width +
    'px;\n' +
    '    height: ' +
    height +
    'px;\n' +
    "    font-family: 'Inter', -apple-system, sans-serif;\n" +
    '    color: #fff;\n' +
    '    overflow: hidden;\n' +
    '    -webkit-font-smoothing: antialiased;\n' +
    '    background: ' +
    bg +
    ';\n' +
    '  }\n' +
    '  .card {\n' +
    '    width: 100%; height: 100%; position: relative;\n' +
    '    background-color: ' +
    bg +
    ';\n' +
    '    background-image:\n' +
    '      linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),\n' +
    '      linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);\n' +
    '    background-size: 54px 54px;\n' +
    '    padding: 56px 64px 48px;\n' +
    '    display: flex;\n' +
    '    flex-direction: column;\n' +
    '  }\n' +
    '  .glow-tr {\n' +
    '    position: absolute; top: 0; right: 0;\n' +
    '    width: 70%; height: 55%;\n' +
    '    background: radial-gradient(ellipse 80% 70% at 90% 5%, ' +
    ac +
    '55, transparent 72%);\n' +
    '    pointer-events: none;\n' +
    '  }\n' +
    '  .bracket { position: absolute; width: 20px; height: 20px; border: 2px solid ' +
    ac +
    '; opacity: 0.9; pointer-events: none; }\n' +
    '  .br-tl { top: 28px; left: 28px; border-right: none; border-bottom: none; }\n' +
    '  .br-tr { top: 28px; right: 28px; border-left: none; border-bottom: none; }\n' +
    '  .br-bl { bottom: 28px; left: 28px; border-right: none; border-top: none; }\n' +
    '  .br-br { bottom: 28px; right: 28px; border-left: none; border-top: none; }\n' +
    '  .vol-edge {\n' +
    '    position: absolute; right: 18px; top: 50%; transform: translateY(-50%) rotate(-90deg);\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-size: 11px; font-weight: 600; letter-spacing: 0.22em;\n' +
    '    color: rgba(255,255,255,0.35); white-space: nowrap;\n' +
    '    pointer-events: none;\n' +
    '  }\n' +
    '  .top-meta {\n' +
    '    display: flex; justify-content: space-between; align-items: center;\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-size: 13px; font-weight: 600; letter-spacing: 0.14em;\n' +
    '    text-transform: uppercase; color: rgba(255,255,255,0.42);\n' +
    '    margin-bottom: 28px; position: relative; z-index: 2;\n' +
    '  }\n' +
    '  .row-tag {\n' +
    '    display: flex; align-items: center; justify-content: space-between;\n' +
    '    margin-bottom: 36px; position: relative; z-index: 2;\n' +
    '  }\n' +
    '  .tag {\n' +
    '    display: inline-flex; align-items: center; gap: 12px;\n' +
    '    padding: 12px 22px;\n' +
    '    border: 1px solid ' +
    ac +
    ';\n' +
    '    color: ' +
    ac +
    ';\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-size: 15px; font-weight: 700;\n' +
    '    letter-spacing: 0.1em;\n' +
    '    text-transform: uppercase;\n' +
    '    background: rgba(0,0,0,0.25);\n' +
    '  }\n' +
    '  .tag .dot { width: 8px; height: 8px; border-radius: 50%; background: ' +
    ac +
    '; box-shadow: 0 0 12px ' +
    ac +
    '; }\n' +
    '  .emoji { font-size: 44px; line-height: 1; filter: drop-shadow(0 2px 16px ' +
    ac +
    '66); }\n' +
    '  .body {\n' +
    '    flex: 1; display: flex; flex-direction: column;\n' +
    '    justify-content: flex-start;\n' +
    '    padding-top: 8px; position: relative; z-index: 2;\n' +
    '    min-height: 0;\n' +
    '  }\n' +
    "  h1 {\n    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-weight: 700; font-size: 72px; line-height: 1.05;\n' +
    '    letter-spacing: -0.03em; margin-bottom: 28px;\n' +
    '    color: #fff;\n' +
    '  }\n' +
    '  h1 .head-cross { text-decoration: line-through; opacity: 0.45; color: #fff; }\n' +
    "  h1 .head-hi {\n    font-family: 'Playfair Display', Georgia, serif;\n" +
    '    font-style: italic; font-weight: 500; color: ' +
    ac +
    ';\n' +
    '  }\n' +
    '  .sub, .quote-sub {\n' +
    "    font-family: 'Inter', sans-serif;\n" +
    '    font-size: 22px; font-weight: 400; line-height: 1.55;\n' +
    '    color: rgba(255,255,255,0.65); max-width: 92%;\n' +
    '  }\n' +
    '  .three-col {\n' +
    '    display: flex; gap: 0; margin-top: 36px;\n' +
    '    border-top: 1px solid rgba(255,255,255,0.1);\n' +
    '    padding-top: 28px;\n' +
    '    flex: 1;\n' +
    '    align-items: stretch;\n' +
    '  }\n' +
    '  .three-col .col {\n' +
    '    flex: 1; padding: 0 20px;\n' +
    '    border-right: 1px solid rgba(255,255,255,0.12);\n' +
    '  }\n' +
    '  .three-col .col:last-child { border-right: none; }\n' +
    '  .three-col .col-num {\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-size: 42px; font-weight: 700; color: ' +
    ac +
    '; line-height: 1; margin-bottom: 12px;\n' +
    '  }\n' +
    '  .col-label {\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-size: 11px; font-weight: 600; letter-spacing: 0.16em;\n' +
    '    color: rgba(255,255,255,0.4); margin-bottom: 12px;\n' +
    '  }\n' +
    '  .col-title {\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-size: 22px; font-weight: 700; color: #fff; line-height: 1.25; margin-bottom: 10px;\n' +
    '  }\n' +
    '  .col-desc {\n' +
    "    font-family: 'Inter', sans-serif;\n" +
    '    font-size: 15px; line-height: 1.45; color: rgba(255,255,255,0.5);\n' +
    '  }\n' +
    '  .bullets { list-style: none; display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }\n' +
    '  .bullets li { display: flex; align-items: flex-start; gap: 16px; font-size: 21px; color: rgba(255,255,255,0.88); }\n' +
    '  .bullet-num {\n' +
    '    flex-shrink: 0; width: 36px; height: 36px;\n' +
    '    display: flex; align-items: center; justify-content: center;\n' +
    '    background: ' +
    ac +
    '; color: ' +
    bg +
    ";\n    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-weight: 700; font-size: 16px;\n' +
    '  }\n' +
    '  .quote-block { position: relative; padding-left: 8px; margin-top: 8px; }\n' +
    '  .quote-mark {\n' +
    "    font-family: 'Space Grotesk', serif;\n" +
    '    font-size: 120px; line-height: 0.85;\n' +
    '    color: ' +
    ac +
    '; opacity: 0.45;\n' +
    '    margin-bottom: 8px;\n' +
    '  }\n' +
    '  .quote-sub { font-size: 26px; line-height: 1.4; }\n' +
    '  .chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }\n' +
    '  .chip {\n' +
    '    padding: 10px 18px; border: 1px solid rgba(255,255,255,0.14);\n' +
    '    border-radius: 999px; font-size: 17px; color: rgba(255,255,255,0.88);\n' +
    '    background: rgba(255,255,255,0.04);\n' +
    '  }\n' +
    '  .footer {\n' +
    '    display: flex; align-items: center; justify-content: space-between;\n' +
    '    padding-top: 28px; margin-top: auto;\n' +
    '    border-top: 1px solid rgba(255,255,255,0.1);\n' +
    '    position: relative; z-index: 2;\n' +
    '  }\n' +
    '  .brand { display: flex; align-items: center; gap: 14px; }\n' +
    '  .brand-mark {\n' +
    '    width: 48px; height: 48px;\n' +
    '    background: #fff;\n' +
    '    color: ' +
    bg +
    ";\n    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-weight: 800; font-size: 22px;\n' +
    '    display: flex; align-items: center; justify-content: center;\n' +
    '  }\n' +
    '  .brand-name { font-weight: 700; font-size: 20px; }\n' +
    '  .brand-handle { font-size: 14px; color: rgba(255,255,255,0.45); }\n' +
    '  .cta {\n' +
    '    display: inline-flex; align-items: center; gap: 10px;\n' +
    '    padding: 16px 26px;\n' +
    '    background: ' +
    ac +
    '; color: ' +
    bg +
    ";\n    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-weight: 700; font-size: 18px;\n' +
    '  }\n' +
    '  .cta-arrow { font-size: 20px; }\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <div class="card">\n' +
    '    <div class="glow-tr"></div>\n' +
    '    <div class="bracket br-tl"></div><div class="bracket br-tr"></div>\n' +
    '    <div class="bracket br-bl"></div><div class="bracket br-br"></div>\n' +
    volHtml +
    metaTop +
    '    <div class="row-tag">\n' +
    '      <div class="tag"><span class="dot"></span>' +
    esc(d.category_tag) +
    '</div>\n' +
    (d.emoji ? '<div class="emoji">' + esc(d.emoji) + '</div>' : '<div></div>') +
    '    </div>\n' +
    '    <div class="body">\n' +
    '      <h1>' +
    hHtml +
    '</h1>\n' +
    bodyMid +
    '\n    </div>\n' +
    '    <div class="footer">\n' +
    '      <div class="brand">\n' +
    '        <div class="brand-mark">' +
    firstLetter +
    '</div>\n' +
    '        <div>\n' +
    '          <div class="brand-name">' +
    esc(bn) +
    '</div>\n' +
    '          <div class="brand-handle">' +
    esc(bh) +
    '</div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '      <div class="cta"><span>' +
    esc(d.cta) +
    '</span><span class="cta-arrow">→</span></div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</body>\n' +
    '</html>'
  );
}

/**
 * Renders HTML to PNG. On Linux VPS: install Chrome via Puppeteer postinstall, or
 * apt install chromium-browser and set PUPPETEER_EXECUTABLE_PATH (or CHROME_PATH).
 */
async function renderImageLocally(htmlString) {
  var puppeteer = require('puppeteer');
  var exe =
    String(process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || '').trim() ||
    undefined;
  var launchOpts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };
  if (exe) launchOpts.executablePath = exe;
  var browser;
  try {
    browser = await puppeteer.launch(launchOpts);
    var page = await browser.newPage();
    await page.setDefaultNavigationTimeout(120000);
    await page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
    await page.setContent(htmlString, { waitUntil: 'load' });
    var el = await page.$('body');
    if (!el) {
      throw new Error('No body element for screenshot');
    }
    var buf = await el.screenshot({ type: 'png' });
    if (!buf || !buf.length) {
      throw new Error('Empty PNG buffer from Puppeteer');
    }
    return { url: null, base64: 'data:image/png;base64,' + Buffer.from(buf).toString('base64') };
  } finally {
    if (browser) {
      await browser.close().catch(function () {});
    }
  }
}

function renderImageViaHCTI(html) {
  return renderImageLocally(html);
}

module.exports = {
  normalizeDesign: normalizeDesign,
  suggestBrandHandle: suggestBrandHandle,
  buildPostHtml: buildPostHtml,
  renderImageLocally: renderImageLocally,
  renderImageViaHCTI: renderImageViaHCTI
};
