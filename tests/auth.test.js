/**
 * Tests for the auth middleware and security controls.
 * Uses Node.js built-in test runner (node:test).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// Minimal Express app that mirrors the auth setup in server.js
import express from 'express';
import rateLimit from 'express-rate-limit';

const GATEWAY_PASSWORD = 'test-secret';

function buildApp() {
    const app = express();
    app.use(express.json());

    const isRailwayInternalIp = (ip) => {
        const stripped = (ip || '').replace('::ffff:', '');
        const parts = stripped.split('.').map(Number);
        return parts.length === 4 && parts[0] === 100 && parts[1] >= 64 && parts[1] < 128;
    };

    const apiRateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => isRailwayInternalIp(req.ip),
        message: { error: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded.' },
    });
    app.use('/api', apiRateLimiter);

    const authMiddleware = (req, res, next) => {
        const providedPassword = req.headers['x-gateway-password'];
        if (GATEWAY_PASSWORD && providedPassword === GATEWAY_PASSWORD) return next();
        res.status(401).json({ error: 'UNAUTHORIZED_ACCESS' });
    };
    app.use('/api', authMiddleware);

    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/test', (_req, res) => res.json({ success: true }));
    app.post('/api/logs', (req, res) => {
        const { type, message } = req.body;
        const VALID_LOG_TYPES = new Set(['info', 'warn', 'error', 'debug']);
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'invalid message' });
        }
        const sanitizedType = VALID_LOG_TYPES.has(type) ? type : 'info';
        res.json({ success: true, sanitizedType });
    });

    return app;
}

async function request(server, method, path, headers = {}, body = null) {
    const { address, port } = server.address();
    const host = address === '::' ? '127.0.0.1' : address;

    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: host,
            port,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...headers,
            },
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, headers: res.headers, body: data });
                }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

describe('Auth middleware', () => {
    let server;

    before(async () => {
        const app = buildApp();
        server = await new Promise((resolve) => {
            const s = app.listen(0, '127.0.0.1', () => resolve(s));
        });
    });

    after(() => server.close());

    it('rejects requests to /api/* without the x-gateway-password header', async () => {
        const res = await request(server, 'GET', '/api/test');
        assert.equal(res.status, 401);
        assert.equal(res.body.error, 'UNAUTHORIZED_ACCESS');
    });

    it('rejects requests with wrong password', async () => {
        const res = await request(server, 'GET', '/api/test', { 'x-gateway-password': 'wrong' });
        assert.equal(res.status, 401);
    });

    it('accepts requests with correct x-gateway-password header', async () => {
        const res = await request(server, 'GET', '/api/test', { 'x-gateway-password': GATEWAY_PASSWORD });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
    });

    it('does NOT accept password via query parameter', async () => {
        const res = await request(server, 'GET', `/api/test?password=${GATEWAY_PASSWORD}`);
        assert.equal(res.status, 401);
    });

    it('allows /health without authentication', async () => {
        const res = await request(server, 'GET', '/health');
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'ok');
    });
});

describe('POST /api/logs input validation', () => {
    let server;

    before(async () => {
        const app = buildApp();
        server = await new Promise((resolve) => {
            const s = app.listen(0, '127.0.0.1', () => resolve(s));
        });
    });

    after(() => server.close());

    const AUTH = { 'x-gateway-password': GATEWAY_PASSWORD };

    it('rejects a missing message field', async () => {
        const res = await request(server, 'POST', '/api/logs', AUTH, { type: 'info' });
        assert.equal(res.status, 400);
    });

    it('rejects a non-string message field', async () => {
        const res = await request(server, 'POST', '/api/logs', AUTH, { message: 123, type: 'info' });
        assert.equal(res.status, 400);
    });

    it('accepts a valid log entry', async () => {
        const res = await request(server, 'POST', '/api/logs', AUTH, { message: 'hello', type: 'info' });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.sanitizedType, 'info');
    });

    it('sanitizes an unknown log type to info', async () => {
        const res = await request(server, 'POST', '/api/logs', AUTH, { message: 'hello', type: 'DANGER' });
        assert.equal(res.status, 200);
        assert.equal(res.body.sanitizedType, 'info');
    });
});
