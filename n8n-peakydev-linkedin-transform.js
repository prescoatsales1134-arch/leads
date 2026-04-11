/**
 * n8n Code node: dashboard webhook body → Peakydev / LinkedIn-style actor input JSON.
 * Place AFTER Webhook, BEFORE HTTP Request (Apify run-sync-get-dataset-items).
 *
 * Dashboard sends (LinkedIn Leads mode): industry, country, personState/city (region), maxResults,
 * companySize (Peakydev companyEmployeeSize string), keywords, seniority (UI: Job title — Peakydev enums),
 * emailAvailable, phoneAvailable.
 *
 * This node outputs { body: { ... } } where `body` is the Apify POST JSON shape:
 * companyEmployeeSize[], contactEmailStatus, includeEmails, industry[], personCountry[],
 * seniority[], totalResults
 *
 * Comma-separated industry / country / seniority in the dashboard become arrays.
 * Keywords are not included in this contract (extend here if your actor needs them).
 *
 * HTTP Request: JSON body = {{ JSON.stringify($json.body) }} or equivalent so the request body is $json.body.
 */

function splitAndTrim(str) {
  if (str == null || str === '') return [];
  return String(str)
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

var PEAKYDEV_SENIORITY_ENUM = [
  'Founder',
  'Chairman',
  'President',
  'CEO',
  'CXO',
  'Vice President',
  'Director',
  'Head',
  'Manager',
  'Senior',
  'Junior',
  'Entry Level',
  'Executive'
];

function filterToPeakydevSeniority(tokens) {
  var canonByLower = {};
  for (var i = 0; i < PEAKYDEV_SENIORITY_ENUM.length; i++) {
    var s = PEAKYDEV_SENIORITY_ENUM[i];
    canonByLower[s.toLowerCase()] = s;
  }
  var out = [];
  var seen = {};
  for (var j = 0; j < tokens.length; j++) {
    var t = String(tokens[j]).trim();
    if (!t) continue;
    var c = canonByLower[t.toLowerCase()];
    if (c && !seen[c]) {
      seen[c] = true;
      out.push(c);
    }
  }
  return out;
}

var raw = $input.first().json;
var body = raw.body || raw;

var industry = body.industry != null ? String(body.industry).trim() : '';
var country = body.country != null ? String(body.country).trim() : '';
var maxRaw = body.maxResults != null ? parseInt(body.maxResults, 10) : 100;
if (isNaN(maxRaw)) maxRaw = 100;
var totalResults = Math.min(30000, Math.max(100, maxRaw));

var companySizeRaw = body.companySize != null ? String(body.companySize).trim() : '';
var companyEmployeeSize = companySizeRaw ? [companySizeRaw] : [];

var emailAvailable = !!body.emailAvailable;

var industries = industry ? splitAndTrim(industry) : [];
var personCountry = country ? splitAndTrim(country) : [];

var seniority = [];
if (body.seniority != null && String(body.seniority).trim() !== '') {
  var rawSeniority = Array.isArray(body.seniority) ? body.seniority.map(String) : splitAndTrim(String(body.seniority));
  seniority = filterToPeakydevSeniority(rawSeniority);
}

var apiBody = {
  companyEmployeeSize: companyEmployeeSize,
  includeEmails: emailAvailable,
  industry: industries.length ? industries : [],
  personCountry: personCountry.length ? personCountry : [],
  seniority: seniority.length ? seniority : [],
  totalResults: totalResults
};

if (emailAvailable) {
  apiBody.contactEmailStatus = 'verified';
}

return [{ json: { body: apiBody } }];
