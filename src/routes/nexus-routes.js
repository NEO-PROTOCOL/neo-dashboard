import express from 'express';

const router = express.Router();

// Configuration
const FETCH_TIMEOUT_MS = 10000;    // 10s timeout per request
const getNexusUrl = () => process.env.NEXUS_API_URL || 'https://neo-nexus-production.up.railway.app';

function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

// Circuit breaker state
let failCount = 0;
let circuitOpenUntil = 0;
const FAIL_THRESHOLD = 5;
const COOLDOWN_MS = 60 * 1000; // 1 min circuit break

function handleNexusError(label, error, res, url) {
    const now = Date.now();
    failCount++;

    if (failCount >= FAIL_THRESHOLD) {
        console.warn(`[NEXUS] ${label} critical failure. Opening circuit for 60s. Error: ${error.message}`);
        circuitOpenUntil = now + COOLDOWN_MS;
        failCount = 0;
    }

    res.status(503).json({
        success: false,
        error: 'Nexus service unreachable',
        offline: true,
        attemptedUrl: url,
        message: error.message
    });
}

const checkCircuit = (res) => {
    if (Date.now() < circuitOpenUntil) {
        res.status(503).json({
            success: false,
            error: 'Nexus Circuit Open',
            message: 'Service is temporarily disabled due to persistent failures',
            offline: true
        });
        return false;
    }
    return true;
};

// Proxy for Nexus Retry Stats
router.get('/retry/stats', async (req, res) => {
    if (!checkCircuit(res)) return;
    const nexusUrl = getNexusUrl();
    const url = `${nexusUrl}/api/retry/stats`;
    try {
        const response = await fetchWithTimeout(url);
        const data = await response.json();
        failCount = 0;
        res.json(data);
    } catch (error) {
        handleNexusError('retry/stats', error, res, url);
    }
});

// Proxy for Nexus Health Detailed
router.get('/health', async (req, res) => {
    if (!checkCircuit(res)) return;
    const nexusUrl = getNexusUrl();
    const url = `${nexusUrl}/health/detailed`;
    try {
        const response = await fetchWithTimeout(url);
        const data = await response.json();
        failCount = 0;
        res.json(data);
    } catch (error) {
        handleNexusError('health', error, res, url);
    }
});

// Proxy for Nexus Simple Metrics (parsing Prometheus text)
router.get('/metrics/summary', async (req, res) => {
    if (!checkCircuit(res)) return;
    const nexusUrl = getNexusUrl();
    const url = new URL('/metrics', nexusUrl).toString();
    try {
        const response = await fetchWithTimeout(url);
        const text = await response.text();

        failCount = 0;

        const extract = (metricName) => {
            const regex = new RegExp(`^${metricName}(?:\\{[^\\}]*\\})?\\s+(\\d+(\\.\\d+)?)$`, 'm');
            const match = text.match(regex);
            return match ? parseFloat(match[1]) : 0;
        };

        res.json({
            eventsTotal: extract('nexus_events_total'),
            reactorExecutions: extract('nexus_reactor_executions_total'),
            retryQueueSize: extract('nexus_retry_queue_size'),
            deadLetterSize: extract('nexus_dead_letter_queue_size'),
            wsConnections: extract('nexus_websocket_connections')
        });
    } catch (error) {
        handleNexusError('metrics/summary', error, res, url);
    }
});

export default router;
