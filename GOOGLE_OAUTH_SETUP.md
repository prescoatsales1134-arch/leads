# What to do in Google for Supabase “Sign in with Google”

You use **Google Cloud Console** (not Google Workspace admin) to create OAuth credentials. Supabase then uses those credentials for “Sign in with Google.”

---

## 1. Open Google Cloud Console

- Go to **[console.cloud.google.com](https://console.cloud.google.com/)** and sign in with your Google account.

---

## 2. Create or select a project

- Top bar: click the **project** dropdown.
- Either **create a new project** (e.g. “Lead Gen Dashboard”) or **select an existing one**.

---

## 3. Configure the OAuth consent screen (if prompted)

When you create OAuth credentials for the first time, Google may ask you to set up the consent screen:

1. Go to **APIs & Services** → **OAuth consent screen** (left menu).
2. **User type:**
   - **External** – anyone with a Google account can sign in (typical for a public app).
   - **Internal** – only users in your Google Workspace org (if you use Workspace and want to restrict sign-in).
3. **App name:** e.g. **Lead Gen Dashboard** (or your app name).
4. **User support email:** your email.
5. **Developer contact:** your email.
6. Save (and continue through any optional steps like scopes; default scopes are usually enough).

---

## 4. Create OAuth client credentials

1. Go to **APIs & Services** → **Credentials**.
2. Click **+ Create credentials** → **OAuth client ID**.
3. **Application type:** **Web application**.
4. **Name:** e.g. **Lead Gen Web** (any name you like).
5. **Authorized JavaScript origins**  
   Add the origins where your app runs (no trailing slash):
   - Local: `http://localhost:3001` (and `http://127.0.0.1:3001` if you use it).
   - Production: `https://yourdomain.com`
6. **Authorized redirect URIs**  
   Add **exactly** this URL (replace `YOUR_SUPABASE_PROJECT_REF` with the ref from your Supabase URL `https://YOUR_SUPABASE_PROJECT_REF.supabase.co`):
   ```
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   Example: if your Supabase URL is `https://hblpuzzlblkbzfdblfte.supabase.co`, then:
   ```
   https://hblpuzzlblkbzfdblfte.supabase.co/auth/v1/callback
   ```
7. Click **Create**.
8. Copy the **Client ID** and **Client Secret** (you’ll paste these into Supabase).

---

## 5. Put the credentials in Supabase

1. In **Supabase**: **Authentication** → **Providers**.
2. Find **Google** and turn it **ON**.
3. Paste:
   - **Client ID** (from Google).
   - **Client Secret** (from Google).
4. Save.

---

## 6. Redirect URL in Supabase (your app callback)

So that after Google sign-in users land back on your app:

1. In **Supabase**: **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add your app’s auth callback URL, e.g.:
   - Local: `http://localhost:3001/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`
3. **Site URL** can be your main app URL (e.g. `http://localhost:3001` or `https://yourdomain.com`).
4. Save.

---

## Summary

| Where | What you do |
|-------|-------------|
| **Google Cloud Console** | Create a project → OAuth consent screen (if needed) → Credentials → OAuth client ID (Web app) → set **Authorized JavaScript origins** (e.g. `http://localhost:3001`) and **Authorized redirect URIs** (`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) → copy Client ID and Client Secret. |
| **Supabase** | Auth → Providers → Google ON → paste Client ID and Client Secret. Auth → URL Configuration → add your app redirect URL (e.g. `http://localhost:3001/auth/callback`). |

---

## Common errors

- **redirect_uri_mismatch**  
  In Google, **Authorized redirect URIs** must contain **exactly**:  
  `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`  
  (Supabase project ref = the part before `.supabase.co` in your Supabase URL.)

- **Blocked or wrong origin**  
  In Google, **Authorized JavaScript origins** must include the origin where the app runs (e.g. `http://localhost:3001` or `https://yourdomain.com`), no trailing slash.

- **Redirect after login goes to wrong page**  
  In Supabase **Redirect URLs**, add the exact URL your app uses for the callback (e.g. `http://localhost:3001/auth/callback`). Your app sends this in the auth flow; it must match what you added.
