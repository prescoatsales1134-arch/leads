/**
 * Message assistant: below Generate Leads results. Toggle panel, send message + generated leads to n8n via /api/message-assistant.
 */
(function (global) {
  function parseResponse(data) {
    if (typeof data === 'string') return data.trim() || '';
    if (!data) return '';
    function fromItem(item) {
      if (!item || typeof item !== 'object') return '';
      var unwrap = item.json && typeof item.json === 'object' ? item.json : item;
      var r = unwrap.reply || unwrap.output || unwrap.message || unwrap.response || unwrap.text;
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object' && r.content) return r.content;
      return '';
    }
    if (Array.isArray(data) && data.length > 0) {
      var reply = fromItem(data[0]);
      if (reply) return reply;
    }
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      var reply2 = fromItem(data.data[0]);
      if (reply2) return reply2;
    }
    return fromItem(data) || '';
  }

  function getMessagesEl() {
    return document.getElementById('message-assistant-messages');
  }

  function escapeHtml(str) {
    if (str == null) return '';
    var s = String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function bold(t) {
    return t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function renderMarkdown(text) {
    if (text == null || typeof text !== 'string') return '';
    var s = escapeHtml(text).trim();
    if (!s) return '';
    var lines = s.split(/\r?\n/);
    var out = [];
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      if (/^###\s/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<h3 class="chat-md-h3">' + bold(trimmed.replace(/^###\s*/, '')) + '</h3>');
      } else if (/^##\s/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<h2 class="chat-md-h2">' + bold(trimmed.replace(/^##\s*/, '')) + '</h2>');
      } else if (/^#\s/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<h2 class="chat-md-h2">' + bold(trimmed.replace(/^#\s*/, '')) + '</h2>');
      } else if (/^-\s/.test(trimmed) || /^\*\s/.test(trimmed)) {
        if (!inList) { out.push('<ul class="chat-md-ul">'); inList = true; }
        out.push('<li class="chat-md-li">' + bold(trimmed.replace(/^[-*]\s*/, '')) + '</li>');
      } else if (trimmed === '') {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<br>');
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<p class="chat-md-p">' + bold(trimmed) + '</p>');
      }
    }
    if (inList) out.push('</ul>');
    return out.join('');
  }

  function appendMessage(text, isUser) {
    var el = getMessagesEl();
    if (!el) return;
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (isUser ? 'user' : 'bot');
    if (isUser) {
      div.textContent = text;
    } else {
      div.classList.add('chat-msg-markdown');
      div.innerHTML = renderMarkdown(text);
    }
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  /** Render structured reply from workflow (e.g. personalized_messages with leads[].linkedin_dm, cold_email, follow_up) */
  function renderStructuredReply(parsed) {
    var reply = parsed && parsed.reply;
    if (!reply || typeof reply !== 'object') return '';
    var leads = reply.leads;
    if (!Array.isArray(leads) || leads.length === 0) return '';
    var html = [];
    html.push('<div class="ma-reply-structured">');
    leads.forEach(function (lead, idx) {
      html.push('<div class="ma-lead-card">');
      html.push('<div class="ma-lead-header">');
      html.push('<span class="ma-lead-name">' + escapeHtml(lead.name || '') + '</span>');
      if (lead.company) html.push('<span class="ma-lead-company">' + escapeHtml(lead.company) + '</span>');
      html.push('</div>');
      if (lead.linkedin_dm) {
        html.push('<div class="ma-reply-section">');
        html.push('<div class="ma-reply-section-title">LinkedIn DM</div>');
        html.push('<div class="ma-reply-section-body">' + escapeHtml(lead.linkedin_dm).replace(/\n/g, '<br>') + '</div>');
        html.push('</div>');
      }
      if (lead.cold_email && (lead.cold_email.subject || lead.cold_email.body)) {
        html.push('<div class="ma-reply-section">');
        html.push('<div class="ma-reply-section-title">Cold Email</div>');
        if (lead.cold_email.subject) html.push('<div class="ma-reply-email-subject">' + escapeHtml(lead.cold_email.subject) + '</div>');
        if (lead.cold_email.body) html.push('<div class="ma-reply-section-body">' + escapeHtml(lead.cold_email.body).replace(/\n/g, '<br>') + '</div>');
        html.push('</div>');
      }
      if (lead.follow_up) {
        html.push('<div class="ma-reply-section">');
        html.push('<div class="ma-reply-section-title">Follow-up</div>');
        html.push('<div class="ma-reply-section-body">' + escapeHtml(lead.follow_up).replace(/\n/g, '<br>') + '</div>');
        html.push('</div>');
      }
      html.push('</div>');
    });
    html.push('</div>');
    return html.join('');
  }

  function appendStructuredOrMarkdown(replyText) {
    var el = getMessagesEl();
    if (!el) return;
    var div = document.createElement('div');
    div.className = 'chat-msg bot';
    var trimmed = (replyText || '').trim();
    if (!trimmed) {
      div.textContent = 'No response.';
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
      return;
    }
    var parsed = null;
    if (trimmed.charAt(0) === '{') {
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {}
    }
    var structuredHtml = parsed ? renderStructuredReply(parsed) : '';
    if (structuredHtml) {
      div.classList.add('ma-reply-wrapper');
      div.innerHTML = structuredHtml;
    } else {
      div.classList.add('chat-msg-markdown');
      div.innerHTML = renderMarkdown(trimmed);
    }
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  var typingEl = null;

  function showTyping() {
    var el = getMessagesEl();
    if (!el) return;
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    var div = document.createElement('div');
    div.className = 'chat-msg bot chat-typing-indicator';
    div.innerHTML = '<span class="chat-typing-dots"><span></span><span></span><span></span></span><span class="chat-typing-label">AI is typing…</span>';
    el.appendChild(div);
    typingEl = div;
    el.scrollTop = el.scrollHeight;
  }

  function removeTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  function setInputLoading(loading) {
    var input = document.getElementById('message-assistant-input');
    var form = document.getElementById('message-assistant-form');
    var submit = form && form.querySelector('button[type="submit"]');
    if (input) input.disabled = loading;
    if (submit) submit.disabled = loading;
  }

  function getOrCreateConversationId() {
    try {
      var key = 'message_assistant_conversation_id';
      var id = sessionStorage.getItem(key);
      if (!id) {
        id = 'conv-' + Date.now();
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return 'conv-' + Date.now();
    }
  }

  function sendMessage(message) {
    var leads = global.leads && typeof global.leads.getLastGeneratedLeads === 'function' ? global.leads.getLastGeneratedLeads() : [];
    var conversationId = getOrCreateConversationId();
    var payload = { message: message, leads: leads, conversation_id: conversationId };
    appendMessage(message, true);
    setInputLoading(true);
    showTyping();

    function doRequest() {
      return fetch('/api/message-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
    }

    function processResponse(res, txt) {
      var data;
      try { data = txt && txt.trim() ? JSON.parse(txt) : null; } catch (e) { data = null; }
      removeTyping();
      if (res.status === 503) {
        appendMessage((data && data.error) || 'Message assistant webhook is not configured. Add N8N_MESSAGE_ASSISTANT_WEBHOOK to .env.', false);
        return;
      }
      if (!res.ok) {
        appendMessage((data && data.error) || 'Could not reach the assistant.', false);
        return;
      }
      var reply = (data && typeof data.reply === 'string') ? data.reply : parseResponse(data);
      if (typeof reply !== 'string') reply = reply ? String(reply) : '';
      appendStructuredOrMarkdown(reply || 'No response.');
    }

    function runRequest() {
      return doRequest().then(function (res) {
        return res.text().then(function (txt) {
          if (res.status === 401) {
            return fetch('/auth/session', { credentials: 'same-origin' }).then(function (r) {
              if (!r.ok) {
                processResponse(res, txt);
                return null;
              }
              return doRequest();
            }).then(function (retryRes) {
              if (!retryRes) return;
              return retryRes.text().then(function (retryTxt) {
                processResponse(retryRes, retryTxt);
              });
            });
          }
          processResponse(res, txt);
        });
      });
    }

    runRequest()
      .catch(function () {
        removeTyping();
        appendMessage('Could not reach the assistant. Check your connection.', false);
      })
      .finally(function () {
        setInputLoading(false);
      });
  }

  function openAndPreFill(prompt) {
    var card = document.getElementById('ai-assistant-card');
    var input = document.getElementById('message-assistant-input');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (input) {
      input.value = prompt || '';
      input.focus();
    }
  }

  function init() {
    var form = document.getElementById('message-assistant-form');
    var input = document.getElementById('message-assistant-input');

    var btnMessages = document.getElementById('btn-next-step-messages');
    if (btnMessages) btnMessages.addEventListener('click', function () { openAndPreFill('Write personalized LinkedIn outreach messages for these leads.'); });
    var btnColdEmail = document.getElementById('btn-next-step-cold-email');
    if (btnColdEmail) btnColdEmail.addEventListener('click', function () { openAndPreFill('Write cold emails for these leads.'); });
    document.querySelectorAll('.ai-quick-action').forEach(function (btn) {
      var prompt = btn.getAttribute('data-prompt');
      if (prompt) btn.addEventListener('click', function () { openAndPreFill(prompt); });
    });

    if (form && input) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = (input.value || '').trim();
        if (!text) return;
        input.value = '';
        sendMessage(text);
      });
    }

    var el = getMessagesEl();
    if (el && el.children.length === 0) {
      appendMessage('Ask for message ideas, tone, or how to approach these leads. I’ll use the leads you generated above to tailor the advice.', false);
    }
  }

  global.messageAssistant = {
    init: init,
    sendMessage: sendMessage,
    openAndPreFill: openAndPreFill
  };
})(typeof window !== 'undefined' ? window : this);
