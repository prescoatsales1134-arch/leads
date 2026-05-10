/**
 * Build HTML for branded social post cards and render via HCTI.io (HTML/CSS to PNG).
 * Ported from n8n "Build HTML" node in automation.json.
 */

'use strict';

var ALLOWED_LAYOUTS = ['hero', 'split', 'quote', 'listicle'];

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHexColor(val, fallback) {
  var s = String(val || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) return s;
  return fallback;
}

/**
 * Normalize OpenAI post object design fields for the image template.
 * @param {object} aiPost — raw post from model (includes text + design keys)
 * @param {string} fallbackHeadline — e.g. content topic
 */
function normalizeDesign(aiPost, fallbackHeadline) {
  var d = aiPost || {};
  var bullets = Array.isArray(d.bullets)
    ? d.bullets.slice(0, 3).map(function (b) { return String(b); })
    : [];
  var layout = ALLOWED_LAYOUTS.indexOf(d.layout_style) >= 0 ? d.layout_style : 'hero';
  return {
    headline: String(d.headline || fallbackHeadline || 'Your message').slice(0, 200),
    subheadline: String(d.subheadline || '').slice(0, 500),
    bullets: bullets,
    cta: String(d.cta_button || d.cta || 'Learn More').slice(0, 80),
    accent_color: sanitizeHexColor(d.accent_color, '#7C3AED'),
    bg_gradient_from: sanitizeHexColor(d.bg_gradient_from, '#0F172A'),
    bg_gradient_to: sanitizeHexColor(d.bg_gradient_to, '#1E1B4B'),
    layout_style: layout,
    category_tag: String(d.category_tag || 'INSIGHTS')
      .slice(0, 24)
      .toUpperCase(),
    emoji: String(d.emoji || '✨').slice(0, 8)
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

function buildMainBlock(d) {
  if (d.layout_style === 'listicle' && d.bullets.length) {
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
  if (d.layout_style === 'quote') {
    return (
      '<div class="quote-block"><div class="quote-mark">“</div><p class="sub">' +
      esc(d.subheadline) +
      '</p></div>'
    );
  }
  if (d.layout_style === 'split') {
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
  return '<p class="sub">' + esc(d.subheadline) + '</p>';
}

/**
 * @param {object} design — normalized design tokens
 * @param {string} brandName
 * @param {string} brandHandle — e.g. @acme
 * @param {number} [width=1080]
 * @param {number} [height=1080]
 * @returns {string} full HTML document
 */
function buildPostHtml(design, brandName, brandHandle, width, height) {
  width = width || 1080;
  height = height || 1080;
  var d = design;
  var bn = String(brandName || 'Brand');
  var bh = String(brandHandle || suggestBrandHandle(bn));
  var mainBlock = buildMainBlock(d);
  var h1Size = d.headline.length > 30 ? 76 : 92;
  var firstLetter = esc(bn.charAt(0) || 'B');
  var ac = d.accent_color;
  var gf = d.bg_gradient_from;
  var gt = d.bg_gradient_to;

  return (
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">\n' +
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
    '  }\n' +
    '  .card {\n' +
    '    width: 100%;\n' +
    '    height: 100%;\n' +
    '    padding: 80px 72px;\n' +
    '    background:\n' +
    '      radial-gradient(circle at 85% 15%, ' +
    ac +
    '33 0%, transparent 45%),\n' +
    '      radial-gradient(circle at 15% 85%, ' +
    ac +
    '22 0%, transparent 50%),\n' +
    '      linear-gradient(135deg, ' +
    gf +
    ' 0%, ' +
    gt +
    ' 100%);\n' +
    '    position: relative;\n' +
    '    display: flex;\n' +
    '    flex-direction: column;\n' +
    '    justify-content: space-between;\n' +
    '    overflow: hidden;\n' +
    '  }\n' +
    "  .card::before {\n    content: '';\n" +
    '    position: absolute;\n' +
    '    inset: 0;\n' +
    '    background-image:\n' +
    '      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),\n' +
    '      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);\n' +
    '    background-size: 60px 60px;\n' +
    '    mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);\n' +
    '    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);\n' +
    '    pointer-events: none;\n' +
    '  }\n' +
    "  .card::after {\n    content: '';\n" +
    '    position: absolute;\n' +
    '    top: -150px;\n' +
    '    right: -150px;\n' +
    '    width: 500px;\n' +
    '    height: 500px;\n' +
    '    background: radial-gradient(circle, ' +
    ac +
    '55 0%, transparent 70%);\n' +
    '    filter: blur(40px);\n' +
    '    pointer-events: none;\n' +
    '  }\n' +
    '  .top, .body, .bottom { position: relative; z-index: 1; }\n' +
    '  .top {\n' +
    '    display: flex;\n' +
    '    align-items: center;\n' +
    '    justify-content: space-between;\n' +
    '  }\n' +
    '  .tag {\n' +
    '    display: inline-flex;\n' +
    '    align-items: center;\n' +
    '    gap: 10px;\n' +
    '    padding: 10px 18px;\n' +
    '    background: ' +
    ac +
    '1F;\n' +
    '    border: 1px solid ' +
    ac +
    '66;\n' +
    '    border-radius: 999px;\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-size: 18px;\n' +
    '    font-weight: 600;\n' +
    '    letter-spacing: 0.12em;\n' +
    '    color: ' +
    ac +
    ';\n' +
    '  }\n' +
    '  .tag .dot {\n' +
    '    width: 8px; height: 8px; border-radius: 50%;\n' +
    '    background: ' +
    ac +
    ';\n' +
    '    box-shadow: 0 0 12px ' +
    ac +
    ';\n' +
    '  }\n' +
    '  .emoji {\n' +
    '    font-size: 56px;\n' +
    '    line-height: 1;\n' +
    '    filter: drop-shadow(0 4px 20px ' +
    ac +
    '88);\n' +
    '  }\n' +
    '  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }\n' +
    '  h1 {\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-size: ' +
    h1Size +
    'px;\n' +
    '    font-weight: 700;\n' +
    '    line-height: 1.05;\n' +
    '    letter-spacing: -0.03em;\n' +
    '    margin-bottom: 32px;\n' +
    '    background: linear-gradient(180deg, #fff 0%, #fff 60%, ' +
    ac +
    ' 200%);\n' +
    '    -webkit-background-clip: text;\n' +
    '    background-clip: text;\n' +
    '    -webkit-text-fill-color: transparent;\n' +
    '  }\n' +
    '  .sub {\n' +
    '    font-size: 30px;\n' +
    '    font-weight: 400;\n' +
    '    line-height: 1.45;\n' +
    '    color: rgba(255,255,255,0.78);\n' +
    '    max-width: 92%;\n' +
    '  }\n' +
    '  .bullets { list-style: none; display: flex; flex-direction: column; gap: 18px; margin-top: 8px; }\n' +
    '  .bullets li {\n' +
    '    display: flex; align-items: center; gap: 20px;\n' +
    '    font-size: 30px; font-weight: 500; color: rgba(255,255,255,0.92);\n' +
    '  }\n' +
    '  .bullet-num {\n' +
    '    flex-shrink: 0;\n' +
    '    width: 52px; height: 52px;\n' +
    '    display: flex; align-items: center; justify-content: center;\n' +
    '    background: ' +
    ac +
    ';\n' +
    '    color: #0a0a0a;\n' +
    '    border-radius: 14px;\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-weight: 700; font-size: 26px;\n' +
    '    box-shadow: 0 8px 24px ' +
    ac +
    '66;\n' +
    '  }\n' +
    '  .quote-block { position: relative; padding-left: 60px; }\n' +
    '  .quote-mark {\n' +
    '    position: absolute; left: -10px; top: -40px;\n' +
    "    font-family: 'Space Grotesk', serif;\n" +
    '    font-size: 180px; line-height: 1;\n' +
    '    color: ' +
    ac +
    '; opacity: 0.6;\n' +
    '  }\n' +
    '  .chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }\n' +
    '  .chip {\n' +
    '    padding: 12px 22px;\n' +
    '    background: rgba(255,255,255,0.08);\n' +
    '    border: 1px solid rgba(255,255,255,0.14);\n' +
    '    border-radius: 999px;\n' +
    '    font-size: 22px; font-weight: 500;\n' +
    '    color: rgba(255,255,255,0.9);\n' +
    '    backdrop-filter: blur(12px);\n' +
    '  }\n' +
    '  .bottom {\n' +
    '    display: flex; align-items: center; justify-content: space-between;\n' +
    '    padding-top: 28px;\n' +
    '    border-top: 1px solid rgba(255,255,255,0.1);\n' +
    '  }\n' +
    '  .brand { display: flex; align-items: center; gap: 14px; }\n' +
    '  .brand-mark {\n' +
    '    width: 48px; height: 48px;\n' +
    '    border-radius: 12px;\n' +
    '    background: linear-gradient(135deg, ' +
    ac +
    ', ' +
    ac +
    'AA);\n' +
    '    display: flex; align-items: center; justify-content: center;\n' +
    "    font-family: 'Space Grotesk', sans-serif;\n" +
    '    font-weight: 800; font-size: 22px; color: #0a0a0a;\n' +
    '    box-shadow: 0 8px 24px ' +
    ac +
    '55;\n' +
    '  }\n' +
    '  .brand-text { display: flex; flex-direction: column; }\n' +
    '  .brand-name { font-weight: 700; font-size: 22px; }\n' +
    '  .brand-handle { font-size: 16px; color: rgba(255,255,255,0.55); }\n' +
    '  .cta {\n' +
    '    display: inline-flex; align-items: center; gap: 10px;\n' +
    '    padding: 16px 28px;\n' +
    '    background: ' +
    ac +
    ';\n' +
    '    color: #0a0a0a;\n' +
    '    border-radius: 14px;\n' +
    '    font-weight: 700; font-size: 20px;\n' +
    '    box-shadow: 0 12px 32px ' +
    ac +
    '66;\n' +
    '  }\n' +
    '  .cta-arrow { font-size: 22px; }\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <div class="card">\n' +
    '    <div class="top">\n' +
    '      <div class="tag"><span class="dot"></span>' +
    esc(d.category_tag) +
    '</div>\n' +
    '      <div class="emoji">' +
    esc(d.emoji) +
    '</div>\n' +
    '    </div>\n' +
    '    <div class="body">\n' +
    '      <h1>' +
    esc(d.headline) +
    '</h1>\n' +
    mainBlock +
    '\n    </div>\n' +
    '    <div class="bottom">\n' +
    '      <div class="brand">\n' +
    '        <div class="brand-mark">' +
    firstLetter +
    '</div>\n' +
    '        <div class="brand-text">\n' +
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
 * POST HTML to HCTI and fetch PNG bytes. viewport 540×540 + device_scale 2 → 1080×1080 output.
 * @param {string} htmlString
 * @returns {Promise<{ url: string, base64: string }>}
 */
function renderImageViaHCTI(htmlString) {
  var userId = (process.env.HCTI_USER_ID || '').trim();
  var apiKey = (process.env.HCTI_API_KEY || '').trim();
  if (!userId || !apiKey) {
    return Promise.reject(new Error('HCTI credentials not configured'));
  }
  var auth = Buffer.from(userId + ':' + apiKey, 'utf8').toString('base64');
  var body = new URLSearchParams();
  body.set('html', htmlString);
  body.set('viewport_width', '540');
  body.set('viewport_height', '540');
  body.set('device_scale', '2');

  return fetch('https://hcti.io/v1/image', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  })
    .then(function (res) {
      return res.text().then(function (txt) {
        return { ok: res.ok, status: res.status, raw: txt };
      });
    })
    .then(function (ref) {
      var j;
      try {
        j = JSON.parse(ref.raw);
      } catch (e) {
        throw new Error('HCTI invalid JSON: ' + (ref.raw || '').slice(0, 200));
      }
      if (!ref.ok) {
        throw new Error((j && j.error) || ('HCTI HTTP ' + ref.status));
      }
      var rawUrl = j && (j.url || j.image || j.image_url);
      if (!rawUrl) {
        throw new Error('HCTI response missing url');
      }
      var baseUrl = String(rawUrl).trim();
      if (!/^https?:\/\//i.test(baseUrl)) {
        baseUrl = new URL(baseUrl.replace(/^\/+/, ''), 'https://hcti.io').href;
      }
      var pngUrl =
        baseUrl.indexOf('.png') !== -1 ? baseUrl : baseUrl.replace(/\/?$/, '') + '.png';
      return fetch(pngUrl)
        .then(function (imgRes) {
          if (!imgRes.ok) {
            return fetch(baseUrl).then(function (r2) {
              if (!r2.ok) throw new Error('HCTI image fetch failed');
              return r2.arrayBuffer();
            });
          }
          return imgRes.arrayBuffer();
        })
        .then(function (buf) {
          var b64 = Buffer.from(buf).toString('base64');
          return {
            url: pngUrl,
            base64: 'data:image/png;base64,' + b64
          };
        });
    });
}

module.exports = {
  normalizeDesign: normalizeDesign,
  suggestBrandHandle: suggestBrandHandle,
  buildPostHtml: buildPostHtml,
  renderImageViaHCTI: renderImageViaHCTI
};
