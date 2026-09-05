import { expect, it } from "vitest";
import { flightPosition, flightDuration } from "../src/world/shuttle-flight.ts";
import { CameraHeight } from "../src/world/camera-height.ts";
import { CollisionWorld, PlayerPhysics } from "../src/world/physics.ts";

it("takes off vertically, clears buildings during cruise, and lands without overshooting", () => {
  const from = { x: 20, y: 0, z: -30 },
    to = { x: 800, y: 0, z: 400 };
  expect(flightPosition(from, to, 70, 0)).toEqual(from);
  const lift = flightPosition(from, to, 70, 1);
  expect(lift.x).toBe(from.x);
  expect(lift.y).toBeGreaterThan(0);
  const cruise = flightPosition(from, to, 70, 4);
  expect(cruise.y).toBe(70);
  expect(cruise.x).toBeCloseTo(410);
  expect(flightPosition(from, to, 70, flightDuration + 1)).toEqual(to);
});
it("smooths repeated stair rises while snapping teleports and airborne motion", () => {
  const eye = new CameraHeight();
  eye.reset(1.75);
  let previous = 1.75,
    maxChange = 0;
  for (let frame = 1; frame <= 60; frame++) {
    const target = 1.75 + Math.floor(frame / 6) * 0.27;
    const y = eye.sample(target, true, 1 / 60);
    maxChange = Math.max(maxChange, y - previous);
    previous = y;
    expect(y).toBeLessThanOrEqual(target);
  }
  expect(maxChange).toBeLessThan(0.09);
  expect(eye.sample(40, true, 1 / 60)).toBe(40);
  expect(eye.sample(40.2, false, 1 / 60)).toBe(40.2);
});
it("parachutes onto an elevated roof with bounded descent speed and steering", () => {
  const world = new CollisionWorld();
  world.add({
    minX: -100,
    maxX: 100,
    minY: 0,
    maxY: 12,
    minZ: -100,
    maxZ: 100,
  });
  const player = new PlayerPhysics(world);
  player.teleport(0, 0, 30);
  player.grounded = false;
  for (let tick = 0; tick < 1000 && !player.grounded; tick++) {
    player.step(1 / 120, { x: 0.3, z: 0 }, false, false, "parachute");
    expect(player.velocity.y).toBeGreaterThanOrEqual(-5);
  }
  expect(player.grounded).toBe(true);
  expect(player.position.y).toBe(13.75);
  expect(player.position.x).toBeGreaterThan(3);
});

it("glides four times faster than walking without speeding up descent", () => {
  const world = new CollisionWorld();
  const walker = new PlayerPhysics(world);
  const glider = new PlayerPhysics(world);
  glider.teleport(0, 0, 100);
  glider.grounded = false;
  for (let tick = 0; tick < 120; tick++) {
    walker.step(1 / 120, { x: 1, z: 0 }, false, false);
    glider.step(1 / 120, { x: 1, z: 0 }, false, false, "parachute");
  }
  expect(glider.position.x).toBeCloseTo(walker.position.x * 4);
  expect(glider.velocity.x).toBeGreaterThan(27);
  expect(glider.velocity.y).toBeGreaterThanOrEqual(-5);
});
