/**
 * Upload generated post PNG to Supabase Storage (public bucket content-images).
 */

'use strict';

var { createClient } = require('@supabase/supabase-js');

/**
 * @param {string} base64DataUri — data:image/png;base64,...
 * @param {string} postId — unique key fragment for filename (e.g. userId_platform_ts)
 * @returns {Promise<string|null>} public URL or null on failure
 */
async function uploadImageToSupabase(base64DataUri, postId) {
  var url = (process.env.SUPABASE_URL || '').trim();
  var key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) {
    console.error('[image-storage] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return null;
  }

  var supabase = createClient(url, key);
  var base64 = String(base64DataUri || '').replace(/^data:image\/png;base64,/, '');
  var buffer = Buffer.from(base64, 'base64');
  var safeId = String(postId || 'post').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  var fileName = 'posts/' + safeId + '_' + Date.now() + '.png';

  var up = await supabase.storage.from('content-images').upload(fileName, buffer, {
    contentType: 'image/png',
    upsert: true
  });

  if (up.error) {
    console.error('[image-storage] Supabase upload failed:', up.error.message);
    return null;
  }

  var pub = supabase.storage.from('content-images').getPublicUrl(fileName);
  return (pub.data && pub.data.publicUrl) || null;
}

module.exports = { uploadImageToSupabase: uploadImageToSupabase };
