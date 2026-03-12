# Technical Setup - NEØ Dashboard

## Ambientes e Domínio

- Produção: `https://dashboard.neoprotocol.space`
- Origem atual (Railway): `https://neo-dashboard-production-2e56.up.railway.app`
- Runtime: Node.js + Express (sem etapa de build de frontend)

## Variáveis de Ambiente

Base (`.env.example`):

- `GATEWAY_PASSWORD`: Obrigatória em produção. Protege rotas `/api/*`.
- `PORT`: Default `3000`.
- `NEXUS_API_URL`: Opcional, fallback interno configurado no server.
- `NEXUS_ECOSYSTEM_URL`: Opcional.
- `PUBLIC_URL`: Opcional.
- `ANTHROPIC_API_KEY`: Chat/admin IA.
- `TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID`: Opcionais para alertas.

## Executar Localmente

```bash
npm install
npm start # ou npm run dev
```

Acesso local: `http://localhost:3000`

## Arquitetura

### Backend (Node.js/Express)
- `server.js`: Servidor principal e roteamento.
- `neo-routes.js`: Gerenciamento do ecossistema e telemetria.
- `nexus-routes-v2.js`: Integração com Nexus Event Hub.
- `ai-routes.js`: Interface administrativa assistida.

### Frontend (Vanilla HTML/JS)
- `index.html`: Painel operacional.
- `ecosystem-3d.html`: Visualização em tempo real do grafo.
- `stack-analyzer.html`: Dashboard de readiness v3.1.

## Stack Analyzer (v3.1)

Analise automatizada de produção-readiness.
- **Analyzer Source:** `stack_analyzer.py` (Localizado em `NEO-PROTOCOL/neobot-orchestrator/config/stack_analyzer.py`)
- **CI/CD:** O workflow `stack-analyze.yml` roda em push para `main` e via dispatch.
- **Execução local:** `python scripts/stack_analyzer.py ecosystem.json stack-report.json`

## Governança e CI/CD

- **CI Principal:** `.github/workflows/ci.yml` (Syntax and Guardrails).
- **Branch Protection:** `main` exige pull request e 1 aprovação (Code Owner).
- **Secrets:** Requer `NEO_GITHUB_TOKEN` (PAT com escopo `repo`) para acesso a repositórios privados da organização durante o CI.
