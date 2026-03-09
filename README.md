<!-- markdownlint-disable MD003 MD007 MD011 MD013 MD022 MD023 MD025 MD029 MD032 MD033 MD034 -->

# NEØ Dashboard

[![Dashboard CI](https://github.com/NEO-PROTOCOL/neo-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/NEO-PROTOCOL/neo-dashboard/actions/workflows/ci.yml)
![Last Commit](https://img.shields.io/github/last-commit/NEO-PROTOCOL/neo-dashboard?style=flat-square&color=2a76ff&labelColor=0d0d0d)
![License](https://img.shields.io/github/license/NEO-PROTOCOL/neo-dashboard?style=flat-square&color=2a76ff&labelColor=0d0d0d)
![Role](https://img.shields.io/badge/Role-Observability-2a76ff?style=flat-square&labelColor=0d0d0d)
![Deploy](https://img.shields.io/badge/Deploy-Railway-2a76ff?style=flat-square&logo=railway&logoColor=white&labelColor=0d0d0d)
![NEØ](https://img.shields.io/badge/NEØ-Protocol-2a76ff?style=flat-square&labelColor=0d0d0d)

Painel de comando operacional do ecossistema NEØ PROTOCOL.

Owner oficial: **NEØ MELLØ**.

Este projeto nao foi desenhado para estetica isolada. Ele existe para expor saude da malha, detectar desconexao entre nos e reduzir tempo de resposta operacional.

## Proposito

- Consolidar observabilidade da stack NEØ PROTOCOL em uma interface unica.
- Exibir estado de conectividade entre nos em tempo quase real.
- Servir como plano de comando para Nexus, automacoes, IA e operacoes.

## Ambientes e dominio

- Producao: `https://dashboard.neoprotocol.space`
- Origem atual (Railway): `https://neo-dashboard-production-2e56.up.railway.app`
- Runtime: Node.js + Express (sem etapa de build de frontend)

## Arquitetura real

### Backend

- `server.js`
  - serve arquivos estaticos
  - protege `/api/*` com `x-gateway-password`
  - monta rotas:
    - `/api/neo`
    - `/api/nexus`
    - `/api/automations`
    - `/api/ai`

- `neo-routes.js`
  - `GET /api/neo/ecosystem`: carrega `ecosystem.json` local (quando existe) ou fallback via Nexus API
    - regra de URL por no: `hosting.activeUrl` > `hosting.targetCustomDomain` > `hosting.productionUrl`
  - `GET /api/neo/ecosystem/live`: adiciona telemetria de conectividade por no
    - status por no: `online`, `degraded`, `offline`, `unknown`
    - sinal de integracao: `linked` ou `unlinked`
    - cache curto para reduzir carga de probe
  - `GET /api/neo/ecosystem/payment-routes`: schema focado apenas em rotas de pagamento (flowpay e nos financeiros)

### Frontend

- `index.html`
  - painel principal
  - polling operacional de metricas, logs e nos

- `ecosystem-3d.html`
  - visualizacao 3D/2D do grafo do ecossistema
  - consumo prioritario de `/api/neo/ecosystem/live`
  - refresh continuo a cada 8 segundos
  - HUD de saude com contadores e feed de transicoes
  - destaque visual para nos sem ligacao com Nexus (`missing-nexus`)

## Realtime do grafo

Contrato atual do `ecosystem-3d.html`:

1. Busca telemetria viva em `/api/neo/ecosystem/live`.
2. Recalcula grafo continuamente (`setInterval(refreshGraph, LIVE_REFRESH_MS)`).
3. Marca no com degradacao ou queda de conectividade.
4. Exibe alertas quando ha:
   - nos offline
   - nos sem integracao Nexus
   - mudanca de estado entre ciclos

Fallback controlado:

- 1: `/api/neo/ecosystem/live`
- 2: `/api/neo/ecosystem`
- 3: `ecosystem-graph.json`

## Seguranca

- Toda rota em `/api` exige `x-gateway-password` quando `GATEWAY_PASSWORD` esta definido.
- Em producao, iniciar sem `GATEWAY_PASSWORD` aborta o processo.

## Variaveis de ambiente

Base (`.env.example`):

- `GATEWAY_PASSWORD` (obrigatoria em producao)
- `PORT` (default `3000`)
- `NEXUS_API_URL` (opcional, fallback interno configurado no server)
- `NEXUS_ECOSYSTEM_URL` (opcional)
- `PUBLIC_URL` (opcional)
- `ANTHROPIC_API_KEY` (chat/admin IA)
- `TELEGRAM_BOT_TOKEN` (opcional)
- `TELEGRAM_CHAT_ID` (opcional)

## Executar localmente

```bash
npm install
npm run dev
```

Ou:

```bash
npm start
```

Acesso local:

- `http://localhost:3000`

## Governanca de repositorio

Ativo em `main`:

- Branch protection
- Pull request obrigatorio
- 1 aprovacao obrigatoria
- Code Owner review obrigatorio
- Status checks obrigatorios
- `force-push` bloqueado
- delete de branch protegida bloqueado

Arquivos de governanca:

- `.github/CODEOWNERS`
- `.github/workflows/ci.yml`

Check obrigatorio atual:

- `syntax-and-guards`

## Fluxo oficial de entrega

1. branch de feature
2. pull request
3. CI verde + aprovacao
4. merge em `main`
5. deploy no Railway
6. verificacao operacional em:
   - `/` (painel)
   - `/ecosystem-3d.html` (grafo vivo)

## Escopo e limite

Este repositorio representa o dashboard do ecossistema NEØ PROTOCOL.

Nao usar este projeto para mapear ou fundir a trilha externa `flowpay-core` dentro da stack NEØ. Essa fronteira e intencional.

────────────────────────────────────────

▓▓▓ NΞØ MELLØ
────────────────────────────────────────
Core Architect · NΞØ Protocol
neo@neoprotocol.space

"Code is law. Expand until
silence becomes structure."
────────────────────────────────────────
```
 █████ █         
██╔═══██╗       
██║ █ ██║  
██ █  ██║      
╚██████╔╝   
█ ╚═══╝     

```
