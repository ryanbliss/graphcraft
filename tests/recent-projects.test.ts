import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  listRecentProjects,
  readDirectoryHandle,
  removeRecentProject,
  requestDirectoryPermission,
  saveDirectoryHandle,
  saveRecentProject,
} from "../src/graph/recent-projects.ts";
import type { DirectoryHandle } from "../src/graph/load.ts";

const key = "graphcraft.recent-projects";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => values.set(name, value),
  });
  vi.stubGlobal("indexedDB", undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("starts empty and ignores malformed metadata without inventing projects", () => {
  expect(listRecentProjects()).toEqual([]);
  localStorage.setItem(key, "{broken");
  expect(listRecentProjects()).toEqual([]);
  localStorage.setItem(
    key,
    JSON.stringify([
      null,
      { kind: "path", name: "Relative", path: "src", lastOpened: 1 },
      { kind: "directory", id: "", name: "Missing", lastOpened: 1 },
      { kind: "picker", name: "", lastOpened: 1 },
      { kind: "picker", name: "Bad date", lastOpened: "yesterday" },
      {
        kind: "picker",
        name: "Real project",
        lastOpened: 2,
        content: "never retain source",
      },
    ]),
  );
  expect(listRecentProjects()).toEqual([
    {
      kind: "picker",
      id: "picker:Real project",
      name: "Real project",
      lastOpened: 2,
    },
  ]);
});

it("deduplicates normalized paths, orders recent scans, and removes entries", async () => {
  const clock = vi.spyOn(Date, "now");
  clock.mockReturnValue(1);
  const first = saveRecentProject({
    kind: "path",
    path: "/projects/app/",
    name: "App",
  });
  clock.mockReturnValue(2);
  saveRecentProject({ kind: "picker", name: "Picked app" });
  clock.mockReturnValue(3);
  saveRecentProject({
    kind: "path",
    path: "/projects/app",
    name: "App renamed",
  });
  expect(listRecentProjects().map((project) => project.name)).toEqual([
    "App renamed",
    "Picked app",
  ]);
  expect(listRecentProjects()[0].id).toBe(first.id);
  await removeRecentProject(first.id);
  expect(listRecentProjects().map((project) => project.kind)).toEqual([
    "picker",
  ]);
  expect(() =>
    saveRecentProject({ kind: "path", path: "../app", name: "App" }),
  ).toThrow("must be absolute");
});

it("keeps same-named native directories distinct and strips source data from saved records", () => {
  const record = {
    kind: "directory" as const,
    id: "directory:first",
    name: "src",
    content: "private source",
  };
  saveRecentProject(record);
  saveRecentProject({ kind: "directory", id: "directory:second", name: "src" });
  saveRecentProject(record);
  expect(listRecentProjects()).toHaveLength(2);
  expect(localStorage.getItem(key)).not.toContain("private source");
  expect(
    saveRecentProject({
      kind: "path",
      path: "C:\\projects\\app\\",
      name: "Windows app",
    }).id,
  ).toBe("path:C:/projects/app");
});

function handle(): DirectoryHandle {
  return { kind: "directory", name: "project", async *values() {} };
}

it("checks read access and only prompts when stored permission needs renewal", async () => {
  const directory = handle(),
    query = vi
      .fn<NonNullable<DirectoryHandle["queryPermission"]>>()
      .mockResolvedValue("granted"),
    request = vi
      .fn<NonNullable<DirectoryHandle["requestPermission"]>>()
      .mockResolvedValue("granted");
  directory.queryPermission = query;
  directory.requestPermission = request;
  expect(await requestDirectoryPermission(directory)).toBe(true);
  expect(query).toHaveBeenCalledWith({ mode: "read" });
  expect(request).not.toHaveBeenCalled();
  query.mockResolvedValue("prompt");
  expect(await requestDirectoryPermission(directory)).toBe(true);
  expect(request).toHaveBeenCalledWith({ mode: "read" });
  request.mockResolvedValue("denied");
  expect(await requestDirectoryPermission(directory)).toBe(false);
  expect(await requestDirectoryPermission(handle())).toBe(false);
});

it("lets successful scans fall back to picker recents when native handle storage is unavailable", async () => {
  expect(await saveDirectoryHandle(handle())).toBeUndefined();
  expect(await readDirectoryHandle("directory:missing")).toBeUndefined();
  saveRecentProject({
    kind: "directory",
    id: "directory:missing",
    name: "Project",
  });
  await removeRecentProject("directory:missing");
  expect(listRecentProjects()).toEqual([]);
});
