import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

const router = express.Router();

const NEOBOT_URL = process.env.NEOBOT_API_URL || 'https://nexus.neoprotocol.space';
const NEXUS_ECOSYSTEM_URL = process.env.NEXUS_ECOSYSTEM_URL || 'https://nexus.neoprotocol.space/api/ecosystem';
const FETCH_TIMEOUT = 5000;

// Static fallback: all 62 registered skills from neobot/skills/*/skill.json
const SKILLS_FALLBACK = [
  {"id":"nano-pdf","name":"Nano PDF","version":"1.0.0","category":"productivity","description":"Edit PDFs with natural-language instructions using the nano-pdf CLI"},
  {"id":"himalaya","name":"Himalaya Email","version":"1.0.0","category":"email","description":"CLI to manage emails via IMAP/SMTP. List, read, write, reply, forward, search, and organize emails"},
  {"id":"bear-notes","name":"Bear Notes","version":"1.0.0","category":"productivity","description":"Create, search, and manage Bear notes via grizzly CLI"},
  {"id":"peekaboo","name":"Peekaboo macOS UI","version":"1.0.0","category":"automation","description":"Capture and automate macOS UI with the Peekaboo CLI"},
  {"id":"model-usage","name":"Model Usage","version":"1.0.0","category":"monitoring","description":"Summarize per-model usage and cost for Codex or Claude using CodexBar CLI"},
  {"id":"ledger","name":"Execution Ledger","version":"1.0.0","category":"governance","description":"Execution Ledger and Policy Gate for Neobot System Governance. Tracks all agent actions, enforces policies, and provides audit trail."},
  {"id":"blogwatcher","name":"Blog Watcher","version":"1.0.0","category":"monitoring","description":"Monitor blogs and RSS/Atom feeds for updates using the blogwatcher CLI"},
  {"id":"llm","name":"LLM Integration (ASI-1)","version":"1.0.0","category":"ai","description":"LLM integration for NEO Protocol featuring ASI-1 model support. Enables AI-powered chat, inference, and agent reasoning via local and remote LLM providers."},
  {"id":"discord","name":"Discord Integration","version":"1.0.0","category":"channel","description":"Control Discord: send messages, react, manage threads/pins, run polls, upload media, manage channels and roles, and handle moderation."},
  {"id":"coding-agent","name":"Coding Agent","version":"1.0.0","category":"ai","description":"Run Codex CLI, Claude Code, OpenCode, or Pi Coding Agent via background process for programmatic control"},
  {"id":"openhue","name":"Philips Hue","version":"1.0.0","category":"smart-home","description":"Control Philips Hue lights and scenes via OpenHue CLI"},
  {"id":"gemini","name":"Gemini CLI","version":"1.0.0","category":"ai","description":"Gemini CLI for one-shot Q&A, summaries, and AI generation"},
  {"id":"gifgrep","name":"GIF Search","version":"1.0.0","category":"media","description":"Search GIF providers with CLI/TUI, download results, and extract stills/sheets"},
  {"id":"session-logs","name":"Session Logs","version":"1.0.0","category":"logs","description":"Search and analyze session logs from previous conversations using jq and ripgrep."},
  {"id":"ipfs","name":"IPFS Storage Integration","version":"1.0.0","category":"storage","description":"Integration with local IPFS node (kubo) for decentralized storage of logs, memory, backups, and media files."},
  {"id":"ordercli","name":"Order CLI","version":"1.0.0","category":"food","description":"Foodora-only CLI for checking past orders and active order status"},
  {"id":"openai-whisper","name":"Whisper (Local)","version":"1.0.0","category":"ai","description":"Local speech-to-text with the Whisper CLI (no API key required)"},
  {"id":"spotify-player","name":"Spotify Player","version":"1.0.0","category":"audio","description":"Terminal Spotify playback and search via spogo or spotify_player"},
  {"id":"healthcheck","name":"Host Health Check","version":"1.0.0","category":"security","description":"Host security hardening and risk-tolerance configuration. Security audits, firewall/SSH/update hardening."},
  {"id":"oracle","name":"Oracle CLI","version":"1.0.0","category":"ai","description":"Best practices for using the oracle CLI with prompt and file bundling, engines, sessions"},
  {"id":"summarize","name":"Summarize","version":"1.0.0","category":"ai","description":"Summarize or extract text/transcripts from URLs, podcasts, and local files. Great for YouTube/video transcription"},
  {"id":"flowpay","name":"FlowPay Integration","version":"1.0.0","category":"integration","description":"PIX payment gateway integration for NEO Protocol"},
  {"id":"scheduler","name":"Task Scheduler","version":"1.0.0","category":"automation","description":"Schedule future tasks, messages, and command executions for Neobot"},
  {"id":"clawhub","name":"ClawHub Registry","version":"1.0.0","category":"registry","description":"Use ClawHub CLI to search, install, update, and publish agent skills from clawhub.com"},
  {"id":"bluebubbles","name":"BlueBubbles iMessage","version":"1.0.0","category":"channel","description":"Send and manage iMessages via BlueBubbles."},
  {"id":"sherpa-onnx-tts","name":"Sherpa ONNX TTS","version":"1.0.0","category":"ai","description":"Local text-to-speech via sherpa-onnx (offline, no cloud required)"},
  {"id":"video-frames","name":"Video Frames","version":"1.0.0","category":"media","description":"Extract frames or short clips from videos using ffmpeg"},
  {"id":"eightctl","name":"Eight Sleep","version":"1.0.0","category":"smart-home","description":"Control Eight Sleep pods: status, temperature, alarms, schedules"},
  {"id":"gog","name":"Google Workspace","version":"1.0.0","category":"productivity","description":"Google Workspace CLI for Gmail, Calendar, Drive, Contacts, Sheets, and Docs"},
  {"id":"canvas","name":"Canvas","version":"1.0.0","category":"visualization","description":"Canvas drawing and visualization tool"},
  {"id":"notion","name":"Notion Integration","version":"1.0.0","category":"productivity","description":"Read and write Notion databases, pages, and blocks. Query workspace content, create pages, update properties."},
  {"id":"goplaces","name":"Google Places","version":"1.0.0","category":"search","description":"Query Google Places API via goplaces CLI for text search, place details, resolve, and reviews"},
  {"id":"apple-reminders","name":"Apple Reminders","version":"1.0.0","category":"productivity","description":"Manage Apple Reminders via remindctl CLI on macOS (list, add, edit, complete, delete)"},
  {"id":"imsg","name":"iMessage CLI","version":"1.0.0","category":"channel","description":"iMessage/SMS CLI for listing chats, history, watch, and sending messages"},
  {"id":"skill-creator","name":"Skill Creator","version":"1.0.0","category":"tools","description":"Create or update AgentSkills. Use when designing, structuring, or packaging skills with scripts, references, and assets"},
  {"id":"camsnap","name":"Camera Snapshot","version":"1.0.0","category":"camera","description":"Capture frames or clips from RTSP/ONVIF cameras"},
  {"id":"github","name":"GitHub Integration","version":"1.0.0","category":"devops","description":"Interact with GitHub using the gh CLI: manage issues, pull requests, CI runs, and advanced API queries."},
  {"id":"food-order","name":"Food Order","version":"1.0.0","category":"food","description":"Reorder Foodora orders and track ETA/status with ordercli. Never confirm without explicit user approval"},
  {"id":"things-mac","name":"Things 3","version":"1.0.0","category":"productivity","description":"Manage Things 3 via the things CLI on macOS: add/update projects and todos, list inbox/today/upcoming, search tasks"},
  {"id":"ai","name":"AI Chat Integration","version":"1.0.0","category":"ai","description":"Claude AI integration for intelligent conversation and content generation"},
  {"id":"blucli","name":"BluOS CLI","version":"1.0.0","category":"audio","description":"BluOS CLI for discovery, playback, grouping, and volume control"},
  {"id":"sonoscli","name":"Sonos CLI","version":"1.0.0","category":"audio","description":"Control Sonos speakers: discover/status/play/volume/group"},
  {"id":"mcporter","name":"MCP Server Manager","version":"1.0.0","category":"mcp","description":"Use mcporter CLI to list, configure, auth, and call MCP servers/tools directly (HTTP or stdio)"},
  {"id":"telegram","name":"Telegram Bot Integration","version":"1.0.0","category":"channel","description":"Telegram channel integration for NEO Protocol. Enables bot communication, message routing, and channel management."},
  {"id":"tmux","name":"Tmux Control","version":"1.0.0","category":"automation","description":"Remote-control tmux sessions by sending keystrokes and scraping pane output for interactive CLIs"},
  {"id":"smart-factory","name":"Smart Factory Integration","version":"1.0.0","category":"integration","description":"NEO Smart Factory node integration"},
  {"id":"openai-image-gen","name":"OpenAI Image Generation","version":"1.0.0","category":"ai","description":"Batch-generate images via OpenAI Images API with random prompt sampler and gallery output"},
  {"id":"sag","name":"SAG Text-to-Speech","version":"1.0.0","category":"ai","description":"ElevenLabs text-to-speech with mac-style say UX"},
  {"id":"slack","name":"Slack Integration","version":"1.0.0","category":"channel","description":"Control Slack channels and DMs: send messages, react to messages, pin/unpin items, and manage workspace communication."},
  {"id":"weather","name":"Weather","version":"1.0.0","category":"utilities","description":"Get current weather and forecasts (no API key required)"},
  {"id":"trello","name":"Trello","version":"1.0.0","category":"productivity","description":"Manage Trello boards, lists, and cards via the Trello REST API"},
  {"id":"flowcloser","name":"FlowCloser Integration","version":"1.0.0","category":"integration","description":"Sales agent integration (absorbed by neo-agent-full)"},
  {"id":"wacli","name":"WhatsApp CLI","version":"1.0.0","category":"channel","description":"Send WhatsApp messages to other people or search/sync WhatsApp history via wacli CLI"},
  {"id":"songsee","name":"Song Visualizer","version":"1.0.0","category":"audio","description":"Generate spectrograms and feature-panel visualizations from audio with the songsee CLI"},
  {"id":"apple-notes","name":"Apple Notes","version":"1.0.0","category":"productivity","description":"Manage Apple Notes via memo CLI on macOS (create, view, edit, delete, search, move, export notes)"},
  {"id":"openai-whisper-api","name":"Whisper API","version":"1.0.0","category":"ai","description":"Transcribe audio via OpenAI Audio Transcriptions API (Whisper)"},
  {"id":"local-places","name":"Local Places","version":"1.0.0","category":"search","description":"Search for places (restaurants, cafes, etc.) via Google Places API proxy on localhost"},
  {"id":"nano-banana-pro","name":"Nano Banana Pro (Image Gen)","version":"1.0.0","category":"ai","description":"Generate or edit images via Gemini Pro Image generation"},
  {"id":"reminders","name":"Personal Reminders","version":"1.0.0","category":"productivity","description":"Personal reminders system via Telegram"},
  {"id":"ops-status","name":"Ops Status","version":"1.0.0","category":"ops","description":"Reports on the operational status of the Moltbot/NEO ecosystem. Provides health checks for gateway, agents, channels, and system resources."},
  {"id":"voice-call","name":"Voice Call","version":"1.0.0","category":"communication","description":"Start voice calls via the OpenClaw voice-call plugin"}
];

