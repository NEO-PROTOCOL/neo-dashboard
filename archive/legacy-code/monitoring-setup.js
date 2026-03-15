/**
 * System Monitoring Setup
 * Inicia monitoramento de latência, erros e envia alertas via Telegram
 */

import { SimpleTelegramBot } from './server.js'; // Import existente

export function setupMonitoring(app, telegramBot) {
    // ──────────────────────────────────────────────────────────
    // Health Check Aggregator
    // ──────────────────────────────────────────────────────────

    class HealthMonitor {
        constructor() {
            this.metrics = {
                errorRate: 0,
                avgLatency: 0,
                maxLatency: 0,
                connectionErrors: 0,
                circuitBreakerState: 'CLOSED'
            };
            this.alerts = {
                highErrorRate: false,
                highLatency: false,
                circuitOpen: false
            };
        }

        async check(nexusHealth) {
            try {
                // Atualizar métricas do dashboard
                const dashboardMetrics = app.locals.metrics || {};

                this.metrics.errorRate = parseFloat(dashboardMetrics.errorRate || 0);
                this.metrics.avgLatency = parseFloat(dashboardMetrics.avgLatency || 0);
                this.metrics.maxLatency = parseFloat(dashboardMetrics.maxLatency || 0);
                this.metrics.connectionErrors = dashboardMetrics.connectionErrors || 0;
                this.metrics.circuitBreakerState = dashboardMetrics.circuitState || 'UNKNOWN';

                return {
                    dashboard: this.metrics,
                    nexus: nexusHealth,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.error('[MONITOR] Error checking health:', error);
                return null;
            }
        }

        shouldAlert() {
            const alerts = {
                highErrorRate: this.metrics.errorRate > 0.1, // > 10%
                highLatency: this.metrics.avgLatency > 2000, // > 2s
                circuitOpen: this.metrics.circuitBreakerState === 'OPEN',
                frequentErrors: this.metrics.connectionErrors > 10 // > 10 in 5min
            };

            return Object.values(alerts).some(a => a);
        }

        getAlertMessage() {
            const messages = [];

            if (this.metrics.errorRate > 0.1) {
                messages.push(
                    `⚠️ *HIGH ERROR RATE*\n` +
                    `Error Rate: ${(this.metrics.errorRate * 100).toFixed(2)}%\n` +
                    `Connection Errors: ${this.metrics.connectionErrors}`
                );
            }

            if (this.metrics.avgLatency > 2000) {
                messages.push(
                    `🐌 *HIGH LATENCY ALERT*\n` +
                    `Avg Latency: ${this.metrics.avgLatency}ms\n` +
                    `Max Latency: ${this.metrics.maxLatency}ms\n` +
                    `→ Consider: Scale flowpay-gw resources`
                );
            }

            if (this.metrics.circuitBreakerState === 'OPEN') {
                messages.push(
                    `🔴 *CIRCUIT BREAKER OPEN*\n` +
                    `Nexus service temporarily unavailable\n` +
                    `Circuit will retry in 60s`
                );
            }

            return messages.length > 0 ? messages.join('\n\n') : null;
        }
    }

    const healthMonitor = new HealthMonitor();

    // ──────────────────────────────────────────────────────────
    // Monitoring Loop
    // ──────────────────────────────────────────────────────────

    function startMonitoring() {
        // Check health every 60 seconds
        setInterval(async () => {
            try {
                const nexusHealth = await fetch(
                    `${process.env.NEXUS_API_URL || 'https://neo-nexus-production.up.railway.app'}/health`
                ).then(r => r.json()).catch(() => ({ status: 'unknown' }));

                const health = await healthMonitor.check(nexusHealth);

                // Log health status
                if (healthMonitor.metrics.errorRate > 0) {
                    console.warn(
                        `[HEALTH] Error rate: ${(healthMonitor.metrics.errorRate * 100).toFixed(2)}% | ` +
                        `Avg latency: ${healthMonitor.metrics.avgLatency}ms | ` +
                        `Circuit: ${healthMonitor.metrics.circuitBreakerState}`
                    );
                }

                // Enviar alertas
                if (healthMonitor.shouldAlert()) {
                    const alertMessage = healthMonitor.getAlertMessage();
                    if (alertMessage && telegramBot) {
                        console.log('[ALERT] Enviando notificação via Telegram...');
                        await telegramBot.sendMessage(
                            process.env.TELEGRAM_CHAT_ID,
                            alertMessage
                        );
                    }
                }
            } catch (error) {
                console.error('[MONITOR] Error in health check loop:', error.message);
            }
        }, 60000); // Every 60 seconds
    }

    // ──────────────────────────────────────────────────────────
    // Express Routes para Monitoramento
    // ──────────────────────────────────────────────────────────

    // GET /api/monitor/health - Status atual do sistema
    app.get('/api/monitor/health', async (req, res) => {
        res.json({
            dashboard: healthMonitor.metrics,
            circuitBreaker: app.locals.circuitBreakerMetrics || {},
            timestamp: new Date().toISOString()
        });
    });

    // GET /api/monitor/alerts - Alertas pendentes
    app.get('/api/monitor/alerts', (req, res) => {
        const alertMsg = healthMonitor.getAlertMessage();
        res.json({
            hasAlert: healthMonitor.shouldAlert(),
            message: alertMsg,
            metrics: healthMonitor.metrics,
            timestamp: new Date().toISOString()
        });
    });

    // GET /api/monitor/metrics - Métricas detalhadas
    app.get('/api/monitor/metrics', (req, res) => {
        res.json({
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            },
            dashboard: healthMonitor.metrics,
            circuitBreaker: app.locals.circuitBreakerMetrics || {},
            timestamp: new Date().toISOString()
        });
    });

    // POST /api/monitor/test-alert - Teste de alerta (para debug)
    app.post('/api/monitor/test-alert', async (req, res) => {
        if (telegramBot) {
            await telegramBot.sendMessage(
                process.env.TELEGRAM_CHAT_ID,
                '🧪 *TEST ALERT*\n' +
                'Este é um teste de alerta do dashboard.\n' +
                `Timestamp: ${new Date().toISOString()}`
            );
            res.json({ success: true, message: 'Test alert sent' });
        } else {
            res.status(400).json({ error: 'Telegram bot not configured' });
        }
    });

    // Iniciar monitoramento
    startMonitoring();
    console.log('[MONITOR] System monitoring started - Checks every 60 seconds');

    return {
        healthMonitor,
        getHealth: () => healthMonitor.metrics
    };
}

export default setupMonitoring;
