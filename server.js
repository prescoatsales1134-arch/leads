/**
 * Express server: static files, auth via backend (no Supabase keys in frontend), server-side Supabase.
 *
 * Auth: GET /auth/google (redirect to Supabase OAuth), GET /auth/callback (receive tokens, set cookie),
 * POST /auth/session (set session from callback), GET /auth/session (return user from cookie),
 * POST /auth/logout, POST /auth/login, POST /auth/signup.
 * Session is stored in httpOnly cookie (access_token). Service role key is never exposed.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Debug: log missing env on startup
const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
required.forEach(function (k) {
  if (!process.env[k] || process.env[k].trim() === '') {
    console.warn('[env] Missing or empty:', k);
  }
});
if (!process.env.PORT) console.warn('[env] PORT not set, using', PORT);
var chatbotUrl = (process.env.N8N_CHATBOT_WEBHOOK || '').trim();
console.log('[env] N8N_CHATBOT_WEBHOOK:', chatbotUrl ? 'configured' : 'not set (chat will show "webhook not configured")');
var messageAssistantUrl = (process.env.N8N_MESSAGE_ASSISTANT_WEBHOOK || '').trim();
console.log('[env] N8N_MESSAGE_ASSISTANT_WEBHOOK:', messageAssistantUrl ? 'configured' : 'not set (message assistant below Generate Leads will show "webhook not configured")');

// Supabase: anon key for auth (OAuth, getUser, signIn, signUp); service_role for admin-only (profiles)
const supabaseAuth = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

app.set('supabaseAuth', supabaseAuth);
app.set('supabaseAdmin', supabaseAdmin);

const COOKIE_NAME = 'leads_sid';
const COOKIE_REFRESH_NAME = 'leads_refresh';
function getCookieOpts(req) {
  const isSecure =
    (req && (req.get('x-forwarded-proto') === 'https' || req.secure)) ||
    process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: !!isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

function getSiteUrl(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('host') || 'localhost:' + PORT;
  return proto + '://' + host;
}

/** Peakydev LinkedIn actor: each seniority must match exactly (Apify rejects other strings). */
const PEAKYDEV_SENIORITY_ENUM = [
  'Founder',
  'Chairman',
  'President',
  'CEO',
  'CXO',
  'Vice President',
  'Director',
  'Head',
  'Manager',
  'Senior',
  'Junior',
  'Entry Level',
  'Executive'
];

/** Keep only allowed Peakydev seniority tokens; comma-separated string or array in → comma-separated string out. */
function normalizePeakydevSeniorityInput(val) {
  if (val == null) return '';
  var tokens = Array.isArray(val) ? val.map(String) : String(val).split(',');
  var canonByLower = {};
  for (var i = 0; i < PEAKYDEV_SENIORITY_ENUM.length; i++) {
    var s = PEAKYDEV_SENIORITY_ENUM[i];
    canonByLower[s.toLowerCase()] = s;
  }
  var out = [];
  var seen = {};
  for (var j = 0; j < tokens.length; j++) {
    var t = String(tokens[j]).trim();
    if (!t) continue;
    var c = canonByLower[t.toLowerCase()];
    if (c && !seen[c]) {
      seen[c] = true;
      out.push(c);
    }
  }
  return out.join(', ');
}

function getAccessToken(req) {
  return req.cookies && req.cookies[COOKIE_NAME];
}

function getRefreshToken(req) {
  return req.cookies && req.cookies[COOKIE_REFRESH_NAME];
}

function setAuthCookies(res, access_token, refresh_token, req) {
  const baseOpts = getCookieOpts(req);
  const accessOpts = { ...baseOpts, maxAge: 24 * 60 * 60 * 1000 };
  const refreshOpts = { ...baseOpts, maxAge: 30 * 24 * 60 * 60 * 1000 };

  res.cookie(COOKIE_NAME, access_token, accessOpts);

  if (refresh_token) {
    res.cookie(COOKIE_REFRESH_NAME, refresh_token, refreshOpts);
  }
}

/** Get JWT exp (seconds) from access token; return 0 if invalid. */
function getJwtExp(token) {
  if (!token || typeof token !== 'string') return 0;
  const parts = token.split('.');
  if (parts.length !== 3) return 0;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch (e) {
    return 0;
  }
}

// In-flight refresh deduplication: if two simultaneous requests try to refresh the
// same refresh token, only one actually calls Supabase; the other waits for the result.
// Resolved value includes new tokens so EVERY waiting request can set cookies on its
// own response (otherwise the second request never gets Set-Cookie and keeps old token → invalid session).
var _refreshInFlight = {};

/** Resolve current user: validate access token, or refresh with refresh_token cookie.
 *  Refreshes when token is missing or getUser fails; also when token expires in < 50 min.
 *  Never retries refresh with the same token — doing so triggers Supabase's replay-attack
 *  protection and revokes the session. */
