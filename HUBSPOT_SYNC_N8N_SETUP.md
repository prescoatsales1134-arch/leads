# HubSpot Sync – n8n build guide

This guide builds an n8n workflow that receives leads from the dashboard and creates **Companies** and **Contacts** in HubSpot and links them. Company lookup is done via **HTTP Request** (search by **domain** to avoid duplicates); create and the rest use **HubSpot** nodes.

---

## Avoiding duplicate companies

**Use company domain, not name.** If you search by company **name**, the same company can be created multiple times (e.g. "First Steps Financial" twice). The dashboard sends **`companyDomain`** (e.g. `firststepsfinancial.com`). In n8n:

1. **HTTP Request** – Search HubSpot companies by **`domain`** = `{{ $json.companyDomain }}` (HubSpot Search API).
2. **IF** results exist → use that company’s ID (no create).
3. **IF** no results → **HTTP Request: Create Company** (POST to HubSpot API with **`name`** and **`domain`** in the body so the next sync finds it by domain).
4. Then create Contact and Associate to Company.

That way one domain = one company in HubSpot. If `companyDomain` is empty for a lead, you can fall back to search by name (see 4.3 fallback) or create and accept possible duplicates for that lead.

---

## 1. What the dashboard sends

- **Webhook URL:** Set in `.env` as `N8N_SYNC_HUBSPOT_WEBHOOK` (e.g. `https://your-n8n.com/webhook/sync-hubspot`).
- The app sends **one POST** with a `leads` array (e.g. after Generate Leads or manual sync).

**Request body:** `{ "leads": [ { "id", "companyName", "companyDomain", "contactName", "jobTitle", "industry", "email", "phone", "country", "status", "createdAt" }, ... ] }`  
Each lead includes **`companyDomain`** (e.g. `acme.com`) for deduplication. Use this in the workflow to **search by domain** and only create a company when no match exists.

**Response:** Return **200** so the app marks sync as successful. Optionally `{ "success": true, "synced": 5 }`. Non-2xx = "Sync failed" in the app.

---

## 2. Workflow outline

1. **Webhook** – POST, body = `{ leads: [...] }`. Respond when last node finishes.
2. **Code (Normalize + Split name)** – One item per lead; add `firstname` / `lastname` from `contactName`; keep **`companyDomain`** (lowercase).
3. **HTTP Request** – Search companies by **domain**. Body: HubSpot Search API with filter `domain` = `{{ $json.companyDomain || '' }}`.
4. **IF** – results length > 0? **True:** use first result’s `id` as `companyId` (Set/Merge with lead). **False:** go to HubSpot Create Company.
5. **HTTP Request – Create Company** (only when not found) – POST to HubSpot with **name** and **domain** (and optional industry). Output company `id`. Merge so item has `companyId`.
6. **HubSpot – Contact Create** (or upsert) – email, firstname, lastname, jobtitle, phone, country from lead.
7. **HubSpot – Associate** – Contact to Company (contact id + company id from same item).
8. **Respond to Webhook** – 200, body `{ "success": true }`.

Steps 3–7 run **once per lead**.

---

## 3. Prerequisites

- **HubSpot:** Settings → Integrations → Private Apps → Create app. Scopes: `crm.objects.contacts.read/write`, `crm.objects.companies.read/write`. Copy **Access token**.
- **n8n:** Credentials → HubSpot API → paste Access token. Use this credential in all HubSpot nodes.

---

## 4. Node-by-node

### 4.1 Webhook

- **Method:** POST. **Path:** e.g. `sync-hubspot`.
- **Respond:** When last node finishes.
- Copy Production URL into `.env` as `N8N_SYNC_HUBSPOT_WEBHOOK`.

---

### 4.2 Code: Normalize + Split name (and keep `companyDomain`)

**Mode:** Run Once for All Items.

