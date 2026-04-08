import express from "express";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

const router = express.Router();

const FETCH_TIMEOUT = 5000;
const NODE_PROBE_TIMEOUT = Number(
  process.env.ECOSYSTEM_NODE_PROBE_TIMEOUT_MS || 2500,
);
const ECOSYSTEM_CACHE_TTL = 60000; // 1 minute cache

let ecosystemCache = null;
let ecosystemCacheTime = 0;

// Project progress metadata based on recent development
// Updated: 2026-03-17
const PROJECT_PROGRESS = {
  "neobot-orchestrator": {
    version: "Phase 1.0 IN PROGRESS",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["Core + NEO Layer integrated", "Node Warrior environment", "IPFS Skills Registry"],
    milestone: "Orchestration layer active",
  },
  "neo-nexus": {
    version: "v1.0",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["System Event Bus OK", "Central Nervous System", "All nodes connected"],
    milestone: "Event Bus operational",
  },
  "neo-agent-full": {
    version: "v2.5 Active",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["Autonomous Cloud Engine", "Context continuity", "Continuous interaction memory"],
    milestone: "Agent cloud operational",
  },
  "neo-id": {
    version: "Namespace-as-a-Service",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["ENSv2 ready", "Identity layer operational", "Namespace coordination"],
    milestone: "Identity infrastructure active",
  },
  "mio-system": {
    version: "v2.0-openclaw",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["Web3 Auth layer", "9 core identities", "Autonomous operation"],
    milestone: "Identity management integrated",
  },
  "neo-mcp-server": {
    version: "v2.0.0",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["Storage tools active", "Ecosystem tools", "MCP transport modes"],
    milestone: "Cognitive API operational",
  },
  "neo-tunnel": {
    version: "Active",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["Sovereign tunnel for dev", "WebSocket auth", "Webhook forwarding"],
    milestone: "Dev tunneling infrastructure",
  },
  "neo-dashboard": {
    version: "Active",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["Observability dashboard", "Stack analyzer", "3D ecosystem view"],
    milestone: "Operational dashboard",
  },
  "neo-protocol-contracts": {
    version: "Multichain Ready",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["Base + Polygon + TON", "Smart contracts", "Cross-chain coordination"],
    milestone: "Smart contracts deployed",
  },
  "flowpay": {
    version: "Production Ready",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["PIX gateway", "Crypto integration", "Webhook integration"],
    milestone: "Payment gateway operational",
  },
  "smart-factory": {
    version: "Production Ready",
    status: "active",
    lastUpdate: "2026-03-17",
    highlights: ["Jetton factory", "Contract deployment", "Token creation"],
    milestone: "Smart factory operational",
  },
};

function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
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

  // Return cached result if still valid
  if (
    ecosystemCache &&
    ecosystemCache.success &&
    now - ecosystemCacheTime < ECOSYSTEM_CACHE_TTL
  ) {
    return ecosystemCache;
  }

  // Try local file first with multiple path variations
  const localPaths = [
    process.env.ECOSYSTEM_JSON_PATH,
    path.resolve(process.cwd(), "../neobot-orchestration/config/ecosystem.json"),
    path.resolve(process.cwd(), "../neobot-orchestrator/config/ecosystem.json"),
    path.resolve(process.cwd(), "../../neobot-orchestration/config/ecosystem.json"),
    path.resolve(process.cwd(), "../../neobot-orchestrator/config/ecosystem.json"),
    path.resolve("/app/neobot-orchestration/config/ecosystem.json"),
    path.resolve("/app/neobot-orchestrator/config/ecosystem.json"),
  ].filter(Boolean);

  for (const ecosystemPath of localPaths) {
    try {
      const raw = await fsPromises.readFile(ecosystemPath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const result = { success: true, nodes: parsed, source: "local-file" };
        ecosystemCache = result;
        ecosystemCacheTime = now;
        return result;
      }
    } catch (_e) {
      // Try next path
    }
  }

  // Fallback: try to fetch from GitHub (supports repository rename variants)
  const remoteUrls = [
    process.env.ECOSYSTEM_SOURCE_URL,
    "https://raw.githubusercontent.com/NEO-PROTOCOL/neobot-orchestration/main/config/ecosystem.json",
    "https://raw.githubusercontent.com/NEO-PROTOCOL/neobot-orchestrator/main/config/ecosystem.json",
  ].filter(Boolean);

  for (const remoteUrl of remoteUrls) {
    try {
      const response = await fetchWithTimeout(remoteUrl, { method: "GET" }, 10000);
      if (!response.ok) continue;

      const raw = await response.text();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const result = { success: true, nodes: parsed, source: "github" };
        ecosystemCache = result;
        ecosystemCacheTime = now;
        return result;
      }
    } catch (_e) {
      // Try next URL
    }
  }

  // Last fallback: bundled graph artifact from this repository
  try {
    const graphPath = path.resolve(process.cwd(), "ecosystem-graph.json");
    if (fs.existsSync(graphPath)) {
      const raw = await fsPromises.readFile(graphPath, "utf8");
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
      if (nodes.length > 0) {
        const result = { success: true, nodes, source: "graph-file" };
        ecosystemCache = result;
        ecosystemCacheTime = now;
        return result;
      }
    }
  } catch (_e) {
    // Keep unavailable fallback below
  }

  const result = { success: false, nodes: [], source: "unavailable" };
  ecosystemCache = result;
  ecosystemCacheTime = now;
  return result;
}

