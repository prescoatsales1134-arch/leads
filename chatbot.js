/**
 * AI Chatbot widget: POST to same-origin /api/chatbot; server forwards to n8n (avoids CORS).
 * Response parsing mirrors shopify_integration1 parseTutuChatResponse — server passes through n8n body, frontend extracts reply.
 */
(function (global) {
  var conversationId = null;

  function parseChatResponse(data) {
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

  function ensureConversationId() {
    if (!conversationId) conversationId = 'conv-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    return conversationId;
  }

  function getMessagesEl() {
    return document.getElementById('chat-messages');
  }

  function escapeHtml(str) {
    if (str == null) return '';
    var s = String(str);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Simple markdown → HTML for bot replies (headings, bold, lists, paragraphs).
   * Escapes HTML first so output is safe.
   */
  function renderMarkdown(text) {
    if (text == null || typeof text !== 'string') return '';
    var s = escapeHtml(text).trim();
    if (!s) return '';
    var lines = s.split(/\r?\n/);
    var out = [];
    var inList = false;
    var bold = function (t) { return t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); };
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
        var bullet = trimmed.replace(/^[-*]\s*/, '');
        out.push('<li class="chat-md-li">' + bold(bullet) + '</li>');
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

  var typingIndicatorEl = null;

  function showTypingIndicator() {
    var el = getMessagesEl();
    if (!el) return;
    removeTypingIndicator();
    var div = document.createElement('div');
    div.className = 'chat-msg bot chat-typing-indicator';
    div.setAttribute('aria-live', 'polite');
    div.innerHTML = '<span class="chat-typing-dots"><span></span><span></span><span></span></span><span class="chat-typing-label">Assistant is typing…</span>';
    el.appendChild(div);
    typingIndicatorEl = div;
    el.scrollTop = el.scrollHeight;
  }

  function removeTypingIndicator() {
    if (typingIndicatorEl && typingIndicatorEl.parentNode) {
      typingIndicatorEl.parentNode.removeChild(typingIndicatorEl);
    }
    typingIndicatorEl = null;
  }

  function setInputLoading(loading) {
    var input = document.getElementById('chat-input');
    var submit = document.getElementById('chat-form') && document.getElementById('chat-form').querySelector('button[type="submit"]');
    if (input) input.disabled = loading;
    if (submit) submit.disabled = loading;
  }

  function sendMessage(message) {
    appendMessage(message, true);
    setInputLoading(true);
    showTypingIndicator();

    var body = {
      message: message,
      conversation_id: ensureConversationId()
    };

    return fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.text().then(function (txt) {
          removeTypingIndicator();
          var data;
          try { data = txt && txt.trim() ? JSON.parse(txt) : null; } catch (e) { data = null; }
          if (res.status === 503) {
            appendMessage((data && data.error) || 'Chatbot webhook is not configured. Add N8N_CHATBOT_WEBHOOK to .env.', false);
            return;
          }
          if (!res.ok) {
            appendMessage((data && data.error) || 'Could not reach the assistant. Check your webhook and network.', false);
            return;
          }
          if (data == null) {
            console.error('Chatbot: response not JSON', txt ? txt.substring(0, 200) : '(empty)');
            appendMessage('Invalid response from server. Check the console.', false);
            return;
          }
          var reply = (data && typeof data.reply === 'string') ? data.reply : parseChatResponse(data);
          if (!reply) {
            console.error('Chatbot: no reply in response', data);
          }
          appendMessage(reply || 'No response from assistant.', false);
        });
      })
      .catch(function () {
        removeTypingIndicator();
        appendMessage('Could not reach the assistant. Check your webhook and network.', false);
      })
      .finally(function () {
        setInputLoading(false);
      });
  }

  // Attach chat close as soon as script runs so close works even before init()
  (function attachChatClose() {
    var panel = document.getElementById('chat-panel');
    var close = document.getElementById('chat-close');
    if (close && panel) {
      close.addEventListener('click', function () {
        panel.hidden = true;
      });
    }
  })();

  function init() {
    var toggle = document.getElementById('chat-toggle');
    var panel = document.getElementById('chat-panel');
    var form = document.getElementById('chat-form');
    var input = document.getElementById('chat-input');

    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        var open = panel.hidden;
        panel.hidden = !open;
        if (open && input) input.focus();
      });
    }

    if (form && input) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = (input.value || '').trim();
        if (!text) return;
        input.value = '';
        sendMessage(text);
      });
    }

    // Optional: welcome message
    var el = getMessagesEl();
    if (el && el.children.length === 0) {
      appendMessage('Ask me how to generate leads, e.g. “How do I generate real estate leads?” or “Which filters should I use?”', false);
    }
  }

  global.chatbot = {
    init: init,
    sendMessage: sendMessage
  };
})(typeof window !== 'undefined' ? window : this);
