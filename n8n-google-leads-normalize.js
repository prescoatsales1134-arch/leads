/**
 * n8n Code node: Google Maps / Places Apify items → { leads: [...] } for the dashboard.
 * Place AFTER the HTTP Request (or "Get dataset items") so each $input item is one place/row.
 *
 * Output item: { json: { leads: [ ... ] } } — each lead: lead_source, id, companyName, contactName,
 * industry, email, phone, country, companyDomain (no jobTitle / linkedin for Google).
 *
 * Respond to Webhook may return either { "leads": [...] } or [ { "leads": [...] } ]; the app accepts both.
 * If your previous node outputs a single object with an array (e.g. { data: [...] }), see collectRows().
 */

function pick(row, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = row[k];
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

function firstEmail(row) {
  var direct = pick(row, ['email', 'contactEmail', 'contact_email']);
  if (direct) return String(direct).trim();
  var arr = row.emails || row.contactEmails || row.enrichedEmails;
  if (Array.isArray(arr) && arr.length) {
    var e = arr[0];
    if (typeof e === 'string') return e.trim();
    if (e && e.email) return String(e.email).trim();
  }
  return '';
}

function domainFromWebsite(website) {
  if (!website) return '';
  var s = String(website).trim();
  try {
    var u = s.indexOf('http') === 0 ? s : 'https://' + s;
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

/** Guess country from a free-text address (last comma segment) or ISO code fields. */
function countryFromRow(row) {
  var code = pick(row, ['countryCode', 'country_code', 'locationCountryCode']);
  if (code) return String(code).trim();
  var loc = row.location;
  if (loc && typeof loc === 'object') {
    var c = loc.countryCode || loc.country || loc.country_code;
    if (c) return String(c).trim();
  }
  var addr = pick(row, ['address', 'fullAddress', 'formattedAddress', 'formatted_address']);
  if (!addr) return '';
  var parts = String(addr).split(',').map(function (p) { return p.trim(); });
  if (parts.length >= 2) return parts[parts.length - 1];
  return '';
}

function stableId(row, idx) {
  var raw =
    pick(row, ['placeId', 'place_id', 'cid', 'id', 'googleId', 'google_id']) ||
    'g-' + idx + '-' + (pick(row, ['title', 'name']) || 'place').toString().slice(0, 40);
  return String(raw);
}

/**
 * Normalize n8n input to a flat array of row objects (one place per row).
 */
function collectRows() {
  var all = $input.all();
  if (!all || !all.length) return [];
  var first = all[0].json;
  // Single wrapper: { data: [...] } or { items: [...] } or Apify dataset shape
  if (all.length === 1 && first && typeof first === 'object' && !Array.isArray(first)) {
    var inner =
      first.data ||
      first.items ||
      first.results ||
      first.places ||
      (Array.isArray(first) ? first : null);
    if (Array.isArray(inner)) return inner;
  }
  return all.map(function (item) { return item.json; });
}

var rows = collectRows();

var normalized = rows.map(function (row, idx) {
  if (!row || typeof row !== 'object') row = {};

  var title =
    pick(row, ['title', 'name', 'placeName', 'place_name', 'businessName', 'business_name']) || '';
  var phone = pick(row, ['phone', 'phoneNumber', 'phoneUnformatted', 'phone_number', 'internationalPhoneNumber']) || '';
  var website = pick(row, ['website', 'url', 'domain', 'websiteUrl', 'website_url']) || '';
  var category = pick(row, ['categoryName', 'category', 'type', 'types', 'primaryType']) || '';
  if (Array.isArray(category)) category = category.filter(Boolean).join(', ');

  var email = firstEmail(row);
  var domain = domainFromWebsite(website);
  var country = countryFromRow(row);

  return {
    lead_source: 'google',
    id: stableId(row, idx),
    companyName: String(title).trim(),
    contactName: String(title).trim(),
    industry: String(category || '').trim(),
    email: email,
    phone: String(phone || '').trim(),
    country: String(country || '').trim(),
    companyDomain: domain
  };
});

return [{ json: { leads: normalized } }];
