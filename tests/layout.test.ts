import { describe, it, expect } from "vitest";
import { analyzeProject } from "../src/graph/analyze.ts";
import {
  layoutWorld,
  type Region,
  type Building,
} from "../src/world/layout.ts";
function graph() {
  return analyzeProject(
    Object.entries({
      "package.json": '{"name":"workspace","workspaces":["packages/*"]}',
      "packages/core/package.json": '{"name":"@example/core"}',
      "packages/core/src/index.ts": 'export * from "./internals/read"',
      "packages/core/src/internals/read.ts": "export const read=1",
      "packages/core/src/internals/deep/value.ts": "export const value=2",
      "packages/ui/package.json": '{"name":"@example/ui"}',
      "packages/ui/src/index.ts": "export const ui=1",
    }).map(([path, content]) => ({ path, content })),
    "workspace",
  );
}
function contains(
  parent: Pick<Region, "x" | "z" | "width" | "depth">,
  child: Pick<Building, "x" | "z" | "width" | "depth">,
) {
  return (
    Math.abs(child.x - parent.x) + child.width / 2 <=
      parent.width / 2 + 0.001 &&
    Math.abs(child.z - parent.z) + child.depth / 2 <= parent.depth / 2 + 0.001
  );
}
describe("spatial directory hierarchy", () => {
  it("packs mixed directory sizes densely and independently of scan order", () => {
    const files = [{ path: "package.json", content: "{}" }];
    for (let directory = 0; directory < 24; directory++) {
      const children = directory % 3 === 0 ? 12 : 1;
      for (let child = 0; child < children; child++)
        files.push({
          path: `src/d${String(directory).padStart(2, "0")}/child${child}/index.ts`,
          content: "export const value=1",
        });
    }
    const source = analyzeProject(files, "mixed directories"),
      layout = layoutWorld(source),
      occupied = layout.buildings.reduce(
        (sum, building) => sum + building.width * building.depth,
        0,
      );
    expect(occupied / (layout.width * layout.depth)).toBeGreaterThan(0.16);
    expect(Math.max(layout.width, layout.depth)).toBeLessThan(1000);
    expect(layout.buildings).toHaveLength(25);
    expect(
      layout.buildings
        .find((building) => building.directory === "")
        ?.nodes.map((node) => node.id),
    ).toEqual(["package.json"]);
    expect(
      layout.buildings.every((building) => building.nodes.length <= 60),
    ).toBe(true);
    expect(
      layoutWorld({ ...source, nodes: [...source.nodes].reverse() }),
    ).toEqual(layout);
  });
  it("allocates files across bounded stories and leaves room for stairs", () => {
    const source = analyzeProject(
        Array.from({ length: 300 }, (_, index) => ({
          path: `src/file${index}.ts`,
          content: "export const value=1",
        })),
        "stories",
      ),
      layout = layoutWorld(source),
      building = layout.buildings[0],
      floors = new Map<number, number>();
    expect(building.stories).toBe(9);
    expect(layout.buildings).toHaveLength(1);
    expect(building.rooms).toHaveLength(25);
    expect(building.height).toBeGreaterThanOrEqual(9 * 5.4 + 1.5);
    for (const position of layout.positions.values()) {
      floors.set(position.floorY, (floors.get(position.floorY) ?? 0) + 1);
      expect(position.y).toBeGreaterThan(position.floorY);
      expect(position.y).toBeLessThan(position.floorY + 5.4);
      expect(position.x + 0.9).toBeLessThan(
        building.x + building.width / 2 - 5,
      );
    }
    expect(floors.size).toBe(9);
    expect(Math.max(...floors.keys())).toBeCloseTo(43.2);
    expect([...floors.values()]).toEqual([...Array<number>(8).fill(36), 12]);
    expect(building.width).toBeLessThanOrEqual(32);
    expect(new Set(building.rooms.map((room) => room.side))).toEqual(
      new Set(["left"]),
    );
    for (const room of building.rooms) {
      expect(contains(building, room)).toBe(true);
      expect(room.nodeIds.length).toBeLessThanOrEqual(12);
      for (const nodeId of room.nodeIds) {
        const position = layout.positions.get(nodeId)!;
        expect(Math.abs(position.x - room.x)).toBeLessThan(room.width / 2);
        expect(Math.abs(position.z - room.z)).toBeLessThan(room.depth / 2);
        expect(position.floorY).toBe(room.floorY);
      }
    }
  });
  it("uses distinct repeatable tower footprints with occupied floors and clear room banks", () => {
    const files = ["api", "authentication", "components", "storage"].flatMap(
      (directory) =>
        Array.from({ length: 61 }, (_, index) => ({
          path: `src/${directory}/file${index}.ts`,
          content: "export const value=1",
        })),
    );
    const source = analyzeProject(files, "tower profiles");
    const layout = layoutWorld(source);
    const capacities = new Set<number>();
    for (const building of layout.buildings) {
      const floors = new Map<number, typeof building.rooms>();
      for (const room of building.rooms) {
        const floor = floors.get(room.floorY) ?? [];
        floor.push(room);
        floors.set(room.floorY, floor);
        expect(contains(building, room)).toBe(true);
      }
      capacities.add(
        Math.max(...[...floors.values()].map((rooms) => rooms.length)),
      );
      expect(floors.size).toBe(building.stories);
      expect(building.stories).toBeLessThanOrEqual(12);
      if (building.stories > 1)
        expect(building.depth).toBeGreaterThanOrEqual(36);
      for (const rooms of floors.values()) {
        for (let i = 0; i < rooms.length; i++) {
          for (const other of rooms.slice(i + 1)) {
            const room = rooms[i];
            expect(
              Math.abs(room.x - other.x) >= (room.width + other.width) / 2 ||
                Math.abs(room.z - other.z) >= (room.depth + other.depth) / 2,
            ).toBe(true);
          }
        }
      }
    }
    expect(capacities).toEqual(new Set([1, 2, 4, 6]));
    expect(
      layoutWorld({ ...source, nodes: [...source.nodes].reverse() }),
    ).toEqual(layout);
  });
  it("varies room proportions while preserving a straight hall and separate doorways", () => {
    const files = [1, 3, 6, 8, 12].flatMap((count, directory) =>
      Array.from({ length: count }, (_, index) => ({
        path: `src/folder${directory}/file${index}.ts`,
        content: "export const value = 1",
      })),
    );
    const layout = layoutWorld(analyzeProject(files, "varied rooms")),
      building = layout.buildings[0];
    expect(layout.buildings).toHaveLength(1);
    expect(building.rooms).toHaveLength(5);
    expect(building.stories).toBe(1);
    const leftEdge = Math.min(
      ...building.rooms.map((room) => room.x - room.width / 2),
    );
    const rightEdge = Math.max(
      ...building.rooms.map((room) => room.x + room.width / 2),
    );
    expect(leftEdge - (building.x - building.width / 2)).toBeCloseTo(2);
    expect(building.x + building.width / 2 - rightEdge).toBeCloseTo(2);
    expect(
      new Set(building.rooms.map((room) => room.width)).size,
    ).toBeGreaterThanOrEqual(3);
    expect(
      new Set(building.rooms.map((room) => room.depth)).size,
    ).toBeGreaterThanOrEqual(3);
    for (const room of building.rooms) {
      expect(contains(building, room)).toBe(true);
      expect(Math.abs(room.door.z - room.z) + 1.6).toBeLessThan(room.depth / 2);
      if (room.nodeIds.length === 1)
        expect(room.width * room.depth).toBeLessThanOrEqual(90);
      expect(room.width * room.depth).toBeLessThanOrEqual(300);
      expect(Math.abs(room.door.x - room.x)).toBeCloseTo(room.width / 2);
      expect(room.door.x).toBeCloseTo(
        building.hallX + (room.side === "left" ? -2 : 2),
      );
      for (const other of building.rooms) {
        if (other === room) continue;
        expect(
          Math.abs(room.x - other.x) >= (room.width + other.width) / 2 ||
            Math.abs(room.z - other.z) >= (room.depth + other.depth) / 2,
        ).toBe(true);
      }
    }
    expect(
      building.rooms.some((room) => Math.abs(room.door.z - room.z) > 0.5),
    ).toBe(true);
    const left = building.rooms.find((room) => room.side === "left")!,
      right = building.rooms.find((room) => room.side === "right")!;
    expect(left.z + left.depth / 2).not.toBe(right.z + right.depth / 2);
  });
  it("keeps coherent package subtrees together with real directory rooms", () => {
    const layout = layoutWorld(graph()),
      regions = new Map(layout.regions.map((region) => [region.id, region]));
    for (const building of layout.buildings) {
      const parent = regions.get(building.parentId)!;
      expect(parent.directory).toBe(building.directory);
      expect(contains(parent, building)).toBe(true);
    }
    for (const region of layout.regions) {
      if (!region.parentId) continue;
      expect(contains(regions.get(region.parentId)!, region)).toBe(true);
    }
    expect(layout.buildings).toHaveLength(3);
    const core = layout.buildings.find(
      (building) => building.directory === "packages/core",
    )!;
    expect(core.nodes).toHaveLength(4);
    expect(core.rooms.map((room) => room.directory)).toEqual([
      "packages/core",
      "packages/core/src",
      "packages/core/src/internals",
      "packages/core/src/internals/deep",
    ]);
    expect(
      layout.regions.some((region) =>
        region.directory.startsWith("packages/core/src"),
      ),
    ).toBe(false);
    const assigned = layout.buildings.flatMap((building) =>
      building.rooms.flatMap((room) => room.nodeIds),
    );
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(new Set(assigned)).toEqual(
      new Set(graph().nodes.map((node) => node.id)),
    );
    expect(layout.positions.size).toBe(graph().nodes.length);
  });
  it("continues single-building entrance paths straight through padded regions to the road", () => {
    const files = Array.from({ length: 8 }, (_, directory) =>
      Array.from({ length: 12 }, (_, file) => ({
        path: `src/components/${directory === 0 ? "flex" : `group${directory}`}/file${file}.ts`,
        content: "export const item = 1",
      })),
    ).flat();
    const layout = layoutWorld(analyzeProject(files, "neo-compose"));
    const building = layout.buildings.find((item) => item.name === "flex")!;
    const driveway = layout.paths.find((path) => path.source === building.id)!;
    const road = layout.paths.find((path) => path.source === driveway.target)!;
    const region = layout.regions.find((item) => item.id === driveway.target)!;
    // Reproduce the padding offset without moving the region or building.
    expect(region.x - building.x).toBe(3);
    expect(driveway.points).toEqual([
      { x: building.x, z: building.z + building.depth / 2 },
      { x: building.x, z: region.z + region.depth / 2 },
    ]);
    expect(road.points[0]).toEqual(driveway.points[1]);
    expect(road.points[1].x).toBe(building.x);
    expect(road.points[1].z).toBeGreaterThan(road.points[0].z);
    for (const district of layout.districts) {
      const root = layout.regions.find(
        (item) => item.packageId === district.id && !item.parentId,
      )!;
      const gate = layout.paths.find((path) => path.source === root.id)!;
      expect(gate.points[0]).toEqual({
        x: district.x,
        z: district.z + district.depth / 2,
      });
    }
  });
  it("connects only known entrances and keeps navigation paths outside building interiors", () => {
    const layout = layoutWorld(graph()),
      entrances = new Map(
        layout.buildings.map((item) => [
          item.id,
          { x: item.x, z: item.z + item.depth / 2 },
        ]),
      );
    for (const region of layout.regions) {
      const outgoing = layout.paths.find((path) => path.source === region.id)!;
      entrances.set(region.id, outgoing.points[0]);
    }
    entrances.set("city:entrance", { x: 0, z: layout.depth / 2 });
    for (const path of layout.paths) {
      const source = entrances.get(path.source)!,
        target = entrances.get(path.target)!;
      expect(path.points[0].x).toBeCloseTo(source.x);
      expect(path.points[0].z).toBeCloseTo(source.z);
      expect(path.points.at(-1)!.x).toBeCloseTo(target.x);
      expect(path.points.at(-1)!.z).toBeCloseTo(target.z);
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1],
          b = path.points[i];
        expect(a.x === b.x || a.z === b.z).toBe(true);
        for (const district of layout.districts) {
          for (const side of [-1, 1]) {
            const pillarX = district.x + side * 7,
              pillarZ = district.z + district.depth / 2,
              nearestX = Math.max(
                Math.min(a.x, b.x),
                Math.min(pillarX, Math.max(a.x, b.x)),
              ),
              nearestZ = Math.max(
                Math.min(a.z, b.z),
                Math.min(pillarZ, Math.max(a.z, b.z)),
              );
            expect(
              Math.hypot(nearestX - pillarX, nearestZ - pillarZ),
            ).toBeGreaterThan(1.55);
          }
        }
        for (const building of layout.buildings) {
          const minX = building.x - building.width / 2 + 0.01,
            maxX = building.x + building.width / 2 - 0.01,
            minZ = building.z - building.depth / 2 + 0.01,
            maxZ = building.z + building.depth / 2 - 0.01;
          const crosses =
            a.x === b.x
              ? a.x > minX &&
                a.x < maxX &&
                Math.max(a.z, b.z) > minZ &&
                Math.min(a.z, b.z) < maxZ
              : a.z > minZ &&
                a.z < maxZ &&
                Math.max(a.x, b.x) > minX &&
                Math.min(a.x, b.x) < maxX;
          expect(crosses, `${path.source} crosses ${building.directory}`).toBe(
            false,
          );
        }
      }
    }
    const direct = layout.paths.find((path) =>
      path.source.endsWith(":packages/ui"),
    )!;
    const start = direct.points[0],
      end = direct.points.at(-1)!;
    const length = direct.points
      .slice(1)
      .reduce(
        (sum, point, index) =>
          sum +
          Math.abs(point.x - direct.points[index].x) +
          Math.abs(point.z - direct.points[index].z),
        0,
      );
    expect(length).toBeCloseTo(
      Math.abs(end.x - start.x) + Math.abs(end.z - start.z),
    );
  });
});
