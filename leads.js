/**
 * Leads: filters, generate (n8n webhook), table, search, pagination, export CSV, sync HubSpot, modal.
 */
(function (global) {
  var PER_PAGE = 10;
  var PER_PAGE_GENERATE = 10;
  var generateCurrentPage = 1;
  var allLeads = [];
  var filteredLeads = [];
  var lastGeneratedLeads = [];
  var currentPage = 1;
  var selectedLead = null;
  var selectedGenerateIds = {};
  var selectedLeadIds = {};
  var leadSourceTab = 'all';
  /** Generate tab: Apollo.io (linkedin webhook) vs Google Maps. */
  var generateLeadSource = 'linkedin';
  var lastGenerateBannerSource = 'linkedin';

  /** Peakydev LinkedIn scraper — loaded from GET /api/linkedin-filter-options (fallback if API fails). */
  var INDUSTRY_OPTIONS = ['Any'];
  var SENIORITY_OPTIONS = [
    'Any',
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
  var REGIONS_BY_COUNTRY = {};

  var FALLBACK_INDUSTRY_LIST = [
    'Accounting',
    'Banking',
    'Computer Software',
    'Financial Services',
    'Health, Wellness & Fitness',
    'Information Technology & Services',
    'Insurance',
    'Legal Services',
    'Marketing & Advertising',
    'Real Estate',
    'Retail',
    'Staffing and Recruiting'
  ];

  var FALLBACK_COUNTRIES_LIST = [
    'United States',
    'United Kingdom',
    'Canada',
    'Australia',
    'Germany',
    'France',
    'India',
    'Spain',
    'Italy',
    'Netherlands',
    'Brazil',
    'Mexico',
    'Japan',
    'China',
    'United Arab Emirates',
    'Singapore',
    'Israel',
    'South Korea',
    'Sweden',
    'Switzerland'
  ];

  var FALLBACK_REGIONS_BY_COUNTRY = {
    'United States': ['Any', 'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle', 'Denver', 'Boston', 'Nashville', 'Detroit', 'Portland', 'Las Vegas', 'Memphis', 'Louisville', 'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento', 'Kansas City', 'Atlanta', 'Miami', 'Raleigh', 'Omaha', 'Cleveland', 'Virginia Beach', 'Oakland', 'Minneapolis', 'Tulsa', 'Tampa', 'Arlington', 'New Orleans', 'Wichita', 'Bakersfield', 'Colorado Springs', 'Mesa', 'Washington', 'St. Louis', 'Pittsburgh', 'Cincinnati', 'Orlando', 'St. Paul', 'Anchorage', 'Honolulu'],
    'United Kingdom': ['Any', 'London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield', 'Edinburgh', 'Cardiff', 'Belfast', 'Newcastle', 'Nottingham', 'Southampton', 'Brighton', 'Leicester', 'Coventry', 'Hull', 'Bradford', 'Stoke-on-Trent', 'Wolverhampton', 'Derby', 'Plymouth', 'Reading', 'Northampton', 'Luton', 'Aberdeen', 'Portsmouth', 'Sunderland', 'York', 'Oxford', 'Cambridge', 'Bournemouth', 'Swindon', 'Dundee', 'Swansea', 'Milton Keynes', 'Ipswich', 'Newport'],
    'Canada': ['Any', 'Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City', 'Hamilton', 'Kitchener', 'London', 'Victoria', 'Halifax', 'Oshawa', 'Windsor', 'Saskatoon', 'Regina', 'Sherbrooke', 'Barrie'],
    'Australia': ['Any', 'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Newcastle', 'Canberra', 'Sunshine Coast', 'Wollongong', 'Hobart', 'Geelong', 'Townsville', 'Cairns', 'Darwin'],
    'Germany': ['Any', 'Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden', 'Hanover', 'Nuremberg'],
    'France': ['Any', 'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Le Havre'],
    'India': ['Any', 'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore'],
    'Spain': ['Any', 'Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Bilbao', 'Alicante'],
    'Italy': ['Any', 'Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Venice', 'Verona'],
    'Netherlands': ['Any', 'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere', 'Breda'],
    'Brazil': ['Any', 'São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife'],
    'Mexico': ['Any', 'Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Zapopan', 'Mérida'],
    'Japan': ['Any', 'Tokyo', 'Yokohama', 'Osaka', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kyoto', 'Kawasaki', 'Saitama'],
    'China': ['Any', 'Shanghai', 'Beijing', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan', 'Xi\'an', 'Suzhou'],
    'United Arab Emirates': ['Any', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
    'Singapore': ['Any', 'Singapore'],
    'Israel': ['Any', 'Tel Aviv', 'Jerusalem', 'Haifa', 'Rishon LeZion', 'Petah Tikva', 'Netanya', 'Beersheba', 'Holon', 'Bnei Brak'],
    'South Korea': ['Any', 'Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Suwon', 'Ulsan', 'Changwon'],
    'Sweden': ['Any', 'Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg'],
    'Switzerland': ['Any', 'Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Winterthur', 'Lucerne', 'St. Gallen']
  };

  var FALLBACK_COMPANY_SIZES = [
    { value: '0 - 1', label: '0 – 1 employees' },
    { value: '2 - 10', label: '2 – 10' },
    { value: '11 - 50', label: '11 – 50' },
    { value: '51 - 200', label: '51 – 200' },
    { value: '201 - 500', label: '201 – 500' },
    { value: '501 - 1000', label: '501 – 1,000' },
    { value: '1001 - 5000', label: '1,001 – 5,000' },
    { value: '5001 - 10000', label: '5,001 – 10,000' },
    { value: '10000+', label: '10,000+' }
  ];

  var PEAKYDEV_SENIORITY_LIST = SENIORITY_OPTIONS.slice(1);

  function cloneRegionsFallback() {
    var o = {};
    for (var k in FALLBACK_REGIONS_BY_COUNTRY) {
      if (FALLBACK_REGIONS_BY_COUNTRY.hasOwnProperty(k)) {
        o[k] = FALLBACK_REGIONS_BY_COUNTRY[k].filter(function (x) { return x !== 'Any'; });
      }
    }
    return o;
  }

  function buildFallbackLinkedinPayload() {
    return {
      industries: FALLBACK_INDUSTRY_LIST.slice(),
      countries: FALLBACK_COUNTRIES_LIST.slice(),
      regionsByCountry: cloneRegionsFallback(),
      seniority: PEAKYDEV_SENIORITY_LIST.slice(),
      companySizes: FALLBACK_COMPANY_SIZES.slice()
    };
  }

  function applyLinkedinFilterData(data) {
    if (!data) return;
    INDUSTRY_OPTIONS = ['Any'].concat(data.industries || FALLBACK_INDUSTRY_LIST);
    SENIORITY_OPTIONS = ['Any'].concat(data.seniority || PEAKYDEV_SENIORITY_LIST);
    REGIONS_BY_COUNTRY = data.regionsByCountry && typeof data.regionsByCountry === 'object'
      ? data.regionsByCountry
      : cloneRegionsFallback();

    var countrySel = document.getElementById('filter-country');
    if (countrySel) {
      var countries = data.countries && data.countries.length ? data.countries : FALLBACK_COUNTRIES_LIST;
      countrySel.innerHTML = '<option value="">Any country</option>' + countries.map(function (c) {
        return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
      }).join('');
    }

    var sizeSel = document.getElementById('filter-companySize');
    if (sizeSel && data.companySizes && data.companySizes.length) {
      sizeSel.innerHTML = '<option value="">Any company size</option>' + data.companySizes.map(function (o) {
        return '<option value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</option>';
      }).join('');
    }

    if (typeof global._refreshLinkedinRegionOptions === 'function') {
      global._refreshLinkedinRegionOptions();
    }
  }

  function loadLinkedinFilterOptions() {
    return fetch('/api/linkedin-filter-options', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return Promise.reject(new Error('linkedin options ' + r.status));
        return r.json();
      })
      .then(function (data) {
        applyLinkedinFilterData(data);
      })
      .catch(function () {
        applyLinkedinFilterData(buildFallbackLinkedinPayload());
      });
  }

  function getEnv() {
    return (global.__ENV__ || {});
  }

  function getGenerateWebhook() {
    return getEnv().N8N_GENERATE_LEADS_WEBHOOK || '';
  }

  function getSyncWebhook() {
    return getEnv().N8N_SYNC_HUBSPOT_WEBHOOK || '';
  }

  function syncGenerateSourceUI() {
    var panel = document.querySelector('#page-generate .filters-panel');
    var industryInput = document.getElementById('filter-industry');
    document.querySelectorAll('#page-generate .generate-source-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-generate-source') === generateLeadSource;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (panel) panel.setAttribute('data-generate-source', generateLeadSource);
    if (industryInput) {
      industryInput.placeholder = generateLeadSource === 'google'
        ? 'e.g. Real Estate (comma-separated for multiple)'
        : 'Search Peakydev industries…';
    }
  }

  function getFilterPayload() {
    var industryEl = document.getElementById('filter-industry');
    var maxEl = document.getElementById('filter-maxResults');
    var maxVal = maxEl && maxEl.value ? parseInt(maxEl.value, 10) : 50;
    if (isNaN(maxVal) || maxVal < 1) maxVal = 50;
    var industryVal = (industryEl && industryEl.value) ? industryEl.value.trim() : '';
    if (industryVal === 'Any') industryVal = '';
    var countryVal = (document.getElementById('filter-country') && document.getElementById('filter-country').value) || '';
    var emailAvailable = !!(document.getElementById('filter-emailAvailable') && document.getElementById('filter-emailAvailable').checked);
    var phoneAvailable = !!(document.getElementById('filter-phoneAvailable') && document.getElementById('filter-phoneAvailable').checked);

    if (generateLeadSource === 'google') {
      var googleCityEl = document.getElementById('filter-google-city');
      var cityFree = (googleCityEl && googleCityEl.value) ? googleCityEl.value.trim() : '';
      return {
        industry: industryVal,
        country: countryVal,
        city: cityFree,
        maxResults: maxVal,
        emailAvailable: emailAvailable,
        phoneAvailable: phoneAvailable
      };
    }

    var seniorityEl = document.getElementById('filter-seniority');
    var regionEl = document.getElementById('filter-city');
    var seniorityVal = (seniorityEl && seniorityEl.value) ? seniorityEl.value.trim() : '';
    if (seniorityVal === 'Any') seniorityVal = '';
    var regionVal = (regionEl && regionEl.value) ? regionEl.value.trim() : '';
    if (regionVal === 'Any') regionVal = '';
    return {
      industry: industryVal,
      country: countryVal,
      city: regionVal,
      personState: regionVal,
      maxResults: maxVal,
      companySize: (document.getElementById('filter-companySize') && document.getElementById('filter-companySize').value) || '',
      keywords: (document.getElementById('filter-keywords') && document.getElementById('filter-keywords').value) || '',
      jobTitle: (document.getElementById('filter-jobTitle') && document.getElementById('filter-jobTitle').value) || '',
      seniority: seniorityVal,
      emailAvailable: emailAvailable,
      phoneAvailable: phoneAvailable
    };
  }

  function titleCase(str) {
    if (str == null || typeof str !== 'string') return '';
    return str.trim().replace(/\w\S*/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  function normalizeClientLeadSource(v) {
    if (v === 'google' || (v && String(v).toLowerCase() === 'google')) return 'google';
    return 'linkedin';
  }

  function formatLeadSourceLabel(src) {
    return normalizeClientLeadSource(src) === 'google' ? 'Google' : 'LinkedIn';
  }

  function buildLeadsFromPayload(payload, defaultLeadSource) {
    var defSrc = normalizeClientLeadSource(defaultLeadSource != null ? defaultLeadSource : 'linkedin');
    // n8n may return [ { leads: [...] } ], { leads: [...] }, or raw array of lead objects. Normalize to array of lead objects.
    var list = [];
    if (Array.isArray(payload)) {
      if (payload.length && payload[0] && Array.isArray(payload[0].leads)) {
        list = payload[0].leads;
      } else {
        list = payload;
      }
    } else if (payload && payload.leads && Array.isArray(payload.leads)) {
      list = payload.leads;
    }
    return list.map(function (item) {
      // Support both dashboard format and Apify output (job_company_name, full_name, work_email, mobile_phone, location_country)
      var contactName = item.contactName || item.contact_name || item.full_name || item.name || '';
      if (!contactName && (item.first_name || item.last_name)) {
        contactName = [item.first_name, item.last_name].filter(Boolean).join(' ').trim();
      }
      var email = item.email || item.work_email || '';
      if (!email && item.personal_emails && item.personal_emails[0]) email = item.personal_emails[0];
      var companyName = (item.companyName || item.company_name || item.job_company_name || item.company || '').trim();
      var jobTitle = (item.jobTitle || item.job_title || '').trim();
      var industry = (item.industry || '').trim();
      var country = (item.country || item.location_country || '').trim();
      var linkedin = (item.linkedin || item.linkedin_url || '').trim();
      var companyDomain = (item.companyDomain || item.job_company_website || '').trim().toLowerCase();
      var leadSource = normalizeClientLeadSource(item.lead_source || item.leadSource || defSrc);
      return {
        id: item.id || item.email || email || Math.random().toString(36).slice(2),
        companyName: titleCase(companyName),
        contactName: titleCase(contactName),
        jobTitle: titleCase(jobTitle),
        industry: titleCase(industry),
        email: email,
        phone: item.phone || item.mobile_phone || '',
        linkedin: linkedin,
        companyDomain: companyDomain,
        country: titleCase(country),
        status: item.status || 'New',
        createdAt: item.createdAt || new Date().toISOString(),
        leadSource: leadSource
      };
    });
  }

  function saveLeadsToServer(leadsArray) {
    if (!leadsArray || !leadsArray.length) return;
    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: leadsArray }),
      credentials: 'same-origin'
    })
      .then(function (r) {
        if (!r.ok) {
          if (global.utils && global.utils.toast) {
            if (r.status === 401) {
              global.utils.toast('Leads not saved — please sign in again.', 'error');
            } else if (r.status === 403) {
              r.json().catch(function () { return {}; }).then(function (d) {
                global.utils.toast((d && d.error) || 'Lead limit reached. Could not save.', 'error');
              });
            } else {
              global.utils.toast('Leads could not be saved. Try again.', 'error');
            }
          }
          return;
        }
        r.json().catch(function () { return {}; }).then(function (d) {
          if (global.utils && global.utils.toast && d && d.capped) {
            var notSaved = (d.notSaved != null) ? d.notSaved : 0;
            var msg = d.saved + ' lead' + (d.saved !== 1 ? 's' : '') + ' saved (monthly limit reached).';
            if (notSaved > 0) msg += ' ' + notSaved + ' not saved.';
            global.utils.toast(msg, 'info');
          }
          updateLeadLimitDisplay();
        });
      })
      .catch(function () {
        if (global.utils && global.utils.toast) global.utils.toast('Leads could not be saved. Check your connection.', 'error');
      });
  }

  function loadFromServer() {
    fetch('/api/leads', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        if (Array.isArray(data)) {
          allLeads = data.map(function (lead) {
            var l = {};
            for (var k in lead) { if (lead.hasOwnProperty(k)) l[k] = lead[k]; }
            l.companyName = titleCase(lead.companyName || '');
            l.contactName = titleCase(lead.contactName || '');
            l.jobTitle = titleCase(lead.jobTitle || '');
            l.industry = titleCase(lead.industry || '');
            l.country = titleCase(lead.country || '');
            l.companyDomain = (lead.companyDomain || lead.company_domain || '').toLowerCase().trim();
            l.linkedin = (lead.linkedin || lead.linkedin_url || '').trim();
            l.leadSource = normalizeClientLeadSource(lead.leadSource || lead.lead_source);
            return l;
          });
          applySearch();
          renderLeadsTable();
          if (global.app && global.app.updateDashboardStats) global.app.updateDashboardStats();
        }
      })
      .catch(function () {});
  }

  function addLeads(leads, onAdded, defaultLeadSource) {
    var normalized = buildLeadsFromPayload(leads, defaultLeadSource);
    var addedCount = 0;
    normalized.forEach(function (l) {
      var exists = allLeads.some(function (x) { return x.id === l.id || (x.email && x.email === l.email); });
      if (!exists) {
        allLeads.push(l);
        addedCount++;
      }
    });
    saveLeadsToServer(normalized);
    applySearch();
    renderLeadsTable();
    renderGenerateResults(normalized);
    if (typeof onAdded === 'function') onAdded(normalized, addedCount, normalized.length - addedCount);
    if (global.app && global.app.updateDashboardStats) global.app.updateDashboardStats();
  }

  function getAll() {
    return allLeads;
  }

  function getLeadDateString(lead) {
    var raw = lead.createdAt || lead.scrapedAt || '';
    if (!raw) return '';
    var d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function applySearch() {
    var q = (document.getElementById('leads-search') && document.getElementById('leads-search').value) || '';
    q = q.trim().toLowerCase();
    var dateVal = (document.getElementById('leads-date') && document.getElementById('leads-date').value) || '';
    var list = allLeads.slice();
    if (q) {
      list = list.filter(function (l) {
        return [
          l.companyName, l.contactName, l.jobTitle, l.industry,
          l.email, l.phone, l.linkedin, l.companyDomain, l.country, l.status,
          formatLeadSourceLabel(l.leadSource), normalizeClientLeadSource(l.leadSource)
        ].some(function (v) { return String(v).toLowerCase().indexOf(q) !== -1; });
      });
    }
    if (dateVal) {
      list = list.filter(function (l) { return getLeadDateString(l) === dateVal; });
    }
    if (leadSourceTab === 'linkedin') {
      list = list.filter(function (l) { return normalizeClientLeadSource(l.leadSource) === 'linkedin'; });
    } else if (leadSourceTab === 'google') {
      list = list.filter(function (l) { return normalizeClientLeadSource(l.leadSource) === 'google'; });
    }
    filteredLeads = list;
  }

  function getPaginatedSlice() {
    var start = (currentPage - 1) * PER_PAGE;
    return filteredLeads.slice(start, start + PER_PAGE);
  }

  function renderLeadsTable() {
    var wrap = document.getElementById('leads-table-wrap');
    var tbody = document.getElementById('leads-tbody');
    var empty = document.getElementById('leads-empty');
    var pagination = document.getElementById('leads-pagination');
    var paginationInfo = document.getElementById('leads-pagination-info');
    var prevBtn = document.getElementById('leads-prev');
    var nextBtn = document.getElementById('leads-next');

    if (!tbody) return;

    applySearch();
    var slice = getPaginatedSlice();
    var total = filteredLeads.length;
    var totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    if (total === 0) {
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = false;
      if (pagination) pagination.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    if (wrap) wrap.hidden = false;

    var leadId = function (l) { return l.id || l.email || ''; };
    tbody.innerHTML = slice.map(function (lead) {
      var id = leadId(lead);
      var checked = selectedLeadIds[id] ? ' checked' : '';
      return (
        '<tr data-lead-id="' + escapeHtml(id) + '">' +
        '<td class="col-select"><input type="checkbox" class="leads-row-select"' + checked + ' data-lead-id="' + escapeHtml(id) + '" /></td>' +
        '<td>' + escapeHtml(lead.companyName) + '</td>' +
        '<td>' + escapeHtml(lead.contactName) + '</td>' +
        '<td>' + escapeHtml(lead.jobTitle) + '</td>' +
        '<td>' + escapeHtml(lead.industry) + '</td>' +
        '<td><span class="lead-source-badge lead-source-badge--' + escapeHtml(normalizeClientLeadSource(lead.leadSource)) + '">' + escapeHtml(formatLeadSourceLabel(lead.leadSource)) + '</span></td>' +
        '<td>' + escapeHtml(lead.email) + '</td>' +
        '<td>' + escapeHtml(lead.phone) + '</td>' +
        '<td>' + escapeHtml(lead.country) + '</td>' +
        '<td>' + escapeHtml(lead.companyDomain || '') + '</td>' +
        '<td>' + (lead.linkedin ? '<a href="' + escapeHtml(lead.linkedin.indexOf('http') === 0 ? lead.linkedin : 'https://' + lead.linkedin.replace(/^\/+/, '')) + '" target="_blank" rel="noopener noreferrer" class="btn-link">LinkedIn</a>' : '—') + '</td>' +
        '<td>' + escapeHtml(formatScrapedAt(lead.createdAt)) + '</td>' +
        '<td>' + escapeHtml(lead.status) + '</td>' +
        '<td>' +
        '<button type="button" class="btn-link btn-view-lead">View</button>' +
        '</td></tr>'
      );
    }).join('');

    var selectAll = document.getElementById('leads-select-all');
    if (selectAll) {
      selectAll.checked = slice.length > 0 && slice.every(function (l) { return selectedLeadIds[leadId(l)]; });
      selectAll.onclick = function () {
        var checked = selectAll.checked;
        slice.forEach(function (l) { selectedLeadIds[leadId(l)] = checked; });
        tbody.querySelectorAll('.leads-row-select').forEach(function (cb) { cb.checked = checked; });
      };
    }
    slice.forEach(function (lead, i) {
      var row = tbody.children[i];
      if (!row) return;
      var viewBtn = row.querySelector('.btn-view-lead');
      var cb = row.querySelector('.leads-row-select');
      if (viewBtn) viewBtn.addEventListener('click', function () { openLeadModal(lead); });
      if (cb) cb.addEventListener('change', function () { selectedLeadIds[leadId(lead)] = cb.checked; });
    });

    if (pagination) pagination.hidden = false;
    if (paginationInfo) paginationInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages;
    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1;
      prevBtn.onclick = function () {
        if (currentPage > 1) { currentPage--; renderLeadsTable(); }
      };
    }
    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages;
      nextBtn.onclick = function () {
        if (currentPage < totalPages) { currentPage++; renderLeadsTable(); }
      };
    }
  }

  function formatScrapedAt(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return '—';
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function openLeadModal(lead) {
    selectedLead = lead;
    var overlay = document.getElementById('lead-modal-overlay');
    var body = document.getElementById('lead-modal-body');
    var title = document.getElementById('lead-modal-title');
    if (title) title.textContent = lead.companyName || 'Lead details';
    if (body) {
      body.innerHTML = (
        '<dl>' +
        '<dt>Company</dt><dd>' + escapeHtml(lead.companyName) + '</dd>' +
        '<dt>Contact</dt><dd>' + escapeHtml(lead.contactName) + '</dd>' +
        '<dt>Job Title</dt><dd>' + escapeHtml(lead.jobTitle) + '</dd>' +
        '<dt>Industry</dt><dd>' + escapeHtml(lead.industry) + '</dd>' +
        '<dt>Source</dt><dd>' + escapeHtml(formatLeadSourceLabel(lead.leadSource)) + '</dd>' +
        '<dt>Email</dt><dd>' + escapeHtml(lead.email) + '</dd>' +
        '<dt>Phone</dt><dd>' + escapeHtml(lead.phone) + '</dd>' +
        '<dt>Country</dt><dd>' + escapeHtml(lead.country) + '</dd>' +
        (lead.companyDomain ? '<dt>Company Domain</dt><dd>' + escapeHtml(lead.companyDomain) + '</dd>' : '') +
        (lead.linkedin ? '<dt>LinkedIn</dt><dd><a href="' + escapeHtml(lead.linkedin.indexOf('http') === 0 ? lead.linkedin : 'https://' + lead.linkedin.replace(/^\/+/, '')) + '" target="_blank" rel="noopener noreferrer" class="btn-link">View profile</a></dd>' : '') +
        '<dt>Status</dt><dd>' + escapeHtml(lead.status) + '</dd>' +
        '</dl>'
      );
    }
    if (overlay) overlay.hidden = false;
  }

  function closeLeadModal() {
    selectedLead = null;
    var overlay = document.getElementById('lead-modal-overlay');
    if (overlay) overlay.hidden = true;
  }

  // Attach close listeners as soon as script runs so close works even before init()
  (function attachModalClose() {
    var overlay = document.getElementById('lead-modal-overlay');
    var modalClose = document.getElementById('lead-modal-close');
    var modalCloseBtn = document.getElementById('lead-modal-close-btn');
    if (modalClose) modalClose.addEventListener('click', closeLeadModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeLeadModal);
    if (overlay) overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeLeadModal();
    });
  })();

  function syncLead(lead, skipLog) {
    return syncBatch([lead], skipLog);
  }

  function renderGenerateResults(leads) {
    var wrap = document.getElementById('generate-results-table-wrap');
    var empty = document.getElementById('generate-empty');
    var pagination = document.getElementById('generate-pagination');
    var paginationInfo = document.getElementById('generate-pagination-info');
    var prevBtn = document.getElementById('generate-prev');
    var nextBtn = document.getElementById('generate-next');
    if (!wrap) return;
    if (leads && leads.length) {
      lastGeneratedLeads = leads.slice();
      generateCurrentPage = 1;
    }
    var total = lastGeneratedLeads.length;
    if (total === 0) {
      wrap.hidden = true;
      if (pagination) pagination.hidden = true;
      if (empty) empty.hidden = false;
      var banner = document.getElementById('generate-success-banner');
      var nextStep = document.getElementById('generate-next-step-card');
      var aiCard = document.getElementById('ai-assistant-card');
      if (banner) banner.hidden = true;
      if (nextStep) nextStep.hidden = true;
      if (aiCard) aiCard.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    var bannerEl = document.getElementById('generate-success-banner');
    var countEl = document.getElementById('generate-success-count');
    var nextStepEl = document.getElementById('generate-next-step-card');
    var aiCardEl = document.getElementById('ai-assistant-card');
    if (bannerEl) {
      bannerEl.hidden = false;
      if (countEl) countEl.textContent = total;
      var suffixEl = document.getElementById('generate-success-suffix');
      if (suffixEl) {
        suffixEl.textContent = lastGenerateBannerSource === 'google'
          ? 'Google Maps Leads Generated Successfully'
          : 'Apollo.io Leads Generated Successfully';
      }
    }
    if (nextStepEl) {
      nextStepEl.hidden = false;
      var primaryBtn = document.getElementById('btn-next-step-messages');
      if (primaryBtn) {
        primaryBtn.classList.remove('next-step-primary-pulse');
        primaryBtn.offsetHeight;
        primaryBtn.classList.add('next-step-primary-pulse');
        setTimeout(function () { primaryBtn.classList.remove('next-step-primary-pulse'); }, 3000);
      }
    }
    if (aiCardEl) aiCardEl.hidden = false;
    wrap.hidden = false;
    var totalPages = Math.max(1, Math.ceil(total / PER_PAGE_GENERATE));
    var start = (generateCurrentPage - 1) * PER_PAGE_GENERATE;
    var slice = lastGeneratedLeads.slice(start, start + PER_PAGE_GENERATE);
    var cols = ['companyName', 'contactName', 'jobTitle', 'industry', 'leadSource', 'email', 'phone', 'country', 'companyDomain', 'linkedin', 'status'];
    var headerLabels = {
      companyName: 'Company Name',
      contactName: 'Contact Name',
      jobTitle: 'Job Title',
      industry: 'Industry',
      leadSource: 'Source',
      email: 'Email',
      phone: 'Phone',
      country: 'Country',
      companyDomain: 'Company Domain',
      linkedin: 'LinkedIn',
      status: 'Status'
    };
    var leadId = function (l) { return l.id || l.email || ''; };
    wrap.innerHTML = '<table class="data-table" id="generate-results-table"><thead><tr>' +
      '<th class="col-select"><input type="checkbox" id="generate-select-all" title="Select all" /></th>' +
      cols.map(function (c) { return '<th>' + (headerLabels[c] || c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      slice.map(function (l) {
        var id = leadId(l);
        var checked = selectedGenerateIds[id] ? ' checked' : '';
        var cellHtml = cols.map(function (c) {
          var val = l[c] || '';
          var escaped = escapeHtml(val);
          if (c === 'leadSource') {
            var src = normalizeClientLeadSource(l.leadSource);
            return '<td><span class="lead-source-badge lead-source-badge--' + escapeHtml(src) + '">' + escapeHtml(formatLeadSourceLabel(l.leadSource)) + '</span></td>';
          }
          if (c === 'linkedin' && val) {
            var href = val.indexOf('http') === 0 ? val : 'https://' + val.replace(/^\/+/, '');
            return '<td class="col-linkedin"><a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer" class="btn-link">LinkedIn</a></td>';
          }
          return '<td title="' + escaped + '"><span class="cell-text">' + escaped + '</span></td>';
        }).join('');
        return '<tr data-lead-id="' + escapeHtml(id) + '"><td class="col-select"><input type="checkbox" class="generate-row-select"' + checked + ' data-lead-id="' + escapeHtml(id) + '" /></td>' + cellHtml + '</tr>';
      }).join('') +
      '</tbody></table>';
    var selectAll = document.getElementById('generate-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', function () {
        var checked = selectAll.checked;
        slice.forEach(function (l) { selectedGenerateIds[leadId(l)] = checked; });
        wrap.querySelectorAll('.generate-row-select').forEach(function (cb) { cb.checked = checked; });
      });
    }
    wrap.querySelectorAll('.generate-row-select').forEach(function (cb) {
      cb.addEventListener('change', function () { selectedGenerateIds[cb.getAttribute('data-lead-id')] = cb.checked; });
    });
    if (pagination) {
      pagination.hidden = totalPages <= 1;
      if (paginationInfo) paginationInfo.textContent = 'Page ' + generateCurrentPage + ' of ' + totalPages;
      if (prevBtn) {
        prevBtn.disabled = generateCurrentPage <= 1;
        prevBtn.onclick = function () {
          if (generateCurrentPage <= 1) return;
          generateCurrentPage--;
          renderGenerateResults();
        };
      }
      if (nextBtn) {
        nextBtn.disabled = generateCurrentPage >= totalPages;
        nextBtn.onclick = function () {
          if (generateCurrentPage >= totalPages) return;
          generateCurrentPage++;
          renderGenerateResults();
        };
      }
    }
  }

  function exportCSVFromGenerate() {
    var toExport = getSelectedGenerateLeads();
    if (toExport.length === 0) {
      if (global.utils && global.utils.toast) global.utils.toast('No results to export', 'info');
      return;
    }
    var cols = ['companyName', 'companyDomain', 'contactName', 'jobTitle', 'industry', 'leadSource', 'email', 'phone', 'linkedin', 'country', 'status'];
    var csv = global.utils && global.utils.toCSV ? global.utils.toCSV(toExport, cols) : '';
    if (!csv) {
      if (global.utils && global.utils.toast) global.utils.toast('No data to export', 'info');
      return;
    }
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    if (global.utils && global.utils.downloadBlob) {
      global.utils.downloadBlob(blob, 'leads-generated-' + new Date().toISOString().slice(0, 10) + '.csv');
    }
    if (global.logActivity) global.logActivity('export_csv', { count: toExport.length, leads: toExport.slice(0, 50) });
    addToExportTotal(toExport.length);
    if (global.utils && global.utils.toast) global.utils.toast('CSV exported', 'success');
  }

  function addToExportTotal(count) {
    if (count <= 0) return;
    if (!global.auth || !global.auth.getUser) return;
    global.auth.getUser().then(function (user) {
      if (!user || !user.id) return;
      try {
        var key = 'leads_linked_export_total_' + user.id;
        var prev = parseInt(localStorage.getItem(key) || '0', 10);
        localStorage.setItem(key, String(prev + count));
        if (global.app && global.app.updateDashboardStats) global.app.updateDashboardStats();
      } catch (e) {}
    });
  }

  function withButtonLoading(btn, fn) {
    if (!btn) return fn();
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = 'Syncing…';
    var p = fn();
    if (p && typeof p.then === 'function') {
      p.finally(function () {
        btn.disabled = false;
        btn.classList.remove('is-loading');
        btn.textContent = originalText;
      });
    } else {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.textContent = originalText;
    }
    return p;
  }

  function normalizeLeadForSync(lead) {
    return {
      id: lead.id || lead.email || '',
      companyName: lead.companyName || '',
      contactName: lead.contactName || '',
      jobTitle: lead.jobTitle || '',
      industry: lead.industry || '',
      email: lead.email || '',
      phone: lead.phone || '',
      linkedin: lead.linkedin || '',
      companyDomain: lead.companyDomain || '',
      country: lead.country || '',
      status: lead.status || 'New',
      leadSource: normalizeClientLeadSource(lead.leadSource)
    };
  }

  function syncBatch(leads, skipLog) {
    if (!getSyncWebhook()) {
      if (global.utils && global.utils.toast) global.utils.toast('Sync webhook not configured', 'error');
      return Promise.resolve();
    }
    if (!leads || leads.length === 0) {
      if (global.utils && global.utils.toast) global.utils.toast('No leads to sync', 'info');
      return Promise.resolve();
    }
    var payload = leads.map(normalizeLeadForSync);
    if (!skipLog && global.logActivity) global.logActivity('sync_hubspot', { count: payload.length, leads: payload.slice(0, 10) });
    return fetch('/api/sync-hubspot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: payload }),
      credentials: 'same-origin'
    })
      .then(function (res) {
        if (res.ok) {
          leads.forEach(function (l) { l.status = 'Synced'; });
          saveLeadsToServer(leads);
          renderLeadsTable();
          renderGenerateResults(lastGeneratedLeads.length ? lastGeneratedLeads : null);
          if (global.app && global.app.updateDashboardStats) global.app.updateDashboardStats();
          if (global.utils && global.utils.toast) global.utils.toast('Synced ' + leads.length + ' leads to HubSpot', 'success');
        } else {
          if (global.utils && global.utils.toast) global.utils.toast('Sync to HubSpot failed', 'error');
        }
      })
      .catch(function () {
        if (global.utils && global.utils.toast) global.utils.toast('Sync to HubSpot failed', 'error');
      });
  }

  function getSelectedGenerateLeads() {
    var selected = lastGeneratedLeads.filter(function (l) { return selectedGenerateIds[l.id || l.email || '']; });
    return selected.length ? selected : lastGeneratedLeads.slice();
  }

  function syncAllFromGenerate() {
    var toSync = getSelectedGenerateLeads();
    if (toSync.length === 0) {
      if (global.utils && global.utils.toast) global.utils.toast('No results to sync', 'info');
      return Promise.resolve();
    }
    if (!getSyncWebhook()) {
      if (global.utils && global.utils.toast) global.utils.toast('Sync webhook not configured', 'error');
      return Promise.resolve();
    }
    return syncBatch(toSync, true);
  }

  function generateLeads() {
    var payload = getFilterPayload();
    var maxResults = payload.maxResults || 50;
    var btn = document.getElementById('btn-generate-leads');
    if (global.utils && global.utils.showLoading) {
      global.utils.showLoading('generate-loading', ['generate-empty', 'generate-results-table-wrap']);
    }
    if (btn) btn.disabled = true;

    function doGenerate() {
      var source = generateLeadSource === 'google' ? 'google' : 'linkedin';
      var body = Object.assign({}, payload, { source: source });
      fetch('/api/generate-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.status === 403 && data && data.error) {
            if (global.utils && global.utils.toast) global.utils.toast(data.error, 'error');
            addLeads([]);
            return;
          }
          if (!res.ok) {
            if (global.utils && global.utils.toast) global.utils.toast((data && data.error) || 'Failed to generate leads', 'error');
            addLeads([]);
            return;
          }
          lastGenerateBannerSource = source;
          addLeads(data, function (normalized, newCount, duplicateCount) {
            if (global.logActivity) global.logActivity('generate_leads', { count: normalized.length, newCount: newCount, duplicateCount: duplicateCount, leads: normalized.slice(0, 50) });
            if (global.utils && global.utils.toast) {
              if (newCount === 0 && duplicateCount > 0) {
                global.utils.toast('All ' + duplicateCount + ' leads were already in your list. No new leads added.', 'info');
              } else if (duplicateCount > 0) {
                global.utils.toast('Added ' + newCount + ' new leads. ' + duplicateCount + ' were already in your list.', 'success');
              } else {
                global.utils.toast('Leads generated: ' + newCount + ' added.', 'success');
              }
            }
            updateLeadLimitDisplay();
            if (normalized.length > 0 && getSyncWebhook()) syncBatch(normalized, true);
          }, source);
        });
      })
      .catch(function () {
        if (global.utils && global.utils.toast) global.utils.toast('Failed to generate leads', 'error');
        addLeads([]);
      })
      .finally(function () {
        var loading = document.getElementById('generate-loading');
        if (loading) loading.hidden = true;
        if (btn) btn.disabled = false;
      });
    }

    fetch('/api/lead-limit', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.remaining != null && maxResults > data.remaining) {
          if (btn) btn.disabled = false;
          var loading = document.getElementById('generate-loading');
          if (loading) loading.hidden = true;
          if (global.utils && global.utils.toast) {
            global.utils.toast('You have ' + data.remaining + ' leads remaining this month. Please set Max results to ' + data.remaining + ' or less.', 'error');
          }
          return;
        }
        doGenerate();
      })
      .catch(function () {
        doGenerate();
      });
  }

  function getSelectedLeadsForExport() {
    applySearch();
    var list = filteredLeads.length ? filteredLeads : allLeads;
    var selected = list.filter(function (l) { return selectedLeadIds[l.id || l.email || '']; });
    return selected.length ? selected : list;
  }

  function exportCSV() {
    var list = getSelectedLeadsForExport();
    var cols = ['companyName', 'companyDomain', 'contactName', 'jobTitle', 'industry', 'leadSource', 'email', 'phone', 'linkedin', 'country', 'status'];
    var csv = global.utils && global.utils.toCSV ? global.utils.toCSV(list, cols) : '';
    if (!csv) {
      if (global.utils && global.utils.toast) global.utils.toast('No leads to export', 'info');
      return;
    }
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    if (global.utils && global.utils.downloadBlob) {
      global.utils.downloadBlob(blob, 'leads-' + new Date().toISOString().slice(0, 10) + '.csv');
    }
    var leadSnap = list.slice(0, 50);
    if (global.logActivity) global.logActivity('export_csv', { count: list.length, leads: leadSnap });
    addToExportTotal(list.length);
    if (global.utils && global.utils.toast) global.utils.toast('CSV exported', 'success');
  }

  function getSelectedLeadsVisible() {
    applySearch();
    var list = filteredLeads.length ? filteredLeads : allLeads;
    var selected = list.filter(function (l) { return selectedLeadIds[l.id || l.email || '']; });
    return selected.length ? selected : list;
  }

  function syncAllVisible() {
    var toSync = getSelectedLeadsVisible();
    if (toSync.length === 0) {
      if (global.utils && global.utils.toast) global.utils.toast('No leads to sync', 'info');
      return Promise.resolve();
    }
    return syncBatch(toSync, false);
  }

  function updateLeadLimitDisplay() {
    var el = document.getElementById('lead-limit-display');
    if (!el) return;
    fetch('/api/lead-limit', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return;
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        var used = data.used != null ? data.used : 0;
        if (data.limit == null || data.limit === '') {
          el.textContent = 'Leads this month: ' + used + ' (unlimited)';
        } else {
          var remaining = data.remaining != null ? data.remaining : Math.max(0, data.limit - used);
          el.textContent = 'Leads this month: ' + used + ' / ' + data.limit + ' (' + remaining + ' remaining)';
        }
      })
      .catch(function () {
        el.textContent = '';
      });
  }

  function initSenioritySearchable() {
    var input = document.getElementById('filter-seniority');
    var listEl = document.getElementById('seniority-dropdown-list');
    var wrap = document.getElementById('seniority-dropdown-wrap');
    if (!input || !listEl) return;
    function showList(filter) {
      var q = (filter || '').toLowerCase().trim();
      var options = SENIORITY_OPTIONS.filter(function (label) {
        return !q || label.toLowerCase().indexOf(q) !== -1;
      });
      listEl.innerHTML = options.slice(0, 50).map(function (label, i) {
        return '<li role="option" tabindex="-1" data-value="' + escapeHtml(label) + '"' + (i === 0 ? ' aria-selected="true"' : '') + '>' + escapeHtml(label) + '</li>';
      }).join('');
      listEl.hidden = options.length === 0;
    }
    function selectValue(val) {
      if (input) input.value = val === 'Any' ? '' : val;
      listEl.hidden = true;
      input.focus();
    }
    input.addEventListener('focus', function () { showList(input.value); });
    input.addEventListener('input', function () { showList(input.value); });
    input.addEventListener('keydown', function (e) {
      var opts = listEl.querySelectorAll('li');
      var cur = listEl.querySelector('[aria-selected="true"]');
      if (e.key === 'Escape') { listEl.hidden = true; return; }
      if (e.key === 'Enter' && cur) { e.preventDefault(); selectValue(cur.getAttribute('data-value')); return; }
      if (e.key === 'ArrowDown' && opts.length) {
        e.preventDefault();
        var next = cur ? cur.nextElementSibling : opts[0];
        if (next) { if (cur) cur.removeAttribute('aria-selected'); next.setAttribute('aria-selected', 'true'); next.scrollIntoView({ block: 'nearest' }); }
        return;
      }
      if (e.key === 'ArrowUp' && opts.length) {
        e.preventDefault();
        var prev = cur ? cur.previousElementSibling : opts[opts.length - 1];
        if (prev) { if (cur) cur.removeAttribute('aria-selected'); prev.setAttribute('aria-selected', 'true'); prev.scrollIntoView({ block: 'nearest' }); }
        return;
      }
    });
    listEl.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-value]');
      if (li) selectValue(li.getAttribute('data-value'));
    });
    document.addEventListener('click', function (e) {
      if (wrap && !wrap.contains(e.target)) listEl.hidden = true;
    });
  }

  function initIndustrySearchable() {
    var input = document.getElementById('filter-industry');
    var listEl = document.getElementById('industry-dropdown-list');
    var wrap = document.getElementById('industry-dropdown-wrap');
    if (!input || !listEl) return;
    function showList(filter) {
      var q = (filter || '').toLowerCase().trim();
      var options = INDUSTRY_OPTIONS.filter(function (label) {
        return !q || label.toLowerCase().indexOf(q) !== -1;
      });
      listEl.innerHTML = options.slice(0, 50).map(function (label, i) {
        return '<li role="option" tabindex="-1" data-value="' + escapeHtml(label) + '"' + (i === 0 ? ' aria-selected="true"' : '') + '>' + escapeHtml(label) + '</li>';
      }).join('');
      listEl.hidden = options.length === 0;
      if (options.length > 0 && listEl.querySelector('[aria-selected="true"]')) {
        listEl.querySelector('[aria-selected="true"]').focus;
      }
    }
    function selectValue(val) {
      if (input) input.value = val === 'Any' ? '' : val;
      listEl.hidden = true;
      input.focus();
    }
    input.addEventListener('focus', function () { showList(input.value); });
    input.addEventListener('input', function () { showList(input.value); });
    input.addEventListener('keydown', function (e) {
      var opts = listEl.querySelectorAll('li');
      var cur = listEl.querySelector('[aria-selected="true"]');
      if (e.key === 'Escape') { listEl.hidden = true; return; }
      if (e.key === 'Enter' && cur) { e.preventDefault(); selectValue(cur.getAttribute('data-value')); return; }
      if (e.key === 'ArrowDown' && opts.length) {
        e.preventDefault();
        var next = cur ? cur.nextElementSibling : opts[0];
        if (next) { if (cur) cur.removeAttribute('aria-selected'); next.setAttribute('aria-selected', 'true'); next.scrollIntoView({ block: 'nearest' }); }
        return;
      }
      if (e.key === 'ArrowUp' && opts.length) {
        e.preventDefault();
        var prev = cur ? cur.previousElementSibling : opts[opts.length - 1];
        if (prev) { if (cur) cur.removeAttribute('aria-selected'); prev.setAttribute('aria-selected', 'true'); prev.scrollIntoView({ block: 'nearest' }); }
        return;
      }
    });
    listEl.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-value]');
      if (li) selectValue(li.getAttribute('data-value'));
    });
    document.addEventListener('click', function (e) {
      if (wrap && !wrap.contains(e.target)) listEl.hidden = true;
    });
  }

  function initRegionByCountry() {
    var countrySelect = document.getElementById('filter-country');
    var regionSelect = document.getElementById('filter-city');
    if (!countrySelect || !regionSelect) return;
    function updateRegionOptions() {
      var country = countrySelect.value || '';
      var regions = REGIONS_BY_COUNTRY[country];
      if (!regions || !regions.length) {
        regionSelect.innerHTML = '<option value="">Any region</option>';
        return;
      }
      var opts = ['Any'].concat(regions);
      regionSelect.innerHTML = opts.map(function (c) {
        return '<option value="' + (c === 'Any' ? '' : escapeHtml(c)) + '">' + escapeHtml(c) + '</option>';
      }).join('');
    }
    countrySelect.addEventListener('change', updateRegionOptions);
    global._refreshLinkedinRegionOptions = updateRegionOptions;
    updateRegionOptions();
  }

  function init() {
    var btnGenerate = document.getElementById('btn-generate-leads');
    if (btnGenerate) btnGenerate.addEventListener('click', generateLeads);

    document.querySelectorAll('#page-generate .generate-source-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var src = btn.getAttribute('data-generate-source');
        if (src !== 'linkedin' && src !== 'google') return;
        generateLeadSource = src;
        syncGenerateSourceUI();
      });
    });
    syncGenerateSourceUI();

    updateLeadLimitDisplay();
    applyLinkedinFilterData(buildFallbackLinkedinPayload());
    loadLinkedinFilterOptions().then(function () {
      initIndustrySearchable();
      initSenioritySearchable();
      initRegionByCountry();
    });

    document.querySelectorAll('.leads-source-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        leadSourceTab = btn.getAttribute('data-source') || 'all';
        document.querySelectorAll('.leads-source-tab').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        currentPage = 1;
        renderLeadsTable();
      });
    });

    var searchEl = document.getElementById('leads-search');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        currentPage = 1;
        renderLeadsTable();
      });
    }
    var dateEl = document.getElementById('leads-date');
    if (dateEl) {
      dateEl.addEventListener('change', function () {
        currentPage = 1;
        renderLeadsTable();
      });
    }

    var btnExport = document.getElementById('btn-export-csv');
    if (btnExport) btnExport.addEventListener('click', exportCSV);

    var btnGenerateExport = document.getElementById('btn-generate-export-csv');
    if (btnGenerateExport) btnGenerateExport.addEventListener('click', exportCSVFromGenerate);
    var btnNextStepExport = document.getElementById('btn-next-step-export-csv');
    if (btnNextStepExport) btnNextStepExport.addEventListener('click', exportCSVFromGenerate);

    currentPage = 1;
    renderLeadsTable();
    loadFromServer();
  }

  function getLastGeneratedLeads() {
    return lastGeneratedLeads.slice();
  }

  global.leads = {
    init: init,
    addLeads: addLeads,
    loadFromServer: loadFromServer,
    getAll: getAll,
    getLastGeneratedLeads: getLastGeneratedLeads,
    renderLeadsTable: renderLeadsTable,
    openLeadModal: openLeadModal,
    closeLeadModal: closeLeadModal,
    syncLead: syncLead,
    exportCSV: exportCSV,
    updateLeadLimitDisplay: updateLeadLimitDisplay
  };

  global.leadsStore = {
    getAll: getAll
  };
})(typeof window !== 'undefined' ? window : this);
