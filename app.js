/**
 * Dashboard app: routing, sidebar, profile, guard.
 */
(function (global) {
  var PAGE_ATTR = 'data-page';
  var PAGE_PREFIX = 'page-';

  // Close modals via document click (works even if other inits are delayed or overlays block)
  document.addEventListener('click', function (e) {
    var t = e.target;
    var id = t && t.id;
    if (id === 'lead-modal-close' || id === 'lead-modal-close-btn' || id === 'lead-modal-overlay') {
      if (global.leads && global.leads.closeLeadModal) global.leads.closeLeadModal();
    }
    if (id === 'chat-close') {
      var panel = document.getElementById('chat-panel');
      if (panel) panel.hidden = true;
    }
    if (id === 'activity-log-modal-close' || id === 'activity-log-modal-overlay') {
      closeActivityLogModal();
    }
    if (id === 'activity-detail-modal-close' || id === 'activity-detail-modal-overlay') {
      closeActivityDetailModal();
    }
    if (id === 'profile-modal-close' || id === 'profile-modal-close-btn' || id === 'profile-modal-overlay') {
      closeProfileModal();
    }
  });

  function getPageFromHash() {
    var hash = (window.location.hash || '#dashboard').slice(1).toLowerCase();
    var page = hash || 'dashboard';
    if (page === 'assistant') page = 'dashboard';
    return page;
  }

  function showPage(pageId) {
    var pages = document.querySelectorAll('.page');
    var navItems = document.querySelectorAll('.nav-item');
    pageId = pageId || getPageFromHash();

    pages.forEach(function (p) {
      var id = p.id;
      var isTarget = id === PAGE_PREFIX + pageId;
      p.classList.toggle('active', isTarget);
    });

    navItems.forEach(function (n) {
      var dataPage = n.getAttribute(PAGE_ATTR);
      n.classList.toggle('active', dataPage === pageId);
    });

    window.location.hash = pageId;
  }

  function initSidebar() {
    var sidebar = document.getElementById('sidebar');
    var toggle = document.getElementById('sidebar-toggle');
    var openMobile = document.getElementById('sidebar-open-mobile');

    if (toggle && sidebar) {
      toggle.addEventListener('click', function () {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
        } else {
          sidebar.classList.toggle('collapsed');
        }
      });
    }

    if (openMobile && sidebar) {
      openMobile.addEventListener('click', function () {
        sidebar.classList.add('open');
      });
    }

    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        var page = item.getAttribute(PAGE_ATTR);
        if (page) showPage(page);
        if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('open');
      });
    });
  }

  function closeProfileModal() {
    var overlay = document.getElementById('profile-modal-overlay');
    if (overlay) overlay.hidden = true;
  }

  function openProfileModal() {
    var overlay = document.getElementById('profile-modal-overlay');
    var emailEl = document.getElementById('profile-modal-email');
    var nameEl = document.getElementById('profile-modal-name');
    var roleEl = document.getElementById('profile-modal-role');
    var dropdown = document.getElementById('profile-dropdown');
    var trigger = document.getElementById('profile-trigger');
    var menu = trigger && trigger.closest ? trigger.closest('.profile-menu') : null;
    if (!overlay) return;
    overlay.hidden = false;
    if (dropdown) dropdown.hidden = true;
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    global.auth.getSession().then(function (session) {
      var user = session && session.user ? session.user : null;
      var role = session && session.role ? session.role : '—';
      var name = user && (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ? (user.user_metadata.full_name || user.user_metadata.name) : (user && user.email ? user.email.split('@')[0] : '—');
      if (emailEl) emailEl.textContent = user && user.email ? user.email : '—';
      if (nameEl) nameEl.textContent = name;
      if (roleEl) roleEl.textContent = role;
    }).catch(function () {
      if (emailEl) emailEl.textContent = '—';
      if (nameEl) nameEl.textContent = '—';
      if (roleEl) roleEl.textContent = '—';
    });
  }

  function initProfile() {
    var trigger = document.getElementById('profile-trigger');
    var dropdown = document.getElementById('profile-dropdown');
    var menu = trigger && trigger.closest ? trigger.closest('.profile-menu') : null;

    if (trigger && dropdown) {
      trigger.addEventListener('click', function () {
        var open = dropdown.hidden;
        dropdown.hidden = !open;
        if (menu) menu.classList.toggle('open', open);
        trigger.setAttribute('aria-expanded', open);
      });
    }

    var profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
      profileBtn.addEventListener('click', function () {
        openProfileModal();
      });
    }

    document.addEventListener('click', function (e) {
      if (menu && dropdown && !menu.contains(e.target)) {
        dropdown.hidden = true;
        menu.classList.remove('open');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        global.auth.signOut().then(function () {
          window.location.href = 'index.html';
        });
      });
    }
  }

  function setProfileUI(user, role) {
    var emailEl = document.getElementById('profile-email');
    var avatarEl = document.getElementById('profile-avatar');
    var roleBadge = document.getElementById('role-badge');
    var settingsEmail = document.getElementById('settings-account-email');
    var settingsRole = document.getElementById('settings-account-role');

    if (emailEl) emailEl.textContent = user ? (user.email || 'Signed in') : 'Loading…';
    if (avatarEl) {
      var initial = '?';
      if (user && user.email) initial = user.email.charAt(0).toUpperCase();
      avatarEl.textContent = initial;
    }
    if (roleBadge) roleBadge.textContent = role || '—';
    if (settingsEmail) settingsEmail.textContent = user ? (user.email || '—') : '—';
    if (settingsRole) settingsRole.textContent = role || '—';
  }

  function updateDashboardStats() {
    var allLeads = global.leadsStore ? global.leadsStore.getAll() : [];
    var total = allLeads.length;
    var today = new Date();
    var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    var generatedToday = allLeads.filter(function (l) {
      var t = l.createdAt ? new Date(l.createdAt).getTime() : 0;
      return t >= todayStart;
    }).length;
    var syncedCount = allLeads.filter(function (l) { return l.status === 'Synced'; }).length;
    var elTotal = document.getElementById('stat-total-leads');
    var elToday = document.getElementById('stat-today');
    var elExported = document.getElementById('stat-exported');
    var elSynced = document.getElementById('stat-synced');
    if (elTotal) elTotal.textContent = total;
    if (elToday) elToday.textContent = generatedToday > 0 ? String(generatedToday) : '—';
    if (elSynced) elSynced.textContent = syncedCount > 0 ? String(syncedCount) : '—';
    if (elExported) {
      fetch('/api/stats', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          var exportedTotal = (data && typeof data.exportedTotal === 'number') ? data.exportedTotal : 0;
          elExported.textContent = exportedTotal > 0 ? String(exportedTotal) : '—';
        })
        .catch(function () {
          if (!global.auth || !global.auth.getUser) {
            elExported.textContent = '—';
            return;
          }
          global.auth.getUser().then(function (user) {
            var key = user && user.id ? 'leads_linked_export_total_' + user.id : null;
            var exportedTotal = 0;
            try {
              if (key) exportedTotal = parseInt(localStorage.getItem(key) || '0', 10);
            } catch (e) {}
            elExported.textContent = exportedTotal > 0 ? String(exportedTotal) : '—';
          });
        });
    }
    renderActivityChart();
  }

  function renderActivityChart() {
    var allLeads = global.leadsStore ? global.leadsStore.getAll() : [];
    var emptyEl = document.getElementById('dashboard-activity-empty');
    var barsEl = document.getElementById('dashboard-activity-bars');
    if (!emptyEl || !barsEl) return;
    var byDay = {};
    var days = 14;
    var now = new Date();
    for (var d = 0; d < days; d++) {
      var date = new Date(now);
      date.setDate(date.getDate() - (days - 1 - d));
      var key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
      byDay[key] = 0;
    }
    allLeads.forEach(function (l) {
      if (!l.createdAt) return;
      var t = new Date(l.createdAt);
      var key = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
      if (byDay[key] !== undefined) byDay[key]++;
    });
    var keys = Object.keys(byDay).sort();
    var maxCount = Math.max(1, Math.max.apply(null, keys.map(function (k) { return byDay[k]; })));
    if (maxCount === 0 && keys.every(function (k) { return byDay[k] === 0; })) {
      barsEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    barsEl.hidden = false;
    barsEl.innerHTML = keys.map(function (k) {
      var count = byDay[k];
      var heightPx = maxCount ? Math.max(4, (count / maxCount) * 140) : 0;
      var label = k.slice(5);
      return '<div class="activity-bar-wrap" title="' + k + ': ' + count + ' lead(s)"><span class="activity-bar-label">' + label + '</span><div class="activity-bar" style="height:' + heightPx + 'px"></div><span class="activity-bar-value">' + count + '</span></div>';
    }).join('');
  }

  var activityLogData = [];

  function formatActivityRow(row, index) {
    var time = row.created_at ? new Date(row.created_at).toLocaleString() : '—';
    var details = row.details;
    var detailsStr = '';
    if (details && typeof details === 'object') {
      if (typeof details.count === 'number') detailsStr = 'count: ' + details.count;
      else detailsStr = Object.keys(details).filter(function (k) { return k !== 'leads'; }).map(function (k) { return k + ': ' + details[k]; }).join(', ');
    }
    var viewBtn = '<button type="button" class="btn-link btn-view-activity" data-index="' + (index >= 0 ? index : '') + '">View</button>';
    return '<tr data-index="' + (index >= 0 ? index : '') + '"><td>' + escapeHtml(time) + '</td><td>' + escapeHtml(row.user_email || '—') + '</td><td>' + escapeHtml(row.action || '') + '</td><td>' + escapeHtml(detailsStr) + '</td><td>' + viewBtn + '</td></tr>';
  }

  function renderActivityDetailContent(row, container, opts) {
    opts = opts || {};
    var action = row.action || '';
    var details = row.details || {};
    var leads = Array.isArray(details.leads) ? details.leads : [];
    var count = typeof details.count === 'number' ? details.count : leads.length;
    var timeStr = row.created_at ? new Date(row.created_at).toLocaleString() : '';
    var title = action.replace(/_/g, ' ') + (timeStr ? ' — ' + timeStr : '');
    var html = '<h3 style="margin-top:0;">' + escapeHtml(title) + '</h3>';
    if (action === 'generate_leads' || action === 'sync_hubspot') {
      if (leads.length === 0) {
        html += '<p>No lead summary stored for this action.' + (count > 0 ? ' (Count: ' + count + ')' : '') + '</p>';
      } else {
        var cols = ['companyName', 'companyDomain', 'contactName', 'jobTitle', 'industry', 'email', 'phone', 'linkedin', 'country', 'status'];
        html += (count > leads.length ? '<p class="text-muted">Showing first ' + leads.length + ' of ' + count + '.</p>' : '') +
          '<div class="table-wrap"><table class="data-table"><thead><tr>' +
          cols.map(function (c) {
            if (c === 'linkedin') return '<th>LinkedIn</th>';
            if (c === 'companyDomain') return '<th>Company Domain</th>';
            return '<th>' + c.replace(/([A-Z])/g, ' $1').trim() + '</th>';
          }).join('') +
          '</tr></thead><tbody>' +
          leads.map(function (l) {
            return '<tr><td>' + cols.map(function (c) { return escapeHtml((l[c] != null ? l[c] : '')); }).join('</td><td>') + '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      }
    } else if (action === 'export_csv') {
      if (leads.length === 0) {
        html += '<p>No export summary stored.' + (count > 0 ? ' (Count: ' + count + ')' : '') + '</p>';
      } else {
        html += '<p>Exported ' + count + ' lead(s).</p><button type="button" class="btn btn-primary" id="activity-detail-download-csv">Download CSV</button>';
        container.innerHTML = html;
        var btn = document.getElementById('activity-detail-download-csv');
        if (btn && global.utils && global.utils.toCSV && global.utils.downloadBlob) {
          btn.onclick = function () {
            var csv = global.utils.toCSV(leads, ['companyName', 'companyDomain', 'contactName', 'jobTitle', 'industry', 'email', 'phone', 'linkedin', 'country', 'status']);
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            global.utils.downloadBlob(blob, 'activity-export-' + (row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : 'leads') + '.csv');
          };
        }
        return;
      }
    } else {
      html += '<p>' + (typeof details.count === 'number' ? 'Count: ' + details.count : 'No details.') + '</p>';
    }
    container.innerHTML = html;
  }

  function openActivityDetail(row, fromAllActivityModal) {
    var titleEl = document.getElementById('activity-detail-modal-title');
    var bodyEl = document.getElementById('activity-detail-modal-body');
    var contentEl = document.getElementById('activity-log-modal-detail-content');
    if (fromAllActivityModal && contentEl) {
      var listWrap = document.getElementById('activity-log-modal-list-wrap');
      var detailWrap = document.getElementById('activity-log-modal-detail-wrap');
      var modalTitle = document.getElementById('activity-log-modal-title');
      if (listWrap) listWrap.hidden = true;
      if (detailWrap) detailWrap.hidden = false;
      if (modalTitle) modalTitle.textContent = 'Activity detail';
      renderActivityDetailContent(row, contentEl, { fromAllActivityModal: true });
      return;
    }
    if (titleEl) titleEl.textContent = 'Activity detail';
    if (bodyEl) {
      renderActivityDetailContent(row, bodyEl, {});
    }
    var overlay = document.getElementById('activity-detail-modal-overlay');
    if (overlay) overlay.hidden = false;
  }

  function closeActivityDetailModal() {
    var overlay = document.getElementById('activity-detail-modal-overlay');
    if (overlay) overlay.hidden = true;
  }

  function closeActivityLogModal() {
    var overlay = document.getElementById('activity-log-modal-overlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function openActivityLogModal() {
    var overlay = document.getElementById('activity-log-modal-overlay');
    var contentEl = document.getElementById('view-all-activity-content');
    var modalTitle = document.getElementById('activity-log-modal-title');
    if (!overlay || !contentEl) return;
    document.body.classList.add('modal-open');
    overlay.hidden = false;
    if (modalTitle) modalTitle.textContent = 'All activity';
    contentEl.innerHTML = '<div class="loading-skeleton"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';
    fetch('/api/activity?limit=200', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return [];
        return r.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || data.length === 0) {
          contentEl.innerHTML = '<div class="empty-state"><p>No activity.</p></div>';
          return;
        }
        activityLogData = data;
        var rowsHtml = data.map(function (row, i) { return formatActivityRow(row, i); }).join('');
        contentEl.innerHTML =
          '<div id="viewall-list"><div class="table-wrap"><table class="data-table">' +
          '<thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th><th>View</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody></table></div></div>' +
          '<div id="viewall-detail" hidden><p><button type="button" class="btn btn-ghost btn-sm" id="viewall-back">← Back to list</button></p><div id="viewall-detail-content"></div></div>';
        contentEl.querySelectorAll('.btn-view-activity').forEach(function (btn) {
          var idx = parseInt(btn.getAttribute('data-index'), 10);
          if (isNaN(idx) || !activityLogData[idx]) return;
          btn.addEventListener('click', function () {
            var listEl = document.getElementById('viewall-list');
            var detailEl = document.getElementById('viewall-detail');
            var detailContent = document.getElementById('viewall-detail-content');
            if (listEl) listEl.hidden = true;
            if (modalTitle) modalTitle.textContent = 'Activity detail';
            if (detailEl) detailEl.hidden = false;
            if (detailContent) renderActivityDetailContent(activityLogData[idx], detailContent, {});
          });
        });
        var backBtn = document.getElementById('viewall-back');
        if (backBtn) backBtn.onclick = function () {
          var listEl = document.getElementById('viewall-list');
          var detailEl = document.getElementById('viewall-detail');
          if (listEl) listEl.hidden = false;
          if (detailEl) detailEl.hidden = true;
          if (modalTitle) modalTitle.textContent = 'All activity';
        };
      })
      .catch(function () {
        contentEl.innerHTML = '<div class="empty-state"><p>Could not load activity.</p></div>';
      });
  }

  function loadActivityLog() {
    var loading = document.getElementById('activity-log-loading');
    var empty = document.getElementById('activity-log-empty');
    var wrap = document.getElementById('activity-log-table-wrap');
    var tbody = document.getElementById('activity-log-tbody');
    if (!tbody) return;
    if (loading) loading.hidden = false;
    if (empty) empty.hidden = true;
    if (wrap) wrap.hidden = true;
    fetch('/api/activity?limit=6', { credentials: 'same-origin' })
      .then(function (r) {
        if (loading) loading.hidden = true;
        if (!r.ok) {
          if (empty) empty.hidden = false;
          return [];
        }
        return r.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || data.length === 0) {
          if (empty) empty.hidden = false;
          return;
        }
        activityLogData = data;
        if (empty) empty.hidden = true;
        if (wrap) wrap.hidden = false;
        tbody.innerHTML = data.map(function (row, i) { return formatActivityRow(row, i); }).join('');
        tbody.querySelectorAll('.btn-view-activity').forEach(function (btn) {
          var i = parseInt(btn.getAttribute('data-index'), 10);
          if (isNaN(i) || !activityLogData[i]) return;
          btn.addEventListener('click', function () { openActivityDetail(activityLogData[i], false); });
        });
        var viewAllBtn = document.getElementById('activity-log-view-all');
        if (viewAllBtn) viewAllBtn.onclick = openActivityLogModal;
      })
      .catch(function () {
        if (loading) loading.hidden = true;
        if (empty) empty.hidden = false;
      });
  }

  function applyPermissions() {
    global.auth.canManageUsers().then(function (can) {
      var section = document.getElementById('settings-admin-section');
      var activitySection = document.getElementById('settings-activity-log-section');
      if (section) section.hidden = !can;
      if (activitySection) activitySection.hidden = !can;
      if (can) {
        loadManageUsers();
        loadActivityLog();
      }
    });

    global.auth.canExport().then(function (can) {
      var btn = document.getElementById('btn-export-csv');
      if (btn) btn.style.display = can ? '' : 'none';
    }).catch(function () {});


    global.auth.canGenerateLeads().then(function (can) {
      var btn = document.getElementById('btn-generate-leads');
      if (btn) btn.disabled = !can;
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function loadManageUsers() {
    var loading = document.getElementById('manage-users-loading');
    var empty = document.getElementById('manage-users-empty');
    var wrap = document.getElementById('manage-users-table-wrap');
    var tbody = document.getElementById('manage-users-tbody');
    if (!tbody) return;

    if (loading) loading.hidden = false;
    if (empty) empty.hidden = true;
    if (wrap) wrap.hidden = true;

    fetch('/api/profiles', { credentials: 'same-origin' })
      .then(function (r) {
        if (loading) loading.hidden = true;
        if (!r.ok) {
          if (empty) empty.hidden = false;
          return [];
        }
        return r.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || data.length === 0) {
          if (empty) empty.hidden = false;
          return;
        }
        if (empty) empty.hidden = true;
        if (wrap) wrap.hidden = false;
        tbody.innerHTML = data.map(function (p) {
          var currentRole = p.role || 'Manager';
          var limitVal = p.lead_generation_limit != null && p.lead_generation_limit !== '' ? String(p.lead_generation_limit) : '';
          return '<tr data-user-id="' + escapeHtml(p.id) + '">' +
            '<td>' + escapeHtml(p.email || '—') + '</td>' +
            '<td>' + escapeHtml(p.full_name || '—') + '</td>' +
            '<td><select class="manage-user-role" data-user-id="' + escapeHtml(p.id) + '">' +
            '<option value="Manager"' + (currentRole === 'Manager' ? ' selected' : '') + '>Manager</option>' +
            '<option value="Admin"' + (currentRole === 'Admin' ? ' selected' : '') + '>Admin</option>' +
            '</select></td>' +
            '<td><input type="number" min="0" step="1" class="manage-user-limit input-narrow" data-user-id="' + escapeHtml(p.id) + '" value="' + escapeHtml(limitVal) + '" placeholder="Unlimited" title="Max leads per month; leave empty for unlimited" /></td>' +
            '<td><button type="button" class="btn btn-secondary btn-sm btn-save-role" data-user-id="' + escapeHtml(p.id) + '">Save</button></td></tr>';
        }).join('');

        tbody.querySelectorAll('.btn-save-role').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var userId = btn.getAttribute('data-user-id');
            var row = btn.closest('tr');
            var select = row ? row.querySelector('.manage-user-role') : null;
            var limitInput = row ? row.querySelector('.manage-user-limit') : null;
            if (!select) return;
            var newRole = select.value;
            var limitRaw = limitInput ? limitInput.value.trim() : '';
            var limitBody = limitRaw === '' ? null : parseInt(limitRaw, 10);
            if (limitRaw !== '' && (isNaN(limitBody) || limitBody < 0)) limitBody = null;
            btn.disabled = true;
            var rolePromise = fetch('/api/profiles/' + encodeURIComponent(userId) + '/role', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: newRole }),
              credentials: 'same-origin'
            });
            var limitPromise = fetch('/api/profiles/' + encodeURIComponent(userId) + '/lead_limit', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead_generation_limit: limitBody }),
              credentials: 'same-origin'
            });
            Promise.all([rolePromise, limitPromise])
              .then(function (responses) {
                btn.disabled = false;
                var roleOk = responses[0].ok;
                var limitOk = responses[1].ok;
                if (roleOk && limitOk && global.utils && global.utils.toast) global.utils.toast('Saved', 'success');
                else if ((!roleOk || !limitOk) && global.utils && global.utils.toast) global.utils.toast('Failed to save', 'error');
              })
              .catch(function () {
                btn.disabled = false;
                if (global.utils && global.utils.toast) global.utils.toast('Failed to save', 'error');
              });
          });
        });
      })
      .catch(function () {
        if (loading) loading.hidden = true;
        if (empty) empty.hidden = false;
      });
  }

  function initHashRouting() {
    window.addEventListener('hashchange', function () {
      showPage(getPageFromHash());
    });
    showPage(getPageFromHash());
  }

  function guardAndInit() {
    if (!document.body.classList.contains('dashboard-layout')) return;

    var sessionKeepAliveInterval = null;

    function onSession(session) {
      if (session) {
        if (sessionKeepAliveInterval) clearInterval(sessionKeepAliveInterval);
        sessionKeepAliveInterval = setInterval(function () {
          fetch('/auth/session', { credentials: 'same-origin' })
            .then(function (r) {
              if (r.status === 401) {
                if (sessionKeepAliveInterval) clearInterval(sessionKeepAliveInterval);
                sessionKeepAliveInterval = null;
                window.location.href = 'index.html';
              }
            })
            .catch(function () {});
        }, 4 * 60 * 1000);
        return global.auth.getUser().then(function (user) {
          return global.auth.getRole().then(function (role) {
            setProfileUI(user, role);
            applyPermissions();
            updateDashboardStats();
            initSidebar();
            initProfile();
            initHashRouting();
          if (global.leads && global.leads.init) global.leads.init();
          if (global.messageAssistant && global.messageAssistant.init) global.messageAssistant.init();
          if (global.chatbot && global.chatbot.init) global.chatbot.init();
          });
        });
      }
      return Promise.resolve(null);
    }

    function doGuard(isRetry) {
      global.auth.getSession().then(function (session) {
        if (session) {
          onSession(session);
          return;
        }
        if (isRetry) {
          window.location.href = 'index.html';
          return;
        }
        setTimeout(function () {
          doGuard(true);
        }, 400);
      });
    }

    doGuard(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', guardAndInit);
  } else {
    guardAndInit();
  }

  function logActivity(action, details) {
    if (!action) return;
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, details: details || null }),
      credentials: 'same-origin'
    }).catch(function () {});
  }

  global.app = {
    showPage: showPage,
    getPageFromHash: getPageFromHash,
    updateDashboardStats: updateDashboardStats
  };
  global.logActivity = logActivity;
})(typeof window !== 'undefined' ? window : this);
