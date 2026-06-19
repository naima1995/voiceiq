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
  if (window.google?.accounts?.oauth2) initGoogleSignIn();
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
// Uses initTokenClient with prompt:'select_account' so the user always
// sees the full Google account chooser — even if already signed in elsewhere.
let googleTokenClient = null;

function initGoogleSignIn() {
  if (!window.google?.accounts?.oauth2) return;
  const clientId = window.GOOGLE_CLIENT_ID;
  if (!clientId) return;

  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'email profile openid',
    prompt: 'select_account',
    callback: handleGoogleToken,
    error_callback: (err) => {
      const errEl = document.getElementById('login-error');
      errEl.textContent   = 'Google sign-in was cancelled or failed.';
      errEl.style.display = 'block';
    },
  });
}

function signInWithGoogle() {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!googleTokenClient) {
    // Try to init if GSI script loaded late
    initGoogleSignIn();
    if (!googleTokenClient) {
      errEl.textContent   = 'Google Sign-In is not ready yet. Please try again.';
      errEl.style.display = 'block';
      return;
    }
  }
  // Always force the account chooser
  googleTokenClient.requestAccessToken({ prompt: 'select_account' });
}

async function handleGoogleToken(tokenResponse) {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (tokenResponse.error) {
    errEl.textContent   = 'Google sign-in was cancelled.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('google-signin-btn');
  const origText = btn.innerHTML;
  btn.disabled  = true;
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg> Verifying…`;

  try {
    const res  = await fetch(`${API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: tokenResponse.access_token }),
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
    btn.disabled  = false;
    btn.innerHTML = origText;
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

// Track active call count for the sidebar live card
let _liveCallCount = 0;

function updateSidebarLiveCard() {
  const footer = document.getElementById('sidebar-footer');
  const nameEl = document.getElementById('agent-live-name');
  const subEl  = document.getElementById('agent-live-sub');
  if (!footer) return;
  if (_liveCallCount > 0) {
    footer.style.display = '';
    if (subEl) subEl.textContent = _liveCallCount === 1 ? '1 live call active' : `${_liveCallCount} live calls active`;
  } else {
    footer.style.display = 'none';
    if (nameEl) nameEl.textContent = '—';
  }
}

function handleLiveEvent(msg) {
  if (msg.type === 'call.started') {
    _liveCallCount++;
    const agentId = msg.data?.agentId || '';
    const nameEl  = document.getElementById('agent-live-name');
    if (nameEl && agentId) nameEl.textContent = agentId.charAt(0).toUpperCase() + agentId.slice(1) + ' — Active';
    updateSidebarLiveCard();
    showToast(`📞 New call started — ${msg.data?.fromNumber || ''}`, 'info');
  } else if (msg.type === 'call.ended') {
    _liveCallCount = Math.max(0, _liveCallCount - 1);
    updateSidebarLiveCard();
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
    const [analyticsRes, agentsRes, callsRes, eventsRes, campaignsRes] = await Promise.allSettled([
      api('/api/calls/analytics/summary'),
      api('/api/agents'),
      api('/api/calls'),
      api('/api/calendar/events?maxResults=5&daysAhead=1'),
      api('/api/campaigns'),
    ]);

    // Metric cards — from real computed analytics
    if (analyticsRes.status === 'fulfilled') {
      const av = analyticsRes.value || {};
      renderDashboardMetrics(av.today || {}, av.yesterday || {});
      if (av.weekly) renderWeeklyChart(av.weekly);
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

    if (campaignsRes.status === 'fulfilled') {
      renderDashboardCampaigns(campaignsRes.value?.campaigns || []);
    }
  } catch (err) {
    console.warn('Dashboard load error:', err.message);
  }
}

function renderDashboardCampaigns(campaigns) {
  const container = document.getElementById('dash-active-campaigns');
  const countEl   = document.getElementById('dash-active-campaigns-count');
  if (!container) return;

  const active = campaigns.filter(c => c.status === 'active');
  if (countEl) countEl.textContent = active.length ? `${active.length} running` : 'none running';

  if (!active.length) {
    container.innerHTML = `<div style="padding:24px 18px;text-align:center;color:var(--text3);font-size:12px">No active campaigns</div>`;
    return;
  }

  const barColors = ['var(--accent)', 'var(--purple)', 'var(--green)', 'var(--amber)'];
  container.innerHTML = active.map((c, i) => {
    const total   = c.leadCount   || 0;
    const called  = c.calledCount || 0;
    const booked  = c.bookings    || 0;
    const pct     = total > 0 ? Math.round((called / total) * 100) : 0;
    const color   = barColors[i % barColors.length];
    const isLast  = i === active.length - 1;
    return `
      <div style="padding:10px 18px;${isLast ? '' : 'border-bottom:1px solid var(--border)'}">
        <div class="flex justify-between items-center" style="margin-bottom:6px">
          <span style="font-size:12px;font-weight:500;color:var(--text1)">${escHtml(c.name)}</span>
          <span style="font-size:11px;font-weight:600;color:${color}">${pct}%</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div>
        <div style="font-size:10px;color:var(--text3);margin-top:5px">${called} / ${total} leads${booked ? ` · ${booked} booked` : ''}</div>
      </div>`;
  }).join('');
}

// ─── Dashboard metric cards ───────────────────────────────────────────────────
function renderDashboardMetrics(today, yesterday = {}) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('dash-calls-today',  today.total      ?? 0);
  set('dash-bookings',     today.booked     ?? 0);
  set('dash-answer-rate',  (today.answerRate ?? 0) + '%');
  set('dash-conversion',   today.bookingRate != null ? today.bookingRate + '%' : '—');

  // Helper — builds "+N vs yesterday" or "same as yesterday"
  function trendText(todayVal, yestVal, suffix = '') {
    if (yestVal == null || (todayVal === 0 && yestVal === 0)) return 'no data yesterday';
    const diff = todayVal - yestVal;
    if (diff === 0) return 'same as yesterday';
    return `${diff > 0 ? '+' : ''}${diff}${suffix} vs yesterday`;
  }
  function trendClass(todayVal, yestVal) {
    if (yestVal == null) return 'neutral';
    return todayVal > yestVal ? 'up' : todayVal < yestVal ? 'down' : 'neutral';
  }
  function trendIcon(cls) {
    if (cls === 'up')   return '<i class="ti ti-trending-up" style="font-size:13px"></i> ';
    if (cls === 'down') return '<i class="ti ti-trending-down" style="font-size:13px"></i> ';
    return '';
  }

  function setTrend(id, todayVal, yestVal, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    const cls  = trendClass(todayVal, yestVal);
    const text = trendText(todayVal, yestVal, suffix);
    el.className = `metric-trend ${cls}`;
    el.innerHTML = trendIcon(cls) + text;
  }

  setTrend('dash-calls-trend',      today.total      ?? 0, yesterday.total,       '');
  setTrend('dash-bookings-trend',    today.booked     ?? 0, yesterday.booked,      '');
  setTrend('dash-answer-trend',      today.answerRate ?? 0, yesterday.answerRate,  '%');
  setTrend('dash-conversion-trend',  today.bookingRate ?? 0, yesterday.bookingRate, '%');
}

// ─── Weekly call volume chart ─────────────────────────────────────────────────
function renderWeeklyChart(weekly) {
  const el = document.getElementById('call-chart');
  if (!el) return;

  const maxCalls = Math.max(...weekly.map(d => d.calls), 1);

  el.innerHTML = weekly.map(d => {
    const pct    = Math.round((d.calls / maxCalls) * 100);
    const bPct   = d.calls > 0 ? Math.round((d.booked / d.calls) * 100) : 0;
    const isToday = d === weekly[weekly.length - 1];
    return `
      <div class="bar-col" title="${d.calls} call${d.calls !== 1 ? 's' : ''}${d.booked ? `, ${d.booked} booked` : ''}">
        <div class="bar-val">${d.calls || ''}</div>
        <div class="bar-wrap">
          <div class="bar-fill${isToday ? ' today' : ''}" style="height:${pct}%">
            ${d.booked ? `<div class="bar-booked" style="height:${bPct}%"></div>` : ''}
          </div>
        </div>
        <div class="bar-label${isToday ? ' today' : ''}">${d.label}</div>
      </div>`;
  }).join('');
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
        <!-- settings mini-bar -->
        ${a.settings ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;background:var(--bg-card2);border-radius:8px;padding:8px 10px">
          ${[['Creativity',a.settings.creativity],['Patience',a.settings.patience],['Stability',a.settings.stability],['Voice Speed',a.settings.voiceSpeed]].map(([label,val])=>`
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:10px;color:var(--text3)">${label}</span><span style="font-size:10px;font-weight:600;color:var(--accent)">${val}%</span></div>
            <div style="height:4px;background:var(--bg-hover);border-radius:2px"><div style="height:4px;width:${val}%;background:var(--accent);border-radius:2px"></div></div>
          </div>`).join('')}
        </div>` : ''}
        <div class="flex gap-2" style="margin-top:14px">
          <button class="btn btn-ghost btn-sm w-full" onclick="openEditAgent('${a.id}')"><i class="ti ti-settings"></i> Configure</button>
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

  const recent = calls.filter(c => c.status !== 'active' && c.status !== 'live').slice(0, 8);

  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">No recent activity</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(c => {
    const name    = c.toNumber || 'Unknown';
    const agentId = c.agentId;
    const agentLabel = agentId ? agentId.charAt(0).toUpperCase() + agentId.slice(1) : '—';

    // Determine outcome badge
    const isBooked   = !!(c.bookingId || c.outcome === 'meeting_booked' || c.summary?.outcome === 'meeting_booked');
    const rawOutcome = c.summary?.outcome || c.outcome || '';
    let badge, badgeStyle = '';
    if (isBooked) {
      badge = 'Meeting booked'; badgeStyle = 'background:var(--green-dim);color:var(--green);border:1px solid rgba(34,197,94,.2)';
    } else if (rawOutcome === 'no_answer' || rawOutcome === 'no-answer') {
      badge = 'No answer'; badgeStyle = 'background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)';
    } else if (rawOutcome === 'qualified') {
      badge = 'Qualified'; badgeStyle = '';
    } else if (rawOutcome === 'transferred' || rawOutcome === 'escalated') {
      badge = 'Escalated'; badgeStyle = '';
    } else {
      badge = 'Completed'; badgeStyle = '';
    }

    const summaryText = c.summary?.summary || '—';
    const score       = c.summary?.avgCallScore;
    const scoreColor  = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--amber)' : 'var(--text3)';
    const ts          = c.endedAt || c.loggedAt;
    const timeAgo     = ts ? (() => {
      const mins = Math.round((Date.now() - new Date(ts)) / 60000);
      if (mins < 60)   return `${mins}m ago`;
      if (mins < 1440) return `${Math.round(mins/60)}h ago`;
      return new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    })() : '—';

    const callRef = c.callId || c.id;
    return `<tr style="cursor:pointer" onclick="viewCall('${callRef}')" title="View call detail">
      <td><span class="badge" style="${badgeStyle}">${badge}</span></td>
      <td>${agentLabel}</td>
      <td class="bold font-mono" style="font-size:11px">${name}</td>
      <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text3);font-size:11px">${summaryText}</td>
      <td style="color:${scoreColor};font-weight:600">${score || '—'}</td>
      <td class="text-dim">${timeAgo}</td>
    </tr>`;
  }).join('');
}

// ─── Call detail modal ───────────────────────────────────────────────────────
async function viewCall(callId) {
  openModal('call-detail');
  document.getElementById('call-detail-title').textContent = 'Call Detail';
  document.getElementById('call-detail-sub').textContent   = '';
  document.getElementById('call-detail-body').innerHTML    = `<div style="text-align:center;padding:24px;color:var(--text3)">Loading…</div>`;

  try {
    const c = await api(`/api/calls/${callId}`);
    const s = c.summary || {};

    const isBooked   = !!(c.bookingId || c.outcome === 'meeting_booked' || s.outcome === 'meeting_booked');
    const agentLabel = c.agentId ? c.agentId.charAt(0).toUpperCase() + c.agentId.slice(1) : '—';
    const dur        = c.duration ? `${Math.floor(c.duration/60)}:${String(c.duration%60).padStart(2,'0')}` : '—';
    const ts         = c.endedAt || c.loggedAt;
    const dateLabel  = ts ? new Date(ts).toLocaleString('en-GB', { timeZone:'Europe/London', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const score      = s.avgCallScore;
    const scoreColor = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--amber)' : 'var(--red)';

    document.getElementById('call-detail-title').textContent = c.toNumber || 'Call Detail';
    document.getElementById('call-detail-sub').textContent   = dateLabel;

    function row(label, value) {
      return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:12px;color:var(--text3);min-width:130px">${label}</span>
        <span style="font-size:12px;font-weight:500;text-align:right;flex:1">${value}</span>
      </div>`;
    }

    let html = `<div>`;
    html += row('Agent',     agentLabel);
    html += row('Number',    `<span class="font-mono">${c.toNumber || '—'}</span>`);
    html += row('Direction', c.direction === 'inbound' ? 'Inbound' : 'Outbound');
    html += row('Channel',   c.channel || 'Twilio');
    html += row('Duration',  `<span class="font-mono">${dur}</span>`);
    html += row('Status',    c.status || '—');
    html += row('Outcome',   isBooked
      ? `<span class="badge active" style="background:var(--green-dim);color:var(--green);border:1px solid rgba(34,197,94,.2)">Meeting booked</span>`
      : `<span class="badge pending">${c.outcome || 'Completed'}</span>`);
    html += row('Meeting booked', isBooked ? '✅ Yes' : '—');
    if (c.bookingId) html += row('Booking ref', `<span class="font-mono" style="font-size:11px">${c.bookingId}</span>`);
    html += `</div>`;

    if (s.summary) {
      html += `<div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">AI Summary</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6;background:var(--bg-hover);padding:12px;border-radius:8px">${escHtml(s.summary)}</div>
      </div>`;
    }

    if (score) {
      html += `<div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Call Score</div>
        <div style="font-size:22px;font-weight:700;color:${scoreColor}">${score}<span style="font-size:13px;color:var(--text3)">/10</span></div>
        ${s.sentiment ? `<span class="badge pending" style="margin-left:auto">${s.sentiment}</span>` : ''}
      </div>`;
    }

    if (s.nextAction) {
      html += `<div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Next Action</div>
        <div style="font-size:12px;color:var(--text2)">${escHtml(s.nextAction)}</div>
      </div>`;
    }

    document.getElementById('call-detail-body').innerHTML = html;
  } catch (err) {
    document.getElementById('call-detail-body').innerHTML = `<div style="color:var(--red);font-size:12px">Failed to load call: ${escHtml(err.message)}</div>`;
  }
}

