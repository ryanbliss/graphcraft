import { describe, expect, it } from "vitest";
import { CollisionWorld, PlayerPhysics } from "../src/world/physics.ts";
const run = (
  p: PlayerPhysics,
  n: number,
  dir = { x: 0, z: 0 },
  jump = false,
  sprint = false,
) => {
  for (let i = 0; i < n; i++) p.step(1 / 120, dir, jump && i === 0, sprint);
};
describe("walking collision", () => {
  it("stops at thin walls at sprint speed and slides along them", () => {
    const world = new CollisionWorld();
    world.add({ minX: 2, maxX: 2.2, minY: 0, maxY: 6, minZ: -20, maxZ: 20 });
    const player = new PlayerPhysics(world);
    run(player, 240, { x: 0.707, z: 0.707 }, false, true);
    expect(player.position.x).toBeLessThanOrEqual(1.621);
    expect(player.position.z).toBeGreaterThan(10);
  });
  it("jumps, lands, and does not pass through ceilings", () => {
    const world = new CollisionWorld();
    world.add({ minX: -2, maxX: 2, minY: 3, maxY: 4, minZ: -2, maxZ: 2 });
    const player = new PlayerPhysics(world);
    run(player, 20, { x: 0, z: 0 }, true);
    expect(player.position.y).toBeGreaterThan(1.75);
    expect(player.position.y).toBeLessThan(3);
    run(player, 240);
    expect(player.position.y).toBe(1.75);
    expect(player.grounded).toBe(true);
  });
  it("walks through a doorway with colliders on both sides", () => {
    const world = new CollisionWorld();
    for (const side of [-1, 1])
      world.add({
        minX: side < 0 ? -5 : 2,
        maxX: side < 0 ? -2 : 5,
        minY: 0,
        maxY: 4,
        minZ: 2,
        maxZ: 2.5,
      });
    const player = new PlayerPhysics(world);
    run(player, 100, { x: 0, z: 1 });
    expect(player.position.z).toBeGreaterThan(4);
  });
  it("climbs voxel steps and walks underneath a raised bridge", () => {
    const world = new CollisionWorld();
    for (let i = 0; i < 8; i++)
      world.add({
        minX: 1 + i * 0.7,
        maxX: 1 + (i + 1) * 0.7,
        minY: 0,
        maxY: (i + 1) * 0.3,
        minZ: -1,
        maxZ: 1,
      });
    const player = new PlayerPhysics(world);
    run(player, 85, { x: 1, z: 0 });
    expect(player.position.x).toBeGreaterThan(3);
    expect(player.position.y).toBeGreaterThan(2.5);
    const bridgeWorld = new CollisionWorld();
    bridgeWorld.add({
      minX: -3,
      maxX: 3,
      minY: 2.7,
      maxY: 3,
      minZ: 1,
      maxZ: 3,
    });
    const walker = new PlayerPhysics(bridgeWorld);
    run(walker, 90, { x: 0, z: 1 });
    expect(walker.position.z).toBeGreaterThan(3);
    expect(walker.position.y).toBe(1.75);
  });
  it("resets momentum on teleport", () => {
    const player = new PlayerPhysics(new CollisionWorld());
    run(player, 60, { x: 1, z: 0 }, true);
    player.teleport(40, 30);
    expect(player.position).toEqual({ x: 40, y: 1.75, z: 30 });
    expect(player.velocity).toEqual({ x: 0, y: 0, z: 0 });
    player.teleport(40, 30, 10.8);
    expect(player.position).toEqual({ x: 40, y: 12.55, z: 30 });
  });
});