function getAuthUser(req, res) {
  if (!supabaseAuth) return Promise.resolve(null);
  const token = getAccessToken(req);
  const refresh = getRefreshToken(req);
  const nowSec = Math.floor(Date.now() / 1000);
  const refreshThreshold = 50 * 60;

  // Returns promise that resolves to null or { user, access_token, refresh_token } so
  // every caller can set cookies on its own res (critical when multiple requests share the same refresh).
  function tryRefresh() {
    if (!refresh) return Promise.resolve(null);
    if (_refreshInFlight[refresh]) return _refreshInFlight[refresh];
    const promise = supabaseAuth.auth.refreshSession({ refresh_token: refresh })
      .then(function (_ref) {
        const data = _ref.data;
        const err = _ref.error;
        delete _refreshInFlight[refresh];
        if (err || !data || !data.session) return null;
        const session = data.session;
        const access_token = session.access_token;
        const refresh_token = session.refresh_token || undefined;
        return data.user ? { user: data.user, access_token: access_token, refresh_token: refresh_token } : null;
      })
      .catch(function () {
        delete _refreshInFlight[refresh];
        return null;
      });
    _refreshInFlight[refresh] = promise;
    return promise;
  }

  function applyRefreshResult(authResult) {
    if (authResult && authResult.access_token) {
      setAuthCookies(res, authResult.access_token, authResult.refresh_token, req);
      return authResult.user ? { user: authResult.user } : null;
    }
    return authResult;
  }

  if (token) {
    return supabaseAuth.auth.getUser(token)
      .then(function (_ref) {
        const data = _ref.data;
        const err = _ref.error;
        if (!err && data && data.user) {
          const exp = getJwtExp(token);
          if (exp && (exp - nowSec) < refreshThreshold) {
            return tryRefresh().then(applyRefreshResult);
          }
          return { user: data.user };
        }
        return tryRefresh().then(applyRefreshResult);
      })
      .catch(function () { return tryRefresh().then(applyRefreshResult); });
  }
  return tryRefresh().then(applyRefreshResult);
}

function resolveRole(adminClient, userId) {
  if (!adminClient || !userId) return Promise.resolve('Manager');
  return adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
    .then(function (r) {
      const role = r.data && r.data.role ? r.data.role : null;
      return role || 'Manager';
    })
    .catch(function () { return 'Manager'; });
}

// Lead generation limit:
//   mode 'unlimited' -> lead_generation_limit is null; used is informational (this month)
//   mode 'monthly'   -> lead_generation_limit > 0; per calendar month
//   mode 'trial'     -> lead_generation_limit = 0 AND trial_lifetime_limit > 0; ALL-TIME count, one-time trial
//   mode 'blocked'   -> lead_generation_limit = 0 and no trial
// trial_lifetime_limit is read defensively: if the column does not exist, the query falls back to no-trial behaviour.
function readTrialLifetimeLimit(adminClient, userId) {
  return adminClient
    .from('profiles')
    .select('trial_lifetime_limit')
    .eq('id', userId)
    .maybeSingle()
    .then(function (r) {
      if (!r || r.error || !r.data) return 0;
      var v = r.data.trial_lifetime_limit;
      if (v == null || v === '') return 0;
      var n = parseInt(v, 10);
      return isNaN(n) || n < 0 ? 0 : n;
    })
    .catch(function () { return 0; });
}

function getLeadLimitAndUsage(adminClient, userId) {
  if (!adminClient || !userId) return Promise.resolve({ limit: null, used: 0, mode: 'unlimited' });
  var now = new Date();
  var startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  var startIso = startOfMonth.toISOString();

  return adminClient
    .from('profiles')
    .select('lead_generation_limit')
    .eq('id', userId)
    .maybeSingle()
    .then(function (r) {
      var rawLimit = r && r.data && r.data.lead_generation_limit != null && r.data.lead_generation_limit !== ''
        ? parseInt(r.data.lead_generation_limit, 10) : null;
      if (rawLimit != null && isNaN(rawLimit)) rawLimit = null;
      return rawLimit;
    })
    .then(function (rawLimit) {
      if (rawLimit == null) {
        return adminClient.from('user_leads').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).gte('created_at', startIso)
          .then(function (c) {
            var used = (c && c.count != null) ? c.count : 0;
            return { limit: null, used: used, mode: 'unlimited' };
          });
      }
      if (rawLimit > 0) {
        return adminClient.from('user_leads').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).gte('created_at', startIso)
          .then(function (c) {
            var used = (c && c.count != null) ? c.count : 0;
            return { limit: rawLimit, used: used, mode: 'monthly' };
          });
      }
      // rawLimit === 0: maybe trial, maybe blocked. Read trial cap defensively.
      return readTrialLifetimeLimit(adminClient, userId).then(function (trialCap) {
        if (trialCap > 0) {
          return adminClient.from('user_leads').select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .then(function (c) {
              var used = (c && c.count != null) ? c.count : 0;
              return { limit: trialCap, used: used, mode: 'trial' };
            });
        }
        return { limit: 0, used: 0, mode: 'blocked' };
      });
    })
    .catch(function () { return { limit: null, used: 0, mode: 'unlimited' }; });
}

function leadLimitErrorFullBlock(info) {
  if (info && info.mode === 'trial') {
    return 'You have used your one-time free trial (' + info.used + '/' + info.limit + ' leads). Upgrade in Pricing to continue.';
  }
  if (info && info.mode === 'blocked') {
    return 'You have no lead allocation yet. Add a plan in Pricing or ask your admin to set your monthly limit.';
  }
  return 'You have reached your lead generation limit for this month (' + (info ? info.used : 0) + '/' + (info ? info.limit : 0) + '). It resets at the start of next month.';
}

function leadLimitErrorRemaining(info, remaining) {
  if (info && info.mode === 'trial') {
    return 'You have ' + remaining + ' free trial lead' + (remaining === 1 ? '' : 's') + ' left. Set Max results to ' + remaining + ' or less.';
  }
  if (info && info.mode === 'blocked') {
    return leadLimitErrorFullBlock(info);
  }
  return 'You have ' + remaining + ' leads remaining this month. Please set Max results to ' + remaining + ' or less.';
}

// ---------- Auth routes ----------