```javascript
function titleCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\w\S*/g, function(txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}
// Map dashboard industry labels to HubSpot company industry enum (exact values required by API).
var industryToHubSpot = {
  'Accounting': 'ACCOUNTING',
  'Banking': 'BANKING',
  'Biotechnology': 'BIOTECHNOLOGY',
  'Computer Software': 'COMPUTER_SOFTWARE',
  'Construction': 'CONSTRUCTION',
  'Design Services': 'DESIGN',
  'E-Learning': 'E_LEARNING',
  'Events Services': 'EVENTS_SERVICES',
  'Financial Services': 'FINANCIAL_SERVICES',
  'Food & Beverages': 'FOOD_BEVERAGES',
  'Health, Wellness & Fitness': 'HEALTH_WELLNESS_AND_FITNESS',
  'Higher Education': 'HIGHER_EDUCATION',
  'Hospital & Health Care': 'HOSPITAL_HEALTH_CARE',
  'Hospitality': 'HOSPITALITY',
  'Information Technology & Services': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
  'IT Services and IT Consulting': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
  'Insurance': 'INSURANCE',
  'Legal Services': 'LEGAL_SERVICES',
  'Logistics & Supply Chain': 'LOGISTICS_AND_SUPPLY_CHAIN',
  'Management Consulting': 'MANAGEMENT_CONSULTING',
  'Marketing & Advertising': 'MARKETING_AND_ADVERTISING',
  'Pharmaceuticals': 'PHARMACEUTICALS',
  'Professional Training and Coaching': 'PROFESSIONAL_TRAINING_COACHING',
  'Public Relations and Communications Services': 'PUBLIC_RELATIONS_AND_COMMUNICATIONS',
  'Real Estate': 'REAL_ESTATE',
  'Restaurants': 'RESTAURANTS',
  'Retail': 'RETAIL',
  'Staffing and Recruiting': 'STAFFING_AND_RECRUITING',
  'Technology, Information and Internet': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
  'Telecommunications': 'TELECOMMUNICATIONS',
  'Business Consulting and Services': 'MANAGEMENT_CONSULTING'
};
function mapIndustryHubSpot(label) {
  if (!label || typeof label !== 'string') return '';
  var key = label.trim();
  return industryToHubSpot[key] || industryToHubSpot[titleCase(key)] || '';
}

const body = $input.first().json.body || $input.first().json;
const leads = Array.isArray(body.leads) ? body.leads : (body && body.email ? [body] : []);
const items = [];
for (var i = 0; i < leads.length; i++) {
  var lead = leads[i];
  var name = (lead.contactName || '').trim();
  var parts = name.split(/\s+/);
  var firstname = parts[0] || '';
  var lastname = parts.slice(1).join(' ') || '';
  var item = {};
  for (var k in lead) { if (lead.hasOwnProperty(k)) item[k] = lead[k]; }
  item.firstname = firstname;
  item.lastname = lastname;
  item.industry = titleCase(lead.industry || '');
  item.industryHubSpot = mapIndustryHubSpot(lead.industry || '');
  item.country = titleCase(lead.country || '');
  item.createdAt = lead.createdAt || new Date().toISOString();
  item.companyDomain = (lead.companyDomain || '').trim().toLowerCase();
  items.push({ json: item });
}
return items;
```

**HubSpot industry enum:** HubSpot’s **industry** property only accepts specific enum values (e.g. `HIGHER_EDUCATION`, not "Higher Education"). The code below maps the dashboard’s industry label to HubSpot’s enum and sets `industryHubSpot`; use that when creating the company and **omit** industry if there’s no match to avoid "was not one of the allowed options" errors.

Output: multiple items (one per lead). Each item has `industryHubSpot` (valid enum or empty). Next nodes use `{{ $json.companyName }}`, `{{ $json.companyDomain }}`, `{{ $json.industryHubSpot }}`, `{{ $json.email }}`, etc.

---

### 4.3 HTTP Request: Search companies **by domain** (prevents duplicates)

- **Method:** POST.
- **URL:** `https://api.hubapi.com/crm/v3/objects/companies/search`
- **Headers:** `Authorization: Bearer <YOUR_ACCESS_TOKEN>`, `Content-Type: application/json`
- **Send Body:** Yes. **Body Content Type:** JSON.
- **Body:** Use one of the options below so the payload is always valid JSON.

**Option A – JSON with expression (ensure value is always a string):**  
In the HTTP Request node, set the body to the following. Use `{{ $json.companyDomain || '' }}` so the value is never `undefined` (which would break JSON):

```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "domain",
          "operator": "EQ",
          "value": "{{ $json.companyDomain || '' }}"
        }
      ]
    }
  ],
  "limit": 10
}
```

**Option B – Expression that builds the body (if Option A still gives "valid JSON" errors):**  
Set **Body** to an expression so n8n outputs a single JSON string:

```
={{ JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: $json.companyDomain || '' }] }], limit: 10 }) }}
```

Then set **Body Content Type** to **JSON** (or Raw and add header `Content-Type: application/json`).

**Response:** `{ "total": N, "results": [ { "id": "...", "properties": { ... } }, ... ] }`

**IF company not found (False branch):** Go to **HubSpot Create Company** (4.4), then **Set** to add `companyId` from the create response and merge with the lead.

**IF company already exists (True branch):** Add a **Set** node right after the IF (on the True branch):

