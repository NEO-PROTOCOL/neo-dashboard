import { getReportService } from '../dist/automations/intelligent-report-service.js';
import { setupIntelligentReport } from '../dist/automations/intelligent-daily-report.js';

export function setupReportRoutes(app) {
    const reportService = getReportService();

    // Get current report data
    app.get('/api/reports/data', async (req, res) => {
        try {
            const data = await reportService.generateReportData();
            res.json(data);
        } catch (error) {
            console.error('Error getting report data:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Generate and get full intelligent report (AI)
    app.post('/api/reports/generate', async (req, res) => {
        try {
            const result = await setupIntelligentReport();
            res.json(result);
        } catch (error) {
            console.error('Error generating intelligent report:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get list of saved reports
    app.get('/api/reports/list', async (req, res) => {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const reportsDir = path.join(process.cwd(), 'reports');
            
            try {
                const files = await fs.readdir(reportsDir);
                const reports = files
                    .filter(f => f.endsWith('.md'))
                    .map(f => ({
                        filename: f,
                        date: f.replace('report-', '').replace('.md', ''),
                        url: `/api/reports/view/${f}`
                    }))
                    .sort((a, b) => b.date.localeCompare(a.date));
                
                res.json(reports);
            } catch {
                res.json([]);
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // View specific report
    app.get('/api/reports/view/:filename', async (req, res) => {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const { filename } = req.params;
            const filepath = path.join(process.cwd(), 'reports', filename);
            
            const content = await fs.readFile(filepath, 'utf-8');
            res.send(content);
        } catch (error) {
            res.status(404).json({ error: 'Report not found' });
        }
    });
}
