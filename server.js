import fs from "fs";
import { exec, spawn } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import rateLimit from "express-rate-limit";
import automationRoutes from "./src/routes/automation-routes.js";
import neoRoutes from "./src/routes/neo-routes.js";
import nexusRoutes from "./src/routes/nexus-routes.js";
import aiRoutes from "./src/routes/ai-routes.js";
import ecosystemHealthRoutes from "./src/routes/ecosystem-health-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

function manualLoadEnv(path) {
  try {
    if (!fs.existsSync(path)) return;
    const content = fs.readFileSync(path, "utf8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index !== -1) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        process.env[key] = val;
      }
    });
    console.log(`[SYS] Manually loaded env from ${path}`);
  } catch (e) {
    console.error(`[SYS] Failed to manually load env from ${path}:`, e.message);
  }
}

// Load environment variables
dotenv.config();
manualLoadEnv(path.join(__dirname, "neo-config.env"));
manualLoadEnv(path.join(__dirname, ".env.local"));

// JSON Settings Fallback (Workaround for EPERM on .env files)
try {
  const jsonSettingsPath = path.join(__dirname, "app-settings.json");
  if (fs.existsSync(jsonSettingsPath)) {
    const settings = JSON.parse(fs.readFileSync(jsonSettingsPath, "utf8"));
    Object.entries(settings).forEach(([key, val]) => {
      process.env[key] = String(val);
    });
    console.log(`[SYS] Loaded settings from ${jsonSettingsPath}`);
  }
} catch (e) {
  console.error(`[SYS] Failed to load app-settings.json:`, e.message);
}

console.log("[SYS] Bootstrap sequence complete.");

if (
  !process.env.NEXUS_API_URL ||
  process.env.NEXUS_API_URL.includes("neoprotocol.space")
) {
  process.env.NEXUS_API_URL = "https://nexus.neoprotocol.space";
}
// NEXUS_ECOSYSTEM_URL: canonical Nexus ecosystem endpoint.
if (
  !process.env.NEXUS_ECOSYSTEM_URL ||
  process.env.NEXUS_ECOSYSTEM_URL.includes("neoprotocol.space")
) {
  process.env.NEXUS_ECOSYSTEM_URL = "https://nexus.neoprotocol.space/api/ecosystem";
}

const execAsync = promisify(exec);
const MONITOR_FETCH_TIMEOUT_MS = Number(
  process.env.MONITOR_FETCH_TIMEOUT_MS || 5000,
);
const STACK_REPORT_SOURCE_URL =
  process.env.STACK_REPORT_SOURCE_URL ||
  "https://raw.githubusercontent.com/NEO-PROTOCOL/neobot-orchestrator/main/config/stack_report.json";
const STACK_REPORT_FALLBACK_PATH = path.join(__dirname, "stack-report.json");
const DEFAULT_STACK_REPORT_CACHE_TTL_MS = 5 * 60 * 1000;
const rawStackReportTtl = process.env.STACK_REPORT_CACHE_TTL_MS;
const parsedStackReportCacheTtlMs =
  rawStackReportTtl && rawStackReportTtl.trim().length > 0
    ? Number(rawStackReportTtl)
    : DEFAULT_STACK_REPORT_CACHE_TTL_MS;
const STACK_REPORT_CACHE_TTL_MS =
  Number.isFinite(parsedStackReportCacheTtlMs) &&
  parsedStackReportCacheTtlMs >= 0
    ? parsedStackReportCacheTtlMs
    : DEFAULT_STACK_REPORT_CACHE_TTL_MS;
let stackReportCache = null; // { source, body, fetchedAt }

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function derivePrecision(report) {
  const health = report?.ecosystem_health || {};
  const meta = report?.meta || {};
  const totalNodes = Math.max(Number(meta.total_nodes || 0), 1);
  const averageReadiness = Number(health.average_readiness || 0);
  const gradeDistribution = health.grade_distribution || {};
  const findingsBySeverity = health.findings_by_severity || {};

  const gradedNodes = Object.entries(gradeDistribution).reduce(
    (sum, [, count]) => sum + Number(count || 0),
    0,
  );
  const gradeQuality =
    gradedNodes > 0
      ? Object.entries(gradeDistribution).reduce((sum, [grade, count]) => {
          const weight = {
            A: 100,
            B: 86,
            C: 72,
            D: 58,
            F: 40,
          }[grade] || 0;
          return sum + weight * Number(count || 0);
        }, 0) / gradedNodes
      : averageReadiness;

  const findingPenalty =
    ((Number(findingsBySeverity.critical || 0) * 6) +
      (Number(findingsBySeverity.high || 0) * 4) +
      (Number(findingsBySeverity.medium || 0) * 2) +
      (Number(findingsBySeverity.low || 0) * 1) +
      (Number(findingsBySeverity.info || 0) * 0.5)) /
    totalNodes;

  const precision = clampNumber(
    Math.round(0.68 * averageReadiness + 0.22 * gradeQuality + 12 - findingPenalty * 4),
    0,
    100,
  );

  return {
    precision,
    confidenceLabel:
      precision >= 90
        ? "high"
        : precision >= 75
          ? "solid"
          : precision >= 60
            ? "watch"     
            : "fragile",
    notes: [
      `readiness=${averageReadiness.toFixed(1)}`,
      `grade=${gradeQuality.toFixed(1)}`,
      `finding_penalty=${findingPenalty.toFixed(2)}`,
    ],
  };
}

