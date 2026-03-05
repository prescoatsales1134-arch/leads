#!/usr/bin/env node
/**
 * Reads .env and writes config.js for the browser.
 * Run: node scripts/generate-config.js
 * Never commit config.js (it's in .gitignore).
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const outPath = path.join(__dirname, '..', 'config.js');

if (!fs.existsSync(envPath)) {
  console.warn('.env not found. Create it from .env.example');
  process.exit(1);
}

const env = {};
const content = fs.readFileSync(envPath, 'utf8');
content.split('\n').forEach((line) => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const vars = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'N8N_GENERATE_LEADS_WEBHOOK', 'N8N_CHATBOT_WEBHOOK',
  'N8N_SYNC_HUBSPOT_WEBHOOK',
  'OPENAI_API_KEY'
];

const out = `// Generated from .env - do not edit manually
window.__ENV__ = ${JSON.stringify(
  vars.reduce((acc, k) => { acc[k] = env[k] || ''; return acc; }, {}),
  null,
  2
)};
`;

fs.writeFileSync(outPath, out);

// Update HTML files so browser bypasses cache and loads fresh config
const version = Date.now().toString();
const indexPath = path.join(__dirname, '..', 'index.html');
const dashboardPath = path.join(__dirname, '..', 'dashboard.html');
function updateConfigSrc(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/src="config\.js([^"]*)"/g, 'src="config.js?v=' + version + '"');
  fs.writeFileSync(filePath, html);
}
updateConfigSrc(indexPath);
updateConfigSrc(dashboardPath);

console.log('config.js written from .env (cache-bust version:', version + ')');
