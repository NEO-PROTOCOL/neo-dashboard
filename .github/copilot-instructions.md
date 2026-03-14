# Copilot Instructions — neo-dashboard

## Project Overview
Premium dashboard for NEO BOT — Express server with API routes (AI, automation, reports, nexus), 3D ecosystem visualization, monitoring, and multi-page HTML frontend. IPFS integration for decentralized content.

## Architecture
- **Backend**: Node.js + Express (ESM modules)
- **Frontend**: Multi-page HTML/CSS/JS
- **IPFS**: kubo-rpc-client for decentralized content
- **Deploy**: Railway (`.railway-scaling.yml`)

## Critical Conventions

### Express Routes
- Routes are organized by domain: `ai-routes.js`, `automation-routes.js`, `neo-routes.js`, `report-routes.js`, `nexus-routes-v2.js`
- Each route file is self-contained with its middleware
- Use the custom connection manager — do NOT create ad-hoc connections

### IPFS Integration
- Uses `kubo-rpc-client` — not web3.storage or Storacha (different from other repos)
- IPFS operations go through the service layer
- Never block the main thread with IPFS operations

### Ecosystem Graph
- 3D visualization of the NEO ecosystem
- Graph sync scripts maintain the data
- Do NOT modify graph data manually — use the sync scripts

## What NOT To Do
- Do NOT use CommonJS (`require`) — this is ESM (`import`)
- Do NOT create new connection instances — use the connection manager
- Do NOT modify ecosystem graph data manually
- Do NOT mix frontend and backend code in the same files

## Security
- API endpoints require authentication
- Never expose internal ecosystem topology to unauthenticated users
- Rate limit all public endpoints
