/**
 * Tests for AI route input validation.
 * Uses Node.js built-in test runner (node:test).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

// Mirror the validation logic from ai-routes.js without hitting the real Neobot.
function buildAiApp() {
    const app = express();
    app.use(express.json({ limit: '1mb' }));

    // POST /chat — mirrors validation in ai-routes.js
    app.post('/chat', (req, res) => {
        const { message } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'message is required and must be a non-empty string' });
        }
        const sanitized = message.slice(0, 8000);
        // Simulate a successful (mocked) response
        res.json({ success: true, echo: sanitized });
    });

    // POST /analyze-bug — mirrors validation in ai-routes.js
    app.post('/analyze-bug', (req, res) => {
        const { error, code } = req.body;
        if (!error && !code) {
            return res.status(400).json({ success: false, error: 'At least one of error or code is required' });
        }
        const sanitizedError = typeof error === 'string' ? error.slice(0, 4000) : '';
        const sanitizedCode = typeof code === 'string' ? code.slice(0, 16000) : '';
        res.json({ success: true, echoError: sanitizedError, echoCode: sanitizedCode });
    });

    return app;
}

async function request(server, method, path, body = null) {
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
            },
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

describe('POST /chat validation', () => {
    let server;

    before(async () => {
        server = await new Promise((resolve) => {
            const s = buildAiApp().listen(0, '127.0.0.1', () => resolve(s));
        });
    });

    after(() => server.close());

    it('rejects empty body', async () => {
        const res = await request(server, 'POST', '/chat', {});
        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
    });

    it('rejects whitespace-only message', async () => {
        const res = await request(server, 'POST', '/chat', { message: '   ' });
        assert.equal(res.status, 400);
    });

    it('rejects non-string message', async () => {
        const res = await request(server, 'POST', '/chat', { message: 42 });
        assert.equal(res.status, 400);
    });

    it('accepts a valid message', async () => {
        const res = await request(server, 'POST', '/chat', { message: 'Hello NEO' });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.echo, 'Hello NEO');
    });

    it('truncates messages longer than 8000 characters', async () => {
        const longMsg = 'x'.repeat(9000);
        const res = await request(server, 'POST', '/chat', { message: longMsg });
        assert.equal(res.status, 200);
        assert.equal(res.body.echo.length, 8000);
    });
});

describe('POST /analyze-bug validation', () => {
    let server;

    before(async () => {
        server = await new Promise((resolve) => {
            const s = buildAiApp().listen(0, '127.0.0.1', () => resolve(s));
        });
    });

    after(() => server.close());

    it('rejects empty body', async () => {
        const res = await request(server, 'POST', '/analyze-bug', {});
        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
    });

    it('accepts when only error is provided', async () => {
        const res = await request(server, 'POST', '/analyze-bug', { error: 'NullPointerException' });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.echoError, 'NullPointerException');
        assert.equal(res.body.echoCode, '');
    });

    it('accepts when only code is provided', async () => {
        const res = await request(server, 'POST', '/analyze-bug', { code: 'const x = null; x.foo();' });
        assert.equal(res.status, 200);
        assert.equal(res.body.echoCode, 'const x = null; x.foo();');
        assert.equal(res.body.echoError, '');
    });

    it('truncates error field to 4000 chars', async () => {
        const res = await request(server, 'POST', '/analyze-bug', { error: 'e'.repeat(5000) });
        assert.equal(res.status, 200);
        assert.equal(res.body.echoError.length, 4000);
    });

    it('truncates code field to 16000 chars', async () => {
        const res = await request(server, 'POST', '/analyze-bug', { code: 'c'.repeat(20000) });
        assert.equal(res.status, 200);
        assert.equal(res.body.echoCode.length, 16000);
    });
});
