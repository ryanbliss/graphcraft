import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/space-grotesk/wght.css";
import "./style.css";
import { WorldEngine, type ViewMode } from "./world/engine.ts";
import { installTravel } from "./ui/travel.ts";
import { roomTheme } from "./world/interiors.ts";
import { icon, escapeHtml as esc } from "./ui/icons.ts";
import { pickDirectory, scanDirectory, fromFileList } from "./graph/load.ts";
import {
  listRecentProjects,
  saveRecentProject,
  removeRecentProject,
  saveDirectoryHandle,
  readDirectoryHandle,
  requestDirectoryPermission,
  type RecentProject,
  type RecentProjectInput,
} from "./graph/recent-projects.ts";
import { palette } from "./world/layout.ts";
import type { ProjectGraph, GraphNode } from "./graph/types.ts";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main id="world"></main><div class="vignette"></div>
  <header class="masthead"><a class="brand" href="/" aria-label="Graphcraft home">${icon("cube")}<span>graphcraft</span><span class="alpha">ALPHA</span></a><div class="privacy"><i></i> LOCAL WORLD. YOUR CODE.</div><div class="project-name" hidden></div><button class="icon-button open-project" title="Open a project" aria-label="Open a project">${icon("folder")}</button></header>
  <section class="landing" aria-label="Open a project">
    <div class="eyebrow"><span class="tiny-line"></span> A WORLD INSIDE YOUR WORKSPACE</div>
    <h1>Walk through<br>your <span>code.</span></h1>
    <p class="intro">Your directories become a city.<br>Follow the connections inside.</p>
    <div class="launch"><button id="choose" class="primary">${icon("folder")}<span>Open a project</span>${icon("arrow")}</button><span class="local-note">Choose a local project or monorepo.</span></div>
    <div class="or-demo"><span>OR TAKE A LOOK AROUND</span></div>
    <button id="demo" class="demo-button"><span class="demo-cube">${icon("cube")}</span><span><strong>Neon harbor</strong><small>A small city. A lot of connections.</small></span><span class="demo-arrow">↗</span></button>
    <div class="recent-projects" hidden></div>
    <div class="privacy-note">${icon("shield")}<span>Your files stay on your machine.</span></div>
  </section>
  <aside class="scene-caption"><span class="caption-line"></span><span>NEON HARBOR <small>04:32 · AFTER THE LAST BUILD</small></span></aside>
  <footer class="landing-footer"><span>AN ARCHITECTURE YOU CAN GET LOST IN.</span><span>BUILT FROM CONNECTIONS <span class="footer-cross">+</span></span></footer>
  <nav class="view-switch" aria-label="World view" hidden><button data-mode="walk">${icon("walk")}<span>Walk</span></button><button data-mode="survey" class="active">${icon("survey")}<span>Survey</span></button><button data-mode="constellation">${icon("stars")}<span>Constellation</span></button></nav>
  <div class="tools" hidden><button id="travel-open" class="icon-button" title="District shuttle T" aria-label="Teleport">${icon("stars")}</button><button id="search-open" class="icon-button" title="Find a file /" aria-label="Find a file">${icon("search")}</button><button id="help-open" class="icon-button" title="Controls" aria-label="Controls">${icon("help")}</button></div>
  <div class="bottom-hud" hidden><div class="world-location"><span class="live-dot"></span><span id="location">Neon harbor</span><small id="seed"></small></div><div class="world-toolbar"><button id="cinema" class="active" title="Cinema mode" aria-label="Toggle cinema mode" aria-pressed="true">${icon("cinema")}</button><button id="routes" class="active" title="Import routes G" aria-label="Toggle import routes" aria-pressed="true">${icon("routes")}</button><button id="stars" class="active" title="Constellation V" aria-label="Toggle constellation" aria-pressed="true">${icon("stars")}</button><button id="labels" class="active" title="Labels L" aria-label="Toggle labels" aria-pressed="true">${icon("label")}</button><span></span><button id="reset" title="Return to spawn R" aria-label="Return to spawn">${icon("reset")}</button><button id="fullscreen" title="Full screen" aria-label="Full screen">${icon("expand")}</button></div><div class="view-hint">Drag to orbit <b>·</b> Scroll to explore</div></div>
  <div class="crosshair" hidden></div><button class="walk-prompt" hidden>Click to explore <span>W A S D to move · Mouse to look · Esc to release</span></button>
  <aside id="inspector" class="panel inspector" hidden></aside>
  <dialog id="search-dialog" class="panel search-dialog"><form method="dialog"><label class="search-field">${icon("search")}<input id="search-input" placeholder="Find a file, module, or package…" autocomplete="off" aria-label="Find a file, module, or package"/><button class="subtle" aria-label="Close search">Esc</button></label></form><div id="search-results"></div><div class="search-footer">Choose a result to locate it in the world.</div></dialog>
  <dialog id="help-dialog" class="panel help-dialog"><button class="icon-button dialog-close" aria-label="Close controls">${icon("close")}</button><div class="eyebrow">FIELD GUIDE</div><h2>Make yourself at home.</h2><p>Packages form districts. Subfolders become furnished rooms.<br>Click a sign to inspect, or take a shuttle across the city.</p><div class="key-guide"><span>Move</span><kbd>W A S D</kbd><span>Look around</span><kbd>Mouse</kbd><span>Jump / sprint</span><kbd>Space / Shift</kbd><span>Release mouse</span><kbd>Esc</kbd><span>Find a file</span><kbd>/</kbd><span>Teleport</span><kbd>T</kbd><span>Routes / labels / sky</span><kbd>G / L / V</kbd><span>Return to spawn</span><kbd>R</kbd></div><div class="legend">${Object.entries(
    palette,
  )
    .map(
      ([kind, color]) =>
        `<span><i style="background:${color}"></i>${kind}</span>`,
    )
    .join(
      "",
    )}</div><p class="fine-print">Antenna height follows incoming connections. Larger directories gain upper floors. Furniture reflects each file’s role. Light travels from importer to dependency; dense worlds show the strongest building connections. Select a file to see its exact edges.</p></dialog>
  <dialog id="diagnostics-dialog" class="panel diagnostics-dialog"><button class="icon-button dialog-close" aria-label="Close diagnostics">${icon("close")}</button><div class="eyebrow">PROJECT ANALYSIS</div><h2>Some connections need a closer look.</h2><div id="diagnostics-list"></div></dialog>
  <button id="diagnostics" hidden>Analysis notes</button>
  <div id="hover" class="hover-label" hidden></div><div id="toast" class="toast" role="status" hidden></div>
  <div id="loading" class="loading" hidden><div class="loading-inner">${icon("cube")}<h2>Shaping your world.</h2><p id="loading-message" role="status" aria-live="polite">Tracing connections</p><div class="loading-track"></div></div></div>
  <dialog id="project-dialog" class="panel project-dialog"><button class="icon-button dialog-close" aria-label="Close project picker">${icon("close")}</button><div class="eyebrow">YOUR NEXT WORLD</div><h2>Open a project.</h2><p>Choose a project directory, including mixed-language monorepos.</p><p id="project-error" class="project-error" role="alert" hidden></p><button id="native-picker" class="primary">${icon("folder")}Choose directory ${icon("arrow")}</button><button id="compatible-picker" class="compatible-picker">Use compatible directory picker</button>${import.meta.env.DEV ? '<div class="path-divider">Or enter a local path</div><form id="path-form"><input id="project-path" placeholder="/Users/you/projects/my-app" aria-label="Local project directory" autocomplete="off"/><button class="path-submit" type="submit" aria-label="Open local directory">→</button></form>' : ""}<div class="recent-projects" hidden></div><p class="fine-print">Files are read locally. Your project is never uploaded.</p></dialog>
  <input id="directory-input" type="file" webkitdirectory multiple hidden />
