// VoiceIQ — Main App Logic

// ─── API Layer ────────────────────────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://voiceiq-backend-production-2b83.up.railway.app';

function getToken() { return localStorage.getItem('voiceiq_token'); }
function setToken(t) { localStorage.setItem('voiceiq_token', t); }
function clearToken() { localStorage.removeItem('voiceiq_token'); }

async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) { clearToken(); showLogin(); return; }
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app-wrapper').style.display = 'none';
  // Init Google button after GSI script loads
  if (window.google?.accounts) initGoogleSignIn();
  else window.addEventListener('load', initGoogleSignIn, { once: true });
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'block';
}

function togglePasswordVisibility() {
  const input = document.getElementById('login-password');
  const icon  = document.getElementById('pw-eye-icon');
  if (input.type === 'password') { input.type = 'text'; icon.className = 'ti ti-eye-off'; }
  else { input.type = 'password'; icon.className = 'ti ti-eye'; }
}

function toggleUserMenu() {
  const m = document.getElementById('user-menu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', e => {
  const chip = document.querySelector('.user-chip');
  const menu = document.getElementById('user-menu');
  if (menu && chip && !chip.contains(e.target)) menu.style.display = 'none';
});

function setUserUI(user) {
  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const el = id => document.getElementById(id);
  if (el('user-avatar'))    el('user-avatar').textContent    = initials;
  if (el('user-name'))      el('user-name').textContent      = user.name;
  if (el('user-menu-name')) el('user-menu-name').textContent = user.name;
  if (el('user-menu-email'))el('user-menu-email').textContent= user.email;
}

async function doLogin() {
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> Signing in…';

  try {
    const res  = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Login failed');

    setToken(data.token);
    setUserUI(data.user);
    showApp();
    initApp();
  } catch (err) {
    errEl.textContent    = err.message;
    errEl.style.display  = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-login"></i> Sign in';
  }
}

async function doLogout() {
  clearToken();
  showLogin();
  document.getElementById('user-menu').style.display = 'none';
  document.getElementById('login-email').value    = '';
  document.getElementById('login-password').value = '';
}

// ─── Google Sign-In ───────────────────────────────────────────────────────────
function initGoogleSignIn() {
  if (!window.google?.accounts) return;

  // Fetch the Google Client ID from backend health endpoint is not ideal;
  // we embed it via a meta tag approach — read from a global set by the page
  const clientId = window.GOOGLE_CLIENT_ID;
  if (!clientId) return;

  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredential,
    auto_select: false,
  });

  google.accounts.id.renderButton(
    document.getElementById('google-signin-btn'),
    {
      theme: 'filled_black',
      size: 'large',
      width: 340,
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
    }
  );
}

