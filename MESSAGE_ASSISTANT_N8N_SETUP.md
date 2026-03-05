# Message Assistant (AI Chatbot) – n8n webhook setup

This guide sets up an n8n workflow so the **AI Assistant** on the Generate Leads page can answer user questions using **all generated leads** plus the user’s message. The app sends the same data to your webhook every time the user sends a message; you use it (e.g. with OpenAI) to return a reply.

---

## 1. What the app sends to your webhook

- **Endpoint:** The app calls **your** n8n webhook URL (you set it in `.env` as `N8N_MESSAGE_ASSISTANT_WEBHOOK`).
- **Flow:** Browser → `POST /api/message-assistant` (your backend) → your n8n webhook. The backend proxies the request so the webhook URL is never exposed to the client.

**Request (from app to your webhook):**

- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**

```json
{
  "message": "Write personalized LinkedIn outreach messages for these leads.",
  "leads": [
    {
      "id": "lead-1",
      "companyName": "Acme Inc",
      "contactName": "Jane Smith",
      "jobTitle": "Marketing Director",
      "industry": "Marketing & Advertising",
      "email": "jane@acme.com",
      "phone": "+1 555 123 4567",
      "country": "United States",
      "companyDomain": "acme.com",
      "linkedin": "https://linkedin.com/in/janesmith",
      "status": "New",
      "createdAt": "2026-03-05T18:46:59.513Z"
    }
  ],
  "conversation_id": "conv-1730737019513",
  "timestamp": "2026-03-05T19:30:00.000Z"
}
```

- **`message`** (string): The user’s question or request (e.g. “Write cold emails for these leads”, “Suggest first lines for LinkedIn”).
- **`leads`** (array): **All** leads from the current “Generate Leads” results. Each item can include:
  - `id`, `companyName`, `contactName`, `jobTitle`, `industry`
  - `email`, `phone`, `country`
  - `companyDomain`, `linkedin`, `status`, `createdAt`

If the user hasn’t generated leads yet, `leads` may be an empty array. Your workflow can still reply (e.g. “Generate some leads first, then I can tailor messages.”).

- **`conversation_id`** (string): Same for all messages in one chat session (same browser tab). Use in n8n to group or log by conversation. If the client doesn’t send one, the server generates one per request (e.g. `conv-<timestamp>`).
- **`timestamp`** (string): ISO 8601 time when the request was received (e.g. `2026-03-05T19:30:00.000Z`). Useful for logging and ordering.

---

## 2. What your webhook must return

The app expects a **JSON** response so it can show the assistant’s reply in the chat.

**Simplest (recommended):**

```json
{
  "reply": "Here are three personalized LinkedIn message ideas for your leads:\n\n1. For Jane at Acme..."
}
```

The app looks for the reply text in this order:

1. Top-level: `reply`, `output`, `message`, `response`, or `text`
2. If the response is an array: first item’s `reply` / `output` / `message` / etc. (or under `.json` if present)
3. If the response has `data` array: first element’s same fields
4. If none of the above: the **raw response body** is used as plain text

So you can return any of:

- `{ "reply": "Your text here" }`
- `{ "output": "Your text here" }`
- `{ "message": "Your text here" }`
- Or plain text (e.g. n8n “Respond to Webhook” with **Body** = plain text)

**Status codes:**

- **200:** Reply is shown in the chatbot.
- **Non-2xx (e.g. 502):** The app shows an error (e.g. “Message assistant failed” or your `error` / `message` field).

---

## 3. Prompt and step-by-step build guide

### 3.1 System prompt (for the AI)

Use this as the **system** or **instruction** message so the AI behaves as an outreach expert:

```
You are an expert B2B outreach and sales copywriter. You help users write personalized, conversion-focused messages for LinkedIn DMs, cold emails, and follow-ups. You are given a list of leads (company name, contact name, job title, industry, and sometimes email/phone). Use this context to tailor every suggestion. Be concise, professional, and specific to each lead when the user asks for per-lead content. Use clear formatting: bullet points, numbered lists, or short paragraphs. Do not make up companies or contacts; only use the leads provided. If no leads are provided, say so and suggest the user generate leads first.
```

### 3.2 User prompt (what you send to the AI)

Build the **user** message in a Code node from the webhook body. Template:

```
LEADS (use these only; do not invent):
{{LEADS_SUMMARY}}

USER REQUEST:
{{USER_MESSAGE}}

Respond with actionable, ready-to-use content. Format for readability (e.g. markdown lists or headers).
```

