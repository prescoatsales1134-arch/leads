# 100-lead one-time free trial (NEW signups only)

This is a small, additive feature. **It does not change Manage Users, the admin endpoints, the pricing UI structure, or any other behaviour.**

## What it does

- **New** signups going forward → get **100** lifetime free leads (no monthly reset).
- Once they save 100 leads in `user_leads`, no more new generation/saving until you set a paid monthly limit (or they upgrade).
- **Existing users** → no behaviour change. Their row in `profiles` gets a new column with **`trial_lifetime_limit = 0`**, which means the new logic ignores them and they keep working **exactly** as before.

## How the limit logic decides (in `getLeadLimitAndUsage`)

| `lead_generation_limit` | `trial_lifetime_limit` | Behaviour |
|------|------|------|
| `null` | (any) | **unlimited** (informational monthly count) |
| `> 0` | (any) | **monthly paid plan** (existing behaviour) |
| `0` | `> 0` | **trial** — all-time count, capped at the trial number |
| `0` | `0` | **blocked** (existing behaviour) |

The trial column is read with a defensive `select`. If for any reason the column does not exist on the database, the server **falls back to old behaviour** instead of failing.

## Steps to deploy

1. **Supabase → SQL Editor** → paste and run **`scripts/supabase-trial-lifetime-migration.sql`**.
2. `git pull` on the server, then **restart** the Node app (e.g. `pm2 restart leads-linked`).
3. (Optional) sign in with a fresh test account; in Supabase **Table editor → profiles** confirm that account has `trial_lifetime_limit = 100` and `lead_generation_limit = 0`. The header on the Leads page shows “Free trial: …”.

## What was deliberately NOT touched

- `/api/profiles` SELECT (used by Manage Users) — unchanged.
- `app.js` Manage Users code — unchanged.
- Manage Users HTML — unchanged.
- Auth, n8n, sync, exports — unchanged.

## Rollback

- App: `git revert` of the trial commit.
- DB (optional): replace `handle_new_user` with the older version (no `trial_lifetime_limit`) and `alter table public.profiles drop column if exists trial_lifetime_limit;`.
