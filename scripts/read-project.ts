import { readdir, readFile, lstat } from "node:fs/promises";
import { join, basename } from "node:path";
import { SourceScan } from "../src/graph/scan.ts";
import { isScanMetadata } from "../src/graph/discovery.ts";
import { isProjectFile } from "../src/graph/types.ts";
import { analyzeProject } from "../src/graph/analyze.ts";
export async function readProject(root: string) {
  const scan = new SourceScan();
  async function visit(directory: string, prefix: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    scan.filter.addDirectory(
      prefix,
      entries.map((entry) => entry.name),
    );
    for (const entry of entries) {
      if (!entry.isFile() || !isScanMetadata(entry.name)) continue;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(directory, entry.name);
      if ((await lstat(full)).size <= 4 * 1024 * 1024)
        scan.filter.addMetadata({
          path,
          content: await readFile(full, "utf8"),
        });
    }
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        scan.omit(path, "symlink");
        continue;
      }
      if (entry.isDirectory()) {
        if (!isProjectFile(`${path}/source.ts`)) {
          scan.omit(path, "ignored", true);
          continue;
        }
        if (!scan.filter.includes(path, true) && !prefix) {
          // Aggregator repositories often ignore independently versioned child projects.
          const git = await lstat(join(directory, entry.name, ".git")).catch(
            () => undefined,
          );
          if (git && !git.isSymbolicLink()) scan.filter.addRepository(path);
        }
        if (scan.filter.includes(path, true))
          await visit(join(directory, entry.name), path);
        else scan.omit(path, "ignored", true);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!scan.filter.includes(path)) {
        scan.omit(path, "ignored or unsupported");
        continue;
      }
      const full = join(directory, entry.name);
      await scan.accept(path, (await lstat(full)).size, () =>
        readFile(full, "utf8"),
      );
    }
  }
  await visit(root, "");
  return {
    files: scan.files,
    name: basename(root),
    bytes: scan.summary.bytes,
    omittedPaths: scan.omittedPaths,
    repositoryRoots: [...scan.filter.repositories],
    scan: scan.summary,
  };
}
export async function graphFromDirectory(root: string) {
  const project = await readProject(root);
  return analyzeProject(project.files, project.name, project);
}
