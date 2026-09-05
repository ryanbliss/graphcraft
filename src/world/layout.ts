import {
  hash,
  type ProjectGraph,
  type GraphNode,
  type FileKind,
} from "../graph/types.ts";
import { measureRoom, planRoom } from "./room-plan.ts";
import type { CyberFurnitureKind } from "./cyber-furniture.ts";
import type { ExtraFurnitureKind } from "./extra-furniture.ts";
import { minimumStairDepth } from "./stairs.ts";
export const palette: Record<FileKind, string> = {
  component: "#66ead4",
  module: "#9db6cf",
  service: "#f3bc68",
  schema: "#bd99ff",
  test: "#f584ba",
  config: "#b9d784",
  external: "#779dfa",
};
export interface Building {
  id: string;
  name: string;
  directory: string;
  parentId: string;
  packageId: string;
  nodes: GraphNode[];
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  stories: number;
  hallX: number;
  template: "studio" | "townhouse" | "workshop" | "atrium";
  rooms: Room[];
  kind: FileKind;
}
export interface Room {
  id: string;
  directory: string;
  name: string;
  nodeIds: string[];
  floorY: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  side: "left" | "right";
  door: { x: number; z: number; rotation: number };
}
export interface District {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
}
export interface Region {
  id: string;
  parentId?: string;
  packageId: string;
  directory: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  level: number;
}
export interface Entrance {
  id: string;
  x: number;
  z: number;
}
export interface NavigationPath {
  source: string;
  target: string;
  points: { x: number; z: number }[];
}
export interface NodePosition {
  x: number;
  y: number;
  z: number;
  floorY: number;
  rotation: number;
  furniture: FurnitureKind;
  buildingId: string;
}
export type FurnitureKind =
  | CyberFurnitureKind
  | ExtraFurnitureKind
  | "bed"
  | "sofa"
  | "armchair"
  | "desk"
  | "table"
  | "stool"
  | "lamp"
  | "bookshelf"
  | "wardrobe"
  | "painting"
  | "terminal"
  | "planter"
  | "cabinet"
  | "workbench";
