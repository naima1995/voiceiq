// VoiceIQ — Main App Logic

// ─── API Layer ────────────────────────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://voiceiq-backend-production-2b83.up.railway.app';

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
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
  if (!recent.length) return; // Keep static placeholder rows until real calls exist

  const outcomeMap = {
    booked:    { cls: 'badge active',  label: 'Meeting booked' },
    qualified: { cls: 'badge booked',  label: 'Qualified' },
    escalated: { cls: 'badge pending', label: 'Escalated' },
    'no-answer': { cls: 'badge', label: 'No answer', style: 'background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2)' },
  };
  tbody.innerHTML = recent.map(c => {
    const name = c.leadData?.name || c.toNumber || 'Unknown';
    const o    = outcomeMap[c.outcome] || { cls: 'badge pending', label: c.outcome || 'Completed' };
    const scoreColor = c.score >= 4 ? 'var(--green)' : c.score >= 3 ? 'var(--amber)' : 'var(--text3)';
    return `<tr>
      <td><span class="${o.cls}" ${o.style ? `style="${o.style}"` : ''}>${o.label}</span></td>
      <td>${c.agentId || '—'}</td>
      <td class="bold">${name}</td>
      <td>${c.summary || '—'}</td>
      <td style="color:${scoreColor};font-weight:600">${c.score || '—'}</td>
      <td class="text-dim">${c.duration ? Math.floor(c.duration / 60) + ' min' : '—'}</td>
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
  if (page === 'calls') loadCallLog();
  if (page === 'teams') loadTwilioStatus();
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
    campaigns: `<button class="btn btn-ghost btn-sm"><i class="ti ti-upload"></i> Upload CSV</button><button class="btn btn-primary" onclick="openModal('new-campaign')"><i class="ti ti-plus"></i> New Campaign</button>`,
    calls: `<button class="btn btn-ghost btn-sm"><i class="ti ti-download"></i> Export</button>`,
    calendar: `<button class="btn btn-ghost btn-sm"><i class="ti ti-brand-google"></i> Sync Google</button><button class="btn btn-primary"><i class="ti ti-plus"></i> Manual Book</button>`,
    prompt: `<button class="btn btn-ghost btn-sm"><i class="ti ti-copy"></i> Duplicate</button><button class="btn btn-primary"><i class="ti ti-device-floppy"></i> Save Script</button>`,
    crm: `<button class="btn btn-ghost btn-sm"><i class="ti ti-upload"></i> Import CSV</button><button class="btn btn-primary"><i class="ti ti-plus"></i> Add Lead</button>`,
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
window.addEventListener('DOMContentLoaded', () => {
  navigate('dashboard');
  initLiveTimers();
  setTimeout(animateSentiment, 500);
  setInterval(rotateStatus, 4000);
  buildBarChart('call-chart', [
    {l:'Mon',v:182},{l:'Tue',v:214},{l:'Wed',v:198},{l:'Thu',v:231},{l:'Fri',v:247,today:true},{l:'Sat',v:44},{l:'Sun',v:12}
  ], 'var(--accent)');
  buildBarChart('conv-chart', [
    {l:'Mon',v:11},{l:'Tue',v:13},{l:'Wed',v:10},{l:'Thu',v:14},{l:'Fri',v:13,today:true},{l:'Sat',v:4},{l:'Sun',v:1}
  ], 'var(--green)');
  loadTwilioStatus();

  // Connect to backend
  connectWebSocket();
  loadDashboard();
});
