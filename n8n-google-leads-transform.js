/**
 * n8n Code node: dashboard body (Google Maps mode) → Google Maps / Places Apify actor input.
 * Place AFTER Webhook, BEFORE HTTP Request.
 *
 * Dashboard sends: industry, country, city (free text), maxResults, emailAvailable, phoneAvailable.
 *
 * Maps to the fixed actor shape:
 * includeWebResults, language, locationQuery, maxCrawledPlacesPerSearch, maximumLeadsEnrichmentRecords,
 * scrapeContacts, scrapeDirectories, scrapePlaceDetailPage, scrapeSocialMediaProfiles, ...,
 * searchStringsArray, skipClosedPlaces
 *
 * HTTP Request: JSON body = {{ JSON.stringify($json.body) }} so the POST body is $json.body.
 */

function splitAndTrim(str) {
  if (str == null || str === '') return [];
  return String(str)
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

var raw = $input.first().json;
var body = raw.body || raw;

var industry = body.industry != null ? String(body.industry).trim() : '';
var country = body.country != null ? String(body.country).trim() : '';
var city = body.city != null ? String(body.city).trim() : '';

var maxRaw = body.maxResults != null ? parseInt(body.maxResults, 10) : 50;
if (isNaN(maxRaw) || maxRaw < 1) maxRaw = 50;
var maxCrawledPlacesPerSearch = Math.min(500, maxRaw);

var searchStringsArray = industry ? splitAndTrim(industry) : [];
if (searchStringsArray.length === 0) {
  searchStringsArray = ['local business'];
}

var locParts = [];
if (city) locParts.push(city);
if (country) locParts.push(country);
var locationQuery = locParts.filter(Boolean).join(', ');
if (!locationQuery) {
  locationQuery = country || 'United States';
}

var ACTOR_INPUT = {
  includeWebResults: false,
  language: 'en',
  locationQuery: locationQuery,
  maxCrawledPlacesPerSearch: maxCrawledPlacesPerSearch,
  maximumLeadsEnrichmentRecords: 0,
  scrapeContacts: !!body.emailAvailable,
  scrapeDirectories: false,
  scrapePlaceDetailPage: false,
  scrapeSocialMediaProfiles: {
    facebooks: true,
    instagrams: true,
    tiktoks: true,
    twitters: true,
    youtubes: true
  },
  scrapeTableReservationProvider: false,
  searchStringsArray: searchStringsArray,
  skipClosedPlaces: false
};

return [{ json: { body: ACTOR_INPUT } }];
