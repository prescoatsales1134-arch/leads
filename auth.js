/**
 * Auth module: all auth goes through the backend. No Supabase keys or client in the frontend.
 * getSession/getUser/getRole use GET /auth/session; signInWithGoogle redirects to /auth/google;
 * signInWithPassword/signUp use POST /auth/login and /auth/signup; signOut uses POST /auth/logout.
 * getSupabase() returns null; use backend APIs (e.g. /api/profiles) for data that required Supabase.
 */
(function (global) {
  var currentUser = null;
  var currentRole = null;

  function getSession() {
    return fetch('/auth/session', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.user) return null;
        currentUser = data.user;
        currentRole = data.role || 'Manager';
        return { user: data.user, role: data.role };
      })
      .catch(function () {
        currentUser = null;
        currentRole = null;
        return null;
      });
  }

  function getUser() {
    if (currentUser) return Promise.resolve(currentUser);
    return getSession().then(function (s) {
      return s ? s.user : null;
    });
  }

  function getRole() {
    if (currentRole) return Promise.resolve(currentRole);
    return getSession().then(function (s) {
      return s ? (s.role || 'Manager') : null;
    });
  }

  function getSupabase() {
    return null;
  }

  function signInWithGoogle() {
    window.location.href = '/auth/google';
  }

  function signInWithPassword(email, password) {
    return fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
      credentials: 'same-origin'
    })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || 'Login failed');
          currentUser = d.user;
          currentRole = d.role || 'Manager';
          return { data: { user: d.user, session: d.user ? { user: d.user } : null }, error: null };
        });
      });
  }

  function signUp(email, password, options) {
    var payload = { email: email, password: password };
    if (options && (options.first_name != null || options.last_name != null)) {
      payload.first_name = options.first_name || '';
      payload.last_name = options.last_name || '';
    }
    if (options && typeof options === 'object') {
      payload.options = options;
    }
    return fetch('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || 'Signup failed');
          if (d.user && !d.needsConfirmation) {
            currentUser = d.user;
            currentRole = d.role || 'Manager';
          }
          return { data: { user: d.user, session: d.user && !d.needsConfirmation ? { user: d.user } : null }, error: null };
        });
      });
  }

  function signOut() {
    currentUser = null;
    currentRole = null;
    return fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' })
      .then(function () {});
  }

  function isAdmin() {
    return getRole().then(function (r) { return r === 'Admin'; });
  }

  function isManagerOrAdmin() {
    return getRole().then(function (r) { return r === 'Manager' || r === 'Admin'; });
  }

  function canExport() {
    return isManagerOrAdmin();
  }

  function canSyncHubSpot() {
    return isManagerOrAdmin();
  }

  function canGenerateLeads() {
    return isManagerOrAdmin();
  }

  function canManageUsers() {
    return isAdmin();
  }

  global.auth = {
    getSupabase: getSupabase,
    getSession: getSession,
    getUser: getUser,
    getRole: getRole,
    signInWithGoogle: signInWithGoogle,
    signInWithPassword: signInWithPassword,
    signUp: signUp,
    signOut: signOut,
    isAdmin: isAdmin,
    isManagerOrAdmin: isManagerOrAdmin,
    canExport: canExport,
    canSyncHubSpot: canSyncHubSpot,
    canGenerateLeads: canGenerateLeads,
    canManageUsers: canManageUsers,
    get currentUser() { return currentUser; },
    get currentRole() { return currentRole; }
  };
})(typeof window !== 'undefined' ? window : this);