`;
const get = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing UI element ${selector}`);
  return el;
};
let engine: WorldEngine;
let travel: ReturnType<typeof installTravel>;
let busy = false;
let toastTimer: ReturnType<typeof setTimeout>;
let nodeIndex = new Map<string, GraphNode>();
let graph: ProjectGraph;
let hoveredId: string | undefined;
let hoverSince = 0;
function toast(message: string) {
  if (get<HTMLDialogElement>("#project-dialog").open) {
    get("#project-error").textContent = message;
    get("#project-error").hidden = false;
  }
  get("#toast").textContent = message;
  get("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (get("#toast").hidden = true), 6000);
}
function progress(message: string) {
  get("#loading-message").textContent = message;
}
function setMode(mode: ViewMode) {
  const playing = !engine.landing;
  document.body.classList.toggle("playing", playing);
  for (const selector of [
    ".landing",
    ".scene-caption",
    ".landing-footer",
    ".privacy",
  ])
    get(selector).hidden = playing;
  for (const selector of [
    ".view-switch",
    ".tools",
    ".bottom-hud",
    ".project-name",
  ])
    get(selector).hidden = !playing;
  hoveredId = undefined;
  get("#hover").hidden = true;
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });
  get("#cinema").hidden = mode !== "survey";
  get(".crosshair").hidden = mode !== "walk";
  get(".walk-prompt").hidden = mode !== "walk" || !!document.pointerLockElement;
  get(".view-hint").textContent =
    mode === "walk"
      ? "W A S D to move · Click to inspect"
      : "Drag to orbit · Scroll to explore · Click to inspect";
}
function setGraph(next: ProjectGraph, enter = true) {
  if (!next.nodes?.length)
    throw new Error("This project has no files to explore.");
  get<HTMLDialogElement>("#project-dialog").close();
  graph = next;
  nodeIndex = new Map(graph.nodes.map((node) => [node.id, node]));
  get("#inspector").hidden = true;
  engine.load(graph);
  get(".project-name").textContent = graph.name;
  get("#location").textContent = graph.name;
  get("#seed").textContent = `SEED ${graph.seed.toString(16).toUpperCase()}`;
  get("#diagnostics").hidden = !graph.diagnostics.length;
  if (enter) engine.enter();
}
async function loadProject(loader: () => Promise<ProjectGraph | undefined>) {
  if (busy) return;
  busy = true;
  const dialog = get<HTMLDialogElement>("#project-dialog");
  const restorePicker = dialog.open;
  dialog.close();
  progress("Reading your project");
  get("#loading").hidden = false;
  try {
    const pending = loader();
    const next = await pending;
    if (next) {
      progress("Building your world");
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0)),
      );
      setGraph(next);
    } else if (restorePicker) dialog.showModal();
  } catch (error) {
    if (restorePicker && !dialog.open) dialog.showModal();
    if (!(error instanceof DOMException && error.name === "AbortError"))
      toast(error instanceof Error ? error.message : String(error));
  } finally {
    get("#loading").hidden = true;
    busy = false;
  }
}
function rememberProject(input: RecentProjectInput) {
  try {
    saveRecentProject(input);
    renderRecents();
  } catch {
    toast(
      "Project opened, but this browser could not save it to recent projects.",
    );
  }
}
async function readLocalProject(path: string): Promise<ProjectGraph> {
  progress("Reading your project");
  const response = await fetch("/api/project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Unable to read this directory.";
    throw new Error(message);
  }
  const next = body as ProjectGraph;
  if (next.nodes.length)
    rememberProject({ kind: "path", path, name: next.name });
  return next;
}
function pickNative() {
  if (document.pointerLockElement) document.exitPointerLock();
  if ("showDirectoryPicker" in window)
    void loadProject(async () => {
      const handle = await pickDirectory();
      if (!handle) return;
      const next = await scanDirectory(handle, progress);
      if (next.nodes.length) {
        const id = await saveDirectoryHandle(handle);
        const input: RecentProjectInput = id
          ? { kind: "directory", id, name: next.name }
          : { kind: "picker", name: next.name };
        rememberProject(input);
      }
      return next;
    });
  else get<HTMLInputElement>("#directory-input").click();
}
function openRecent(project: RecentProject) {
  if (project.kind === "picker") {
    get<HTMLInputElement>("#directory-input").click();
    return;
  }
  if (project.kind === "path" && import.meta.env.DEV) {
    void loadProject(() => readLocalProject(project.path));
    return;
  }
  if (project.kind !== "directory") {
    pickNative();
    return;
  }
  void loadProject(async () => {
    const handle = await readDirectoryHandle(project.id);
    if (!handle) {
      openProject();
      throw new Error(
        "This browser no longer has access to that directory. Choose it again.",
      );
    }
    if (!(await requestDirectoryPermission(handle)))
      throw new Error(
        "Directory access was declined. Choose the project again to grant read access.",
      );
    const next = await scanDirectory(handle, progress);
    if (next.nodes.length)
      rememberProject({ kind: "directory", id: project.id, name: next.name });
    return next;
  });
}
function renderRecents() {
  const projects = listRecentProjects();
  for (const container of document.querySelectorAll<HTMLElement>(
    ".recent-projects",
  )) {
    container.hidden = projects.length === 0;
    container.innerHTML = `<div class="recent-heading">Recent projects</div><div class="recent-list">${projects
      .map((project) => {
        let detail = "";
        if (project.kind === "path") detail = project.path;
        if (project.kind === "picker") detail = "Choose directory again";
        return `<div class="recent-project"><button class="recent-open" data-recent="${esc(project.id)}" aria-label="Open ${esc(project.name)}"><span><strong>${esc(project.name)}</strong>${detail ? `<small>${esc(detail)}</small>` : ""}</span>${icon("arrow")}</button><button class="recent-remove icon-button" data-forget="${esc(project.id)}" aria-label="Forget ${esc(project.name)}" title="Forget project">${icon("close")}</button></div>`;
      })
      .join("")}</div>`;
    container
      .querySelectorAll<HTMLButtonElement>("[data-recent]")
      .forEach((button) => {
        button.onclick = () => {
          const project = projects.find(
            (item) => item.id === button.dataset.recent,
          );
          if (project) openRecent(project);
        };
      });
    container
      .querySelectorAll<HTMLButtonElement>("[data-forget]")
      .forEach((button) => {
        button.onclick = () => {
          void removeRecentProject(button.dataset.forget!)
            .then(renderRecents)
            .catch(() =>
              toast("This browser could not remove the saved project."),
            );
        };
      });
  }
}
function openProject() {
  get("#project-error").hidden = true;
  get("#hover").hidden = true;
  renderRecents();
  if (document.pointerLockElement) document.exitPointerLock();
  get<HTMLDialogElement>("#project-dialog").showModal();
}
function identity(path: string, packageId: string) {
  const packageName =
    graph.packages.find((pkg) => pkg.id === packageId)?.name ?? packageId;
  return `<p class="identity-package">${esc(packageName)}</p><p class="file-path" aria-label="Full path">${esc(path || ".")}</p>`;
}
function dismissSelection() {
  const panel = get("#inspector");
  if (panel.hidden) return false;
  panel.hidden = true;
  engine.clearHighlight();
  return true;
}
function select(id: string) {
  if (id.startsWith("transit:")) {
    travel.open(id);
    return;
  }
  if (document.pointerLockElement) document.exitPointerLock();
  get("#hover").hidden = true;
  engine.highlight(id);
  const node = nodeIndex.get(id),
    building = engine.layout.buildings.find((b) => b.id === id),
    region = engine.layout.regions.find((candidate) => candidate.id === id);
  const roomBuilding = engine.layout.buildings.find((candidate) =>
    candidate.rooms.some((room) => room.id === id),
  );
  const room = roomBuilding?.rooms.find((candidate) => candidate.id === id);
  const panel = get("#inspector");
  panel.hidden = false;
  const close = `<button class="icon-button inspector-close" aria-label="Close inspector">${icon("close")}</button>`;
  const trail = engine.survey.trail(id).slice(0, -1);
  const breadcrumb = `<nav class="directory-breadcrumb" aria-label="Directory breadcrumb"><button id="survey-world">City</button>${trail.map((parent) => `<span>/</span><button data-select="${esc(parent.id)}" title="${esc(parent.directory || ".")}">${esc(parent.name)}</button>`).join("")}</nav>`;
  if (node) {
    const cycle = graph.cycles?.find((group) => group.includes(id));
    const incoming = graph.edges.filter((edge) => edge.target === id),
      outgoing = graph.edges.filter((edge) => edge.source === id);
    const relations = (
      edges: typeof outgoing,
      direction: "source" | "target",
    ) => {
      const seen = new Set<string>();
      return (
        edges
          .filter((edge) => {
            const key = edge[direction] + edge.kind;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 60)
          .map((edge) => {
            const target = edge[direction];
            const name = nodeIndex.get(target)?.name ?? target;
            return `<button class="relation" data-select="${esc(target)}" title="${esc(target)}"><span class="relation-identity"><strong>${esc(name)}</strong><span>${esc(target)}</span></span><small>${edge.kind}</small>${icon("arrow")}</button>`;
          })
          .join("") || '<p class="empty-small">No connections found.</p>'
      );
    };
    panel.innerHTML = `${close}<div class="eyebrow" style="color:${palette[node.kind]}">${esc(node.kind.toUpperCase())}</div><h2>${esc(node.name)}</h2>${identity(node.id, node.packageId)}<p class="file-path">${esc(engine.layout.positions.get(id)?.furniture ?? "")} · ${(engine.layout.positions.get(id)?.floorY ?? 0) > 0 ? `Floor ${Math.round(engine.layout.positions.get(id)!.floorY / 5.4) + 1}` : "Ground floor"}</p><button class="visit-button" id="visit">${icon("walk")}Teleport to room ${icon("arrow")}</button><div class="inspector-scroll">${cycle ? `<div class="cycle-note">Circular dependency<p>This file belongs to an import cycle. Pink furniture beacons mark the other files in the cycle.</p></div>` : ""}${
      node.exports.length
        ? `<h3>Exports</h3><div class="export-tags">${node.exports
            .slice(0, 30)
            .map((name) => `<span>${esc(name)}</span>`)
            .join("")}</div>`
        : ""
    }<h3>Imports</h3>${relations(outgoing, "target")}<h3>Imported by</h3>${relations(incoming, "source")}${incoming.length > 60 || outgoing.length > 60 ? '<p class="fine-print">Showing the first connections. Search to locate another file.</p>' : ""}</div>`;
  } else if (building) {
    panel.innerHTML = `${close}<div class="eyebrow">${esc(building.template)}</div><h2>${esc(building.name)}</h2>${identity(building.directory, building.packageId)}<button class="visit-button" id="visit">${icon("stars")}Teleport to entrance ${icon("arrow")}</button><div class="inspector-scroll"><h3>Rooms</h3>${building.rooms.map((child) => `<button class="relation" data-select="${esc(child.id)}"><span class="relation-identity"><strong>${esc(child.name)}</strong><span>${esc(roomTheme(child))} · ${child.floorY ? `Floor ${Math.round(child.floorY / 5.4) + 1}` : "Ground floor"}</span></span>${icon("arrow")}</button>`).join("")}</div>`;
  }
  if (room && roomBuilding) {
    panel.innerHTML = `${close}<div class="eyebrow">${esc(roomTheme(room))}</div><h2>${esc(room.name)}</h2>${identity(room.directory, roomBuilding.packageId)}<p class="file-path">${room.floorY ? `Floor ${Math.round(room.floorY / 5.4) + 1}` : "Ground floor"}</p><button class="visit-button" id="visit">${icon("stars")}Teleport to room ${icon("arrow")}</button><div class="inspector-scroll"><h3>Files in this room</h3>${room.nodeIds
      .map((nodeId) => {
        const node = nodeIndex.get(nodeId)!;
        return `<button class="relation" data-select="${esc(node.id)}"><span class="relation-identity"><strong>${esc(node.name)}</strong><span>${esc(node.id)}</span></span>${icon("arrow")}</button>`;
      })
      .join("")}</div>`;
  }

  if (region) {
    const children = engine.survey.children(id);
    const name = region.parentId
      ? region.name
      : (graph.packages.find((pkg) => pkg.id === region.packageId)?.name ??
        region.name);
    panel.innerHTML = `${close}<div class="eyebrow">${region.parentId ? "Directory" : "District"}</div><h2>${esc(name)}</h2>${identity(region.directory, region.packageId)}<button class="visit-button" id="visit">${icon("walk")}Teleport to entrance ${icon("arrow")}</button><div class="inspector-scroll"><h3>Explore</h3>${children
      .map(
        (child) =>
          `<button class="relation" data-select="${esc(child.id)}">${icon("nodes" in child ? "cube" : "folder")}<span class="relation-identity"><strong>${esc(child.name)}</strong><span>${esc(child.directory || ".")}</span></span>${icon("arrow")}</button>`,
      )
      .join("")}</div>`;
  }
  if (building || region)
    panel
      .querySelector(".eyebrow")
      ?.insertAdjacentHTML("beforebegin", breadcrumb);
  panel.querySelector("#survey-world")?.addEventListener("click", () => {
    dismissSelection();
    engine.setMode("survey");
  });
  panel
    .querySelector(".inspector-close")
    ?.addEventListener("click", dismissSelection);
  panel.querySelector("#visit")?.addEventListener("click", () => {
    dismissSelection();
    engine.focus(id, true);
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-select]").forEach(
    (button) =>
      (button.onclick = () => {
        const next = button.dataset.select!;
        select(next);
        engine.focus(next);
      }),
  );
}
function hover(id: string | undefined, x: number, y: number) {
  const element = get("#hover");
  const walking = engine.mode === "walk";
  const node = id ? nodeIndex.get(id) : undefined;
  if (
    !id ||
    !engine.showLabels ||
    !get("#inspector").hidden ||
    document.querySelector("dialog[open]") ||
    (walking && !node)
  ) {
    hoveredId = undefined;
    element.hidden = true;
    return;
  }
  if (hoveredId !== id) {
    hoveredId = id;
    hoverSince = performance.now();
    element.hidden = true;
    return;
  }
  if (performance.now() - hoverSince < 240) return;
  const building = engine.layout.buildings.find(
    (candidate) => candidate.id === id,
  );
  const region = engine.layout.regions.find((candidate) => candidate.id === id);
  const buildingName = building?.directory || building?.name;
  const name = node?.name || buildingName || region?.name;
  if (!name) {
    element.hidden = true;
    return;
  }
  element.classList.toggle("aim-label", walking);
  element.classList.toggle("building-hover", !!building && !walking);
  element.innerHTML = `<strong>${esc(name)}</strong>${!walking && node ? `<span>${esc(node.id)}</span>` : ""}`;
  element.hidden = false;
  element.style.left = walking
    ? "50%"
    : `${Math.max(10, Math.min(x + 16, innerWidth - 340))}px`;
  element.style.top = walking
    ? "auto"
    : `${Math.min(y + 18, innerHeight - 100)}px`;
}
function search() {
  if (document.pointerLockElement) document.exitPointerLock();
  const dialog = get<HTMLDialogElement>("#search-dialog");
  dialog.showModal();
  get<HTMLInputElement>("#search-input").value = "";
  updateSearch();
  get<HTMLInputElement>("#search-input").focus();
}
function updateSearch() {
  const query = get<HTMLInputElement>("#search-input")
    .value.trim()
    .toLowerCase();
  const matches = graph.nodes
    .filter((node) => node.id.toLowerCase().includes(query))
    .slice(0, 40);
  get("#search-results").innerHTML = matches.length
    ? matches
        .map(
          (node) =>
            `<button class="search-result" data-id="${esc(node.id)}"><i style="background:${palette[node.kind]}"></i><span>${esc(node.name)}<small>${esc(node.id)}</small></span>${icon("arrow")}</button>`,
        )
        .join("")
    : '<div class="search-empty">No files match that search.</div>';
  get("#search-results")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach(
      (button) =>
        (button.onclick = () => {
          get<HTMLDialogElement>("#search-dialog").close();
          const id = button.dataset.id!;
          select(id);
          engine.focus(id);
        }),
    );
}
get("#native-picker").onclick = pickNative;
get("#compatible-picker").onclick = () =>
  get<HTMLInputElement>("#directory-input").click();
if (import.meta.env.DEV)
  get("#path-form").onsubmit = (event) => {
    event.preventDefault();
    const path = get<HTMLInputElement>("#project-path").value.trim();
    if (!path) return;
    void loadProject(() => readLocalProject(path));
  };
get("#choose").onclick = openProject;
get(".open-project").onclick = openProject;
get<HTMLInputElement>("#directory-input").onchange = (event) => {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) {
    const files = input.files;
    void loadProject(async () => {
      const next = await fromFileList(files, progress);
      if (next.nodes.length)
        rememberProject({ kind: "picker", name: next.name });
      return next;
    });
    input.value = "";
  }
};
get("#demo").onclick = () => {
  setGraph(graph);
};
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-mode]",
))
  button.onclick = () => engine.setMode(button.dataset.mode as ViewMode);
