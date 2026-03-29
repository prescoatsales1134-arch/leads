/**
 * n8n Code node: dashboard body (Google Leads mode) → Google Maps / Places Apify actor input.
 * Place AFTER Webhook, BEFORE HTTP Request.
 *
 * Dashboard sends: searchTerms, location, maxResults, includeClosedPlaces.
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

var searchTerms = body.searchTerms != null ? String(body.searchTerms).trim() : '';
if (!searchTerms && body.industry != null) searchTerms = String(body.industry).trim(); // legacy compatibility
var locationQuery = body.location != null ? String(body.location).trim() : '';

var maxRaw = body.maxResults != null ? parseInt(body.maxResults, 10) : 50;
if (isNaN(maxRaw) || maxRaw < 1) maxRaw = 50;
var maxCrawledPlacesPerSearch = Math.min(500, maxRaw);

var searchStringsArray = searchTerms ? splitAndTrim(searchTerms) : [];
if (searchStringsArray.length === 0) {
  searchStringsArray = ['local business'];
}

if (!locationQuery) locationQuery = 'United States';

var ACTOR_INPUT = {
  includeWebResults: false,
  language: 'en',
  locationQuery: locationQuery,
  maxCrawledPlacesPerSearch: maxCrawledPlacesPerSearch,
  maximumLeadsEnrichmentRecords: 0,
  scrapeContacts: true,
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
  skipClosedPlaces: !body.includeClosedPlaces
};

return [{ json: { body: ACTOR_INPUT } }];
