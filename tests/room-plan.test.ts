import { extraFurnitureSize } from "../src/world/extra-furniture.ts";
import { expect, it } from "vitest";
import { analyzeProject } from "../src/graph/analyze.ts";
import { furnitureSize } from "../src/world/furniture.ts";
import {
  layoutWorld,
  type NodePosition,
  type Room,
} from "../src/world/layout.ts";
import { hash } from "../src/graph/types.ts";
import type { Collider } from "../src/world/physics.ts";
import { roomTheme } from "../src/world/room-plan.ts";
import { roomCeilingHeight } from "../src/world/interiors.ts";

function footprint(position: NodePosition): Collider {
  const size = furnitureSize[position.furniture],
    cos = Math.abs(Math.cos(position.rotation)),
    sin = Math.abs(Math.sin(position.rotation)),
    halfWidth = (size.width * cos + size.depth * sin) / 2,
    halfDepth = (size.width * sin + size.depth * cos) / 2,
    base = size.wall ? position.y - size.height / 2 : position.floorY;
  return {
    minX: position.x - halfWidth,
    maxX: position.x + halfWidth,
    minZ: position.z - halfDepth,
    maxZ: position.z + halfDepth,
    minY: base,
    maxY: base + size.height,
  };
}

function overlaps(a: Collider, b: Collider): boolean {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0.00001 &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 0.00001 &&
    Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 0.00001
  );
}

function themePairs(): string[][] {
  const pairs = new Map<string, string[]>();
  const room: Room = {
    id: "",
    directory: "",
    name: "",
    nodeIds: [],
    floorY: 0,
    x: 0,
    z: 0,
    width: 9,
    depth: 9,
    side: "left",
    door: { x: 0, z: 0, rotation: 0 },
  };
  for (let index = 0; index < 2000; index++) {
    const directory = `src/audit${index}`;
    const theme = roomTheme({ ...room, directory });
    const key = `${theme}:${hash(`${directory}:arrangement`) % 3}`;
    const paths = pairs.get(key) ?? [];
    if (paths.length < 2) paths.push(directory);
    pairs.set(key, paths);
    if (
      pairs.size === 33 &&
      [...pairs.values()].every((paths) => paths.length === 2)
    )
      break;
  }
  expect(pairs.size).toBe(33);
  return [...pairs.values()];
}

it("fits authored furniture without overlaps or blocked doors across room sizes, themes and sides", () => {
  const combinations = new Set<string>();
  const pairs = themePairs();
  for (let count = 1; count <= 12; count++) {
    for (const directories of pairs) {
      const files = directories.flatMap((directory) =>
        Array.from({ length: count }, (_, index) => ({
          path: `${directory}/file${index}.ts`,
          content: "export const value = 1",
        })),
      );
      const layout = layoutWorld(analyzeProject(files, "furniture audit"));
      for (const building of layout.buildings) {
        for (const room of building.rooms) {
          combinations.add(`${roomTheme(room)}:${room.side}`);
          const boxes = room.nodeIds.map((id) => ({
            id,
            position: layout.positions.get(id)!,
            bounds: footprint(layout.positions.get(id)!),
          }));
          const insideX = room.x,
            doorway: Collider = {
              minX: Math.min(insideX, room.door.x),
              maxX: Math.max(insideX, room.door.x),
              minZ: room.door.z - 0.45,
              maxZ: room.door.z + 0.45,
              minY: room.floorY,
              maxY: room.floorY + 1.75,
            };
          for (let index = 0; index < boxes.length; index++) {
            const { id, position, bounds } = boxes[index],
              label = `${roomTheme(room)} ${room.side} ${count} files: ${id} (${position.furniture})`;
            expect(bounds.minX, label).toBeGreaterThanOrEqual(
              room.x - room.width / 2 + 0.109,
            );
            expect(bounds.maxX, label).toBeLessThanOrEqual(
              room.x + room.width / 2 - 0.109,
            );
            expect(bounds.minZ, label).toBeGreaterThanOrEqual(
              room.z - room.depth / 2 + 0.109,
            );
            expect(bounds.maxZ, label).toBeLessThanOrEqual(
              room.z + room.depth / 2 - 0.109,
            );
            expect(bounds.minY, label).toBeGreaterThanOrEqual(room.floorY);
            expect(bounds.maxY, label).toBeLessThan(
              room.floorY + roomCeilingHeight(room) - 0.3,
            );
            expect(overlaps(bounds, doorway), `${label} blocks doorway`).toBe(
              false,
            );
            for (const other of boxes.slice(index + 1)) {
              expect(
                overlaps(bounds, other.bounds),
                `${label} overlaps ${other.id} (${other.position.furniture})`,
              ).toBe(false);
              const seats = new Set(["armchair", "stool", "sofa"]),
                tables = new Set(["table", "desk", "workbench"]);
              if (
                (seats.has(position.furniture) &&
                  tables.has(other.position.furniture)) ||
                (tables.has(position.furniture) &&
                  seats.has(other.position.furniture))
              ) {
                const dx = Math.max(
                    0,
                    bounds.minX - other.bounds.maxX,
                    other.bounds.minX - bounds.maxX,
                  ),
                  dz = Math.max(
                    0,
                    bounds.minZ - other.bounds.maxZ,
                    other.bounds.minZ - bounds.maxZ,
                  );
                expect(
                  Math.hypot(dx, dz),
                  `${label} has no approach to ${other.position.furniture}`,
                ).toBeGreaterThanOrEqual(0.799);
              }
            }
          }
        }
      }
    }
  }
  expect(combinations.size).toBe(22);
});

