# Where auth emails come from and how to use your domain

Auth emails = signup confirmation, password reset, magic link, etc. They are sent by **Supabase Auth**, not by your app code.

---

## Default (no custom SMTP)

- **Who sends:** Supabase’s built-in email service.
- **From address:** Supabase’s default (e.g. noreply / no-reply from Supabase).
- **Limitation:** Supabase only sends to **pre-authorized** addresses (your project’s team members in the Supabase org). Other addresses get “Email address not authorized.” So for normal users you need **custom SMTP**.

So by default, users do **not** get emails from “your” address; they come from Supabase. To have emails from your **official domain** (or your personal address), you set up **custom SMTP** below.

---

## Use your official domain (or your email) as sender

To have the “From” be your domain (e.g. `noreply@yourcompany.com`) or even your personal email:

1. **Pick an SMTP provider** (one of):
   - **Resend**, **SendGrid**, **Brevo**, **Postmark**, **AWS SES** – use a verified domain and their SMTP settings, or  
   - **Google Workspace** – if your domain email is on Google (e.g. `you@yourcompany.com`), use Gmail/Workspace SMTP (see below).

2. **In Supabase:**  
   - Open your project → **Authentication** → **SMTP**  
   - Or: **Project Settings** → **Authentication** → section **SMTP / Custom SMTP**.

3. **Enable custom SMTP** and set:
   - **Sender email (From):** e.g. `noreply@yourdomain.com` or `auth@yourdomain.com`.  
     You can use your personal address (e.g. `yourname@gmail.com`) if you prefer; the important part is that this is the address users see as the sender.
   - **Sender name:** e.g. `Lead AI` or `Your Company Name` (this is the name shown next to the address).
   - **SMTP host, port, user, password:** from your provider (see examples below).

4. Save. After that, **all auth emails** (confirm signup, reset password, etc.) are sent through your SMTP with that From address and name.

---

## Example: Google Workspace (or Gmail) as SMTP

If your “official” email is on **Google Workspace** (e.g. `you@yourcompany.com`) or you’re fine using **Gmail**:

1. **Google Admin / Google Account:**  
   - For **Gmail:** turn on “Allow less secure app access” is deprecated; use an **App Password**: Google Account → Security → 2-Step Verification → App passwords → generate one for “Mail”.  
   - For **Workspace:** admin may need to allow “Less secure apps” or use App Passwords if 2FA is on.

2. **SMTP settings to put in Supabase:**
   - **Host:** `smtp.gmail.com`
   - **Port:** `587` (TLS)
   - **User:** your full email (e.g. `you@yourcompany.com` or `yourname@gmail.com`)
   - **Password:** your normal password **or** an **App Password** (recommended if you use 2FA)
   - **Sender email:** same as User (e.g. `you@yourcompany.com`) or a no-reply alias if you have one
   - **Sender name:** e.g. `Lead AI` or your company name

Then users will see emails **from** that address and name. The “email address can be mine personal” works: you can use your personal Gmail as the SMTP user and as the From address if you want.

---

## Example: Resend / SendGrid / Brevo (your domain)

1. Sign up and **verify your domain** (e.g. `yourdomain.com`) in the provider’s dashboard (they’ll ask for DNS records like SPF/DKIM).
2. Create an API key or SMTP credentials in the provider.
3. In Supabase SMTP set:
   - **Sender email:** `noreply@yourdomain.com` (or whatever the provider allows for your domain).
   - **Sender name:** e.g. `Lead AI`.
   - **Host / port / user / pass:** from the provider’s SMTP docs.

---

## Summary

| Question | Answer |
|----------|--------|
| Through which email do users get auth emails by default? | From **Supabase’s** default sender (and only to pre-authorized team emails unless you change it). |
| How do I change it to my official domain or my email? | Use **Custom SMTP** in Supabase: **Authentication** → **SMTP**. Set sender email (and name) and your provider’s SMTP host/port/user/password. |
| Can the sender be my personal email? | Yes. Use that address as the SMTP user and as the “From” in Supabase; e.g. with Gmail/Workspace SMTP. |

No code changes are needed in your app; only Supabase SMTP configuration.
