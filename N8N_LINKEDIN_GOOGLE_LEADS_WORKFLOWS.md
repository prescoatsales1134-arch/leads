# n8n workflows: LinkedIn (Peakydev) + Google leads

This repo’s app calls **`POST /api/generate-leads`**, which proxies to n8n with a JSON body (filters). The server **does not** send the field `source` to n8n (it is stripped). You use **two workflows** and two env vars on the app server:

| Env var | Workflow |
|--------|----------|
| `N8N_GENERATE_LEADS_WEBHOOK` | LinkedIn (Peakydev actor) |
| `N8N_GENERATE_GOOGLE_LEADS_WEBHOOK` | Google / Maps-style actor |

Each workflow must end with **Respond to Webhook** returning JSON the dashboard understands:

- Either a **raw array** of lead objects, or  
- **`{ "leads": [ ... ] }`**

Each lead should match the shape your app saves (see **Normalized lead object** below). Optional: set **`lead_source`** / **`leadSource`** per row (`linkedin` or `google`) so the Leads tab filter works; if omitted, the app defaults new LinkedIn runs to `linkedin` when saving from Generate.

---

## Run the app locally

1. Install **Node.js** (v18+ recommended).
2. From the project root:
   ```bash
   npm install
   cp .env.example .env
   ```
3. Edit **`.env`**. Required for login and the dashboard API:
   - **`SUPABASE_URL`**, **`SUPABASE_ANON_KEY`**, **`SUPABASE_SERVICE_ROLE_KEY`**
   - After n8n workflows exist: **`N8N_GENERATE_LEADS_WEBHOOK`** (Apollo) and **`N8N_GENERATE_GOOGLE_LEADS_WEBHOOK`** (Google)
4. Full variable list and Supabase + Google OAuth setup: **[BUILD.md](./BUILD.md)**, **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**, **[GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)**.
5. Start the server:
   ```bash
   npm start
   ```
6. Open **http://localhost:3000** (or **`http://localhost:PORT`** if you set **`PORT`** in `.env`). Sign in, then open **Generate** and choose **Apollo.io** or **Google Maps**.

The Express server reads **`.env`** directly for generate webhooks. You **do not** need **`npm run config`** for lead generation—that script only rebuilds optional **`config.js`** for a subset of client keys; **`POST /api/generate-leads`** uses **`process.env`** on the server.

---

## Complete n8n build guide (both workflows)

### What goes where (repo files → n8n nodes)

| Repo file | n8n node | Workflow |
|-----------|----------|----------|
| **`n8n-peakydev-linkedin-transform.js`** | Code (Transform), after Webhook | Apollo / LinkedIn |
| **`n8n-peakydev-linkedin-normalize.js`** | Code (Normalize), after HTTP Request | Apollo / LinkedIn |
| **`n8n-google-leads-transform.js`** | Code (Transform), after Webhook | Google Maps |
| **`n8n-google-leads-normalize.js`** | Code (Normalize), after HTTP Request | Google Maps |

Paste each file’s **full contents** into the matching **Code** node (JavaScript). In Code node settings, use **“Run Once for All Items”** where available.

### Apify token in n8n

1. Apify: **Settings → Integrations → API token**.
2. n8n: **Variables / environment** (e.g. **Settings → Variables**) add **`APIFY_TOKEN`**.
3. Do not commit tokens inside exported workflow JSON.

---

### Workflow A — Apollo.io (Peakydev LinkedIn)

**Node chain:** `Webhook` → `Code (transform)` → `HTTP Request (Apify)` → `Code (normalize)` → `Respond to Webhook`

1. **Webhook**
   - **HTTP Method:** POST  
   - **Path:** e.g. `generate-leads-peakydev`  
   - **Response:** use **“Respond to Webhook”** (wait for the last node; wording varies by n8n version).  
   - **Activate** the workflow and copy the **Production URL** into **`.env`** as **`N8N_GENERATE_LEADS_WEBHOOK`**.

2. **Code — Transform dashboard → Apify body**  
   - Copy **`n8n-peakydev-linkedin-transform.js`** from this repo into the node.  
   - Input is the JSON body your app posts (see **What the app sends** → Apollo). The node outputs **`{ body: { ... } }`** for the next step.

