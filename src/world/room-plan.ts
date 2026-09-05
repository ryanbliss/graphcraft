import { hash } from "../graph/types.ts";
import type { Building, FurnitureKind, NodePosition, Room } from "./layout.ts";
import { furnitureSize } from "./furniture.ts";

export type RoomTheme =
  | "bedroom"
  | "lounge"
  | "studio"
  | "library"
  | "workshop"
  | "arcade"
  | "spa"
  | "dojo"
  | "bar"
  | "garden"
  | "gallery";

const themes: RoomTheme[] = [
  "bedroom",
  "lounge",
  "studio",
  "library",
  "workshop",
  "arcade",
  "spa",
  "dojo",
  "bar",
  "garden",
  "gallery",
];
export function roomTheme(room: Room): RoomTheme {
  const seed = hash(room.directory);
  return themes[((seed ^ (seed >>> 16)) >>> 0) % themes.length];
}
interface Slot {
  kind: FurnitureKind;
  x: number;
  z: number;
  rotation: number;
  wall?: "rear" | "outer" | "front";
}
const slot = (kind: FurnitureKind, x = 0, z = 0, rotation = 0): Slot => ({
  kind,
  x,
  z,
  rotation,
});
type Cluster = [FurnitureKind, FurnitureKind, FurnitureKind];
const arrangements: Record<
  RoomTheme,
  {
    primary: [FurnitureKind, FurnitureKind];
    secondary: [FurnitureKind, FurnitureKind];
  }
> = {
  bedroom: {
    primary: ["bed", "armchair"],
    secondary: ["media", "sofa"],
  },
  lounge: {
    primary: ["media", "sofa"],
    secondary: ["bar", "stool"],
  },
  studio: {
    primary: ["hologram", "armchair"],
    secondary: ["sofa", "table"],
  },
  library: {
    primary: ["hologram", "armchair"],
    secondary: ["desk", "armchair"],
  },
  workshop: {
    primary: ["hologram", "stool"],
    secondary: ["arcade", "stool"],
  },
  arcade: {
    primary: ["arcade", "armchair"],
    secondary: ["media", "sofa"],
  },
  spa: {
    primary: ["bath", "stool"],
    secondary: ["shower", "planter"],
  },
  dojo: {
    primary: ["arena", "lamp"],
    secondary: ["workbench", "stool"],
  },
  bar: {
    primary: ["bar", "stool"],
    secondary: ["media", "sofa"],
  },
  garden: {
    primary: ["neon-tree", "armchair"],
    secondary: ["bath", "stool"],
  },
  gallery: {
    primary: ["hologram", "armchair"],
    secondary: ["media", "sofa"],
  },
};
const centerpieces: Record<RoomTheme, readonly FurnitureKind[]> = {
  bedroom: ["bed", "med-pod"],
  lounge: ["media", "aquarium", "dj"],
  studio: ["hologram", "synth", "telescope"],
  library: ["hologram", "telescope", "satellite"],
  workshop: ["hologram", "hoverbike", "robot-arm", "drone"],
  arcade: ["arcade", "vending", "dj"],
  spa: ["bath", "med-pod", "shower"],
  dojo: ["arena", "portal", "robot"],
  bar: ["bar", "ramen", "vending"],
  garden: ["neon-tree", "terrarium", "aquarium", "crystal"],
  gallery: ["hologram", "shrine", "portal", "satellite"],
};
const accents: Record<RoomTheme, readonly FurnitureKind[]> = {
  bedroom: ["robot", "terrarium", "crystal", "wardrobe", "planter", "lamp"],
  lounge: ["drone", "robot", "terrarium", "crystal", "lamp"],
  studio: ["drone", "satellite", "robot", "lamp", "terminal"],
  library: ["satellite", "robot", "crystal", "bookshelf", "lamp"],
  workshop: ["drone", "robot", "robot-arm", "cabinet", "terminal"],
  arcade: ["robot", "drone", "vending", "terminal", "lamp"],
  spa: ["terrarium", "crystal", "shrine", "planter", "lamp"],
  dojo: ["robot", "robot-arm", "crystal", "shrine", "terminal"],
  bar: ["robot", "vending", "terrarium", "planter", "lamp"],
  garden: ["terrarium", "crystal", "shrine", "planter", "lamp"],
  gallery: ["crystal", "satellite", "shrine", "robot", "terrarium"],
};
const wallPieces: Record<RoomTheme, readonly FurnitureKind[]> = {
  bedroom: ["painting", "trophy"],
  lounge: ["painting", "trophy", "computer-wall"],
  studio: ["computer-wall", "saber", "trophy"],
  library: ["computer-wall", "painting", "trophy"],
  workshop: ["computer-wall", "saber", "trophy"],
  arcade: ["trophy", "computer-wall", "saber"],
  spa: ["painting", "trophy"],
  dojo: ["saber", "trophy"],
  bar: ["painting", "computer-wall", "trophy"],
  garden: ["painting", "trophy"],
  gallery: ["trophy", "saber", "computer-wall", "painting"],
};
function choose(
  room: Room,
  role: string,
  pool: readonly FurnitureKind[],
): FurnitureKind {
  return pool[hash(`${room.directory}:${role}`) % pool.length];
}
function themedCluster(room: Room, role: "primary" | "secondary"): Cluster {
  const theme = roomTheme(room);
  const original = arrangements[theme][role];
  const main = choose(room, `${role}:installation`, [
    original[0],
    ...centerpieces[theme],
  ]);
  const companion = choose(room, `${role}:seat`, [
    original[1],
    "armchair",
    "stool",
  ]);
  const mascot =
    role === "primary" &&
    ["bedroom", "lounge", "garden"].includes(theme) &&
    hash(`${room.directory}:mascot`) % 23 === 0;
  const accent = mascot
    ? "neon-cat"
    : choose(room, `${role}:accent`, accents[theme]);
  return [main, companion, accent];
}