- **{{LEADS_SUMMARY}}** = one line per lead, e.g. `1. Company | Contact | Job Title | Industry | Email`
- **{{USER_MESSAGE}}** = `body.message` from the webhook (e.g. “Generate personalized LinkedIn DMs for these leads.”)

If there are no leads, send: `LEADS: None provided. Ask the user to generate leads first.` and still include **USER REQUEST**.

### 3.3 Flow: Webhook → Normalize Input → OpenAI → Parse Response → Respond to Webhook

This flow matches the pattern you described: webhook with `body` (message, leads, conversation_id, timestamp) → **Code (Normalize Input)** → **OpenAI** (context + history + message, JSON reply) → **Code (Parse Response)** → **Respond to Webhook**.

---

### 3.4 Step-by-step build in n8n

**Step 1 – Webhook**

1. Add trigger **Webhook**.
2. **HTTP Method:** POST.
3. **Path:** `message-assistant` (or any path; note the full URL).
4. **Respond:** **When last node finishes**.
5. Save. Copy the **Production** URL into `.env` as `N8N_MESSAGE_ASSISTANT_WEBHOOK`.

**Step 2 – Code: Normalize Input**

1. Add a **Code** node; name it **Normalize Input**.
2. **Mode:** Run Once for All Items.
3. Paste the script from **3.6 Code 1 – Normalize Input** below.
4. Output: one item with `message`, `context`, `history` for the OpenAI node.

**Step 3 – OpenAI**

1. Add **OpenAI** (Chat/Message) after **Normalize Input**.
2. **Model:** e.g. `gpt-4o-mini` or `gpt-4o`.
3. **Credentials:** Your OpenAI API key.
4. **System prompt:** Use the text in **3.5 System + user prompt block** below.
5. **User prompt:** `Context:\n{{ $json.context }}\n\nConversation History:\n{{ $json.history }}\n\nUser Question:\n{{ $json.message }}`

**Step 4 – Code: Parse Response**

1. Add another **Code** node; name it **Parse Response**.
2. **Mode:** Run Once for All Items.
3. Paste the script from **3.7 Code 2 – Parse Response** below.
4. Output: one item with `reply` (string).

**Step 5 – Respond to Webhook**

1. Add **Respond to Webhook** after **Parse Response**.
2. **Respond With:** JSON.
3. **Body:** `{ "reply": "{{ $json.reply }}" }`

**Step 6 – Connect and test**

1. Connect: **Webhook** → **Normalize Input** → **OpenAI** → **Parse Response** → **Respond to Webhook**.
2. Activate the workflow (Production).
3. In your app: Generate leads, open AI Assistant, send e.g. “Generate personalized LinkedIn DMs for these leads.”
4. In n8n: Confirm webhook receives `body.message`, `body.leads`, `body.conversation_id`, `body.timestamp`; final response has `reply` with the AI text.

---

### 3.5 System + user prompt block (for OpenAI node)

**System prompt** (paste into OpenAI node’s system / instruction field):

```
You are an expert B2B outreach and sales copywriter. You help users write personalized, conversion-focused messages for LinkedIn DMs, cold emails, and follow-ups.

You must answer using ONLY the information provided in the context (the leads list). Do not invent companies or contacts. Do not generalize beyond the context.

Your job is to:
- answer the user's question directly
- use the leads in the context to tailor every suggestion
- give actionable, concrete recommendations

If the question cannot be answered from the context (e.g. no leads provided), say so clearly and suggest they generate leads first.

Keep answers concise and structured. Use markdown (lists, headers) for readability.

Return JSON ONLY in this format:
{
  "reply": "your full answer here",
  "followups": ["optional follow-up question 1", "optional follow-up question 2"]
}
```

**User prompt** in the OpenAI node: use expressions so the node receives context, history, and message from the previous (Normalize Input) node, e.g.:

- `Context:\n{{ $json.context }}\n\nConversation History:\n{{ $json.history }}\n\nUser Question:\n{{ $json.message }}`

---

### 3.6 Code 1 – Normalize Input (enhanced)

Webhook output is often `[ { body: {...}, headers, params, ... } ]`. This script reads `body.message` and `body.leads`, builds a **rich `context`** (one block per lead with labeled fields), a **`leadsSimple`** array for downstream use, and outputs `message`, `context`, `history`, and `leadsSimple` for the OpenAI node (and any other nodes).

**Enhancements:**
- **Context:** Each lead is a small block with Name, Company, Title, Industry, Email, LinkedIn, Country so the AI has full detail and can personalize by lead.
- **leadsSimple:** Array of `{ name, company, title, industry, linkedin, email }` for easy use in other nodes or prompts.