async function handleGoogleCredential(response) {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  try {
    const res  = await fetch(`${API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google login failed');

    setToken(data.token);
    setUserUI(data.user);
    showApp();
    initApp();
  } catch (err) {
    errEl.textContent   = err.message;
    errEl.style.display = 'block';
  }
}

async function checkAuth() {
  const token = getToken();
  if (!token) { showLogin(); return; }

  try {
    const res  = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Invalid token');
    const data = await res.json();
    setUserUI(data.user);
    showApp();
    initApp();
  } catch {
    clearToken();
    showLogin();
  }
}

// ─── WebSocket for live call updates ─────────────────────────────────────────
function connectWebSocket() {
  const wsUrl = API_BASE.replace('http', 'ws') + '/ws';
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => console.log('WS connected');
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleLiveEvent(msg);
    } catch {}
  };
  ws.onclose = () => setTimeout(connectWebSocket, 3000); // auto-reconnect
  return ws;
}

function handleLiveEvent(msg) {
  if (msg.type === 'call.started') {
    showToast(`📞 New call started — ${msg.data?.fromNumber || ''}`, 'info');
  } else if (msg.type === 'call.ended') {
    showToast(`✅ Call ended — ${msg.data?.duration}s`, 'success');
  } else if (msg.type === 'call.summary') {
    showToast(`📋 Call summary ready`, 'success');
  }
}

// ─── Toast notifications ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;padding:12px 18px;border-radius:10px;
    background:var(--bg-card);border:1px solid var(--border2);color:var(--text1);
    font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);
    animation:fadeIn .2s ease;max-width:320px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ─── Load & render all dashboard data ────────────────────────────────────────
async function loadDashboard() {
  try {
    const [analyticsRes, agentsRes, callsRes, eventsRes] = await Promise.allSettled([
      api('/api/calls/analytics/summary'),
      api('/api/agents'),
      api('/api/calls'),
      api('/api/calendar/events?maxResults=5&daysAhead=1'),
    ]);

    // Metric cards — from real computed analytics
    if (analyticsRes.status === 'fulfilled') {
      renderDashboardMetrics(analyticsRes.value?.today || {});
    }

    if (agentsRes.status === 'fulfilled' && agentsRes.value?.agents) {
      const agents = agentsRes.value.agents;
      renderDashboardAgents(agents);
      renderAgentsPage(agents);
      // Update active agent count in subtitle
      const activeCount = agents.filter(a => a.status === 'active').length;
      const sub = document.getElementById('page-sub');
      const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
      if (sub) sub.textContent = `${today} · UK Business Hours · ${activeCount} agent${activeCount !== 1 ? 's' : ''} active`;
    }

    if (callsRes.status === 'fulfilled') {
      const calls = callsRes.value?.calls || [];
      renderLiveCalls(calls);
      renderRecentActivity(calls);
    }

    if (eventsRes.status === 'fulfilled' && eventsRes.value?.events) {
      const events = eventsRes.value.events;
      renderUpcomingBookings(events);
      console.log('Calendar events loaded:', events.length);
    }
  } catch (err) {
    console.warn('Dashboard load error:', err.message);
  }
}

// ─── Dashboard metric cards ───────────────────────────────────────────────────
function renderDashboardMetrics(today) {
  // today = { total, answered, answerRate, booked, bookingRate, avgScore }
  const conversion = today.bookingRate != null ? today.bookingRate + '%' : '—';
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('dash-calls-today',  today.total      ?? 0);
  set('dash-bookings',     today.booked     ?? 0);
  set('dash-answer-rate',  (today.answerRate ?? 0) + '%');
  set('dash-conversion',   conversion);
}

// ─── Live calls table ─────────────────────────────────────────────────────────
function renderLiveCalls(calls) {
  const tbody   = document.getElementById('live-calls-tbody');
  const countEl = document.getElementById('live-calls-count');
  if (!tbody) return;

  const live = calls.filter(c => c.status === 'active' || c.status === 'live');
  if (countEl) countEl.textContent = live.length ? `${live.length} active now` : 'No active calls';

  if (!live.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3)">No live calls right now</td></tr>`;
    return;
  }

  const colors = [
    ['var(--accent-dim)','var(--accent)'],
    ['var(--purple-dim)','var(--purple)'],
    ['var(--green-dim)', 'var(--green)'],
    ['var(--amber-dim)', 'var(--amber)'],
  ];
  tbody.innerHTML = live.map((c, i) => {
    const name     = c.leadData?.name || c.toNumber || 'Unknown';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const [bg, fg] = colors[i % colors.length];
    return `<tr>
      <td><div class="flex items-center gap-2">
        <div class="avatar" style="width:28px;height:28px;background:${bg};color:${fg}">${initials}</div>
        <span class="bold">${name}</span>
      </div></td>
      <td class="font-mono">${c.toNumber || '—'}</td>
      <td>${c.campaignName || '—'}</td>
      <td class="font-mono live-timer bold" data-base="0">00:00</td>
      <td><span class="badge live">Live</span></td>
    </tr>`;
  }).join('');
  initLiveTimers();
}

// ─── Dashboard agents mini-panel ──────────────────────────────────────────────
function renderDashboardAgents(agents) {
  const el = document.getElementById('dash-agents-list');
  if (!el) return;
  const colors = ['var(--accent-dim)', 'var(--purple-dim)', 'var(--green-dim)', 'var(--amber-dim)'];
  el.innerHTML = agents.map((a, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 18px;${i < agents.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
      <div style="width:34px;height:34px;background:${colors[i % colors.length]};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px">🎙</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:500;color:var(--text1)">${a.name}</div>
        <div style="font-size:10px;color:var(--text3)">${a.accent} · ${a.gender}</div>
      </div>
      <div class="status-dot ${a.status === 'active' ? 'on' : 'off'}"></div>
    </div>
  `).join('');
}

// ─── Agents page cards ────────────────────────────────────────────────────────
function renderAgentsPage(agents) {
  const grid = document.getElementById('agents-grid');
  if (!grid) return;

  // Keep the "New Agent" dashed card (last child)
  const newCard = grid.querySelector('[onclick*="new-agent"]')?.closest('.card') || grid.lastElementChild;
  [...grid.children].forEach(c => { if (c !== newCard) c.remove(); });

  const colors = ['var(--accent-dim)', 'var(--purple-dim)', 'var(--green-dim)', 'var(--amber-dim)'];
  agents.forEach((a, i) => {
    const posPct = Math.round((a.stats?.answerRate || 0.7) * 90);
    const neuPct = 20;
    const negPct = Math.max(0, 100 - posPct - neuPct);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header">
        <div class="flex items-center gap-2">
          <div style="width:38px;height:38px;background:${colors[i % colors.length]};border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:20px">🎙</div>
          <div><div class="card-title">${a.name}</div><div class="card-sub">${a.accent} · ${a.gender}</div></div>
        </div>
        <div class="flex items-center gap-2">
          <div class="status-dot ${a.status === 'active' ? 'on' : 'off'}"></div>
          <span style="font-size:11px;color:${a.status === 'active' ? 'var(--green)' : 'var(--text3)'}">${a.status === 'active' ? 'Active' : 'Paused'}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="flex justify-between mb-4" style="margin-bottom:12px">
          <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:var(--text1)">${a.stats?.callsToday || 0}</div><div style="font-size:10px;color:var(--text3)">Calls today</div></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:var(--green)">${a.stats?.bookings || 0}</div><div style="font-size:10px;color:var(--text3)">Bookings</div></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:var(--text1)">${Math.round((a.stats?.answerRate || 0) * 100)}%</div><div style="font-size:10px;color:var(--text3)">Answer rate</div></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:var(--purple)">${a.stats?.avgScore || '—'}</div><div style="font-size:10px;color:var(--text3)">Avg score</div></div>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:10px;color:var(--text3);margin-bottom:5px">Sentiment — last 50 calls</div>
          <div class="sentiment-bar">
            <div class="sent-pos" data-pct="${posPct}" style="width:0%;transition:width .8s ease"></div>
            <div class="sent-neu" style="width:${neuPct}%"></div>
            <div class="sent-neg" style="width:${negPct}%"></div>
          </div>
          <div class="flex gap-3 mt-4" style="margin-top:6px">
            <span style="font-size:10px;color:var(--green)">● Positive ${posPct}%</span>
            <span style="font-size:10px;color:var(--amber)">● Neutral ${neuPct}%</span>
            <span style="font-size:10px;color:var(--red)">● Negative ${negPct}%</span>
          </div>
        </div>
        <div class="flex gap-2" style="margin-top:14px">
          <button class="btn btn-ghost btn-sm w-full"><i class="ti ti-settings"></i> Configure</button>
          <button class="btn btn-danger btn-sm"><i class="ti ti-player-pause"></i> Pause</button>
        </div>
      </div>`;
    grid.insertBefore(card, newCard);
  });

  setTimeout(animateSentiment, 300);
}

// ─── Today's bookings (calendar) ──────────────────────────────────────────────
function renderUpcomingBookings(events) {
  const el      = document.getElementById('upcoming-bookings');
  const dateEl  = document.getElementById('bookings-date');
  if (!el) return;

  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  }

  if (!events.length) {
    el.innerHTML = `<div style="padding:24px 18px;text-align:center;color:var(--text3);font-size:12px">No bookings today</div>`;
    return;
  }

  el.innerHTML = events.map((ev, i) => {
    const start   = new Date(ev.start);
    const timeStr = start.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const attendees = ev.attendees?.map(a => a.email || a).join(', ') || 'No attendees';
    return `
      <div style="padding:12px 18px;${i < events.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
        <div class="flex justify-between items-center mb-4" style="margin-bottom:6px">
          <span style="font-size:12px;font-weight:600;color:var(--text1)">${ev.title}</span>
          <span class="badge booked">${timeStr}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);line-height:1.6">
          ${attendees}${ev.meetLink ? ` · <a href="${ev.meetLink}" target="_blank" style="color:var(--accent)">Join Meet</a>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ─── Recent AI activity ───────────────────────────────────────────────────────
function renderRecentActivity(calls) {
  const tbody = document.getElementById('recent-activity-tbody');
  if (!tbody) return;

  const recent = calls.filter(c => c.status !== 'active' && c.status !== 'live').slice(0, 5);

  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">No recent activity</td></tr>`;
    return;
  }

  const outcomeMap = {
    meeting_booked: { cls: 'badge active',  label: 'Meeting booked' },
    booked:         { cls: 'badge active',  label: 'Meeting booked' },
    qualified:      { cls: 'badge booked',  label: 'Qualified' },
    transferred:    { cls: 'badge pending', label: 'Escalated' },
    escalated:      { cls: 'badge pending', label: 'Escalated' },
    no_answer:      { cls: 'badge', label: 'No answer', style: 'background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)' },
    'no-answer':    { cls: 'badge', label: 'No answer', style: 'background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)' },
    completed:      { cls: 'badge pending', label: 'Completed' },
  };

  tbody.innerHTML = recent.map(c => {
    const name      = c.leadData?.name || c.toNumber || 'Unknown';
    const outcome   = c.summary?.outcome || c.outcome || 'completed';
    const o         = outcomeMap[outcome] || { cls: 'badge pending', label: outcome };
    const score     = c.summary?.avgCallScore || c.score;
    const scoreColor = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--amber)' : 'var(--text3)';
    const summaryText = c.summary?.summary || c.summary || '—';
    const timeAgo   = c.endedAt ? Math.round((Date.now() - new Date(c.endedAt)) / 60000) + ' min' : '—';
    return `<tr>
      <td><span class="${o.cls}" ${o.style ? `style="${o.style}"` : ''}>${o.label}</span></td>
      <td>${c.agentId || '—'}</td>
      <td class="bold">${name}</td>
      <td>${summaryText}</td>
      <td style="color:${scoreColor};font-weight:600">${score || '—'}</td>
      <td class="text-dim">${timeAgo}</td>
    </tr>`;
  }).join('');
}

// ─── Make outbound call (Twilio) ─────────────────────────────────────────────
async function makeCall({ toNumber, agentId = 'james', leadData = {} }) {
  try {
    showToast(`📞 Initiating call to ${toNumber}...`, 'info');
    const result = await api('/api/twilio/call', {
      method: 'POST',
      body: JSON.stringify({ toNumber, agentId, leadData }),
    });
    showToast(`✅ Call initiated — ${result.twilioCallSid}`, 'success');
    return result;
  } catch (err) {
    showToast(`❌ Call failed: ${err.message}`, 'error');
    throw err;
  }
}

// ─── Render call log page ─────────────────────────────────────────────────────
async function loadCallLog() {
  const tbody = document.getElementById('call-log-tbody');
  if (!tbody) return;

  try {
    const data = await api('/api/calls');
    const calls = data.calls || [];

    // Update metric cards
    const today = new Date().toDateString();
    const todayCalls = calls.filter(c => new Date(c.loggedAt || c.endedAt).toDateString() === today);
    const outbound = todayCalls.filter(c => c.direction === 'outbound').length;
    const booked = todayCalls.filter(c => c.summary?.outcome === 'meeting_booked' || c.outcome === 'booked').length;
    const durations = todayCalls.filter(c => c.duration > 0).map(c => c.duration);
    const avgDur = durations.length ? Math.round(durations.reduce((a,b) => a+b,0) / durations.length) : 0;
    const avgDurStr = avgDur ? `${Math.floor(avgDur/60)}:${String(avgDur%60).padStart(2,'0')}` : '—';

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('calls-outbound-today', outbound);
    set('calls-total-today', todayCalls.length);
    set('calls-avg-duration', avgDurStr);
    set('calls-booked-today', booked);

    if (!calls.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">No calls yet — make your first call from the Twilio Calling page</td></tr>`;
      return;
    }

    const outcomeMap = {
      meeting_booked: { cls: 'badge active',  label: 'Booked' },
      booked:         { cls: 'badge active',  label: 'Booked' },
      qualified:      { cls: 'badge booked',  label: 'Qualified' },
      transferred:    { cls: 'badge pending', label: 'Transferred' },
      no_answer:      { cls: 'badge',         label: 'No answer', style: 'background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)' },
      'no-answer':    { cls: 'badge',         label: 'No answer', style: 'background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)' },
      completed:      { cls: 'badge pending', label: 'Completed' },
    };

    tbody.innerHTML = calls.map(c => {
      const name     = c.leadData?.name || c.toNumber || 'Unknown';
      const number   = c.toNumber || c.fromNumber || '—';
      const dur      = c.duration ? `${Math.floor(c.duration/60)}:${String(c.duration%60).padStart(2,'0')}` : '—';
      const outcome  = c.summary?.outcome || c.outcome || 'completed';
      const o        = outcomeMap[outcome] || { cls: 'badge pending', label: outcome };
      const score    = c.summary?.avgCallScore || c.score;
      const scoreColor = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--amber)' : 'var(--red)';
      const dirIcon  = c.direction === 'inbound'
        ? `<i class="ti ti-phone-incoming" style="color:var(--green)"></i> In`
        : `<i class="ti ti-phone-outgoing" style="color:var(--accent)"></i> Out`;

      return `<tr>
        <td class="bold">${name}</td>
        <td class="font-mono">${number}</td>
        <td><span class="badge mobile">${c.channel || 'Twilio'}</span></td>
        <td>${dirIcon}</td>
        <td class="font-mono">${dur}</td>
        <td><span class="${o.cls}" ${o.style ? `style="${o.style}"` : ''}>${o.label}</span></td>
        <td style="color:${scoreColor};font-weight:600">${score || '—'}</td>
        <td><button class="btn btn-ghost btn-sm"><i class="ti ti-eye"></i></button></td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">Could not load calls</td></tr>`;
  }
}

// ─── Load calendar events (used by Calendar page) ────────────────────────────
async function loadCalendarEvents() {
  try {
    const data = await api('/api/calendar/events?maxResults=10&daysAhead=14');
    return data.events;
  } catch (err) {
    console.warn('Calendar load error:', err.message);
    return [];
  }
}

// NAV
function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.page-section').forEach(el => {
    el.classList.toggle('active', el.id === 'page-' + page);
  });
  document.getElementById('page-title').textContent = pageTitles[page] || page;
  document.getElementById('page-sub').textContent = pageSubs[page] || '';
  renderPageActions(page);

  // Load page-specific data
  if (page === 'calls')     loadCallLog();
  if (page === 'teams')     loadTwilioStatus();
  if (page === 'agents')    loadTwilioStatus();
  if (page === 'campaigns') loadCampaigns();
}