// ─── Make outbound call (Twilio) ─────────────────────────────────────────────
async function makeCall({ toNumber, agentId = 'james', leadData = {} }) {
  toNumber = normalisePhone(toNumber);
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
    const booked = todayCalls.filter(c => c.bookingId || c.outcome === 'meeting_booked' || c.summary?.outcome === 'meeting_booked').length;
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
      const dirIcon  = c.direction === 'inbound'
        ? `<i class="ti ti-phone-incoming" style="color:var(--green)"></i> In`
        : `<i class="ti ti-phone-outgoing" style="color:var(--accent)"></i> Out`;
      const isBooked = !!(c.bookingId || outcome === 'meeting_booked' || c.summary?.outcome === 'meeting_booked');
      const meetingCell = isBooked
        ? `<span class="badge active" style="background:var(--green-dim);color:var(--green);border:1px solid rgba(34,197,94,.2)">Yes</span>`
        : `<span class="badge" style="background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)">No</span>`;

      return `<tr>
        <td class="bold">${name}</td>
        <td class="font-mono">${number}</td>
        <td><span class="badge mobile">${c.channel || 'Twilio'}</span></td>
        <td>${dirIcon}</td>
        <td class="font-mono">${dur}</td>
        <td><span class="${o.cls}" ${o.style ? `style="${o.style}"` : ''}>${o.label}</span></td>
        <td>${meetingCell}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewCall('${c.callId || c.id}')"><i class="ti ti-eye"></i></button></td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">Could not load calls</td></tr>`;
  }
}

// ─── Calendar page state ──────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Mo','Tu','We','Th','Fr','Sa','Su'];

let _calView   = 'month';   // 'day' | 'week' | 'month'
let _calAnchor = new Date(); // reference date for current view
let _calEvents = [];

async function loadCalendarEvents() {
  try {
    const data = await api('/api/calendar/events?maxResults=200&daysAhead=90');
    return data.events || [];
  } catch (err) {
    console.warn('Calendar load error:', err.message);
    return [];
  }
}

async function initCalendar() {
  _calAnchor = new Date();
  _calEvents = await loadCalendarEvents();
  setCalView(_calView);
}

function setCalView(view) {
  _calView = view;
  ['day','week','month'].forEach(v => {
    const btn = document.getElementById('cal-view-' + v);
    if (btn) btn.style.background = v === view ? 'var(--bg-card)' : '';
  });
  renderCalView();
}

function calPrev() {
  const a = new Date(_calAnchor);
  if (_calView === 'day')   a.setDate(a.getDate() - 1);
  if (_calView === 'week')  a.setDate(a.getDate() - 7);
  if (_calView === 'month') a.setMonth(a.getMonth() - 1);
  _calAnchor = a;
  renderCalView();
}

function calNext() {
  const a = new Date(_calAnchor);
  if (_calView === 'day')   a.setDate(a.getDate() + 1);
  if (_calView === 'week')  a.setDate(a.getDate() + 7);
  if (_calView === 'month') a.setMonth(a.getMonth() + 1);
  _calAnchor = a;
  renderCalView();
}

function renderCalView() {
  if (_calView === 'month') renderMonthView();
  if (_calView === 'week')  renderWeekView();
  if (_calView === 'day')   renderDayView();
}

// ── helpers ──────────────────────────────────────────────────────────────────
function isoDate(d) { return d.toLocaleDateString('en-CA'); }
function eventsOn(dateKey) { return _calEvents.filter(ev => isoDate(new Date(ev.start)) === dateKey); }
function timeStr(d) { return new Date(d).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }); }
function isBooking(ev) { return /reminder|call back|call reminder/i.test(ev.title || ''); }

function eventPill(ev) {
  const cls = isBooking(ev) ? 'background:var(--green-dim);color:var(--green)' : 'background:var(--accent-dim);color:var(--accent)';
  return `<div style="font-size:10px;padding:1px 5px;border-radius:4px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${cls}">${timeStr(ev.start)} ${ev.title || 'Event'}</div>`;
}

function setLabel(text) {
  const el = document.getElementById('cal-month-label');
  if (el) el.textContent = text;
}

function showDayHeaders() {
  document.getElementById('cal-wrapper')?.classList.remove('cal-day-view');
}
function hideDayHeaders() {
  document.getElementById('cal-wrapper')?.classList.add('cal-day-view');
}

// ── Month view ────────────────────────────────────────────────────────────────
function renderMonthView() {
  const grid = document.getElementById('cal-grid-days');
  if (!grid) return;
  showDayHeaders();

  const yr = _calAnchor.getFullYear(), mo = _calAnchor.getMonth();
  setLabel(`${MONTHS[mo]} ${yr}`);

  const today    = new Date();
  const firstDay = new Date(yr, mo, 1);
  const lastDay  = new Date(yr, mo + 1, 0);
  const offset   = (firstDay.getDay() + 6) % 7;
  const prevLast = new Date(yr, mo, 0).getDate();

  const cells = [];
  for (let i = offset - 1; i >= 0; i--)
    cells.push(`<div class="cal-day other-month"><span class="cal-day-num">${prevLast - i}</span></div>`);

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date    = new Date(yr, mo, d);
    const key     = isoDate(date);
    const evs     = eventsOn(key);
    const isToday = today.getFullYear() === yr && today.getMonth() === mo && today.getDate() === d;
    const hasBk   = evs.some(isBooking);
    const cls = 'cal-day' + (isToday ? ' today' : '') + (hasBk ? ' booked' : evs.length ? ' has-event' : '');
    const pills = evs.slice(0, 2).map(eventPill).join('') + (evs.length > 2 ? `<div style="font-size:9px;color:var(--text3);margin-top:2px">+${evs.length-2} more</div>` : '');
    cells.push(`<div class="${cls}" onclick="renderDayPanel(new Date(${yr},${mo},${d}))"><span class="cal-day-num">${d}</span>${pills}</div>`);
  }

  const total    = offset + lastDay.getDate();
  const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= trailing; d++)
    cells.push(`<div class="cal-day other-month"><span class="cal-day-num">${d}</span></div>`);

  // Mark last row so its bottom border is removed
  const lastRowStart = cells.length - ((cells.length % 7) || 7);
  for (let i = lastRowStart; i < cells.length; i++)
    cells[i] = cells[i].replace('class="cal-day', 'class="cal-day last-row');

  grid.innerHTML = cells.join('');
  renderDayPanel(_calAnchor);
}

