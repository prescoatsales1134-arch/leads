# Detailed Build Guide – Lead Generation Dashboard

This guide walks you through building and running the AI Powered Lead Generation Dashboard from scratch. Follow the steps in order; each section explains what you’re doing and why.

---

## What you’re building

The dashboard is a **static frontend** (HTML, CSS, vanilla JavaScript). It does not use React or any framework. It:

- Lets users **sign in with Google** (via Supabase Auth).
- Shows a **dashboard** with stats, a **Generate Leads** page (filters + n8n webhook), a **Leads** table (search, pagination, export CSV, sync to HubSpot), an **AI Assistant** chat widget, and **Settings** (including Admin user/role management).
- Talks to **n8n** only via **webhooks** (POST requests). All lead generation, chatbot, and HubSpot sync logic lives in your n8n workflows; the frontend only sends data and displays responses.

You will need:

- **Node.js** (v14 or newer) – runs the Express server (`npm start`). The server reads `.env` and exposes client config at `/api/env`; the frontend (HTML, CSS, JS) is served as static files and fetches config from the server, so you don’t need a separate config file or build step.
- A **Supabase** project (for auth and optional `profiles` table).
- **Google Cloud** credentials (for “Sign in with Google”).
- (Optional) **n8n** workflows and webhook URLs for leads, chatbot, and HubSpot sync.

---

## Step 1: Get the project on your machine

1. If the project is in a Git repo, clone it:
   ```bash
   git clone <your-repo-url>
   cd leads_linked
   ```
   If you already have the folder (e.g. from a zip), just `cd` into the project root.

2. Install dependencies (Node.js required):
   ```bash
   npm install
   ```
   This installs Express and dotenv so you can run the app with `npm start`.

3. Confirm you see these files in the root:
   - `index.html`, `dashboard.html`
   - `styles.css`
   - `app.js`, `auth.js`, `leads.js`, `chatbot.js`, `utils.js`
   - `server.js` (Express backend)
   - `.env.example`
   - `package.json`

---

## Step 2: Create and fill your environment file

The **Express server** reads `.env` on startup and exposes only the client-safe variables at **`/api/env`**. The frontend fetches that JSON and sets `window.__ENV__`. So you never put secrets in the HTML or a static file; the server is the single source of truth for config.

1. **Copy the example env file**
   ```bash
   cp .env.example .env
   ```

2. **Open `.env`** in an editor and fill in each variable. Below is what each one is for and what to put in.

   - **`SUPABASE_URL`**  
     Your Supabase project URL. You get this in the Supabase dashboard: **Project Settings → API → Project URL**.  
     Example: `https://abcdefghijk.supabase.co`  
     Leave empty only if you are not using Supabase yet; the login page will show an error until this and the anon key are set.

   - **`SUPABASE_ANON_KEY`**  
     The **anon public** key from the same Supabase **API** page. It’s safe to use in the browser; it’s restricted by Row Level Security (RLS) and auth.  
     Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`  
     Never put the **service_role** key in `.env` for this app; the frontend must only use the anon key.

   - **`N8N_GENERATE_LEADS_WEBHOOK`**  
     Full URL of the n8n webhook that **generates LinkedIn-style leads**. The app will send a POST request with a JSON body like:
     `{ "industry", "country", "city", "companySize", "keywords", "jobTitle", "emailAvailable", "phoneAvailable" }`.  
     Your n8n workflow should accept this body and return a JSON array of leads (or an object with a `leads` array).  
     Example: `https://your-n8n.com/webhook/generate-leads`  
     If you leave it empty, the “Generate Leads” button will show a toast that the webhook is not configured.  
     **Step-by-step (Peakydev LinkedIn + optional Google workflow, Apify, Code nodes):** see **[N8N_LINKEDIN_GOOGLE_LEADS_WORKFLOWS.md](./N8N_LINKEDIN_GOOGLE_LEADS_WORKFLOWS.md)**.

   - **`N8N_GENERATE_GOOGLE_LEADS_WEBHOOK`**  
     Second workflow for Google/Maps (or other) lead generation when the app sends `source: "google"` (the server strips `source` before n8n).  
     Configure the same way as above; see **[N8N_LINKEDIN_GOOGLE_LEADS_WORKFLOWS.md](./N8N_LINKEDIN_GOOGLE_LEADS_WORKFLOWS.md)**.

   - **`N8N_CHATBOT_WEBHOOK`**  
     Full URL of the n8n webhook for the **AI Assistant** chat. The app sends:
     `{ "message": "user message", "conversation_id": "conv-..." }`.  
     The workflow should return JSON with a reply, e.g. `{ "reply": "..." }` (or `response` / `message` / `text`).  
     Example: `https://your-n8n.com/webhook/chatbot`  
     If empty, the chat widget will tell the user the webhook is not configured.  
     **Full n8n setup (Webhook → OpenAI → response):** see **[CHATBOT_N8N_SETUP.md](./CHATBOT_N8N_SETUP.md)**.

   - **`N8N_EXPORT_WEBHOOK`**  
     Optional. Reserved for a future “export via n8n” flow. The app currently exports CSV **in the browser** from the leads table; this variable is not required for that.

   - **`N8N_SYNC_HUBSPOT_WEBHOOK`**  
     Full URL of the n8n webhook that **sends a single lead to HubSpot**. The app sends a POST with the lead object (e.g. `companyName`, `contactName`, `email`, etc.).  
     Example: `https://your-n8n.com/webhook/sync-hubspot`  
     If empty, “Sync to HubSpot” will show a toast that the webhook is not configured.

   - **`OPENAI_API_KEY`**  
     Optional. Documented as an optional fallback; the app does not use it directly. You can leave it empty if all AI logic runs inside n8n.

