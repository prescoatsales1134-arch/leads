#!/usr/bin/env node
/**
 * Regenerate data/peakydev-industries-raw.txt from a saved Apify input-schema HTML dump.
 * Usage:
 *   curl -s 'https://apify.com/peakydev/leads-scraper-ppe/input-schema' -o /tmp/peaky.html
 *   node scripts/extract-industries-from-apify-html.mjs /tmp/peaky.html
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'data', 'peakydev-industries-raw.txt');

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/extract-industries-from-apify-html.mjs <apify-input-schema.html>');
  process.exit(1);
}

const t = fs.readFileSync(src, 'utf8');
const lines = t.split('\n');
const industries = [];
let capturing = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('"Chemical Raw Materials Manufacturing"') && i > 9000 && i < 9600) capturing = true;
  if (capturing) {
    const m = line.match(/^\s*"((?:\\"|[^"])*)",?\s*$/);
    if (m) {
      try {
        industries.push(JSON.parse('"' + m[1].replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'));
      } catch {
        industries.push(m[1].replace(/\\"/g, '"'));
      }
    }
    if (line.includes('"Household and Institutional Furniture Manufacturing"') && i > 9520) break;
  }
}

if (industries.length < 100) {
  console.error('Extracted too few industries (' + industries.length + '). Check the HTML file / markers.');
  process.exit(1);
}

fs.writeFileSync(outPath, industries.join('\n'));
console.log('Wrote', industries.length, 'lines to', outPath);