3. **HTTP Request**
   - **Method:** POST  
   - **URL (expression):**  
     `={{ 'https://api.apify.com/v2/acts/peakydev~leads-scraper-ppe/run-sync-get-dataset-items?token=' + $env.APIFY_TOKEN }}`  
   - Change **`peakydev~leads-scraper-ppe`** if you use another actor.  
   - **Body:** JSON — use the transform output’s **`body`** field:
     - If the node lets you set a JSON object from expression: **`={{ $json.body }}`**
     - If it only accepts a string: raw JSON **`={{ JSON.stringify($json.body) }}`**

4. **Code — Normalize**  
   - Copy **`n8n-peakydev-linkedin-normalize.js`**.  
   - Maps Apify dataset items to **`{ leads: [ ... ] }`**. Adjust field names if your run output differs (inspect one **Execution** in n8n).

5. **Respond to Webhook**
   - **Response body (JSON):** **`={{ $json }}`**  
   - So the HTTP response is **`{ "leads": [ ... ] }`**, which the app already understands.

**Quick test (curl)** — replace the webhook URL:

```bash
curl -s -X POST "https://YOUR-N8N-HOST/webhook/generate-leads-peakydev" \
  -H "Content-Type: application/json" \
  -d '{"industry":"Real Estate","country":"United States","personState":"","city":"","maxResults":100,"companySize":"11 - 50","keywords":"","jobTitle":"","seniority":"CEO","emailAvailable":true,"phoneAvailable":false}'
```

---

### Workflow B — Google Maps

**Same node pattern** as A, but a **different** Webhook path and URL in **`.env`** as **`N8N_GENERATE_GOOGLE_LEADS_WEBHOOK`**.

1. **Webhook** — POST, path e.g. `generate-google-leads`. Production URL → **`N8N_GENERATE_GOOGLE_LEADS_WEBHOOK`**.

2. **Code (transform)** — copy **`n8n-google-leads-transform.js`**. Builds the Google actor JSON (see **What the app sends** → Google Apify example).

3. **HTTP Request** — POST to **your** actor’s **run-sync-get-dataset-items** URL from the Apify actor **API** tab (not necessarily the same as Peakydev). Example pattern:  
   `={{ 'https://api.apify.com/v2/acts/OWNER~ACTOR_NAME/run-sync-get-dataset-items?token=' + $env.APIFY_TOKEN }}`  
   Body: **`={{ $json.body }}`** (or stringified as above).

4. **Code (normalize)** — copy **`n8n-google-leads-normalize.js`**. After a real run, update the **`pick(row, [...])`** key lists to match your actor’s fields.

5. **Respond to Webhook** — **`={{ $json }}`**.

**Quick test (curl):**

```bash
curl -s -X POST "https://YOUR-N8N-HOST/webhook/generate-google-leads" \
  -H "Content-Type: application/json" \
  -d '{"industry":"Real Estate","country":"USA","city":"New York","maxResults":50,"emailAvailable":true,"phoneAvailable":false}'
```

---

### Wire the dashboard

1. Set both webhook URLs in **`.env`**, restart **`npm start`**.  
2. **Generate** → **Apollo.io** → server uses **`N8N_GENERATE_LEADS_WEBHOOK`**.  
3. **Generate** → **Google Maps** → server uses **`N8N_GENERATE_GOOGLE_LEADS_WEBHOOK`**.  
4. The app always sends **`source`** in the browser request; the **server removes `source`** before calling n8n, so each workflow only sees the filter fields.

### Troubleshooting

| Symptom | What to check |
|--------|----------------|
| App **503** on Generate | Missing or invalid webhook URL in **`.env`** for that mode. |
| App **502** | n8n error or non-JSON response; open n8n **Executions**. |
| Empty table / no leads | Normalize Code doesn’t match actor output keys; inspect HTTP node output and edit **`n8n-*-normalize.js`**. |
| Apify **401/403** | **`APIFY_TOKEN`** wrong or missing in n8n. |

---

## Security (read this first)

