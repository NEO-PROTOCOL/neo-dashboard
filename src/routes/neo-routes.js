import express from "express";
import fs from "node:fs";
import path from "node:path";

const router = express.Router();

const NEOBOT_URL =
  process.env.NEOBOT_API_URL || "https://nexus.neoprotocol.space";
const NEXUS_ECOSYSTEM_URL =
  process.env.NEXUS_ECOSYSTEM_URL ||
  "https://nexus.neoprotocol.space/api/ecosystem";
const FETCH_TIMEOUT = 5000;
const NODE_PROBE_TIMEOUT = Number(
  process.env.ECOSYSTEM_NODE_PROBE_TIMEOUT_MS || 2500,
);
const PROBE_CACHE_TTL_MS = Number(
  process.env.ECOSYSTEM_PROBE_CACHE_TTL_MS || 12000,
);
const PAYMENT_ROUTE_SCHEMA_VERSION = "1.0.0";

// Nodes explicitly excluded from the ecosystem graph.
// These exist in external data sources (e.g. Nexus API) but are NOT part of
// the NEO Protocol stack and must not appear in the dashboard graph.
const ECOSYSTEM_EXCLUDE_IDS = new Set([
  "flowpay-core", // standalone commercial product — see stackBoundary.doNotConfuseWith in ecosystem.json
]);

const liveProbeCache = {
  checkedAt: 0,
  payload: null,
  inFlight: null,
};