1. **Purpose:** Build one item that has the **lead** (for Contact) plus **companyId** (for Associate). You already have the company; you only need to pass the lead and the found company id.
2. **In Set node:**
   - **Lead fields:** Copy from the Code node so the item has `email`, `firstname`, `lastname`, `companyName`, `jobTitle`, `phone`, `country`, etc. For example, add values from `$('Code').item.json` (use your Code node name). In n8n you can “Include fields from other nodes” and select the Code node, or add each field manually (e.g. `email` = `{{ $('Code').item.json.email }}`, `firstname` = `{{ $('Code').item.json.firstname }}`, …).
   - **companyId:** Set one field `companyId` = first search result’s id. The HTTP Request output is the current item, so use `{{ $json.results[0].id }}`. (If your response is wrapped in an array, use `{{ $json[0].results[0].id }}`.)
3. **Output:** One item with lead + `companyId`. Connect this Set node to **Contact** (skip Create Company). Then Contact → Associate → Respond.

**Merge both branches:** Connect both the True-branch Set (company found) and the False-branch Set (after Create Company) into the same **Contact** node, or into a **Merge** node and then Contact. That way every lead ends up as one item with lead + `companyId` before Contact.

**When `companyDomain` is empty:** The dashboard may send an empty string for some leads. Then search by domain returns no results and the workflow will create a new company every time (causing duplicates if several leads share the same company name). **Optional fallback:** add an **IF** before this node: `{{ $json.companyDomain && $json.companyDomain.trim() !== '' }}`. **True** → HTTP Request search by domain (as above). **False** → add a second HTTP Request that searches by **name** (`propertyName: "name"`, `operator: "EQ"`, `value: "{{ $json.companyName }}"`) and use the first result if any; otherwise create company with name only. That way you still reduce duplicates when domain is missing.

**Troubleshooting:**  
- **"JSON parameter needs to be valid JSON"** – The request body must be valid JSON after n8n evaluates expressions. Use `{{ $json.companyDomain || '' }}` so the filter value is never `undefined`. If the error persists, use **Option B** (expression body) above and ensure **Body Content Type** is **JSON** and **Content-Type: application/json** is set in Headers.  
- **Companies in HubSpot but search always returns 0:** Ensure the item entering this node has `companyDomain` (from the Code node), and that HubSpot company records have the **`domain`** property set when you create them (section 4.4).

---

### 4.4 HTTP Request: Create Company (when search returns no results)

Use an **HTTP Request** node to create the company so the body is explicitly built from **domain** and **name** (no HubSpot node).

- **Method:** POST  
- **URL:** `https://api.hubapi.com/crm/v3/objects/companies`  
- **Headers:**  
  - `Authorization: Bearer <YOUR_HUBSPOT_ACCESS_TOKEN>`  
  - `Content-Type: application/json`  
- **Body Content Type:** JSON.  
- **Body:** Create the company with **domain** and **name** from the lead (and optional industry):

**Important:** Use **`industryHubSpot`** from the Code node (the enum value like `HIGHER_EDUCATION`). Do **not** send the display label (e.g. "Higher Education") or HubSpot will return "was not one of the allowed options". Only include `industry` in the body when `industryHubSpot` is non-empty.

**Option A – JSON body with expressions (omit industry when empty):**

If your HTTP node supports conditional body, set **properties** to:
- `name` → `{{ $('Code').item.json.companyName }}`
- `domain` → `{{ $('Code').item.json.companyDomain || '' }}`
- `industry` → only add when `{{ $('Code').item.json.industryHubSpot }}` is not empty (or leave out industry to avoid errors).

**Option B – Expression (recommended):** Build the body so `industry` is only included when we have a valid enum. Replace `Code` with your Code node name if different:

```
={{ JSON.stringify({ properties: Object.assign({ name: $('Code').item.json.companyName || 'Unknown', domain: $('Code').item.json.companyDomain || '' }, $('Code').item.json.industryHubSpot ? { industry: $('Code').item.json.industryHubSpot } : {}) }) }}
```

**Option C – Simpler (no industry):** If you prefer to never send industry when creating the company (avoids errors; you can set it later in HubSpot):

```
={{ JSON.stringify({ properties: { name: $('Code').item.json.companyName || 'Unknown', domain: $('Code').item.json.companyDomain || '' } }) }}
```

**Response:** HubSpot returns `{ "id": "12345678", "properties": { ... }, ... }`. The company id is **`id`** (top level).

- **Next step:** Use a **Set** node to take the **lead** from your Code node and add **companyId** = `{{ $json.id }}` (from this HTTP Request response). Then pass the item to Contact and Associate.

---

