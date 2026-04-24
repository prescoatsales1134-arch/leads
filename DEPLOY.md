# Deploy commands

## On your Mac (push to GitHub)

```bash
cd /Users/unjilaarif/Documents/leads_linked
git add -A
git commit -m "Your commit message"
git push
```

## On the VPS (pull and restart)

Run these **in order**: pull code, install deps if needed, then restart PM2.

```bash
cd /var/www/leads-linked
git pull origin main
npm install
pm2 restart leads-linked
pm2 save
```

- Use your real app path if it is not `/var/www/leads-linked`.
- **`pm2 save`** persists the process list after reboot (you only need it when you change which apps PM2 runs, not necessarily every deploy).

**One-time free trial (100 leads for new signups):** In Supabase **SQL Editor**, run `scripts/supabase-trial-lifetime-migration.sql`, then deploy and **restart** PM2 on the server so the app matches the new `profiles.trial_lifetime_limit` column. Details: **TRIAL_FREE_SETUP.md**.

### Generate leads: empty table after 2–5 minutes (LinkedIn & Google)

**What is going wrong (not your dashboard code):**  
The browser calls **`POST /api/generate-leads`** and waits until **n8n** finishes Apify and **`Respond to Webhook`** returns the JSON. With **100+** results, Apify often runs **several minutes**. Something in front of your Node app (almost always **Nginx** on a VPS, or **Cloudflare** in front of the domain) **closes that waiting connection** after a short default (often **60 seconds**). The run can still finish in n8n/Apify, but the **browser never gets the body**, so the generated-leads table stays empty. Smaller limits finish under that limit, so they look fine.

**Fix without changing the app or n8n workflow:** raise timeouts on the **path the browser uses to reach Node** (same behavior, longer allowed wait).

1. **Open a shell on the Hostinger VPS** — same steps whether you use **hPanel → VPS → SSH / Browser terminal / Web terminal** or `ssh user@YOUR_SERVER_IP` from your own machine.

2. **Find the exact config file** (Hostinger does not use one global name; it is the file that contains your domain and `proxy_pass` to Node).

   **See which layout your VPS uses:**

   ```bash
   ls -la /etc/nginx/sites-enabled/ 2>/dev/null
   ls -la /etc/nginx/conf.d/ 2>/dev/null
   ```

   - **Ubuntu / Debian** templates: active sites are usually **symlinks** in  
     **`/etc/nginx/sites-enabled/`** → real files in **`/etc/nginx/sites-available/`**.  
     Example real path: **`/etc/nginx/sites-available/yourdomain.com`**
   - **AlmaLinux / Rocky / CentOS** style: site snippets are often **`/etc/nginx/conf.d/*.conf`**

   **Search by your domain** (replace `yourdomain.com` with the site users open in the browser):

   ```bash
   sudo grep -r "server_name" /etc/nginx/ 2>/dev/null | grep -i yourdomain
   ```

   **Search for the reverse proxy to Node** (common ports `3000`, `8080`):

   ```bash
   sudo grep -r "proxy_pass" /etc/nginx/ 2>/dev/null
   ```

   The path printed on the left (before the colon) is the file you edit, e.g.  
   `/etc/nginx/sites-available/mydomain.com:    proxy_pass http://127.0.0.1:3000;`

   **See what Nginx loads first** (optional):

   ```bash
   sudo nginx -T 2>/dev/null | head -n 80
   ```

   The top of that output lists `include` paths; your site block will appear again when you scroll or filter:

   ```bash
   sudo nginx -T 2>/dev/null | grep -n "server_name\|proxy_pass" | head -n 40
   ```

3. **Edit that one file** with root, e.g.  
   `sudo nano /etc/nginx/sites-available/YOUR_FILE`  
   **Inside the `server { }` that serves your app** (same block that has `proxy_pass` to Node), put the timeout lines **inside** the `location / { ... }` that does `proxy_pass`, **or** just inside that `server { }` above `location` blocks so they apply to all locations. Example placement inside `location /`:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    send_timeout 600s;
}
```

   (Adjust `proxy_pass` URL/port to match what you already have; only add the four `proxy_*` / `send_timeout` lines if they are missing.)

4. **Test config and reload:**

```bash
sudo nginx -t && sudo systemctl reload nginx
```

5. **Retry** Generate with **100** results. No code deploy is required if only Nginx changed.

**Cloudflare (domain orange-cloud / “Proxied”):** Many plans cap proxied HTTP responses around **100 seconds**. Nginx alone cannot bypass that. If your site uses Cloudflare on that hostname, either set the record to **DNS only** (grey cloud) for the app subdomain, or accept that **very long** single requests may still fail until you use a different DNS path. That is a DNS/dashboard toggle, not a code change.

**If you do not have Nginx/SSH** (shared web hosting only): you may not be able to raise this limit; use a **VPS** or a host that lets you configure reverse-proxy timeouts for Node.

### `.env` on the VPS

**`.env` is not in Git** (secrets stay on the server). After `git pull`, if the repo added new settings:

1. Open **`.env.example`** on the server (it updates with `git pull`) and see if there are new variables.
2. Edit the live file: `nano .env` (or `vim .env`) and add or change those keys. Do not commit `.env`.
3. Restart the app so Node reloads env: `pm2 restart leads-linked`.

If you only changed `.env` and not the code, you can skip `git pull` and just run `pm2 restart leads-linked`.

Replace `"Your commit message"` with a short description of your changes.