```javascript
// Webhook output: body at raw.body or raw
const raw = $input.first().json;
const body = raw.body ?? raw;

const message = body.message || '';
const leads = Array.isArray(body.leads) ? body.leads : [];
const history = Array.isArray(body.history) ? body.history : [];
const MAX_LEADS = 80;
const slice = leads.slice(0, MAX_LEADS);

// Simple shape for downstream: { name, company, title, industry, linkedin, email }
const leadsSimple = slice.map((l) => ({
  name: l.contactName || l.name || '',
  company: l.companyName || l.company || '',
  title: l.jobTitle || l.title || '',
  industry: l.industry || '',
  linkedin: l.linkedin || '',
  email: l.email || ''
}));

// Rich context: one block per lead with labeled fields (better for AI to personalize)
function leadBlock(l, i) {
  const name = l.contactName || l.name || '';
  const company = l.companyName || l.company || '';
  const title = l.jobTitle || l.title || '';
  const industry = l.industry || '';
  const email = l.email || '';
  const linkedin = l.linkedin || '';
  const country = l.country || '';
  const lines = [
    `Lead ${i + 1}:`,
    `  Name: ${name}`,
    `  Company: ${company}`,
    `  Title: ${title}`,
    `  Industry: ${industry}`
  ];
  if (email) lines.push(`  Email: ${email}`);
  if (linkedin) lines.push(`  LinkedIn: ${linkedin}`);
  if (country) lines.push(`  Country: ${country}`);
  return lines.join('\n');
}

const context = slice.length === 0
  ? 'No leads provided. Suggest the user generate leads first.'
  : slice.map((l, i) => leadBlock(l, i)).join('\n\n');

return [{ json: { message, context, history, leadsSimple } }];
```

---

### 3.7 Code 2 – Parse Response

Extracts the reply from common OpenAI response shapes (including when the model returns JSON `{ "reply": "...", "followups": [...] }`). Outputs `{ reply }` for Respond to Webhook.

```javascript
const raw = $input.first().json;
let reply = '';

if (typeof raw.message?.content === 'string' && raw.message.content.trim().startsWith('{')) {
  try {
    const parsed = JSON.parse(raw.message.content);
    reply = parsed.reply || parsed.message || '';
  } catch (e) {
    reply = raw.message.content;
  }
} else if (raw.message?.content) {
  reply = raw.message.content;
} else if (raw.output?.[0]?.content?.[0]?.text) {
  reply = raw.output[0].content[0].text;
} else if (raw.text) {
  reply = raw.text;
} else if (raw.choices?.[0]?.message?.content) {
  reply = raw.choices[0].message.content;
} else {
  reply = typeof raw === 'string' ? raw : JSON.stringify(raw);
}

return [{ json: { reply: reply || 'No response generated.' } }];
```

---

## 4. Environment variable (recap)

In your project **`.env`** (same place as other n8n webhooks):

```env
# Message Assistant: POST { message, leads } – used for AI outreach suggestions
N8N_MESSAGE_ASSISTANT_WEBHOOK=https://your-n8n-instance.com/webhook/message-assistant
```

- Use the **Production** webhook URL from n8n (with “Respond when last node finishes” or manual “Respond to Webhook”).
- Restart the app after changing `.env`.

If this is missing or invalid, the UI will show: *“Message assistant webhook is not configured. Add N8N_MESSAGE_ASSISTANT_WEBHOOK to .env.”*

---

## 5. n8n workflow outline

1. **Webhook** – POST, receives `{ message, leads }`. **Respond:** When last node finishes.
2. **Code (optional)** – Build a prompt string: summarize leads (e.g. first 50) + user `message` for the AI.
3. **OpenAI** (or other AI node) – Send the prompt, get a completion.
4. **Respond to Webhook** – Return `{ "reply": "<AI response text>" }`.

You can add more nodes (e.g. limit leads, format the list, or branch by `message`), but the minimum is: **Webhook → AI → Respond to Webhook**.

---

## 6. Node-by-node setup (reference)

### 6.1 Webhook

- **HTTP Method:** POST  
- **Path:** e.g. `message-assistant`  
- **Respond:** **When last node finishes** (so the webhook waits for the AI and then returns the reply).  
- Copy the **Production** URL (e.g. `https://your-n8n.com/webhook/message-assistant`) into `.env` as `N8N_MESSAGE_ASSISTANT_WEBHOOK`.

---

### 6.2 Code: Build prompt from `message` + `leads`

Add a **Code** node that runs **once** and builds one object with a `prompt` (and optionally a short `leadsSummary`) for the next node.

**Mode:** Run Once for All Items.

**Input:** You get one item from the Webhook: `$input.first().json` has `message` and `leads`.

Example:

