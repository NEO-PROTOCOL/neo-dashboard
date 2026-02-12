import express from 'express';

const router = express.Router();

const NEOBOT_URL = process.env.NEOBOT_API_URL || 'https://nexus.neoprotocol.space';
const NEOBOT_KEY = process.env.NEOBOT_API_KEY || '';
const FETCH_TIMEOUT = 5000;

// Static fallback: ecosystem nodes from ecosystem.json (used when neobot is offline)
const ECOSYSTEM_FALLBACK = [
    { id: 'neobot-architect',  name: 'Neobot — Node Warrior / NEO Nexus', role: 'Sovereign Node / Orchestrator', url: 'https://nexus.neoprotocol.space' },
    { id: 'neo-nexus',         name: 'NEO Nexus (Event Hub)',              role: 'Event Bus / Standalone Hub',    url: 'https://neo-nexus-production.up.railway.app' },
    { id: 'flowpay',           name: 'FlowPay (PIX Gateway)',              role: 'Payment Gateway / PIX',         url: 'https://flowpay-production-10d8.up.railway.app' },
    { id: 'neo-agent-full',    name: 'Neo Agent Full (LangGraph ReAct)',   role: 'AI Sales Agent / Closer',       url: 'https://neo-agent-full-production.up.railway.app' },
    { id: 'neo-dashboard',     name: 'NEO Dashboard (Mission Control)',    role: 'Observability / Dashboard',     url: 'https://neo-dashboard-production-2e56.up.railway.app' },
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
    return fetchWithTimeout(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
}

// Probe a node URL to check if it's online
async function probeNode(url) {
    try {
        const r = await fetchWithTimeout(`${url}/health`, { method: 'GET' });
        return r.ok ? 'online' : 'degraded';
    } catch {
        try {
            const r2 = await fetchWithTimeout(url, { method: 'GET' });
            return r2.ok ? 'online' : 'degraded';
        } catch {
            return 'offline';
        }
    }
}

// GET /api/automations/tasks — ecosystem nodes with live status probing
router.get('/tasks', async (req, res) => {
    let nodes = ECOSYSTEM_FALLBACK;

    // Try to get live ecosystem from neobot
    try {
        const r = await neobotFetch('/api/ecosystem');
        const data = await r.json();
        if (Array.isArray(data.ecosystem) && data.ecosystem.length > 0) {
            nodes = data.ecosystem;
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
                model: 'claude-sonnet-4-5-20250929',
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
                model: 'claude-sonnet-4-5-20250929',
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
        res.json({ success: true, data: { ecosystem: data.ecosystem || ECOSYSTEM_FALLBACK, summary: 'Live data from NEO Nexus' } });
    } catch {
        res.json({ success: true, data: { ecosystem: ECOSYSTEM_FALLBACK, summary: 'Neobot offline — static data' } });
    }
});

export default router;
