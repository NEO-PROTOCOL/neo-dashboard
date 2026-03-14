/**
 * Nexus Routes v2 - Com Circuit Breaker, Retry Logic e Metrics
 * Replaces: nexus-routes.js
 */

import express from "express";
import { fetchWithRetry, CircuitBreaker } from "../lib/connection-manager.js";

const router = express.Router();

// ──────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────

const getNexusUrl = () =>
  process.env.NEXUS_API_URL || "https://neo-nexus-production.up.railway.app";

// Circuit Breaker Configuration
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
});

// Retry Configuration
const retryConfig = {
  maxRetries: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
  timeout: 10000,
  retryOn: [408, 429, 500, 502, 503, 504],
};

// ──────────────────────────────────────────────────────────────
// Metrics Collector
// ──────────────────────────────────────────────────────────────

class MetricsCollector {
  constructor() {
    this.requests = [];
    this.maxHistorySize = 1000;
  }

  record(endpoint, method, statusCode, duration, error = null) {
    this.requests.push({
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      statusCode,
      duration, // ms
      error: error ? error.message : null,
    });

    // Manter apenas últimas N requisições
    if (this.requests.length > this.maxHistorySize) {
      this.requests.shift();
    }
  }

  getStats(timeWindowMs = 300000) {
    // Default: 5 minutes
    const cutoffTime = Date.now() - timeWindowMs;
    const recentRequests = this.requests.filter(
      (req) => new Date(req.timestamp).getTime() > cutoffTime,
    );

    if (recentRequests.length === 0) {
      return { totalRequests: 0, errorRate: 0, avgLatency: 0 };
    }

    const errors = recentRequests.filter((r) => r.error).length;
    const totalLatency = recentRequests.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalRequests: recentRequests.length,
      errors,
      errorRate: (errors / recentRequests.length).toFixed(4),
      avgLatency: (totalLatency / recentRequests.length).toFixed(2),
      maxLatency: Math.max(...recentRequests.map((r) => r.duration)),
      minLatency: Math.min(...recentRequests.map((r) => r.duration)),
    };
  }

  clear() {
    this.requests = [];
  }
}

const metrics = new MetricsCollector();

// ──────────────────────────────────────────────────────────────
// Helper Function
// ──────────────────────────────────────────────────────────────

async function proxyNexusRequest(nexusPath, method = "GET", req, res) {
  const nexusUrl = getNexusUrl();
  const fullUrl = `${nexusUrl}${nexusPath}`;
  const startTime = Date.now();

  try {
    // Execute através do circuit breaker
    const response = await circuitBreaker.execute(
      () =>
        fetchWithRetry(fullUrl, {
          method,
          retryConfig,
          headers: req.headers,
        }),
      { url: fullUrl },
    );

    const duration = Date.now() - startTime;
    metrics.record(nexusPath, method, response.status, duration);

    if (!response.ok) {
      console.warn(
        `[NEXUS] ${method} ${nexusPath} - Status ${response.status} (${duration}ms)`,
      );
    } else {
      console.log(`[NEXUS] ${method} ${nexusPath} - OK (${duration}ms)`);
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    metrics.record(nexusPath, method, "ERROR", duration, error);

    console.error(
      `[NEXUS] ${method} ${nexusPath} - Error: ${error.message} (${duration}ms)`,
    );

    if (error.code === "CIRCUIT_OPEN") {
      return res.status(503).json({
        success: false,
        error: "Nexus service temporarily unavailable",
        message: "Circuit breaker is OPEN - Service is recovering",
        offline: true,
        circuitState: "OPEN",
      });
    }

    res.status(503).json({
      success: false,
      error: "Nexus service unreachable",
      offline: true,
      attemptedUrl: fullUrl,
      message: error.message,
    });
  }
}

// ──────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────

// Proxy for Nexus Retry Stats
router.get("/retry/stats", async (req, res) => {
  await proxyNexusRequest("/api/retry/stats", "GET", req, res);
});

// Proxy for Nexus Health Detailed
router.get("/health", async (req, res) => {
  await proxyNexusRequest("/health/detailed", "GET", req, res);
});

// Proxy for Nexus Metrics (parsing Prometheus text)
router.get("/metrics/summary", async (req, res) => {
  const nexusUrl = getNexusUrl();
  const fullUrl = `${nexusUrl}/metrics`;
  const startTime = Date.now();

  try {
    const response = await circuitBreaker.execute(
      () => fetchWithRetry(fullUrl, { retryConfig }),
      { url: fullUrl },
    );

    const duration = Date.now() - startTime;
    metrics.record("/metrics/summary", "GET", response.status, duration);

    const text = await response.text();

    const extract = (metricName) => {
      const regex = new RegExp(
        `^${metricName}(?:\\{[^\\}]*\\})?\\s+(\\d+(\\.\\d+)?)$`,
        "m",
      );
      const match = text.match(regex);
      return match ? parseFloat(match[1]) : 0;
    };

    res.json({
      eventsTotal: extract("nexus_events_total"),
      reactorExecutions: extract("nexus_reactor_executions_total"),
      retryQueueSize: extract("nexus_retry_queue_size"),
      deadLetterSize: extract("nexus_dead_letter_queue_size"),
      wsConnections: extract("nexus_websocket_connections"),
      _metadata: {
        fetchDuration: duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metrics.record("/metrics/summary", "GET", "ERROR", duration, error);

    console.error(`[NEXUS] Failed to fetch metrics: ${error.message}`);

    res.status(503).json({
      success: false,
      error: "Failed to fetch metrics",
      offline: true,
      message: error.message,
    });
  }
});

// ──────────────────────────────────────────────────────────────
// Monitoring Endpoints (for dashboard)
// ──────────────────────────────────────────────────────────────

// Get Circuit Breaker Status
router.get("/status", (req, res) => {
  res.json({
    circuitBreaker: circuitBreaker.getMetrics(),
    metrics: metrics.getStats(),
    timestamp: new Date().toISOString(),
  });
});

// Get Detailed Metrics (last N requests)
router.get("/metrics/detailed", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const recentRequests = metrics.requests.slice(-limit).reverse();

  res.json({
    requests: recentRequests,
    summary: metrics.getStats(),
    timestamp: new Date().toISOString(),
  });
});

// Reset Circuit Breaker (admin only - add auth in production)
router.post("/admin/reset", (req, res) => {
  circuitBreaker.reset();
  metrics.clear();
  res.json({ success: true, message: "Circuit breaker reset" });
});

export default router;