const pageTitles = {
  dashboard: 'Dashboard',
  agents: 'AI Voice Agents',
  campaigns: 'Campaigns',
  calls: 'Call Log',
  calendar: 'Calendar & Bookings',
  prompt: 'Prompt Builder',
  crm: 'CRM & Leads',
  analytics: 'Analytics',
  integrations: 'Integrations',
  settings: 'Settings',
  teams: 'Twilio Calling'
};
const pageSubs = {
  dashboard: new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' }) + ' · UK Business Hours',
  agents: 'Create and manage your AI voice agents',
  campaigns: 'Outbound calling campaigns',
  calls: 'Live and historical call data',
  calendar: 'Google Calendar — auto-booking enabled',
  prompt: 'Build and customise AI conversation scripts',
  crm: 'Leads, contacts and follow-ups',
  analytics: 'Performance metrics and insights',
  integrations: 'Connected services and APIs',
  settings: 'Account, billing and preferences',
  teams: 'Twilio outbound calling integration'
};

function renderPageActions(page) {
  const el = document.getElementById('page-actions-slot');
  const map = {
    dashboard: `<button class="btn btn-primary" onclick="openModal('new-campaign')"><i class="ti ti-plus"></i> New Campaign</button>`,
    agents: `<button class="btn btn-ghost btn-sm"><i class="ti ti-upload"></i> Import</button><button class="btn btn-primary" onclick="openModal('new-agent')"><i class="ti ti-plus"></i> New Agent</button>`,
    campaigns: `<label class="btn btn-ghost btn-sm" style="cursor:pointer"><i class="ti ti-upload"></i> Upload Excel<input type="file" accept=".xlsx,.xls" style="display:none" onchange="uploadLeads(this)"></label><button class="btn btn-primary" onclick="openModal('new-campaign')"><i class="ti ti-plus"></i> New Campaign</button>`,
    calls: `<button class="btn btn-ghost btn-sm"><i class="ti ti-download"></i> Export</button>`,
    calendar: `<button class="btn btn-ghost btn-sm"><i class="ti ti-brand-google"></i> Sync Google</button><button class="btn btn-primary"><i class="ti ti-plus"></i> Manual Book</button>`,
    prompt: `<button class="btn btn-ghost btn-sm"><i class="ti ti-copy"></i> Duplicate</button><button class="btn btn-primary"><i class="ti ti-device-floppy"></i> Save Script</button>`,
    crm: `<label class="btn btn-ghost btn-sm" style="cursor:pointer"><i class="ti ti-upload"></i> Import Excel<input type="file" accept=".xlsx,.xls" style="display:none" onchange="uploadLeads(this)"></label><button class="btn btn-primary"><i class="ti ti-plus"></i> Add Lead</button>`,
    analytics: `<select class="form-select" style="width:130px;padding:7px 10px"><option>Last 7 days</option><option>Last 30 days</option><option>This month</option></select>`,
    integrations: `<button class="btn btn-ghost btn-sm"><i class="ti ti-refresh"></i> Refresh</button>`,
    teams: `<span id="twilio-status"></span>`,
    settings: ``
  };
  el.innerHTML = map[page] || '';
}