function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

// GET /api/neo/skills — try neobot first, fallback to static registry
router.get('/skills', async (req, res) => {
    try {
        const r = await fetchWithTimeout(`${NEOBOT_URL}/api/neo/skills`);
        if (r.ok) {
            const data = await r.json();
            if (data.success && Array.isArray(data.skills) && data.skills.length > 0) {
                return res.json(data);
            }
        }
    } catch {
        // neobot offline — use static fallback
    }

    res.json({
        success: true,
        skills: SKILLS_FALLBACK,
        source: 'static-registry'
    });
});

// GET /api/neo/registry — skills registry summary
router.get('/registry', async (req, res) => {
    try {
        const r = await fetchWithTimeout(`${NEOBOT_URL}/api/neo/registry`);
        if (r.ok) {
            const data = await r.json();
            return res.json(data);
        }
    } catch {
        // neobot offline
    }

    res.json({
        success: true,
        indexCID: null,
        totalSkills: SKILLS_FALLBACK.length,
        skills: SKILLS_FALLBACK.map(s => ({ id: s.id, latest: s.version, versions: 1, versionList: [s.version] })),
        status: 'Static Registry (Neobot offline)',
        source: 'static-registry'
    });
});

// GET /api/neo/search?q=...
router.get('/search', async (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    if (!q) return res.json({ success: true, results: [], message: 'Provide ?q= to search' });

    const results = SKILLS_FALLBACK.filter(s =>
        s.id.includes(q) || s.name.toLowerCase().includes(q) ||
        s.category.includes(q) || s.description.toLowerCase().includes(q)
    );
    res.json({ success: true, results });
});

