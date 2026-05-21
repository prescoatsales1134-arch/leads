/**
 * OpenAI prompts for résumé copy assist (summary, experience, bullets).
 * Server-only — never sent to the browser.
 */

'use strict';

var CAREER_FOCUS_IDS = [
  'general',
  'b2b_sales',
  'retail_sales',
  'account_management',
  'saas_sales',
  'field_sales',
  'caribbean',
  'international_remote'
];

var FOCUS_LABELS = {
  general: 'General professional',
  b2b_sales: 'B2B sales',
  retail_sales: 'Retail sales',
  account_management: 'Account management',
  saas_sales: 'SaaS sales',
  field_sales: 'Field sales',
  caribbean: 'Caribbean opportunities',
  international_remote: 'International remote roles'
};

var FOCUS_GUIDANCE = {
  general:
    'Use clear, confident professional language suitable for ATS parsing. Emphasize outcomes, scope, and transferable skills.',
  b2b_sales:
    'Highlight pipeline generation, quota attainment, enterprise/corporate deals, CRM discipline, discovery calls, proposals, and revenue impact. Use metrics only if the user provided them.',
  retail_sales:
    'Highlight customer service, upselling, conversion, store/KPI targets, product knowledge, merchandising support, and team collaboration on the floor.',
  account_management:
    'Highlight retention, expansion, QBRs, stakeholder relationships, renewals, cross-sell/upsell, and customer success outcomes.',
  saas_sales:
    'Highlight ARR/MRR where given, demos, trials, PLG or outbound motion, churn reduction, implementation handoffs, and tech stack familiarity (CRM, sales engagement).',
  field_sales:
    'Highlight territory coverage, in-person visits, route planning, channel/partner relationships, and on-site customer relationships.',
  caribbean:
    'Use professional English suited to Caribbean employers and regional hubs (TT, Barbados, Jamaica, etc.). Reference regional market knowledge only if the user mentioned it. Keep tone practical and results-oriented.',
  international_remote:
    'Emphasize remote collaboration, async communication, time-zone flexibility, self-management, and global client/stakeholder experience. Avoid location-specific claims unless provided.'
};

var SYSTEM_PROMPT =
  'You are an expert résumé writer for sales and commercial careers. Your job is to rewrite draft text so it is specific, professional, and ATS-friendly.\n\n' +
  'Rules:\n' +
  '- Preserve every fact the user gave. Do NOT invent employers, titles, numbers, tools, or achievements.\n' +
  '- If the draft is vague, make it sharper using only reasonable inference from role context (job title, company) — never fabricate metrics.\n' +
  '- Use strong action verbs, concise sentences, and plain language (no buzzword soup).\n' +
  '- Output ONLY the improved text — no preamble, labels, or markdown.\n' +
  '- For achievement bullets: return one bullet per line, no leading bullet characters.\n' +
  '- Keep similar length unless the input was extremely short; then expand modestly with role-appropriate phrasing without inventing facts.';

function normalizeFocus(raw) {
  var id = raw != null ? String(raw).trim().toLowerCase() : 'general';
  return CAREER_FOCUS_IDS.indexOf(id) >= 0 ? id : 'general';
}

function buildUserPrompt(payload) {
  var focus = normalizeFocus(payload.careerFocus);
  var fieldType = payload.fieldType === 'achievements' ? 'achievements' : payload.fieldType === 'experience' ? 'experience' : 'summary';
  var ctx = payload.context && typeof payload.context === 'object' ? payload.context : {};
  var jobTitle = ctx.jobTitle != null ? String(ctx.jobTitle).trim() : '';
  var company = ctx.company != null ? String(ctx.company).trim() : '';
  var location = ctx.location != null ? String(ctx.location).trim() : '';

  var lines = [
    'Career focus: ' + (FOCUS_LABELS[focus] || FOCUS_LABELS.general),
    'Focus guidance: ' + (FOCUS_GUIDANCE[focus] || FOCUS_GUIDANCE.general),
    'Field type: ' + fieldType
  ];
  if (jobTitle) lines.push('Job title: ' + jobTitle);
  if (company) lines.push('Company: ' + company);
  if (location) lines.push('Location: ' + location);
  lines.push('');
  lines.push('Draft to improve:');
  lines.push(String(payload.text || '').trim());

  if (fieldType === 'summary') {
    lines.push('');
    lines.push('Return a professional summary paragraph (2–4 sentences).');
  } else if (fieldType === 'experience') {
    lines.push('');
    lines.push('Return a role narrative paragraph (3–6 sentences) suitable for a résumé experience section.');
  } else {
    lines.push('');
    lines.push('Return improved achievement bullets, one per line, no bullet prefix characters.');
  }

  return lines.join('\n');
}

module.exports = {
  CAREER_FOCUS_IDS: CAREER_FOCUS_IDS,
  FOCUS_LABELS: FOCUS_LABELS,
  SYSTEM_PROMPT: SYSTEM_PROMPT,
  normalizeFocus: normalizeFocus,
  buildUserPrompt: buildUserPrompt
};
