import express from 'express';

const router = express.Router();

const NEOBOT_URL = process.env.NEOBOT_API_URL || 'https://nexus.neoprotocol.space';
const NEOBOT_KEY = process.env.NEOBOT_API_KEY || '';
const FETCH_TIMEOUT = 15000;

async function neobotFetch(path, options = {}) {
    const url = `${NEOBOT_URL}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(NEOBOT_KEY ? { 'Authorization': `Bearer ${NEOBOT_KEY}` } : {})
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            headers: { ...headers, ...options.headers },
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
    const { message } = req.body;
    try {
        const r = await neobotFetch('/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-latest',
                messages: [
                    { role: 'system', content: 'You are the NΞØ PROTOCOL Core AI. Respond with precision, using the protocol iconography (⟠, ⦿, ✓, ✗, Ξ). Be concise and technical.' },
                    { role: 'user', content: message }
                ],
                max_tokens: 1024
            })
        });
        const data = await r.json();
        res.json({ success: true, message: data.choices?.[0]?.message?.content || 'Ξ System link established.' });
    } catch (e) {
        res.status(503).json({ success: false, error: 'Neobot Offline' });
    }
});

// POST /api/ai/analyze-bug — Advanced Code Analysis (Strict Protocol)
router.post('/analyze-bug', async (req, res) => {
    const { error, code } = req.body;

    const prompt = `
[STRICT CODE ANALYSIS REQUEST]
PROTOCOL: NΞØ-X1
OBJECTIVE: IDENTIFY SYSTEM FAILURES AND ARCHITECTURAL DEVIATIONS.

ERROR_CONTEXT:
${error}

CORE_FRAGMENTS:
${code}

ANALYSIS_REQUIREMENTS (NO FLEXIBILITY):
1. Identify the EXACT line of failure.
2. Check for Nexus Event compliance (are events being emitted correctly?).
3. Verify Error Handling (is it graceful or blocking?).
4. Security Audit (raw inputs, unauthenticated routes).
5. FIX: Provide the exact optimized code block to resolve the issue.

RESPONSE_FORMAT:
### ◬ AUDIT_LOG
[Summary of findings]

### ⦿ RESOLVER_PATH
[Step-by-step fix]

### ✓ OPTIMIZED_CORE
[Code block]
`;

    try {
        const r = await neobotFetch('/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-latest',
                messages: [
                    { role: 'system', content: 'You are an advanced NΞØ Protocol Debugger. You do not offer suggestions, you provide absolute architectural fixes based on strict protocol rules.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 2048
            })
        });
        const data = await r.json();
        res.json({ success: true, message: data.choices?.[0]?.message?.content || '◬ No failures detected in fragmented core.' });
    } catch (e) {
        res.status(503).json({ success: false, error: 'Neobot Offline' });
    }
});

// GET /api/ai/stats
router.get('/stats', async (req, res) => {
    // Mocked stats for now
    res.json({
        totalRequests: 42,
        totalTokens: 125430,
        totalCost: 0.85,
        avgResponseTime: 1200
    });
});

export default router;