### 4.5 HubSpot: Contact

- **Resource:** Contact. **Operation:** Create (or Upsert if available).
- **Credentials:** Your HubSpot credential.
- **Properties:** map from the current item (lead + companyId):

| HubSpot property | Map from |
|------------------|----------|
| `email`          | `{{ $json.email }}` |
| `firstname`      | `{{ $json.firstname }}` |
| `lastname`       | `{{ $json.lastname }}` |
| `jobtitle`       | `{{ $json.jobTitle }}` |
| `phone`          | `{{ $json.phone }}` |
| `country`        | `{{ $json.country }}` |

**Contact output:** HubSpot returns the full contact object. The **contact id** you need for Associate is:
- **`vid`** (e.g. `206102263355`), or
- **`properties.hs_object_id.value`** (same number as string).

In n8n use `{{ $json.vid }}` or `{{ $json.properties.hs_object_id.value }}` (or `{{ $json.id }}` if the node returns a simpler shape). Use this as **Contact ID** in the Associate node; **Company ID** is `{{ $json.companyId }}` from the item that had lead + companyId (if Contact replaced `$json`, reference companyId from the node before Contact, e.g. `$('Set').item.json.companyId`).

---

### 4.6 Associate Contact to Company

**Option: HTTP Request** (use this if the HubSpot node has no Association resource)

- **Method:** PUT
- **URL:** `https://api.hubapi.com/crm/v4/objects/contacts/{{ $json.vid }}/associations/companies/{{ $('Set').item.json.companyId }}`  
  (Replace `Set` with your node name that has companyId; contact id from Contact node is `$json.vid`.)
- **Headers:** `Authorization: Bearer <YOUR_ACCESS_TOKEN>`, `Content-Type: application/json`
- **Body (JSON):** `[ { "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 1 } ]`

**Option: HubSpot node** (if Association is available)
- **Contact ID:** `{{ $json.vid }}` (from Contact node). **Company ID:** `{{ $('Set').item.json.companyId }}`.


---

### 4.7 Respond to Webhook (and when using Loop Over Items)

**If you use Loop Over Items (e.g. 9 items):** The "done" output may send 9 items, so Respond to Webhook would run 9 times if connected directly. To respond **once**:

1. Add a **Code** node (or **No Op**) between **Loop Over Items "done"** and **Respond to Webhook**.
2. In that node set **Mode: Run Once for All Items**. In the Code node, return **one** item so the next node runs once:
   ```javascript
   var count = $input.all().length;
   return [{ json: { success: true, synced: count } }];
   ```
3. Connect: **Loop Over Items (done)** → **this Code node** → **Respond to Webhook**.
4. In Respond to Webhook use **Response Code** 200 and **Body** e.g. `{{ $json }}` (so it sends `{ "success": true, "synced": 9 }`) or a fixed `{ "success": true }`.

Result: "done" sends 9 items → Code runs once, outputs 1 item → Respond to Webhook runs **once** and sends one HTTP response.

**If you do not use a loop:** Connect Respond to Webhook after the last node (e.g. after the Associate HTTP Request).
- **Response Code:** 200. **Body (optional):** `{ "success": true }`.

On HubSpot errors, add a branch that responds with 502 so the app shows “Sync failed”.

---

## 5. Error handling

- If any HubSpot or HTTP node fails, ensure the webhook still responds (e.g. 502 + `{ "error": "HubSpot sync failed" }`). Otherwise the app may hang.

---

## 6. .env and testing

- **.env:** `N8N_SYNC_HUBSPOT_WEBHOOK=https://your-n8n.com/webhook/sync-hubspot`
- **Test:** Activate workflow → in app select leads → Sync to HubSpot → check HubSpot for new Companies and Contacts and that contacts are linked to companies.

---

## 7. Checklist

- [ ] HubSpot Private App + token; n8n HubSpot credential.
- [ ] Webhook POST, respond when last node finishes; URL in `.env`.
- [ ] Code node: Normalize + Split name; keep **companyDomain** (lowercase).
- [ ] **HTTP Request: Search companies by `domain`** = `{{ $json.companyDomain || '' }}` (not by name – prevents duplicate companies).
- [ ] IF: results → Set companyId from first result; else → **HTTP Request: Create Company** (POST with **name** and **domain**) → Set companyId from `$json.id`. Merge so each item has lead + companyId.
- [ ] HubSpot Contact Create (map email, firstname, lastname, jobtitle, phone, country).
- [ ] HubSpot Associate Contact to Company (contact id + companyId).
- [ ] Respond to Webhook 200.
- [ ] Workflow activated; server restarted if needed.