// Static fallback: all 62 registered skills from neobot/skills/*/skill.json
const SKILLS_FALLBACK = [
  {
    id: "nano-pdf",
    name: "Nano PDF",
    version: "1.0.0",
    category: "productivity",
    description:
      "Edit PDFs with natural-language instructions using the nano-pdf CLI",
  },
  {
    id: "himalaya",
    name: "Himalaya Email",
    version: "1.0.0",
    category: "email",
    description:
      "CLI to manage emails via IMAP/SMTP. List, read, write, reply, forward, search, and organize emails",
  },
  {
    id: "bear-notes",
    name: "Bear Notes",
    version: "1.0.0",
    category: "productivity",
    description: "Create, search, and manage Bear notes via grizzly CLI",
  },
  {
    id: "peekaboo",
    name: "Peekaboo macOS UI",
    version: "1.0.0",
    category: "automation",
    description: "Capture and automate macOS UI with the Peekaboo CLI",
  },
  {
    id: "model-usage",
    name: "Model Usage",
    version: "1.0.0",
    category: "monitoring",
    description:
      "Summarize per-model usage and cost for Codex or Claude using CodexBar CLI",
  },
  {
    id: "ledger",
    name: "Execution Ledger",
    version: "1.0.0",
    category: "governance",
    description:
      "Execution Ledger and Policy Gate for Neobot System Governance. Tracks all agent actions, enforces policies, and provides audit trail.",
  },
  {
    id: "blogwatcher",
    name: "Blog Watcher",
    version: "1.0.0",
    category: "monitoring",
    description:
      "Monitor blogs and RSS/Atom feeds for updates using the blogwatcher CLI",
  },
  {
    id: "llm",
    name: "LLM Integration (ASI-1)",
    version: "1.0.0",
    category: "ai",
    description:
      "LLM integration for NEO Protocol featuring ASI-1 model support. Enables AI-powered chat, inference, and agent reasoning via local and remote LLM providers.",
  },
  {
    id: "discord",
    name: "Discord Integration",
    version: "1.0.0",
    category: "channel",
    description:
      "Control Discord: send messages, react, manage threads/pins, run polls, upload media, manage channels and roles, and handle moderation.",
  },
  {
    id: "coding-agent",
    name: "Coding Agent",
    version: "1.0.0",
    category: "ai",
    description:
      "Run Codex CLI, Claude Code, OpenCode, or Pi Coding Agent via background process for programmatic control",
  },
  {
    id: "openhue",
    name: "Philips Hue",
    version: "1.0.0",
    category: "smart-home",
    description: "Control Philips Hue lights and scenes via OpenHue CLI",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    version: "1.0.0",
    category: "ai",
    description: "Gemini CLI for one-shot Q&A, summaries, and AI generation",
  },
  {
    id: "gifgrep",
    name: "GIF Search",
    version: "1.0.0",
    category: "media",
    description:
      "Search GIF providers with CLI/TUI, download results, and extract stills/sheets",
  },
  {
    id: "session-logs",
    name: "Session Logs",
    version: "1.0.0",
    category: "logs",
    description:
      "Search and analyze session logs from previous conversations using jq and ripgrep.",
  },
  {
    id: "ipfs",
    name: "IPFS Storage Integration",
    version: "1.0.0",
    category: "storage",
    description:
      "Integration with local IPFS node (kubo) for decentralized storage of logs, memory, backups, and media files.",
  },
  {
    id: "ordercli",
    name: "Order CLI",
    version: "1.0.0",
    category: "food",
    description:
      "Foodora-only CLI for checking past orders and active order status",
  },
  {
    id: "openai-whisper",
    name: "Whisper (Local)",
    version: "1.0.0",
    category: "ai",
    description:
      "Local speech-to-text with the Whisper CLI (no API key required)",
  },
  {
    id: "spotify-player",
    name: "Spotify Player",
    version: "1.0.0",
    category: "audio",
    description:
      "Terminal Spotify playback and search via spogo or spotify_player",
  },
  {
    id: "healthcheck",
    name: "Host Health Check",
    version: "1.0.0",
    category: "security",
    description:
      "Host security hardening and risk-tolerance configuration. Security audits, firewall/SSH/update hardening.",
  },
  {
    id: "oracle",
    name: "Oracle CLI",
    version: "1.0.0",
    category: "ai",
    description:
      "Best practices for using the oracle CLI with prompt and file bundling, engines, sessions",
  },
  {
    id: "summarize",
    name: "Summarize",
    version: "1.0.0",
    category: "ai",
    description:
      "Summarize or extract text/transcripts from URLs, podcasts, and local files. Great for YouTube/video transcription",
  },
  {
    id: "flowpay",
    name: "FlowPay Integration",
    version: "1.0.0",
    category: "integration",
    description: "PIX payment gateway integration for NEO Protocol",
  },
  {
    id: "scheduler",
    name: "Task Scheduler",
    version: "1.0.0",
    category: "automation",
    description:
      "Schedule future tasks, messages, and command executions for Neobot",
  },
  {
    id: "clawhub",
    name: "ClawHub Registry",
    version: "1.0.0",
    category: "registry",
    description:
      "Use ClawHub CLI to search, install, update, and publish agent skills from clawhub.com",
  },
  {
    id: "bluebubbles",
    name: "BlueBubbles iMessage",
    version: "1.0.0",
    category: "channel",
    description: "Send and manage iMessages via BlueBubbles.",
  },
  {
    id: "sherpa-onnx-tts",
    name: "Sherpa ONNX TTS",
    version: "1.0.0",
    category: "ai",
    description:
      "Local text-to-speech via sherpa-onnx (offline, no cloud required)",
  },
  {
    id: "video-frames",
    name: "Video Frames",
    version: "1.0.0",
    category: "media",
    description: "Extract frames or short clips from videos using ffmpeg",
  },
  {
    id: "eightctl",
    name: "Eight Sleep",
    version: "1.0.0",
    category: "smart-home",
    description:
      "Control Eight Sleep pods: status, temperature, alarms, schedules",
  },
  {
    id: "gog",
    name: "Google Workspace",
    version: "1.0.0",
    category: "productivity",
    description:
      "Google Workspace CLI for Gmail, Calendar, Drive, Contacts, Sheets, and Docs",
  },
  {
    id: "canvas",
    name: "Canvas",
    version: "1.0.0",
    category: "visualization",
    description: "Canvas drawing and visualization tool",
  },
  {
    id: "notion",
    name: "Notion Integration",
    version: "1.0.0",
    category: "productivity",
    description:
      "Read and write Notion databases, pages, and blocks. Query workspace content, create pages, update properties.",
  },
  {
    id: "goplaces",
    name: "Google Places",
    version: "1.0.0",
    category: "search",
    description:
      "Query Google Places API via goplaces CLI for text search, place details, resolve, and reviews",
  },
  {
    id: "apple-reminders",
    name: "Apple Reminders",
    version: "1.0.0",
    category: "productivity",
    description:
      "Manage Apple Reminders via remindctl CLI on macOS (list, add, edit, complete, delete)",
  },
  {
    id: "imsg",
    name: "iMessage CLI",
    version: "1.0.0",
    category: "channel",
    description:
      "iMessage/SMS CLI for listing chats, history, watch, and sending messages",
  },
  {
    id: "skill-creator",
    name: "Skill Creator",
    version: "1.0.0",
    category: "tools",
    description:
      "Create or update AgentSkills. Use when designing, structuring, or packaging skills with scripts, references, and assets",
  },
  {
    id: "camsnap",
    name: "Camera Snapshot",
    version: "1.0.0",
    category: "camera",
    description: "Capture frames or clips from RTSP/ONVIF cameras",
  },
  {
    id: "github",
    name: "GitHub Integration",
    version: "1.0.0",
    category: "devops",
    description:
      "Interact with GitHub using the gh CLI: manage issues, pull requests, CI runs, and advanced API queries.",
  },
  {
    id: "food-order",
    name: "Food Order",
    version: "1.0.0",
    category: "food",
    description:
      "Reorder Foodora orders and track ETA/status with ordercli. Never confirm without explicit user approval",
  },
  {
    id: "things-mac",
    name: "Things 3",
    version: "1.0.0",
    category: "productivity",
    description:
      "Manage Things 3 via the things CLI on macOS: add/update projects and todos, list inbox/today/upcoming, search tasks",
  },
  {
    id: "ai",
    name: "AI Chat Integration",
    version: "1.0.0",
    category: "ai",
    description:
      "Claude AI integration for intelligent conversation and content generation",
  },
  {
    id: "blucli",
    name: "BluOS CLI",
    version: "1.0.0",
    category: "audio",
    description:
      "BluOS CLI for discovery, playback, grouping, and volume control",
  },
  {
    id: "sonoscli",
    name: "Sonos CLI",
    version: "1.0.0",
    category: "audio",
    description: "Control Sonos speakers: discover/status/play/volume/group",
  },
  {
    id: "mcporter",
    name: "MCP Server Manager",
    version: "1.0.0",
    category: "mcp",
    description:
      "Use mcporter CLI to list, configure, auth, and call MCP servers/tools directly (HTTP or stdio)",
  },
  {
    id: "telegram",
    name: "Telegram Bot Integration",
    version: "1.0.0",
    category: "channel",
    description:
      "Telegram channel integration for NEO Protocol. Enables bot communication, message routing, and channel management.",
  },
  {
    id: "tmux",
    name: "Tmux Control",
    version: "1.0.0",
    category: "automation",
    description:
      "Remote-control tmux sessions by sending keystrokes and scraping pane output for interactive CLIs",
  },
  {
    id: "smart-factory",
    name: "Smart Factory Integration",
    version: "1.0.0",
    category: "integration",
    description: "NEO Smart Factory node integration",
  },
  {
    id: "openai-image-gen",
    name: "OpenAI Image Generation",
    version: "1.0.0",
    category: "ai",
    description:
      "Batch-generate images via OpenAI Images API with random prompt sampler and gallery output",
  },
  {
    id: "sag",
    name: "SAG Text-to-Speech",
    version: "1.0.0",
    category: "ai",
    description: "ElevenLabs text-to-speech with mac-style say UX",
  },
  {
    id: "slack",
    name: "Slack Integration",
    version: "1.0.0",
    category: "channel",
    description:
      "Control Slack channels and DMs: send messages, react to messages, pin/unpin items, and manage workspace communication.",
  },
  {
    id: "weather",
    name: "Weather",
    version: "1.0.0",
    category: "utilities",
    description: "Get current weather and forecasts (no API key required)",
  },
  {
    id: "trello",
    name: "Trello",
    version: "1.0.0",
    category: "productivity",
    description:
      "Manage Trello boards, lists, and cards via the Trello REST API",
  },
  {
    id: "flowcloser",
    name: "FlowCloser Integration",
    version: "1.0.0",
    category: "integration",
    description: "Sales agent integration (absorbed by neo-agent-full)",
  },
  {
    id: "wacli",
    name: "WhatsApp CLI",
    version: "1.0.0",
    category: "channel",
    description:
      "Send WhatsApp messages to other people or search/sync WhatsApp history via wacli CLI",
  },
  {
    id: "songsee",
    name: "Song Visualizer",
    version: "1.0.0",
    category: "audio",
    description:
      "Generate spectrograms and feature-panel visualizations from audio with the songsee CLI",
  },
  {
    id: "apple-notes",
    name: "Apple Notes",
    version: "1.0.0",
    category: "productivity",
    description:
      "Manage Apple Notes via memo CLI on macOS (create, view, edit, delete, search, move, export notes)",
  },
  {
    id: "openai-whisper-api",
    name: "Whisper API",
    version: "1.0.0",
    category: "ai",
    description:
      "Transcribe audio via OpenAI Audio Transcriptions API (Whisper)",
  },
  {
    id: "local-places",
    name: "Local Places",
    version: "1.0.0",
    category: "search",
    description:
      "Search for places (restaurants, cafes, etc.) via Google Places API proxy on localhost",
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro (Image Gen)",
    version: "1.0.0",
    category: "ai",
    description: "Generate or edit images via Gemini Pro Image generation",
  },
  {
    id: "reminders",
    name: "Personal Reminders",
    version: "1.0.0",
    category: "productivity",
    description: "Personal reminders system via Telegram",
  },
  {
    id: "ops-status",
    name: "Ops Status",
    version: "1.0.0",
    category: "ops",
    description:
      "Reports on the operational status of the Moltbot/NEO ecosystem. Provides health checks for gateway, agents, channels, and system resources.",
  },
  {
    id: "voice-call",
    name: "Voice Call",
    version: "1.0.0",
    category: "communication",
    description: "Start voice calls via the OpenClaw voice-call plugin",
  },
  {
    id: "neo-nexus",
    name: "NEO Nexus Event Hub",
    version: "1.0.0",
    category: "integration",
    description: "Central nervous system event bus for the NEO Protocol ecosystem. Decoupled communication and resilient orchestration.",
  },
  {
    id: "neo-agent-full",
    name: "NEO Agent Full",
    version: "2.5",
    category: "ai",
    description: "Autonomous cloud engine with continuous context and WhatsApp/Telegram integration. Built on Moltbot foundation with NEO extensions.",
  },
  {
    id: "neo-id",
    name: "NEO ID (Namespace-as-a-Service)",
    version: "1.0.0",
    category: "identity",
    description: "ENSv2 based namespace infrastructure for brands, communities, and agents. Coordinated identity and delegation.",
  },
  {
    id: "mio-system",
    name: "MIO Identity System",
    version: "2.0.0",
    category: "identity",
    description: "Web3 identity management and autonomous operation layer for the NEO Protocol stack.",
  },
  {
    id: "neo-mcp-server",
    name: "NEO MCP Server",
    version: "2.0.0",
    category: "integration",
    description: "Cognitive API for NEO Protocol ecosystem. Storage, topology awareness, and service resolution via Model Context Protocol.",
  },
  {
    id: "neo-tunnel",
    name: "NEO Tunnel",
    version: "1.0.0",
    category: "devops",
    description: "Sovereign tunnel for local development. Replaces ngrok without leaving the NEO ecosystem. Webhooks and callbacks.",
  },
];

