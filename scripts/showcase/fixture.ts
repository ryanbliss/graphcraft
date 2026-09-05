import { readFileSync } from "node:fs";
import type { ProjectGraph } from "../../src/graph/types.ts";

// A synthetic extension of Neon harbor gives the tour a real upper floor.
export function showcaseGraph(): ProjectGraph {
  const graph: ProjectGraph = JSON.parse(
    readFileSync("public/demo.graph.json", "utf8"),
  );
  for (const directory of ["observatory", "signals", "transport"])
    for (const name of [
      "Beacon",
      "Channel",
      "Decoder",
      "Emitter",
      "Gateway",
      "Monitor",
      "Relay",
      "Signal",
    ]) {
      const id = `packages/core/src/${directory}/${name}.ts`;
      graph.nodes.push({
        id,
        name: `${name}.ts`,
        packageId: "packages/core",
        directory: `packages/core/src/${directory}`,
        kind: "module",
        lines: 60,
        exports: [name],
        components: [],
        incoming: 0,
        outgoing: 1,
      });
      graph.edges.push({
        source: id,
        target: "packages/core/src/graph/Graph.ts",
        kind: "import",
        specifier: "../graph/Graph",
      });
    }
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const node of graph.nodes) {
    node.incoming = 0;
    node.outgoing = 0;
  }
  for (const edge of graph.edges) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (source) source.outgoing++;
    if (target) target.incoming++;
  }
  return graph;
}
