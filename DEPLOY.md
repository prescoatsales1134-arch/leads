# Deploy commands

## Résumé builder (`resume-dist/`)

**`resume-dist/resume-builder.js`** and **`resume-builder.css`** are **tracked in Git** so production loads the builder without an extra build step. Whenever you change **`resume-app/`**, run from the repo root:

```bash
npm run build:resume
```

Then commit the updated **`resume-dist/`** files and push.

### Troubleshooting: “Résumé UI not loaded” on the dashboard

1. **SSH into the VPS**, `cd` to the app folder (same level as `server.js`), run: **`ls -la resume-dist/resume-builder.js`**.  
   - **No such file** → run **`git pull origin main`**, then **`ls`** again. If still missing, run **`npm run build:resume`** (needs Node on the server), then **`pm2 restart leads-linked`**.
2. In your browser, open **`https://YOUR_DOMAIN/resume-dist/resume-builder.js`**. You should download or see a large JS file, **not** a 404 HTML page. If 404, the deployed folder doesn’t contain `resume-dist/` or Nginx is serving a different docroot.
3. Hard-refresh the dashboard (**Ctrl+Shift+R** / **Cmd+Shift+R**) after the file exists.

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
- If **`resume-dist/`** is missing after `git pull` (or you only edited **`resume-app/`** on the server), run **`npm run build:resume`** once in that directory, then restart PM2.
- **`pm2 save`** persists the process list after reboot (you only need it when you change which apps PM2 runs, not necessarily every deploy).

### `.env` on the VPS

**`.env` is not in Git** (secrets stay on the server). After `git pull`, if the repo added new settings:

1. Open **`.env.example`** on the server (it updates with `git pull`) and see if there are new variables.
2. Edit the live file: `nano .env` (or `vim .env`) and add or change those keys. Do not commit `.env`.
3. Restart the app so Node reloads env: `pm2 restart leads-linked`.

If you only changed `.env` and not the code, you can skip `git pull` and just run `pm2 restart leads-linked`.

Replace `"Your commit message"` with a short description of your changes.
