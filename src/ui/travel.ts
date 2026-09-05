import type { WorldEngine } from "../world/engine.ts";
import { icon } from "./icons.ts";
import "./travel.css";

function districtName(name: string): string {
  const words = name.replace(/^@[^/]+\//, "").replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

interface Destination {
  id: string;
  name: string;
  path: string;
  packageId: string;
  kind: "District" | "Building";
  color: string;
}

export function installTravel(engine: WorldEngine): {
  open(id?: string): void;
  close(): void;
} {
  const dialog = document.createElement("dialog");
  dialog.id = "travel-dialog";
  dialog.className = "panel travel-dialog";
  dialog.setAttribute("aria-labelledby", "travel-title");
  dialog.innerHTML = `<header class="travel-header"><span class="travel-emblem" aria-hidden="true">${icon("stars")}</span><div><p class="travel-origin">District shuttle</p><h2 id="travel-title">Teleport to...</h2></div><button class="icon-button travel-close" aria-label="Close teleport menu">${icon("close")}</button></header><label class="travel-search">${icon("search")}<input id="travel-search" type="search" placeholder="Find a district or building" aria-label="Find a district or building" autocomplete="off"></label><div class="travel-destinations"></div><footer class="travel-footer">Choose a stop, then explore on foot.</footer>`;
  const search = dialog.querySelector<HTMLInputElement>("input")!;
  const results = dialog.querySelector<HTMLElement>(".travel-destinations")!;
  const origin = dialog.querySelector<HTMLElement>(".travel-origin")!;
  const arrival = document.createElement("div");
  arrival.className = "travel-arrival";
  arrival.setAttribute("role", "status");
  arrival.hidden = true;
  document.body.append(dialog, arrival);
  let destinations: Destination[] = [];
  let arrivalTimer: ReturnType<typeof setTimeout> | undefined;
  let originId: string | undefined;

  function close() {
    dialog.close();
  }
  function travel(destination: Destination) {
    close();
    engine.focus(destination.id, true);
    arrival.textContent = `Arrived at ${destination.name}`;
    arrival.hidden = false;
    arrival.classList.remove("arriving");
    void arrival.offsetWidth;
    arrival.classList.add("arriving");
    clearTimeout(arrivalTimer);
    arrivalTimer = setTimeout(() => {
      arrival.hidden = true;
      arrival.classList.remove("arriving");
    }, 1900);
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const fragment = document.createDocumentFragment();
    let previousKind: Destination["kind"] | undefined;
    for (const destination of destinations) {
      if (
        !`${destination.name} ${destination.path}`
          .toLocaleLowerCase()
          .includes(query)
      )
        continue;
      if (destination.kind !== previousKind) {
        const heading = document.createElement("h3");
        heading.textContent = `${destination.kind}s`;
        fragment.append(heading);
        previousKind = destination.kind;
      }
      const button = document.createElement("button");
      button.className = "travel-destination";
      button.dataset.destination = destination.id;
      button.style.setProperty("--stop-color", destination.color);
      button.setAttribute(
        "aria-label",
        `Teleport to ${destination.name}, ${destination.path}`,
      );
      const marker = document.createElement("span");
      marker.className = "travel-marker";
      marker.setAttribute("aria-hidden", "true");
      marker.innerHTML = icon(
        destination.kind === "District" ? "stars" : "cube",
      );
      const identity = document.createElement("span");
      identity.className = "travel-identity";
      const name = document.createElement("strong");
      name.textContent = destination.name;
      const path = document.createElement("small");
      path.textContent = destination.path;
      identity.append(name, path);
      const arrow = document.createElement("span");
      arrow.className = "travel-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.innerHTML = icon("arrow");
      button.append(marker, identity, arrow);
      button.onclick = () => travel(destination);
      fragment.append(button);
    }
    if (!fragment.childNodes.length) {
      const empty = document.createElement("p");
      empty.className = "travel-empty";
      empty.textContent = "No destinations match that search.";
      fragment.append(empty);
    }
    results.replaceChildren(fragment);
    results.scrollTop = 0;
  }
  function open(id?: string) {
    if (!engine.layout) return;
    originId = id?.replace(/^transit:/, "");
    const districts = new Map(
      engine.layout.districts.map((district) => [district.id, district]),
    );
    const packages = new Map(engine.graph.packages.map((pkg) => [pkg.id, pkg]));
    destinations = [];
    for (const region of engine.layout.regions) {
      if (region.parentId) continue;
      const district = districts.get(region.packageId);
      if (!district) continue;
      const pkg = packages.get(district.id);
      destinations.push({
        id: region.id,
        name: districtName(district.name),
        path: pkg?.directory || engine.graph.name,
        packageId: district.id,
        kind: "District",
        color: district.color,
      });
    }
    for (const building of engine.layout.buildings) {
      const district = districts.get(building.packageId);
      destinations.push({
        id: building.id,
        name: building.name,
        path: building.directory || engine.graph.name,
        packageId: building.packageId,
        kind: "Building",
        color: district?.color ?? "#a8d7c9",
      });
    }
    destinations.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "District" ? -1 : 1;
      if (a.packageId === originId && b.packageId !== originId) return -1;
      if (b.packageId === originId && a.packageId !== originId) return 1;
      return a.name.localeCompare(b.name) || a.path.localeCompare(b.path);
    });
    const district = districts.get(originId ?? "");
    origin.textContent = district
      ? `${districtName(district.name)} shuttle`
      : "District shuttle";
    if (document.pointerLockElement) document.exitPointerLock();
    search.value = "";
    render();
    if (!dialog.open) dialog.showModal();
    search.focus();
  }
  search.addEventListener("input", render);
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== "ArrowDown") return;
    const first = results.querySelector<HTMLButtonElement>("button");
    if (!first) return;
    event.preventDefault();
    if (event.key === "Enter") first.click();
    else first.focus();
  });
  dialog.querySelector(".travel-close")!.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      close();
  });
  return { open, close };
}