app.get('/auth/google', function (req, res) {
  if (!supabaseAuth) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }
  const callbackUrl = getSiteUrl(req) + '/auth/callback';
  supabaseAuth.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl } })
    .then(function (_ref) {
      const data = _ref.data;
      const err = _ref.error;
      if (err) return res.status(500).json({ error: err.message });
      if (data && data.url) return res.redirect(data.url);
      res.status(500).json({ error: 'No redirect URL from Supabase' });
    })
    .catch(function (e) {
      res.status(500).json({ error: e && e.message ? e.message : 'OAuth failed' });
    });
});

app.get('/auth/callback', function (req, res) {
  res.sendFile(path.join(__dirname, 'auth-callback.html'));
});

app.post('/auth/session', function (req, res) {
  if (!supabaseAuth || !supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }
  const access_token = req.body && req.body.access_token;
  const refresh_token = req.body && req.body.refresh_token;
  if (!access_token) {
    return res.status(400).json({ error: 'Missing access_token' });
  }
  supabaseAuth.auth.getUser(access_token)
    .then(function (_ref) {
      const data = _ref.data;
      const err = _ref.error;
      if (err || !data || !data.user) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      const user = data.user;
      return resolveRole(supabaseAdmin, user.id).then(function (role) {
        setAuthCookies(res, access_token, refresh_token || undefined, req);
        res.json({ user: user, role: role });
      });
    })
    .catch(function () {
      res.status(401).json({ error: 'Invalid token' });
    });
});

app.get('/auth/session', function (req, res) {
  if (!supabaseAuth || !supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }
  if (!getAccessToken(req) && !getRefreshToken(req)) {
    return res.status(401).json({ error: 'No session' });
  }
  getAuthUser(req, res)
    .then(function (auth) {
      if (!auth) {
        res.clearCookie(COOKIE_NAME, { path: '/' });
        res.clearCookie(COOKIE_REFRESH_NAME, { path: '/' });
        return res.status(401).json({ error: 'Invalid session' });
      }
      return resolveRole(supabaseAdmin, auth.user.id).then(function (role) {
        res.json({ user: auth.user, role: role });
      });
    })
    .catch(function () {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      res.clearCookie(COOKIE_REFRESH_NAME, { path: '/' });
      res.status(401).json({ error: 'Invalid session' });
    });
});

app.post('/auth/logout', function (req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.clearCookie(COOKIE_REFRESH_NAME, { path: '/' });
  res.status(200).json({ ok: true });
});

app.post('/auth/login', function (req, res) {
  if (!supabaseAuth || !supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }
  const email = req.body && req.body.email;
  const password = req.body && req.body.password;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }
  supabaseAuth.auth.signInWithPassword({ email: email, password: password })
    .then(function (_ref) {
      const data = _ref.data;
      const err = _ref.error;
      if (err) return res.status(401).json({ error: err.message });
      if (!data.session || !data.user) return res.status(401).json({ error: 'Login failed' });
      const access_token = data.session.access_token;
      const refresh_token = data.session.refresh_token || undefined;
      return resolveRole(supabaseAdmin, data.user.id).then(function (role) {
        setAuthCookies(res, access_token, refresh_token, req);
        res.json({ user: data.user, role: role });
      });
    })
    .catch(function (e) {
      res.status(500).json({ error: e && e.message ? e.message : 'Login failed' });
    });
});

app.post('/auth/signup', function (req, res) {
  if (!supabaseAuth || !supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }
  const email = req.body && req.body.email;
  const password = req.body && req.body.password;
  const firstName = (req.body && req.body.first_name) ? String(req.body.first_name).trim() : '';
  const lastName = (req.body && req.body.last_name) ? String(req.body.last_name).trim() : '';
  let options = req.body && req.body.options ? req.body.options : {};
  options = typeof options === 'object' ? options : {};
  options.data = options.data || {};
  if (firstName || lastName) {
    options.data.first_name = firstName;
    options.data.last_name = lastName;
    options.data.full_name = [firstName, lastName].filter(Boolean).join(' ').trim() || undefined;
  }
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }
  supabaseAuth.auth.signUp({ email: email, password: password, options: options })
    .then(function (_ref) {
      const data = _ref.data;
      const err = _ref.error;
      if (err) return res.status(400).json({ error: err.message });
      if (data.session && data.user) {
        const access_token = data.session.access_token;
        const refresh_token = data.session.refresh_token || undefined;
        return resolveRole(supabaseAdmin, data.user.id).then(function (role) {
          setAuthCookies(res, access_token, refresh_token, req);
          res.json({ user: data.user, role: role });
        });
      }
      res.json({ user: data.user || null, needsConfirmation: true });
    })
    .catch(function (e) {
      res.status(500).json({ error: e && e.message ? e.message : 'Signup failed' });
    });
});

// ---------- API: activity log (write = any auth user, read = admin only) ----------

function requireUser(req, res, onUser) {
  if (!supabaseAuth) return res.status(401).json({ error: 'No session' });
  getAuthUser(req, res)
    .then(function (auth) {
      if (!auth) return res.status(401).json({ error: 'Invalid session' });
      onUser(auth.user);
    })
    .catch(function () {
      if (!res.headersSent) res.status(401).json({ error: 'Invalid session' });
    });
}

var ACTIVITY_LEADS_CAP = 50;

function capActivityDetails(details) {
  if (!details || typeof details !== 'object') return details;
  var out = {};
  Object.keys(details).forEach(function (k) {
    out[k] = details[k];
  });
  if (Array.isArray(out.leads) && out.leads.length > ACTIVITY_LEADS_CAP) {
    out.leads = out.leads.slice(0, ACTIVITY_LEADS_CAP);
  }
  return out;
}

