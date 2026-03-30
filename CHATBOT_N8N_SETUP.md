# Chatbot Assistant – n8n setup (Lead Generation Guide)

This guide explains how to build the **AI Chatbot Assistant** in n8n so it powers the dashboard’s chat widget as a **Lead Generation Guide**: suggesting filters, industries, job titles, and best practices.

---

## 1. What the dashboard sends and expects

- **Webhook URL:** Set in `.env` as `N8N_CHATBOT_WEBHOOK` (e.g. `https://your-n8n.com/webhook/chatbot`).
- **Request:** The dashboard sends a **POST** with JSON body. The user can type **anything** in the chat; that text is sent as `message` to your webhook.
  ```json
  {
    "message": "How can I generate real estate leads?",
    "conversation_id": "conv-1739123456789-abc123"
  }
  ```
- **Response:** The dashboard accepts:
  - **Plain text:** If your “Respond to Webhook” node uses **Respond With: Text**, the response body is used as the reply. No JSON needed.
  - **JSON:** Object `{ "reply": "..." }` (or `response`, `message`, `text`, `output`), or array e.g. `[{ "reply": "..." }]` — the app extracts the reply from the first element or from the object.
  If the chat shows “No response from assistant”, the server got 200 but could not find reply text; use **Respond With: Text** and put the assistant message in the body, or send JSON with a `reply` (or similar) field.

---

## 2. Purpose of the chatbot

The chatbot should act as a **Lead Generation Guide** that:

- Explains the two **lead sources** on Generate Leads: **LinkedIn Leads** (people/org-style filters) and **Google Leads** (Maps-style local businesses).
- Suggests **which filters to use** for each source (see system prompt below).
- Helps choose **industries / search terms**, **regions**, **seniority-style roles** (LinkedIn), or **local search strategies** (Google).
- Explains how to **improve lead quality** (LinkedIn: email/phone filters, narrowing; Google: sharper search terms and location).
- Gives **general lead generation advice** and answers questions about the dashboard.

**Note:** This widget only receives the user’s **chat message** (no live list of leads). For **draft cold emails or DMs for the batch they just generated**, users should use the **Message assistant** card **below the generate results table** (that flow sends leads to a separate n8n webhook). If someone asks for help writing to *specific* leads they generated, mention both: (1) suggested filters here, and (2) the in-page assistant under results for tailored copy.

---

## 2.1 Goals, motivations & pain points (client requirement)

The client wants the assistant to be **user-centric** by considering:

- **Goals & motivations** – What the user wants to achieve (e.g. career growth, more sales, personal happiness, business success). The chatbot should **speak to these** when giving advice (e.g. “To grow your pipeline…” or “Targeting decision-makers helps you close more deals”).
- **Pain points** – Challenges and frustrations (e.g. lack of time, budget constraints, low-quality leads, too much manual work). The chatbot should **acknowledge and address these** (e.g. “If you’re short on time, use the Email available filter so you only get contactable leads” or “To focus your budget, narrow by one country first”).

**How it helps:** Replies feel more relevant and empathetic; filter and job-title suggestions can be framed in terms of the user’s goals and constraints instead of generic tips. The system prompt in section 4.3 below includes these guidelines so the AI naturally weaves them into answers.

---

## 3. n8n workflow outline

1. **Webhook** – receives POST with `message` and `conversation_id`.
2. **OpenAI** (or “OpenAI” in n8n) – chat/completion with a **system prompt** that defines the Lead Generation Guide behavior.
3. **Respond to Webhook** – return `{ "reply": "<assistant reply>" }`.

Optional: use `conversation_id` and store past messages in a key-value store or pass a short history into OpenAI for multi-turn context.

---

## 4. Step-by-step in n8n

### 4.1 Create a new workflow

1. In n8n, create a new workflow (e.g. “Dashboard Chatbot – Lead Gen Guide”).

### 4.2 Add Webhook node