function gradeColor(score) {
  if (score >= 90) return "brightgreen";
  if (score >= 80) return "green";
  if (score >= 65) return "yellow";
  if (score >= 50) return "orange";
  return "red";
}

async function getCachedStackReport() {
  const now = Date.now();
  if (
    stackReportCache &&
    now - stackReportCache.fetchedAt < STACK_REPORT_CACHE_TTL_MS
  ) {
    return { source: stackReportCache.source, body: stackReportCache.body };
  }

  try {
    const result = await fetchJsonWithTimeout(
      STACK_REPORT_SOURCE_URL,
      MONITOR_FETCH_TIMEOUT_MS,
    );
    if (result.ok && result.body) {
      stackReportCache = {
        source: "canonical",
        body: result.body,
        fetchedAt: now,
      };
      return { source: "canonical", body: result.body };
    }
    if (result.ok && !result.body) {
      console.warn(
        "[REPORT] Canonical stack report returned HTTP 200 with empty or invalid JSON body",
      );
    } else {
      console.warn(
        `[REPORT] Canonical stack report returned HTTP ${result.status}`,
      );
    }
  } catch (error) {
    console.warn(
      `[REPORT] Canonical stack report fetch failed: ${error.message}`,
    );
  }

  if (stackReportCache) {
    console.warn("[REPORT] Serving stale cached report due to fetch failure");
    return { source: stackReportCache.source, body: stackReportCache.body };
  }

  if (fs.existsSync(STACK_REPORT_FALLBACK_PATH)) {
    return {
      source: "fallback",
      body: JSON.parse(fs.readFileSync(STACK_REPORT_FALLBACK_PATH, "utf8")),
    };
  }

  throw new Error("No canonical stack report source available");
}

// ------------------------------------------------------------------
// Log Capture System (In-Memory Ring Buffer)
// ------------------------------------------------------------------
const MAX_LOGS = 100;
const serverLogs = [];

function captureLog(type, args) {
  const timestamp = new Date().toISOString();
  const rawMessage = args
    .map((arg) => {
      if (arg instanceof Error) return arg.stack || arg.message;
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return "[Circular or Unstringifiable Object]";
        }
      }
      return String(arg);
    })
    .join(" ");

  // Filter repetitive or noisy logs from the dashboard stream
  if (rawMessage.includes("Attempting Nexus fetch")) return;
  if (rawMessage.includes("Nexus fetch error")) type = "warn";
  if (
    rawMessage.includes("╔") ||
    rawMessage.includes("║") ||
    rawMessage.includes("╚") ||
    rawMessage.includes("═")
  )
    return;

  // Auto-tagging for cleaner UI
  let message = rawMessage;
  if (!message.startsWith("[")) {
    if (message.toLowerCase().includes("database")) message = `[DB] ${message}`;
    else if (message.toLowerCase().includes("telegram"))
      message = `[TG] ${message}`;
    else if (message.toLowerCase().includes("api"))
      message = `[API] ${message}`;
    else if (message.toLowerCase().includes("nexus"))
      message = `[NEXUS] ${message}`;
    else message = `[SYS] ${message}`;
  }

  serverLogs.unshift({ timestamp, type, message });
  serverLogs.splice(MAX_LOGS);

  process.stdout.write(`[${type.toUpperCase()}] ${message}\n`);
}

// Override console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => captureLog("info", args);
console.error = (...args) => captureLog("error", args);
console.warn = (...args) => captureLog("warn", args);

