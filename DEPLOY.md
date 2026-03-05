# Deploy Leads Linked Dashboard on Hostinger VPS

Complete setup to run the app on a Hostinger VPS with your own domain and HTTPS.

---

## What you need

- **Hostinger VPS** (SSH access, root or sudo user)
- **Domain** (e.g. `leads.yourdomain.com` or `yourdomain.com`)
- **Supabase project** (already set up)
- **Node.js** 18+ on the VPS

---

## 1. Point your domain to the VPS

1. In **Hostinger** (hPanel): open your VPS and note the **IP address**.
2. Where your domain is managed (Hostinger Domains or elsewhere):
   - Add an **A record**:  
     - **Name:** `@` (root) or subdomain like `leads`  
     - **Value:** your VPS IP  
     - **TTL:** 300 or default  
   - If you use a subdomain (e.g. `leads.yourdomain.com`), add another A record:  
     - **Name:** `leads`  
     - **Value:** same VPS IP  

Wait 5–30 minutes for DNS to propagate. Check with:

```bash
ping leads.yourdomain.com
# or
ping yourdomain.com
```

Use the hostname you’ll use in the browser (e.g. `https://leads.yourdomain.com`) for the rest of the steps.

---

## 2. Connect to your VPS

From your computer:

```bash
ssh root@YOUR_VPS_IP
# Or, if you use a user:
# ssh youruser@YOUR_VPS_IP
```

Replace `YOUR_VPS_IP` with the VPS IP from Hostinger.

---

## 3. Install Node.js (Ubuntu/Debian)

On the VPS:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS (recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Check
node -v   # v20.x.x
npm -v
```

---

## 4. Install Nginx and PM2

- **Nginx:** reverse proxy and SSL (HTTPS).
- **PM2:** keeps the Node app running and restarts it if it crashes.

```bash
sudo apt install -y nginx
sudo npm install -g pm2
```

---

## 5. Deploy the app on the VPS

### Option A: Deploy with Git (recommended)

```bash
# Create app directory
sudo mkdir -p /var/www/leads-linked
sudo chown $USER:$USER /var/www/leads-linked
cd /var/www/leads-linked

# Clone your repo (replace with your repo URL)
git clone https://github.com/YOUR_USERNAME/leads_linked.git .

# Or if you use SSH:
# git clone git@github.com:YOUR_USERNAME/leads_linked.git .
```

If the project is not in Git yet, push it to GitHub/GitLab first, then clone as above.

### Option B: Upload with SCP/SFTP

From your **local machine** (in the project folder):

```bash
scp -r /Users/unjilaarif/Documents/leads_linked/* youruser@YOUR_VPS_IP:/var/www/leads-linked/
```

Do **not** upload `node_modules` or `.env` (create `.env` on the server in the next step).

---

## 6. Install dependencies and create `.env` on the server

On the VPS:

```bash
cd /var/www/leads-linked

# Install production dependencies
npm install --omit=dev

# Create .env (use nano or vim)
nano .env
```

Paste your production environment variables. Example (replace with your real values):

```env
PORT=3000
NODE_ENV=production

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Optional: n8n webhooks (can add later)
N8N_GENERATE_LEADS_WEBHOOK=
N8N_CHATBOT_WEBHOOK=
N8N_SYNC_HUBSPOT_WEBHOOK=
N8N_MESSAGE_ASSISTANT_WEBHOOK=
```

Save and exit (`Ctrl+O`, Enter, `Ctrl+X` in nano).

**Important:** Use the same Supabase project as in development, or update Supabase URL/keys if you use a different project.

---

## 7. Supabase: add production redirect URL

1. Open **Supabase Dashboard** → your project → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add:
   - `https://leads.yourdomain.com/auth/callback`  
   (or `https://yourdomain.com/auth/callback` if you use root domain.)
3. Set **Site URL** to: `https://leads.yourdomain.com` (or your real URL).
4. Save.

Without this, Google sign-in will fail in production.

---

## 8. Run the app with PM2

On the VPS:

```bash
cd /var/www/leads-linked

# Start the app
pm2 start server.js --name "leads-linked"

# Make it start on server reboot
pm2 startup
# Run the command it prints (e.g. sudo env PATH=... pm2 startup systemd -u youruser --hp /home/youruser)
pm2 save

# Check status
pm2 status
pm2 logs leads-linked
```

The app will listen on `PORT` (e.g. 3000) locally. Nginx will forward traffic from port 80/443 to it.

---

## 9. Configure Nginx (reverse proxy + SSL)

Replace `leads.yourdomain.com` with your actual domain in all steps.

### 9.1 Create Nginx site config

```bash
sudo nano /etc/nginx/sites-available/leads-linked
```

Paste (replace `leads.yourdomain.com` with your domain):

```nginx
server {
    listen 80;
    server_name leads.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save and exit.

### 9.2 Enable the site and test

```bash
sudo ln -s /etc/nginx/sites-available/leads-linked /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

You should be able to open `http://leads.yourdomain.com` (HTTP only for now).

### 9.3 Add SSL with Let’s Encrypt (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d leads.yourdomain.com
```

Follow the prompts (email, agree to terms). Certbot will update Nginx to use HTTPS and set up auto-renewal.

Test:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Then open **https://leads.yourdomain.com** and sign in with Google.

---

## 10. Firewall (optional but recommended)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 11. Updating the app later

If you deployed with Git:

```bash
cd /var/www/leads-linked
git pull
npm install --omit=dev
pm2 restart leads-linked
```

If you use SCP, upload changed files and run `npm install` and `pm2 restart leads-linked` on the server.

---

## Checklist

| Step | Done |
|------|------|
| Domain A record points to VPS IP | |
| Node.js 20 + Nginx + PM2 installed | |
| App in `/var/www/leads-linked` | |
| `.env` created with Supabase (and optional n8n) keys | |
| Supabase redirect URL = `https://YOUR_DOMAIN/auth/callback` | |
| PM2 running `server.js` and saved (`pm2 save`) | |
| Nginx proxy to `127.0.0.1:3000` | |
| SSL with Certbot for your domain | |
| UFW firewall (optional) | |

---

## Troubleshooting

- **502 Bad Gateway:** App not running or wrong port. Check `pm2 status` and `pm2 logs leads-linked`. Ensure `PORT` in `.env` matches the port in Nginx `proxy_pass` (e.g. 3000).
- **Google sign-in fails:** Confirm Supabase redirect URL and Site URL use `https://` and your exact domain.
- **Cookies not working:** Server already uses `X-Forwarded-Proto`; if you use another proxy in front, ensure it forwards that header.
- **Can’t connect via SSH:** In Hostinger VPS panel, check that SSH is enabled and you’re using the correct IP and user (root or the one you created).

If you tell me your exact domain (e.g. `leads.example.com`) and whether you use root or a subdomain, I can adapt the Nginx and Supabase steps to it.