// ── Week view ─────────────────────────────────────────────────────────────────
function renderWeekView() {
  const grid = document.getElementById('cal-grid-days');
  if (!grid) return;
  showDayHeaders();

  // Find Monday of the anchor's week
  const anchor = new Date(_calAnchor);
  const dow    = (anchor.getDay() + 6) % 7; // Mon=0
  anchor.setDate(anchor.getDate() - dow);

  const yr1 = anchor.getFullYear(), mo1 = anchor.getMonth(), d1 = anchor.getDate();
  const end  = new Date(anchor); end.setDate(end.getDate() + 6);
  setLabel(`${d1} ${MONTHS[mo1]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`);

  const today = new Date();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const date    = new Date(anchor); date.setDate(anchor.getDate() + i);
    const key     = isoDate(date);
    const evs     = eventsOn(key);
    const isToday = isoDate(date) === isoDate(today);
    const hasBk   = evs.some(isBooking);
    const cls = 'cal-day last-row' + (isToday ? ' today' : '') + (hasBk ? ' booked' : evs.length ? ' has-event' : '');
    const pills = evs.map(eventPill).join('');
    html += `<div class="${cls}" onclick="renderDayPanel(new Date(${date.getFullYear()},${date.getMonth()},${date.getDate()}))"><span class="cal-day-num">${date.getDate()}</span>${pills}</div>`;
  }

  grid.innerHTML = html;
  renderDayPanel(_calAnchor);
}

// ── Day view ──────────────────────────────────────────────────────────────────
function renderDayView() {
  const grid = document.getElementById('cal-grid-days');
  if (!grid) return;
  hideDayHeaders();

  const today = new Date();
  setLabel(_calAnchor.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }));

  const key  = isoDate(_calAnchor);
  const evs  = eventsOn(key).sort((a, b) => new Date(a.start) - new Date(b.start));

  // 8am–8pm hourly slots
  let html = '<div style="display:grid;grid-template-columns:48px 1fr;gap:0;width:100%">';
  for (let h = 8; h <= 20; h++) {
    const label = `${String(h).padStart(2,'0')}:00`;
    const slotEvs = evs.filter(ev => new Date(ev.start).getHours() === h);
    const isNow   = isoDate(today) === key && today.getHours() === h;
    html += `
      <div style="font-size:10px;color:var(--text3);padding:8px 6px 8px 0;text-align:right;border-top:1px solid var(--border)">${label}</div>
      <div style="border-top:1px solid var(--border);padding:4px 8px;min-height:36px;${isNow ? 'background:var(--accent-dim)' : ''}">
        ${slotEvs.map(ev => {
          const bg = isBooking(ev) ? 'var(--green-dim)' : 'var(--accent-dim)';
          const fg = isBooking(ev) ? 'var(--green)'     : 'var(--accent)';
          return `<div onclick="showEventDetail(${JSON.stringify(ev).replace(/"/g,'&quot;')})" style="font-size:11px;padding:3px 8px;border-radius:6px;background:${bg};color:${fg};margin-bottom:2px;cursor:pointer;font-weight:500">
            ${timeStr(ev.start)} · ${ev.title || 'Event'}
          </div>`;
        }).join('')}
      </div>`;
  }
  html += '</div>';
  grid.innerHTML = html;
  renderDayPanel(_calAnchor);
}