1. **Never commit Apify tokens** in workflow JSON or Git. If `Leads Scraper.json` was ever committed with a token in the URL, **rotate the token** in the [Apify console](https://console.apify.com/account/integrations).
2. In n8n, prefer **`APIFY_TOKEN`** (or similar) as an **environment variable** and build the request URL with an expression (see below).
3. Restrict your n8n webhooks (IP allowlist, basic auth, or secret header) if the instance is on the public internet.

---

## Dashboard LinkedIn (Peakydev) filter data

Logged-in users can call **`GET /api/linkedin-filter-options`**, which returns:

- `industries` — from `data/peakydev-industries-raw.txt` (448 strings, Peakydev enum)
- `countries` — from `data/peakydev-countries-raw.txt`
- `regionsByCountry` — from `data/peakydev-regions-by-country.json` (maps to actor **`personState`**; refine labels against [Apify input schema](https://apify.com/peakydev/leads-scraper-ppe/input-schema) if a region errors)
- `seniority` — exact actor enum
- `companySizes` — `{ value, label }[]` with Peakydev **`companyEmployeeSize`** strings (`0 - 1`, `2 - 10`, …)

Regenerate industries after Apify updates: save the actor’s input-schema HTML and run **`node scripts/extract-industries-from-apify-html.mjs <file.html>`**.

The Generate form uses **Keywords** for a specific **city / metro** (e.g. Los Angeles); **State / province / region** maps to **`personState`**.

---

## What the app sends

The Generate tab has **Apollo.io** vs **Google Maps**. The browser always sends **`source`**: **`"linkedin"`** (Apollo) or **`"google"`**. The app server **strips `source`** before POSTing to n8n.

### Apollo.io (LinkedIn / Peakydev) — `source: "linkedin"`

Full filter form; **comma-separated** text in Industry / Country / Seniority becomes multiple values in the n8n transform.

```json
{
  "industry": "Real Estate, Agricultural Chemical Manufacturing",
  "country": "Barbados, Argentina",
  "personState": "California",
  "city": "California",
  "maxResults": 100,
  "companySize": "11 - 50",
  "keywords": "Los Angeles",
  "jobTitle": "Marketing Manager",
  "seniority": "CEO, Founder",
  "emailAvailable": true,
  "phoneAvailable": true
}
```

**Apify body** produced by **`n8n-peakydev-linkedin-transform.js`** (HTTP POST JSON should match this shape):

```json
{
  "companyEmployeeSize": ["11 - 50"],
  "contactEmailStatus": "verified",
  "includeEmails": true,
  "industry": ["Real Estate", "Agricultural Chemical Manufacturing"],
  "personCountry": ["Barbados", "Argentina"],
  "seniority": ["CEO", "Founder"],
  "totalResults": 100
}
```

When **`emailAvailable`** is false, omit **`contactEmailStatus`** in the transform (or set per your actor). **`companyEmployeeSize`** is `[]` if the user picks “Any company size”. **`totalResults`** is clamped to the actor minimum (e.g. 100) and a safe maximum.

The template does **not** send **`personState`**, **`industryKeywords`**, or **`personTitle`** in this contract; extend the Code node if your actor still needs them.

### Google Maps — `source: "google"`

Slim payload (City is free text; Industry supports comma-separated search strings):

```json
{
  "industry": "Real Estate",
  "country": "USA",
  "city": "New York",
  "maxResults": 50,
  "emailAvailable": true,
  "phoneAvailable": false
}
```

**Apify body** from **`n8n-google-leads-transform.js`**:

```json
{
  "includeWebResults": false,
  "language": "en",
  "locationQuery": "New York, USA",
  "maxCrawledPlacesPerSearch": 50,
  "maximumLeadsEnrichmentRecords": 0,
  "scrapeContacts": true,
  "scrapeDirectories": false,
  "scrapePlaceDetailPage": false,
  "scrapeSocialMediaProfiles": {
    "facebooks": true,
    "instagrams": true,
    "tiktoks": true,
    "twitters": true,
    "youtubes": true
  },
  "scrapeTableReservationProvider": false,
  "searchStringsArray": ["Real Estate"],
  "skipClosedPlaces": false
}
```

In n8n, the Webhook node usually exposes this as **`$json.body`** (sometimes the whole payload is under `body`). The template Code nodes use:

```js
const raw = $input.first().json;
const body = raw.body || raw;
```

**Note:** `phoneAvailable` is sent for UI parity; map it in the Google Code node only if your actor supports it.

**HTTP Request body:** use **`$json.body`** (or `{{ JSON.stringify($json.body) }}` depending on n8n version) so the Apify POST body is exactly the object above.

---

## Normalized lead object (what n8n should return)

The dashboard accepts Apify-style or normalized fields. Easiest is to return **normalized** objects:

| Field | Type | Notes |
|-------|------|--------|
| `companyName` | string | |
| `contactName` | string | |
| `jobTitle` | string | |
| `industry` | string | |
| `email` | string | |
| `phone` | string | |
| `linkedin` | string | URL |
| `country` | string | |
| `companyDomain` | string | host only, lowercase |
| `id` | string | optional; stable id helps dedupe |
| `lead_source` or `leadSource` | string | optional: `linkedin` / `google` |

---

## Part A — LinkedIn workflow (replace your current “Leads Scraper”)

Your uploaded workflow **`Leads Scraper.json`** currently:

1. Maps filters → **x_guru** actor input (`employee_size`, `include_phones`, etc.).
2. Calls **`x_guru~leads-scraper-apollo-zoominfo`** via HTTP Request.
3. Normalizes items → `{ leads: [...] }`.

### A1. Apify endpoint (Peakydev)

Use the **run sync + dataset items** endpoint for actor **`peakydev/leads-scraper-ppe`**:

```http
POST https://api.apify.com/v2/acts/peakydev~leads-scraper-ppe/run-sync-get-dataset-items?token=YOUR_APIFY_TOKEN
```

In n8n **HTTP Request**:

- **Method:** POST  
- **URL (expression):**  
  `={{ 'https://api.apify.com/v2/acts/peakydev~leads-scraper-ppe/run-sync-get-dataset-items?token=' + $env.APIFY_TOKEN }}`  
  (Define `APIFY_TOKEN` under **Settings → Variables** or your n8n host env.)
- **Body:** JSON — use the output of the transform Code node (see **`n8n-peakydev-linkedin-transform.js`**).

### A2. Replace the “dashboard → Apify” Code node

- Remove x_guru-specific fields: `employee_size`, `include_emails`, `include_phones`, `person_location_country`, `person_location_locality`, etc.
- Copy the logic from **`n8n-peakydev-linkedin-transform.js`** in this repo.

Important details:

- **`totalResults`:** Peakydev’s input uses this name. Map from **`maxResults`**. The actor schema may enforce a **minimum (e.g. 100)**—the transform file clamps to a safe minimum; align with [Apify input schema](https://apify.com/peakydev/leads-scraper-ppe/input-schema).
- **`companySize` → `companyEmployeeSize`:** Dashboard options use Peakydev’s **exact** enum strings (e.g. **`"11 - 50"`** with spaces). The transform wraps the selected value in a one-element array, or `[]` for “Any company size”.
- **`includeEmails`:** Map from **`emailAvailable`** (not `include_emails`).
- **Do not** send `include_phones` to Peakydev for parity with the old actor.
- **`seniority`:** Optional array; allowed values include:  
  `Founder`, `Chairman`, `President`, `CEO`, `CXO`, `Vice President`, `Director`, `Head`, `Manager`, `Senior`, `Junior`, `Entry Level`, `Executive` (exact spelling/casing).
- **`companyEmployeeSize`:** Allowed values include:  
  `0 - 1`, `2 - 10`, `11 - 50`, `51 - 200`, `201 - 500`, `501 - 1000`, `1001 - 5000`, `5001 - 10000`, `10000+`.

**City / location:** The published Peakydev schema centers on **`personCountry`** (array) and **`personState`** (array with many region enums). There is no generic “city” string in the same way as the old flow. Practical options:

- Map **US city** to **`personState`** only when your dropdown values match actor **state** enums (limited).
- Or merge **`city`** into **`industryKeywords`** / titles as a workaround.
- Re-check **Input** on the actor page if a `personCity` (or similar) field was added after this doc.

### A3. Replace the “Apify → dashboard” Code node

- Copy **`n8n-peakydev-linkedin-normalize.js`**.
- It **drops junk rows** (e.g. placeholder names like “Refer to the log…”).
- Adjust field names if your dataset items use different keys (inspect one run in n8n).

### A4. Webhook path and app env

- Keep a dedicated webhook path (e.g. `generate_leads`).
- Put the **production** webhook URL into **`N8N_GENERATE_LEADS_WEBHOOK`** in the app `.env` and restart the server.

### A5. Optional: `lead_source` on each lead

In the normalize Code node, you can set `lead_source: 'linkedin'` on every item so the Leads tab always shows the correct badge (the app also defaults LinkedIn generate saves).

---

## Part B — Google workflow (new)

Build a **second** workflow; do **not** reuse the LinkedIn webhook URL.

### B1. Steps in n8n

1. **Webhook** (POST)  
   - Path e.g. `generate_google_leads`  
   - **Response:** via **Respond to Webhook** node.

2. **Code — Transform**  
   - Input: Google mode fields only — **`industry`**, **`country`**, **`city`**, **`maxResults`**, **`emailAvailable`**, **`phoneAvailable`**.  
   - Output: JSON body for your **Google / Maps** Apify actor (see **`n8n-google-leads-transform.js`** and the example JSON in **What the app sends** above). Adjust static flags in the Code node if your actor differs.

3. **HTTP Request — Apify**  
   - Same pattern as LinkedIn:  
     `https://api.apify.com/v2/acts/<ACTOR_ID_OR_USERNAME~NAME>/run-sync-get-dataset-items?token=` + `$env.APIFY_TOKEN`  
   - **Body:** output of step 2.

4. **Code — Normalize**  
   - Map dataset items → normalized leads (see table above).  
   - Set **`lead_source: 'google'`** (or `leadSource`) on each item.  
   - Template: **`n8n-google-leads-normalize.js`** (adjust field paths after one test run).

5. **Respond to Webhook**  
   - **JSON** body: `{ "leads": $json.leads }` or whatever your normalize node outputs.

### B2. App env

Set **`N8N_GENERATE_GOOGLE_LEADS_WEBHOOK`** to this workflow’s **production** URL.

When the dashboard sends **`source: "google"`**, the app server routes to that URL and **strips `source`** before calling n8n—so your Google workflow still receives the normal filter JSON.

### B3. Actor ID note

If you use a numeric-style actor id (e.g. from an old note), confirm the correct **`username~actor-name`** or id from the Apify actor’s **API** tab. Wrong ids return 404 from Apify.

---

## Testing checklist

| Step | LinkedIn | Google |
|------|----------|--------|
| Webhook returns 200 | ✓ | ✓ |
| Body parses as JSON array or `{ leads }` | ✓ | ✓ |
| No Apify token in URL committed to Git | ✓ | ✓ |
| `maxResults` / actor limit vs app monthly limit | ✓ | ✓ |
| HubSpot sync | Same webhook; optional `leadSource` on each lead | Same |

---

## Files in this repo

| File | Purpose |
|------|---------|
| `n8n-peakydev-linkedin-transform.js` | Webhook body → Peakydev actor JSON |
| `n8n-peakydev-linkedin-normalize.js` | Actor items → `{ leads: [...] }` |
| `n8n-google-leads-transform.js` | Webhook body → Google actor JSON (template) |
| `n8n-google-leads-normalize.js` | Google actor items → `{ leads: [...] }` (template) |
| `Leads Scraper.json` | Example exported workflow (update nodes to match the above) |
| `n8n-generate-leads-transform.js` | Older x_guru-oriented reference only |

---

## Reference: Peakydev `companyEmployeeSize` and `seniority` (exact strings)

**`companyEmployeeSize`** (each entry must match exactly):

- `0 - 1`
- `2 - 10`
- `11 - 50`
- `51 - 200`
- `201 - 500`
- `501 - 1000`
- `1001 - 5000`
- `5001 - 10000`
- `10000+`

**`seniority`** (each entry must match exactly):

- `Founder`
- `Chairman`
- `President`
- `CEO`
- `CXO`
- `Vice President`
- `Director`
- `Head`
- `Manager`
- `Senior`
- `Junior`
- `Entry Level`
- `Executive`

For the full list of industries, countries, and regions, use the actor’s **Input** tab on Apify; align dashboard dropdowns to those strings when you want zero mapping errors.
