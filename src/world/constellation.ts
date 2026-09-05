import * as THREE from "three";
import { hash, type ProjectGraph } from "../graph/types.ts";
import { palette, random, type WorldLayout } from "./layout.ts";
import { disposeGroup, lineGeometry } from "./geometry.ts";

export type CelestialKind =
  "universe" | "package" | "building" | "room" | "file" | "group";
export interface CelestialItem {
  id: string;
  sourceId?: string;
  parentId?: string;
  name: string;
  path: string;
  kind: CelestialKind;
  color: string;
  files: string[];
  children: CelestialItem[];
}
export interface CelestialModel {
  root: CelestialItem;
  items: Map<string, CelestialItem>;
  sources: Map<string, CelestialItem>;
}
const viewLimit = 24;

function boundChildren(parent: CelestialItem): void {
  if (parent.kind === "universe") {
    const folders = new Map<string, CelestialItem[]>();
    const direct: CelestialItem[] = [];
    for (const child of parent.children) {
      if (!child.path || child.path === "~external") {
        direct.push(child);
        continue;
      }
      const folder = child.path.split("/")[0];
      const siblings = folders.get(folder);
      if (siblings) siblings.push(child);
      else folders.set(folder, [child]);
    }
    for (const [folder, children] of folders) {
      if (children.length === 1 && children[0].path === folder) {
        direct.push({ ...children[0], name: folder });
        continue;
      }
      direct.push({
        id: `${parent.id}/directory:${folder}`,
        name: folder,
        path: folder,
        kind: "group",
        color: children[0].color,
        files: children.flatMap((child) => child.files),
        children,
      });
    }
    parent.children = direct;
  }
  if (parent.children.length > viewLimit) {
    const buckets = new Map<string, CelestialItem[]>();
    for (const child of parent.children) {
      const prefix = parent.path ? `${parent.path}/` : "";
      let relative = child.path;
      if (child.path === parent.path) relative = "";
      else if (child.path.startsWith(prefix))
        relative = child.path.slice(prefix.length);
      const parts = relative.split("/");
      const key = parts.length > 1 ? parts[0] : "";
      const bucket = buckets.get(key);
      if (bucket) bucket.push(child);
      else buckets.set(key, [child]);
    }
    const grouped: { name: string; path: string; children: CelestialItem[] }[] =
      [];
    if (buckets.size <= viewLimit && !buckets.has("")) {
      for (const [name, children] of buckets)
        grouped.push({
          name,
          path: parent.path ? `${parent.path}/${name}` : name,
          children,
        });
    } else {
      const sorted = [...parent.children].sort((a, b) =>
        a.path.localeCompare(b.path),
      );
      const size = Math.ceil(sorted.length / viewLimit);
      for (let start = 0; start < sorted.length; start += size) {
        const children = sorted.slice(start, start + size);
        grouped.push({
          name:
            children.length === 1
              ? children[0].name
              : `${children[0].name} +${children.length - 1} more`,
          path: parent.path,
          children,
        });
      }
    }
    parent.children = grouped.map((group, index) => ({
      id: `${parent.id}/group:${index}`,
      name: group.name,
      path: group.path,
      kind: "group",
      color: group.children[0].color,
      files: group.children.flatMap((child) => child.files),
      children: group.children,
    }));
  }
  for (const child of parent.children) {
    child.parentId = parent.id;
    boundChildren(child);
  }
}

