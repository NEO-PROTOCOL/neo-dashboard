import express from 'express';

const router = express.Router();

// Proxy for Nexus Retry Stats
router.get('/retry/stats', async (req, res) => {
    try {
        const nexusUrl = process.env.NEXUS_API_URL || 'https://nexus.neoprotocol.space';
        const response = await fetch(`${nexusUrl}/api/retry/stats`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching Nexus retry stats:', error);
        res.status(500).json({ success: false, error: 'Nexus service unreachable' });
    }
});

// Proxy for Nexus Health Detailed
router.get('/health', async (req, res) => {
    try {
        const nexusUrl = process.env.NEXUS_API_URL || 'https://nexus.neoprotocol.space';
        const response = await fetch(`${nexusUrl}/health/detailed`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching Nexus health:', error);
        res.status(500).json({ success: false, error: 'Nexus service unreachable' });
    }
});

// Proxy for Nexus Simple Metrics (parsing Prometheus text)
router.get('/metrics/summary', async (req, res) => {
    try {
        const nexusUrl = process.env.NEXUS_API_URL || 'https://nexus.neoprotocol.space';
        const response = await fetch(`${nexusUrl}/metrics`);
        const text = await response.text();

        // Simple extraction for dashboard consumption
        const extract = (metricName) => {
            const regex = new RegExp(`^${metricName}\\s+(\\d+(\\.\\d+)?)$`, 'm');
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
        console.error('Error fetching Nexus metrics:', error);
        res.status(500).json({ success: false, error: 'Nexus metrics unreachable' });
    }
});

export default router;
