// VoiceIQ — Main App Logic

// ─── API Layer ────────────────────────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://voiceiq-api.up.railway.app'; // update when backend is deployed

const API_KEY = 'voiceiq-frontend-api-key-2026-change-this'; // must match .env API_KEY

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
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

// ─── Load dashboard data ──────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [callsData, eventsData] = await Promise.allSettled([
      api('/api/calls'),
      api('/api/calendar/events?maxResults=5&daysAhead=7'),
    ]);

    // Update calls count if data available
    if (callsData.status === 'fulfilled' && callsData.value?.calls) {
      const calls = callsData.value.calls;
      const todayCalls = calls.filter(c => {
        const d = new Date(c.startedAt || c.createdAt);
        return d.toDateString() === new Date().toDateString();
      });
      const metricEl = document.querySelector('.metric-card.blue .metric-value');
      if (metricEl && todayCalls.length > 0) metricEl.textContent = todayCalls.length;
    }

    // Update upcoming bookings
    if (eventsData.status === 'fulfilled' && eventsData.value?.events) {
      console.log('Calendar events loaded:', eventsData.value.events.length);
    }
  } catch (err) {
    console.warn('Dashboard load error (using mock data):', err.message);
  }
}

// ─── Make outbound call ───────────────────────────────────────────────────────
async function makeCall({ toNumber, agentId = 'sophia', leadData = {} }) {
  try {
    showToast(`📞 Initiating call to ${toNumber}...`, 'info');
    const result = await api('/api/teams/call', {
      method: 'POST',
      body: JSON.stringify({ toNumber, agentId, leadData }),
    });
    showToast(`✅ Call initiated — ID: ${result.callId}`, 'success');
    return result;
  } catch (err) {
    showToast(`❌ Call failed: ${err.message}`, 'error');
    throw err;
  }
}

// ─── Load calendar events ─────────────────────────────────────────────────────
async function loadCalendarEvents() {
  try {
    const data = await api('/api/calendar/events?maxResults=10&daysAhead=14');
    console.log('Calendar events:', data.events);
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
  teams: 'Microsoft Teams'
};
const pageSubs = {
  dashboard: 'Friday 15 May · UK Business Hours · 3 agents active',
  agents: 'Create and manage your AI voice agents',
  campaigns: 'Outbound calling campaigns',
  calls: 'Live and historical call data',
  calendar: 'Google Calendar — auto-booking enabled',
  prompt: 'Build and customise AI conversation scripts',
  crm: 'Leads, contacts and follow-ups',
  analytics: 'Performance metrics and insights',
  integrations: 'Connected services and APIs',
  settings: 'Account, billing and preferences',
  teams: 'Microsoft Teams calling integration'
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
    teams: `<button class="btn btn-teams" onclick="startTeamsConnect()"><i class="ti ti-brand-teams"></i> Connect Teams</button>`,
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

// TEAMS CONNECT FLOW
let teamsStep = 1;
function startTeamsConnect() {
  navigate('teams');
}
function teamsNext() {
  teamsStep++;
  renderTeamsStep();
}
function teamsPrev() {
  if (teamsStep > 1) { teamsStep--; renderTeamsStep(); }
}
function renderTeamsStep() {
  const steps = document.querySelectorAll('.teams-step');
  steps.forEach((el, i) => el.style.display = i === (teamsStep - 1) ? 'block' : 'none');
  const inds = document.querySelectorAll('.step-ind-num');
  inds.forEach((el, i) => {
    el.className = 'step-ind-num' + (i < teamsStep - 1 ? ' done' : i === teamsStep - 1 ? ' current' : '');
  });
  const lines = document.querySelectorAll('.step-ind-line');
  lines.forEach((el, i) => el.classList.toggle('done', i < teamsStep - 1));
  document.getElementById('teams-prev-btn').style.display = teamsStep > 1 ? 'flex' : 'none';
  document.getElementById('teams-next-btn').textContent = teamsStep === 4 ? '✓ Complete Setup' : 'Continue';
  if (teamsStep === 4) {
    setTimeout(() => {
      document.getElementById('teams-success').style.display = 'block';
      document.getElementById('teams-form').style.display = 'none';
    }, 100);
  }
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
  renderTeamsStep();

  // Connect to backend
  connectWebSocket();
  loadDashboard();
});