class SimpleTelegramBot {
  constructor(token, defaultChatId) {
    this.token = token;
    this.defaultChatId = defaultChatId;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId, message, options = {}) {
    if (!this.token) {
      console.warn("⧖ Telegram Token missing. Message skipped:", message);
      return;
    }
    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId || this.defaultChatId,
          text: message,
          parse_mode: options.parse_mode || "Markdown",
          ...options,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        console.warn(`Telegram API warning: ${data.description}`);
      }
      return data.result;
    } catch (error) {
      console.error("✗ Error sending Telegram message:", error);
    }
  }
}

const telegramBot = new SimpleTelegramBot(
  process.env.TELEGRAM_BOT_TOKEN,
  process.env.TELEGRAM_CHAT_ID,
);

// ------------------------------------------------------------------
// Express Setup
// ------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

const runningOnRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_ENVIRONMENT_NAME ||
    process.env.RAILWAY_PROJECT_ID,
);

function resolveTrustProxy() {
  if (process.env.TRUST_PROXY === "0") return false;
  const n = Number(process.env.TRUST_PROXY);
  if (Number.isFinite(n) && n >= 0) return n;
  // One edge hop (typical for Railway); use TRUST_PROXY=N to tune.
  return 1;
}

// Railway sets X-Forwarded-For / Forwarded. trust proxy must be set so req.ip is the client.
// express-rate-limit v8 also runs strict header validations; see reportRateLimit.validate below.
app.set("trust proxy", resolveTrustProxy());
console.log(
  `[SYS] trust proxy=${JSON.stringify(app.get("trust proxy"))} railway=${runningOnRailway} TRUST_PROXY=${process.env.TRUST_PROXY ?? "unset"}`,
);

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Prevent stale HTML delivery behind edge/browser caches.
app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith(".html")) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader(
      "Content-Security-Policy",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https: blob:;",
    );
  }
  next();
});

const reportRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per window
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests for stack report, please wait a moment.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // v8 validates proxy headers in keyGenerator; Railway headers can still trip ValidationError
  // and abort the process. We already set trust proxy; disable these checks behind the edge.
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
  },
});

app.get("/api/stack-report.json", reportRateLimit, async (_req, res) => {
  try {
    const { source, body } = await getCachedStackReport();
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("X-Stack-Report-Source", source);
    res.json(body);
  } catch (error) {
    res.status(503).json({
      error: "STACK_REPORT_UNAVAILABLE",
      message: error.message,
    });
  }
});

app.get("/api/readiness-badge.json", reportRateLimit, async (_req, res) => {
  try {
    const { body } = await getCachedStackReport();
    const health = body?.ecosystem_health || {};
    const meta = body?.meta || {};
    const score = Number(health.average_readiness || 0);
    const findings = Number(health.total_findings || 0);
    const nodes = Number(meta.total_nodes || 0);
    const { precision, confidenceLabel, notes } = derivePrecision(body);

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.json({
      schemaVersion: 1,
      label: "NEØ Readiness",
      message: `${score}/100 · precision ${precision}% · ${nodes} nodes · ${findings} findings`,
      readinessScore: score,
      totalFindings: findings,
      totalNodes: nodes,
      color: gradeColor(score),
      precision: `${precision}%`,
      precisionScore: precision,
      precisionLabel: confidenceLabel,
      precisionNotes: notes,
      namedLogo: "data:image/svg+xml;base64,",
      style: "flat-square",
      labelColor: "0d0d0d",
    });
  } catch (error) {
    res.status(503).json({
      error: "READINESS_BADGE_UNAVAILABLE",
      message: error.message,
    });
  }
});

// Public API health (before /api auth) — probes e plataforma não devem logar [SECURITY].
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    telegram: process.env.TELEGRAM_BOT_TOKEN ? "configured" : "missing",
    nexus_url: (process.env.NEXUS_API_URL || "FALLBACK").replace(
      /(:\/\/).+?(\/|$)/,
      "$1***$2",
    ),
    scheduler: "active",
    timestamp: new Date().toISOString(),
  });
});

// Legacy path redirect for existing frontend references (will be updated next)
app.get("/stack-report.json", (_req, res) => {
  res.redirect(307, "/api/stack-report.json");
});

// Retire legacy public surfaces before static file serving exposes them directly.
app.get(["/neo.html", "/neo"], (_req, res) => {
  res.redirect(302, "/stack-analyzer.html");
});

app.get(["/mobile", "/mobile.html"], (_req, res) => {
  res.redirect(302, "/stack-analyzer.html");
});

// Serve static assets from a dedicated public surface.
app.use(express.static(PUBLIC_DIR));

// ------------------------------------------------------------------
// Security Middleware (NΞØ Auth)
// ------------------------------------------------------------------
const { GATEWAY_PASSWORD } = process.env;

