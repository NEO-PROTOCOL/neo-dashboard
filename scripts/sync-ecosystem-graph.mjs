/**
 * Builds ecosystem-graph.json from the same ecosystem source as neobot-orchestrator
 * (local path, then Nexus URL). Node/anchor logic lives in
 * ./lib/ecosystem-graph-from-source.mjs so validate-ecosystem-graph stays aligned.
 */
import fs from "node:fs";
import path from "node:path";
import {
  loadEcosystemSourceArray,
  buildNodesWithAnchors,
  clusterAnchorId,
  isAnchorNode,
} from "./lib/ecosystem-graph-from-source.mjs";

const repoRoot = process.cwd();
// Served as a static fallback via Express (public/) — root location was never reachable
const targetPath = path.resolve(repoRoot, "public", "ecosystem-graph.json");

const sourceNodes = await loadEcosystemSourceArray(repoRoot);

if (!sourceNodes?.length) {
  if (fs.existsSync(targetPath)) {
    console.warn("[sync] No source found. Keeping existing ecosystem-graph.json (stale).");
    process.exit(0);
  }
  console.error("[sync] No ecosystem source available and no fallback file exists.");
  process.exit(1);
}

const { nodes, byGroup } = buildNodesWithAnchors(sourceNodes);
const nodeIdSet = new Set(nodes.map((n) => n.id));
const links = [];
const linkKeySet = new Set();

function addLink(links, keySet, source, target, label) {
  if (!source || !target || source === target) return;
  const key = `${source}->${target}:${label}`;
  if (keySet.has(key)) return;
  keySet.add(key);
  links.push({ source, target, label });
}

for (const [, groupNodes] of byGroup.entries()) {
  if (groupNodes.length <= 1) continue;
  const hub = groupNodes.reduce((best, cur) => (cur.val > best.val ? cur : best), groupNodes[0]);
  const anchorId = clusterAnchorId(hub.group);
  for (const node of groupNodes) {
    if (node.id === hub.id) continue;
    addLink(links, linkKeySet, node.id, hub.id, "group");
    const groupLink = links[links.length - 1];
    if (groupLink) {
      groupLink.kind = "group";
      groupLink.distance = 30;
      groupLink.strength = 0.95;
    }
  }
  addLink(links, linkKeySet, anchorId, hub.id, "anchor");
  const anchorLink = links[links.length - 1];
  if (anchorLink) {
    anchorLink.kind = "anchor";
    anchorLink.hidden = true;
    anchorLink.distance = 90;
    anchorLink.strength = 1.65;
  }
}

const nexusNode = nodes.find((n) => n.id === "neo-nexus") || nodes.find((n) => n.id.includes("nexus"));
const nexusId = nexusNode?.id;
if (nexusId) {
  for (const node of nodes) {
    if (node.id === nexusId) continue;
    if (isAnchorNode(node)) continue;
    if (node.nexusConnection === "not_required") continue;
    addLink(
      links,
      linkKeySet,
      node.id,
      nexusId,
      node.nexusConnection === "linked" ? "nexus" : "missing-nexus",
    );
    const nexusLink = links[links.length - 1];
    if (nexusLink) {
      nexusLink.kind = node.nexusConnection === "linked" ? "nexus" : "missing-nexus";
      nexusLink.distance = node.nexusConnection === "linked" ? 78 : 118;
      nexusLink.strength = node.nexusConnection === "linked" ? 0.18 : 0.12;
    }
  }
}

const macroLinks = [
  ["neobot-orchestrator", "mio-system", "core-identity"],
  ["neobot-orchestrator", "smart-factory", "orchestration"],
  ["neobot-orchestrator", "flowpay", "payments"],
  ["neobot-orchestrator", "pro-ia", "coordination"],
  ["neobot-orchestrator", "fluxx-app", "governance"],
  ["flowpay", "smart-factory", "audit-security"],
  ["smart-core", "smart-factory", "internal"],
  ["smart-cli", "smart-factory", "internal"],
  ["smart-ui", "smart-factory", "internal"],
  ["smart-ui-landing", "smart-ui", "drives-to"],
  ["smart-ui-mobile", "smart-ui", "interacts"],
  ["fluxx-app", "fluxx-contracts", "contract"],
  ["wod-x-pro", "smart-factory", "uses"],
  ["neo-flowoff-landing", "pro-ia", "leads"],
  ["ceo-escalavel-miniapp", "pro-ia", "connected-to"],
];

for (const [source, target, label] of macroLinks) {
  if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) continue;
  addLink(links, linkKeySet, source, target, label);
}

const output = { nodes, links };
fs.writeFileSync(targetPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(`synced ecosystem-graph.json with ${nodes.length} nodes and ${links.length} links`);