export function createCelestialModel(
  graph: ProjectGraph,
  layout: WorldLayout,
): CelestialModel {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const root: CelestialItem = {
    id: "cosmos",
    name: graph.name,
    path: "",
    kind: "universe",
    color: "#a8c8ff",
    files: graph.nodes.map((node) => node.id),
    children: [],
  };
  const byPackage = new Map<string, WorldLayout["buildings"]>();
  const packageRegions = new Map(
    layout.regions
      .filter((region) => !region.parentId)
      .map((region) => [region.packageId, region.id]),
  );
  for (const building of layout.buildings) {
    const siblings = byPackage.get(building.packageId);
    if (siblings) siblings.push(building);
    else byPackage.set(building.packageId, [building]);
  }
  for (const pkg of graph.packages) {
    const buildings = byPackage.get(pkg.id) ?? [];
    if (!buildings.length) continue;
    const galaxy: CelestialItem = {
      id: `galaxy:${pkg.id}`,
      sourceId: packageRegions.get(pkg.id),
      name: pkg.name,
      path: pkg.directory,
      kind: "package",
      color: palette[buildings[0].kind],
      files: buildings.flatMap((building) =>
        building.nodes.map((node) => node.id),
      ),
      children: [],
    };
    root.children.push(galaxy);
    for (const building of buildings) {
      const system: CelestialItem = {
        id: `system:${building.id}`,
        sourceId: building.id,
        name: building.name,
        path: building.directory,
        kind: "building",
        color: palette[building.kind],
        files: building.nodes.map((node) => node.id),
        children: [],
      };
      galaxy.children.push(system);
      const directoryRooms = new Map<string, number>();
      for (const room of building.rooms)
        directoryRooms.set(
          room.directory,
          (directoryRooms.get(room.directory) ?? 0) + 1,
        );
      for (const room of building.rooms) {
        const firstFile = nodes.get(room.nodeIds[0])?.name ?? "";
        const lastFile = nodes.get(room.nodeIds.at(-1)!)?.name ?? "";
        const roomName =
          (directoryRooms.get(room.directory) ?? 0) > 1
            ? `${room.name} · ${firstFile} … ${lastFile}`
            : room.name;
        const planet: CelestialItem = {
          id: `planet:${room.id}`,
          sourceId: room.id,
          name: roomName,
          path: room.directory,
          kind: "room",
          color: palette[building.kind],
          files: room.nodeIds,
          children: [],
        };
        system.children.push(planet);
        for (const id of room.nodeIds) {
          const node = nodes.get(id);
          if (!node) throw new Error(`Unknown celestial file ${id}`);
          planet.children.push({
            id: `moon:${id}`,
            sourceId: id,
            name: node.name,
            path: id,
            kind: "file",
            color: palette[node.kind],
            files: [id],
            children: [],
          });
        }
      }
    }
  }
  boundChildren(root);
  const items = new Map<string, CelestialItem>();
  const sources = new Map<string, CelestialItem>();
  const visit = (item: CelestialItem) => {
    items.set(item.id, item);
    if (item.sourceId) sources.set(item.sourceId, item);
    for (const child of item.children) visit(child);
  };
  visit(root);
  return { root, items, sources };
}

export interface CelestialEdge {
  source: string;
  target: string;
  weight: number;
}
export function celestialEdges(
  graph: ProjectGraph,
  visible: CelestialItem[],
): CelestialEdge[] {
  const owners = new Map<string, string>();
  for (const item of visible)
    for (const file of item.files) owners.set(file, item.id);
  const edges = new Map<string, CelestialEdge>();
  for (const edge of graph.edges) {
    const source = owners.get(edge.source),
      target = owners.get(edge.target);
    if (!source || !target || source === target) continue;
    const key = `${source}\0${target}`;
    const prior = edges.get(key);
    if (prior) prior.weight++;
    else edges.set(key, { source, target, weight: 1 });
  }
  return [...edges.values()]
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        a.source.localeCompare(b.source) ||
        a.target.localeCompare(b.target),
    )
    .slice(0, 120);
}

export function celestialPositions(
  items: CelestialItem[],
): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>();
  items.forEach((item, index) => {
    const seed = random(hash(item.id));
    const angle = index * 2.39996323 + seed() * 0.2;
    const radius = items.length === 1 ? 0 : 46 + Math.sqrt(index) * 47;
    positions.set(
      item.id,
      new THREE.Vector3(
        Math.cos(angle) * radius,
        (seed() - 0.5) * 12,
        Math.sin(angle) * radius * 0.7,
      ),
    );
  });
  return positions;
}

export interface CelestialPlace {
  point: THREE.Vector3;
  span: number;
}

export function createCelestialSpace(
  model: CelestialModel,
  aspect = 1.6,
): Map<string, CelestialPlace> {
  const places = new Map<string, CelestialPlace>();
  const visit = (item: CelestialItem, point: THREE.Vector3, span: number) => {
    places.set(item.id, { point, span });
    item.children.forEach((child, index) => {
      const seed = random(hash(child.id));
      const angle = index * 2.39996323 + seed() * 0.4;
      const radius =
        span * (0.32 + 0.38 * Math.sqrt((index + 1) / item.children.length));
      const stretch = item.kind === "universe" ? Math.max(0.7, aspect) : 1;
      const offset = new THREE.Vector3(
        Math.cos(angle) * radius * stretch,
        (seed() - 0.5) * span * 0.025,
        Math.sin(angle) * radius * 0.76,
      );
      visit(child, point.clone().add(offset), span * 0.16);
    });
  };
  visit(model.root, new THREE.Vector3(), 1400);
  return places;
}