app.post('/api/activity', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  const action = req.body && req.body.action;
  if (!action || typeof action !== 'string') return res.status(400).json({ error: 'Missing action' });
  const details = capActivityDetails(req.body && req.body.details);
  requireUser(req, res, function (user) {
    const row = {
      user_id: user.id,
      user_email: user.email || '',
      action: action.trim().slice(0, 100),
      details: details && typeof details === 'object' ? details : null
    };
    supabaseAdmin.from('activity_log').insert(row)
      .then(function (r) {
        if (r.error) return res.status(500).json({ error: r.error.message });
        res.status(201).json({ ok: true });
      })
      .catch(function () { res.status(500).json({ error: 'Server error' }); });
  });
});

app.get('/api/activity', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  getAuthUser(req, res)
    .then(function (auth) {
      if (!auth) return res.status(401).json({ error: 'Invalid session' });
      return resolveRole(supabaseAdmin, auth.user.id).then(function (role) {
        if (role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
        return supabaseAdmin.from('activity_log').select('id, user_id, user_email, action, details, created_at').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      });
    })
    .then(function (result) {
      if (result && result.data !== undefined) return res.json(result.data);
      if (result && result.error) return res.status(500).json({ error: result.error.message });
    })
    .catch(function () { res.status(500).json({ error: 'Server error' }); });
});

// ---------- API: profiles (admin only) ----------

app.get('/api/profiles', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  getAuthUser(req, res)
    .then(function (auth) {
      if (!auth) return res.status(401).json({ error: 'Invalid session' });
      return resolveRole(supabaseAdmin, auth.user.id).then(function (role) {
        if (role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
        return supabaseAdmin.from('profiles').select('id, email, full_name, role, lead_generation_limit').order('email');
      });
    })
    .then(function (result) {
      if (result && result.data !== undefined) {
        return res.json(result.data);
      }
      if (result && result.error) {
        return res.status(500).json({ error: result.error.message });
      }
    })
    .catch(function () {
      res.status(500).json({ error: 'Server error' });
    });
});

app.patch('/api/profiles/:id/role', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  const userId = req.params.id;
  const role = req.body && req.body.role;
  if (!userId || !role) return res.status(400).json({ error: 'Missing id or role' });
  getAuthUser(req, res)
    .then(function (auth) {
      if (!auth) return res.status(401).json({ error: 'Invalid session' });
      return resolveRole(supabaseAdmin, auth.user.id).then(function (currentRole) {
        if (currentRole !== 'Admin') return res.status(403).json({ error: 'Admin only' });
        return supabaseAdmin.from('profiles').update({ role: role }).eq('id', userId).select();
      });
    })
    .then(function (result) {
      if (res.headersSent) return;
      if (result && result.error) return res.status(500).json({ error: result.error.message });
      res.json({ ok: true });
    })
    .catch(function () {
      if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    });
});

app.patch('/api/profiles/:id/lead_limit', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  const targetUserId = req.params.id;
  const raw = req.body && req.body.lead_generation_limit;
  const value = raw === null || raw === undefined || raw === '' ? null : parseInt(raw, 10);
  if (value !== null && (isNaN(value) || value < 0)) return res.status(400).json({ error: 'lead_generation_limit must be a non-negative number or null (unlimited)' });
  if (!targetUserId) return res.status(400).json({ error: 'Missing user id' });
  getAuthUser(req, res)
    .then(function (auth) {
      if (!auth) return res.status(401).json({ error: 'Invalid session' });
      return resolveRole(supabaseAdmin, auth.user.id).then(function (currentRole) {
        if (currentRole !== 'Admin') return res.status(403).json({ error: 'Admin only' });
        return supabaseAdmin.from('profiles').update({ lead_generation_limit: value }).eq('id', targetUserId).select();
      });
    })
    .then(function (result) {
      if (res.headersSent) return;
      if (result && result.error) return res.status(500).json({ error: result.error.message });
      res.json({ ok: true });
    })
    .catch(function () {
      if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    });
});

// GET /api/linkedin-filter-options — Peakydev-aligned industries, countries, regions, seniority, company sizes (LinkedIn generate)
app.get('/api/linkedin-filter-options', function (req, res) {
  requireUser(req, res, function () {
    if (res.headersSent) return;
    try {
      var dataDir = path.join(__dirname, 'data');
      var indPath = path.join(dataDir, 'peakydev-industries-raw.txt');
      var countriesPath = path.join(dataDir, 'peakydev-countries-raw.txt');
      var regionsPath = path.join(dataDir, 'peakydev-regions-by-country.json');
      var industries = fs.readFileSync(indPath, 'utf8').trim().split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var countries = fs.readFileSync(countriesPath, 'utf8').trim().split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var regionsByCountry = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));
      var seniority = PEAKYDEV_SENIORITY_ENUM.slice();
      var companySizes = [
        { value: '0 - 1', label: '0 – 1 employees' },
        { value: '2 - 10', label: '2 – 10' },
        { value: '11 - 50', label: '11 – 50' },
        { value: '51 - 200', label: '51 – 200' },
        { value: '201 - 500', label: '201 – 500' },
        { value: '501 - 1000', label: '501 – 1,000' },
        { value: '1001 - 5000', label: '1,001 – 5,000' },
        { value: '5001 - 10000', label: '5,001 – 10,000' },
        { value: '10000+', label: '10,000+' }
      ];
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json({
        industries: industries,
        countries: countries,
        regionsByCountry: regionsByCountry,
        seniority: seniority,
        companySizes: companySizes
      });
    } catch (e) {
      res.status(500).json({ error: e && e.message ? e.message : 'Failed to load LinkedIn filter options' });
    }
  });
});