// MODAL
function openModal(id) {
  document.getElementById('modal-' + id).classList.add('open');
  if (id === 'new-campaign') initScheduleSelects();
}
function closeModal(id) {
  document.getElementById('modal-' + id).classList.remove('open');
}
window.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// TOGGLE
function toggleSwitch(el) { el.classList.toggle('on'); }

// TABS
function switchTab(group, id) {
  document.querySelectorAll(`[data-tabgroup="${group}"]`).forEach(el => {
    el.classList.toggle('active', el.dataset.tab === id);
  });
  document.querySelectorAll(`[data-tabcontent="${group}"]`).forEach(el => {
    el.style.display = el.dataset.content === id ? 'block' : 'none';
  });
}

// TWILIO STATUS
async function loadTwilioStatus() {
  try {
    const status = await api('/api/twilio/status');
    const el = document.getElementById('twilio-status');
    const numEl = document.getElementById('twilio-calling-number');
    if (status.connected) {
      if (el) el.innerHTML = `<span class="badge active">Connected</span>`;
      if (numEl) numEl.textContent = status.defaultNumber || '—';
    } else {
      if (el) el.innerHTML = `<span class="badge" style="background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)">Not connected</span>`;
    }
  } catch {}
}

// ─── Campaigns ───────────────────────────────────────────────────────────────
async function loadCampaigns() {
  const tbody = document.getElementById('campaigns-tbody');
  if (!tbody) return;

  try {
    const data = await api('/api/campaigns');
    const campaigns = data.campaigns || [];

    // Update metric cards
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('camp-active-count', data.meta?.activeCount ?? 0);
    set('camp-total-leads',  (data.meta?.totalLeads ?? 0).toLocaleString());
    set('camp-total-booked', data.meta?.totalBooked ?? 0);
    set('camp-total-count',  campaigns.length);

    if (!campaigns.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">No campaigns yet — click <strong>+ New Campaign</strong> to get started</td></tr>`;
      return;
    }

    const colors = ['var(--accent)', 'var(--purple)', 'var(--green)', 'var(--amber)'];
    tbody.innerHTML = campaigns.map((c, i) => {
      const color    = colors[i % colors.length];
      const pct      = c.leadCount > 0 ? Math.round((c.reached / c.leadCount) * 100) : 0;
      const convRate = c.reached  > 0 ? ((c.booked / c.reached) * 100).toFixed(1) + '%' : '—';
      const statusCls = c.status === 'active' ? 'badge active' : c.status === 'paused' ? 'badge paused' : 'badge pending';
      const statusLabel = c.status.charAt(0).toUpperCase() + c.status.slice(1);
      return `<tr>
        <td class="bold">${c.name}</td>
        <td>${c.agentId || '—'}</td>
        <td>${c.leadCount || 0}</td>
        <td><div style="display:flex;align-items:center;gap:8px">
          <div class="prog-bar" style="flex:1;width:80px"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div>
          <span style="font-size:11px;color:${color}">${c.status === 'draft' ? 'Draft' : pct + '%'}</span>
        </div></td>
        <td style="color:var(--green);font-weight:600">${c.booked || '—'}</td>
        <td>${convRate}</td>
        <td><span class="${statusCls}">${statusLabel}</span></td>
        <td><button class="btn btn-ghost btn-sm" onclick="deleteCampaign('${c.id}')"><i class="ti ti-trash"></i></button></td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">Could not load campaigns</td></tr>`;
  }
}

// ─── Schedule helpers ────────────────────────────────────────────────────────
// Generate AM/PM options (30-min increments) and populate all .sched-options selects
function initScheduleSelects() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m of [0, 30]) {
      const val    = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label  = `${hour12}:${String(m).padStart(2,'0')} ${period}`;
      options.push({ val, label });
    }
  }

  const defaults = {
    from: { mon:'08:00', tue:'08:00', wed:'08:00', thu:'08:00', fri:'08:00', sat:'09:00', sun:'10:00', 'apply-all':'08:00' },
    to:   { mon:'18:00', tue:'18:00', wed:'18:00', thu:'18:00', fri:'18:00', sat:'13:00', sun:'14:00', 'apply-all':'18:00' },
  };

  document.querySelectorAll('.sched-options').forEach(sel => {
    const day  = sel.dataset.day || (sel.id === 'apply-all-from' ? 'apply-all' : 'apply-all');
    const type = sel.classList.contains('sched-from') || sel.id === 'apply-all-from' ? 'from' : 'to';
    const def  = defaults[type][day] || (type === 'from' ? '08:00' : '18:00');
    sel.innerHTML = options.map(o => `<option value="${o.val}"${o.val === def ? ' selected' : ''}>${o.label}</option>`).join('');
  });

  updateSchedulePreview();
}

