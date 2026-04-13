/**
 * ATENÇÃO: Erro de CI relacionado ao ecosystem-graph.json
 * 
 * O workflow de CI pode apresentar o erro:
 *   "ecosystem-graph validation failed: unexpected node id in static graph: neo-mcp-server"
 *   "unexpected node id in static graph: neo-mello-eth"
 *
 * Estes nós estão presentes no arquivo gerado, mas não constam em source/config/ecosystem.json,
 * que é mantido e atualizado em outro repositório (NEO-PROTOCOL/neobot).
 * 
 * A solução definitiva deve ser alinhada e aplicada no repositório original.
 * NÃO realize ajustes locais temporários neste projeto para mascarar o erro.
 * O correto é alinhar com o mantenedor do arquivo fonte.
 *
 * Enquanto não houver ajuste externo, este erro é esperado em PRs que não alteram a estrutura do grafo.
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const targetPath = path.resolve(repoRoot, 'ecosystem-graph.json');

// ── Source resolution ───────────────────────────────────────────────────────
// Priority 1: local filesystem (dev / CI via registry checkout)
const localCandidates = [
  process.env.ECOSYSTEM_SOURCE_PATH,
  path.resolve(repoRoot, 'ecosystem.json'), // Priority: Local bundled file
  path.resolve(repoRoot, '../neobot-orchestrator/config/ecosystem.json'),
  path.resolve(repoRoot, 'neobot-source/config/ecosystem.json'),
].filter(Boolean);

const sourcePath = localCandidates.find((c) => fs.existsSync(c));

let sourceNodes = null;

if (sourcePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    sourceNodes = Array.isArray(raw) ? raw : null;
    if (sourceNodes?.length) console.log(`[sync] source: local-file (${sourcePath})`);
  } catch (e) {
    console.warn(`[sync] Failed to read ${sourcePath}:`, e.message);
  }
}

// Priority 2: URL fetch (Railway / remote deploy — no local registry available)
if (!sourceNodes?.length) {
  const url =
    process.env.ECOSYSTEM_SOURCE_URL ||
    process.env.NEXUS_ECOSYSTEM_URL ||
    'https://nexus.neoprotocol.space/api/ecosystem';

  console.log(`[sync] No local source. Fetching from: ${url}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) sourceNodes = data;
      else if (Array.isArray(data?.nodes)) sourceNodes = data.nodes;
      else if (Array.isArray(data?.ecosystem)) sourceNodes = data.ecosystem;
      if (sourceNodes?.length) console.log(`[sync] source: url (${url})`);
    } else {
      console.warn(`[sync] URL returned HTTP ${res.status}`);
    }
  } catch (e) {
    console.warn(`[sync] URL fetch failed: ${e.message}`);
  }
}

// No source found — keep existing file if available (non-blocking for server startup)
if (!sourceNodes?.length) {
  if (fs.existsSync(targetPath)) {
    console.warn('[sync] No source found. Keeping existing ecosystem-graph.json (stale).');
    process.exit(0);
  }
  console.error('[sync] No ecosystem source available and no fallback file exists.');
  process.exit(1);
}

// ── Transformation helpers ──────────────────────────────────────────────────
function normalizeGroup(node) {
  const org = String(node?.org || '').toLowerCase();
  const id = String(node?.id || '').toLowerCase();
  const name = String(node?.name || '').toLowerCase();
  const mix = `${id} ${name} ${org}`;

  if (org.includes('neo-growth-system') || mix.includes('growth system')) return 'NEO-Growth-System';
  if (org.includes('neo smart factory') || mix.includes('smart factory')) return 'Neo Smart Factory';
  if (org.includes('flowpay') || mix.includes('flowpay')) return 'FlowPay';
  if (org.includes('fluxx')) return 'Fluxx DAO';
  if (mix.includes('wod')) return 'WOD Game';
  if (
    org.includes('neo-flowoff') ||
    mix.includes('flowoff') ||
    mix.includes('pro-ia') ||
    mix.includes('ceo escal')
  ) {
    return 'NEO-FlowOFF';
  }
  if (org.includes('neo protocol') || mix.includes('neo')) return 'NEO Protocol';
  // Fallback: use the raw org field — no fake "DApps & Tools" group
  return org.includes('growth system') || mix.includes('growth system')
    ? 'NEO-Growth-System'
    : (node?.org || 'NEO Protocol');
}

function computeNodeVal(node, group) {
  const role = String(node?.role || '').toLowerCase();
  const id = String(node?.id || '').toLowerCase();

  if (role.includes('orchestrator') || role.includes('event hub') || role.includes('sovereign')) return 12;
  if (id.includes('nexus') || id.includes('architect')) return 11;
  if (role.includes('protocol') || role.includes('contract')) return 9;
  if (group === 'FlowPay' || group === 'Neo Smart Factory' || group === 'NEO-Growth-System') return 8;
  if (group === 'Fluxx DAO') return 7;
  if (group === 'WOD Game') return 6;
  if (group === 'NEO-FlowOFF') return 5;
  return 6;
}

const NEXUS_REQUIRED_HINTS = [
  'agent',
  'orchestrator',
  'event ingestor',
  'queue worker',
  'message orchestrator',
  'identity layer',
  'checkout',
  'dashboard surface',
  'payments api',
  'edge runtime',
  'api',
  'tunnel server',
  'autonomous service',
  'worker',
];

const NEXUS_OPTIONAL_HINTS = [
  'documentation',
  'landing',
  'repository',
  'contracts',
  'organization hub',
  'discovered node',
  'public acquisition surface',
  'landing page',
  'interface / pwa',
  'interface / mobile',
  'miniapp',
  'webapp',
  'dapp / game',
  'governance node',
  'tooling / cli',
  'protocol layer',
  'mcp storage runtime',
  'local / discovered',
  'private / local',
  'static',
];

function getNexusConnection(node) {
  const id = String(node?.id || '').toLowerCase();
  const name = String(node?.name || '').toLowerCase();
  const role = String(node?.role || '').toLowerCase();
  const org = String(node?.org || '').toLowerCase();
  const platform = String(node?.platform || node?.hosting?.platform || '').toLowerCase();
  const mix = `${id} ${name} ${role} ${org} ${platform}`;

  const hasWebhook = Boolean(node?.webhookUrl || node?.webhookRoutes);
  const hasNexusEvents = Array.isArray(node?.nexusEvents)
    ? node.nexusEvents.length > 0
    : Boolean(node?.nexusEvents);
  if (hasWebhook || hasNexusEvents) return 'linked';

  if (NEXUS_OPTIONAL_HINTS.some((hint) => mix.includes(hint))) {
    return 'not_required';
  }

  if (NEXUS_REQUIRED_HINTS.some((hint) => mix.includes(hint))) {
    return 'unlinked';
  }

  return 'not_required';
}

function resolveProductionUrl(node) {
  const candidates = [
    node?.hosting?.activeUrl,
    node?.hosting?.targetCustomDomain,
    node?.hosting?.productionUrl,
    node?.infrastructure?.productionUrl,
    node?.hosting?.railwayUrl,
    node?.infrastructure?.railwayUrl,
  ];
  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const t = c.trim();
    if (!t || t.includes('.railway.internal') || t.includes('localhost')) continue;
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
    return `https://${t}`;
  }
  return null;
}

function addLink(links, keySet, source, target, label) {
  if (!source || !target || source === target) return;
  const key = `${source}->${target}:${label}`;
  if (keySet.has(key)) return;
  keySet.add(key);
  links.push({ source, target, label });
}

// ── Build graph ─────────────────────────────────────────────────────────────
const dedup = new Map();
for (const rawNode of sourceNodes) {
  const id = String(rawNode?.id || '').trim();
  if (!id || dedup.has(id)) continue;

  const group = normalizeGroup(rawNode);
  const url = resolveProductionUrl(rawNode);

  const entry = {
    id,
    name: String(rawNode?.name || id),
    group,
    status: 'unknown',
    nexusConnection: getNexusConnection(rawNode),
    val: computeNodeVal(rawNode, group),
  };

  if (url) entry.url = url;
  if (rawNode?.hosting) entry.hosting = rawNode.hosting;
  if (rawNode?.webhookUrl) entry.webhookUrl = rawNode.webhookUrl;
  if (rawNode?.webhookRoutes) entry.webhookRoutes = rawNode.webhookRoutes;
  if (rawNode?.contracts) entry.contracts = rawNode.contracts;
  if (rawNode?.tokenCanonical) entry.tokenCanonical = rawNode.tokenCanonical;
  if (rawNode?.canonicalRegistry) entry.canonicalRegistry = rawNode.canonicalRegistry;

  dedup.set(id, entry);
}

const nodes = [...dedup.values()].sort((a, b) => a.id.localeCompare(b.id));
const nodeIdSet = new Set(nodes.map((n) => n.id));
const links = [];
const linkKeySet = new Set();

const byGroup = new Map();
for (const node of nodes) {
  if (!byGroup.has(node.group)) byGroup.set(node.group, []);
  byGroup.get(node.group).push(node);
}

for (const [, groupNodes] of byGroup.entries()) {
  if (groupNodes.length <= 1) continue;
  const hub = groupNodes.reduce((best, cur) => (cur.val > best.val ? cur : best), groupNodes[0]);
  for (const node of groupNodes) {
    if (node.id === hub.id) continue;
    addLink(links, linkKeySet, node.id, hub.id, 'group');
  }
}

const nexusNode = nodes.find((n) => n.id === 'neo-nexus') || nodes.find((n) => n.id.includes('nexus'));
const nexusId = nexusNode?.id;
if (nexusId) {
  for (const node of nodes) {
    if (node.id === nexusId) continue;
    if (node.nexusConnection === 'not_required') continue;
    addLink(
      links,
      linkKeySet,
      node.id,
      nexusId,
      node.nexusConnection === 'linked' ? 'nexus' : 'missing-nexus',
    );
  }
}

const macroLinks = [
  ['neobot-orchestrator', 'mio-system', 'core-identity'],
  ['neobot-orchestrator', 'smart-factory', 'orchestration'],
  ['neobot-orchestrator', 'flowpay', 'payments'],
  ['neobot-orchestrator', 'pro-ia', 'coordination'],
  ['neobot-orchestrator', 'fluxx-app', 'governance'],
  ['flowpay', 'smart-factory', 'audit-security'],
  ['smart-core', 'smart-factory', 'internal'],
  ['smart-cli', 'smart-factory', 'internal'],
  ['smart-ui', 'smart-factory', 'internal'],
  ['smart-ui-landing', 'smart-ui', 'drives-to'],
  ['smart-ui-mobile', 'smart-ui', 'interacts'],
  ['fluxx-app', 'fluxx-contracts', 'contract'],
  ['wod-x-pro', 'smart-factory', 'uses'],
  ['neo-flowoff-landing', 'pro-ia', 'leads'],
  ['ceo-escalavel-miniapp', 'pro-ia', 'connected-to'],
];

for (const [source, target, label] of macroLinks) {
  if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) continue;
  addLink(links, linkKeySet, source, target, label);
}

const output = { nodes, links };
fs.writeFileSync(targetPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(`synced ecosystem-graph.json with ${nodes.length} nodes and ${links.length} links`);