// GET /api/lead-limit — current user's monthly limit and usage (so they can see remaining)
app.get('/api/lead-limit', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  requireUser(req, res, function (user) {
    if (res.headersSent) return;
    getLeadLimitAndUsage(supabaseAdmin, user.id).then(function (info) {
      var limit = info.limit;
      var used = info.used;
      var remaining = limit != null ? Math.max(0, limit - used) : null;
      res.json({ limit: limit, used: used, remaining: remaining, mode: info.mode });
    }).catch(function () {
      if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    });
  });
});

// GET /api/stats — dashboard stats for current user (e.g. exported total, synced across devices)
app.get('/api/stats', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  requireUser(req, res, function (user) {
    if (res.headersSent) return;
    supabaseAdmin.from('activity_log')
      .select('action, details')
      .eq('user_id', user.id)
      .eq('action', 'export_csv')
      .then(function (r) {
        if (r.error) return res.status(500).json({ error: r.error.message });
        var rows = r.data || [];
        var exportedTotal = rows.reduce(function (sum, row) {
          var d = row.details;
          var n = d && typeof d.count === 'number' ? d.count : 0;
          return sum + n;
        }, 0);
        res.json({ exportedTotal: exportedTotal });
      })
      .catch(function () {
        if (!res.headersSent) res.status(500).json({ error: 'Server error' });
      });
  });
});

// ---------- API: leads (per-user history) ----------