// Toggle a day on/off
function toggleDay(checkbox) {
  const row = checkbox.closest('.sched-row');
  row.querySelectorAll('select').forEach(s => s.disabled = !checkbox.checked);
  row.style.opacity = checkbox.checked ? '1' : '0.5';
  updateSchedulePreview();
}

// Apply "Apply all" from/to to all currently enabled days
function applyToAllDays() {
  const from = document.getElementById('apply-all-from')?.value;
  const to   = document.getElementById('apply-all-to')?.value;
  const days = ['mon','tue','wed','thu','fri','sat','sun'];
  days.forEach(d => {
    const enabled = document.querySelector(`.sched-toggle[data-day="${d}"]`)?.checked;
    if (!enabled) return;
    const fromSel = document.querySelector(`.sched-from[data-day="${d}"]`);
    const toSel   = document.querySelector(`.sched-to[data-day="${d}"]`);
    if (fromSel) fromSel.value = from;
    if (toSel)   toSel.value   = to;
  });
  updateSchedulePreview();
  showToast('⏰ Times applied to all enabled days', 'success');
}

// Live preview
function updateSchedulePreview() {
  const preview = document.getElementById('camp-hours-preview');
  if (!preview) return;
  const days   = ['mon','tue','wed','thu','fri','sat','sun'];
  const labels = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };
  const fmt    = v => { if (!v) return ''; const [h,m] = v.split(':'); const hr=+h; return `${hr===0?12:hr>12?hr-12:hr}:${m} ${hr<12?'AM':'PM'}`; };

  const active = days.filter(d => document.querySelector(`.sched-toggle[data-day="${d}"]`)?.checked);
  if (!active.length) { preview.textContent = '⚠️ No calling days selected'; return; }

  const parts = active.map(d => {
    const from = document.querySelector(`.sched-from[data-day="${d}"]`)?.value || '08:00';
    const to   = document.querySelector(`.sched-to[data-day="${d}"]`)?.value   || '18:00';
    return `${labels[d]} ${fmt(from)}–${fmt(to)}`;
  });
  preview.textContent = `📞 ${parts.join(' · ')}`;
}