// Production safety: require a gateway password when running in production.
if (process.env.NODE_ENV === "production" && !GATEWAY_PASSWORD) {
  console.error(
    "FATAL: GATEWAY_PASSWORD must be set when running in production. Aborting startup.",
  );
  process.exit(1);
}

// RFC 6598 (100.64.0.0/10) — shared address space used by Railway for internal
// health checks and proxies. Requests from this range are not external threats.
const isRailwayInternalIp = (ip) => {
  const stripped = (ip || "").replace("::ffff:", "");
  const parts = stripped.split(".").map(Number);
  return (
    parts.length === 4 && parts[0] === 100 && parts[1] >= 64 && parts[1] < 128
  );
};

const authMiddleware = (req, res, next) => {
  const providedPassword =
    req.headers["x-gateway-password"] || req.query.password;

  if (GATEWAY_PASSWORD && providedPassword === GATEWAY_PASSWORD) {
    return next();
  }

  // Suppress noisy security logs for Railway's internal health-check probes.
  if (!isRailwayInternalIp(req.ip)) {
    console.warn(`[SECURITY] Unauthorized access attempt from ${req.ip}`);
  }
  res.status(401).json({
    error: "UNAUTHORIZED_ACCESS",
    message: "Valid x-gateway-password header or password query parameter required",
  });
};

// Apply auth to API routes
app.use("/api", authMiddleware);

// Mount Routes
app.use("/api/automations", automationRoutes);
app.use("/api/neo", neoRoutes);
app.use("/api/nexus", nexusRoutes);
app.use("/api/ecosystem", ecosystemHealthRoutes);
app.use("/api/ai", aiRoutes);

// Storage (Legacy In-Memory)
let reminders = [];
let messages = [];
let stats = { totalReminders: 0, totalMessages: 0 };
let monitorState = {
  lastCheckAt: null,
  lastNexusStatus: "unknown",
  lastNexusLatencyMs: null,
  lastNexusError: null,
  checksTotal: 0,
  alertsTotal: 0,
};

async function fetchJsonWithTimeout(url, timeoutMs = MONITOR_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function collectMonitorSnapshot() {
  const startedAt = Date.now();
  const nexusUrl =
    process.env.NEXUS_API_URL || "https://nexus.neoprotocol.space";
  const target = `${nexusUrl.replace(/\/$/, "")}/health`;

  let nexus = {
    status: "unknown",
    http_status: null,
    latency_ms: null,
    error: null,
  };

  try {
    const result = await fetchJsonWithTimeout(target);
    nexus.latency_ms = Date.now() - startedAt;
    nexus.http_status = result.status;
    nexus.status = result.ok ? result.body?.status || "ok" : "degraded";
    if (!result.ok) {
      nexus.error = result.body?.error || `HTTP ${result.status}`;
    }
  } catch (error) {
    nexus.latency_ms = Date.now() - startedAt;
    nexus.status = "offline";
    nexus.error = error?.message || "Nexus request failed";
  }

  monitorState = {
    ...monitorState,
    lastCheckAt: new Date().toISOString(),
    lastNexusStatus: nexus.status,
    lastNexusLatencyMs: nexus.latency_ms,
    lastNexusError: nexus.error,
    checksTotal: monitorState.checksTotal + 1,
  };

  const heapMb =
    Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
  const rssMb =
    Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100;

  return {
    dashboard: {
      status: "ok",
      uptime_seconds: Math.floor(process.uptime()),
      memory_heap_mb: heapMb,
      memory_rss_mb: rssMb,
      logs_buffer_size: serverLogs.length,
    },
    nexus,
    monitor: {
      checks_total: monitorState.checksTotal,
      alerts_total: monitorState.alertsTotal,
      fetch_timeout_ms: MONITOR_FETCH_TIMEOUT_MS,
    },
    timestamp: new Date().toISOString(),
  };
}

// ------------------------------------------------------------------
// Standard API Routes
// ------------------------------------------------------------------

// Health Check (Railway/Root)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "neo-dashboard",
    timestamp: new Date().toISOString(),
  });
});

// Stats
app.get("/api/stats", (req, res) => res.json(stats));

// Logs API (Real-time Console Stream)
app.get("/api/logs", (req, res) => res.json(serverLogs));

// POST Logs (From Core)
app.post("/api/logs", (req, res) => {
  const { type, message, timestamp } = req.body;
  if (message) {
    serverLogs.unshift({
      timestamp: timestamp ?? new Date().toISOString(),
      type: type ?? "info",
      message: `[CORE] ${message}`,
    });
    serverLogs.splice(MAX_LOGS);
  }
  res.json({ success: true });
});

