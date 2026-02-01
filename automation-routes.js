import express from 'express';
import { getAutomationManager } from '../dist/automations/index.js';
import { getReportService } from '../dist/automations/intelligent-report-service.js';

const router = express.Router();

/**
 * GET /api/automations/tasks
 * Listar todas as tarefas agendadas
 */
router.get('/tasks', async (req, res) => {
    try {
        const manager = getAutomationManager();
        
        if (!manager) {
            return res.status(503).json({
                error: 'Automation manager not initialized'
            });
        }

        const tasks = manager.listTasks();
        
        res.json({
            success: true,
            tasks,
            stats: manager.getStats()
        });
    } catch (error) {
        console.error('Error listing tasks:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/automations/tasks/:taskId/execute
 * Executar tarefa manualmente
 */
router.post('/tasks/:taskId/execute', async (req, res) => {
    try {
        const { taskId } = req.params;
        const manager = getAutomationManager();
        
        if (!manager) {
            return res.status(503).json({
                error: 'Automation manager not initialized'
            });
        }

        await manager.executeTask(taskId);
        
        res.json({
            success: true,
            message: `Task ${taskId} executed successfully`
        });
    } catch (error) {
        console.error(`Error executing task ${req.params.taskId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/automations/tasks/:taskId/toggle
 * Habilitar/desabilitar tarefa
 */
router.post('/tasks/:taskId/toggle', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { enabled } = req.body;
        const manager = getAutomationManager();
        
        if (!manager) {
            return res.status(503).json({
                error: 'Automation manager not initialized'
            });
        }

        manager.toggleTask(taskId, enabled);
        
        res.json({
            success: true,
            message: `Task ${taskId} ${enabled ? 'enabled' : 'disabled'}`
        });
    } catch (error) {
        console.error(`Error toggling task ${req.params.taskId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/automations/stats
 * Obter estatísticas das automações
 */
router.get('/stats', async (req, res) => {
    try {
        const manager = getAutomationManager();
        
        if (!manager) {
            return res.status(503).json({
                error: 'Automation manager not initialized'
            });
        }

        const stats = manager.getStats();
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error getting automation stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/automations/report/generate
 * Gerar relatório inteligente sob demanda
 */
router.post('/report/generate', async (req, res) => {
    try {
        const reportService = getReportService();
        
        const report = await reportService.generateIntelligentReport();
        const filepath = await reportService.saveReport(report);
        
        res.json({
            success: true,
            report,
            filepath
        });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/automations/report/data
 * Obter dados do relatório
 */
router.get('/report/data', async (req, res) => {
    try {
        const reportService = getReportService();
        const data = await reportService.generateReportData();
        
        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error getting report data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
