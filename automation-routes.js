import express from 'express';

const router = express.Router();

/**
 * MOCKED AUTOMATION ROUTES for Standalone Dashboard
 * In production, these would connect to the NΞØ Agent via RPC/API
 */

router.get('/tasks', async (req, res) => {
    res.json({
        success: true,
        tasks: [],
        message: 'Connected to NΞØ Agent (Mock)',
        stats: { totalTasks: 0, balance: 0 }
    });
});

router.post('/tasks/:taskId/execute', async (req, res) => {
    res.json({
        success: true,
        message: `Task ${req.params.taskId} triggered (Agent notified)`
    });
});

router.post('/tasks/:taskId/toggle', async (req, res) => {
    res.json({
        success: true,
        message: `Task ${req.params.taskId} state changed`
    });
});

router.get('/stats', async (req, res) => {
    res.json({
        success: true,
        stats: { uptime: process.uptime(), agent: 'Online' }
    });
});

router.post('/report/generate', async (req, res) => {
    res.json({
        success: true,
        report: "Relatório gerado via RPC no Agente.",
        filepath: "/reports/mock.md"
    });
});

router.get('/report/data', async (req, res) => {
    res.json({
        success: true,
        data: { summary: "Dados vindos do Agente Interplanetário" }
    });
});

export default router;
