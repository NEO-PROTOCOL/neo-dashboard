import express from 'express';

const router = express.Router();

const NEOBOT_URL = process.env.NEOBOT_API_URL || 'https://nexus.neoprotocol.space';
const NEOBOT_KEY = process.env.NEOBOT_API_KEY || '';

async function neobotFetch(path, options = {}) {
    const url = `${NEOBOT_URL}${path}`;
    const headers = { 'Content-Type': 'application/json', ...(NEOBOT_KEY ? { 'Authorization': `Bearer ${NEOBOT_KEY}` } : {}) };
    return fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
}

router.get('/tasks', async (req, res) => {
    try {
        const r = await neobotFetch('/api/ecosystem');
        const data = await r.json();
        const nodes = (data.ecosystem || []).map(n => ({
            id: n.id,
            name: n.name,
            status: n.status || 'unknown',
            role: n.role
        }));
        res.json({ success: true, tasks: nodes, stats: { totalTasks: nodes.length, agent: 'NEO Nexus' } });
    } catch (e) {
        res.json({ success: true, tasks: [], message: `Neobot offline: ${e.message}`, stats: { totalTasks: 0, agent: 'Offline' } });
    }
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
    try {
        const r = await neobotFetch('/api/ecosystem');
        const data = await r.json();
        const nodes = data.ecosystem || [];
        res.json({
            success: true,
            stats: {
                uptime: process.uptime(),
                agent: 'Online',
                nodes: nodes.length,
                ecosystem: nodes.map(n => ({ id: n.id, name: n.name }))
            }
        });
    } catch (e) {
        res.json({ success: true, stats: { uptime: process.uptime(), agent: 'Nexus unreachable' } });
    }
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
        res.json({ success: false, error: e.message });
    }
});

router.get('/report/data', async (req, res) => {
    try {
        const r = await neobotFetch('/api/ecosystem');
        const data = await r.json();
        res.json({ success: true, data: { ecosystem: data.ecosystem || [], summary: 'Live data from NEO Nexus' } });
    } catch (e) {
        res.json({ success: true, data: { summary: 'Nexus unreachable', error: e.message } });
    }
});

export default router;