function resolveNodeUrl(node) {
  const candidates = [
    node?.url,
    node?.hosting?.activeUrl,
    node?.hosting?.targetCustomDomain,
    node?.hosting?.productionUrl,
    node?.hosting?.railwayUrl,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "string" && candidate.trim()) {
      const normalized = candidate.trim();
      if (
        !normalized.includes(".railway.internal") &&
        !normalized.includes("localhost")
      ) {
        if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
          return normalized;
        }
        return `https://${normalized}`;
      }
    }
  }
  return null;
}

// GET /api/ecosystem/health — ecosystem status + progress metadata
router.get("/health", async (_req, res) => {
  const ecosystem = await loadEcosystemNodes();

  if (!ecosystem.success || !Array.isArray(ecosystem.nodes)) {
    return res.status(503).json({
      success: false,
      message: "Ecosystem source unavailable",
      source: ecosystem.source,
    });
  }

  const checkedAt = new Date().toISOString();
  const nodes = await Promise.all(
    ecosystem.nodes.map(async (node) => {
      const url = resolveNodeUrl(node);
      const probe = url
        ? await probeNodeStatus(url)
        : { status: "unknown", httpStatus: null };

      const progress = PROJECT_PROGRESS[node?.id] || {
        version: node?.version || "unspecified",
        status: "monitoring",
        lastUpdate: checkedAt,
        highlights: [],
        milestone: "Status unknown",
      };

      return {
        id: node?.id,
        name: node?.name,
        org: node?.org,
        role: node?.role,
        repository: node?.repository,
        _health: {
          status: probe.status,
          httpStatus: probe.httpStatus,
          url,
          checkedAt,
        },
        _progress: progress,
      };
    }),
  );

  const summary = {
    total: nodes.length,
    online: nodes.filter((n) => n._health.status === "online").length,
    degraded: nodes.filter((n) => n._health.status === "degraded").length,
    offline: nodes.filter((n) => n._health.status === "offline").length,
    unknown: nodes.filter((n) => n._health.status === "unknown").length,
    lastProbed: checkedAt,
  };

  // Group by role for organizational clarity
  const byRole = nodes.reduce((acc, node) => {
    const role = node.role || "Unspecified";
    if (!acc[role]) acc[role] = [];
    acc[role].push(node);
    return acc;
  }, {});

  res.json({
    success: true,
    ecosystem: {
      summary,
      timestamp: checkedAt,
      source: ecosystem.source,
    },
    nodes,
    organization: {
      byRole,
      totalRoles: Object.keys(byRole).length,
    },
  });
});

// GET /api/ecosystem/progress — progress snapshot focused on milestones
router.get("/progress", async (_req, res) => {
  const ecosystem = await loadEcosystemNodes();

  if (!ecosystem.success) {
    return res.status(503).json({
      success: false,
      message: "Ecosystem source unavailable",
    });
  }

  const progressReport = ecosystem.nodes
    .filter((node) => PROJECT_PROGRESS[node?.id])
    .map((node) => {
      const progress = PROJECT_PROGRESS[node.id];
      return {
        id: node.id,
        name: node.name,
        role: node.role,
        progress: {
          version: progress.version,
          status: progress.status,
          milestone: progress.milestone,
          highlights: progress.highlights,
          lastUpdate: progress.lastUpdate,
        },
        repository: node.repository,
      };
    });

  const categorized = {
    "Core Infrastructure": progressReport.filter(
      (n) => n.role && n.role.includes("Infrastructure"),
    ),
    "Event & Messaging": progressReport.filter(
      (n) => n.role && (n.role.includes("Event") || n.role.includes("Message")),
    ),
    "Identity & Security": progressReport.filter(
      (n) => n.role && (n.role.includes("Identity") || n.role.includes("Auth")),
    ),
    Agents: progressReport.filter(
      (n) => n.role && n.role.includes("Agent"),
    ),
    Observability: progressReport.filter(
      (n) => n.role && n.role.includes("Observability"),
    ),
    Operational: progressReport.filter(
      (n) => n.role && (n.role.includes("Orchestrator") || n.role.includes("Governance")),
    ),
    Contracts: progressReport.filter(
      (n) => n.role && n.role.includes("Contract"),
    ),
    Finance: progressReport.filter(
      (n) => n.role && n.role.includes("Financial"),
    ),
  };

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    total: progressReport.length,
    categorized,
    allProjects: progressReport,
  });
});

export default router;
