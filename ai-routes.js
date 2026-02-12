import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import { getClaudeService } from './src/ai/claude-service.ts';

// Environment variable loading with multi-env fallback support
dotenv.config();
if (fs.existsSync('neo-config.env')) {
    dotenv.config({ path: 'neo-config.env', override: true });
} else if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local', override: true });
}

// Helper to get system context from server logs (needs to access global captured logs)
// We'll pass a function that fetches logs from the global scope if possible,
// or simpler: just fetch logs via internal request if needed, but here we can't easily access server.js variables.
// Workaround: We will simple expose a "setLogFunction" or cleaner: modify server.js to pass context.
// For now, let's just send a generic context.

const router = express.Router();

export function setupAIRoutes(app) {
    // Basic context fetcher (mock for now because of module isolation)
    // In a real app, we'd inject this dependency.
    const contextFetcher = async () => {
        return `
STATUS DO SISTEMA:
- IPFS: Online (Mock)
- Uptime: ${process.uptime().toFixed(0)}s
- Active Skills: ${global.skillsCount || 'Unknown'}
- Timestamp: ${new Date().toISOString()}
        `.trim();
    };

    const claude = getClaudeService();

    if (!claude) {
        console.warn('⚠️  AI Service disabled: Initialization failed.');
        router.use((req, res) => res.status(503).json({ error: 'AI Service Unavailable' }));
        app.use('/api/ai', router);
        return;
    }

    // Chat Endpoint (Admin Console)
    // Mounted at /api/ai/chat
    router.post('/chat', async (req, res) => {
        try {
            const { message, userId = 'admin' } = req.body;

            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }

            const startTime = Date.now();

            // Use o novo modo Admin com Tools
            const responseText = await claude.chatWithAdminTools(
                userId,
                message,
                contextFetcher
            );

            const responseTime = Date.now() - startTime;

            res.json({
                message: responseText,
                responseTime,
                usage: { total_tokens: 0 } // Mock usage for now
            });
        } catch (error) {
            console.error('AI Chat Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Analyze image endpoint (with cache)
    router.post('/analyze-image', async (req, res) => {
        try {
            const { image, question } = req.body;

            if (!image) {
                return res.status(400).json({ error: 'Image is required' });
            }

            const startTime = Date.now();
            const analysis = await claude.analyzeImage(image, question, { cache: true });
            const responseTime = Date.now() - startTime;

            res.json({
                analysis,
                responseTime
            });

        } catch (error) {
            console.error('Image analysis error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Create plan endpoint
    router.post('/plan', async (req, res) => {
        try {
            const { task } = req.body;

            if (!task) {
                return res.status(400).json({ error: 'Task is required' });
            }

            const steps = await claude.createPlan(task);
            res.json({ steps });

        } catch (error) {
            console.error('Plan creation error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get AI stats (with cache info!)
    router.get('/stats', (req, res) => {
        res.json(claude.getStats());
    });

    // Get cache stats
    router.get('/cache-stats', (req, res) => {
        res.json(claude.getCacheStats());
    });

    // Clear context
    router.post('/clear-context', (req, res) => {
        const { userId } = req.body;
        claude.clearContext(userId || 'default');
        res.json({ success: true });
    });

    // Clear cache
    router.post('/clear-cache', (req, res) => {
        claude.clearCache();
        res.json({ success: true, message: 'Cache cleared' });
    });

    // Bug Analyzer endpoints
    router.post('/analyze-bug', async (req, res) => {
        try {
            const { error, code } = req.body;

            if (!error) {
                return res.status(400).json({ error: 'Error message is required' });
            }

            let prompt = `Você é um especialista em debugging. Analise este erro e forneça uma análise completa:

## 🐛 Erro Reportado:
${error}
`;

            if (code) {
                prompt += `
## 💻 Contexto do Código:
\`\`\`
${code}
\`\`\`
`;
            }

            prompt += `
Por favor, forneça:

### 1. 🔍 Causa Provável
Explique qual é a causa mais provável deste erro.

### 2. 🔄 Como Reproduzir
Descreva os passos para reproduzir o erro.

### 3. ✅ Solução Passo-a-Passo
Forneça instruções claras para corrigir o problema.

### 4. 💡 Código Corrigido
Se aplicável, mostre o código corrigido.

### 5. 🛡️ Prevenção Futura
Dê dicas para evitar este tipo de erro no futuro.

Seja específico, claro e forneça exemplos práticos.
`;

            const startTime = Date.now();
            const analysis = await claude.chatWithContext('bug-analyzer', prompt);
            const responseTime = Date.now() - startTime;

            res.json({
                message: analysis,
                responseTime
            });

        } catch (error) {
            console.error('Bug analysis error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Suggest fix endpoint
    router.post('/suggest-fix', async (req, res) => {
        try {
            const { code, issue } = req.body;

            if (!code || !issue) {
                return res.status(400).json({ error: 'Code and issue are required' });
            }

            const prompt = `Analise este código e sugira uma correção para o seguinte problema:

**Problema:** ${issue}

**Código:**
\`\`\`
${code}
\`\`\`

Forneça:
1. O que está errado
2. Código corrigido
3. Explicação da correção
`;

            const startTime = Date.now();
            const fix = await claude.chatWithContext('bug-fixer', prompt);
            const responseTime = Date.now() - startTime;

            res.json({
                message: fix,
                responseTime
            });

        } catch (error) {
            console.error('Fix suggestion error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Analyze stack trace endpoint
    app.post('/api/ai/analyze-stack', async (req, res) => {
        try {
            const { stackTrace } = req.body;

            if (!stackTrace) {
                return res.status(400).json({ error: 'Stack trace is required' });
            }

            const prompt = `Analise este stack trace e identifique:

1. Onde o erro ocorreu (arquivo e linha)
2. Qual é o erro
3. Possíveis causas
4. Como corrigir

**Stack Trace:**
\`\`\`
${stackTrace}
\`\`\`
`;

            const startTime = Date.now();
            const analysis = await claude.chatWithContext('stack-analyzer', prompt);
            const responseTime = Date.now() - startTime;

            res.json({
                message: analysis,
                responseTime
            });

        } catch (error) {
            console.error('Stack trace analysis error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
