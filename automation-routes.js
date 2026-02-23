import express from 'express';

const router = express.Router();

const NEOBOT_URL = process.env.NEOBOT_API_URL || 'https://nexus.neoprotocol.space';
const NEOBOT_KEY = process.env.NEOBOT_API_KEY || '';
const FETCH_TIMEOUT = 5000;

// Static fallback: ecosystem nodes from ecosystem.json (used when neobot is offline)
const ECOSYSTEM_FALLBACK = [
    { id: 'neobot-architect', name: 'Neobot — Node Warrior / NEO Nexus', role: 'Sovereign Node / Orchestrator', url: 'https://architect.neoprotocol.space' },
    { id: 'neo-nexus', name: 'NEO Nexus (Event Hub)', role: 'Event Bus / Standalone Hub', url: 'https://nexus.neoprotocol.space' },
    { id: 'flowpay', name: 'FlowPay (PIX Gateway)', role: 'Payment Gateway / PIX', url: 'https://flowpay.cash' },
    { id: 'neo-agent-full', name: 'Neo Agent Full (LangGraph ReAct)', role: 'AI Sales Agent / Closer', url: 'https://agent.neoprotocol.space' },
    { id: 'neo-dashboard', name: 'NEO Dashboard (Mission Control)', role: 'Observability / Dashboard', url: 'https://dashboard.neoprotocol.space' },
];

function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

async function neobotFetch(path, options = {}) {
    const url = `${NEOBOT_URL}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(NEOBOT_KEY ? { 'Authorization': `Bearer ${NEOBOT_KEY}` } : {})
    };
    return fetchWithTimeout(url, { ...options, headers: { ...headers, ...options.headers } });
}

function extractNodes(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.ecosystem)) return data.ecosystem;
    if (Array.isArray(data?.nodes)) return data.nodes;
    return [];
}

// Probe a node URL to check if it's online
async function probeNode(url) {
    const normalizedUrl = (url || '').replace(/\/+$/, '');
    const candidates = [`${normalizedUrl}/health`, `${normalizedUrl}/api/health`, normalizedUrl];
    let hasHttpResponse = false;

    for (const target of candidates) {
        try {
            const response = await fetchWithTimeout(target, { method: 'GET' });
            hasHttpResponse = true;
            if (response.ok) return 'online';
        } catch {
            // try next endpoint
        }
    }

    return hasHttpResponse ? 'degraded' : 'offline';
}

// GET /api/automations/tasks — ecosystem nodes with live status probing
router.get('/tasks', async (req, res) => {
    let nodes = ECOSYSTEM_FALLBACK;

    // Try to get live ecosystem from neobot
    try {
        const r = await neobotFetch('/api/ecosystem');
        const data = await r.json();
        const extracted = extractNodes(data);
        if (extracted.length > 0) {
            nodes = extracted;
        }
    } catch {
        // neobot offline — use static fallback
    }

    // Probe each node (parallel, best-effort, 5s timeout)
    const probed = await Promise.all(
        nodes.map(async (n) => {
            const nodeUrl = n.url || n.hosting?.productionUrl || n.webhookUrl?.production?.replace('/api/webhook/nexus', '');
            const status = nodeUrl ? await probeNode(nodeUrl) : 'unknown';
            return { id: n.id, name: n.name, role: n.role, url: nodeUrl, status };
        })
    );

    res.json({
        success: true,
        tasks: probed,
        stats: { totalTasks: probed.length, agent: 'NEO Ecosystem' }
    });
});

router.post('/tasks/:taskId/execute', async (req, res) => {
    try {
        const r = await neobotFetch('/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                messages: [{ role: 'user', content: `Execute task: ${req.params.taskId}` }],
                max_tokens: 256
            })
        });
        const data = await r.json();
        const reply = data.choices?.[0]?.message?.content || 'Task triggered.';
        res.json({ success: true, message: reply });
    } catch (e) {
        res.json({ success: false, message: `Error: ${e.message}` });
    }
});

router.post('/tasks/:taskId/toggle', async (req, res) => {
    res.json({ success: true, message: `Task ${req.params.taskId} state changed` });
});

router.get('/stats', async (req, res) => {
    res.json({
        success: true,
        stats: {
            uptime: process.uptime(),
            agent: 'Dashboard',
            nodes: ECOSYSTEM_FALLBACK.length
        }
    });
});

router.post('/report/generate', async (req, res) => {
    try {
        const r = await neobotFetch('/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                messages: [{ role: 'user', content: 'Generate a brief NEO Protocol status report with ecosystem health, active nodes, and key metrics.' }],
                max_tokens: 512
            })
        });
        const data = await r.json();
        const report = data.choices?.[0]?.message?.content || 'Report unavailable.';
        res.json({ success: true, report, filepath: null });
    } catch (e) {
        res.json({ success: false, error: `Neobot offline: ${e.message}` });
    }
});

router.get('/report/data', async (req, res) => {
    try {
        const r = await neobotFetch('/api/ecosystem');
        const data = await r.json();
        const ecosystem = extractNodes(data);
        res.json({
            success: true,
            data: {
                ecosystem: ecosystem.length > 0 ? ecosystem : ECOSYSTEM_FALLBACK,
                summary: ecosystem.length > 0 ? 'Live data from NEO Nexus' : 'Fallback data',
            },
        });
    } catch {
        res.json({ success: true, data: { ecosystem: ECOSYSTEM_FALLBACK, summary: 'Neobot offline — static data' } });
    }
});

export default router;
