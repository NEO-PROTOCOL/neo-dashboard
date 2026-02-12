import fs from 'fs';
import { exec, spawn } from 'child_process';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import automationRoutes from './automation-routes.js';
import neoRoutes from './neo-routes.js';
import nexusRoutes from './nexus-routes.js';
import aiRoutes from './ai-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function manualLoadEnv(path) {
    try {
        if (!fs.existsSync(path)) return;
        const content = fs.readFileSync(path, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const index = trimmed.indexOf('=');
            if (index !== -1) {
                const key = trimmed.substring(0, index).trim();
                const val = trimmed.substring(index + 1).trim();
                process.env[key] = val;
            }
        });
        console.log(`[SYS] Manually loaded env from ${path}`);
    } catch (e) {
        console.error(`[SYS] Failed to manually load env from ${path}:`, e.message);
    }
}

// Load environment variables
dotenv.config();
manualLoadEnv(path.join(__dirname, 'neo-config.env'));
manualLoadEnv(path.join(__dirname, '.env.local'));

// JSON Settings Fallback (Workaround for EPERM on .env files)
try {
    const jsonSettingsPath = path.join(__dirname, 'app-settings.json');
    if (fs.existsSync(jsonSettingsPath)) {
        const settings = JSON.parse(fs.readFileSync(jsonSettingsPath, 'utf8'));
        Object.entries(settings).forEach(([key, val]) => {
            process.env[key] = String(val);
        });
        console.log(`[SYS] Loaded settings from ${jsonSettingsPath}`);
    }
} catch (e) {
    console.error(`[SYS] Failed to load app-settings.json:`, e.message);
}

console.log('[SYS] Bootstrap sequence complete.');

if (!process.env.NEXUS_API_URL || process.env.NEXUS_API_URL.includes('neoprotocol.space')) {
    process.env.NEXUS_API_URL = 'https://neo-nexus-production.up.railway.app';
}

const execAsync = promisify(exec);

// ------------------------------------------------------------------
// Log Capture System (In-Memory Ring Buffer)
// ------------------------------------------------------------------
const MAX_LOGS = 100;
const serverLogs = [];

function captureLog(type, args) {
    const timestamp = new Date().toISOString();
    const rawMessage = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
        if (typeof arg === 'object' && arg !== null) {
            try { return JSON.stringify(arg); } catch (e) { return '[Circular or Unstringifiable Object]'; }
        }
        return String(arg);
    }).join(' ');

    // Filter repetitive or noisy logs from the dashboard stream
    if (rawMessage.includes('Attempting Nexus fetch')) return;
    if (rawMessage.includes('Nexus fetch error')) type = 'warn'; // Downgrade expected minor errors

    // Auto-tagging for cleaner UI
    let message = rawMessage;
    if (!message.startsWith('[')) {
        if (message.toLowerCase().includes('database')) message = `[DB] ${message}`;
        else if (message.toLowerCase().includes('telegram')) message = `[TG] ${message}`;
        else if (message.toLowerCase().includes('api')) message = `[API] ${message}`;
        else if (message.toLowerCase().includes('nexus')) message = `[NEXUS] ${message}`;
        else message = `[SYS] ${message}`;
    }

    serverLogs.unshift({ timestamp, type, message });
    if (serverLogs.length > MAX_LOGS) serverLogs.pop();

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
            console.warn('⧖ Telegram Token missing. Message skipped:', message);
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
                console.warn(`Telegram API warning: ${data.description}`);
            }
            return data.result;
        } catch (error) {
            console.error('✗ Error sending Telegram message:', error);
        }
    }
}

const telegramBot = new SimpleTelegramBot(
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_CHAT_ID
);

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
    const providedPassword = req.headers['x-gateway-password'] || req.query.password;

    if (GATEWAY_PASSWORD && providedPassword === GATEWAY_PASSWORD) {
        return next();
    }

    console.warn(`[SECURITY] Unauthorized access attempt from ${req.ip}`);
    res.status(401).json({ error: 'UNAUTHORIZED_ACCESS', message: 'Valid x-gateway-password header required' });
};

// Apply auth to API routes
app.use('/api', authMiddleware);

// Mount Routes
app.use('/api/automations', automationRoutes);
app.use('/api/neo', neoRoutes);
app.use('/api/nexus', nexusRoutes);
app.use('/api/ai', aiRoutes);

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
        nexus_url: (process.env.NEXUS_API_URL || 'FALLBACK').replace(/(:\/\/).+?(\/|$)/, '$1***$2'),
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

    try {
        const scriptPath = path.join(__dirname, '../skills/telegram/scripts/telegram.ts');
        const child = spawn('pnpm', ['tsx', scriptPath, '--to', to, '--message', message], {
            cwd: path.join(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe']
        });
        console.log(`⟠ Message sent process spawned for ${to}`);
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

app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'mobile.html'));
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
╔═══════════════════════════════════════════════════════
║                                                       
║   Ξ  NΞØBOT Dashboard//API                           
║                                                       
║   Status: ✓ ONLINE                                   
║   Port: ${PORT}                                       
║   URL: ${publicUrl}                                   
║                                                       
║   Dashboard: ${publicUrl}                             
║   NEO API: ${publicUrl}/api/neo                       
║                                                       
╚═══════════════════════════════════════════════════════
    `);
});

export default app;
