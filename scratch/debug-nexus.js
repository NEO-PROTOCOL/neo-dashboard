const fs = require('fs');
const path = require('path');

function hasNexusIntegration(node) {
  const nexusEventsConfigured = node != null && 'nexusEvents' in node;
  const hasEvents = Array.isArray(node?.nexusEvents)
    ? node.nexusEvents.length > 0 || nexusEventsConfigured
    : Boolean(node?.nexusEvents);
  return Boolean(node?.webhookUrl || node?.webhookRoutes || hasEvents);
}

const ecosystem = JSON.parse(fs.readFileSync('ecosystem-graph.json', 'utf8'));
const nodes = Array.isArray(ecosystem) ? ecosystem : (ecosystem.nodes || []);

let linked = 0;
let unlinked = 0;

nodes.forEach(n => {
  if (hasNexusIntegration(n)) linked++;
  else {
    unlinked++;
    console.log(`Unlinked: ${n.id}`);
  }
});

console.log(`\nSummary: Linked: ${linked}, Unlinked: ${unlinked}, Total: ${nodes.length}`);