function dimensions(item: Slot) {
  const size = furnitureSize[item.kind],
    cos = Math.abs(Math.cos(item.rotation)),
    sin = Math.abs(Math.sin(item.rotation));
  return {
    width: size.width * cos + size.depth * sin,
    depth: size.width * sin + size.depth * cos,
  };
}
function bounds(items: Slot[]) {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const item of items) {
    const size = dimensions(item);
    minX = Math.min(minX, item.x - size.width / 2);
    maxX = Math.max(maxX, item.x + size.width / 2);
    minZ = Math.min(minZ, item.z - size.depth / 2);
    maxZ = Math.max(maxZ, item.z + size.depth / 2);
  }
  return { minX, maxX, minZ, maxZ };
}
function cluster(kinds: Cluster, count: number, variant: number): Slot[] {
  if (!count) return [];
  const main = slot(
    kinds[0],
    0,
    0,
    variant === 1 && count > 1 ? Math.PI / 2 : 0,
  );
  const companion = slot(
    kinds[1],
    0,
    0,
    variant === 1 ? -Math.PI / 2 : Math.PI,
  );
  const accent = slot(kinds[2]);
  const a = dimensions(main),
    b = dimensions(companion),
    c = dimensions(accent);
  const gap = 0.95;
  if (variant === 0) {
    companion.z = (a.depth + b.depth) / 2 + gap;
    accent.x = (a.width + c.width) / 2 + gap;
    // Keep the side object clear of the wider companion as well.
    accent.x = Math.max(accent.x, (b.width + c.width) / 2 + gap);
  } else if (variant === 1) {
    companion.x = (a.width + b.width) / 2 + gap;
    accent.z = -(a.depth + c.depth) / 2 - gap;
    accent.z = Math.min(accent.z, -(b.depth + c.depth) / 2 - gap);
  } else {
    companion.rotation = Math.PI / 2;
    const side = dimensions(companion);
    companion.x = -(a.width + side.width) / 2 - gap;
    companion.z = (a.depth - side.depth) / 2;
    accent.x = (a.width + c.width) / 2 + gap;
    accent.z = -(a.depth - c.depth) / 2;
  }
  return [main, companion, accent].slice(0, count);
}
function composition(room: Room): Slot[] {
  const count = room.nodeIds.length;
  const theme = roomTheme(room);
  const variant = hash(`${room.directory}:arrangement`) % 3;
  const primary = cluster(
    themedCluster(room, "primary"),
    Math.min(count, 3),
    variant,
  );
  const rear = bounds(primary);
  for (const item of primary) {
    item.x -= (rear.minX + rear.maxX) / 2;
    item.z -= rear.maxZ + 1.65;
  }
  const result = [...primary];
  if (count >= 4)
    result.push({
      ...slot(choose(room, "rear-art", wallPieces[theme])),
      wall: "rear",
    });
  const secondary = cluster(
    themedCluster(room, "secondary"),
    Math.min(3, Math.max(0, count - 4)),
    (variant + 1) % 3,
  );
  if (secondary.length) {
    for (const item of secondary) {
      item.x = -item.x;
      item.z = -item.z;
      item.rotation += Math.PI;
    }
    const front = bounds(secondary);
    for (const item of secondary) {
      item.x -= (front.minX + front.maxX) / 2;
      item.z += 1.65 - front.minZ;
    }
    result.push(...secondary);
  }
  if (count >= 8)
    result.push({
      ...slot(choose(room, "side-art", wallPieces[theme])),
      wall: "outer",
    });
  const corner = cluster(
    [
      choose(room, "corner-installation", [
        "bookshelf",
        "vending",
        "terrarium",
        "robot-arm",
        "synth",
      ]),
      choose(room, "corner-seat", ["armchair", "stool"]),
      choose(room, "corner-accent", accents[theme]),
    ],
    Math.min(3, Math.max(0, count - 8)),
    variant,
  );
  if (corner.length) {
    const occupied = bounds([...primary, ...secondary]),
      outer = bounds(corner);
    for (const item of corner) {
      item.x += occupied.minX - 0.95 - outer.maxX;
      item.z += 1.65 - outer.minZ;
    }
    result.push(...corner);
  }
  if (count >= 12)
    result.push({
      ...slot(choose(room, "front-art", wallPieces[theme])),
      wall: "front",
    });
  return result;
}
export function roomContentHeight(room: Room): number {
  let height = 0;
  for (const item of composition(room)) {
    const size = furnitureSize[item.kind];
    height = Math.max(height, size.wall ? 3 + size.height / 2 : size.height);
  }
  return height;
}