export function celestialContext(
  model: CelestialModel,
  current: CelestialItem,
): CelestialItem[] {
  const visible = new Map<string, CelestialItem>();
  let branch: CelestialItem | undefined = current;
  while (branch) {
    if (branch.kind !== "universe") visible.set(branch.id, branch);
    for (const child of branch.children) visible.set(child.id, child);
    branch = branch.parentId ? model.items.get(branch.parentId) : undefined;
  }
  // Nearby systems reveal their planets before the camera arrives.
  for (const child of current.children)
    for (const grandchild of child.children.slice(0, 3)) {
      if (visible.size >= 160) break;
      visible.set(grandchild.id, grandchild);
    }
  return [...visible.values()];
}

export function orbitalPositions(
  model: CelestialModel,
  initial: Map<string, CelestialPlace>,
  ids: Iterable<string>,
  seconds: number,
): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>();
  const speeds: Record<CelestialKind, number> = {
    universe: 0,
    package: 0.003,
    building: 0.01,
    room: 0.025,
    file: 0.055,
    group: 0.008,
  };
  const visit = (id: string): THREE.Vector3 => {
    const cached = positions.get(id);
    if (cached) return cached;
    const item = model.items.get(id)!;
    const origin = initial.get(id)!.point;
    let point = origin.clone();
    if (item.parentId) {
      const parent = visit(item.parentId);
      const offset = origin.clone().sub(initial.get(item.parentId)!.point);
      const angle =
        seconds * speeds[item.kind] * (0.85 + (hash(id) % 30) / 100);
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      point = parent
        .clone()
        .add(
          new THREE.Vector3(
            offset.x * cos - (offset.z / 0.76) * sin,
            offset.y,
            (offset.x * sin + (offset.z / 0.76) * cos) * 0.76,
          ),
        );
    }
    positions.set(id, point);
    return point;
  };
  for (const id of ids) visit(id);
  return positions;
}

interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface LabelPoint {
  x: number;
  y: number;
  width?: number;
  height?: number;
}
export function placeCelestialLabels(
  points: LabelPoint[],
  width: number,
  height: number,
): LabelRect[] {
  const gap = 6;
  const dimensions = points.map((point) => ({
    width: point.width ?? (width <= 600 ? 120 : 158),
    height: point.height ?? 40,
  }));
  const top = 200;
  const overlaps = (a: LabelRect, b: LabelRect) =>
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y;
  const placed: LabelRect[] = [];
  for (const [index, point] of points.entries()) {
    const size = dimensions[index];
    const offsets = [
      [0, 22],
      [0, -size.height - 22],
      [size.width + gap, 0],
      [-size.width - gap, 0],
    ];
    const candidate = offsets
      .map(([dx, dy]) => ({
        x: Math.max(
          12,
          Math.min(point.x - size.width / 2 + dx, width - 12 - size.width),
        ),
        y: Math.max(top, Math.min(point.y + dy, height - 90 - size.height)),
        ...size,
      }))
      .find((rect) => !placed.some((prior) => overlaps(rect, prior)));
    if (!candidate) break;
    placed.push(candidate);
  }
  if (placed.length === points.length) return placed;
  const widest = Math.max(...dimensions.map((size) => size.width));
  const tallest = Math.max(...dimensions.map((size) => size.height));
  const columns = Math.max(1, Math.floor((width - 24 + gap) / (widest + gap)));
  const rows = Math.ceil(points.length / columns);
  const cellWidth = (width - 24) / columns;
  const cellHeight = Math.max(tallest + gap, (height - top - 90) / rows);
  const slots: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++)
      slots.push({
        x: 12 + (column + 0.5) * cellWidth,
        y: top + row * cellHeight,
      });
  return points.map((point, index) => {
    let best = 0,
      distance = Infinity;
    slots.forEach((slot, candidate) => {
      const next = (slot.x - point.x) ** 2 + (slot.y - point.y - 22) ** 2;
      if (next < distance) {
        best = candidate;
        distance = next;
      }
    });
    const slot = slots.splice(best, 1)[0];
    return {
      x: slot.x - dimensions[index].width / 2,
      y: slot.y,
      ...dimensions[index],
    };
  });
}