export interface WorldLayout {
  buildings: Building[];
  districts: District[];
  regions: Region[];
  paths: NavigationPath[];
  positions: Map<string, NodePosition>;
  width: number;
  depth: number;
  spawn: { x: number; z: number };
}
export function random(seed: number): () => number {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
interface Rectangle {
  width: number;
  depth: number;
}
interface Placement<T> {
  item: T;
  x: number;
  z: number;
  aisleZ: number;
}
function pack<T extends Rectangle>(
  items: T[],
  padding = 3,
  gap = 6,
): { width: number; depth: number; placements: Placement<T>[] } {
  if (!items.length) return { width: 24, depth: 24, placements: [] };
  const area = items.reduce(
    (sum, item) => sum + (item.width + gap) * (item.depth + gap),
    0,
  );
  // Similar depths share rows; a few widths avoid large empty shelves.
  const ordered = [...items].sort((a, b) => b.depth - a.depth),
    minimumWidth = Math.max(...items.map((item) => item.width)),
    side = Math.sqrt(area);
  function arrange(limit: number) {
    const rows: { items: T[]; width: number; depth: number }[] = [];
    for (const item of ordered) {
      const row = rows.find((row) => row.width + gap + item.width <= limit);
      if (row) {
        row.items.push(item);
        row.width += gap + item.width;
      } else rows.push({ items: [item], width: item.width, depth: item.depth });
    }
    const placements: Placement<T>[] = [];
    let z = padding;
    let width = 0;
    for (const row of rows) {
      let x = padding;
      const aisleZ = z + row.depth + gap / 2;
      for (const item of row.items) {
        placements.push({ item, x, z: z + row.depth - item.depth, aisleZ });
        x += item.width + gap;
      }
      width = Math.max(width, row.width);
      z += row.depth + gap;
    }
    return {
      width: width + padding * 2 + 6,
      depth: z - gap + padding + 6,
      placements,
    };
  }
  const score = (result: Rectangle) =>
    result.width * result.depth + 0.2 * (result.width - result.depth) ** 2;
  let best = arrange(Math.max(minimumWidth, side));
  for (const factor of [0.6, 0.75, 0.9, 1.1, 1.25, 1.5, 1.75]) {
    const candidate = arrange(Math.max(minimumWidth, side * factor));
    if (score(candidate) < score(best)) best = candidate;
  }
  return best;
}
interface DirectoryTree extends Rectangle {
  path: string;
  directNodes: GraphNode[];
  nodeCount: number;
  children: Map<string, DirectoryTree>;
  building?: Building;
  placements: Placement<DirectoryTree | Building>[];
}
function directoryTree(path: string): DirectoryTree {
  return {
    path,
    directNodes: [],
    nodeCount: 0,
    children: new Map(),
    width: 0,
    depth: 0,
    placements: [],
  };
}
function regionId(packageId: string, directory: string): string {
  return `region:${packageId}:${directory}`;
}
export function layoutWorld(graph: ProjectGraph): WorldLayout {
  const nodesByDirectory = new Map<string, GraphNode[]>();
  for (const node of graph.nodes) {
    const key = `${node.packageId}:${node.directory || "."}`;
    const existing = nodesByDirectory.get(key);
    if (existing) existing.push(node);
    else nodesByDirectory.set(key, [node]);
  }
  const roots = new Map<string, DirectoryTree>(),
    packages = new Map(graph.packages.map((pkg) => [pkg.id, pkg]));
  for (const [, nodes] of [...nodesByDirectory].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    nodes.sort((a, b) => a.id.localeCompare(b.id));
    const pkg = packages.get(nodes[0].packageId);
    if (!pkg) throw new Error(`No package boundary found for ${nodes[0].id}`);
    let root = roots.get(pkg.id);
    if (!root) {
      root = directoryTree(pkg.directory);
      roots.set(pkg.id, root);
    }
    let relative = nodes[0].directory;
    if (pkg.directory)
      relative = relative.slice(pkg.directory.length).replace(/^\//, "");
    let tree = root,
      path = pkg.directory;
    for (const segment of relative.split("/").filter(Boolean)) {
      path = path ? `${path}/${segment}` : segment;
      let child = tree.children.get(segment);
      if (!child) {
        child = directoryTree(path);
        tree.children.set(segment, child);
      }
      tree = child;
    }
    tree.directNodes = nodes;
  }
  function countNodes(tree: DirectoryTree): number {
    tree.nodeCount = tree.directNodes.length;
    for (const child of tree.children.values())
      tree.nodeCount += countNodes(child);
    return tree.nodeCount;
  }
  function makeBuilding(
    tree: DirectoryTree,
    packageId: string,
    nodes: GraphNode[],
  ): Building {
    const id = `${packageId}:${tree.path || "."}`,
      roomDirectories = new Map<string, GraphNode[]>();
    nodes.sort((a, b) => a.id.localeCompare(b.id));
    for (const node of nodes) {
      const existing = roomDirectories.get(node.directory);
      if (existing) existing.push(node);
      else roomDirectories.set(node.directory, [node]);
    }
    const rooms: Room[] = [];
    for (const [directory, files] of [...roomDirectories].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      for (let start = 0; start < files.length; start += 12)
        rooms.push({
          id: `room:${id}:${directory}:${start / 12}`,
          directory,
          name: directory.split("/").pop() || graph.name,
          nodeIds: files.slice(start, start + 12).map((node) => node.id),
          floorY: 0,
          x: 0,
          z: 0,
          width: 9,
          depth: 8,
          side: "left",
          door: { x: 0, z: 0, rotation: 0 },
        });
    }
    // The source path chooses a repeatable footprint, independent of scan order.
    const profiles = [
      { targetRooms: 1, maxStories: 12, narrow: true },
      { targetRooms: 6, maxStories: 4, narrow: false },
      { targetRooms: 2, maxStories: 12, narrow: true },
      { targetRooms: 4, maxStories: 8, narrow: false },
    ];
    const { targetRooms, maxStories, narrow } = profiles[(hash(id) >>> 16) % 4];
    const roomsPerFloor = Math.max(
      targetRooms,
      Math.ceil(rooms.length / maxStories),
    );
    const stories = Math.ceil(rooms.length / roomsPerFloor);
    const counts = new Map<FileKind, number>();
    for (const node of nodes)
      counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
    const kind = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    let template: Building["template"] = "townhouse";
    if (rooms.length === 1) template = "studio";
    else if (kind === "service" || kind === "schema" || kind === "test")
      template = "workshop";
    else if (stories === 1 && roomDirectories.size >= 5) template = "atrium";
    let leftWidth = 0,
      rightWidth = 0,
      longestRun = 0;
    for (let floor = 0; floor < stories; floor++) {
      let leftRun = 0,
        rightRun = template === "atrium" ? 4 : 2;
      for (const room of rooms.slice(
        floor * roomsPerFloor,
        (floor + 1) * roomsPerFloor,
      )) {
        const size = measureRoom(room);
        room.width = size.width;
        room.depth = size.depth;
        room.door.z = size.doorZ;
        room.side = narrow || leftRun <= rightRun ? "left" : "right";
        const run = room.side === "left" ? leftRun : rightRun;
        room.z = -8 - run - room.depth / 2;
        room.floorY = floor * 5.4;
        if (room.side === "left") {
          leftRun += room.depth + 3;
          leftWidth = Math.max(leftWidth, room.width);
        } else {
          rightRun += room.depth + 3;
          rightWidth = Math.max(rightWidth, room.width);
        }
        longestRun = Math.max(longestRun, run + room.depth);
      }
    }
    return {
      id,
      name: tree.path.split("/").pop() || graph.name,
      directory: tree.path,
      parentId: regionId(packageId, tree.path),
      packageId,
      nodes,
      x: 0,
      z: 0,
      width: leftWidth + rightWidth + (stories === 1 ? 8 : 13),
      depth: Math.max(longestRun + 12, stories > 1 ? minimumStairDepth : 0),
      height: Math.max(
        stories * 5.4 + 1.5,
        8 +
          Math.min(
            18,
            Math.log2(1 + nodes.reduce((sum, n) => sum + n.incoming, 0)) * 2,
          ),
      ),
      stories,
      hallX: leftWidth + 4,
      rooms,
      template,
      kind,
    };
  }
  function selectBuildings(tree: DirectoryTree, packageId: string) {
    if (tree.nodeCount <= 60 || !tree.children.size) {
      const nodes: GraphNode[] = [];
      const collect = (directory: DirectoryTree) => {
        nodes.push(...directory.directNodes);
        for (const child of directory.children.values()) collect(child);
      };
      collect(tree);
      tree.building = makeBuilding(tree, packageId, nodes);
      tree.children.clear();
      return;
    }
    if (tree.directNodes.length)
      tree.building = makeBuilding(tree, packageId, tree.directNodes);
    for (const child of tree.children.values())
      selectBuildings(child, packageId);
  }
  function measure(tree: DirectoryTree) {
    const children = [...tree.children.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    for (const child of children) measure(child);
    const items: (DirectoryTree | Building)[] = [...children];
    if (tree.building) items.unshift(tree.building);
    const result =
      !tree.building && items.length === 1
        ? {
            width: items[0].width,
            depth: items[0].depth,
            placements: [
              { item: items[0], x: 0, z: 0, aisleZ: items[0].depth },
            ],
          }
        : pack(items);
    tree.width = result.width;
    tree.depth = result.depth;
    tree.placements = result.placements;
  }
  const packagePlans = [...roots.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, root]) => {
      countNodes(root);
      selectBuildings(root, id);
      measure(root);
      return { id, root, width: root.width, depth: root.depth };
    });
  const city = pack(packagePlans, 12, 22),
    buildings: Building[] = [],
    regions: Region[] = [],
    districts: District[] = [],
    paths: NavigationPath[] = [],
    positions = new Map<string, NodePosition>();
  const width = city.width,
    depth = city.depth;
  function connect(
    source: Entrance,
    target: Entrance,
    aisleZ: number,
    corridorX: number,
    obstacles: { x: number; z: number; width: number; depth: number }[],
  ) {
    if (source.x === target.x && source.z === target.z) return;
    const approachZ = target.z - 3;
    const candidates = [
      [
        source,
        { x: source.x, z: approachZ },
        { x: target.x, z: approachZ },
        target,
      ],
      [
        source,
        { x: source.x, z: aisleZ },
        { x: target.x, z: aisleZ },
        { x: target.x, z: approachZ },
        target,
      ],
    ];
    const clear = (points: { x: number; z: number }[]) => {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i];
        for (const obstacle of obstacles) {
          const minX = obstacle.x - 1.2,
            maxX = obstacle.x + obstacle.width + 1.2,
            minZ = obstacle.z - 1.2,
            maxZ = obstacle.z + obstacle.depth + 1.2;
          if (
            Math.max(a.x, b.x) > minX &&
            Math.min(a.x, b.x) < maxX &&
            Math.max(a.z, b.z) > minZ &&
            Math.min(a.z, b.z) < maxZ
          )
            return false;
        }
      }
      return true;
    };
    const shorter = candidates.find(clear);
    const points: { x: number; z: number }[] = [];
    for (const point of shorter ?? [
      source,
      { x: source.x, z: aisleZ },
      { x: corridorX, z: aisleZ },
      { x: corridorX, z: approachZ },
      { x: target.x, z: approachZ },
      target,
    ]) {
      const previous = points.at(-1),
        before = points.at(-2);
      if (previous?.x === point.x && previous.z === point.z) continue;
      if (
        before &&
        previous &&
        ((before.x === previous.x &&
          previous.x === point.x &&
          (previous.z - before.z) * (point.z - previous.z) >= 0) ||
          (before.z === previous.z &&
            previous.z === point.z &&
            (previous.x - before.x) * (point.x - previous.x) >= 0))
      )
        points.pop();
      points.push({ x: point.x, z: point.z });
    }
    paths.push({
      source: source.id,
      target: target.id,
      points,
    });
  }
  function place(
    tree: DirectoryTree,
    packageId: string,
    x: number,
    z: number,
    parentId: string | undefined,
    level: number,
  ): Entrance {
    const id = regionId(packageId, tree.path),
      entry = { id, x: x + tree.width / 2, z: z + tree.depth };
    regions.push({
      id,
      parentId,
      packageId,
      directory: tree.path,
      name: tree.path.split("/").pop() || graph.name,
      x: x + tree.width / 2,
      z: z + tree.depth / 2,
      width: tree.width,
      depth: tree.depth,
      level,
    });
    for (const placement of tree.placements) {
      const item = placement.item;
      let childEntry: Entrance;
      if ("nodes" in item) {
        item.x = x + placement.x + item.width / 2;
        item.z = z + placement.z + item.depth / 2;
        item.parentId = id;
        if (tree.children.size) item.name = `${item.name} / files`;
        buildings.push(item);
        childEntry = { id: item.id, x: item.x, z: item.z + item.depth / 2 };
        item.hallX += item.x - item.width / 2;
        item.rooms.forEach((room) => {
          const side = room.side === "left" ? -1 : 1;
          room.x = item.hallX + side * (2 + room.width / 2);
          room.z += item.z + item.depth / 2;
          room.door = {
            x: item.hallX + side * 2,
            z: room.z + room.door.z,
            rotation: room.side === "left" ? Math.PI / 2 : -Math.PI / 2,
          };
          for (const [nodeId, position] of planRoom(room, item))
            positions.set(nodeId, position);
        });
      } else
        childEntry = place(
          item,
          packageId,
          x + placement.x,
          z + placement.z,
          id,
          level + 1,
        );
      // A single-child region continues its doorway line instead of jogging to
      // the padded rectangle's center. District gates keep their fixed center.
      if (parentId && tree.placements.length === 1) entry.x = childEntry.x;
      connect(
        childEntry,
        entry,
        z + placement.aisleZ,
        x + tree.width - 3,
        tree.placements
          .filter((other) => other !== placement)
          .map((other) => ({
            x: x + other.x,
            z: z + other.z,
            width: other.item.width,
            depth: other.item.depth,
          })),
      );
    }
    return entry;
  }
  const cityEntry = { id: "city:entrance", x: 0, z: depth / 2 };
  for (const placement of city.placements) {
    const pkg = placement.item,
      x = placement.x - width / 2,
      z = placement.z - depth / 2,
      entry = place(pkg.root, pkg.id, x, z, undefined, 0);
    const first = buildings.find((b) => b.packageId === pkg.id)!;
    districts.push({
      id: pkg.id,
      name: packages.get(pkg.id)?.name ?? pkg.id,
      x: x + pkg.width / 2,
      z: z + pkg.depth / 2,
      width: pkg.width,
      depth: pkg.depth,
      color: palette[first.kind],
    });
    connect(
      entry,
      cityEntry,
      placement.aisleZ - depth / 2,
      width / 2 - 3,
      city.placements
        .filter((other) => other !== placement)
        .map((other) => ({
          x: other.x - width / 2,
          z: other.z - depth / 2,
          width: other.item.width,
          depth: other.item.depth,
        })),
    );
  }
  const first = buildings.find((b) => b.kind === "component") ?? buildings[0];
  return {
    buildings,
    districts,
    regions,
    paths,
    positions,
    width,
    depth,
    spawn: { x: first?.x ?? 0, z: first ? first.z + first.depth / 2 + 4 : 0 },
  };
}
