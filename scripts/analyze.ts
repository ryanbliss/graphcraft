import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { readProject } from "./read-project.ts";
import { analyzeProject } from "../src/graph/analyze.ts";
import { layoutWorld } from "../src/world/layout.ts";
const directory = process.argv[2];
if (!directory)
  throw new Error("Usage: npm run analyze -- /path/to/project [output.json]");
const start = performance.now();
const project = await readProject(resolve(directory));
const scanMs = performance.now() - start;
const graph = analyzeProject(project.files, project.name, project);
const parseMs = performance.now() - start - scanMs;
const world = layoutWorld(graph);
console.log(
  JSON.stringify(
    {
      name: graph.name,
      scan: project.scan,
      csharp: graph.nodes.filter((node) => /\.csx?$/.test(node.id)).length,
      files: graph.nodes.filter((n) => n.kind !== "external").length,
      externals: graph.nodes.filter((n) => n.kind === "external").length,
      edges: graph.edges.length,
      packages: graph.packages.length,
      buildings: world.buildings.length,
      diagnostics: graph.diagnostics.length,
      parseFailures: graph.diagnostics.filter((d) =>
        d.message.startsWith("Parse failed"),
      ).length,
      bytes: project.bytes,
      scanMs: Math.round(scanMs),
      parseMs: Math.round(parseMs),
      layoutMs: Math.round(performance.now() - start - scanMs - parseMs),
      seed: graph.seed,
    },
    null,
    2,
  ),
);
if (process.argv[3])
  await writeFile(resolve(process.argv[3]), JSON.stringify(graph));
