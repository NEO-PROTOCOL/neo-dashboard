import { exec, spawn } from 'child_process';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { setupAIRoutes } from './ai-routes.js';
import automationRoutes from './automation-routes.js';
import neoRoutes from './neo-routes.js';

dotenv.config();
// import { initializeAutomations } from '../dist/automations/index.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------------------
// Log Capture System (In-Memory Ring Buffer)
// ------------------------------------------------------------------
const MAX_LOGS = 100;
const serverLogs = [];

function captureLog(type, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    serverLogs.unshift({ timestamp, type, message });
    if (serverLogs.length > MAX_LOGS) serverLogs.pop();

    // Pass through to original stdout/stderr
    process.stdout.write(`[${type.toUpperCase()}] ${message}\n`);
}

// Override console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => captureLog('info', args);
console.error = (...args) => captureLog('error', args);
console.warn = (...args) => captureLog('warn', args);

class SimpleTelegramBot {
    constructor(token, defaultChatId) {
        this.token = token;
        this.defaultChatId = defaultChatId;
        this.apiUrl = `https://api.telegram.org/bot${token}`;
    }

    async sendMessage(chatId, message, options = {}) {
        if (!this.token) {
            console.warn('⚠️ Telegram Token missing. Message skipped:', message);
            return;
        }
        try {
            const response = await fetch(`${this.apiUrl}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId || this.defaultChatId,
                    text: message,
                    parse_mode: options.parse_mode || 'Markdown',
                    ...options
                })
            });

            const data = await response.json();
            if (!data.ok) {
                // Ignore chat not found if just testing
                // throw new Error(`Telegram API error: ${data.description}`);
                console.warn(`Telegram API warning: ${data.description}`);
            }
            return data.result;
        } catch (error) {
            console.error('❌ Error sending Telegram message:', error);
            // Don't crash server for telegram errors
        }
    }
}

const telegramBot = new SimpleTelegramBot(
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_CHAT_ID
);

// ------------------------------------------------------------------
// Automation Initialization (Moved to Agent repo)
// ------------------------------------------------------------------
/*
let automationManager = null;
try {
    if (typeof initializeAutomations !== 'undefined') {
        automationManager = initializeAutomations({
            enabledAutomations: ['intelligent-report', 'morning-briefing'],
            telegram: telegramBot
        });

        automationManager.initialize().then(() => {
            console.log('✅ Automation system initialized');
        }).catch(err => console.error('⚠️ Automations init warning:', err.message));
    }
} catch (error) {
    console.warn('⚠️ Automations module failed to load. Skipping.');
}
*/

// ------------------------------------------------------------------
// Express Setup
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Express Setup
// ------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve Static Files (Public - Authentication handled client-side)
app.use(express.static(__dirname));

// ------------------------------------------------------------------
// Security Middleware (NΞØ Auth)
// ------------------------------------------------------------------
const GATEWAY_PASSWORD = process.env.GATEWAY_PASSWORD || process.env.CLAWDBOT_GATEWAY_PASSWORD;

// Production safety: require a gateway password when running in production.
if (process.env.NODE_ENV === 'production' && !GATEWAY_PASSWORD) {
    console.error('FATAL: GATEWAY_PASSWORD must be set when running in production. Aborting startup.');
    process.exit(1);
}

const authMiddleware = (req, res, next) => {
    // If no password configured, allow local/dev convenience but log a clear warning.
    if (!GATEWAY_PASSWORD) {
        console.warn('⚠️ Warning: GATEWAY_PASSWORD not set. API auth disabled (development only).');
        return next();
    }

    const providedPassword = req.headers['x-gateway-password'] || req.query.password;

    if (providedPassword === GATEWAY_PASSWORD) {
        return next();
    }

    res.status(401).json({ error: 'UNAUTHORIZED_ACCESS', message: 'Valid x-gateway-password header required' });
};

// Apply auth to API routes
app.use('/api', authMiddleware);


// Mount Routes (These are under /api anyway usually, but we ensure middleware hits them if they are standalone)
// Note: setupAIRoutes mounts on app directly, usually at /api/ai/chat
// We need to ensure they are protected.
// If setupAIRoutes uses /api prefix, the above app.use('/api', ...) covers it IF the routes are mounted on a router that is used under /api.
// BUT setupAIRoutes likely does app.post('/api/ai/chat', ...).
// Middleware order matters!
// app.use('/api', authMiddleware) ONLY matches requests STARTING with /api and runs middleware.
// Then subsequent route handlers match.



// Mount Routes
setupAIRoutes(app);
app.use('/api/automations', automationRoutes);
app.use('/api/neo', neoRoutes);

// Storage (Legacy In-Memory)
let reminders = [];
let messages = [];
let stats = { totalReminders: 0, totalMessages: 0 };

// ------------------------------------------------------------------
// Standard API Routes
// ------------------------------------------------------------------

// Health Check (Railway/Root)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'neo-dashboard', timestamp: new Date().toISOString() });
});

// Health Check (API)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        telegram: process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'missing',
        scheduler: 'active',
        timestamp: new Date().toISOString()
    });
});

// Stats
app.get('/api/stats', (req, res) => res.json(stats));

// Logs API (Real-time Console Stream)
app.get('/api/logs', (req, res) => res.json(serverLogs));

// POST Logs (From Core)
app.post('/api/logs', (req, res) => {
    const { type, message, timestamp } = req.body;
    if (message) {
        serverLogs.unshift({
            timestamp: timestamp || new Date().toISOString(),
            type: type || 'info',
            message: `[CORE] ${message}`
        });
        if (serverLogs.length > MAX_LOGS) serverLogs.pop();
    }
    res.json({ success: true });
});

// Reminders API (Simplified)
app.get('/api/reminders', async (req, res) => {
    try {
        const { stdout } = await execAsync('atq');
        const atJobs = stdout.trim().split('\n').filter(line => line).map(line => ({
            id: line.split(/\s+/)[0],
            text: 'Agendado via at'
        }));
        res.json(atJobs);
    } catch (e) { res.json(reminders); }
});

app.post('/api/reminders', async (req, res) => {
    // Implementação simplificada para não crashar
    const { text, when } = req.body;
    if (!text || !when) return res.status(400).json({ error: 'Missing args' });

    console.log(`[Mock] Reminder created: ${text} at ${when}`);
    stats.totalReminders++;
    res.json({ success: true, mock: true });
});

// Messages API
app.get('/api/messages', (req, res) => res.json(messages.slice(-10).reverse()));

app.post('/api/messages', async (req, res) => {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'Missing args' });

    // Try to send via telegram script if possible
    try {
        const scriptPath = path.join(__dirname, '../skills/telegram/scripts/telegram.ts');
        const child = spawn('pnpm', ['tsx', scriptPath, '--to', to, '--message', message], {
            cwd: path.join(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let out = '';
        child.stdout.on('data', d => out += d);
        // Não vamos esperar o exit pra responder rápido
        console.log(`📨 Message sent process spawned for ${to}`);
    } catch (e) {
        console.error(e);
    }

    const msg = {
        id: Date.now().toString(),
        to, text: message, timestamp: new Date().toISOString(), from: 'Você', status: 'sent'
    };
    messages.push(msg);
    stats.totalMessages++;
    res.json({ success: true, message: msg });
});

// ------------------------------------------------------------------
// Frontend Route
// ------------------------------------------------------------------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ------------------------------------------------------------------
// Server Start
// ------------------------------------------------------------------
app.listen(PORT, () => {
    const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🛰️  NΞØ BOT Dashboard API                           ║
║                                                       ║
║   Status: ✅ ONLINE                                   ║
║   Port: ${PORT}                                       ║
║   URL: ${publicUrl}                       ║
║                                                       ║
║   Dashboard: ${publicUrl}                 ║
║   NEO API: ${publicUrl}/api/neo           ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});

export default app;