```javascript
const item = $input.first().json;
const message = item.message || '';
const leads = Array.isArray(item.leads) ? item.leads : [];

// Optional: limit to first 50 leads so the prompt doesn’t get huge
const slice = leads.slice(0, 50);

function row(l) {
  return [
    l.companyName || '',
    l.contactName || '',
    l.jobTitle || '',
    l.industry || '',
    l.email || ''
  ].filter(Boolean).join(' | ');
}

const leadsSummary = slice.length === 0
  ? 'No leads provided.'
  : slice.map((l, i) => `${i + 1}. ${row(l)}`).join('\n');

const prompt = `You are an outreach expert. Below are leads (company, contact, job title, industry, email). Use them to answer the user's request. If there are no leads, say so and suggest they generate leads first.

LEADS:
${leadsSummary}

USER REQUEST:
${message}

Provide a helpful, actionable response. Use clear formatting (e.g. bullet points or numbered list).`;

return [{ json: { prompt, message, leadsCount: leads.length } }];
```

- **Output:** One item with `prompt`, `message`, and `leadsCount`. The next node (e.g. OpenAI) will use `prompt`.

---

### 6.3 OpenAI (or other AI)

- **Resource:** Chat (Completion).
- **Model:** e.g. `gpt-4o-mini` or `gpt-4o`.
- **Prompt / Message:** Use the prompt from the Code node, e.g. `{{ $json.prompt }}`.
- **Output:** The node returns the AI text (e.g. in `message.content` or similar, depending on the node).

---

### 6.4 Respond to Webhook

You must return a **single** JSON object with a `reply` (or equivalent) field so the app can show it in the chat.

**Option A – From OpenAI node:**

If your OpenAI node outputs the text in something like `$json.message.content` or `$json.text`:

- Add a **Respond to Webhook** node.
- **Respond With:** JSON.
- **Body:**  
  `{ "reply": "{{ $json.message.content }}" }`  
  (adjust the path to match your AI node’s output, e.g. `$json.text` or `$json.reply`).

**Option B – Code before Respond to Webhook:**

If the AI node returns a different structure, add a **Code** node that normalizes it:

```javascript
const item = $input.first().json;
const text = item.message?.content
  || item.content
  || item.text
  || item.reply
  || (typeof item === 'string' ? item : '');
return [{ json: { reply: text || 'No response generated.' } }];
```

Then **Respond to Webhook** with **Body:** `{{ $json.reply }}` as a string, or **Respond With:** JSON and **Body:** `{ "reply": "{{ $json.reply }}" }` (ensure the value is a string).

**Option C – Plain text:**

If you prefer to return plain text, set **Respond to Webhook** → **Respond With:** Text and put the AI reply in the body. The app will use the raw body as the reply.

---

## 7. End-to-end flow (summary)

| Step | What happens |
|------|------------------|
| 1 | User types in AI Assistant and clicks Send. |
| 2 | App sends `POST /api/message-assistant` with `{ message, leads }` (all current generated leads). |
| 3 | Your server forwards the same body to `N8N_MESSAGE_ASSISTANT_WEBHOOK`. |
| 4 | n8n Webhook receives `message` + `leads`. |
| 5 | Code node (optional) builds a prompt from leads + message. |
| 6 | OpenAI (or other AI) returns a completion. |
| 7 | Respond to Webhook returns `{ "reply": "<text>" }` (or plain text). |
| 8 | App shows the reply in the AI Assistant chat. |

---

## 8. Security and limits

- **Auth:** The app’s `POST /api/message-assistant` is protected by your app’s auth (e.g. session). Only logged-in users hit the webhook. n8n can optionally check a secret header if you add one.
- **Size:** If you have hundreds of leads, consider summarizing or limiting to the first N (e.g. 50) in the Code node to keep the prompt and token usage under control.
- **PII:** The payload includes email/phone/names. Use HTTPS and restrict who can access your n8n instance and webhook URL.

---

## 9. Testing

1. Set `N8N_MESSAGE_ASSISTANT_WEBHOOK` in `.env` and restart the app.
2. In the app: Generate Leads so you have at least one lead.
3. Open the AI Assistant, type e.g. “Write a short LinkedIn DM for the first lead,” and send.
4. In n8n: Check the Webhook execution; you should see `message` and `leads` in the input.
5. Confirm the last node returns `{ "reply": "..." }` (or plain text). The chat should show that reply.

If the app shows “Message assistant webhook is not configured,” the env var is missing or the URL is wrong. If it shows “Message assistant failed” or “Could not reach the assistant,” check n8n logs and that the webhook responds with 200 and a body the app can parse (see section 2).
