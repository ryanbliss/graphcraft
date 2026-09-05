import { describe, expect, it } from "vitest";
import { analyzeProject } from "../src/graph/analyze.ts";
import { isProjectFile, type SourceFile } from "../src/graph/types.ts";
import { layoutWorld } from "../src/world/layout.ts";
const project = (input: Record<string, string>): SourceFile[] =>
  Object.entries(input).map(([path, content]) => ({ path, content }));
describe("project analysis", () => {
  it("resolves source extensions, barrels, type imports, dynamic imports, and CommonJS without treating strings as imports", () => {
    const graph = analyzeProject(
      project({
        "src/a.ts": `import type { B } from './b.js'; export * from './b'; const c = import('./c'); const r = require('./b'); const ignored = "import x from 'fake'";`,
        "src/b.d.ts": "export interface B {}",
        "src/c.ts": "export const c = true;",
      }),
      "test",
    );
    expect(graph.edges.map((e) => [e.target, e.kind])).toEqual(
      expect.arrayContaining([
        ["src/b.d.ts", "type"],
        ["src/b.d.ts", "reexport"],
        ["src/b.d.ts", "import"],
        ["src/c.ts", "dynamic"],
      ]),
    );
    expect(graph.nodes.some((n) => n.id === "npm:fake")).toBe(false);
    expect(graph.diagnostics).toEqual([]);
  });
  it("resolves inherited aliases and workspace package exports, and identifies component use", () => {
    const graph = analyzeProject(
      project({
        "package.json": '{"name":"root","workspaces":["packages/*"]}',
        "tsconfig.base.json":
          '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
        "tsconfig.json": '{ // comment\n "extends":"./tsconfig.base.json", }',
        "src/App.tsx": `import { Button } from '@demo/ui'; import { value } from '@/value'; export const App = () => <Button />;`,
        "src/value.ts": "export const value = 1",
        "packages/ui/package.json":
          '{"name":"@demo/ui","exports":{".":{"source":"./src/index.ts"}}}',
        "packages/ui/src/index.ts": 'export {Button} from "./Button"',
        "packages/ui/src/Button.tsx": "export const Button = () => <button />",
      }),
      "test",
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "src/App.tsx",
          target: "packages/ui/src/index.ts",
          kind: "component",
        }),
        expect.objectContaining({ target: "src/value.ts" }),
      ]),
    );
    expect(graph.nodes.find((n) => n.id === "src/App.tsx")?.kind).toBe(
      "component",
    );
    expect(graph.diagnostics).toEqual([]);
  });
  it("keeps fixture manifests in their owning package and resolves emitted workspace exports back to source", () => {
    const graph = analyzeProject(
      project({
        "package.json": '{"name":"build","workspaces":["packages/*"]}',
        "app.ts": 'import "@demo/core/internal";',
        "packages/core/package.json":
          '{"name":"@demo/core","exports":{"./internal":"./bin/internals/index.js"}}',
        "packages/core/tsconfig.json":
          '{"compilerOptions":{"rootDir":"src","outDir":"bin"}}',
        "packages/core/src/internals/index.ts": "export {}",
        "packages/core/bin/internals/index.js": "export {}",
        "packages/core/src/internals/package.json": '{"type":"module"}',
        "packages/core/test-fixtures/package.json": '{"workspaces":["*"]}',
        "packages/core/test-fixtures/project/package.json":
          '{"name":"@demo/core"}',
        "packages/core/test-fixtures/project/index.ts": "export {}",
        "packages/core/test-fixtures/project/_generated/api.ts": "export {}",
      }),
      "Retree",
    );
    expect(graph.packages.map((pkg) => [pkg.id, pkg.name])).toEqual([
      [".", "Retree"],
      ["packages/core", "@demo/core"],
    ]);
    expect(
      graph.nodes.find((node) => node.id.endsWith("project/index.ts"))
        ?.packageId,
    ).toBe("packages/core");
    expect(
      graph.nodes.some(
        (node) => node.id.includes("/bin/") || node.id.includes("/_generated/"),
      ),
    ).toBe(false);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: "app.ts",
        target: "packages/core/src/internals/index.ts",
      }),
    ]);
    expect(graph.diagnostics).toEqual([]);
  });
  it("resolves a package entry built into dist when source retains its nested path", () => {
    const graph = analyzeProject(
      project({
        "package.json": '{"name":"vite","exports":"./dist/node/index.js"}',
        "scripts/check.ts": 'import "vite"; import "../dist/node/index.js"',
        "src/node/index.ts": "export {}",
      }),
      "vite",
    );
    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: "scripts/check.ts",
        target: "src/node/index.ts",
      }),
    ]);
    expect(graph.diagnostics).toEqual([]);
  });
  it("recognizes explicitly declared workspace packages under a test directory", () => {
    const graph = analyzeProject(
      project({
        "package.json":
          '{"workspaces":{"packages":["tests/*","!tests/fixtures"]}}',
        "tests/integration/package.json": '{"name":"integration"}',
        "tests/integration/index.ts": "export {}",
        "tests/fixtures/nested/package.json": '{"name":"fixture"}',
        "tests/fixtures/nested/index.ts": "export {}",
      }),
      "project",
    );
    expect(graph.packages.map((pkg) => pkg.id)).toEqual([
      ".",
      "tests/integration",
    ]);
  });
  it("reports broken source and computed imports while retaining the rest of the graph", () => {
    const graph = analyzeProject(
      project({
        "bad.ts": "export {",
        "ok.ts": `import './missing'; import(variable); import {x} from 'react';`,
      }),
      "broken",
    );
    expect(graph.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "bad.ts",
          message: expect.stringContaining("Parse failed"),
        }),
        expect.objectContaining({ message: "Unresolved import ./missing" }),
        expect.objectContaining({
          message: "Computed import cannot be resolved statically.",
        }),
      ]),
    );
    expect(graph.nodes.some((n) => n.id === "npm:react")).toBe(true);
  });
  it("resolves a CommonJS package root and finds cycles without recursion", () => {
    const graph = analyzeProject(
      project({
        "package.json": '{"name":"example","main":"index.js"}',
        "index.js": "module.exports = require('./lib')",
        "lib/index.js": "module.exports = require('..')",
        "test/app.js": "const app = require('..')",
      }),
      "example",
    );
    expect(
      graph.edges.some(
        (e) => e.source === "test/app.js" && e.target === "index.js",
      ),
    ).toBe(true);
    expect(graph.cycles).toEqual([["index.js", "lib/index.js"]]);
    expect(graph.diagnostics).toEqual([]);
  });
  it("handles config cycles and does not scan dependency installations or secrets", () => {
    const graph = analyzeProject(
      project({
        "tsconfig.json": '{"extends":"./tsconfig.base.json"}',
        "tsconfig.base.json": '{"extends":"./tsconfig.json"}',
        "index.ts": "export {}",
      }),
      "test",
    );
    expect(
      graph.diagnostics.some(
        (d) => d.message === "Circular config inheritance.",
      ),
    ).toBe(true);
    expect(isProjectFile("node_modules/a/index.ts")).toBe(false);
    expect(isProjectFile(".env.local")).toBe(false);
    expect(isProjectFile(".git/index.ts")).toBe(false);
    expect(isProjectFile("src/view.tsx")).toBe(true);
  });
  it("produces identical geometry and seeds regardless of directory enumeration order", () => {
    const sources = project({
      "package.json": '{"name":"demo"}',
      "src/a.ts": 'import "./b"',
      "src/b.ts": 'import "../other/c"',
      "other/c.ts": "export const c = 1",
    });
    const a = analyzeProject(sources, "demo"),
      b = analyzeProject([...sources].reverse(), "demo");
    expect(a).toEqual(b);
    expect(layoutWorld(a)).toEqual(layoutWorld(b));
    const layout = layoutWorld(a);
    expect(layout.positions.size).toBe(a.nodes.length);
    for (const building of layout.buildings)
      for (const node of building.nodes) {
        const p = layout.positions.get(node.id)!;
        expect(Math.abs(p.x - building.x)).toBeLessThan(building.width / 2 - 1);
        expect(Math.abs(p.z - building.z)).toBeLessThan(building.depth / 2 - 1);
      }
  });
  it("keeps large directory interiors and package districts separate", () => {
    const sources = project(
      Object.fromEntries(
        Array.from({ length: 1200 }, (_, i) => [
          `packages/p${i % 4}/src/g${i % 30}/file${i}.ts`,
          i ? "export {}" : "export const root=1",
        ]),
      ),
    );
    for (let i = 0; i < 4; i++)
      sources.push({
        path: `packages/p${i}/package.json`,
        content: `{"name":"p${i}"}`,
      });
    const graph = analyzeProject(sources, "large"),
      layout = layoutWorld(graph);
    expect(layout.positions.size).toBe(graph.nodes.length);
    expect(graph.nodes.filter((node) => /\.tsx?$/.test(node.id))).toHaveLength(
      1200,
    );
    for (let i = 0; i < layout.buildings.length; i++)
      for (let j = i + 1; j < layout.buildings.length; j++) {
        const a = layout.buildings[i],
          b = layout.buildings[j];
        expect(
          Math.abs(a.x - b.x) > (a.width + b.width) / 2 ||
            Math.abs(a.z - b.z) > (a.depth + b.depth) / 2,
        ).toBe(true);
      }
  });
});
