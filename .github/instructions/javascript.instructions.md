---
applyTo: "**/*.js"
---

# JavaScript Conventions — neo-dashboard

## ESM Modules
- Use `import`/`export` — NEVER `require()`/`module.exports`
- File extensions required in imports: `import { foo } from './bar.js'`

## Express Patterns
- Use Express Router for route organization
- Middleware per route file — self-contained
- Async handlers with try/catch (no express-async-errors)
- Return consistent JSON response format: `{ success, data, error }`

## Connection Manager
- Import from `lib/connection-manager.js`
- Never instantiate external service clients directly
- Connection manager handles lifecycle, pooling, and reconnection

## IPFS
- Use `kubo-rpc-client` (NOT web3.storage/Storacha)
- All IPFS operations are async — never block main thread
- Handle IPFS timeouts gracefully
