/**
 * OpenAI Images API — enhance HCTI raster output (gpt-image-1 edits) for premium editorial finish.
 */

'use strict';

var { Blob } = require('buffer');

var ENHANCE_TIMEOUT_MS = 90000;

/**
 * Mood hints for the enhance pass (does not change copy — visual tone only).
 */
function platformVisualMood(platform) {
  switch (String(platform || '').toLowerCase()) {
    case 'linkedin':
      return 'Swiss editorial restraint, ample negative space, FT / Monocle magazine gravitas, subtle craft.';
    case 'twitter':
      return 'High-impact poster clarity, maximum contrast, brutalist-leaning simplicity, X feed native.';
    case 'instagram':
      return 'Fashion-week editorial energy, lush but controlled color depth, still luxury not gimmicky.';
    case 'facebook':
      return 'Warm community editorial, approachable Human Parts / digestible magazine tone.';
    case 'tiktok':
      return 'Gen-Z graphic poster energy, kinetic implied shapes (remain flat vector), bold youth-premium.';
    default:
      return 'Premium editorial social graphic, agency craft.';
  }
}

/**
 * High-signal prompt: fidelity to text first; polish second.
 */
function buildEnhancementPrompt(ctx) {
  var platform = ctx.platform || '';
  var mood = platformVisualMood(platform);
  var brand = String(ctx.businessName || 'Brand').trim();
  var topic = String(ctx.contentTopic || '').trim();
  var headline = String(ctx.headline || '').trim();
  var sub = String(ctx.subheadline || '').trim();
  var accent = String(ctx.accent_color || '').trim();

  return (
    'You are given a finished square social-media graphic (flat design, sharp vector-like typography). ' +
    'Apply a single premium "print finish" and editorial polish pass — it must still read as the SAME layout and SAME brand piece.\n\n' +

    'NON-NEGOTIABLE — TEXT AND STRUCTURE:\n' +
    '- Preserve every word of text EXACTLY: same spelling, casing, line breaks, and reading order. Do not re-type, translate, paraphrase, or substitute synonyms.\n' +
    '- Do not add new headlines, subheads, captions, hashtags, watermarks, QR codes, or logos.\n' +
    '- Do not crop, rotate, skew, perspective-warp, or blow out the canvas. Keep the square format.\n' +
    '- Keep hierarchy identical: headline scale relationship vs subhead vs footer vs CTA stays the same.\n\n' +

    'ALLOWED — VISUAL ENHANCEMENT ONLY:\n' +
    '- Deepen background richness: controlled cinematic grading on dark fields only; preserve legibility.\n' +
    '- Add subtle editorial depth: micro-vignette, soft ambient bloom on accent glows, hairline inner shadows on panels, museum-print micro-contrast.\n' +
    '- Refine accent color presence: slightly more luminous ' + (accent || 'accent') + ' in highlights, not neon overshoot.\n' +
    '- Optional tasteful grain (2–4% opacity) and 1px print-registration texture — must not muddy small type.\n' +
    '- Optional: evoke a premium tech "field guide" atmosphere — very subtle blueprint grid in the deep background, soft rim light in the accent color at one corner, concentric circle motif in a quiet corner — without overlapping any text.\n' +
    '- Thin geometric filigree is OK ONLY if it does not touch or cover any glyphs.\n\n' +

    'PLATFORM ART DIRECTION (mood only; do not change words):\n' +
    mood + '\n\n' +

    'CONTEXT (never render this block as new text on the image):\n' +
    '- Brand: ' + brand + '\n' +
    '- Campaign topic: ' + topic + '\n' +
    '- Primary headline on card (must remain byte-identical): ' + headline + '\n' +
    '- Subhead on card (must remain byte-identical): ' + sub + '\n\n' +

    'Output: one square 1024x1024 PNG, flat premium editorial social graphic — not a photograph, not 3D mockup, not stock photo. ' +
    'Typography must stay clean, sharp, unwarped, anti-aliased like a top agency static export.'
  );
}

/**
 * Strip data URL prefix → raw base64.
 */
function stripDataUri(dataUri) {
  var s = String(dataUri || '');
  var i = s.indexOf('base64,');
  if (i !== -1) return s.slice(i + 7);
  return s;
}

/**
 * GPT Image `POST /v1/images/edits` expects JSON with `images: [{ image_url }]` (URL or data URL)
 * or multipart with `image[]` files — not a lone `image` field (legacy DALL·E shape).
 */
async function postImageEditJson(body, signal) {
  var apiKey = (process.env.OPENAI_API_KEY || '').trim();
  return fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey
    },
    body: JSON.stringify(body),
    signal: signal
  });
}

async function postImageEditMultipart(dataUriPng, ctx, signal, includeInputFidelity) {
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
  form.append('n', '1');
  form.append('output_format', 'png');
  if (includeInputFidelity) {
    form.append('input_fidelity', 'high');
  }
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
 * @param {string} dataUriPng — full data:image/png;base64,... from HCTI
 * @param {object} ctx — { platform, businessName, contentTopic, headline, subheadline, accent_color }
 * @returns {Promise<{ base64: string } | null>}
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

  var prompt = buildEnhancementPrompt(ctx || {});

  try {
    var jsonBodyHigh = {
      model: 'gpt-image-1',
      images: [{ image_url: dataUriPng }],
      prompt: prompt,
      size: '1024x1024',
      quality: 'high',
      n: 1,
      input_fidelity: 'high',
      output_format: 'png'
    };
    var jsonBodyLowFidelity = Object.assign({}, jsonBodyHigh, { input_fidelity: 'low' });
    var jsonBodyNoFidelity = {
      model: 'gpt-image-1',
      images: [{ image_url: dataUriPng }],
      prompt: prompt,
      size: '1024x1024',
      quality: 'high',
      n: 1,
      output_format: 'png'
    };

    var resp = await postImageEditJson(jsonBodyHigh, controller.signal);

    if (!resp.ok && resp.status === 400) {
      var t400 = await resp.text();
      console.warn('[content-image-enhance] JSON edit retry after 400:', t400.slice(0, 200));
      resp = await postImageEditJson(jsonBodyLowFidelity, controller.signal);
    }
    if (!resp.ok && resp.status === 400) {
      resp = await postImageEditJson(jsonBodyNoFidelity, controller.signal);
    }

    if (!resp.ok) {
      resp = await postImageEditMultipart(dataUriPng, ctx, controller.signal, true);
    }
    if (!resp.ok && resp.status === 400) {
      resp = await postImageEditMultipart(dataUriPng, ctx, controller.signal, false);
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

    console.log('[content-image-enhance] OpenAI edit succeeded for', ctx && ctx.platform ? ctx.platform : 'post');
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