// Build schedule object for API
function getSchedule() {
  const days = ['mon','tue','wed','thu','fri','sat','sun'];
  const schedule = {};
  days.forEach(d => {
    schedule[d] = {
      enabled: document.querySelector(`.sched-toggle[data-day="${d}"]`)?.checked || false,
      from:    document.querySelector(`.sched-from[data-day="${d}"]`)?.value || '08:00',
      to:      document.querySelector(`.sched-to[data-day="${d}"]`)?.value   || '18:00',
    };
  });
  return schedule;
}

async function createCampaign() {
  const name       = document.getElementById('camp-name')?.value?.trim();
  const agentId    = document.getElementById('camp-agent')?.value;
  const dailyLimit = document.getElementById('camp-daily-limit')?.value;
  const startDate  = document.getElementById('camp-start-date')?.value;
  const timezone  = document.getElementById('camp-timezone')?.value || 'Europe/London';
  const schedule  = getSchedule();
  const fileInput = document.getElementById('camp-leads-file');

  if (!name) { showToast('Campaign name is required', 'error'); return; }

  try {
    const campaign = await api('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name, agentId, dailyLimit, startDate, timezone, schedule }),
    });

    // Upload leads file if provided
    if (fileInput?.files?.[0]) {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('campaignId', campaign.id);

      const res  = await fetch(`${API_BASE}/api/leads/upload`, { method: 'POST', body: formData });
      const data = await res.json();

      if (data.imported) {
        await api(`/api/campaigns/${campaign.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ leadCount: data.imported, status: 'active' }),
        });
        showToast(`✅ Campaign created — ${data.imported} leads imported`, 'success');
      }
    } else {
      showToast(`✅ Campaign "${name}" created as draft`, 'success');
    }

    closeModal('new-campaign');
    loadCampaigns();
  } catch (err) {
    showToast(`❌ Failed: ${err.message}`, 'error');
  }
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign?')) return;
  await api(`/api/campaigns/${id}`, { method: 'DELETE' });
  showToast('Campaign deleted', 'success');
  loadCampaigns();
}

// ─── Upload Excel leads ───────────────────────────────────────────────────────
async function uploadLeads(input) {
  const file = input.files[0];
  if (!file) return;

  showToast(`📂 Uploading ${file.name}…`, 'info');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/api/leads/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    showToast(`✅ Imported ${data.imported} leads${data.skipped ? ` (${data.skipped} skipped — no phone)` : ''}`, 'success');
    input.value = ''; // reset file input
  } catch (err) {
    showToast(`❌ Upload failed: ${err.message}`, 'error');
  }
}

async function triggerTestCall() {
  const toNumber = document.getElementById('test-call-number')?.value?.trim();
  const agentId  = document.getElementById('test-call-agent')?.value || 'james';
  if (!toNumber) { showToast('Enter a number to call', 'error'); return; }
  await makeCall({ toNumber, agentId });
}

// CALL TIMER
function startCallTimer(el) {
  let s = 0;
  setInterval(() => {
    s++;
    el.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }, 1000);
}

// SENTIMENT ANIMATION
function animateSentiment() {
  document.querySelectorAll('.sent-pos').forEach(el => {
    const pct = el.dataset.pct || 70;
    el.style.width = '0%';
    setTimeout(() => { el.style.transition = 'width .8s ease'; el.style.width = pct + '%'; }, 200);
  });
}

// CHART BARS
function buildBarChart(containerId, data, color) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const max = Math.max(...data.map(d => d.v));
  el.innerHTML = data.map(d => `
    <div class="bar-col">
      <div class="bar-val">${d.v}</div>
      <div class="bar" style="height:${Math.round((d.v/max)*80)+10}px;background:${d.today ? color : color+'55'}"></div>
      <div class="bar-label">${d.l}</div>
    </div>
  `).join('');
}

// LIVE CALL SECONDS
function initLiveTimers() {
  document.querySelectorAll('.live-timer').forEach(el => {
    let base = parseInt(el.dataset.base || 0);
    setInterval(() => { base++; el.textContent = `${String(Math.floor(base/60)).padStart(2,'0')}:${String(base%60).padStart(2,'0')}`; }, 1000);
  });
}

// AGENT STATUS ROTATION
const statusMessages = ['2 live calls active','Processing objection...','Booking meeting...','Qualifying lead...'];
let smIdx = 0;
function rotateStatus() {
  const el = document.getElementById('agent-live-sub');
  if (el) { smIdx = (smIdx+1) % statusMessages.length; el.textContent = statusMessages[smIdx]; }
}

// PROMPT VARIABLES
function insertVar(v) {
  const ta = document.getElementById('prompt-ta');
  if (!ta) return;
  const pos = ta.selectionStart;
  ta.value = ta.value.slice(0, pos) + `{{${v}}}` + ta.value.slice(pos);
  ta.focus();
}

// LEAD SCORE COLOR
function scoreColor(s) {
  if (s >= 80) return 'var(--green)';
  if (s >= 50) return 'var(--amber)';
  return 'var(--red)';
}

// NOTIFICATION PANEL
function toggleNotifPanel() {
  const p = document.getElementById('notif-panel');
  p.style.display = p.style.display === 'block' ? 'none' : 'block';
}
document.addEventListener('click', e => {
  const p = document.getElementById('notif-panel');
  if (!p) return;
  if (!p.contains(e.target) && !document.getElementById('notif-btn').contains(e.target)) {
    p.style.display = 'none';
  }
});

// SEARCH
function doSearch(q) {
  if (!q) return;
  const pages = Object.entries(pageTitles);
  const match = pages.find(([k,v]) => v.toLowerCase().includes(q.toLowerCase()));
  if (match) navigate(match[0]);
}

// INIT
function initApp() {
  navigate('dashboard');
  initLiveTimers();
  setTimeout(animateSentiment, 500);
  setInterval(rotateStatus, 4000);
  buildBarChart('call-chart', [
    {l:'Mon',v:0},{l:'Tue',v:0},{l:'Wed',v:0},{l:'Thu',v:0},{l:'Fri',v:0,today:true},{l:'Sat',v:0},{l:'Sun',v:0}
  ], 'var(--accent)');
  buildBarChart('conv-chart', [
    {l:'Mon',v:0},{l:'Tue',v:0},{l:'Wed',v:0},{l:'Thu',v:0},{l:'Fri',v:0,today:true},{l:'Sat',v:0},{l:'Sun',v:0}
  ], 'var(--green)');
  loadTwilioStatus();
  connectWebSocket();
  loadDashboard();
}

window.addEventListener('DOMContentLoaded', async () => {
  // Fetch Google Client ID from backend and store globally
  try {
    const cfg = await fetch(`${API_BASE}/api/auth/config`).then(r => r.json());
    if (cfg.googleClientId) window.GOOGLE_CLIENT_ID = cfg.googleClientId;
  } catch {}

  await checkAuth();
});