function parseN8nWebhookUrl(raw) {
  raw = (raw || '').trim();
  var start = raw.indexOf('https://');
  if (start === -1) start = raw.indexOf('http://');
  if (start === -1) return '';
  var prefixLen = raw.slice(start, start + 8) === 'https://' ? 8 : 7;
  var rest = raw.slice(start + prefixLen);
  var next = rest.search(/\s|https:\/\/|http:\/\//);
  var path = (next === -1 ? rest : rest.slice(0, next)).replace(/#.*$/, '').trim();
  if (!path) return '';
  return (raw.slice(start, start + 8) === 'https://' ? 'https://' : 'http://') + path;
}

var _n8nGenerateWebhookRewriteLogged = false;
/**
 * n8n "Test URL" paths use /webhook-test/... and only accept requests while the editor is listening.
 * This app POSTs from the server, so those calls never hit a registered test listener — use /webhook/... instead
 * (workflow must be Active). Set N8N_USE_WEBHOOK_TEST_URL=1 to send the URL unchanged.
 */
function n8nWebhookUrlForServerExecution(url) {
  if (!url || typeof url !== 'string') return url;
  var allowTest = process.env.N8N_USE_WEBHOOK_TEST_URL === '1' || String(process.env.N8N_USE_WEBHOOK_TEST_URL || '').toLowerCase() === 'true';
  if (allowTest) return url;
  if (url.indexOf('/webhook-test/') !== -1) {
    if (!_n8nGenerateWebhookRewriteLogged) {
      _n8nGenerateWebhookRewriteLogged = true;
      console.warn(
        '[n8n] Rewriting /webhook-test/ → /webhook/ for generate-leads (test URLs do not run workflows for server POSTs). Activate the workflow and use the production URL in .env, or set N8N_USE_WEBHOOK_TEST_URL=1 to disable.'
      );
    }
    return url.replace(/\/webhook-test\//g, '/webhook/');
  }
  return url;
}

console.log('[env] N8N_GENERATE_LEADS_WEBHOOK:', parseN8nWebhookUrl(process.env.N8N_GENERATE_LEADS_WEBHOOK || '') ? 'configured' : 'not set');
console.log('[env] N8N_GENERATE_GOOGLE_LEADS_WEBHOOK:', parseN8nWebhookUrl(process.env.N8N_GENERATE_GOOGLE_LEADS_WEBHOOK || '') ? 'configured' : 'not set');

function normalizeLeadSource(v) {
  if (v === 'google' || (v && String(v).toLowerCase() === 'google')) return 'google';
  return 'linkedin';
}

function leadToRow(userId, lead) {
  return {
    user_id: userId,
    lead_id: String(lead.id || lead.email || ''),
    company_name: lead.companyName || null,
    contact_name: lead.contactName || null,
    job_title: lead.jobTitle || null,
    industry: lead.industry || null,
    email: lead.email || null,
    phone: lead.phone || null,
    linkedin: lead.linkedin || null,
    company_domain: lead.companyDomain || null,
    country: lead.country || null,
    status: lead.status || 'New',
    lead_source: normalizeLeadSource(lead.leadSource || lead.lead_source)
  };
}

function rowToLead(row) {
  return {
    id: row.lead_id,
    companyName: row.company_name || '',
    contactName: row.contact_name || '',
    jobTitle: row.job_title || '',
    industry: row.industry || '',
    email: row.email || '',
    phone: row.phone || '',
    linkedin: row.linkedin || '',
    companyDomain: row.company_domain || '',
    country: row.country || '',
    status: row.status || 'New',
    createdAt: row.created_at || null,
    leadSource: normalizeLeadSource(row.lead_source)
  };
}

app.get('/api/leads', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  requireUser(req, res, function (user) {
    var baseSelect = 'lead_id, company_name, contact_name, job_title, industry, email, phone, linkedin, company_domain, country, status, lead_source';
    function sendRows(rows) {
      res.json((rows || []).map(rowToLead));
    }
    supabaseAdmin.from('user_leads').select(baseSelect + ', created_at').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(function (r) {
        if (r.error) {
          var msg = (r.error.message || '').toLowerCase();
          if (msg.indexOf('lead_source') !== -1) {
            return supabaseAdmin.from('user_leads').select('lead_id, company_name, contact_name, job_title, industry, email, phone, linkedin, company_domain, country, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
              .then(function (r2) {
                if (r2.error) return res.status(500).json({ error: r2.error.message });
                sendRows(r2.data);
              });
          }
          if (msg.indexOf('created_at') !== -1 || msg.indexOf('column') !== -1) {
            return supabaseAdmin.from('user_leads').select('lead_id, company_name, contact_name, job_title, industry, email, phone, linkedin, company_domain, country, status, lead_source').eq('user_id', user.id).order('id', { ascending: false })
              .then(function (r2) {
                if (r2.error) {
                  return supabaseAdmin.from('user_leads').select('lead_id, company_name, contact_name, job_title, industry, email, phone, linkedin, company_domain, country, status').eq('user_id', user.id).order('id', { ascending: false })
                    .then(function (r3) {
                      if (r3.error) return res.status(500).json({ error: r3.error.message });
                      sendRows(r3.data);
                    });
                }
                sendRows(r2.data);
              });
          }
          return res.status(500).json({ error: r.error.message });
        }
        sendRows(r.data);
      })
      .catch(function () {
        if (!res.headersSent) res.status(500).json({ error: 'Server error' });
      });
  });
});

app.post('/api/leads', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  const leads = req.body && req.body.leads;
  if (!Array.isArray(leads) || leads.length === 0) return res.status(400).json({ error: 'Missing or empty leads array' });
  requireUser(req, res, function (user) {
    if (res.headersSent) return;
    const rows = leads.map(function (l, i) {
      var r = leadToRow(user.id, l);
      if (!r.lead_id) r.lead_id = 'gen-' + i + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      return r;
    });
    if (rows.length === 0) return res.json({ saved: 0 });
    getLeadLimitAndUsage(supabaseAdmin, user.id).then(function (info) {
      var limit = info.limit;
      var used = info.used;
      var toSave = rows;
      var capped = false;
      if (limit != null && (used + rows.length) > limit) {
        var remaining = Math.max(0, limit - used);
        if (remaining === 0) {
          return res.status(403).json({ error: leadLimitErrorFullBlock(info) + ' No leads were saved.' });
        }
        toSave = rows.slice(0, remaining);
        capped = true;
      }
      supabaseAdmin.from('user_leads').upsert(toSave, { onConflict: ['user_id', 'lead_id'] })
      .then(function (r) {
        if (res.headersSent) return;
        if (r.error) {
          var em = (r.error.message || '').toLowerCase();
          if (em.indexOf('lead_source') !== -1) {
            var stripped = toSave.map(function (row) {
              var o = {};
              for (var k in row) {
                if (Object.prototype.hasOwnProperty.call(row, k) && k !== 'lead_source') o[k] = row[k];
              }
              return o;
            });
            return supabaseAdmin.from('user_leads').upsert(stripped, { onConflict: ['user_id', 'lead_id'] }).then(function (r2) {
              if (res.headersSent) return;
              if (r2.error) return res.status(500).json({ error: r2.error.message });
              var body = { saved: stripped.length };
              if (capped) body.capped = true;
              if (capped && rows.length > stripped.length) body.notSaved = rows.length - stripped.length;
              res.status(201).json(body);
            }).catch(function () {
              if (!res.headersSent) res.status(500).json({ error: 'Server error' });
            });
          }
          return res.status(500).json({ error: r.error.message });
        }
        var body = { saved: toSave.length };
        if (capped) body.capped = true;
        if (capped && rows.length > toSave.length) body.notSaved = rows.length - toSave.length;
        res.status(201).json(body);
      })
      .catch(function () {
        if (!res.headersSent) res.status(500).json({ error: 'Server error' });
      });
    }).catch(function () {
      if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    });
  });
});

// POST /api/generate-leads — check lead limit, then proxy to n8n (workflow runs only if under limit)
// Body may include source: "linkedin" | "google" (default linkedin). "source" is not forwarded to n8n.
app.post('/api/generate-leads', function (req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase not configured' });
  requireUser(req, res, function (user) {
    if (res.headersSent) return;
    var body = req.body && typeof req.body === 'object' ? req.body : {};
    var source = (body.source && String(body.source).toLowerCase() === 'google') ? 'google' : 'linkedin';
    var envName = source === 'google' ? 'N8N_GENERATE_GOOGLE_LEADS_WEBHOOK' : 'N8N_GENERATE_LEADS_WEBHOOK';
    var webhookUrl = n8nWebhookUrlForServerExecution(parseN8nWebhookUrl(process.env[envName] || ''));
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      var err503 = source === 'google'
        ? 'Google generate webhook not configured. Add N8N_GENERATE_GOOGLE_LEADS_WEBHOOK to .env.'
        : 'Generate leads webhook not configured. Add N8N_GENERATE_LEADS_WEBHOOK to .env.';
      return res.status(503).json({ error: err503 });
    }
    getLeadLimitAndUsage(supabaseAdmin, user.id).then(function (info) {
      var limit = info.limit;
      var used = info.used;
      if (limit != null && used >= limit) {
        return res.status(403).json({ error: leadLimitErrorFullBlock(info) });
      }
      var maxResults = body.maxResults != null ? parseInt(body.maxResults, 10) : (body.max_results != null ? parseInt(body.max_results, 10) : null);
      if (limit != null && typeof maxResults === 'number' && !isNaN(maxResults) && maxResults > 0) {
        var remaining = Math.max(0, limit - used);
        if (maxResults > remaining) {
          return res.status(403).json({ error: leadLimitErrorRemaining(info, remaining) });
        }
      }
      var payload = {};
      for (var k in body) {
        if (Object.prototype.hasOwnProperty.call(body, k) && k !== 'source') payload[k] = body[k];
      }
      if (source === 'linkedin' && Object.prototype.hasOwnProperty.call(payload, 'seniority')) {
        payload.seniority = normalizePeakydevSeniorityInput(payload.seniority);
      }
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (wh) {
          return wh.text().then(function (txt) {
            var data;
            try { data = txt && txt.trim() ? JSON.parse(txt) : null; } catch (e) { data = null; }
            return { ok: wh.ok, status: wh.status, data: data, raw: txt || '' };
          });
        })
        .then(function (_ref) {
          var ok = _ref.ok;
          var status = _ref.status;
          var data = _ref.data;
          var raw = _ref.raw;
          if (!ok) {
            var detail = (data && (data.error || data.message)) || '';
            if (!detail && raw && raw.length < 500) detail = String(raw).trim();
            var errMsg = detail || ('n8n webhook returned HTTP ' + (status != null ? status : '?'));
            return res.status(502).json({ error: errMsg });
          }
          res.setHeader('Content-Type', 'application/json');
          res.send(raw || '[]');
        })
        .catch(function (err) {
          if (!res.headersSent) res.status(502).json({ error: err.message || 'Failed to generate leads.' });
        });
    });
  });
});

