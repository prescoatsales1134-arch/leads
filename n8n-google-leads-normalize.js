/**
 * n8n Code node (TEMPLATE): Google/Maps Apify dataset items → { leads: [...] }.
 * Inspect one successful run and map real field names from your actor output.
 */

var rows = $input.all().map(function (i) { return i.json; });

function pick(row, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (row[keys[i]] != null && String(row[keys[i]]).trim() !== '') return row[keys[i]];
  }
  return null;
}

var normalized = rows.map(function (row) {
  // Typical Google Maps-style fields (names vary by actor — adjust):
  var title = pick(row, ['title', 'name', 'placeName', 'businessName']);
  var address = pick(row, ['address', 'fullAddress', 'formattedAddress']);
  var phone = pick(row, ['phone', 'phoneNumber', 'phoneUnformatted']);
  var website = pick(row, ['website', 'url', 'domain']);
  var email = pick(row, ['email', 'contactEmail']);

  var domain = '';
  if (website) {
    try {
      var u = website.indexOf('http') === 0 ? website : 'https://' + website;
      domain = new URL(u).hostname.replace(/^www\./, '').toLowerCase();
    } catch (e) {
      domain = String(website).replace(/^www\./, '').toLowerCase();
    }
  }

  return {
    lead_source: 'google',
    id: pick(row, ['placeId', 'cid', 'id']) || undefined,
    companyName: title || '',
    contactName: title || '',
    jobTitle: '',
    industry: pick(row, ['categoryName', 'category', 'type']) || '',
    email: email || '',
    phone: phone || '',
    linkedin: '',
    country: '',
    companyDomain: domain,
    // Optional free-text location for the UI/search
    // You can overload `country` or add a custom field only if the app learns it — stick to normalized set for saves
  };
});

return [{ json: { leads: normalized } }];