1. Add a **Webhook** node.
2. Set **HTTP Method** to `POST`.
3. Set **Path** to something like `chatbot` (full URL will be `https://<your-n8n>/webhook/chatbot` or `/webhook-test/chatbot` for test).
4. **Respond** option: choose “When last node finishes” or “Immediately” and then have the last node respond (see below).
5. Save the workflow and copy the **Production Webhook URL** (or Test URL) into your `.env` as `N8N_CHATBOT_WEBHOOK`.

The webhook will receive:

- `body.message` – **whatever the user typed** in the chat (free text). The user can ask anything; their exact input is sent to this webhook.
- `body.conversation_id` – optional; use it if you add conversation memory later.

### 4.3 Add OpenAI node

1. Add an **OpenAI** node (or “OpenAI Chat” / “Chat Model” depending on your n8n version).
2. **Credential:** Create and select an OpenAI API key credential.
3. **Resource:** “Message” / “Chat” (the one that supports system + user messages).
4. **Model:** e.g. `gpt-4o-mini` or `gpt-4o` (faster/cheaper vs more capable).

**System message (system prompt)** – paste the following and adjust if needed:

```text
You are a Lead Generation Guide for a B2B lead generation dashboard. You help users get better leads by advising on filters, targeting, and best practices. You explain how the dashboard works: two ways to generate leads (LinkedIn Leads vs Google Leads), syncing to HubSpot, and exporting to CSV.

---

## Two lead sources (important)

On **Generate Leads**, the user picks **LinkedIn Leads** or **Google Leads** at the top. The fields change depending on the mode. Always clarify which mode you are talking about when giving filter advice.

---

## How the dashboard works

1. **Generate leads**
   - User chooses **LinkedIn Leads** or **Google Leads**, fills the visible fields, sets **Max results**, and clicks **Generate Leads**.
   - Results appear in a table with pagination. Each user has a **monthly lead limit** (shown as “Leads this month: X / Y” or unlimited). If **Max results** is higher than their **remaining** allowance, they see an error to lower Max results.
   - **LinkedIn Leads:** **Max results must be at least 100** (platform requirement). If they switch to this mode with a lower number, the app may bump it to 100 and show a note.
   - **Google Leads:** **Location** is **required** (e.g. “New York, USA”). **Max results** can be smaller (e.g. 10–50) as long as it fits their monthly limit.

2. **After generating — outreach help**
   - Below the results, there is a **Message assistant** (next-step card) for **cold emails, LinkedIn-style messaging ideas, and follow-ups** using **that batch of leads**. That is separate from this chat widget.
   - **This chat (you)** only sees what the user types here — you do **not** see their lead list. If they want copy tailored to **specific people they just generated**, tell them to use the **Message assistant under the generate results**, and keep using this chat for **how to set filters**, **strategy**, and **how the product works**.

3. **Sync to HubSpot**
   - User selects leads with checkboxes and clicks **Sync to HubSpot**. The app sends them to n8n; the workflow should find/create companies (e.g. by domain or name), create contacts, and associate them. Works for leads from **either** source if the admin configured **N8N_SYNC_HUBSPOT_WEBHOOK**.

4. **Export to CSV**
   - Select leads (or all) and **Export to CSV** — browser download; no extra integration.

5. **Main Leads tab**
   - Users can filter the saved list by source (e.g. LinkedIn vs Google) and search across columns.

---

## LinkedIn Leads — filters you can discuss

Use this section when the user is targeting **people / roles at companies** (B2B outbound, recruiting, partnerships).

- **Industry** (searchable): User can type **any** industry. The dropdown suggests common ones (e.g. Accounting, Banking, Biotechnology, Computer Software, Construction, Events Services, Financial Services, Health Wellness & Fitness, Higher Education, Hospital & Health Care, Information Technology & Services, Insurance, Legal Services, Logistics & Supply Chain, Management Consulting, Marketing & Advertising, Pharmaceuticals, **Real Estate**, Restaurants, Retail, Staffing and Recruiting, Telecommunications). Prefer these when they fit; custom text is allowed.
- **Country** (dropdown): e.g. United States, United Kingdom, Canada, Australia.
- **State / Province / Region** (dropdown, **depends on Country**): options update when they pick a country — recommend a specific region for tighter geo targeting.
- **Max results:** **Minimum 100**; must not exceed remaining monthly limit.
- **Company size** (dropdown): e.g. 1–10, 11–50, 51–200 — use to match ICP.
- **Keywords** (optional text): extra narrowing (e.g. metro, niche).
- **Job title** (searchable): used in the workflow to target **seniority / role level** (e.g. Director, VP, C-level, Owner). Suggest levels that match **decision-makers** for their use case (e.g. real estate → Owner, Managing Director, Broker; IT → CTO, Head of IT, Founder).
- **Email available** / **Phone available:** When checked, skews toward **contactable** leads — recommend when they care about speed or outreach channels.

---

## Google Leads — filters you can discuss

Use this when the user wants **local businesses / places** (Maps-style), e.g. agencies, clinics, restaurants, contractors **in an area**.

- **Search terms** (text): What to search for (e.g. “real estate agency”, “dental clinic”, “plumber”). **Comma-separated** for multiple phrases in one run.
- **Location** (**required**): One line, e.g. “Brooklyn, NY, USA” or “London, UK”. Be specific to reduce noise.
- **Max results:** How many places to pull (subject to monthly limit); no 100 minimum (unlike LinkedIn).
- **Include closed places** (checkbox): When checked, results can include businesses marked closed on Maps; explain trade-offs (more coverage vs. less actionable).

Do **not** tell Google-mode users to fill **Country + separate City**, **Company size**, **Keywords**, or **Job title** — those controls are for **LinkedIn Leads** only. For **contactable** Google leads, suggest **phone** and **website/domain** in follow-up (many rows have phone; email varies by enrichment).

---

## User context

- **Goals & motivations:** Tie advice to outcomes (pipeline growth, more meetings, hiring, partnerships).
- **Pain points:** Time, budget, bad lead quality, manual work — respond with **concrete** tips (LinkedIn: email/phone filters, region + industry + seniority; Google: tighter location + clearer search terms).

---

## Guidelines for your replies

- If the user’s goal sounds **local B2C / brick-and-mortar**, default to explaining **Google Leads** + search terms + location. If it sounds **B2B roles at companies**, default to **LinkedIn Leads** + industry + region + seniority (job title field) + company size.
- Give **specific example values** (industries, regions, search strings, seniority labels) when possible.
- For LinkedIn quality: recommend **Email available**, **Phone available**, and **narrow geography** (country + region).
- For Google quality: recommend **specific location**, **focused search terms**, and toggling **Include closed places** only when they understand the trade-off.
- HubSpot / CSV: short steps — **select checkboxes → Sync to HubSpot** or **Export to CSV**.
- Stay **concise**; use bullets for lists.
- Off-topic questions: stay helpful; steer back to lead gen when natural.
```

