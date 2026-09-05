import { writeFile } from "node:fs/promises";
import { analyzeProject } from "../src/graph/analyze.ts";
import type { SourceFile } from "../src/graph/types.ts";
const files: SourceFile[] = [
  {
    path: "package.json",
    content: JSON.stringify({
      name: "Neon harbor",
      workspaces: ["packages/*"],
    }),
  },
];
const folders: Record<string, Record<string, string[]>> = {
  harbor: {
    app: ["App", "Router", "Shell", "Navigation"],
    components: ["Button", "Dialog", "Card", "Command", "Menu", "Avatar"],
    views: ["Dashboard", "Explorer", "Settings", "Welcome"],
    hooks: ["useProject", "useSearch", "useTheme", "useSession"],
  },
  core: {
    graph: ["Graph", "Node", "Edge", "Traversal", "Resolver", "Index"],
    services: ["ProjectService", "ScanService", "CacheService", "EventBus"],
    schema: [
      "ProjectSchema",
      "NodeTypes",
      "EdgeTypes",
      "ImportSchema",
      "ExportSchema",
      "PackageSchema",
      "DirectorySchema",
      "WorkspaceSchema",
      "ViewSchema",
      "ThemeSchema",
      "PaletteSchema",
      "LayoutSchema",
      "PositionSchema",
      "RouteSchema",
      "SessionSchema",
      "CacheSchema",
      "WorkerSchema",
      "HistorySchema",
      "SnapshotSchema",
      "SettingsSchema",
    ],
  },
  ui: {
    components: ["Panel", "Tooltip", "Tabs", "Input", "Badge"],
    theme: ["Colors", "Tokens", "Typography"],
    tests: ["Panel.test", "Input.test", "Theme.test"],
  },
  runtime: {
    engine: ["Engine", "Scene", "Camera", "Clock"],
    systems: ["Physics", "Lighting", "Animation", "Audio"],
    workers: ["Parser", "Scanner", "Bundler"],
  },
};
for (const [pkg, dirs] of Object.entries(folders)) {
  files.push({
    path: `packages/${pkg}/package.json`,
    content: JSON.stringify({ name: `@harbor/${pkg}`, main: "src/index.ts" }),
  });
  files.push({
    path: `packages/${pkg}/src/index.ts`,
    content: Object.entries(dirs)
      .map(([dir, names]) => `export * from './${dir}/${names[0]}';`)
      .join("\n"),
  });
  for (const [dir, names] of Object.entries(dirs))
    for (const [index, name] of names.entries()) {
      const component = ["app", "components", "views"].includes(dir),
        test = dir === "tests";
      const imports = [
        `import { Graph as DependencyGraph } from '@harbor/core';`,
      ];
      if (pkg !== "ui")
        imports.push(`import { Panel as UiPanel } from '@harbor/ui';`);
      if (index > 0)
        imports.push(
          `import { ${names[0].replace(".test", "")} as Neighbor } from './${names[0]}';`,
        );
      if (pkg === "harbor")
        imports.push(
          `import { Engine as RuntimeEngine } from '@harbor/runtime';`,
        );
      const symbol = name.replace(".test", "");
      const content =
        imports.join("\n") +
        "\n" +
        (component
          ? `export function ${symbol}() { return <UiPanel><div>${symbol}</div></UiPanel> }`
          : `export class ${symbol} { run() { return '${symbol}'; } }`) +
        (test ? '\ndescribe("module", () => {});' : "") +
        "\n".repeat(20 + index * 19);
      files.push({
        path: `packages/${pkg}/src/${dir}/${name}.${component ? "tsx" : "ts"}`,
        content,
      });
    }
}
const graph = analyzeProject(files, "Neon harbor");
await writeFile("public/demo.graph.json", JSON.stringify(graph));
console.log(`Demo: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
