import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readProject } from "../scripts/read-project.ts";
import { chooseDirectory, fromFileList } from "../src/graph/load.ts";
import { analyzeProject } from "../src/graph/analyze.ts";
import type { SourceFile } from "../src/graph/types.ts";

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "graphcraft-scan-"));
  directories.push(root);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

describe("source discovery", () => {
  it("binds the native picker and reads ignore metadata before visiting directories", async () => {
    let posted: SourceFile[] = [];
    vi.stubGlobal(
      "Worker",
      class {
        onmessage?: (event: {
          data: { graph: ReturnType<typeof analyzeProject> };
        }) => void;
        terminate() {}
        postMessage(message: {
          files: SourceFile[];
          name: string;
          omittedPaths: string[];
        }) {
          posted = message.files;
          this.onmessage?.({
            data: {
              graph: analyzeProject(message.files, message.name, {
                omittedPaths: message.omittedPaths,
              }),
            },
          });
        }
      },
    );
    vi.stubGlobal("window", {
      async showDirectoryPicker(this: unknown) {
        expect(this).toBe(window);
        return {
          kind: "directory",
          name: "project",
          async *values() {
            yield {
              kind: "directory",
              name: "Bin",
              values() {
                throw new Error("Ignored output directory was visited");
              },
            };
            yield {
              kind: "file",
              name: "index.ts",
              getFile: async () => new File(["export {}"], "index.ts"),
            };
            yield {
              kind: "file",
              name: ".gitignore",
              getFile: async () => new File(["[Bb]in/"], ".gitignore"),
            };
          },
        };
      },
    });
    const graph = await chooseDirectory(() => {});
    expect(graph?.nodes.map((node) => node.id)).toEqual(["index.ts"]);
    expect(posted.map((file) => file.path)).toEqual(["index.ts"]);
  });
  it("honors nested gitignore rules, negation, and compiler outputs without hiding authored bin scripts", async () => {
    const files = {
      ".gitignore": "ignored/*\n!ignored/keep.ts\nblocked/\n",
      "src/index.ts":
        'import "./_generated/api"; import "./marked"; import "../ignored/drop"; import "./missing";',
      "bin/cli.js": "#!/usr/bin/env node\nconsole.log('authored CLI')",
      "ignored/drop.ts": "export {}",
      "ignored/keep.ts": "export {}",
      "blocked/.gitignore": "!index.ts",
      "blocked/index.ts": "export {}",
      "packages/lib/.gitignore": "[Bb]in/\n",
      "packages/lib/Bin/index.js": "export {}",
      "packages/lib/src/index.ts": "export {}",
      "packages/custom/tsconfig.json":
        '{"compilerOptions":{"rootDir":"src","outDir":"compiled","declarationDir":"declarations"}}',
      "packages/custom/compiled/index.js": "export {}",
      "packages/custom/declarations/index.d.ts": "export {}",
      "packages/custom/src/index.ts": "export {}",
      "src/_generated/api.ts": "export {}",
      "src/schema.generated.ts": "export {}",
      "src/marked.ts":
        "/* eslint-disable */\n/** Automatically generated. */\nexport {}",
      "src/authored.d.ts": "export interface Authored {}",
      "src/comment.ts": "export const text = 'do not edit';",
    };
    const expected = [
      "bin/cli.js",
      "ignored/keep.ts",
      "packages/custom/src/index.ts",
      "packages/custom/tsconfig.json",
      "packages/lib/src/index.ts",
      "src/authored.d.ts",
      "src/comment.ts",
      "src/index.ts",
    ].sort();
    const scan = await readProject(await fixture(files));
    expect(
      analyzeProject(scan.files, "project", { omittedPaths: scan.omittedPaths })
        .diagnostics,
    ).toEqual([
      { path: "src/index.ts", message: "Unresolved import ./missing" },
    ]);
    expect(scan.files.map((file) => file.path).sort()).toEqual(expected);

    let posted: SourceFile[] = [];
    vi.stubGlobal(
      "Worker",
      class {
        onmessage?: (event: {
          data: { graph: ReturnType<typeof analyzeProject> };
        }) => void;
        terminate() {}
        postMessage(message: {
          files: SourceFile[];
          name: string;
          omittedPaths: string[];
        }) {
          posted = message.files;
          this.onmessage?.({
            data: {
              graph: analyzeProject(message.files, message.name, {
                omittedPaths: message.omittedPaths,
              }),
            },
          });
        }
      },
    );
    // File upload enumeration has no guaranteed order. Metadata must be read first.
    const uploads = Object.entries(files)
      .reverse()
      .map(([path, content]) => {
        const file = new File([content], path.split("/").at(-1)!);
        Object.defineProperty(file, "webkitRelativePath", {
          value: `project/${path}`,
        });
        return file;
      });
    const pending = fromFileList(
      Object.assign(uploads, {
        item: (index: number) => uploads[index] ?? null,
      }),
      () => {},
    );
    // Clearing a file input can mutate its live FileList while metadata is read.
    uploads.length = 0;
    await pending;
    expect(posted.map((file) => file.path).sort()).toEqual(expected);
  });
});