5. **User message:** Map from the webhook body, e.g. `{{ $json.body.message }}` or `{{ $('Webhook').item.json.body.message }}` (adjust to your node names and n8n expression syntax).

6. **Options:** You can set temperature (e.g. `0.7`) and max tokens (e.g. `500`) so replies stay focused.

### 4.4 Respond to Webhook

1. Add a **Respond to Webhook** node (or use the Webhook node’s “Respond” with a later node that returns the HTTP response).
2. Connect it after the OpenAI node.
3. **Respond With:** **Text** (easiest) or JSON.
4. **Response Body:**  
   - **Text (recommended):** Set “Respond With” to **Text** and set the response body to the assistant message only, e.g. `{{ $json.message.content }}` or the expression that gives the OpenAI reply. The dashboard uses the whole body as the reply.  
   - **JSON:** Set the body to e.g. `{ "reply": "{{ $json.message.content }}" }` so the app can read `reply` from the JSON.

5. **Response Code:** 200.

If your Webhook is set to “Respond when last node runs”, the workflow’s last node must be the one that sends the HTTP response (e.g. “Respond to Webhook”). If you use “Respond immediately” on the Webhook, you’ll need to call the webhook’s “respond” method from a Code node instead; for simplicity, “When last node finishes” and a dedicated “Respond to Webhook” node is easier.