get("#search-open").onclick = search;
get("#travel-open").onclick = () => travel.open();
get<HTMLInputElement>("#search-input").oninput = updateSearch;
get("#help-open").onclick = () =>
  get<HTMLDialogElement>("#help-dialog").showModal();
for (const button of document.querySelectorAll<HTMLButtonElement>(
  ".dialog-close",
))
  button.onclick = () => button.closest("dialog")?.close();
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        dialog.close();
    }
  });
get("#diagnostics").onclick = () => {
  get("#diagnostics-list").innerHTML =
    graph.diagnostics
      .slice(0, 150)
      .map(
        (note) =>
          `<div class="diagnostic"><strong>${esc(note.path)}</strong><p>${esc(note.message)}</p></div>`,
      )
      .join("") +
    (graph.diagnostics.length > 150
      ? "<p>More notes are available in the CLI analysis export.</p>"
      : "");
  get<HTMLDialogElement>("#diagnostics-dialog").showModal();
};
get("#cinema").onclick = () => {
  engine.setCinemaEnabled(!engine.cinemaEnabled);
  toggleButton("#cinema", engine.cinemaEnabled);
  try {
    localStorage.setItem("graphcraft.cinema", String(engine.cinemaEnabled));
  } catch {
    /* Storage may be disabled. */
  }
};
get("#routes").onclick = () => {
  engine.showRoutes = !engine.showRoutes;
  toggleButton("#routes", engine.showRoutes);
};
get("#stars").onclick = () => {
  engine.showStars = !engine.showStars;
  toggleButton("#stars", engine.showStars);
};
get("#labels").onclick = () => {
  engine.showLabels = !engine.showLabels;
  toggleButton("#labels", engine.showLabels);
};
function toggleButton(selector: string, on: boolean) {
  get(selector).classList.toggle("active", on);
  get(selector).setAttribute("aria-pressed", String(on));
}
get("#reset").onclick = () => engine.reset();
get("#fullscreen").onclick = () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else
    void document.documentElement
      .requestFullscreen()
      .catch(() => toast("Full screen is unavailable in this browser."));
};
get(".walk-prompt").onclick = () => engine.setMode("walk");
document.addEventListener("keydown", (event) => {
  if (
    (event.target as HTMLElement).matches("input,textarea") ||
    document.querySelector("dialog[open]") ||
    !document.body.classList.contains("playing")
  )
    return;
  if (event.key === "Escape" && dismissSelection()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  const actions: Record<string, () => void> = {
    "/": search,
    t: () => travel.open(),
    g: () => get("#routes").click(),
    l: () => get("#labels").click(),
    v: () => get("#stars").click(),
    r: () => engine.reset(),
  };
  const action = actions[event.key.toLowerCase()];
  if (action) {
    event.preventDefault();
    action();
  }
});
renderRecents();
window.addEventListener("storage", renderRecents);
try {
  engine = new WorldEngine(get("#world"), {
    select,
    dismissSelection,
    hover,
    mode: setMode,
    lock: (locked) => {
      if (locked) dismissSelection();
      get(".walk-prompt").hidden = locked || engine.mode !== "walk";
      get(".crosshair").hidden = !locked;
    },
    error: toast,
    cinema: (state) => {
      const button = get("#cinema");
      button.dataset.state = state;
      button.title =
        state === "playing"
          ? "Cinema mode · drag to pause"
          : "Cinema mode · " +
            (state === "paused" ? "resumes when idle" : "off");
    },
    cinemaBlocked: () =>
      busy ||
      !get("#inspector").hidden ||
      !!document.querySelector("dialog[open]"),
  });
  try {
    engine.setCinemaEnabled(
      localStorage.getItem("graphcraft.cinema") !== "false",
    );
  } catch {
    /* Use the default when storage is unavailable. */
  }
  toggleButton("#cinema", engine.cinemaEnabled);
  travel = installTravel(engine);
  const response = await fetch("/demo.graph.json");
  if (!response.ok) throw new Error("The demo world could not be loaded.");
  setGraph((await response.json()) as ProjectGraph, false);
  get("#diagnostics").hidden = true;
} catch (error) {
  get(".landing").classList.add("no-webgl");
  toast(
    `Unable to initialize the 3D world: ${error instanceof Error ? error.message : String(error)}`,
  );
  get<HTMLButtonElement>("#demo").disabled = true;
}
