/**
 * n8n Code node: Apify dataset items → { leads: [...] } for the dashboard.
 * Place AFTER HTTP Request (run-sync-get-dataset-items), BEFORE Respond to Webhook.
 * Tweak getters if your run output uses different field names (inspect one execution).
 */

var rows = $input.all().map(function (i) { return i.json; });

function isJunkRow(lead) {
  var name = (lead.fullName || lead.full_name || lead.name || '').trim();
  if (!name) return true;
  if (/refer to the log/i.test(name)) return true;
  return false;
}

function getEmail(lead) {
  if (lead.work_email) return lead.work_email;
  if (lead.email) return lead.email;
  if (lead.emails && lead.emails.length && lead.emails[0].address) return lead.emails[0].address;
  if (lead.emails && lead.emails.length && typeof lead.emails[0] === 'string') return lead.emails[0];
  return null;
}

function getPhone(lead) {
  if (lead.mobile_phone) return lead.mobile_phone;
  if (lead.phone) return lead.phone;
  if (lead.phone_numbers && lead.phone_numbers.length) return lead.phone_numbers[0];
  return null;
}

function getLinkedIn(lead) {
  if (lead.linkedin_url) return lead.linkedin_url;
  if (lead.linkedin) return lead.linkedin;
  if (lead.profiles && lead.profiles.length) {
    var p = lead.profiles.find(function (x) { return x.network === 'linkedin'; });
    if (p && p.url) return p.url;
  }
  return null;
}

function getCompanyDomain(lead) {
  var domain = (lead.job_company_website || lead.company_website || lead.companyDomain || '').trim().toLowerCase();
  if (domain) {
    if (domain.indexOf('http://') === 0 || domain.indexOf('https://') === 0) {
      try {
        domain = new URL(domain).hostname;
      } catch (e) {}
    }
    domain = domain.replace(/^www\./, '');
    return domain;
  }
  var email = getEmail(lead);
  if (email && email.indexOf('@') !== -1) return email.split('@')[1].trim().toLowerCase();
  return null;
}

var filtered = rows.filter(function (lead) { return !isJunkRow(lead); });

var normalized = filtered.map(function (lead) {
  return {
    lead_source: 'linkedin',
    companyName: lead.job_company_name || lead.company_name || lead.companyName || null,
    contactName: lead.full_name || lead.fullName || lead.name || null,
    jobTitle: lead.job_title || lead.jobTitle || null,
    industry: lead.industry || null,
    email: getEmail(lead),
    phone: getPhone(lead),
    linkedin: getLinkedIn(lead),
    country: lead.location_country || lead.country || lead.job_company_location_country || null,
    companyDomain: getCompanyDomain(lead)
  };
});

return [{ json: { leads: normalized } }];