function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

function normalizePublicUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.includes(".railway.internal") || trimmed.includes("localhost")) {
    return null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) return null;
  return `https://${trimmed}`;
}

function webhookBase(webhookUrl) {
  if (!webhookUrl || typeof webhookUrl !== "string") return null;
  return webhookUrl
    .replace("/api/webhook/nexus", "")
    .replace("/api/webhook", "")
    .replace("/api/events", "");
}

function resolveNodeUrl(node) {
  const candidates = [
    node?.url,
    node?.hosting?.activeUrl,
    node?.hosting?.targetCustomDomain,
    webhookBase(node?.webhookUrl?.production),
    node?.hosting?.productionUrl,
    node?.infrastructure?.productionUrl,
    node?.hosting?.railwayUrl,
    node?.infrastructure?.railwayUrl,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePublicUrl(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function hasNexusIntegration(node) {
  // nexusEvents: [] means the field was explicitly configured on the node
  // (passive acknowledgment — e.g. frontend / docs nodes that intentionally
  // have no nexus events).  Treat it as "acknowledged" so it does NOT trigger
  // the "unlinked" alert.  Only nodes without the nexusEvents field at all are
  // considered truly unconfigured.
  const nexusEventsConfigured = node != null && 'nexusEvents' in node;
  const hasEvents = Array.isArray(node?.nexusEvents)
    ? node.nexusEvents.length > 0 || nexusEventsConfigured
    : Boolean(node?.nexusEvents);
  return Boolean(node?.webhookUrl || node?.webhookRoutes || hasEvents);
}

async function probeNodeStatus(url) {
  const normalized = (url || "").replace(/\/+$/, "");
  if (!normalized) return { status: "unknown", httpStatus: null };

  const candidates = [
    `${normalized}/health`,
    `${normalized}/api/health`,
    normalized,
  ];
  let hasHttpResponse = false;
  let lastStatus = null;

  for (const target of candidates) {
    try {
      const response = await fetchWithTimeout(
        target,
        { method: "GET" },
        NODE_PROBE_TIMEOUT,
      );
      hasHttpResponse = true;
      lastStatus = response.status;
      if (response.ok) return { status: "online", httpStatus: response.status };
    } catch (_e) {
      // try next endpoint
    }
  }

  if (hasHttpResponse) return { status: "degraded", httpStatus: lastStatus };
  return { status: "offline", httpStatus: null };
}

async function loadEcosystemNodes() {
  const now = Date.now();

  // Source 1: registry local filesystem (dev environment only)
  const ecosystemPath = path.resolve(
    process.cwd(),
    "../neobot-orchestrator/config/ecosystem.json",
  );
  try {
    if (fs.existsSync(ecosystemPath)) {
      const raw = fs.readFileSync(ecosystemPath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const nodes = parsed.filter((n) => !ECOSYSTEM_EXCLUDE_IDS.has(n?.id));
        if (nodes.length > 0) {
          return { success: true, nodes, source: "local-file" };
        }
      }
    }
  } catch (e) {
    console.warn("Failed to read ecosystem.json:", e.message);
  }

  // Source 2: Remote GitHub source (mirroring ecosystem-health-routes.js)
  const remoteUrls = [
    process.env.ECOSYSTEM_SOURCE_URL,
    "https://raw.githubusercontent.com/NEO-PROTOCOL/neobot-orchestrator/main/config/ecosystem.json",
  ].filter(Boolean);

  for (const remoteUrl of remoteUrls) {
    try {
      const response = await fetchWithTimeout(remoteUrl, { method: "GET" }, 10000);
      if (response.ok) {
        const raw = await response.text();
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const nodes = parsed.filter((n) => !ECOSYSTEM_EXCLUDE_IDS.has(n?.id));
          if (nodes.length > 0) {
            return { success: true, nodes, source: "github" };
          }
        }
      }
    } catch (_e) {
      // try next
    }
  }

  // Source 3: Nexus API (when local registry and GitHub are unavailable)
  try {
    const r = await fetchWithTimeout(NEXUS_ECOSYSTEM_URL);
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        const nodes = data.filter((n) => !ECOSYSTEM_EXCLUDE_IDS.has(n?.id));
        if (nodes.length > 0) {
          return { success: true, nodes, source: "nexus-api" };
        }
      }
      if (Array.isArray(data?.ecosystem) && data.ecosystem.length > 0) {
        const nodes = data.ecosystem.filter(
          (n) => !ECOSYSTEM_EXCLUDE_IDS.has(n?.id),
        );
        if (nodes.length > 0) {
          return { success: true, nodes, source: "nexus-api" };
        }
      }
      if (Array.isArray(data?.nodes) && data.nodes.length > 0) {
        const nodes = data.nodes.filter(
          (n) => !ECOSYSTEM_EXCLUDE_IDS.has(n?.id),
        );
        if (nodes.length > 0) {
          return { success: true, nodes, source: "nexus-api" };
        }
      }
    }
  } catch (e) {
    console.warn("Failed to fetch ecosystem from Nexus API:", e.message);
  }

  // Source 4: ecosystem-graph.json bundled in the repo (autonomous fallback)
  // This file is enriched with production URLs via `pnpm run sync:ecosystem-graph`
  // and allows the dashboard to probe node health without depending on neobot.
  const graphPath = path.resolve(process.cwd(), "ecosystem-graph.json");
  try {
    if (fs.existsSync(graphPath)) {
      const raw = fs.readFileSync(graphPath, "utf8");
      const parsed = JSON.parse(raw);
      const rawNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
      const nodes = rawNodes.filter((n) => !ECOSYSTEM_EXCLUDE_IDS.has(n?.id));
      if (nodes.length > 0) {
        return { success: true, nodes, source: "graph-file" };
      }
    }
  } catch (e) {
    console.warn("Failed to read ecosystem-graph.json:", e.message);
  }

  return { success: false, nodes: [], source: "unavailable" };
}

