/**
 * OpenAI Images API — enhance HCTI raster output (gpt-image-1 edits).
 * Single multipart request: quality + input_fidelity always high.
 */

'use strict';

var { Blob } = require('buffer');

var ENHANCE_TIMEOUT_MS = 90000;

function buildEnhancementPrompt(ctx) {
  var brand = String((ctx && ctx.businessName) || 'Brand').trim();
  var accent = String((ctx && ctx.accent_color) || '').trim();
  var platform = String((ctx && ctx.platform) || '').toLowerCase();

  var moodMap = {
    linkedin: 'Swiss editorial restraint, FT / Monocle magazine gravitas.',
    twitter: 'High-impact poster clarity, maximum contrast, brutalist simplicity.',
    instagram: 'Fashion-week editorial, lush controlled color depth, luxury.',
    facebook: 'Warm community editorial, approachable magazine tone.',
    tiktok: 'Gen-Z graphic poster energy, bold youth-premium.'
  };
  var mood = moodMap[platform] || 'Premium editorial agency craft.';

  return (
    'You are given a finished square dark editorial social media graphic for ' +
    brand +
    '. Apply ONE subtle premium print-finish pass only.\n\n' +
    'ABSOLUTE RULES — any violation makes the output completely unusable:\n' +
    '- Every single word of text must remain EXACTLY as shown: same words, same spelling, same positions, same line breaks. Do not change, move, resize, rephrase, or re-render any text whatsoever.\n' +
    '- The crossed-out word must remain crossed out with strikethrough styling exactly as shown.\n' +
    '- The large italic serif highlighted word must remain italic and in the ' +
    accent +
    ' accent color exactly as shown.\n' +
    '- The three-column 01 / 02 / 03 section must remain as exactly three columns with identical text in each column.\n' +
    '- The brand name, handle, and CTA button text must not change in any way.\n' +
    '- Do NOT add any new text, captions, hashtags, watermarks, logos, or overlays of any kind.\n' +
    '- Do NOT crop, rotate, zoom, skew, or alter the square canvas dimensions in any way.\n' +
    '- Do NOT change the layout, font sizes, element positions, or visual hierarchy.\n' +
    '- Do NOT change the background color from near-black to anything else.\n\n' +
    'ONLY THESE VISUAL ENHANCEMENTS ARE PERMITTED:\n' +
    '- Deepen the dark background richness very slightly — cinematic grading on dark fields only.\n' +
    '- Add a subtle micro-vignette at the card edges — dark corners, brighter center.\n' +
    '- Make the ' +
    accent +
    ' accent glow slightly more luminous in the top-right bloom area only.\n' +
    '- Add 2–3% film grain texture that absolutely does NOT obscure small text or fine details.\n' +
    '- Very slightly enhance the visibility of the background grid lines.\n' +
    '- Soft ambient bloom reinforcement on accent-colored UI elements only.\n\n' +
    'PLATFORM ART DIRECTION (mood only — never change any text): ' +
    mood +
    '\n\n' +
    'OUTPUT: One 1024x1024 PNG. Flat premium editorial social graphic. Identical layout and all text identical to the input image.'
  );
}

function stripDataUri(dataUri) {
  var s = String(dataUri || '');
  var i = s.indexOf('base64,');
  if (i !== -1) return s.slice(i + 7);
  return s;
}

function isLikelyNetworkError(err) {
  if (!err || err.name === 'AbortError') return false;
  var name = err.name || '';
  if (name === 'AbortError' || name === 'TypeError') return true;
  var msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('socket') ||
    msg.includes('timed out')
  );
}

async function postImageEditMultipart(dataUriPng, ctx, signal) {
  var apiKey = (process.env.OPENAI_API_KEY || '').trim();
  var rawB64 = stripDataUri(dataUriPng);
  var buffer = Buffer.from(rawB64, 'base64');
  var blob = new Blob([buffer], { type: 'image/png' });
  var form = new FormData();
  form.append('image[]', blob, 'hcti-card.png');
  form.append('model', 'gpt-image-1');
  form.append('prompt', buildEnhancementPrompt(ctx || {}));
  form.append('size', '1024x1024');
  form.append('quality', 'high');
  form.append('input_fidelity', 'high');
  form.append('n', '1');
  form.append('output_format', 'png');
  return fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    body: form,
    signal: signal
  });
}

async function parseEditResponse(resp) {
  var data = await resp.json();
  var item = data && data.data && data.data[0];
  var b64 = item && item.b64_json;
  if (b64) {
    return 'data:image/png;base64,' + b64;
  }
  var url = item && item.url;
  if (url && /^https?:\/\//i.test(String(url))) {
    var imgRes = await fetch(url);
    if (!imgRes.ok) return null;
    var arr = await imgRes.arrayBuffer();
    return 'data:image/png;base64,' + Buffer.from(arr).toString('base64');
  }
  return null;
}

/**
 * @param {string} dataUriPng
 * @param {object} ctx — platform, businessName, accent_color, …
 */
async function enhanceImageFromDataUri(dataUriPng, ctx) {
  var apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    console.error('[content-image-enhance] OPENAI_API_KEY not set');
    return null;
  }
  if (!String(dataUriPng || '').trim()) return null;

  var controller = new AbortController();
  var timeout = setTimeout(function () {
    controller.abort();
  }, ENHANCE_TIMEOUT_MS);

  try {
    var resp;
    try {
      resp = await postImageEditMultipart(dataUriPng, ctx, controller.signal);
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        console.warn('[content-image-enhance] network error, retry once:', err.message);
        resp = await postImageEditMultipart(dataUriPng, ctx, controller.signal);
      } else {
        throw err;
      }
    }

    if (!resp.ok) {
      var errText = await resp.text();
      console.error('[content-image-enhance] edits API error:', resp.status, errText.slice(0, 800));
      return null;
    }

    var dataUriOut = await parseEditResponse(resp);
    if (!dataUriOut) {
      console.error('[content-image-enhance] No image data in response');
      return null;
    }
    console.log('[content-image-enhance] OpenAI edit succeeded');
    return { base64: dataUriOut };
  } catch (err) {
    console.error('[content-image-enhance] failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  buildEnhancementPrompt: buildEnhancementPrompt,
  enhanceImageFromDataUri: enhanceImageFromDataUri
};
