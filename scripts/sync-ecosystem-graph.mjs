import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const targetPath = path.resolve(repoRoot, 'ecosystem-graph.json');

const sourceCandidates = [
  process.env.ECOSYSTEM_SOURCE_PATH,
  path.resolve(repoRoot, '../neobot/config/ecosystem.json'),
  path.resolve(repoRoot, 'neobot-source/config/ecosystem.json'),
].filter(Boolean);

const sourcePath = sourceCandidates.find((candidate) => fs.existsSync(candidate));

if (!sourcePath) {
  throw new Error(
    `source ecosystem not found. tried: ${sourceCandidates.join(', ')}`,
  );
}

function normalizeGroup(node) {
  const org = String(node?.org || '').toLowerCase();
  const id = String(node?.id || '').toLowerCase();
  const name = String(node?.name || '').toLowerCase();
  const mix = `${id} ${name} ${org}`;

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
    return 'FlowOFF Agency';
  }
  if (org.includes('neo protocol') || mix.includes('neo')) return 'NEO Protocol';
  return node?.org || 'DApps & Tools';
}

function computeNodeVal(node, group) {
  const role = String(node?.role || '').toLowerCase();
  const id = String(node?.id || '').toLowerCase();

  if (role.includes('orchestrator') || role.includes('event hub') || role.includes('sovereign')) return 12;
  if (id.includes('nexus') || id.includes('architect')) return 11;
  if (role.includes('protocol') || role.includes('contract')) return 9;
  if (group === 'FlowPay' || group === 'Neo Smart Factory') return 8;
  if (group === 'Fluxx DAO') return 7;
  if (group === 'WOD Game') return 6;
  if (group === 'FlowOFF Agency') return 5;
  return 6;
}

function hasNexusIntegration(node) {
  return Boolean(node?.webhookUrl || node?.webhookRoutes || node?.nexusEvents);
}

function resolveProductionUrl(node) {
  const candidates = [
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

const sourceRaw = fs.readFileSync(sourcePath, 'utf8');
const sourceNodes = JSON.parse(sourceRaw);

if (!Array.isArray(sourceNodes) || sourceNodes.length === 0) {
  throw new Error('source ecosystem is empty');
}

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
    nexusConnection: hasNexusIntegration(rawNode) ? 'linked' : 'unlinked',
    val: computeNodeVal(rawNode, group),
  };

  // preserve URL data so the dashboard can probe nodes without neobot
  if (url) entry.url = url;
  if (rawNode?.hosting) entry.hosting = rawNode.hosting;
  if (rawNode?.webhookUrl) entry.webhookUrl = rawNode.webhookUrl;
  if (rawNode?.webhookRoutes) entry.webhookRoutes = rawNode.webhookRoutes;

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
    addLink(links, linkKeySet, node.id, nexusId, node.nexusConnection === 'linked' ? 'nexus' : 'missing-nexus');
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