function isPaymentNode(node) {
  const id = String(node?.id || "").toLowerCase();
  const name = String(node?.name || "").toLowerCase();
  const role = String(node?.role || "").toLowerCase();
  const org = String(node?.org || "").toLowerCase();
  const mix = `${id} ${name} ${role} ${org}`;
  return (
    mix.includes("flowpay") ||
    role.includes("payment") ||
    role.includes("checkout") ||
    role.includes("financial")
  );
}

function asPath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`,
    );
    return parsed.pathname || "/";
  } catch {
    return null;
  }
}

function makePaymentRoute(params) {
  const {
    kind,
    env,
    url,
    method = null,
    sourceField = null,
    inferred = false,
  } = params;
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return {
    kind,
    env,
    method,
    url: trimmed,
    path: asPath(trimmed),
    sourceField,
    inferred,
  };
}

function inferFlowpayApiRoutes(node) {
  const routes = [];
  const bases = {
    local: node?.localUrl,
    internal: node?.hosting?.internalUrl || node?.webhookUrl?.internal,
    production:
      node?.hosting?.activeUrl ||
      node?.hosting?.productionUrl ||
      node?.webhookUrl?.production,
  };
  const ops = [
    { method: "POST", op: "create-charge", path: "/api/create-charge" },
    { method: "GET", op: "charge-status", path: "/api/charge-status" },
    { method: "POST", op: "webhook-nexus", path: "/api/webhook/nexus" },
  ];

  for (const [env, base] of Object.entries(bases)) {
    if (!base || typeof base !== "string") continue;
    const normalizedBase = base.replace(/\/+$/, "");
    for (const op of ops) {
      routes.push(
        makePaymentRoute({
          kind: `api:${op.op}`,
          env,
          method: op.method,
          url: `${normalizedBase}${op.path}`,
          sourceField: `inferred:${env}`,
          inferred: true,
        }),
      );
    }
  }

  return routes.filter(Boolean);
}

function collectPaymentRoutes(node) {
  const routes = [];

  if (node?.webhookUrl && typeof node.webhookUrl === "object") {
    for (const [env, url] of Object.entries(node.webhookUrl)) {
      routes.push(
        makePaymentRoute({
          kind: "webhook",
          env,
          url,
          sourceField: `webhookUrl.${env}`,
        }),
      );
    }
  }

  if (node?.webhookRoutes && typeof node.webhookRoutes === "object") {
    for (const [channel, url] of Object.entries(node.webhookRoutes)) {
      routes.push(
        makePaymentRoute({
          kind: "gateway-hook",
          env: channel,
          url,
          sourceField: `webhookRoutes.${channel}`,
        }),
      );
    }
  }

  if (
    node?.nexusEvents?.nexusTarget &&
    typeof node.nexusEvents.nexusTarget === "object"
  ) {
    for (const [env, url] of Object.entries(node.nexusEvents.nexusTarget)) {
      routes.push(
        makePaymentRoute({
          kind: "nexus-target",
          env,
          url,
          sourceField: `nexusEvents.nexusTarget.${env}`,
        }),
      );
    }
  }

  if (String(node?.id || "").toLowerCase() === "flowpay") {
    routes.push(...inferFlowpayApiRoutes(node));
  }

  const dedup = new Map();
  for (const route of routes.filter(Boolean)) {
    const key = `${route.kind}|${route.env}|${route.method || "-"}|${route.url}`;
    if (!dedup.has(key)) dedup.set(key, route);
  }
  return [...dedup.values()];
}

// GET /api/neo/skills — try neobot first, fallback to static registry
router.get("/skills", async (req, res) => {
  try {
    const r = await fetchWithTimeout(`${NEOBOT_URL}/api/neo/skills`);
    if (r.ok) {
      const data = await r.json();
      if (
        data.success &&
        Array.isArray(data.skills) &&
        data.skills.length > 0
      ) {
        return res.json(data);
      }
    }
  } catch {
    // neobot offline — use static fallback
  }

  res.json({
    success: true,
    skills: SKILLS_FALLBACK,
    source: "static-registry",
  });
});

// GET /api/neo/registry — skills registry summary
router.get("/registry", async (req, res) => {
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
    skills: SKILLS_FALLBACK.map((s) => ({
      id: s.id,
      latest: s.version,
      versions: 1,
      versionList: [s.version],
    })),
    status: "Static Registry (Neobot offline)",
    source: "static-registry",
  });
});

// GET /api/neo/search?q=...
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  if (!q)
    return res.json({
      success: true,
      results: [],
      message: "Provide ?q= to search",
    });

  const results = SKILLS_FALLBACK.filter(
    (s) =>
      s.id.includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.category.includes(q) ||
      s.description.toLowerCase().includes(q),
  );
  res.json({ success: true, results });
});

// GET /api/neo/ecosystem/payment-routes — strict payment-only route schema
router.get("/ecosystem/payment-routes", async (_req, res) => {
  const ecosystem = await loadEcosystemNodes();
  if (
    !ecosystem.success ||
    !Array.isArray(ecosystem.nodes) ||
    ecosystem.nodes.length === 0
  ) {
    return res.status(503).json({
      success: false,
      schemaVersion: PAYMENT_ROUTE_SCHEMA_VERSION,
      message: "Payment routes source unavailable",
      source: ecosystem.source,
    });
  }

  const paymentNodes = ecosystem.nodes.filter((node) => isPaymentNode(node));
  const payloadNodes = paymentNodes.map((node) => {
    const routes = collectPaymentRoutes(node);
    return {
      nodeId: node?.id || null,
      name: node?.name || null,
      org: node?.org || null,
      role: node?.role || null,
      repository: node?.repository || null,
      routes,
    };
  });

  const allRoutes = payloadNodes.flatMap((n) => n.routes);
  const inferredRoutes = allRoutes.filter((r) => r.inferred).length;

  return res.json({
    success: true,
    schemaVersion: PAYMENT_ROUTE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: ecosystem.source,
    schema: {
      entity: "payment-routes",
      requiredNodeFields: ["nodeId", "name", "org", "role", "routes"],
      requiredRouteFields: [
        "kind",
        "env",
        "url",
        "path",
        "sourceField",
        "inferred",
      ],
    },
    summary: {
      paymentNodes: payloadNodes.length,
      totalRoutes: allRoutes.length,
      inferredRoutes,
    },
    nodes: payloadNodes,
  });
});

// GET /api/neo/ecosystem — load actual ecosystem.json from orchestrator registry
router.get("/ecosystem", async (req, res) => {
  const ecosystem = await loadEcosystemNodes();
  if (ecosystem.success) {
    return res.json({
      success: true,
      nodes: ecosystem.nodes,
      source: ecosystem.source,
    });
  }

  // Fallback quando estiver em produção sem acesso ao FS local do orchestrator e sem Nexus.
  res.json({
    success: false,
    message: "Source of truth (ecosystem.json) not accessible locally.",
    hint: "Link to ../neobot-orchestrator/config/ecosystem.json",
  });
});

// GET /api/neo/ecosystem/live — ecosystem plus live connectivity status
router.get("/ecosystem/live", async (_req, res) => {
  const now = Date.now();
  if (
    liveProbeCache.payload &&
    now - liveProbeCache.checkedAt < PROBE_CACHE_TTL_MS
  ) {
    return res.json({ ...liveProbeCache.payload, cache: "hit" });
  }

  if (liveProbeCache.inFlight) {
    try {
      const payload = await liveProbeCache.inFlight;
      return res.json({ ...payload, cache: "shared" });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, error: e?.message || "live_probe_failed" });
    }
  }

  liveProbeCache.inFlight = (async () => {
    const ecosystem = await loadEcosystemNodes();
    if (
      !ecosystem.success ||
      !Array.isArray(ecosystem.nodes) ||
      ecosystem.nodes.length === 0
    ) {
      return {
        success: false,
        source: ecosystem.source,
        checkedAt: new Date().toISOString(),
        nodes: [],
        summary: {
          total: 0,
          online: 0,
          degraded: 0,
          offline: 0,
          unknown: 0,
          nexusLinked: 0,
          nexusUnlinked: 0,
        },
        message: "Live ecosystem source unavailable",
      };
    }

    const checkedAt = new Date().toISOString();
    const nodes = await Promise.all(
      ecosystem.nodes.map(async (node) => {
        const url = resolveNodeUrl(node);
        const probe = url
          ? await probeNodeStatus(url)
          : { status: "unknown", httpStatus: null };
        const nexusLinked = hasNexusIntegration(node);
        return {
          ...node,
          _live: {
            status: probe.status,
            httpStatus: probe.httpStatus,
            checkedAt,
            url,
            nexusLinked,
            nexusConnection: nexusLinked ? "linked" : "unlinked",
          },
        };
      }),
    );

    const summary = nodes.reduce(
      (acc, node) => {
        acc.total += 1;
        const status = node?._live?.status || "unknown";
        if (status === "online") acc.online += 1;
        else if (status === "degraded") acc.degraded += 1;
        else if (status === "offline") acc.offline += 1;
        else acc.unknown += 1;

        if (node?._live?.nexusLinked) acc.nexusLinked += 1;
        else acc.nexusUnlinked += 1;
        return acc;
      },
      {
        total: 0,
        online: 0,
        degraded: 0,
        offline: 0,
        unknown: 0,
        nexusLinked: 0,
        nexusUnlinked: 0,
      },
    );

    return {
      success: true,
      source: ecosystem.source,
      checkedAt,
      nodes,
      summary,
    };
  })();

  try {
    const payload = await liveProbeCache.inFlight;
    liveProbeCache.payload = payload;
    liveProbeCache.checkedAt = Date.now();
    return res.json({ ...payload, cache: "miss" });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: e?.message || "live_probe_failed" });
  } finally {
    liveProbeCache.inFlight = null;
  }
});

export default router;
