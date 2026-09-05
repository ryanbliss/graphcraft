import type { DirectoryHandle } from "./load.ts";

export type RecentProjectInput =
  | { kind: "path"; path: string; name: string }
  | { kind: "directory"; id: string; name: string }
  | { kind: "picker"; name: string };
export type RecentProject = RecentProjectInput & {
  id: string;
  lastOpened: number;
};

const metadataKey = "graphcraft.recent-projects";
const databaseName = "graphcraft-project-handles";
const storeName = "directories";

function absolutePath(path: string): string | undefined {
  let normalized = path.trim();
  if (!/^(?:\/|[a-z]:[\\/]|\\\\)/i.test(normalized)) return;
  if (/^(?:[a-z]:[\\/]|\\\\)/i.test(normalized))
    normalized = normalized.replaceAll("\\", "/");
  if (normalized !== "/" && !/^[a-z]:\/$/i.test(normalized))
    normalized = normalized.replace(/\/+$/, "");
  return normalized;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecent(value: unknown): RecentProject | undefined {
  if (!record(value)) return;
  if (typeof value.name !== "string" || !value.name.trim()) return;
  if (
    typeof value.lastOpened !== "number" ||
    !Number.isFinite(value.lastOpened)
  )
    return;
  if (value.lastOpened < 0) return;
  const name = value.name.trim(),
    lastOpened = value.lastOpened;
  if (value.kind === "path" && typeof value.path === "string") {
    const path = absolutePath(value.path);
    if (path)
      return { kind: "path", id: `path:${path}`, path, name, lastOpened };
  }
  if (value.kind === "picker")
    return { kind: "picker", id: `picker:${name}`, name, lastOpened };
  if (
    value.kind === "directory" &&
    typeof value.id === "string" &&
    value.id.startsWith("directory:") &&
    value.id.length > 10
  )
    return { kind: "directory", id: value.id, name, lastOpened };
}

export function listRecentProjects(): RecentProject[] {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(metadataKey) ?? "[]",
    );
    if (!Array.isArray(saved)) return [];
    const projects = new Map<string, RecentProject>();
    for (const value of saved) {
      const project = parseRecent(value);
      if (!project) continue;
      const previous = projects.get(project.id);
      if (!previous || previous.lastOpened < project.lastOpened)
        projects.set(project.id, project);
    }
    return [...projects.values()].sort((a, b) => b.lastOpened - a.lastOpened);
  } catch {
    return [];
  }
}

export function saveRecentProject(input: RecentProjectInput): RecentProject {
  if (!input.name.trim())
    throw new Error("Recent project name cannot be empty.");
  if (input.kind === "path" && !absolutePath(input.path))
    throw new Error(`Recent project path must be absolute: ${input.path}`);
  if (
    input.kind === "directory" &&
    (!input.id.startsWith("directory:") || input.id.length <= 10)
  )
    throw new Error("Recent project directory ID is invalid.");
  const project = parseRecent({ ...input, lastOpened: Date.now() });
  if (!project)
    throw new Error(
      "Recent project requires a name and a valid absolute path or directory ID.",
    );
  localStorage.setItem(
    metadataKey,
    JSON.stringify([
      project,
      ...listRecentProjects().filter((item) => item.id !== project.id),
    ]),
  );
  return project;
}

export async function removeRecentProject(id: string): Promise<void> {
  localStorage.setItem(
    metadataKey,
    JSON.stringify(listRecentProjects().filter((item) => item.id !== id)),
  );
  if (!id.startsWith("directory:")) return;
  try {
    await directoryStore("readwrite", (store) => store.delete(id));
  } catch {
    // Recents remain removable when browser handle storage is unavailable.
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Browser directory storage is unavailable."));
      return;
    }
    const request = indexedDB.open(databaseName, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName))
        request.result.createObjectStore(storeName);
    };
    request.onerror = () =>
      reject(
        request.error ?? new Error("Unable to open browser directory storage."),
      );
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Browser directory storage is blocked by another tab."));
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
  });
}

async function directoryStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<unknown> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let result: unknown;
    const transaction = database.transaction(storeName, mode);
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onabort = () => {
      database.close();
      reject(
        transaction.error ??
          new Error("Browser directory storage transaction failed."),
      );
    };
    try {
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => {
        result = request.result;
      };
    } catch (error) {
      database.close();
      transaction.abort();
      reject(error);
    }
  });
}

function directoryHandle(value: unknown): value is DirectoryHandle {
  return (
    record(value) &&
    value.kind === "directory" &&
    typeof value.name === "string" &&
    typeof value.values === "function"
  );
}

export async function readDirectoryHandle(
  id: string,
): Promise<DirectoryHandle | undefined> {
  if (!id.startsWith("directory:") || id.length <= 10) return;
  try {
    const handle = await directoryStore("readonly", (store) => store.get(id));
    if (directoryHandle(handle)) return handle;
  } catch {
    // A forgotten handle falls back to choosing the directory again.
  }
}

export async function saveDirectoryHandle(
  handle: DirectoryHandle,
): Promise<string | undefined> {
  try {
    if (handle.isSameEntry) {
      for (const project of listRecentProjects()) {
        if (project.kind !== "directory") continue;
        const previous = await readDirectoryHandle(project.id);
        if (!previous) continue;
        try {
          if (await handle.isSameEntry(previous)) return project.id;
        } catch {
          // A moved or deleted previous folder does not prevent saving this one.
        }
      }
    }
    const id = `directory:${crypto.randomUUID()}`;
    await directoryStore("readwrite", (store) => store.put(handle, id));
    return id;
  } catch {
    return;
  }
}

export async function requestDirectoryPermission(
  handle: DirectoryHandle,
): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return false;
  const options = { mode: "read" } as const;
  if ((await handle.queryPermission(options)) === "granted") return true;
  return (await handle.requestPermission(options)) === "granted";
}
