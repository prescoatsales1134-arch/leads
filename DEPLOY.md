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

### `.env` on the VPS

**`.env` is not in Git** (secrets stay on the server). After `git pull`, if the repo added new settings:

1. Open **`.env.example`** on the server (it updates with `git pull`) and see if there are new variables.
2. Edit the live file: `nano .env` (or `vim .env`) and add or change those keys. Do not commit `.env`.
3. Restart the app so Node reloads env: `pm2 restart leads-linked`.

If you only changed `.env` and not the code, you can skip `git pull` and just run `pm2 restart leads-linked`.

Replace `"Your commit message"` with a short description of your changes.
