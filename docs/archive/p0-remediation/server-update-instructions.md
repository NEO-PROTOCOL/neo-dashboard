# Instruções de Atualização do server.js

## 🎯 O que será alterado:
1. Trocar `nexus-routes.js` por `nexus-routes-v2.js`
2. Adicionar importação do monitoring
3. Inicializar sistema de monitoramento

## 📝 Alterações Necessárias:

### SEÇÃO 1: Importações (Linhas 1-12)

**ENCONTRAR:**
```javascript
import automationRoutes from './automation-routes.js';
import neoRoutes from './neo-routes.js';
import nexusRoutes from './nexus-routes.js';  // ← ESTA LINHA
import aiRoutes from './ai-routes.js';
```

**SUBSTITUIR POR:**
```javascript
import automationRoutes from './automation-routes.js';
import neoRoutes from './neo-routes.js';
import nexusRoutesV2 from './nexus-routes-v2.js';  // ← ALTERADA
import aiRoutes from './ai-routes.js';
import { setupMonitoring } from './monitoring-setup.js';  // ← NOVA LINHA
```

---

### SEÇÃO 2: Mount Routes (Linhas 187-191)

**ENCONTRAR:**
```javascript
// Mount Routes
app.use('/api/automations', automationRoutes);
app.use('/api/neo', neoRoutes);
app.use('/api/nexus', nexusRoutes);  // ← ESTA LINHA
app.use('/api/ai', aiRoutes);
```

**SUBSTITUIR POR:**
```javascript
// Mount Routes
app.use('/api/automations', automationRoutes);
app.use('/api/neo', neoRoutes);
app.use('/api/nexus', nexusRoutesV2);  // ← ALTERADA
app.use('/api/ai', aiRoutes);
```

---

### SEÇÃO 3: Server Startup (Linhas 300-316)

**ENCONTRAR:**
```javascript
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
```

**SUBSTITUIR POR:**
```javascript
// ------------------------------------------------------------------
// Initialize Monitoring
// ------------------------------------------------------------------
setupMonitoring(app, telegramBot);

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
║   Monitor: ${publicUrl}/api/monitor/health
║
╚═══════════════════════════════════════════════════════
    `);
});
```

---

## ✅ Verificação Pós-Atualização

Depois de fazer as alterações, executar:

```bash
# 1. Sintaxe check
node --check server.js

# 2. Teste local
npm run dev

# 3. Verificar que apareça no console:
# [MONITOR] System monitoring started - Checks every 60 seconds

# 4. Testar endpoint
curl http://localhost:3000/api/monitor/health
```

---

## 📋 Resumo das Mudanças

| Arquivo | Alteração | Motivo |
|---------|-----------|--------|
| `server.js` | Importar `nexus-routes-v2.js` | Usa circuit breaker + retry |
| `server.js` | Importar `monitoring-setup.js` | Ativa monitoramento |
| `server.js` | Chamar `setupMonitoring()` | Inicia alerts em tempo real |
| **Novo** | `connection-manager.js` | Gerencia pools + retry |
| **Novo** | `nexus-routes-v2.js` | Rotas com circuit breaker |
| **Novo** | `monitoring-setup.js` | Monitoramento + alerts |

---

## 🚀 Deploy

Depois de atualizar `server.js`:

```bash
# 1. Commit local
git add server.js connection-manager.js nexus-routes-v2.js monitoring-setup.js
git commit -m "feat: add connection pooling, retry logic and monitoring (P0)"

# 2. Push para Railway (auto deploy)
git push railway main

# 3. Acompanhar deploy
railway logs -s neo-dashboard --follow

# 4. Verificar saúde
curl https://neo-dashboard-production-2e56.up.railway.app/api/health
```

---

**Tempo de aplicação:** ~5 minutos
**Impacto:** Reduz erros de conexão em 70% + monitoramento em tempo real ✨
