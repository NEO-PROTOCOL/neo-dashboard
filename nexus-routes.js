import express from 'express';

const router = express.Router();

// Circuit breaker: after 3 failures, stop logging for 5 minutes
let failCount = 0;
let silentUntil = 0;
const FAIL_THRESHOLD = 3;
const SILENT_MS = 5 * 60 * 1000; // 5 min
const FETCH_TIMEOUT_MS = 5000;    // 5s timeout per request

function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

function handleNexusError(label, error, res) {
    const now = Date.now();
    if (now > silentUntil) {
        failCount++;
        if (failCount >= FAIL_THRESHOLD) {
            console.warn(`[NEXUS] ${label} unreachable — silencing logs for 5min (circuit open)`);
            silentUntil = now + SILENT_MS;
            failCount = 0;
        } else {
            console.warn(`[NEXUS] ${label} fetch failed (${failCount}/${FAIL_THRESHOLD}):`, error.message);
        }
    }
    res.status(503).json({ success: false, error: 'Nexus service unreachable', offline: true });
}

// Proxy for Nexus Retry Stats
router.get('/retry/stats', async (req, res) => {
    try {
        const nexusUrl = process.env.NEXUS_API_URL || 'https://nexus.neoprotocol.space';
        const response = await fetchWithTimeout(`${nexusUrl}/api/retry/stats`);
        const data = await response.json();
        failCount = 0; // reset on success
        res.json(data);
    } catch (error) {
        handleNexusError('retry/stats', error, res);
    }
});

// Proxy for Nexus Health Detailed
router.get('/health', async (req, res) => {
    try {
        const nexusUrl = process.env.NEXUS_API_URL || 'https://nexus.neoprotocol.space';
        const response = await fetchWithTimeout(`${nexusUrl}/health/detailed`);
        const data = await response.json();
        failCount = 0;
        res.json(data);
    } catch (error) {
        handleNexusError('health', error, res);
    }
});

// Proxy for Nexus Simple Metrics (parsing Prometheus text)
router.get('/metrics/summary', async (req, res) => {
    try {
        const nexusUrl = process.env.NEXUS_API_URL || 'https://nexus.neoprotocol.space';
        const response = await fetchWithTimeout(new URL('/metrics', nexusUrl).toString());
        const text = await response.text();

        failCount = 0; // reset on success

        // Improved extraction for dashboard (handles labels and exact matches)
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
        handleNexusError('metrics/summary', error, res);
    }
});

export default router;
