
export function setupReportRoutes(app) {
    // MOCKED REPORT ROUTES for Standalone Dashboard

    // Get current report data
    app.get('/api/reports/data', async (req, res) => {
        res.json({
            summary: "Dados de performance do Agente NΞØ",
            metrics: { uptime: "99.9%", load: "low" }
        });
    });

    // Generate and get full intelligent report (AI)
    app.post('/api/reports/generate', async (req, res) => {
        res.json({
            success: true,
            message: "Geração de relatório solicitada ao Agente."
        });
    });

    // Get list of saved reports
    app.get('/api/reports/list', async (req, res) => {
        res.json([
            { filename: "report-demo.md", date: "2026-02-01", url: "#" }
        ]);
    });

    // View specific report
    app.get('/api/reports/view/:filename', async (req, res) => {
        res.send("# NΞØ Report\nDashboard em modo standalone.");
    });
}
