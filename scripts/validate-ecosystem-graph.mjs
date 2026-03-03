import fs from 'node:fs';
import path from 'node:path';

const graphPath = path.resolve(process.cwd(), 'ecosystem-graph.json');
const raw = fs.readFileSync(graphPath, 'utf8');
const graph = JSON.parse(raw);

const ALLOWED_NODE_IDS = [
  'ceo-escalavel-miniapp',
  'flowpay',
  'fluxx-app',
  'fluxx-contracts',
  'fluxx-landing',
  'internal-ops',
  'mio-system',
  'neo-agent-full',
  'neo-dashboard',
  'neo-flowoff-landing',
  'neo-flowoff-pwa',
  'neo-nexus',
  'neo-protocol-hub',
  'neo-protcl',
  'neo-tunnel',
  'neobot-orchestrator',
  'pro-ia',
  'smart-cli',
  'smart-core',
  'smart-factory',
  'smart-factory-docs',
  'smart-nft',
  'smart-ui',
  'smart-ui-landing',
  'smart-ui-mobile',
  'wod-eth',
  'wod-protocol',
  'wod-x-pro',
];

const REQUIRED_CORE_IDS = [
  'neobot-orchestrator',
  'neo-nexus',
  'mio-system',
  'neo-dashboard',
  'flowpay',
  'smart-factory',
];

const LEGACY_NODE_IDS = ['neobot-architect'];

const FORBIDDEN_IDS = ['flowpay-core'];

const errors = [];

if (!Array.isArray(graph?.nodes)) {
  errors.push('graph.nodes must be an array');
}
if (!Array.isArray(graph?.links)) {
  errors.push('graph.links must be an array');
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const nodes = graph.nodes;
const links = graph.links;

const nodeIds = nodes.map((n) => String(n?.id || '').trim()).filter(Boolean);
const nodeIdSet = new Set(nodeIds);
const uniqueCount = nodeIdSet.size;

if (nodeIds.length !== uniqueCount) {
  errors.push('duplicate node ids detected in ecosystem-graph.json');
}

for (const forbidden of FORBIDDEN_IDS) {
  if (nodeIdSet.has(forbidden)) {
    errors.push(`forbidden node id present: ${forbidden}`);
  }
}

const allowedSet = new Set([...ALLOWED_NODE_IDS, ...LEGACY_NODE_IDS]);
for (const id of nodeIdSet) {
  if (!allowedSet.has(id)) {
    errors.push(`unexpected node id in static graph: ${id}`);
  }
}

for (const id of ALLOWED_NODE_IDS) {
  if (!nodeIdSet.has(id)) {
    errors.push(`missing required allowed node id in static graph: ${id}`);
  }
}

for (const coreId of REQUIRED_CORE_IDS) {
  if (coreId === 'neobot-orchestrator') {
    if (!nodeIdSet.has('neobot-orchestrator') && !nodeIdSet.has('neobot-architect')) {
      errors.push('missing core node id: neobot-orchestrator (or legacy neobot-architect)');
    }
    continue;
  }
  if (!nodeIdSet.has(coreId)) {
    errors.push(`missing core node id: ${coreId}`);
  }
}

for (const [index, link] of links.entries()) {
  const source = String(link?.source || '').trim();
  const target = String(link?.target || '').trim();
  if (!source || !target) {
    errors.push(`link[${index}] has empty source/target`);
    continue;
  }
  if (!nodeIdSet.has(source)) {
    errors.push(`link[${index}] source not found in nodes: ${source}`);
  }
  if (!nodeIdSet.has(target)) {
    errors.push(`link[${index}] target not found in nodes: ${target}`);
  }
}

if (errors.length > 0) {
  console.error('ecosystem-graph validation failed:');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log(`ecosystem-graph validation OK: ${nodeIdSet.size} nodes, ${links.length} links`);