export class CelestialLabelLayout {
  private offsets = new Map<
    string,
    { x: number; y: number; targetX: number; targetY: number; width: number }
  >();
  private previousTime?: number;
  private lastMotion = 0;
  private pending = true;
  private viewport = "";
  private membership = "";
  update(
    points: (LabelPoint & { id: string })[],
    width: number,
    height: number,
    time: number,
    moving: boolean,
  ): LabelRect[] {
    const dt = Math.min(0.05, Math.max(0, time - (this.previousTime ?? time)));
    this.previousTime = time;
    const viewport = `${width}:${height}`;
    const membership = points.map((point) => point.id).join("\0");
    if (
      moving ||
      viewport !== this.viewport ||
      membership !== this.membership
    ) {
      this.lastMotion = time;
      this.pending = true;
    }
    this.viewport = viewport;
    this.membership = membership;
    for (const point of points) {
      const labelWidth = point.width ?? (width <= 600 ? 120 : 158);
      const offset = this.offsets.get(point.id);
      if (offset) {
        const change = (labelWidth - offset.width) / 2;
        offset.x -= change;
        offset.targetX -= change;
        offset.width = labelWidth;
      } else
        this.offsets.set(point.id, {
          x: -labelWidth / 2,
          y: 22,
          targetX: -labelWidth / 2,
          targetY: 22,
          width: labelWidth,
        });
    }
    if (this.pending && !moving && time - this.lastMotion >= 0.2) {
      const rectangles = placeCelestialLabels(points, width, height);
      points.forEach((point, index) => {
        const offset = this.offsets.get(point.id)!;
        offset.targetX = rectangles[index].x - point.x;
        offset.targetY = rectangles[index].y - point.y;
      });
      this.pending = false;
    }
    return points.map((point) => {
      const offset = this.offsets.get(point.id)!;
      if (!moving) {
        const dx = offset.targetX - offset.x,
          dy = offset.targetY - offset.y;
        const distance = Math.hypot(dx, dy);
        const step = Math.min(
          1 - Math.exp(-dt * 10),
          (dt * 240) / Math.max(1, distance),
        );
        offset.x += dx * step;
        offset.y += dy * step;
      }
      return {
        x: point.x + offset.x,
        y: point.y + offset.y,
        width: offset.width,
        height: point.height ?? 40,
      };
    });
  }
}

const kindName: Record<CelestialKind, string> = {
  universe: "Dependency universe",
  package: "Package galaxy",
  building: "Building system",
  room: "Room planet",
  file: "File moon",
  group: "Directory group",
};
interface CelestialHooks {
  select: (id: string) => void;
  navigate: (point: THREE.Vector3, radius: number) => void;
}
interface RenderedItem {
  item: CelestialItem;
  point: THREE.Vector3;
  button: HTMLButtonElement;
  leader: SVGLineElement;
  width: number;
}
interface Connection {
  edge: CelestialEdge;
  curve: THREE.QuadraticBezierCurve3;
}