it("discovers ignored independent workspaces consistently and excludes dotnet/Unity outputs, secrets and binary text candidates", async () => {
  const files = {
    ".gitignore": "/*\n!/Workspace.code-workspace\n",
    "Workspace.code-workspace": '{"folders":[{"path":"App"},{"path":"Unity"}]}',
    "App/.gitignore": "private/\n",
    "App/App.csproj": '<Project Sdk="Microsoft.NET.Sdk"/>',
    "App/Entry.cs": "public class Entry {}",
    "App/settings.json": '{"theme":"cyan"}',
    "App/data.custom": "authored content",
    "App/obj/AssemblyInfo.cs": "public class Generated {}",
    "App/bin/Debug/Entry.cs": "public class Compiled {}",
    "App/private/notes.md": "private project notes",
    "App/.env": "TOKEN=secret",
    "App/credentials.json": '{"token":"secret"}',
    "App/opaque.custom": "binary\0payload",
    "App/Generated.g.cs": "public class Generated {}",
    "App/large.txt": "x".repeat(4 * 1024 * 1024 + 1),
    "Unity/ProjectSettings/ProjectVersion.txt": "m_EditorVersion: 6000.5",
    "Unity/Assets/Player.cs": "public class Player {}",
    "Unity/Assets/Player.cs.meta": "guid: generated",
    "Unity/Library/cache.cs": "public class Cache {}",
    "Unity/Temp/temporary.txt": "build output",
    "Unity/Logs/editor.log": "runtime log",
    "Tools/.git/HEAD": "ref: refs/heads/main",
    "Tools/bin/cli.js": "#!/usr/bin/env node\nconsole.log('authored')",
    "clones/worktree/file.cs": "public class Duplicate {}",
  };
  const root = await fixture(files);
  const native = await readProject(root);
  const expected = [
    "Workspace.code-workspace",
    "App/App.csproj",
    "App/Entry.cs",
    "App/settings.json",
    "App/data.custom",
    "Unity/ProjectSettings/ProjectVersion.txt",
    "Unity/Assets/Player.cs",
    "Tools/bin/cli.js",
  ].sort();
  expect(native.files.map((file) => file.path).sort()).toEqual(expected);
  expect(native.scan.reasons.binary).toBe(1);
  expect(native.scan.reasons["over 4 MB"]).toBe(1);
  let posted: SourceFile[] = [];
  vi.stubGlobal(
    "Worker",
    class {
      onmessage?: (event: {
        data: { graph: ReturnType<typeof analyzeProject> };
      }) => void;
      terminate() {}
      postMessage(message: {
        files: SourceFile[];
        name: string;
        omittedPaths: string[];
        repositoryRoots: string[];
      }) {
        posted = message.files;
        this.onmessage?.({
          data: { graph: analyzeProject(message.files, message.name, message) },
        });
      }
    },
  );
  const uploads = Object.entries(files)
    .reverse()
    .map(([path, content]) => {
      const file = new File([content], path.split("/").at(-1)!);
      Object.defineProperty(file, "webkitRelativePath", {
        value: `Mixed/${path}`,
      });
      return file;
    });
  const uploaded = await fromFileList(
    Object.assign(uploads, { item: (index: number) => uploads[index] ?? null }),
    () => {},
  );
  expect(posted.map((file) => file.path).sort()).toEqual(expected);
  expect(uploaded.nodes.map((node) => node.id)).toEqual(
    analyzeProject(native.files, "Mixed", native).nodes.map((node) => node.id),
  );
});
