# One-time 100 free leads (for new signups) — full setup in simple terms

This page explains **what** you are adding, **why** it does not work with “only a number in the database” by itself, and **exactly** what to click and run. The app code in this repo is already built to read the new field; you only need Supabase + deploy.

---

## 1. The story in one paragraph

- Every **person** has a row in **`profiles`** in Supabase. That row says how many **paid** leads per month they have (`lead_generation_limit`) and, separately, how many **one-time free** leads they are allowed in total (`trial_lifetime_limit`).
- **Before this feature:** new users often had **0** paid leads until an admin changed it. They could not try the product.
- **After this feature:** **brand-new** signups get **100** in the one-time field. The server counts **all** saved leads in `user_leads` **forever** (not per month) until that number hits 100. Then they need a **plan** (you set a **monthly** number) or they stay at 0 new leads. **Old accounts** you already have in the database get **0** one-time trial so nothing changes for them.
- The **Leads** tab only **stores** what they already saved. We **never** delete that list when the trial runs out; we only **stop new generation/saving** when the rules say so.

---

## 2. Words you will see (small glossary)

| Word | Baby explanation |
|------|-------------------|
| **Supabase** | Your **database + login** in the cloud. |
| **SQL Editor** | A place in Supabase where you paste a script and click **Run**. |
| **profiles** | One row per user: email, role, limits, etc. |
| **user_leads** | The saved leads you show on the **Leads** tab. |
| **Trigger / `handle_new_user`** | A small rule: “when a new person signs up, create their **profiles** row with these default numbers.” |
| **Deploy** | Upload the new `server.js` (and the rest of the app) to your real server so the new rules run in production. |

---

## 3. How the app decides: paid vs free trial vs blocked

The server (file `server.js`) does this in order:

1. If **`lead_generation_limit`** is **empty / null** → that user is **unlimited** (as today; usually an admin special case). Monthly usage is just for display.
2. Else if **`lead_generation_limit`** is a **positive** number (e.g. 500) → **paid** plan: the cap is **per calendar month** (count only rows in `user_leads` from the **1st of this month** in UTC).
3. Else if **`lead_generation_limit`** is **0** and **`trial_lifetime_limit`** is **greater than 0** (e.g. 100) → **free trial**: the cap is **all-time** (count **every** lead row they ever saved). **No** monthly reset. When they reach 100, no more new leads until you set a paid monthly limit.
4. Else (**0** paid and **0** one-time) → **blocked** for *new* leads until an admin or plan gives them a limit.

**Saving** leads and **generating** leads both use the same rules.

---

## 4. What to do in Supabase (for an existing project)

Do this **once** per project (production when you are ready to turn the feature on).

1. Open your project: **Supabase Dashboard** → your project.
2. Go to **SQL Editor** → **New query**.
3. Open the file in this repo:  
   `scripts/supabase-trial-lifetime-migration.sql`
4. **Copy the whole file**, paste it into the SQL editor, and click **Run** (or **Run selected** for the whole script).

**What the script does:**

- Adds column **`trial_lifetime_limit`** (if missing) with default **0**.
- Fills **0** for all **existing** rows (so **old users do not get 100** automatically).
- Replaces **`handle_new_user`** so **new** signups get **`trial_lifetime_limit = 100`** and **`lead_generation_limit = 0`** (no paid cap until you set it).

**If the trigger name is different** in your project, you only need a trigger on `auth.users` that calls `handle_new_user` — the migration does not rename triggers.

**Order matters:** run this **after** the `profiles` table exists. If you are creating a **new** project from scratch, you can use **Query 1** in `SUPABASE_NEW_PROJECT_QUERIES.md` (it now includes the trial column) **instead** of running a separate add-column step.

---

## 5. What to do on your app server (hosting)

1. **Deploy** the current code from this repository (at least `server.js`, `leads.js`, `app.js`, `dashboard.html` after this feature is merged).
2. **Restart** the Node process (PM2, systemd, or whatever you use) so the new `server.js` is loaded.
3. No new environment variables are **required** for the trial. Supabase already connects with your existing keys.

If you do **not** deploy the new server, the new column in Supabase may cause **select** errors (missing column) or the old code will **ignore** the trial. So: **DB migration + app deploy** go together.

---

## 6. What the customer sees (behaviour you asked for)

| Situation | What they get |
|----------|----------------|
| **New** user, first time | They can save/generate up to **100** leads in total. The header shows “Free trial: X / 100…”. |
| They used 100, still not paid | **0** new leads. Message points them to **Pricing** or admin. **Leads** tab still shows what they **already** saved. |
| You (admin) set **monthly** limit (e.g. 500) in **Settings → Manage users** | They are on **monthly** limits; the one-time 100 is no longer the rule (paid path uses **month** counts from now on for that check). |
| **Existing** user before you ran the migration with default 0 for old rows | **0** one-time; same as “needs admin or plan” unless you manually set `trial_lifetime_limit` in SQL. |

**Admin screen:** a read-only **Trial cap** column shows `100` / `0` for visibility. **Monthly** limit is still the input you already had.

---

## 7. Optional: give one specific old user a trial (advanced)

In **SQL Editor** (rare, support case only):

```sql
update public.profiles
set trial_lifetime_limit = 100, lead_generation_limit = 0
where email = 'their@email.com';
```

They are still bounded by how many leads **already** exist in `user_leads` (all-time count for trial).

---

## 8. Checklist (copy and tick)

- [ ] Supabase: ran `scripts/supabase-trial-lifetime-migration.sql` on the **right** project (e.g. production).
- [ ] **Verified** a test signup has **`trial_lifetime_limit = 100`** and **`lead_generation_limit = 0`** in **Table editor → profiles** (or with a quick `select`).
- [ ] **Deployed** and **restarted** the app with the new code.
- [ ] Logged in as a test user, confirmed the banner shows **free trial** and counts toward **100** all-time, not per month.
- [ ] (Optional) Confirmed an **old** test account still has **0** one-time (or 0 in column after migration only).

If anything fails, read the error from **Supabase** (for SQL) or your **server logs** (for Node) — often it is “column not found” (run migration first) or old server still running (redeploy + restart).