function fitRoom(room: Room) {
  let minX = -1.5,
    maxX = 1.5,
    minZ = -1.6,
    maxZ = 1.6;
  for (const item of composition(room)) {
    if (item.wall) continue;
    const size = furnitureSize[item.kind],
      cos = Math.abs(Math.cos(item.rotation)),
      sin = Math.abs(Math.sin(item.rotation));
    const halfWidth = (size.width * cos + size.depth * sin) / 2,
      halfDepth = (size.width * sin + size.depth * cos) / 2;
    minX = Math.min(minX, item.x - halfWidth);
    maxX = Math.max(maxX, item.x + halfWidth);
    minZ = Math.min(minZ, item.z - halfDepth);
    maxZ = Math.max(maxZ, item.z + halfDepth);
  }
  return {
    width: Math.ceil((maxX - minX + 1.3) * 2) / 2,
    depth: Math.ceil((maxZ - minZ + 1.3) * 2) / 2,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

export function measureRoom(room: Room): {
  width: number;
  depth: number;
  doorZ: number;
} {
  const fit = fitRoom(room);
  return { width: fit.width, depth: fit.depth, doorZ: -fit.centerZ };
}

export function planRoom(
  room: Room,
  building: Building,
): Map<string, NodePosition> {
  const slots = composition(room),
    fit = fitRoom(room),
    members = new Set(room.nodeIds),
    nodes = building.nodes.filter((node) => members.has(node.id)),
    mirror = room.side === "left" ? 1 : -1;
  nodes.sort((a, b) => b.incoming - a.incoming || hash(a.id) - hash(b.id));
  const result = new Map<string, NodePosition>();
  for (let index = 0; index < nodes.length; index++) {
    const item = slots[index];
    if (!item)
      throw new Error(
        `No furniture slot for ${nodes[index].id} in ${room.directory}`,
      );
    const size = furnitureSize[item.kind];
    let x = item.x - fit.centerX,
      z = item.z - fit.centerZ,
      rotation = item.rotation;
    const wallOffset = Math.max(0.25, size.depth / 2 + 0.13);
    if (item.wall === "rear") {
      x = 0;
      z = -room.depth / 2 + wallOffset;
    }
    if (item.wall === "front") {
      x = 0;
      z = room.depth / 2 - wallOffset;
      rotation = Math.PI;
    }
    if (item.wall === "outer") {
      x = -room.width / 2 + wallOffset;
      z = 0;
      rotation = Math.PI / 2;
    }
    result.set(nodes[index].id, {
      x: room.x + x * mirror,
      y: room.floorY + (size.wall ? 3 : size.height / 2),
      z: room.z + z,
      floorY: room.floorY,
      rotation: rotation * mirror,
      furniture: item.kind,
      buildingId: building.id,
    });
  }
  return result;
}
