# VoiceIQ — AI Calling Platform

A complete web-based AI-powered outbound calling platform for UK businesses.

## Features
- AI Voice Agents with British accents (via ElevenLabs)
- Microsoft Teams calling integration (inbound + outbound)
- UK mobile/SIP number support
- Google Calendar auto-booking
- Campaign management & CRM
- Prompt Builder with dynamic variables
- Real-time call monitoring & analytics

## Deploy

### Vercel (recommended)
```bash
npm i -g vercel
vercel
```

### Netlify drag-and-drop
Drop the project folder at https://app.netlify.com/drop

### Any static host
Upload index.html, css/, and js/ folders — no build step required.

## Project Structure
```
voiceiq/
├── index.html        # Full single-page app
├── css/
│   └── style.css     # All styles
├── js/
│   └── app.js        # Navigation, interactivity, charts
├── vercel.json       # Vercel deployment config
└── README.md
```

## Integrations to connect (post-deploy)
- Microsoft Graph API — Teams calling
- ElevenLabs API — British AI voices
- OpenAI Realtime API — conversation engine
- Google Calendar API — auto-booking
- SIP provider (Vonage/8x8) — UK mobile number

## Tech Stack
- Pure HTML/CSS/JS — zero dependencies, zero build step
- Tabler Icons (CDN)
- Google Fonts — Inter + JetBrains Mono (CDN)