// ── Right panel: bookings list for selected day ───────────────────────────────
function renderDayPanel(date) {
  const titleEl = document.getElementById('cal-panel-title');
  const dateEl  = document.getElementById('bookings-date');
  const el      = document.getElementById('upcoming-bookings');
  if (!el) return;

  _calAnchor = new Date(date);
  const isToday = isoDate(date) === isoDate(new Date());
  if (titleEl) titleEl.textContent = isToday ? "Today's Bookings" : "Bookings";
  if (dateEl)  dateEl.textContent  = date.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

  const evs = eventsOn(isoDate(date)).sort((a, b) => new Date(a.start) - new Date(b.start));

  if (!evs.length) {
    el.innerHTML = `<div style="padding:24px 18px;text-align:center;color:var(--text3);font-size:12px">No bookings on this day</div>`;
    return;
  }

  el.innerHTML = evs.map((ev, i) => {
    const desc = ev.description ? ev.description.split('\n').filter(l => l.trim()).slice(0,3).join('<br>') : '';
    return `
      <div style="padding:12px 18px;${i < evs.length-1 ? 'border-bottom:1px solid var(--border)' : ''};cursor:pointer" onclick="showEventDetail(${JSON.stringify(ev).replace(/"/g,'&quot;')})">
        <div class="flex justify-between items-center" style="margin-bottom:4px">
          <span style="font-size:12px;font-weight:600;color:var(--text1)">${ev.title || 'Booking'}</span>
          <span class="badge booked">${timeStr(ev.start)}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);line-height:1.6">${desc}</div>
        ${ev.htmlLink ? `<a href="${ev.htmlLink}" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none">View in Google Calendar →</a>` : ''}
      </div>`;
  }).join('');
}

function showEventDetail(ev) {
  if (typeof ev === 'string') try { ev = JSON.parse(ev); } catch(e) { return; }
  // Remove existing detail panel if any
  document.getElementById('cal-detail-overlay')?.remove();

  const desc = ev.description ? ev.description.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>') : 'No notes.';
  const overlay = document.createElement('div');
  overlay.id = 'cal-detail-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center`;
  overlay.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border2);border-radius:16px;padding:24px;width:480px;max-width:90vw;max-height:80vh;overflow-y:auto;position:relative">
      <button onclick="document.getElementById('cal-detail-overlay').remove()" style="position:absolute;top:14px;right:14px;background:none;border:none;cursor:pointer;color:var(--text3);font-size:18px">✕</button>
      <div style="font-size:15px;font-weight:700;color:var(--text1);margin-bottom:6px;padding-right:24px">${ev.title || 'Event'}</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">${timeStr(ev.start)}${ev.end ? ' – ' + timeStr(ev.end) : ''}</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.8">${desc}</div>
      ${ev.htmlLink ? `<a href="${ev.htmlLink}" target="_blank" style="display:inline-block;margin-top:16px;font-size:12px;color:var(--accent);text-decoration:none">Open in Google Calendar →</a>` : ''}
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ─── Analytics ────────────────────────────────────────────────────────────────
let _anView = 'week';

function setAnalyticsView(view) {
  _anView = view;
  ['day','week','month'].forEach(v => {
    const btn = document.getElementById('an-view-' + v);
    if (btn) btn.style.background = v === view ? 'var(--bg-card)' : '';
  });
  loadAnalytics();
}

async function loadAnalytics() {
  const now   = new Date();
  let from, to, label, chartLabel, agentLabel;

  if (_anView === 'day') {
    from = new Date(now); from.setHours(0,0,0,0);
    to   = new Date(now); to.setHours(23,59,59,999);
    label      = 'Today — ' + now.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    chartLabel = 'Today by hour';
    agentLabel = 'Today';
  } else if (_anView === 'week') {
    const dow = (now.getDay() + 6) % 7;
    from = new Date(now); from.setDate(now.getDate() - dow); from.setHours(0,0,0,0);
    to   = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23,59,59,999);
    label      = from.toLocaleDateString('en-GB', { day:'numeric', month:'short' }) + ' – ' + to.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    chartLabel = 'This week by day';
    agentLabel = 'This week';
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    label      = now.toLocaleDateString('en-GB', { month:'long', year:'numeric' });
    chartLabel = 'This month by week';
    agentLabel = 'This month';
  }

  const labelEl = document.getElementById('an-period-label');
  if (labelEl) labelEl.textContent = label;
  const chartLabelEl = document.getElementById('an-chart-label');
  if (chartLabelEl) chartLabelEl.textContent = chartLabel;
  const agentLabelEl = document.getElementById('an-agent-label');
  if (agentLabelEl) agentLabelEl.textContent = agentLabel;

  // Fetch calls in range
  let calls = [];
  try {
    const params = new URLSearchParams({ limit: 1000, from: from.toISOString(), to: to.toISOString() });
    const data = await api('/api/calls?' + params);
    calls = data.calls || [];
  } catch (e) {
    console.warn('Analytics fetch failed', e.message);
  }

  // Also fetch agents for performance section
  let agents = [];
  try {
    const data = await api('/api/agents');
    agents = data.agents || [];
  } catch (e) {}

  // KPI calculations
  const total    = calls.length;
  const answered = calls.filter(c => !['no-answer','no_answer','busy','failed','canceled'].includes(c.outcome || c.status)).length;
  const booked   = calls.filter(c => c.outcome === 'meeting_booked' || c.outcome === 'booked').length;
  const answerRate = total ? Math.round((answered / total) * 100) : 0;
  const bookRate   = answered ? Math.round((booked / answered) * 100) : 0;
  const scores   = calls.map(c => c.summary?.avgCallScore).filter(Boolean);
  const avgScore = scores.length ? (scores.reduce((a,b) => a+b,0) / scores.length).toFixed(1) : '—';

  setText('an-calls',       total || '0');
  setText('an-bookings',    booked || '0');
  setText('an-answer-rate', total ? answerRate + '%' : '—');
  setText('an-score',       avgScore);
  setText('an-calls-label', _anView === 'day' ? 'Calls Today' : _anView === 'week' ? 'Calls This Week' : 'Calls This Month');
  setText('an-calls-trend', total ? answered + ' answered · ' + bookRate + '% booking rate' : 'No calls yet');
  setText('an-bookings-trend', booked ? bookRate + '% booking rate' : 'No bookings yet');
  setText('an-answer-trend', total ? answered + ' of ' + total + ' answered' : '');

  // Chart
  renderAnalyticsChart(calls, from, to);

  // Agent performance
  renderAgentPerformance(calls, agents);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderAnalyticsChart(calls, from, to) {
  const chart = document.getElementById('conv-chart');
  if (!chart) return;

  // Build buckets depending on view
  let buckets = [];
  if (_anView === 'day') {
    // Hourly 8am–8pm
    for (let h = 8; h <= 20; h++) {
      const label = String(h).padStart(2,'0') + ':00';
      const inBucket = calls.filter(c => {
        const d = new Date(c.loggedAt || c.createdAt);
        return d.getHours() === h;
      });
      buckets.push({ label, total: inBucket.length, booked: inBucket.filter(c => c.outcome === 'meeting_booked').length });
    }
  } else if (_anView === 'week') {
    const DNAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    for (let i = 0; i < 7; i++) {
      const day = new Date(from); day.setDate(from.getDate() + i);
      const key = day.toLocaleDateString('en-CA');
      const inBucket = calls.filter(c => new Date(c.loggedAt || c.createdAt).toLocaleDateString('en-CA') === key);
      buckets.push({ label: DNAMES[i], total: inBucket.length, booked: inBucket.filter(c => c.outcome === 'meeting_booked').length });
    }
  } else {
    // Monthly — group by week number within month
    const weeks = Math.ceil((new Date(from.getFullYear(), from.getMonth()+1,0).getDate()) / 7);
    for (let w = 0; w < weeks; w++) {
      const wStart = new Date(from); wStart.setDate(1 + w * 7);
      const wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
      const inBucket = calls.filter(c => {
        const d = new Date(c.loggedAt || c.createdAt);
        return d >= wStart && d <= wEnd;
      });
      buckets.push({ label: 'Wk ' + (w+1), total: inBucket.length, booked: inBucket.filter(c => c.outcome === 'meeting_booked').length });
    }
  }

  const maxVal = Math.max(...buckets.map(b => b.total), 1);
  chart.innerHTML = buckets.map(b => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
      <div style="display:flex;align-items:flex-end;gap:2px;height:80px">
        <div title="${b.booked} bookings" style="width:14px;background:var(--green);border-radius:3px 3px 0 0;height:${Math.round((b.booked/maxVal)*80)}px;min-height:${b.booked?2:0}px;transition:height .3s"></div>
        <div title="${b.total} calls" style="width:14px;background:var(--accent);border-radius:3px 3px 0 0;height:${Math.round((b.total/maxVal)*80)}px;min-height:${b.total?2:0}px;transition:height .3s"></div>
      </div>
      <div style="font-size:10px;color:var(--text3)">${b.label}</div>
      <div style="font-size:9px;color:var(--text3)">${b.total}</div>
    </div>`).join('');
}

function renderAgentPerformance(calls, agents) {
  const el = document.getElementById('an-agent-perf');
  if (!el) return;

  // Group calls by agentId
  const agentMap = {};
  calls.forEach(c => {
    if (!c.agentId) return;
    if (!agentMap[c.agentId]) agentMap[c.agentId] = { calls: 0, booked: 0, scores: [] };
    agentMap[c.agentId].calls++;
    if (c.outcome === 'meeting_booked') agentMap[c.agentId].booked++;
    if (c.summary?.avgCallScore) agentMap[c.agentId].scores.push(c.summary.avgCallScore);
  });

  const agentIds = Object.keys(agentMap);
  if (!agentIds.length) {
    el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px">No call data for this period</div>`;
    return;
  }

  const COLORS = ['var(--green)','var(--accent)','var(--purple)','var(--amber)'];
  const rows = agentIds
    .map(id => {
      const s    = agentMap[id];
      const name = agents.find(a => a.id === id)?.name || id;
      const avg  = s.scores.length ? (s.scores.reduce((a,b)=>a+b,0)/s.scores.length).toFixed(1) : '—';
      return { id, name, calls: s.calls, booked: s.booked, avg };
    })
    .sort((a, b) => b.calls - a.calls);

  const maxCalls = Math.max(...rows.map(r => r.calls), 1);

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:14px">` +
    rows.map((r, i) => `
      <div>
        <div class="flex justify-between" style="margin-bottom:5px">
          <span style="font-size:12px;font-weight:500;color:var(--text1)">${r.name}</span>
          <span style="font-size:12px;color:${COLORS[i%COLORS.length]};font-weight:600">${r.avg !== '—' ? r.avg + ' · ' : ''}${r.calls} calls · ${r.booked} booked</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width:${Math.round((r.calls/maxCalls)*100)}%;background:${COLORS[i%COLORS.length]}"></div></div>
      </div>`).join('') +
  `</div>`;
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
  if (page === 'calls')        loadCallLog();
  if (page === 'teams')        loadTwilioStatus();
  if (page === 'agents')       loadTwilioStatus();
  if (page === 'campaigns')    loadCampaigns();
  if (page === 'prompt')       { renderObjections(); loadAgentScript(true); }
  if (page === 'integrations') loadCalendarStatus();
  if (page === 'calendar')     initCalendar();
  if (page === 'analytics')    loadAnalytics();
  if (page === 'knowledge')    loadKnowledgeBases();
  if (page === 'crm')          loadCRMLeads();
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
  knowledge: 'Knowledge Base',
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
  knowledge: 'Upload documents and scripts for agents to reference during calls',
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
    calendar: `<button class="btn btn-ghost btn-sm"><i class="ti ti-brand-google"></i> Sync Google</button>`,
    prompt: `<button class="btn btn-ghost btn-sm"><i class="ti ti-copy"></i> Duplicate</button><button class="btn btn-primary"><i class="ti ti-device-floppy"></i> Save Script</button>`,
    crm: `<label class="btn btn-ghost btn-sm" style="cursor:pointer"><i class="ti ti-upload"></i> Import Excel<input type="file" accept=".xlsx,.xls" style="display:none" onchange="uploadLeads(this)"></label><button class="btn btn-primary"><i class="ti ti-plus"></i> Add Lead</button>`,
    analytics: `<button class="btn btn-ghost btn-sm" onclick="loadAnalytics()"><i class="ti ti-refresh"></i> Refresh</button>`,
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
        <td style="display:flex;gap:6px;align-items:center">
          ${c.status === 'active'
            ? `<button class="btn btn-sm" style="background:var(--amber);color:#fff;border:none" onclick="pauseCampaign('${c.id}')"><i class="ti ti-player-pause"></i> Pause</button>`
            : `<button class="btn btn-sm" style="background:var(--green);color:#fff;border:none" onclick="startCampaign('${c.id}')"><i class="ti ti-player-play"></i> Start</button>`
          }
          <button class="btn btn-ghost btn-sm" onclick="deleteCampaign('${c.id}')"><i class="ti ti-trash"></i></button>
        </td>
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

async function createCampaign(mode = 'schedule') {
  const name       = document.getElementById('camp-name')?.value?.trim();
  const agentId    = document.getElementById('camp-agent')?.value;
  const dailyLimit = document.getElementById('camp-daily-limit')?.value;
  const startDate  = document.getElementById('camp-start-date')?.value;
  const startTime  = document.getElementById('camp-start-time')?.value || '09:00';
  const timezone   = document.getElementById('camp-timezone')?.value || 'Europe/London';
  const schedule   = getSchedule();
  const fileInput  = document.getElementById('camp-leads-file');

  if (!name) { showToast('Campaign name is required', 'error'); return; }

  // For scheduled launch, date is required
  if (mode === 'schedule' && !startDate) {
    showToast('Please select a date and time to schedule the launch', 'error');
    return;
  }

  // Build scheduledAt ISO string from date + time
  const scheduledAt = (mode === 'schedule' && startDate)
    ? new Date(`${startDate}T${startTime}:00`).toISOString()
    : null;

  try {
    const campaign = await api('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name, agentId, dailyLimit, startDate, timezone, schedule, scheduledAt }),
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
          body: JSON.stringify({ leadCount: data.imported }),
        });

        if (mode === 'now') {
          await api(`/api/campaigns/${campaign.id}/start`, { method: 'POST' });
          showToast(`▶ Campaign started — dialling ${data.imported} leads now`, 'success');
        } else {
          const dateLabel = new Date(scheduledAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
          showToast(`🗓 Campaign scheduled for ${dateLabel}`, 'success');
        }
      }
    } else {
      if (mode === 'now') {
        showToast(`⚠️ No leads uploaded — campaign saved`, 'warning');
      } else {
        const dateLabel = scheduledAt
          ? new Date(scheduledAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
          : 'the selected time';
        showToast(`🗓 Campaign scheduled for ${dateLabel}`, 'success');
      }
    }

    closeModal('new-campaign');
    loadCampaigns();
  } catch (err) {
    showToast(`❌ Failed: ${err.message}`, 'error');
  }
}

// ─── Agent creation & settings ───────────────────────────────────────────────

function setConvoStyle(style) {
  document.getElementById('agent-convo-style').value = style;
  const casual = document.getElementById('style-casual');
  const formal = document.getElementById('style-formal');
  if (style === 'casual') {
    casual.style.cssText = 'flex:1;padding:8px 12px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:linear-gradient(135deg,#4F6EF7,#7C3AED);color:#fff;transition:all .15s';
    formal.style.cssText = 'flex:1;padding:8px 12px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:transparent;color:var(--text2);transition:all .15s';
  } else {
    formal.style.cssText = 'flex:1;padding:8px 12px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:linear-gradient(135deg,#4F6EF7,#7C3AED);color:#fff;transition:all .15s';
    casual.style.cssText = 'flex:1;padding:8px 12px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:transparent;color:var(--text2);transition:all .15s';
  }
}

async function createAgent() {
  const name   = document.getElementById('agent-name')?.value?.trim();
  const accent = document.getElementById('agent-accent')?.value;
  const gender = document.getElementById('agent-gender')?.value;
  const creativity  = parseInt(document.getElementById('agent-creativity')?.value  || 75);
  const patience    = parseInt(document.getElementById('agent-patience')?.value    || 70);
  const stability   = parseInt(document.getElementById('agent-stability')?.value   || 60);
  const voiceSpeed  = parseInt(document.getElementById('agent-voicespeed')?.value  || 80);
  const convoStyle  = document.getElementById('agent-convo-style')?.value || 'formal';

  if (!name) { showToast('Agent name is required', 'error'); return; }

  try {
    await api('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        name, accent, gender,
        settings: { creativity, patience, stability, voiceSpeed, conversationStyle: convoStyle },
      }),
    });
    showToast(`✅ Agent "${name}" created`, 'success');
    closeModal('new-agent');
    // Refresh agents page
    const data = await api('/api/agents');
    if (data?.agents) renderAgentsPage(data.agents);
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
  }
}

// Open configure modal pre-filled with agent's current settings
async function openEditAgent(agentId) {
  const modal = document.getElementById('modal-new-agent');
  modal.dataset.editId = agentId;
  document.getElementById('modal-new-agent').querySelector('.modal-title').textContent = 'Configure Agent';
  document.querySelector('#modal-new-agent .btn-primary').textContent = 'Save Settings';
  document.querySelector('#modal-new-agent .btn-primary').setAttribute('onclick', `saveAgentSettings('${agentId}')`);
  openModal('new-agent');

  // Fetch current agent values and populate sliders
  try {
    const agent = await api(`/api/agents/${agentId}`);
    const s = agent.settings || {};

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val;
      el.blur();
      const label = document.getElementById(id + '-val');
      if (label) label.textContent = val + '%';
    };

    if (agent.name)   { const el = document.getElementById('agent-name');   if (el) el.value = agent.name; }
    if (agent.accent) { const el = document.getElementById('agent-accent'); if (el) el.value = agent.accent; }
    if (agent.gender) { const el = document.getElementById('agent-gender'); if (el) el.value = agent.gender; }

    set('agent-creativity', s.creativity  ?? 75);
    set('agent-patience',   s.patience    ?? 70);
    set('agent-stability',  s.stability   ?? 60);
    set('agent-voicespeed', s.voiceSpeed  ?? 80);

    setConvoStyle(s.conversationStyle || 'formal');
  } catch (err) {
    console.warn('Could not load agent settings for modal', err.message);
  }
}

