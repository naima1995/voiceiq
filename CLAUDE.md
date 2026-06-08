# VoiceIQ Frontend — Claude Guidelines

## Project Overview
VoiceIQ is a UK-based AI outbound calling platform for a protection advisory service.
The frontend is a **vanilla JS / HTML / CSS** single-page app — no React, no build step.

- **Repo:** `naima1995/voiceiq` — branch `main`
- **Deployed:** Vercel (static)
- **Backend:** separate repo `naima1995/voiceiq-backend` on Railway (`feature/twilio` branch)

---

## Stack
- **No framework** — plain `index.html` + `app.js` + `style.css`
- All JS is vanilla — no npm, no bundler, no TypeScript
- Tabler Icons CDN for icons (`ti ti-*`)
- Google Fonts: Inter + JetBrains Mono
- WebSocket for live call monitoring

---

## Theme (CSS custom properties)
```css
:root {
  --bg-base:    #eef0f6;
  --bg-surface: #ffffff;
  --bg-card:    #ffffff;
  --bg-card2:   #f5f7fc;
  --bg-hover:   #eaecf5;
  --border:     rgba(99,102,180,0.12);
  --accent:     #4F6EF7;        /* blue */
  --purple:     #7C3AED;
  --green:      #10B981;
  --amber:      #F59E0B;
  --red:        #EF4444;
  --text1:      #1a2035;        /* headings */
  --text2:      #4a5675;        /* body */
  --text3:      #8d96ae;        /* muted */
}
```
Primary buttons: blue→purple gradient. All colors reference CSS vars — never hardcode hex in JS.

---

## Key UI Patterns

### API calls
```javascript
const data = await api('/api/some-endpoint');                 // GET
const result = await api('/api/endpoint', { method: 'POST', body: JSON.stringify({...}) });
```
`API_BASE` is set from env/config — don't hardcode the Railway URL in JS.

### Toasts
```javascript
showToast('Message here', 'success');   // success | error | warning
```

### Modals
```javascript
openModal('modal-id');     // id WITHOUT the 'modal-' prefix
closeModal('modal-id');
```
All modal overlays have id `modal-{name}`.

### Navigation / pages
```javascript
navigate('campaigns');   // switches active page section
```
Page sections are `id="page-{name}"` in index.html.

---

## Important Pages & IDs

### Dashboard
- `id="dash-active-campaigns"` — active campaigns widget (rendered by `renderDashboardCampaigns()`)
- `id="dash-calls-trend"`, `dash-bookings-trend`, `dash-answer-trend`, `dash-conversion-trend` — real vs-yesterday deltas

### Campaigns
- `id="campaigns-tbody"` — campaign rows rendered by `loadCampaigns()`
- Each row has **Start** (green) or **Pause** (amber) button depending on `c.status`
- `startCampaign(id)` → `POST /api/campaigns/:id/start`
- `pauseCampaign(id)` → `POST /api/campaigns/:id/pause`
- Campaign modal footer: **Save as Draft** + **⚡ Start Now** (`createCampaign(false/true)`)

### AI Agents
- `id="agents-grid"` — agent cards rendered by `renderAgentsPage()`
- Agent cards show settings mini-bar (creativity/patience/stability/voiceSpeed progress bars)
- **Configure** button → `openEditAgent(id)` → reuses new-agent modal pre-filled
- Agent modal has 4 sliders: Creativity, Patience, Voice Stability, Voice Speed (all `class="agent-slider"`)
- `setConvoStyle('casual'|'formal')` — toggles the style button highlight

### CRM & Leads
- `id="crm-tbody"` — live from `/api/leads`
- Metrics: `crm-total`, `crm-qualified`, `crm-booked`, `crm-noanswer`

### Prompt Builder
- `id="prompt-ta"` — pre-populated with `DEFAULT_PROTECTION_SCRIPT`
- Objections versioned with `OBJECTIONS_VERSION = 'v2_protection'` in localStorage

### Knowledge Base
- NATO phonetics pre-seeded as builtin (id=1, cannot be deleted)

---

## Sidebar Live Call Card
- `id="sidebar-footer"` — hidden by default (`display:none`)
- `id="agent-live-name"`, `id="agent-live-sub"`
- Shown/hidden dynamically via `updateSidebarLiveCard()` driven by WebSocket events
- **Never hardcode** a live call card — it only appears when a call is actually active

---

## Nav Badges
- Nav items for AI Agents and Calls have **no** hardcoded notification badges
- Any badges must be driven by real data

---

## Campaign Start Date Picker
```html
<!-- Must have color-scheme: light — dark scheme hides the native calendar -->
<input type="date" id="camp-start-date" style="color-scheme:light;cursor:pointer" class="form-input">
```

---

## Agent Slider CSS
```css
.agent-slider { /* range input with accent-coloured thumb */ }
```
Always use `class="agent-slider"` for agent setting range inputs. The CSS handles all browser prefixes.

---

## Button Classes
```css
.btn-primary    /* blue→purple gradient — main CTA */
.btn-secondary  /* bg-card2 tinted — secondary action */
.btn-ghost      /* transparent border — tertiary */
.btn-danger     /* red — destructive actions */
.btn-sm         /* smaller padding */
.btn            /* base — always required */
```

---

## Objection Handlers (localStorage)
```javascript
const OBJECTIONS_VERSION = 'v2_protection';
```
Version key in localStorage ensures stale cached objections are overwritten on first visit. Always bump the version string when updating default objections.

---

## WebSocket (live monitoring)
```javascript
// Messages received from backend:
'call_started'    → show sidebar live card
'call_ended'      → hide sidebar live card
'campaign_started', 'campaign_paused', 'campaign_completed'
'meeting_booked'
'agent_speaking', 'prospect_speaking'
```

---

## What NOT to Do
- Do not hardcode any metrics, campaign data, or call counts — everything must come from the API
- Do not add nav badges unless driven by real-time data
- Do not use `color-scheme: dark` on date inputs — it hides the calendar picker on light theme
- Do not redirect the `<Gather>` timeout back to `/twilio/answer` — that restarts the greeting (this is a backend concern but worth noting)
- Do not use `emit.raw()` on the backend WebSocket — it doesn't exist; use `broadcast(type, data)`