// POST /api/chatbot — proxy to n8n webhook (same pattern as shopify_integration1: browser calls same-origin API, server forwards to n8n to avoid CORS)
app.post('/api/chatbot', function (req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  var raw = (process.env.N8N_CHATBOT_WEBHOOK || '').trim();
  // Use first valid URL only (in case value was pasted twice or has leading "chatbot")
  var start = raw.indexOf('https://');
  if (start === -1) start = raw.indexOf('http://');
  var webhookUrl = '';
  if (start !== -1) {
    var prefix = raw.slice(start, start + 8) === 'https://' ? 8 : 7;
    var rest = raw.slice(start + prefix);
    var next = rest.search(/\s|https:\/\/|http:\/\//);
    webhookUrl = (next === -1 ? rest : rest.slice(0, next)).replace(/#.*$/, '').trim();
    if (webhookUrl) webhookUrl = (raw.slice(start, start + 8) === 'https://' ? 'https://' : 'http://') + webhookUrl;
  }
  if (!webhookUrl) {
    webhookUrl = raw.replace(/^chatbot/i, '').trim();
    if (!/^https?:\/\//.test(webhookUrl)) webhookUrl = webhookUrl.replace(/^(https?):?\/?/, '$1://');
  }
  if (!webhookUrl || !webhookUrl.startsWith('http')) return res.status(503).json({ error: 'Chatbot webhook is not configured. Add N8N_CHATBOT_WEBHOOK to .env (e.g. https://your-n8n.com/webhook/chatbot).' });
  requireUser(req, res, function () {
    if (res.headersSent) return;
    var body = req.body && typeof req.body === 'object' ? req.body : {};
    var payload = { message: body.message || '', conversation_id: body.conversation_id || 'conv-' + Date.now() };
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (wh) {
        return wh.text().then(function (txt) {
          var data;
          try { data = txt && txt.trim() ? JSON.parse(txt) : null; } catch (e) { data = null; }
          return { ok: wh.ok, data: data, raw: txt || '' };
        });
      })
      .then(function (_ref) {
        var ok = _ref.ok;
        var data = _ref.data;
        var raw = _ref.raw;
        if (!ok) return res.status(502).json({ error: (data && (data.error || data.message)) || 'Chat failed' });
        var reply = '';
        if (data !== null && typeof data === 'object') {
          if (Array.isArray(data) && data.length > 0) {
            var first = data[0];
            var obj = first && first.json ? first.json : first;
            if (obj) reply = obj.reply || obj.output || obj.message || obj.response || obj.text || '';
          } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            var d0 = data.data[0];
            var o0 = d0 && d0.json ? d0.json : d0;
            if (o0) reply = o0.reply || o0.output || o0.message || o0.response || o0.text || '';
          } else {
            reply = data.reply || data.output || data.message || data.response || data.text || '';
          }
        }
        if (typeof reply !== 'string') reply = (reply && reply.content) ? reply.content : (reply ? String(reply) : '');
        // n8n "Respond With: Text" sends plain text, not JSON — use raw body as reply when we didn't get one from JSON
        if (!reply && typeof raw === 'string' && raw.trim()) reply = raw.trim();
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ reply: reply || 'No response from assistant.' }));
      })
      .catch(function (err) {
        if (!res.headersSent) res.status(502).json({ error: err.message || 'Could not reach the assistant.' });
      });
  });
});