async function saveAgentSettings(agentId) {
  const creativity  = parseInt(document.getElementById('agent-creativity')?.value  || 75);
  const patience    = parseInt(document.getElementById('agent-patience')?.value    || 70);
  const stability   = parseInt(document.getElementById('agent-stability')?.value   || 60);
  const voiceSpeed  = parseInt(document.getElementById('agent-voicespeed')?.value  || 80);
  const convoStyle  = document.getElementById('agent-convo-style')?.value || 'formal';
  const accent      = document.getElementById('agent-accent')?.value;
  const gender      = document.getElementById('agent-gender')?.value;

  try {
    await api(`/api/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        accent, gender,
        settings: { creativity, patience, stability, voiceSpeed, conversationStyle: convoStyle },
      }),
    });
    showToast('✅ Agent settings saved', 'success');
    closeModal('new-agent');
    // Reset modal title for next creation
    document.getElementById('modal-new-agent').querySelector('.modal-title').textContent = 'Create AI Voice Agent';
    document.querySelector('#modal-new-agent .btn-primary').setAttribute('onclick', 'createAgent()');
    document.querySelector('#modal-new-agent .btn-primary').innerHTML = '<i class="ti ti-check"></i> Create Agent';
    const data = await api('/api/agents');
    if (data?.agents) renderAgentsPage(data.agents);
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
  }
}

async function startCampaign(id) {
  try {
    const data = await api(`/api/campaigns/${id}/start`, { method: 'POST' });
    showToast(`▶ Campaign started — dialling leads now`, 'success');
    loadCampaigns();
  } catch (err) {
    showToast('Could not start campaign', 'error');
  }
}

async function pauseCampaign(id) {
  try {
    await api(`/api/campaigns/${id}/pause`, { method: 'POST' });
    showToast('⏸ Campaign paused', 'success');
    loadCampaigns();
  } catch (err) {
    showToast('Could not pause campaign', 'error');
  }
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign?')) return;
  await api(`/api/campaigns/${id}`, { method: 'DELETE' });
  showToast('Campaign deleted', 'success');
  loadCampaigns();
}

// ─── CRM / Leads ─────────────────────────────────────────────────────────────
let _allCRMLeads = [];

async function loadCRMLeads() {
  const tbody = document.getElementById('crm-tbody');
  if (!tbody) return;
  try {
    const data = await api('/api/leads');
    _allCRMLeads = data.leads || [];
    renderCRMLeads(_allCRMLeads);
    updateCRMMetrics(_allCRMLeads);
  } catch {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:2rem">No leads imported yet — upload an Excel file via a Campaign to get started.</td></tr>`;
  }
}

function updateCRMMetrics(leads) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const total    = leads.length;
  const booked   = leads.filter(l => l.outcome === 'meeting_booked').length;
  const noAnswer = leads.filter(l => l.outcome === 'no_answer').length;
  const called   = leads.filter(l => l.outcome).length;

  set('crm-total',        total || '—');
  set('crm-total-trend',  total ? 'imported leads' : 'no leads yet');
  set('crm-qualified',    called || '—');
  set('crm-qualified-pct', called && total ? `${Math.round(called/total*100)}% called` : 'none called yet');
  set('crm-booked',       booked || '—');
  set('crm-booked-pct',   called && booked ? `${Math.round(booked/called*100)}% booking rate` : 'no bookings yet');
  set('crm-noanswer',     noAnswer || '—');
  set('crm-noanswer-pct', called ? `${Math.round(noAnswer/called*100)}% of calls` : '');
}

function renderCRMLeads(leads) {
  const tbody = document.getElementById('crm-tbody');
  if (!tbody) return;
  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:2rem">No leads imported yet — upload an Excel file via a Campaign to get started.</td></tr>`;
    return;
  }

  const outcomeBadge = (outcome) => {
    const map = {
      meeting_booked: `<span class="badge booked">Meeting Set</span>`,
      interested:     `<span class="badge active">Interested</span>`,
      follow_up_needed: `<span class="badge pending">Follow-up</span>`,
      not_interested: `<span class="badge paused">Not Interested</span>`,
      no_answer:      `<span class="badge" style="background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)">No Answer</span>`,
      escalated:      `<span class="badge pending">Human Review</span>`,
      do_not_call:    `<span class="badge" style="background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)">Do Not Call</span>`,
    };
    return map[outcome] || `<span class="badge paused">Pending</span>`;
  };

  const scoreColor = (s) => !s ? 'var(--text3)' : s >= 70 ? 'var(--green)' : s >= 40 ? 'var(--amber)' : 'var(--red)';

  tbody.innerHTML = leads.map(l => {
    const name     = l.name || `${l.firstName || ''} ${l.lastName || ''}`.trim() || '—';
    const company  = l.company || '—';
    const phone    = l.phone   || '—';
    const agent    = l.agentId || '—';
    const score    = l.callScore ?? '';
    const contact  = l.calledAt ? new Date(l.calledAt).toLocaleDateString('en-GB', {day:'numeric',month:'short'}) : (l.importedAt ? 'Imported' : '—');
    return `
      <tr>
        <td class="bold">${escHtml(name)}</td>
        <td>${escHtml(company)}</td>
        <td class="font-mono" style="font-size:11px">${escHtml(phone)}</td>
        <td>${outcomeLabel(l.outcome)}</td>
        <td><span style="font-weight:700;color:${scoreColor(score)}">${score || '—'}</span></td>
        <td style="font-size:11px;color:var(--text3)">${contact}</td>
        <td style="font-size:11px;color:var(--text2);text-transform:capitalize">${escHtml(agent)}</td>
        <td><button class="btn btn-ghost btn-sm" title="View"><i class="ti ti-eye"></i></button></td>
      </tr>`;
  }).join('');
}

function outcomeLabel(outcome) {
  const map = {
    meeting_booked:   `<span class="badge booked">Meeting Set</span>`,
    interested:       `<span class="badge active">Interested</span>`,
    follow_up_needed: `<span class="badge pending">Follow-up</span>`,
    not_interested:   `<span class="badge paused">Not Interested</span>`,
    no_answer:        `<span class="badge" style="background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)">No Answer</span>`,
    escalated:        `<span class="badge pending">Human Review</span>`,
    do_not_call:      `<span class="badge" style="background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)">Do Not Call</span>`,
  };
  return map[outcome] || `<span class="badge paused">Pending</span>`;
}

function filterCRMLeads(query) {
  if (!query.trim()) return renderCRMLeads(_allCRMLeads);
  const q = query.toLowerCase();
  const filtered = _allCRMLeads.filter(l =>
    (l.name || '').toLowerCase().includes(q) ||
    (l.firstName || '').toLowerCase().includes(q) ||
    (l.lastName  || '').toLowerCase().includes(q) ||
    (l.company   || '').toLowerCase().includes(q) ||
    (l.phone     || '').includes(q)
  );
  renderCRMLeads(filtered);
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

    let msg = `✅ Imported ${data.imported} of ${data.total} leads`;
    if (data.skipped > 0) {
      msg += ` · ${data.skipped} skipped (invalid/non-mobile numbers)`;
    }
    showToast(msg, data.imported > 0 ? 'success' : 'error');

    // Log skipped details to console so they can be reviewed
    if (data.skippedDetails?.length) {
      console.group(`⚠️ ${data.skipped} leads skipped during import:`);
      data.skippedDetails.forEach(s =>
        console.warn(`Row ${s.row}${s.name ? ' — ' + s.name : ''}${s.phone ? ' (' + s.phone + ')' : ''}: ${s.reason}`)
      );
      console.groupEnd();
    }

    input.value = ''; // reset file input
  } catch (err) {
    showToast(`❌ Upload failed: ${err.message}`, 'error');
  }
}

// Normalise UK numbers missing +44 country code
function normalisePhone(raw) {
  if (!raw) return raw;
  let n = raw.replace(/[\s\-().]/g, '');
  if (n.startsWith('+44')) return n;
  if (n.startsWith('44'))  return `+${n}`;
  if (n.startsWith('07'))  return `+44${n.slice(1)}`;
  if (n.startsWith('7') && n.length >= 10) return `+44${n}`;
  return n;
}

function openTestCallModal() {
  openModal('test-call');
}

async function triggerModalTestCall() {
  const raw     = document.getElementById('modal-test-number')?.value?.trim();
  const agentId = document.getElementById('modal-test-agent')?.value || 'rachel';
  if (!raw) { showToast('Enter a number to call', 'error'); return; }

  const toNumber = normalisePhone(raw);
  if (!toNumber.startsWith('+44')) {
    showToast(`❌ Invalid number — must be a UK number (e.g. 07911 123456)`, 'error');
    return;
  }

  closeModal('test-call');
  await makeCall({ toNumber, agentId });
}

