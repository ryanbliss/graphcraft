import { expect, it } from "vitest";
import { furnishBuilding } from "../src/world/interiors.ts";
import { VoxelBatch } from "../src/world/geometry.ts";
import {
  layoutWorld,
  type Building,
  type WorldLayout,
} from "../src/world/layout.ts";
import { analyzeProject } from "../src/graph/analyze.ts";
import { stairwells } from "../src/world/stairs.ts";
import { CollisionWorld, PlayerPhysics } from "../src/world/physics.ts";

const walkTo = (player: PlayerPhysics, x: number, z: number) => {
  for (let step = 0; step < 2400; step++) {
    const dx = x - player.position.x;
    const dz = z - player.position.z;
    const distance = Math.hypot(dx, dz);
    if (
      distance < 0.025 &&
      Math.hypot(player.velocity.x, player.velocity.z) < 0.05
    )
      return;
    const scale = Math.min(1, distance * 2) / Math.max(distance, 0.001);
    player.step(1 / 120, { x: dx * scale, z: dz * scale }, false, false);
  }
  throw new Error(
    `Walker stopped at ${JSON.stringify(player.position)} before reaching ${x}, ${z}`,
  );
};

it("reaches furnished rooms on both sides of the hall from the entrance and stairs", () => {
  const graph = analyzeProject(
    Array.from({ length: 56 }, (_, index) => ({
      path: `src/room${Math.floor(index / 8)}/file${index}.ts`,
      content: "export const value = 1",
    })),
    "furnished house",
  );
  const layout = layoutWorld(graph),
    building = layout.buildings[0];
  expect(building.rooms).toHaveLength(7);
  expect(building.stories).toBe(2);
  const world = new CollisionWorld();
  furnishBuilding(
    building,
    layout,
    new VoxelBatch(),
    new VoxelBatch(true),
    new VoxelBatch(),
    world,
    new Set(),
  );
  const player = new PlayerPhysics(world),
    hallX = building.hallX,
    front = building.z + building.depth / 2;
  player.teleport(building.x, front + 2);
  walkTo(player, building.x, front - 4);
  walkTo(player, hallX, front - 4);

  for (let floor = 0; floor < building.stories; floor++) {
    const floorY = floor * 5.4;
    for (const room of building.rooms.filter(
      (room) => room.floorY === floorY,
    )) {
      walkTo(player, hallX, room.door.z);
      walkTo(player, room.x, room.door.z);
      expect(player.position.y).toBeCloseTo(floorY + 1.75, 5);
      expect(player.grounded).toBe(true);
      walkTo(player, hallX, room.door.z);
    }
    if (floor === 0) {
      // The front flight is reached directly from the entrance foyer.
      const laneX = building.x + building.width / 2 - 3.3,
        passageX = building.x + building.width / 2 - 5.2;
      walkTo(player, hallX, front - 3);
      walkTo(player, laneX, front - 3);
      walkTo(player, laneX, front - 15.5);
      expect(player.position.y).toBeCloseTo(5.4 + 1.75, 5);
      walkTo(player, passageX, front - 15.5);
      walkTo(player, passageX, front - 4);
      walkTo(player, hallX, front - 4);
    }
  }
});

it.each([4, 12])(
  "ascends and descends %i stories from front and rear stairwells with head clearance",
  (stories) => {
    const building: Building = {
      id: "building:src",
      name: "src",
      directory: "src",
      parentId: "region:src",
      packageId: "project",
      nodes: [],
      kind: "module",
      x: 0,
      z: 0,
      width: 30,
      depth: 40,
      height: stories * 5.4 + 1.5,
      stories,
      hallX: 0,
      template: "atrium",
      rooms: [],
    };
    const layout: WorldLayout = {
      buildings: [building],
      districts: [],
      regions: [],
      paths: [],
      positions: new Map(),
      width: 30,
      depth: 40,
      spawn: { x: 11.7, z: -15 },
    };
    const world = new CollisionWorld();
    furnishBuilding(
      building,
      layout,
      new VoxelBatch(),
      new VoxelBatch(true),
      new VoxelBatch(),
      world,
      new Set(),
    );
    const player = new PlayerPhysics(world);
    const wells = stairwells(building);
    expect(wells).toHaveLength(2);
    expect(wells[0].front + 2).toBeLessThan(wells[1].rear);
    for (const well of wells) {
      player.teleport(well.x - 0.8, well.entryZ - well.direction);
      for (let flight = 0; flight < stories - 1; flight++) {
        const firstLane = flight % 2 === 0;
        const laneX = well.x + (firstLane ? -0.8 : 0.8);
        const landingZ = firstLane
          ? well.exitZ + well.direction
          : well.entryZ - well.direction;
        walkTo(player, laneX, player.position.z);
        walkTo(player, laneX, landingZ);
        const expectedEyeHeight = (flight + 1) * 5.4 + 1.75;
        expect(player.position.y).toBeCloseTo(expectedEyeHeight, 5);
        expect(player.grounded).toBe(true);

        walkTo(player, 0, landingZ);
        walkTo(player, 0, 0);
        expect(player.position.y).toBeCloseTo(expectedEyeHeight, 5);
        walkTo(player, 0, landingZ);
        walkTo(player, laneX, landingZ);
      }
      for (let flight = stories - 2; flight >= 0; flight--) {
        const firstLane = flight % 2 === 0;
        const laneX = well.x + (firstLane ? -0.8 : 0.8);
        const landingZ = firstLane
          ? well.entryZ - well.direction
          : well.exitZ + well.direction;
        walkTo(player, laneX, player.position.z);
        walkTo(player, laneX, landingZ);
        expect(player.position.y).toBeCloseTo(flight * 5.4 + 1.75, 5);
        expect(player.grounded).toBe(true);
      }
    }
  },
);
