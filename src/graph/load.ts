import { isScanMetadata } from "./discovery.ts";
import {
  type SourceFile,
  type ProjectGraph,
  type ScanSummary,
  isProjectFile,
} from "./types.ts";
import { SourceScan } from "./scan.ts";
export interface DirectoryHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterable<DirectoryHandle | FileHandle>;
  queryPermission?(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission?(options: { mode: "read" }): Promise<PermissionState>;
  isSameEntry?(other: DirectoryHandle): Promise<boolean>;
}
interface FileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}
interface DirectoryWindow extends Window {
  showDirectoryPicker?: (options: { mode: "read" }) => Promise<DirectoryHandle>;
}
export async function chooseDirectory(
  onProgress: (message: string) => void,
): Promise<ProjectGraph | undefined> {
  const root = await pickDirectory();
  if (root) return scanDirectory(root, onProgress);
}
export async function pickDirectory(): Promise<DirectoryHandle | undefined> {
  const picker = (window as DirectoryWindow).showDirectoryPicker;
  if (picker) return picker.call(window, { mode: "read" });
}
export async function scanDirectory(
  root: DirectoryHandle,
  onProgress: (message: string) => void,
): Promise<ProjectGraph> {
  const scan = new SourceScan();
  async function visit(
    dir: DirectoryHandle,
    prefix: string,
    cached?: (DirectoryHandle | FileHandle)[],
  ) {
    const entries = cached ?? [];
    if (!cached) for await (const entry of dir.values()) entries.push(entry);
    scan.filter.addDirectory(
      prefix,
      entries.map((entry) => entry.name),
    );
    for (const entry of entries) {
      if (entry.kind !== "file" || !isScanMetadata(entry.name)) continue;
      const file = await entry.getFile();
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (file.size <= 4 * 1024 * 1024)
        scan.filter.addMetadata({ path, content: await file.text() });
    }
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === "directory") {
        if (!isProjectFile(`${path}/source.ts`)) {
          scan.omit(path, "ignored", true);
          continue;
        }
        let children: (DirectoryHandle | FileHandle)[] | undefined;
        if (
          !scan.filter.includes(path, true) &&
          !prefix &&
          !/^(?:bin|obj|build|dist)$/i.test(entry.name)
        ) {
          children = [];
          for await (const child of entry.values()) children.push(child);
          if (children.some((child) => child.name === ".git"))
            scan.filter.addRepository(path);
        }
        if (scan.filter.includes(path, true))
          await visit(entry, path, children);
        else scan.omit(path, "ignored", true);
        continue;
      }
      if (!scan.filter.includes(path)) {
        scan.omit(path, "ignored or unsupported");
        continue;
      }
      const file = await entry.getFile();
      await scan.accept(path, file.size, () => file.text());
      if (scan.files.length % 100 === 0) onProgress(`Reading ${path}`);
    }
  }
  onProgress(`Reading ${root.name}`);
  await visit(root, "");
  return parseFiles(
    scan.files,
    root.name,
    onProgress,
    scan.omittedPaths,
    [...scan.filter.repositories],
    scan.summary,
  );
}

export async function fromFileList(
  list: FileList,
  onProgress: (message: string) => void,
) {
  const selectedFiles = Array.from(list);
  const scan = new SourceScan();
  const name = selectedFiles[0]?.webkitRelativePath.split("/")[0] || "Project";
  const pathOf = (file: File) =>
    file.webkitRelativePath.split("/").slice(1).join("/") || file.name;
  for (const file of selectedFiles) {
    const path = pathOf(file);
    const git = path.match(/^(.*?)\/\.git(?:\/|$)/);
    if (git) scan.filter.addRepository(git[1]);
    if (!isScanMetadata(path) || file.size > 4 * 1024 * 1024) continue;
    scan.filter.addMetadata({ path, content: await file.text() });
  }
  for (const file of selectedFiles)
    await scan.accept(pathOf(file), file.size, () => file.text());
  return parseFiles(
    scan.files,
    name,
    onProgress,
    scan.omittedPaths,
    [...scan.filter.repositories],
    scan.summary,
  );
}

function parseFiles(
  files: SourceFile[],
  name: string,
  onProgress: (message: string) => void,
  omittedPaths: string[],
  repositoryRoots: string[],
  scan: ScanSummary,
): Promise<ProjectGraph> {
  if (!files.length)
    throw new Error(
      "No authored text or source files found in this directory.",
    );
  onProgress("Tracing imports and shaping your city");
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      event: MessageEvent<{ graph?: ProjectGraph; error?: string }>,
    ) => {
      worker.terminate();
      if (event.data.graph) resolve(event.data.graph);
      else reject(new Error(event.data.error ?? "Project analysis failed."));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({ files, name, omittedPaths, repositoryRoots, scan });
  });
}