3. **Save `.env`** and ensure it is not committed to Git (it’s listed in `.gitignore`).

---

## Step 3: No separate config step

You do **not** need to run `npm run config` or generate `config.js`. The Express server reads `.env` and serves the client config at **`GET /api/env`**. When you run `npm start`, the frontend requests `/api/env` and sets `window.__ENV__` from the response. If you change `.env`, restart the server (`npm start`) so it picks up the new values.

(Optional: the `npm run config` script still exists if you ever want to generate a static `config.js` for deployment without the Node server.)

---

## Step 4: Set up Supabase (auth and optional roles)

The app uses **Supabase** for authentication and, optionally, for storing user roles (Admin/Manager) in a `profiles` table.

1. **Create a Supabase project** (if you haven’t already)  
   - Go to [supabase.com](https://supabase.com), sign in, and create a new project.  
   - Note the **Project URL** and **anon public** key; these are what you put in `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`.

2. **Enable “Sign in with Google”**  
   - In **Google Cloud Console**, create OAuth 2.0 credentials (Web application), set **Authorized redirect URIs** to `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`, and copy the **Client ID** and **Client Secret**.  
   - In Supabase: **Authentication → Providers → Google** → enable and paste Client ID and Client Secret.  
   - Full step-by-step is in **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** (sections 3 and 4).

3. **Configure redirect URL for the dashboard**  
   - In Supabase: **Authentication → URL Configuration → Redirect URLs**, add the exact URL where your dashboard will load after login, e.g.:
     - Local: `http://localhost:3000/dashboard.html` (replace `3000` with the port you use).
     - Production: `https://yourdomain.com/dashboard.html`.  
   - If this doesn’t match exactly, users will be redirected to the wrong place or see an error after Google sign-in.

4. **Optional: user roles (Admin / Manager)**  
   - You can set roles in **User Metadata** in the Supabase dashboard (Authentication → Users → Edit user → add `role: "Admin"` or `"Manager"`).  
   - Or create a **`profiles`** table and use the SQL in **SUPABASE_SETUP.md** (section 5). That guide also includes RLS policies so Admins can view and update all profiles (for the Settings → Manage users UI).

After this, your `.env` should have `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The server will read them when you run `npm start`.

---

## Step 5: Run the app (Node.js / Express)

The project uses an **Express server** that serves the HTML/CSS/JS and reads `.env`. You must run it so the frontend can load config from `/api/env`.

1. From the **project root**, start the server:
   ```bash
   npm start
   ```

2. You should see:
   ```
   Server running at http://localhost:3000
   Open http://localhost:3000 in your browser.
   ```
   The default port is **3000** (or set `PORT` in `.env`).

3. Open **http://localhost:3000** in your browser. You should see the **login page** (Sign in with Google).

4. After signing in, you’ll be redirected to **`/dashboard.html`**. Add `http://localhost:3000/dashboard.html` (and your port if different) to Supabase **Redirect URLs** (Step 4).

---

## Step 6: Verify the build

1. **Login page**  
   - Open the app URL (e.g. `http://localhost:3000`).  
   - You should see “Lead Generation” and “Sign in with Google”.  
   - If you see an error about missing `SUPABASE_URL` or `SUPABASE_ANON_KEY`, run `node scripts/generate-config.js` again and ensure `.env` has those two values.

2. **Sign in and redirect**  
   - Click “Sign in with Google”, complete the Google flow.  
   - You should land on the **dashboard** (sidebar: Dashboard, Generate Leads, Leads, AI Assistant, Settings; top bar with your email and role badge).

3. **Permissions**  
   - **Manager** and **Admin** both: Generate Leads, view Leads, Export CSV, Sync to HubSpot.  
   - Only **Admin** sees the **Manage users** block on the Settings page (and only if the `profiles` table and Admin RLS policies are set up as in SUPABASE_SETUP.md).

4. **Webhooks (optional)**  
   - If n8n webhooks are configured: use **Generate Leads** with some filters and confirm the request hits your workflow; open the **AI Assistant** and send a message; use **Sync to HubSpot** on a lead and confirm the sync webhook is called.  
   - If webhooks are not set: the app will show toasts or in-chat messages that the webhook is not configured; that’s expected.

---

## Step 7: Deploying to production (overview)

- Serve the **entire project folder** (HTML, CSS, JS, and the generated `config.js`) over HTTPS.  
- Do **not** commit `.env` or `config.js`. On your deployment platform (Vercel, Netlify, etc.), set **environment variables** to the same keys as in `.env`, then run `node scripts/generate-config.js` as a **build step** and serve the resulting `config.js`, or use the platform’s way to inject env into a single `config.js` at build time.  
- In Supabase **Redirect URLs**, add your production URL, e.g. `https://yourdomain.com/dashboard.html`.  
- In Google OAuth **Authorized JavaScript origins** and redirect URIs, add your production domain.

---

## Troubleshooting

- **“Missing SUPABASE_URL or SUPABASE_ANON_KEY”**  
  Add them to `.env` and restart the server (`npm start`). Reload the page.

- **Redirect after Google login goes to wrong page or errors**  
  In Supabase **Authentication → URL Configuration**, add the **exact** URL the app runs on (including port and path), e.g. `http://localhost:3000/dashboard.html`. No trailing slash.

- **Google sign-in: “redirect_uri_mismatch”**  
  In Google Cloud Console, **APIs & Services → Credentials → your OAuth client**, set **Authorized redirect URIs** to `https://<PROJECT_REF>.supabase.co/auth/v1/callback` (replace with your Supabase project ref from the Supabase URL).

- **Manage users section empty or “No users found”**  
  You need the `profiles` table and the “Admins can view all profiles” (and update) RLS policies from **SUPABASE_SETUP.md**. Ensure your user’s role is set to **Admin** (in `profiles` or in User Metadata).

- **Generate Leads / Chat / Sync does nothing or says webhook not configured**  
  Set the corresponding URLs in `.env`, restart the server (`npm start`), and reload the app.

- **“Invalid session” or kicked back to login**  
  The server could not validate your session (cookie missing, expired, or Supabase rejected the token). Try: (1) **Log out and log in again** (clears old cookies and gets fresh tokens). (2) Use the **same URL** you used to log in (e.g. if you logged in at `http://localhost:3000`, don’t open `http://127.0.0.1:3000`—cookies are per-origin). (3) If behind a **proxy/HTTPS**, ensure the server sees the correct protocol (`x-forwarded-proto: https`) so cookie options match. (4) Check **Supabase** is reachable and `SUPABASE_URL` / `SUPABASE_ANON_KEY` in `.env` are correct; restart the server after changing `.env`.

- **Session dies after only a few minutes**  
  Usually the **access token** has expired and **refresh** failed. Fix: (1) **Supabase Dashboard** → **Authentication** → **Settings** (or **Project Settings** → **Auth**). Find **JWT expiry** (or “Access token expiry”). Set it to **3600** (1 hour) or **86400** (1 day). Supabase default is 3600; if it was lowered (e.g. 300 = 5 min), the session will die quickly. (2) Ensure the **refresh token** is stored: log in, then in DevTools → Application → Cookies, check that both `leads_sid` and `leads_refresh` exist for your site. If `leads_refresh` is missing, the server cannot refresh when the access token expires—check that login response sets both cookies (no proxy stripping `Set-Cookie`). (3) The server now refreshes tokens **earlier** (when &lt; 50 min left) and **every request that shared a refresh gets the new cookies** (fix for “invalid session” when multiple tabs or requests hit at once). (4) In Supabase → **Authentication** → **Refresh Tokens**, try increasing **Refresh token reuse interval** from 10 to **30 seconds** so the same token can be reused briefly if two requests race. Restart the server after any `.env` or Supabase change.

---

## Summary checklist

- [ ] Project files present (e.g. cloned or unzipped).  
- [ ] `npm install` run (Node.js required).  
- [ ] `.env` created from `.env.example` and all required variables filled (at least `SUPABASE_URL`, `SUPABASE_ANON_KEY`).  
- [ ] Supabase project created; Google provider enabled; Redirect URL for the dashboard added.  
- [ ] `npm start` run (Express server); app opened at `http://localhost:3000`; Google sign-in works and redirects to dashboard.  
- [ ] (Optional) n8n webhooks set in `.env`; roles and `profiles` set up as in SUPABASE_SETUP.md for Admin/Manager and Manage users.

For more detail on Supabase (Google OAuth, redirect URLs, `profiles`, RLS), use **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**.
