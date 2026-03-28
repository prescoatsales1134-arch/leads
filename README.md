# AI Powered Lead Generation Dashboard

A modern SaaS dashboard (HTML, CSS, vanilla JavaScript) that talks to **n8n** via webhooks for lead generation, AI chatbot, HubSpot sync, and exports.

## Build and run

**For a full step-by-step build guide** (env variables explained, Supabase, Google auth, running locally, troubleshooting), see **[BUILD.md](./BUILD.md)**.

**Quick setup:**

1. Run `npm install`, then copy `.env.example` to `.env` and fill in your values (Supabase URL/anon key, n8n webhook URLs).
2. Set up Supabase and Google sign-in using **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**.
3. Run `npm start` (Node/Express server). It reads `.env` and serves the app; the frontend gets config from `/api/env`. Open `http://localhost:3000` and sign in with Google.

## Roles & permissions

- **Admin**: View all leads (scraped by any user), manage which user has which role (Admin/Manager), export leads as CSV, sync leads to HubSpot.
- **Manager**: Generate leads, view leads, export leads as CSV, sync leads to HubSpot.

## n8n webhooks

Configure these in `.env` and regenerate `config.js`:

| Variable | Purpose |
|----------|--------|
| `N8N_GENERATE_LEADS_WEBHOOK` | POST filters → returns leads (LinkedIn / Peakydev workflow) |
| `N8N_GENERATE_GOOGLE_LEADS_WEBHOOK` | POST filters → returns leads (Google/Maps workflow; see [N8N_LINKEDIN_GOOGLE_LEADS_WORKFLOWS.md](./N8N_LINKEDIN_GOOGLE_LEADS_WORKFLOWS.md)) |
| `N8N_CHATBOT_WEBHOOK` | POST `{ message, conversation_id }` → returns reply |
| `N8N_EXPORT_WEBHOOK` | Optional export hook |
| `N8N_SYNC_HUBSPOT_WEBHOOK` | POST lead object → sync to HubSpot |

The frontend only sends requests and displays results; all business logic lives in n8n.

## File structure

- **Backend (Node.js):** `server.js` – Express server, serves static files, reads `.env`, exposes `GET /api/env` for client config.
- **Frontend:** `index.html` (login), `dashboard.html` (app shell), `styles.css`, `app.js`, `auth.js`, `leads.js`, `chatbot.js`, `utils.js`. The frontend fetches config from `/api/env`; no `config.js` needed when using the server.

## Design

- Primary: `#2563EB`, background: `#F8FAFC`, cards: white with soft shadow, rounded corners.
- Responsive layout; sidebar collapses to overlay on small screens.