it("gives every single-file room a substantial installation and sizes rooms to that installation", () => {
  const graph = analyzeProject(
    Array.from({ length: 120 }, (_, index) => ({
      path: `src/single${index}/entry.ts`,
      content: "export const value = 1",
    })),
    "single installations",
  );
  const layout = layoutWorld(graph);
  const kinds = new Set<string>();
  const areas: number[] = [];
  for (const building of layout.buildings)
    for (const room of building.rooms) {
      expect(room.nodeIds).toHaveLength(1);
      const item = layout.positions.get(room.nodeIds[0])!;
      const size = furnitureSize[item.furniture];
      expect(size.wall, room.directory).not.toBe(true);
      expect(size.width * size.depth, room.directory).toBeGreaterThanOrEqual(
        2.5,
      );
      expect(size.height, room.directory).toBeGreaterThanOrEqual(1.2);
      expect(
        item.rotation,
        `${room.directory} faces the entrance aisle`,
      ).toBeCloseTo(0);
      expect(
        item.z + furnitureSize[item.furniture].depth / 2,
        room.directory,
      ).toBeLessThanOrEqual(room.door.z - 1.6);
      kinds.add(item.furniture);
      areas.push(room.width * room.depth);
    }
  expect(kinds.size).toBeGreaterThanOrEqual(20);
  expect(
    Object.keys(extraFurnitureSize).filter((kind) => kinds.has(kind)).length,
  ).toBeGreaterThanOrEqual(12);
  expect(Math.min(...areas)).toBeLessThan(40);
  expect(Math.max(...areas)).toBeGreaterThan(Math.min(...areas) * 2);
});

it("varies complete themed arrangements deterministically without deriving them from file extensions", () => {
  const source = Array.from({ length: 180 }, (_, directory) =>
    Array.from({ length: 3 }, (_, index) => ({
      path: `src/composition${directory}/item${index}.ts`,
      content: "export const value = 1",
    })),
  ).flat();
  const graph = analyzeProject(source, "arrangements");
  const layout = layoutWorld(graph);
  const signatures = new Map<string, Set<string>>();
  for (const building of layout.buildings)
    for (const room of building.rooms) {
      const shape = room.nodeIds
        .map((id) => layout.positions.get(id)!)
        .map((p) => ({
          kind: p.furniture,
          x: +(p.x - room.x).toFixed(3),
          z: +(p.z - room.z).toFixed(3),
          rotation: +p.rotation.toFixed(3),
        }))
        .sort((a, b) => a.kind.localeCompare(b.kind));
      const theme = roomTheme(room);
      const existing = signatures.get(theme) ?? new Set<string>();
      existing.add(JSON.stringify(shape));
      signatures.set(theme, existing);
    }
  expect(signatures.size).toBe(11);
  for (const [theme, variants] of signatures)
    expect(variants.size, theme).toBeGreaterThanOrEqual(3);
  const repeat = layoutWorld(graph);
  expect([...repeat.positions]).toEqual([...layout.positions]);
  const renamed = analyzeProject(
    source.map((file) => ({
      ...file,
      path: file.path.replace(/\.ts$/, ".test.tsx"),
    })),
    "arrangements",
  );
  const other = layoutWorld(renamed);
  for (let index = 0; index < layout.buildings.length; index++) {
    const before = layout.buildings[index].rooms[0],
      after = other.buildings[index].rooms[0];
    expect(roomTheme(after)).toBe(roomTheme(before));
    expect(
      after.nodeIds.map((id) => other.positions.get(id)!.furniture).sort(),
    ).toEqual(
      before.nodeIds.map((id) => layout.positions.get(id)!.furniture).sort(),
    );
  }
});

it("uses the full installation catalog while making cats occasional room accents", () => {
  const graph = analyzeProject(
    Array.from({ length: 400 }, (_, directory) =>
      Array.from({ length: 6 }, (_, index) => ({
        path: `src/neighborhood${directory}/file${index}.ts`,
        content: "export const value = 1",
      })),
    ).flat(),
    "varied neighborhoods",
  );
  const layout = layoutWorld(graph);
  const counts = new Map<string, number>();
  for (const position of layout.positions.values())
    counts.set(position.furniture, (counts.get(position.furniture) ?? 0) + 1);
  for (const kind of Object.keys(extraFurnitureSize))
    expect(
      counts.get(kind),
      `${kind} appears in authored rooms`,
    ).toBeGreaterThan(0);
  const cats = counts.get("neon-cat") ?? 0;
  expect(cats).toBeGreaterThan(0);
  expect(cats / layout.positions.size).toBeLessThan(0.01);
  for (const building of layout.buildings)
    for (const room of building.rooms)
      expect(
        room.nodeIds.filter(
          (id) => layout.positions.get(id)!.furniture === "neon-cat",
        ).length,
      ).toBeLessThanOrEqual(1);
});