async function triggerTestCall() {
  const raw     = document.getElementById('test-call-number')?.value?.trim();
  const agentId = document.getElementById('test-call-agent')?.value || 'rachel';
  if (!raw) { showToast('Enter a number to call', 'error'); return; }

  const toNumber = normalisePhone(raw);

  if (!toNumber.startsWith('+44')) {
    showToast(`❌ Invalid number — must be a UK number (e.g. 07911 123456)`, 'error');
    return;
  }

  closeModal('test-call');
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

// ─── AI Prompt Assistant ──────────────────────────────────────────────────────
let assistantSessionId = 'ps_' + Date.now();

function getScriptContext() {
  const greeting  = document.getElementById('prompt-ta')?.value || '';
  const objTitles = objections.map(o => o.title).filter(Boolean).join(', ');
  return greeting ? `Opening greeting:\n${greeting.slice(0, 300)}\n\nObjection handlers: ${objTitles || 'none yet'}` : '';
}

function addAssistantMessage(text, role) {
  const container = document.getElementById('assistant-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `assist-msg assist-msg-${role}`;

  // Parse code blocks in bot responses
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

  const inner = document.createElement('div');
  inner.innerHTML = html;

  // Add "Apply to script" button for bot messages with code blocks
  if (role === 'bot' && text.includes('```')) {
    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn btn-ghost btn-sm assist-apply-btn';
    applyBtn.innerHTML = '<i class="ti ti-clipboard-copy"></i> Apply to opening greeting';
    applyBtn.onclick = () => {
      const code = text.match(/```([\s\S]*?)```/)?.[1]?.trim();
      if (code) {
        const ta = document.getElementById('prompt-ta');
        if (ta) { ta.value = code; showToast('✅ Applied to opening greeting', 'success'); }
      }
    };
    inner.appendChild(applyBtn);
  }

  div.appendChild(inner);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('assistant-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'assist-msg assist-msg-bot';
  div.id = 'typing-indicator';
  div.innerHTML = '<div class="assist-typing"><span></span><span></span><span></span></div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

async function sendAssistantMessage() {
  const input = document.getElementById('assistant-input');
  const btn   = document.getElementById('assist-send-btn');
  const msg   = input?.value?.trim();
  if (!msg) return;

  input.value = '';
  input.style.height = 'auto';
  addAssistantMessage(msg, 'user');
  showTypingIndicator();
  btn.disabled = true;

  try {
    const res  = await api('/api/prompt/assist', {
      method: 'POST',
      body: JSON.stringify({
        message:   msg,
        sessionId: assistantSessionId,
        context:   getScriptContext(),
      }),
    });
    hideTypingIndicator();
    addAssistantMessage(res.reply, 'bot');
  } catch (err) {
    hideTypingIndicator();
    addAssistantMessage('Sorry, I ran into an error. Please try again.', 'bot');
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

function askAssistant(prompt) {
  const input = document.getElementById('assistant-input');
  if (input) { input.value = prompt; sendAssistantMessage(); }
}

function askAssistantWithContext(prompt) {
  const input = document.getElementById('assistant-input');
  if (input) { input.value = prompt; sendAssistantMessage(); }
}

function clearAssistantChat() {
  const container = document.getElementById('assistant-messages');
  if (!container) return;
  assistantSessionId = 'ps_' + Date.now();
  container.innerHTML = `<div class="assist-msg assist-msg-bot"><div style="font-size:12px;line-height:1.6;color:var(--text2)">Chat cleared. How can I help you build your script?</div></div>`;
  api(`/api/prompt/assist/${assistantSessionId}`, { method: 'DELETE' }).catch(() => {});
}

// ─── Objection Handling Builder ───────────────────────────────────────────────
const OBJECTIONS_VERSION = 'v2_protection';

const defaultObjections = [
  {
    id: 'obj_1',
    title: 'Not interested',
    prompt: `Oh, not to worry at all — I completely understand! Can I just ask, is it that you're already happy with what you've got in place, or is it just not a great time right now? I only ask because a lot of people say that and then find the review was actually really useful. There's absolutely no commitment involved.`,
  },
  {
    id: 'obj_2',
    title: 'I\'m happy with my cover',
    prompt: `Oh that's really good to hear, honestly! The review isn't about changing anything — it's more just so you know where you stand and whether what you've got is still working as hard for you as it should be. Most people who do it stay exactly where they are — they just feel a lot more confident about it. Would that be worth knowing?`,
  },
  {
    id: 'obj_3',
    title: 'I already have a financial advisor',
    prompt: `Oh perfect — that's brilliant, actually. This would be completely independent of that, just a second opinion really on what's available in the market now versus what you've already got. Sometimes a fresh pair of eyes picks up something that's easy to miss. Would you be open to a quick 15-minute call, just to compare?`,
  },
  {
    id: 'obj_4',
    title: 'I\'m too busy',
    prompt: `Of course — I completely get that, life's hectic! The good news is the advisor works entirely around your schedule, so it really can be whenever suits you. Even 15 minutes at a quiet moment could make a real difference. Is there a day this week that's a little less manic for you?`,
  },
  {
    id: 'obj_5',
    title: 'Send me something in writing',
    prompt: `Absolutely, of course — I can certainly arrange that. The only thing is, I'd love to make sure whatever they send is actually relevant to your situation rather than just something generic. Would it be alright if the advisor gave you a very quick call first — even just 10 minutes — so they can tailor it properly for you?`,
  },
  {
    id: 'obj_6',
    title: 'I\'ll think about it',
    prompt: `Of course, take your time — there's no rush at all! What I can do is just pop a provisional slot in with the advisor, and they'll call you at that time. If you decide it's not for you, honestly no problem whatsoever — you can always just let it go. What day would suit you best?`,
  },
  {
    id: 'obj_7',
    title: 'How did you get my number?',
    prompt: `Oh, that's a completely fair question! Your details were passed to us as someone who might benefit from a free protection review. If you'd prefer not to be contacted, I'll make a note of that right away — absolutely no problem at all, and I do apologise for any inconvenience. While I have you though — when did you last have your cover looked at? It might genuinely be worth a quick check.`,
  },
  {
    id: 'obj_8',
    title: 'My premiums are low / good value',
    prompt: `Oh that's great — honestly, that's really reassuring to hear! Sometimes though it isn't just about the price — it's about what's actually covered. Some of the newer policies now include things like serious illness support, GP helplines, and hospitalisation cover that a lot of older policies just don't have. It might be worth a quick look just to compare what you're getting for your money?`,
  },
  {
    id: 'obj_9',
    title: 'Voicemail',
    prompt: `Hi {{first_name}}, it's {{agent_name}} here — I was just calling on behalf of a local financial advisor regarding your existing protection cover. Nothing to worry about at all, I'll try you again shortly. Do have a lovely day, bye for now!`,
  },
  {
    id: 'obj_10',
    title: 'Call back later',
    prompt: `Of course — not a problem at all! When would be a good time for me to try you again? I want to make sure I catch you when it's actually convenient. Would later today work, or would tomorrow be better — morning or afternoon?`,
  },
];

const savedObjs     = localStorage.getItem('voiceiq_objections');
const savedObjsVer  = localStorage.getItem('voiceiq_objections_ver');
let objections = (savedObjs && savedObjsVer === OBJECTIONS_VERSION)
  ? JSON.parse(savedObjs)
  : defaultObjections;

function saveObjections() {
  localStorage.setItem('voiceiq_objections', JSON.stringify(objections));
  localStorage.setItem('voiceiq_objections_ver', OBJECTIONS_VERSION);
}

function renderObjections() {
  const list = document.getElementById('objections-list');
  if (!list) return;

  if (!objections.length) {
    list.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;border:1px dashed var(--border);border-radius:var(--radius)">No objection handlers yet — click <strong>+ Add objection</strong> to create one</div>`;
    return;
  }

  list.innerHTML = objections.map((obj, i) => `
    <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden" id="obj-block-${obj.id}">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-card2);border-bottom:1px solid var(--border)">
        <i class="ti ti-shield-exclamation" style="color:var(--amber);font-size:14px"></i>
        <input
          class="form-input"
          value="${escHtml(obj.title)}"
          placeholder="Objection title (e.g. Not interested)"
          oninput="updateObjectionTitle('${obj.id}', this.value)"
          style="flex:1;padding:4px 8px;font-size:12px;font-weight:600;background:transparent;border-color:transparent"
          onfocus="this.style.borderColor='var(--accent)'"
          onblur="this.style.borderColor='transparent'"
        >
        <button class="btn btn-ghost btn-sm" onclick="duplicateObjection('${obj.id}')" title="Duplicate" style="padding:4px 6px"><i class="ti ti-copy" style="font-size:13px"></i></button>
        <button class="btn btn-danger btn-sm" onclick="removeObjection('${obj.id}')" title="Delete" style="padding:4px 6px"><i class="ti ti-trash" style="font-size:13px"></i></button>
      </div>
      <!-- Prompt textarea -->
      <textarea
        class="form-textarea"
        rows="3"
        placeholder="How should the AI respond to this objection…"
        oninput="updateObjectionPrompt('${obj.id}', this.value)"
        style="border:none;border-radius:0;resize:vertical;font-size:12px"
      >${escHtml(obj.prompt)}</textarea>
    </div>
  `).join('');
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function addObjection() {
  const id = 'obj_' + Date.now();
  objections.push({ id, title: '', prompt: '' });
  saveObjections();
  renderObjections();
  // Focus the new title input
  setTimeout(() => {
    const el = document.querySelector(`#obj-block-${id} input`);
    if (el) el.focus();
  }, 50);
}

function removeObjection(id) {
  objections = objections.filter(o => o.id !== id);
  saveObjections();
  renderObjections();
}

function duplicateObjection(id) {
  const original = objections.find(o => o.id === id);
  if (!original) return;
  const copy = { ...original, id: 'obj_' + Date.now(), title: original.title + ' (copy)' };
  const idx  = objections.findIndex(o => o.id === id);
  objections.splice(idx + 1, 0, copy);
  saveObjections();
  renderObjections();
}

function updateObjectionTitle(id, value) {
  const obj = objections.find(o => o.id === id);
  if (obj) { obj.title = value; saveObjections(); }
}

function updateObjectionPrompt(id, value) {
  const obj = objections.find(o => o.id === id);
  if (obj) { obj.prompt = value; saveObjections(); }
}

// ─── Prompt Builder — load/save agent script ─────────────────────────────────

async function loadAgentScript(populate = false) {
  const select = document.getElementById('prompt-agent-select');
  if (!select) return;

  // Populate dropdown from API on first load
  if (populate) {
    try {
      const data = await api('/api/agents');
      const agents = data.agents || [];
      select.innerHTML = agents.map(a =>
        `<option value="${a.id}">${a.name}</option>`
      ).join('');
    } catch (err) {
      showToast(`Failed to load agents: ${err.message}`, 'error');
      return;
    }
  }

  const agentId = select.value;
  if (!agentId) return;
  try {
    const agent = await api(`/api/agents/${agentId}`);
    const ta = document.getElementById('prompt-ta');
    if (ta && agent.script) ta.value = agent.script;
  } catch (err) {
    showToast(`Failed to load agent script: ${err.message}`, 'error');
  }

  loadPromptKBPanel();
}

// ─── Prompt Builder — Knowledge Base panel ────────────────────────────────────

async function loadPromptKBPanel() {
  const agentId = document.getElementById('prompt-agent-select')?.value;
  const list    = document.getElementById('prompt-kb-list');
  if (!list) return;

  if (!agentId) {
    list.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:8px 0">Select an agent to see active knowledge bases.</div>`;
    return;
  }

  list.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:8px 0">Loading…</div>`;

  try {
    const data = await api('/api/knowledge');
    const all  = data.knowledgeBases || [];
    // Active = assigned to this agent OR shared (agentId null)
    const active = all.filter(kb => kb.agentId === agentId || kb.agentId === null);

    if (!active.length) {
      list.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:8px 0">No knowledge bases assigned. Click <strong>Assign</strong> to add one.</div>`;
      return;
    }

    list.innerHTML = active.map(kb => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;background:var(--bg-hover);border-radius:8px;border:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(kb.name)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">
            ${kb.fileType || 'TEXT'} · ${(kb.charCount||0).toLocaleString()} chars ·
            <span style="color:${kb.agentId ? 'var(--accent)' : 'var(--green)'}">
              ${kb.agentId ? 'This agent' : 'Shared'}${kb.builtin ? ' · Built-in' : ''}
            </span>
          </div>
          ${kb.description ? `<div style="font-size:10px;color:var(--text3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(kb.description)}</div>` : ''}
        </div>
        ${(!kb.builtin && kb.agentId === agentId)
          ? `<button onclick="unassignKB(${kb.id})" title="Remove from agent" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px;flex-shrink:0"><i class="ti ti-x" style="font-size:14px"></i></button>`
          : ''}
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div style="font-size:12px;color:var(--red);padding:8px 0">Failed to load knowledge bases.</div>`;
  }
}

async function openAssignKBModal() {
  const agentId = document.getElementById('prompt-agent-select')?.value;
  if (!agentId) { showToast('Select an agent first', 'error'); return; }

  const container = document.getElementById('assign-kb-list');
  container.innerHTML = `<div style="font-size:12px;color:var(--text3)">Loading…</div>`;
  openModal('assign-kb');

  try {
    const data = await api('/api/knowledge');
    const all  = data.knowledgeBases || [];
    // Show KBs not yet assigned to this agent (shared ones already active, skip them)
    const assignable = all.filter(kb => kb.agentId !== agentId && !kb.builtin);

    if (!assignable.length) {
      container.innerHTML = `<div style="font-size:12px;color:var(--text3)">No unassigned knowledge bases. Upload one from the Knowledge Base page first.</div>`;
      return;
    }

    container.innerHTML = assignable.map(kb => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-hover);border-radius:8px;border:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600">${escHtml(kb.name)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">
            ${kb.fileType || 'TEXT'} · ${(kb.charCount||0).toLocaleString()} chars ·
            <span style="color:${kb.agentId ? 'var(--amber)' : 'var(--green)'}">
              ${kb.agentId ? `Assigned to ${kb.agentId}` : 'Shared (all agents)'}
            </span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" style="font-size:11px;flex-shrink:0" onclick="assignKB(${kb.id}, '${agentId}')">Assign</button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="font-size:12px;color:var(--red)">Failed to load knowledge bases.</div>`;
  }
}

async function assignKB(kbId, agentId) {
  try {
    await api(`/api/knowledge/${kbId}`, {
      method: 'PATCH',
      body: JSON.stringify({ agentId }),
    });
    showToast('Knowledge base assigned', 'success');
    closeModal('assign-kb');
    loadPromptKBPanel();
  } catch (err) {
    showToast(`Failed to assign: ${err.message}`, 'error');
  }
}

async function unassignKB(kbId) {
  try {
    await api(`/api/knowledge/${kbId}`, {
      method: 'PATCH',
      body: JSON.stringify({ agentId: null }),
    });
    showToast('Removed from agent — now shared across all agents', 'success');
    loadPromptKBPanel();
  } catch (err) {
    showToast(`Failed to remove: ${err.message}`, 'error');
  }
}

async function saveAgentScript() {
  const agentId = document.getElementById('prompt-agent-select')?.value;
  const script  = document.getElementById('prompt-ta')?.value?.trim();
  if (!agentId) { showToast('Select an agent first', 'error'); return; }
  if (!script)  { showToast('Script is empty', 'error'); return; }
  try {
    await api(`/api/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ script }),
    });
    showToast(`✅ Script saved to ${agentId.charAt(0).toUpperCase() + agentId.slice(1)}`, 'success');
  } catch (err) {
    showToast(`Failed to save: ${err.message}`, 'error');
  }
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

// ─── Agent Tasks ─────────────────────────────────────────────────────────

const DEFAULT_TASKS = [
  {
    name: 'Meeting / Call Agreed',
    type: 'capture_attribute',
    agentId: null,
    instructions: 'During the call, listen carefully for any signal that the client agrees to a meeting, callback, or follow-up call. If the client says yes, set meeting_agreed to true. This is the primary trigger for creating a calendar reminder.',
    attributes: ['meeting_agreed', 'callback_agreed'],
    createdAt: new Date(0).toISOString(),
    builtin: true,
  },
  {
    name: 'Preferred Date & Time',
    type: 'capture_attribute',
    agentId: null,
    instructions: 'Always ask the client for their preferred date AND time for the callback or meeting. Never assume — confirm both explicitly before closing the booking. Use these to schedule the calendar reminder at the correct time.',
    attributes: ['preferred_date', 'preferred_time'],
    createdAt: new Date(0).toISOString(),
    builtin: true,
  },
  {
    name: 'Meeting Type',
    type: 'capture_attribute',
    agentId: null,
    instructions: 'Identify and confirm the type of meeting the client prefers — phone call, video call, or in-person. Default to phone call if not specified.',
    attributes: ['meeting_type'],
    createdAt: new Date(0).toISOString(),
    builtin: true,
  },
  {
    name: 'Client Interest Level',
    type: 'qualify_lead',
    agentId: null,
    instructions: 'Throughout the call, assess and record the client\'s interest level. Hot = very interested, wants to proceed. Warm = open to it, needs more info. Cold = not interested but not a refusal. Not interested = clear refusal.',
    attributes: ['interest_level'],
    createdAt: new Date(0).toISOString(),
    builtin: true,
  },
  {
    name: 'Confirm Client Details',
    type: 'capture_attribute',
    agentId: null,
    instructions: 'Before ending a successful booking call, confirm the client\'s full name and phone number are correct. If they differ from our records, note the corrected values.',
    attributes: ['confirmed_name', 'confirmed_number'],
    createdAt: new Date(0).toISOString(),
    builtin: true,
  },
];

// Merge defaults with any user-saved tasks (defaults always first, non-duplicated)
const _savedTasks = JSON.parse(localStorage.getItem('viq_agent_tasks') || '[]');
const agentTasks  = [
  ...DEFAULT_TASKS,
  ..._savedTasks.filter(t => !t.builtin),
];

function saveAgentTasks() {
  localStorage.setItem('viq_agent_tasks', JSON.stringify(agentTasks.filter(t => !t.builtin)));
  syncTasksToBackend();
}

async function syncTasksToBackend() {
  try {
    await api('/api/agents/tasks/sync', {
      method: 'POST',
      body: JSON.stringify({ tasks: agentTasks }),
    });
  } catch { /* non-critical */ }
}

function switchAgentTab(tab) {
  ['agents','tasks'].forEach(t => {
    document.getElementById(`agent-tab-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`agent-panel-${t}`).style.display = t === tab ? '' : 'none';
  });
  if (tab === 'tasks') { renderAgentTasks(); syncTasksToBackend(); }
}

const taskTypeLabels = {
  capture_attribute: 'Capture Lead Attribute',
  update_status:     'Update Lead Status',
  qualify_lead:      'Qualify Lead',
  custom:            'Custom Instruction',
};
const taskTypeIcons = {
  capture_attribute: 'ti-file-description',
  update_status:     'ti-circle-check',
  qualify_lead:      'ti-user-check',
  custom:            'ti-bolt',
};

function renderAgentTasks() {
  const list  = document.getElementById('tasks-list');
  const empty = document.getElementById('tasks-empty');
  if (!list) return;

  if (!agentTasks.length) {
    list.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = agentTasks.map((t, i) => `
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;gap:14px;padding:16px 20px">
        <div style="width:40px;height:40px;background:var(--accent-dim);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ${taskTypeIcons[t.type] || 'ti-bolt'}" style="color:var(--accent);font-size:1.1rem"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:0.9rem">${escHtml(t.name)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">${taskTypeLabels[t.type] || t.type}${t.agentId ? ` · <span style="color:var(--accent);text-transform:capitalize">${t.agentId}</span>` : ' · All agents'}</div>
          ${t.instructions ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:500px">${escHtml(t.instructions)}</div>` : ''}
          ${t.attributes?.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${t.attributes.map(a => `<span class="badge" style="font-size:0.7rem">${escHtml(a)}</span>`).join('')}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;align-items:center">
          ${t.builtin ? `<span class="badge" style="font-size:0.68rem;background:var(--accent-dim);color:var(--accent)">Built-in</span>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="editAgentTask(${i})" title="Edit"><i class="ti ti-pencil"></i></button>
          ${!t.builtin ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteAgentTask(${i})" title="Delete"><i class="ti ti-trash"></i></button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

let _editTaskIndex = -1;

function openAddTaskModal(editIndex = -1) {
  _editTaskIndex = editIndex;
  const t = editIndex >= 0 ? agentTasks[editIndex] : null;

  document.getElementById('task-modal-title').textContent = editIndex >= 0 ? 'Edit Task' : 'Add Agent Task';
  document.getElementById('task-name').value         = t?.name || '';
  document.getElementById('task-type').value         = t?.type || 'capture_attribute';
  document.getElementById('task-agent').value        = t?.agentId || '';
  document.getElementById('task-instructions').value = t?.instructions || '';

  // Render attributes
  const attrList = document.getElementById('task-attr-list');
  attrList.innerHTML = '';
  (t?.attributes || []).forEach(a => addTaskAttribute(a));

  toggleTaskAttributesGroup();
  document.getElementById('add-task-modal').style.display = 'flex';
}

function closeAddTaskModal() {
  document.getElementById('add-task-modal').style.display = 'none';
}

function toggleTaskAttributesGroup() {
  const type = document.getElementById('task-type').value;
  document.getElementById('task-attributes-group').style.display =
    type === 'capture_attribute' ? '' : 'none';
}

function addTaskAttribute(value = '') {
  const list = document.getElementById('task-attr-list');
  const row  = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center';
  row.innerHTML = `
    <input class="form-input task-attr-input" value="${escHtml(value)}" placeholder="e.g. insurance_provider, age, budget" style="flex:1">
    <button class="btn btn-ghost btn-sm" style="color:var(--red);padding:4px 8px" onclick="this.parentElement.remove()"><i class="ti ti-x"></i></button>
  `;
  list.appendChild(row);
}

function submitAddTask() {
  const name         = document.getElementById('task-name').value.trim();
  const type         = document.getElementById('task-type').value;
  const agentId      = document.getElementById('task-agent').value;
  const instructions = document.getElementById('task-instructions').value.trim();
  const attributes   = [...document.querySelectorAll('.task-attr-input')]
    .map(i => i.value.trim()).filter(Boolean);

  if (!name) { showToast('Task name is required', 'error'); return; }

  const task = { name, type, agentId: agentId || null, instructions, attributes, createdAt: new Date().toISOString() };

  if (_editTaskIndex >= 0) {
    agentTasks[_editTaskIndex] = task;
  } else {
    agentTasks.push(task);
  }

  saveAgentTasks();
  closeAddTaskModal();
  renderAgentTasks();
  showToast(`Task "${name}" saved`);
}

function editAgentTask(index) {
  openAddTaskModal(index);
}

function deleteAgentTask(index) {
  if (!confirm(`Delete task "${agentTasks[index].name}"?`)) return;
  agentTasks.splice(index, 1);
  saveAgentTasks();
  renderAgentTasks();
}

// ─── Knowledge Base ───────────────────────────────────────────────────────

async function loadKnowledgeBases() {
  const tbody = document.getElementById('kb-tbody');
  if (!tbody) return;
  try {
    const data = await api('/api/knowledge');
    if (!data.knowledgeBases?.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">No knowledge bases yet. Add one to get started.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.knowledgeBases.map(kb => `
      <tr>
        <td style="color:var(--text-muted)">${kb.id}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-weight:500">${escHtml(kb.name)}</span>
            ${kb.builtin ? `<span class="badge" style="background:linear-gradient(135deg,rgba(79,110,247,0.12),rgba(124,58,237,0.10));color:var(--accent);border:1px solid rgba(79,110,247,0.22);font-size:9px;padding:2px 7px;">Built-in</span>` : ''}
          </div>
          ${kb.description ? `<div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(kb.description)}</div>` : ''}
        </td>
        <td><span class="badge" style="font-size:0.7rem">${kb.fileType}</span> <span style="font-size:0.8rem;color:var(--text-muted)">${escHtml(kb.fileName)}</span></td>
        <td>${kb.agentId ? `<span class="badge active" style="text-transform:capitalize">${kb.agentId}</span>` : '<span class="badge" style="color:var(--text-muted)">All agents</span>'}</td>
        <td style="color:var(--text-muted);font-size:0.85rem">${new Date(kb.createdAt).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" title="View" onclick="viewKB(${kb.id})"><i class="ti ti-eye"></i></button>
            ${kb.builtin
              ? `<button class="btn btn-ghost btn-sm" title="Built-in — cannot be deleted" disabled style="opacity:0.35;cursor:not-allowed"><i class="ti ti-lock"></i></button>`
              : `<button class="btn btn-ghost btn-sm" title="Delete" onclick="deleteKB(${kb.id}, '${escHtml(kb.name)}')" style="color:var(--red)"><i class="ti ti-trash"></i></button>`
            }
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:2rem;">Failed to load knowledge bases</td></tr>`;
  }
}

let _kbType = 'file';

function openAddKBModal() {
  _kbType = 'file';
  document.getElementById('kb-step-type').style.display = '';
  document.getElementById('kb-step-form').style.display = 'none';
  document.getElementById('kb-modal-footer').style.display = 'none';
  document.getElementById('kb-modal-title').textContent = 'Add Knowledge Base';
  document.getElementById('add-kb-modal').style.display = 'flex';
}

function closeAddKBModal() {
  document.getElementById('add-kb-modal').style.display = 'none';
}

function selectKBType(type) {
  _kbType = type;
  // Reset form fields
  document.getElementById('kb-name').value = '';
  document.getElementById('kb-description').value = '';
  document.getElementById('kb-agent').value = '';
  document.getElementById('kb-file').value = '';
  document.getElementById('kb-url') && (document.getElementById('kb-url').value = '');
  document.getElementById('kb-text') && (document.getElementById('kb-text').value = '');
  document.getElementById('kb-upload-progress').style.display = 'none';

  // Show correct input panel
  document.getElementById('kb-input-file').style.display  = type === 'file'  ? '' : 'none';
  document.getElementById('kb-input-url').style.display   = type === 'url'   ? '' : 'none';
  document.getElementById('kb-input-text').style.display  = type === 'text'  ? '' : 'none';
  document.getElementById('kb-input-media').style.display = type === 'media' ? '' : 'none';

  // Update title and button label
  const titles  = { file: 'Upload Files', url: 'Pull from Webpage', text: 'Write Content', media: 'Video or Audio' };
  const btnIcons = { file: 'ti-upload', url: 'ti-world', text: 'ti-device-floppy', media: 'ti-upload' };
  document.getElementById('kb-modal-title').textContent = titles[type] || 'Add Knowledge Base';
  document.getElementById('kb-submit-btn').innerHTML = `<i class="ti ${btnIcons[type]}"></i> Save`;

  // Switch to form step
  document.getElementById('kb-step-type').style.display = 'none';
  document.getElementById('kb-step-form').style.display = 'flex';
  document.getElementById('kb-modal-footer').style.display = '';
}

function backToKBTypeStep() {
  document.getElementById('kb-step-type').style.display = '';
  document.getElementById('kb-step-form').style.display = 'none';
  document.getElementById('kb-modal-footer').style.display = 'none';
  document.getElementById('kb-modal-title').textContent = 'Add Knowledge Base';
}

async function submitAddKB() {
  const name        = document.getElementById('kb-name').value.trim();
  const description = document.getElementById('kb-description').value.trim();
  const agentId     = document.getElementById('kb-agent').value;

  if (!name) { showToast('Name is required', 'error'); return; }

  document.getElementById('kb-upload-progress').style.display = 'block';

  try {
    const token = getToken();
    let res;

    if (_kbType === 'file') {
      const fileInput = document.getElementById('kb-file');
      if (!fileInput.files[0]) { showToast('Please select a file', 'error'); return; }
      const formData = new FormData();
      formData.append('type', 'file');
      formData.append('name', name);
      formData.append('description', description);
      if (agentId) formData.append('agentId', agentId);
      formData.append('file', fileInput.files[0]);
      res = await fetch(`${API_BASE}/api/knowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

    } else if (_kbType === 'url') {
      const url = document.getElementById('kb-url').value.trim();
      if (!url) { showToast('Please enter a URL', 'error'); return; }
      res = await fetch(`${API_BASE}/api/knowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'url', name, description, agentId: agentId || undefined, url }),
      });

    } else if (_kbType === 'text') {
      const textContent = document.getElementById('kb-text').value.trim();
      if (!textContent) { showToast('Please enter some content', 'error'); return; }
      res = await fetch(`${API_BASE}/api/knowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', name, description, agentId: agentId || undefined, textContent }),
      });

    } else if (_kbType === 'media') {
      const mediaInput = document.getElementById('kb-media');
      if (!mediaInput.files[0]) { showToast('Please select a media file', 'error'); return; }
      const formData = new FormData();
      formData.append('type', 'media');
      formData.append('name', name);
      formData.append('description', description);
      if (agentId) formData.append('agentId', agentId);
      formData.append('file', mediaInput.files[0]);
      res = await fetch(`${API_BASE}/api/knowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');

    showToast(`"${name}" saved to knowledge base`);
    closeAddKBModal();
    loadKnowledgeBases();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    document.getElementById('kb-upload-progress').style.display = 'none';
  }
}

async function viewKB(id) {
  try {
    const kb = await api(`/api/knowledge/${id}`);
    document.getElementById('view-kb-title').textContent = kb.name;
    document.getElementById('view-kb-file').textContent   = `${kb.fileName} (${kb.fileType})`;
    document.getElementById('view-kb-agent').textContent  = kb.agentId ? kb.agentId.charAt(0).toUpperCase() + kb.agentId.slice(1) : 'All agents';
    document.getElementById('view-kb-chars').textContent  = `${kb.charCount?.toLocaleString() || '?'} characters`;
    document.getElementById('view-kb-description').textContent = kb.description || '';
    document.getElementById('view-kb-content').value = kb.content || '';
    document.getElementById('view-kb-modal').style.display = 'flex';
  } catch (err) {
    showToast('Failed to load knowledge base', 'error');
  }
}

async function deleteKB(id, name) {
  if (!confirm(`Delete knowledge base "${name}"? This cannot be undone.`)) return;
  try {
    await api(`/api/knowledge/${id}`, { method: 'DELETE' });
    showToast(`"${name}" deleted`);
    loadKnowledgeBases();
  } catch {
    showToast('Delete failed', 'error');
  }
}

// ─── Google Calendar Integration ─────────────────────────────────────────

async function loadCalendarStatus() {
  const badge       = document.getElementById('gcal-badge');
  const emailEl     = document.getElementById('gcal-email');
  const card        = document.getElementById('gcal-card');
  const connectBtn  = document.getElementById('gcal-connect-btn');
  const disconnectBtn = document.getElementById('gcal-disconnect-btn');
  if (!badge) return;

  try {
    const data = await api('/api/calendar/status');
    if (data.connected) {
      badge.textContent = 'Connected';
      badge.className = 'badge active';
      card.classList.add('connected');
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = '';
      if (data.email) {
        emailEl.textContent = data.email;
        emailEl.style.display = '';
      }
    } else {
      badge.textContent = 'Not connected';
      badge.className = 'badge paused';
      card.classList.remove('connected');
      connectBtn.style.display = '';
      disconnectBtn.style.display = 'none';
      emailEl.style.display = 'none';
    }
  } catch {
    badge.textContent = 'Error';
    badge.className = 'badge paused';
  }
}

async function connectGoogleCalendar() {
  try {
    const data = await api('/api/calendar/oauth/url');
    // Open OAuth consent in a popup
    const popup = window.open(data.url, 'gcal-oauth', 'width=520,height=640,left=200,top=100');

    // Poll until popup closes then refresh status
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        setTimeout(loadCalendarStatus, 1000); // slight delay for backend to save token
      }
    }, 500);
  } catch (err) {
    showToast('Failed to get OAuth URL — check backend logs', 'error');
  }
}

async function disconnectGoogleCalendar() {
  if (!confirm('Disconnect Google Calendar? New bookings will not create tasks until you reconnect.')) return;
  try {
    await api('/api/calendar/disconnect', { method: 'DELETE' });
    showToast('Google Calendar disconnected');
    loadCalendarStatus();
  } catch {
    showToast('Disconnect failed', 'error');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  // Fetch Google Client ID from backend and store globally
  try {
    const cfg = await fetch(`${API_BASE}/api/auth/config`).then(r => r.json());
    if (cfg.googleClientId) window.GOOGLE_CLIENT_ID = cfg.googleClientId;
  } catch {}

  await checkAuth();
});
