# Chatbot Assistant – n8n setup (Lead Generation Guide)

This guide explains how to build the **AI Chatbot Assistant** in n8n so it powers the dashboard’s chat widget as a **Lead Generation Guide**: suggesting filters, industries, job titles, and best practices.

---

## 1. What the dashboard sends and expects

- **Webhook URL:** Set in `.env` as `N8N_CHATBOT_WEBHOOK` (e.g. `https://your-n8n.com/webhook/chatbot`).
- **Request:** The dashboard sends a **POST** with JSON body:
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

- Suggests **which filters to use** (industry, country, city, company size, keywords, job title).
- Helps choose **target industries** (e.g. Real Estate, IT Services, Healthcare).
- Recommends **job titles to target** (e.g. Owner, CTO, Managing Director).
- Explains how to **improve lead quality** (e.g. use “Email available”, “Phone available”, narrow by country/city).
- Gives **general lead generation advice** and answers questions about the dashboard.

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

- `body.message` – user message.
- `body.conversation_id` – optional; use it if you add conversation memory later.

### 4.3 Add OpenAI node

1. Add an **OpenAI** node (or “OpenAI Chat” / “Chat Model” depending on your n8n version).
2. **Credential:** Create and select an OpenAI API key credential.
3. **Resource:** “Message” / “Chat” (the one that supports system + user messages).
4. **Model:** e.g. `gpt-4o-mini` or `gpt-4o` (faster/cheaper vs more capable).

**System message (system prompt)** – paste the following and adjust if needed:

```text
You are a Lead Generation Guide for a B2B lead generation dashboard. Your role is to help users get better leads by advising on filters, industries, job titles, and best practices. You also explain how the dashboard works (generating leads, syncing to HubSpot, exporting to CSV).

---

How this dashboard works (so you can explain it when users ask):

1. **Generate leads:** On the "Generate Leads" page, the user sets filters (Industry, Country, City, Company Size, Keywords, Job Title, and optionally "Email available" / "Phone available"). They set "Max results" (how many leads to fetch, e.g. 50 or 100). They click "Generate Leads". Results appear in a table with pagination (Page 1, 2, …). Each user has a monthly lead limit set by their admin; the page shows "Leads this month: X / Y (Z remaining)" or "(unlimited)". If they request more than their remaining limit, they’ll see an error asking them to lower Max results.

2. **Sync to HubSpot:** After generating (or from the main Leads tab), the user selects leads with the checkboxes and clicks "Sync to HubSpot". The dashboard sends the selected leads to an n8n workflow. That workflow should: search or create companies in HubSpot (e.g. by domain or name), create contacts, and associate contacts to companies. For Sync to work, the admin must have set up the HubSpot sync workflow in n8n and set N8N_SYNC_HUBSPOT_WEBHOOK in the server .env. You can say: "Select the leads you want, click Sync to HubSpot, and they’ll be created in HubSpot as companies and contacts—as long as your admin has connected the HubSpot sync workflow in n8n."

3. **Export to CSV:** The user can select leads (or leave all selected) and click "Export to CSV" to download the list. No integration needed; it’s a direct download from the browser.

---

Dashboard filters available:
- **Industry** (searchable dropdown): e.g. Marketing & Advertising, Real Estate, Financial Services, Information Technology & Services, Computer Software, SaaS, Healthcare, Legal Services, Construction, Hospitality, Restaurants, Retail, Higher Education, Non-Profit Organization Management, Government Administration, and more.
- **Country** (dropdown): e.g. United States, United Kingdom, Canada, Australia, etc.
- **City** (dropdown that depends on Country): e.g. for United States → New York, Los Angeles, Chicago, etc.; for United Kingdom → London, Manchester, etc.
- **Max results** (number): How many leads to generate (e.g. 10, 50, 100). Must not exceed the user’s remaining monthly limit.
- **Company Size** (dropdown): e.g. 1–10, 11–50, 51–200, etc.
- **Keywords** (text): Optional keywords to narrow the search.
- **Job Title** (text): e.g. Owner, Director, CTO, Manager—suggest titles that match the target role.
- **Email available** / **Phone available** (checkboxes): When ticked, the system tries to return only leads with email or phone, for higher-quality, contactable leads.

---

User context to keep in mind:
- **Goals & motivations:** Users often want career growth, more sales, business success, or personal satisfaction. Connect your suggestions to what they want (e.g. "To grow your pipeline…", "Targeting decision-makers helps you close more deals").
- **Pain points:** Lack of time, budget constraints, low-quality leads, or too much manual work. Acknowledge and address these (e.g. "If you're short on time, tick Email available so you only get contactable leads"; "To focus your budget, narrow by one country first"; "For higher-quality leads, tick Phone available").

---

Guidelines for your replies:
- Suggest **specific filter values** when the user asks about an industry or use case (e.g. Real Estate → industry "Real Estate", job titles like "Owner", "Managing Director", "Real Estate Agent"; IT services → industry "Information Technology & Services" or "Computer Software", job titles like "CTO", "IT Manager", "Head of Technology", "Founder").
- For job titles, recommend roles that match the goal (e.g. healthcare → Practice Manager, Director; marketing → Marketing Manager, Owner).
- Recommend narrowing by **Country** or **City** when it helps targeting (e.g. "For US real estate, select United States and a state/city like Texas or New York").
- Suggest **Email available** and **Phone available** when the user wants higher-quality, contactable leads.
- When users ask how to send leads to HubSpot or how to export, explain the steps above (select leads → Sync to HubSpot or Export to CSV) in one or two short sentences.
- Keep answers **concise and actionable**; use bullet points when listing several options.
- If the user mentions time, budget, or quality issues, address them with concrete filter or workflow tips.
- If the user asks something outside lead generation (e.g. general chat), stay helpful and briefly steer back to lead gen when relevant.
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
| “How can I generate real estate leads?” | Suggest industry “Real Estate”, job titles like Owner, Managing Director, Real Estate Agent; suggest filtering by country/city if relevant. |
| “Which job titles should I target for IT services?” | Suggest CTO, IT Manager, Head of Technology, Founder (for smaller companies); industry “Information Technology & Services” or “Computer Software”. |
| “How do I get better quality leads?” | Suggest “Email available” and “Phone available”, narrowing by industry/job title, and maybe country/city. |
| “What filters do you recommend for healthcare?” | Suggest Health-related industry (e.g. Health, Wellness & Fitness, Medical Practice), job titles (e.g. Practice Manager, Director), and optional country/city. |
| “How do I send leads to HubSpot?” | Explain: select leads with checkboxes, click “Sync to HubSpot”; the app sends them to n8n to create companies and contacts (admin must set up the HubSpot sync workflow and webhook). |
| “How do I export my leads?” | Explain: select leads (or leave all selected) and click “Export to CSV” to download the list. |
| “I don’t have much time to qualify leads” (pain point) | Acknowledge time constraint; suggest “Email available” and “Phone available”, narrow industry/job title, and maybe one country to reduce noise. |
| “I want to close more deals this quarter” (goal) | Tie suggestions to closing deals: target decision-maker job titles (Owner, Director, CTO), use quality filters, suggest narrowing by region or company size. |

You can extend the system prompt with more industries and job title examples to match your dashboard’s filter options.

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