// GET /api/neo/ecosystem — load actual ecosystem.json from architect node
router.get('/ecosystem', async (req, res) => {
    const ECOSYSTEM_PATH = path.resolve(process.cwd(), '../neobot/config/ecosystem.json');
    try {
        if (fs.existsSync(ECOSYSTEM_PATH)) {
            const data = fs.readFileSync(ECOSYSTEM_PATH, 'utf8');
            return res.json({ success: true, nodes: JSON.parse(data) });
        }
    } catch (e) {
        console.warn('Failed to read ecosystem.json:', e.message);
    }

    // Railway/prod fallback: fetch source of truth from Nexus API.
    try {
        const r = await fetchWithTimeout(NEXUS_ECOSYSTEM_URL);
        if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data) && data.length > 0) {
                return res.json({ success: true, nodes: data, source: 'nexus-api' });
            }
            if (Array.isArray(data?.ecosystem) && data.ecosystem.length > 0) {
                return res.json({ success: true, nodes: data.ecosystem, source: 'nexus-api' });
            }
            if (Array.isArray(data?.nodes) && data.nodes.length > 0) {
                return res.json({ success: true, nodes: data.nodes, source: 'nexus-api' });
            }
        }
    } catch (e) {
        console.warn('Failed to fetch ecosystem from Nexus API:', e.message);
    }

    // Ensaio de fallback se estiver em produção sem acesso ao FS local do neobot e sem Nexus.
    res.json({ 
        success: false, 
        message: 'Source of truth (ecosystem.json) not accessible locally.',
        hint: 'Link to https://github.com/NEO-PROTOCOL/neobot/blob/main/config/ecosystem.json',
    });
});

export default router;