// Reminders API (Simplified)
app.get("/api/reminders", async (req, res) => {
  try {
    const { stdout } = await execAsync("atq");
    const atJobs = stdout
      .trim()
      .split("\n")
      .filter((line) => line)
      .map((line) => ({
        id: line.split(/\s+/)[0],
        text: "Agendado via at",
      }));
    res.json(atJobs);
  } catch (e) {
    res.json(reminders);
  }
});

app.post("/api/reminders", async (req, res) => {
  const { text, when } = req.body;
  if (!(text && when)) return res.status(400).json({ error: "Missing args" });

  console.log(`[Mock] Reminder created: ${text} at ${when}`);
  stats.totalReminders++;
  res.json({ success: true, mock: true });
});

// Messages API
app.get("/api/messages", (req, res) => res.json(messages.slice(-10).reverse()));

app.post("/api/messages", async (req, res) => {
  const { to, message } = req.body;
  if (!(to && message)) return res.status(400).json({ error: "Missing args" });

  try {
    const scriptPath = path.join(
      __dirname,
      "../skills/telegram/scripts/telegram.ts",
    );
    const child = spawn(
      "npx",
      ["tsx", scriptPath, "--to", to, "--message", message],
      {
        cwd: path.join(__dirname, ".."),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    console.log(`⟠ Message sent process spawned for ${to}`);
  } catch (e) {
    console.error(e);
  }

  const msg = {
    id: Date.now().toString(),
    to,
    text: message,
    timestamp: new Date().toISOString(),
    from: "Você",
    status: "sent",
  };
  messages.push(msg);
  stats.totalMessages++;
  res.json({ success: true, message: msg });
});

// ------------------------------------------------------------------
// Monitoring API (/api/monitor/*)
// ------------------------------------------------------------------
app.get("/api/monitor/health", async (req, res) => {
  const snapshot = await collectMonitorSnapshot();
  const status = snapshot.nexus.status === "offline" ? "degraded" : "healthy";
  res.json({ status, ...snapshot });
});

app.get("/api/monitor/alerts", async (req, res) => {
  const snapshot = await collectMonitorSnapshot();
  const alerts = [];

  if (snapshot.nexus.status === "offline") {
    alerts.push({
      code: "NEXUS_OFFLINE",
      severity: "high",
      message: `Nexus indisponível (${snapshot.nexus.error || "sem detalhe"})`,
    });
  } else if (snapshot.nexus.status !== "ok") {
    alerts.push({
      code: "NEXUS_DEGRADED",
      severity: "medium",
      message: `Nexus retornou status ${snapshot.nexus.status}`,
    });
  }

  if ((snapshot.nexus.latency_ms || 0) > 2000) {
    alerts.push({
      code: "NEXUS_LATENCY_HIGH",
      severity: "medium",
      message: `Latência Nexus alta (${snapshot.nexus.latency_ms}ms)`,
    });
  }

  if (alerts.length > 0) {
    monitorState.alertsTotal += alerts.length;
  }

  res.json({
    hasAlert: alerts.length > 0,
    alerts,
    snapshot,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/monitor/metrics", async (req, res) => {
  const snapshot = await collectMonitorSnapshot();
  res.json({
    snapshot,
    process: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      node: process.version,
    },
  });
});

app.post("/api/monitor/test-alert", async (req, res) => {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (telegramBot?.token && chatId) {
    await telegramBot.sendMessage(
      chatId,
      `🧪 TEST ALERT\nDashboard: ${process.env.PUBLIC_URL || `http://localhost:${PORT}`}\nTime: ${new Date().toISOString()}`,
      { parse_mode: undefined },
    );
    monitorState.alertsTotal += 1;
    return res.json({ success: true, sent: true });
  }

  return res.json({
    success: true,
    sent: false,
    reason: "Telegram not configured",
  });
});

// ------------------------------------------------------------------
// Frontend Route
// ------------------------------------------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// ------------------------------------------------------------------
// Server Start
// ------------------------------------------------------------------
app.listen(PORT, () => {
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
  console.log(`
╔═══════════════════════════════════════════════════════
║
║   Ξ  NΞØBOT Dashboard//API
║
║   Status: ✓ ONLINE
║   Port: ${PORT}
║   URL: ${publicUrl}
║
║   Dashboard: ${publicUrl}
║   NEO API: ${publicUrl}/api/neo
║
╚═══════════════════════════════════════════════════════
    `);
});

export default app;