export class ConstellationMap {
  readonly scene = new THREE.Scene();
  readonly sky = new THREE.Group();
  readonly model: CelestialModel;
  private objects = new THREE.Group();
  private bodies = new Map<string, THREE.Group>();
  private places: Map<string, CelestialPlace>;
  private initialPlaces: Map<string, CelestialPlace>;
  private orbitTime = 0;
  private orbits = new Map<string, THREE.Object3D>();
  private links = new THREE.Group();
  private emphasis = new THREE.Group();
  private pickables: THREE.Object3D[] = [];
  private skyPickables: THREE.Object3D[] = [];
  private ui = document.createElement("section");
  private nav = document.createElement("nav");
  private title = document.createElement("h2");
  private subtitle = document.createElement("p");
  private labelLayer = document.createElement("div");
  private leaders = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  private tooltip = document.createElement("div");
  private rendered: RenderedItem[] = [];
  private labelLayout = new CelestialLabelLayout();
  private labelMeasure: CanvasRenderingContext2D;
  private labelMeasurementsDirty = true;
  private labelViewport = 0;
  private labelCameraReady = false;
  private labelCameraPosition = new THREE.Vector3();
  private labelCameraRotation = new THREE.Quaternion();
  private connections: Connection[] = [];
  private particles?: THREE.Points;
  private current: CelestialItem;
  private focused?: string;
  private hovered?: string;
  private projected = new THREE.Vector3();
  private glow: THREE.CanvasTexture;
  private radius = 160;
  constructor(
    private graph: ProjectGraph,
    layout: WorldLayout,
    private container: HTMLElement,
    private hooks: CelestialHooks,
  ) {
    this.model = createCelestialModel(graph, layout);
    this.places = createCelestialSpace(
      this.model,
      container.clientWidth / Math.max(1, container.clientHeight),
    );
    this.initialPlaces = new Map(
      [...this.places].map(([id, place]) => [
        id,
        { point: place.point.clone(), span: place.span },
      ]),
    );
    this.current = this.model.root;
    this.scene.background = new THREE.Color("#050a16");
    this.scene.add(this.objects, this.links, this.emphasis);
    this.scene.add(new THREE.AmbientLight("#b6c9ed", 1.1));
    const sunlight = new THREE.DirectionalLight("#fff0d4", 3);
    sunlight.position.set(-2, 4, 3);
    this.scene.add(sunlight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d")!;
    this.labelMeasure = context;
    document.fonts?.ready.then(() => {
      this.labelMeasurementsDirty = true;
    });
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "#ffffffaa");
    gradient.addColorStop(0.16, "#ffffff66");
    gradient.addColorStop(0.5, "#ffffff16");
    gradient.addColorStop(1, "#ffffff00");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    this.glow = new THREE.CanvasTexture(canvas);
    this.ui.className = "celestial-ui";
    this.ui.hidden = true;
    this.ui.setAttribute("aria-label", "Celestial navigation");
    this.nav.setAttribute("aria-label", "Constellation breadcrumb");
    this.labelLayer.className = "celestial-labels";
    this.leaders.classList.add("celestial-leaders");
    const heading = document.createElement("div");
    heading.className = "celestial-heading";
    heading.append(this.nav, this.title, this.subtitle);
    this.ui.append(this.leaders, heading, this.labelLayer);
    this.tooltip.className = "celestial-tooltip";
    this.tooltip.hidden = true;
    container.append(this.ui, this.tooltip);
    const positions = celestialPositions(this.model.root.children);
    const extent = Math.max(layout.width, layout.depth);
    const scale = Math.max(0.6, extent / 700);
    const height = Math.max(100, extent * 0.25);
    for (const item of this.model.root.children) {
      const point = positions.get(item.id)!.clone().multiplyScalar(scale);
      point.y = height + (hash(item.id) % 30);
      this.addBody(
        item,
        point,
        this.sky,
        this.skyPickables,
        Math.max(1, scale * 0.65),
      );
    }
  }
  private addBody(
    item: CelestialItem,
    point: THREE.Vector3,
    group: THREE.Group,
    pickables: THREE.Object3D[],
    scale = 1,
  ) {
    const radius = item.kind === "file" ? 3 : 7;
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(radius * scale, 24, 16),
      new THREE.MeshStandardMaterial({
        color: item.color,
        roughness: 0.78,
        emissive: item.color,
        emissiveIntensity:
          item.kind === "building" || item.kind === "package" ? 0.8 : 0.08,
      }),
    );
    body.position.copy(point);
    body.userData.celestialId = item.id;
    group.add(body);
    pickables.push(body);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color: item.color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.position.copy(point);
    halo.scale.setScalar(radius * scale * 9);
    group.add(halo);
    const segments: number[] = [];
    if (item.kind === "package" || item.kind === "group") {
      const phase = (hash(item.id) % 100) / 100;
      for (let arm = 0; arm < 3; arm++)
        for (let step = 0; step < 42; step++) {
          for (const t of [step / 42, (step + 1) / 42]) {
            const angle = (arm * Math.PI * 2) / 3 + t * 5 + phase;
            const r = (4 + t * 29) * scale;
            segments.push(
              point.x + Math.cos(angle) * r,
              point.y + Math.sin(t * Math.PI) * 2 * scale,
              point.z + Math.sin(angle) * r * 0.65,
            );
          }
        }
    }
    if (segments.length) group.add(lineGeometry(segments, item.color, 0.38));
  }
  private clear(group: THREE.Object3D) {
    group.traverse((object) => {
      if (object instanceof THREE.Sprite) object.material.dispose();
    });
    disposeGroup(group);
  }
  activate(active: boolean) {
    this.ui.hidden = !active;
    this.tooltip.hidden = true;
  }
  entryView(id = this.current.id): CelestialPlace {
    const item =
      this.model.items.get(id) ?? this.model.sources.get(id) ?? this.current;
    this.synchronizePlaces([item.id]);
    const place = this.places.get(item.id)!;
    return { point: place.point.clone(), span: place.span };
  }
  open(id = this.current.id, collapse = false) {
    let item = this.model.items.get(id) ?? this.model.sources.get(id);
    if (!item) return;
    if (item.kind === "file") {
      this.focus(item.sourceId!);
      return;
    }
    while (
      collapse &&
      item.children.length === 1 &&
      (item.children[0].kind === "building" ||
        item.children[0].kind === "group")
    )
      item = item.children[0];
    this.current = item;
    this.focused = undefined;
    this.hovered = undefined;
    this.clear(this.links);
    this.clear(this.emphasis);
    this.pickables = [];
    this.labelLayer.replaceChildren();
    this.leaders.replaceChildren();
    this.rendered = [];
    this.labelLayout = new CelestialLabelLayout();
    this.labelCameraReady = false;
    const context = celestialContext(this.model, item);
    this.synchronizePlaces(context.map((child) => child.id));
    const place = this.places.get(item.id)!;
    const aspect =
      this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.radius = place.span * 0.85;
    const active = new Set(context.map((child) => child.id));
    for (const [id, body] of this.bodies) {
      if (active.has(id)) continue;
      this.clear(body);
      this.objects.remove(body);
      this.bodies.delete(id);
      this.orbits.delete(id);
    }
    for (const child of context) {
      let body = this.bodies.get(child.id);
      if (!body) {
        body = new THREE.Group();
        const childPlace = this.initialPlaces.get(child.id)!;
        this.addBody(
          child,
          childPlace.point,
          body,
          [],
          childPlace.span * 0.012,
        );
        if (child.parentId && child.parentId !== this.model.root.id) {
          const parent = this.initialPlaces.get(child.parentId)!;
          const offset = childPlace.point.clone().sub(parent.point);
          const radius = Math.hypot(offset.x, offset.z / 0.76);
          const segments: number[] = [];
          for (let step = 0; step < 96; step++)
            for (const t of [step / 96, (step + 1) / 96]) {
              const angle = t * Math.PI * 2;
              segments.push(
                parent.point.x + Math.cos(angle) * radius,
                childPlace.point.y,
                parent.point.z + Math.sin(angle) * radius * 0.76,
              );
            }
          const orbit = lineGeometry(segments, child.color, 0.12);
          body.add(orbit);
          this.orbits.set(child.id, orbit);
        }
        this.objects.add(body);
        this.bodies.set(child.id, body);
      }
      body.traverse((object) => {
        if (object.userData.celestialId) this.pickables.push(object);
      });
    }
    const labeled =
      item.kind === "universe" ? item.children : [item, ...item.children];
    for (const child of labeled) {
      const point = this.places.get(child.id)!.point;
      const offset = point.clone().sub(place.point);
      this.radius = Math.max(
        this.radius,
        Math.abs(offset.z) + place.span * 0.12,
        (Math.abs(offset.x) + place.span * 0.12) / aspect,
      );
      const button = document.createElement("button");
      button.className = "celestial-label";
      button.style.setProperty("--celestial-color", child.color);
      button.title = `${child.name}
${child.path || child.name} · ${kindName[child.kind]}`;
      button.setAttribute(
        "aria-label",
        `${child.kind === "file" ? "Inspect" : "Explore"} ${child.name}`,
      );
      const name = document.createElement("strong");
      name.textContent = child.name;
      const category = document.createElement("span");
      category.textContent =
        child === item
          ? `${kindName[child.kind]} · You are here`
          : kindName[child.kind];
      button.append(name, category);
      button.onclick = () =>
        child === item && item.parentId
          ? this.open(item.parentId)
          : this.select(child.id);
      button.onmouseenter = () => this.emphasize(child.id);
      button.onmouseleave = () => this.emphasize(this.focused);
      this.labelLayer.append(button);
      const leader = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      leader.setAttribute("stroke", child.color);
      this.leaders.append(leader);
      this.rendered.push({
        item: child,
        point,
        button,
        leader,
        width: this.labelWidth(child.name),
      });
    }
    this.connections = celestialEdges(this.graph, item.children).map((edge) => {
      const start = this.places.get(edge.source)!.point,
        end = this.places.get(edge.target)!.point;
      const control = start.clone().lerp(end, 0.5);
      control.y += place.span * 0.035;
      const side = end
        .clone()
        .sub(start)
        .cross(new THREE.Vector3(0, 1, 0))
        .normalize()
        .multiplyScalar(place.span * 0.025);
      control.add(side);
      return {
        edge,
        curve: new THREE.QuadraticBezierCurve3(start, control, end),
      };
    });
    this.moveOrbits(0);
    const segments = this.connectionSegments(this.connections);
    this.links.add(lineGeometry(segments, "#7ea6c7", 0.16));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        new Float32Array(this.connections.length * 3),
        3,
      ),
    );
    this.particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: "#a9dfd9",
        size: 2,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.links.add(this.particles);
    this.updateNavigation();
    this.hooks.navigate(place.point, this.radius);
  }
  private connectionSegments(connections: Connection[]) {
    const segments: number[] = [];
    for (const { curve } of connections) {
      const points = curve.getPoints(20);
      for (let i = 1; i < points.length; i++)
        segments.push(...points[i - 1].toArray(), ...points[i].toArray());
      const tip = curve.getPoint(0.88),
        tangent = curve.getTangent(0.88).normalize();
      const side = tangent
        .clone()
        .cross(new THREE.Vector3(0, 1, 0))
        .normalize()
        .multiplyScalar(curve.v0.distanceTo(curve.v2) * 0.018);
      const back = tip
        .clone()
        .addScaledVector(tangent, -curve.v0.distanceTo(curve.v2) * 0.035);
      segments.push(
        ...tip.toArray(),
        ...back.clone().add(side).toArray(),
        ...tip.toArray(),
        ...back.sub(side).toArray(),
      );
    }
    return segments;
  }
  private updateNavigation() {
    this.nav.replaceChildren();
    const ancestors: CelestialItem[] = [];
    let item: CelestialItem | undefined = this.current;
    while (item) {
      ancestors.unshift(item);
      item = item.parentId ? this.model.items.get(item.parentId) : undefined;
    }
    if (this.current.parentId) {
      const back = document.createElement("button");
      back.textContent = "← Back";
      back.onclick = () => this.open(this.current.parentId);
      this.nav.append(back);
    }
    for (const ancestor of ancestors) {
      const button = document.createElement("button");
      button.textContent =
        ancestor.kind === "universe" ? "Universe" : ancestor.name;
      button.setAttribute(
        "aria-current",
        ancestor === this.current ? "page" : "false",
      );
      button.onclick = () => this.open(ancestor.id);
      this.nav.append(button);
    }
    this.title.textContent = this.current.name;
    this.subtitle.textContent =
      this.current.kind === "universe"
        ? "Packages become galaxies. Follow one inward."
        : `${kindName[this.current.kind]} · ${this.current.path || this.current.name}`;
  }
  select(id: string) {
    const item = this.model.items.get(id);
    if (!item) return;
    if (item.kind === "file") {
      this.focused = id;
      this.emphasize(id);
      this.hooks.select(item.sourceId!);
    } else this.open(id, true);
  }
  focus(sourceId: string) {
    const item = this.model.sources.get(sourceId);
    if (!item) return;
    if (item.kind !== "file") {
      this.open(item.id);
      return;
    }
    if (this.current.id !== item.parentId) this.open(item.parentId);
    this.focused = item.id;
    this.emphasize(item.id);
  }
  reset() {
    this.open(this.model.root.id);
  }
  followCamera(camera: THREE.Camera, target: THREE.Vector3) {
    if (this.ui.hidden) return;
    const distance = camera.position.distanceTo(target);
    if (this.current.parentId && distance > this.radius * 3.7) {
      this.open(this.current.parentId);
      return;
    }
    for (const child of this.current.children) {
      if (!child.children.length) continue;
      const place = this.places.get(child.id)!;
      if (
        distance < place.span * 4 &&
        target.distanceTo(place.point) < place.span * 2
      ) {
        this.open(child.id, true);
        return;
      }
    }
  }
  clearSelection() {
    this.focused = undefined;
    this.emphasize();
  }
  private synchronizePlaces(ids: Iterable<string>) {
    const positions = orbitalPositions(
      this.model,
      this.initialPlaces,
      ids,
      this.orbitTime,
    );
    for (const [id, point] of positions) this.places.get(id)!.point.copy(point);
  }
  moveOrbits(dt: number): THREE.Vector3 {
    this.orbitTime += dt;
    const previous = this.places.get(this.current.id)!.point.clone();
    this.synchronizePlaces(this.bodies.keys());
    for (const [id, body] of this.bodies) {
      const point = this.places.get(id)!.point;
      body.position.copy(point).sub(this.initialPlaces.get(id)!.point);
      body.children[0].rotation.y = this.orbitTime * 0.06;
      const parentId = this.model.items.get(id)!.parentId;
      const orbit = this.orbits.get(id);
      if (orbit && parentId)
        orbit.position
          .copy(this.places.get(parentId)!.point)
          .sub(this.initialPlaces.get(parentId)!.point)
          .sub(body.position);
    }
    const span = this.places.get(this.current.id)!.span;
    for (const { curve } of this.connections) {
      curve.v1.copy(curve.v0).lerp(curve.v2, 0.5);
      curve.v1.y += span * 0.035;
      const side = curve.v2
        .clone()
        .sub(curve.v0)
        .cross(new THREE.Vector3(0, 1, 0))
        .normalize();
      curve.v1.addScaledVector(side, span * 0.025);
    }
    const updateLines = (group: THREE.Group, connections: Connection[]) => {
      const line = group.children[0];
      if (!(line instanceof THREE.LineSegments)) return;
      const attribute = line.geometry.getAttribute("position");
      attribute.array.set(this.connectionSegments(connections));
      attribute.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    };
    updateLines(this.links, this.connections);
    updateLines(
      this.emphasis,
      this.connections.filter(
        ({ edge }) =>
          edge.source === this.hovered || edge.target === this.hovered,
      ),
    );
    this.objects.updateMatrixWorld(true);
    return this.places.get(this.current.id)!.point.clone().sub(previous);
  }
  private emphasize(id?: string) {
    this.hovered = id;
    disposeGroup(this.emphasis);
    if (!id) return;
    const connections = this.connections.filter(
      ({ edge }) => edge.source === id || edge.target === id,
    );
    this.emphasis.add(
      lineGeometry(this.connectionSegments(connections), "#c6f8b0", 0.8),
    );
  }
  pick(raycaster: THREE.Raycaster, sky = false): string | undefined {
    const hit = raycaster.intersectObjects(
      sky ? this.skyPickables : this.pickables,
    )[0];
    const id: unknown = hit?.object.userData.celestialId;
    return typeof id === "string" ? id : undefined;
  }
  hover(id: string | undefined, x: number, y: number, sky: boolean) {
    const emphasis = id ?? this.focused;
    if (!sky && x >= 0 && emphasis !== this.hovered) this.emphasize(emphasis);
    const item = id ? this.model.items.get(id) : undefined;
    this.tooltip.hidden = !item || x < 0;
    if (!item) return;
    this.tooltip.textContent = `${item.path || item.name} · ${kindName[item.kind]}`;
    this.tooltip.style.left = `${Math.max(12, Math.min(x + 18, innerWidth - 330))}px`;
    this.tooltip.style.top = `${Math.min(y + 18, innerHeight - 110)}px`;
  }
  private labelWidth(name: string) {
    this.labelMeasure.font = '500 12px "DM Sans Variable"';
    return Math.ceil(
      Math.min(
        Math.max(140, this.labelMeasure.measureText(name).width + 22),
        Math.min(360, this.container.clientWidth - 24),
      ),
    );
  }
  update(
    camera: THREE.Camera,
    width: number,
    height: number,
    time: number,
    routes: boolean,
  ) {
    this.links.visible = routes;
    this.emphasis.visible = routes;
    if (this.ui.hidden) return;
    if (this.labelMeasurementsDirty || width !== this.labelViewport) {
      for (const rendered of this.rendered)
        rendered.width = this.labelWidth(rendered.item.name);
      this.labelMeasurementsDirty = false;
      this.labelViewport = width;
    }
    const relativeCamera = camera.position
      .clone()
      .sub(this.places.get(this.current.id)!.point);
    const moving =
      !this.labelCameraReady ||
      this.labelCameraPosition.distanceTo(relativeCamera) >
        this.radius * 0.0008 ||
      this.labelCameraRotation.angleTo(camera.quaternion) > 0.0008;
    this.labelCameraPosition.copy(relativeCamera);
    this.labelCameraRotation.copy(camera.quaternion);
    this.labelCameraReady = true;
    this.labelLayer.style.opacity = moving ? "0" : "1";
    this.leaders.style.opacity = moving ? "0" : "1";
    const attribute = this.particles?.geometry.getAttribute("position");
    if (attribute)
      this.connections.forEach(({ curve, edge }, index) => {
        const point = curve.getPoint(
          (time * 0.13 + (hash(edge.source + edge.target) % 100) / 100) % 1,
        );
        attribute.setXYZ(index, point.x, point.y, point.z);
      });
    if (attribute) attribute.needsUpdate = true;
    const visible = this.rendered.flatMap((rendered) => {
      this.projected.copy(rendered.point).project(camera);
      const x = (this.projected.x * 0.5 + 0.5) * width;
      const y = (-this.projected.y * 0.5 + 0.5) * height;
      const hidden =
        this.projected.z < -1 ||
        this.projected.z > 1 ||
        x < -20 ||
        x > width + 20 ||
        y < 75 ||
        y > height - 55;
      rendered.button.hidden = hidden;
      rendered.leader.style.display = hidden ? "none" : "";
      return hidden ? [] : [{ rendered, x, y }];
    });
    const placements = this.labelLayout.update(
      visible.map(({ rendered, x, y }) => ({
        id: rendered.item.id,
        x,
        y,
        width: rendered.width,
        height: 40,
      })),
      width,
      height,
      time,
      moving,
    );
    visible.forEach(({ rendered, x, y }, index) => {
      const rect = placements[index];
      rendered.button.style.width = `${rect.width}px`;
      rendered.button.style.height = `${rect.height}px`;
      rendered.button.style.transform = `translate(${rect.x}px,${rect.y}px)`;
      rendered.button.classList.toggle(
        "selected",
        rendered.item.id === this.focused || rendered.item.id === this.hovered,
      );
      rendered.leader.setAttribute("x1", String(x));
      rendered.leader.setAttribute("y1", String(y));
      rendered.leader.setAttribute(
        "x2",
        String(Math.max(rect.x, Math.min(x, rect.x + rect.width))),
      );
      rendered.leader.setAttribute(
        "y2",
        String(Math.max(rect.y, Math.min(y, rect.y + rect.height))),
      );
    });
  }
  dispose() {
    this.clear(this.scene);
    this.clear(this.sky);
    this.glow.dispose();
    this.ui.remove();
    this.tooltip.remove();
  }
}