// POST /api/message-assistant — proxy to n8n webhook; sends message + generated leads for outreach advice
app.post('/api/message-assistant', function (req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  var webhookUrl = (process.env.N8N_MESSAGE_ASSISTANT_WEBHOOK || '').trim();
  var start = webhookUrl.indexOf('https://');
  if (start === -1) start = webhookUrl.indexOf('http://');
  var url = '';
  if (start !== -1) {
    var prefix = webhookUrl.slice(start, start + 8) === 'https://' ? 8 : 7;
    var rest = webhookUrl.slice(start + prefix);
    var next = rest.search(/\s|https:\/\/|http:\/\//);
    url = (next === -1 ? rest : rest.slice(0, next)).replace(/#.*$/, '').trim();
    if (url) url = (webhookUrl.slice(start, start + 8) === 'https://' ? 'https://' : 'http://') + url;
  }
  if (!url || !url.startsWith('http')) {
    return res.status(503).json({ error: 'Message assistant webhook is not configured. Add N8N_MESSAGE_ASSISTANT_WEBHOOK to .env.' });
  }
  requireUser(req, res, function () {
    if (res.headersSent) return;
    var body = req.body && typeof req.body === 'object' ? req.body : {};
    var payload = {
      message: body.message || '',
      leads: Array.isArray(body.leads) ? body.leads : [],
      conversation_id: body.conversation_id || 'conv-' + Date.now(),
      timestamp: new Date().toISOString()
    };
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (wh) {
        return wh.text().then(function (txt) {
          var data;
          try { data = txt && txt.trim() ? JSON.parse(txt) : null; } catch (e) { data = null; }
          return { ok: wh.ok, data: data, raw: txt || '' };
        });
      })
      .then(function (_ref) {
        var ok = _ref.ok;
        var data = _ref.data;
        var raw = _ref.raw;
        if (!ok) return res.status(502).json({ error: (data && (data.error || data.message)) || 'Message assistant failed' });
        var reply = '';
        if (data !== null && typeof data === 'object') {
          if (Array.isArray(data) && data.length > 0) {
            var first = data[0];
            var obj = first && first.json ? first.json : first;
            if (obj) reply = obj.reply || obj.output || obj.message || obj.response || obj.text || '';
          } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            var d0 = data.data[0];
            var o0 = d0 && d0.json ? d0.json : d0;
            if (o0) reply = o0.reply || o0.output || o0.message || o0.response || o0.text || '';
          } else {
            reply = data.reply || data.output || data.message || data.response || data.text || '';
          }
        }
        if (typeof reply !== 'string') reply = (reply && reply.content) ? reply.content : (reply ? String(reply) : '');
        if (!reply && typeof raw === 'string' && raw.trim()) reply = raw.trim();
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ reply: reply || 'No response.' }));
      })
      .catch(function (err) {
        if (!res.headersSent) res.status(502).json({ error: err.message || 'Could not reach the assistant.' });
      });
  });
});

// POST /api/sync-hubspot — proxy to n8n HubSpot sync webhook (avoids CORS when browser would call n8n directly)
app.post('/api/sync-hubspot', function (req, res) {
  var raw = (process.env.N8N_SYNC_HUBSPOT_WEBHOOK || '').trim();
  var start = raw.indexOf('https://');
  if (start === -1) start = raw.indexOf('http://');
  var webhookUrl = '';
  if (start !== -1) {
    var prefix = raw.slice(start, start + 8) === 'https://' ? 8 : 7;
    var rest = raw.slice(start + prefix);
    var next = rest.search(/\s|https:\/\/|http:\/\//);
    webhookUrl = (next === -1 ? rest : rest.slice(0, next)).replace(/#.*$/, '').trim();
    if (webhookUrl) webhookUrl = (raw.slice(start, start + 8) === 'https://' ? 'https://' : 'http://') + webhookUrl;
  }
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return res.status(503).json({ error: 'Sync webhook not configured. Add N8N_SYNC_HUBSPOT_WEBHOOK to .env.' });
  }
  requireUser(req, res, function () {
    if (res.headersSent) return;
    var body = req.body && typeof req.body === 'object' ? req.body : {};
    var payload = body.leads ? { leads: body.leads } : { leads: [] };
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (wh) {
        if (!wh.ok) return res.status(wh.status).send(wh.statusText || 'Sync failed');
        return wh.text().then(function (txt) {
          try {
            var data = txt && txt.trim() ? JSON.parse(txt) : {};
            res.json(data);
          } catch (e) {
            res.status(200).json({ success: true });
          }
        });
      })
      .catch(function (err) {
        if (!res.headersSent) res.status(502).json({ error: err.message || 'Sync to HubSpot failed.' });
      });
  });
});

// Client-safe env only (no Supabase keys; frontend must use backend auth)
// Chatbot uses POST /api/chatbot (server proxy); webhook URL stays server-side only
// Generate leads goes through POST /api/generate-leads (limit check); webhook URL not exposed to client
const CLIENT_KEYS = [
  'N8N_SYNC_HUBSPOT_WEBHOOK',
  'OPENAI_API_KEY'
];

app.get('/api/env', function (req, res) {
  const env = {};
  CLIENT_KEYS.forEach(function (k) {
    const v = process.env[k];
    env[k] = (typeof v === 'string' ? v.trim() : v) || '';
  });
  res.json(env);
});

// Prevent caching of dashboard and app script so "View all activity" (Details + View columns) always loads latest
app.use(function (req, res, next) {
  var p = req.path || '';
  if (p === '/dashboard.html' || p === '/app.js' || p.indexOf('/app.js') === 0) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
  }
  next();
});

// Auth pages: clean URLs for verify-email and login
app.get('/verify-email', function (req, res) {
  res.sendFile(path.join(__dirname, 'verify-email.html'));
});
app.get('/login', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Static files and SPA fallback
app.use(express.static(path.join(__dirname)));
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  console.log('Server running at http://localhost:' + PORT);
  console.log('Open http://localhost:' + PORT + ' in your browser.');
});