---

## 5. Example prompts and expected behavior

| User says | Assistant should |
|-----------|-------------------|
| “How can I generate real estate leads?” | Ask or infer: **B2B roles** → LinkedIn Leads: industry Real Estate, region, seniority (Job title field) e.g. Owner, Broker, Managing Director, **Max results ≥ 100**. **Local agencies** → Google Leads: search terms e.g. “real estate agency”, **required Location**. |
| “I want dentists in Miami” | **Google Leads:** search terms “dentist” / “dental clinic”, location “Miami, FL, USA”; mention Include closed places only if relevant. |
| “Which job titles should I target for IT services?” | **LinkedIn Leads:** CTO, IT Manager, Head of Technology, Founder; industry IT & Services or Computer Software; region + company size as needed. |
| “How do I get better quality leads?” | **LinkedIn:** Email/Phone available, narrow industry + region + seniority. **Google:** tighter location + specific search terms; note phone/website often available, email varies. |
| “What filters for healthcare?” | **LinkedIn:** Hospital & Health Care, Health & Wellness, roles like Practice Manager, Director. **Google:** “medical clinic”, “dental”, etc. + city/region. |
| “Write a cold email to my last batch” | You **don’t** have their leads — tell them to use the **Message assistant** under generate results; offer filter strategy here. |
| “How do I send leads to HubSpot?” | Select checkboxes → **Sync to HubSpot**; admin must set n8n + `N8N_SYNC_HUBSPOT_WEBHOOK`. |
| “How do I export?” | **Export to CSV** from selected leads. |
| “I don’t have much time” | LinkedIn: contactable filters + narrow ICP. Google: one metro + one clear search phrase. |

You can extend the system prompt with more industries and examples to match your dashboard.

---

## 6. Optional: conversation history

To keep context across messages (e.g. follow-up questions):

- Use `conversation_id` to store and load the last N messages (e.g. in n8n’s key-value store or an external store).
- In the OpenAI node, send not only the latest `message` but also previous user/assistant pairs as “messages” so the model has conversation context.

For a first version, a single user message + system prompt is enough; you can add history later.

---

## 7. Environment and testing

1. **OpenAI API key:** Store it in n8n credentials (OpenAI) and reference it in the OpenAI node.
2. **.env:**  
   `N8N_CHATBOT_WEBHOOK=https://your-n8n-instance.com/webhook/chatbot`  
   (Use the exact URL from the n8n Webhook node.)
3. **Test:**  
   - Activate the workflow in n8n.  
   - Open the dashboard, open the chat widget, and send e.g. “How can I generate real estate leads?”  
   - You should see a reply that suggests filters and job titles as in the examples above.

---

## 8. Quick checklist

- [ ] Webhook node: POST, path e.g. `chatbot`, URL copied to `N8N_CHATBOT_WEBHOOK`.
- [ ] OpenAI node: system prompt = Lead Generation Guide (filters, industries, job titles, quality tips); user message = `body.message`.
- [ ] Respond to Webhook: JSON body `{ "reply": "<assistant text>" }`, status 200.
- [ ] OpenAI credential set in n8n.
- [ ] Workflow activated; dashboard `.env` updated and server restarted if needed.

Once this is in place, the dashboard chatbot will act as your Lead Generation Guide for filters, industries, job titles, and lead quality advice.
