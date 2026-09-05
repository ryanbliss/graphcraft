import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeProject } from "../src/graph/analyze.ts";
import { furnishBuilding } from "../src/world/interiors.ts";
import { VoxelBatch, disposeGroup } from "../src/world/geometry.ts";
import * as petModels from "../src/world/pet-models.ts";
import { animationCatalog } from "../src/world/pet-animations.ts";
afterEach(() => vi.restoreAllMocks());
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { PetTrail, Pets } from "../src/world/pets.ts";
import { CollisionWorld } from "../src/world/physics.ts";
import { layoutWorld } from "../src/world/layout.ts";
import type { ProjectGraph } from "../src/graph/types.ts";

describe("pet companions", () => {
  it("records feet along corners and stairs instead of cutting straight to the player", () => {
    const trail = new PetTrail();
    for (const point of [
      { x: 0, y: 1.75, z: 0 },
      { x: 0, y: 1.75, z: 1 },
      { x: 1, y: 2.05, z: 1 },
      { x: 2, y: 2.35, z: 1 },
    ])
      expect(trail.record(point)).toBe(true);
    expect(trail.points.map((p) => p.toArray())).toEqual([
      [0, 0, 0],
      [0, 0, 1],
      [1, 0.2999999999999998, 1],
      [2, 0.6000000000000001, 1],
    ]);
    expect(trail.record({ x: 100, y: 12.55, z: 0 })).toBe(false);
    expect(trail.points).toHaveLength(0);
    trail.record({ x: 101, y: 12.55, z: 0 });
    expect(trail.points[0].y).toBeCloseTo(10.8);
  });
  it("bounds long walking trails", () => {
    const trail = new PetTrail();
    for (let x = 0; x < 1000; x++) trail.record({ x, y: 1.75, z: 0 });
    expect(trail.points).toHaveLength(512);
    expect(trail.points[0].x).toBe(488);
  });
  it("populates a small cast and follows through an entrance", () => {
    const graph: ProjectGraph = JSON.parse(
      readFileSync("public/demo.graph.json", "utf8"),
    );
    const layout = layoutWorld(graph),
      home = layout.buildings[0];
    const scene = new THREE.Scene(),
      pets = new Pets(layout, new CollisionWorld(), scene);
    const player = {
      position: { x: home.x, y: 1.75, z: home.z + home.depth / 2 + 4 },
      grounded: true,
      active: true,
    };
    const camera = new THREE.Vector3().copy(player.position);
    pets.update(1 / 60, camera, player);
    const root = scene.getObjectByName("Neighborhood pets")!;
    expect(root.children.length).toBeLessThanOrEqual(4);
    expect(new Set(root.children.map((pet) => pet.name))).toEqual(
      new Set(["Cyber cat", "Cyber dog"]),
    );
    const nearest = root.children
      .filter((child) => child.visible)
      .sort(
        (a, b) => a.position.distanceTo(camera) - b.position.distanceTo(camera),
      )[0];
    const original = nearest.position.clone();
    for (let frame = 0; frame < 120; frame++)
      pets.update(1 / 60, camera, player);
    expect(nearest.position.toArray()).toEqual(original.toArray());
    for (let i = 0; i < 240; i++) {
      player.position.z -= 0.035;
      camera.copy(player.position);
      pets.update(1 / 60, camera, player);
    }
    expect(nearest.position.z).toBeLessThan(original.z - 1);
    expect(
      nearest.position.distanceTo(
        new THREE.Vector3(player.position.x, 0, player.position.z),
      ),
    ).toBeGreaterThan(3);
    expect(
      nearest.position.distanceTo(
        new THREE.Vector3(player.position.x, 0, player.position.z),
      ),
    ).toBeLessThan(6);
    pets.dispose();
    expect(scene.children).toHaveLength(0);
  });
});

function walkingRoute(
  start: THREE.Vector3,
  target: THREE.Vector3,
  building: ReturnType<typeof layoutWorld>["buildings"][number],
  collisions: CollisionWorld,
) {
  const clear = (point: THREE.Vector3) => {
    for (const box of collisions.nearby(point)) {
      if (box.maxY <= point.y + 0.08 || box.minY >= point.y + 1.75) continue;
      const dx = Math.max(box.minX, Math.min(point.x, box.maxX)) - point.x;
      const dz = Math.max(box.minZ, Math.min(point.z, box.maxZ)) - point.z;
      if (dx * dx + dz * dz < 0.4 ** 2) return false;
    }
    return true;
  };
  const lineClear = (a: THREE.Vector3, b: THREE.Vector3) => {
    const count = Math.max(1, Math.ceil(a.distanceTo(b) / 0.15));
    for (let index = 0; index <= count; index++)
      if (!clear(a.clone().lerp(b, index / count))) return false;
    return true;
  };
  if (lineClear(start, target)) return [target];
  const queue = [{ x: 0, z: 0, parent: -1 }];
  const seen = new Set(["0:0"]);
  let end = -1;
  for (let index = 0; index < queue.length && index < 30000; index++) {
    const node = queue[index];
    const point = start
      .clone()
      .add(new THREE.Vector3(node.x * 0.35, 0, node.z * 0.35));
    if (point.distanceTo(target) < 0.5 && lineClear(point, target)) {
      end = index;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = node.x + dx,
        z = node.z + dz,
        key = `${x}:${z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const next = start.clone().add(new THREE.Vector3(x * 0.35, 0, z * 0.35));
      if (
        Math.abs(next.x - building.x) > building.width / 2 + 4 ||
        Math.abs(next.z - building.z) > building.depth / 2 + 7
      )
        continue;
      if (clear(next)) queue.push({ x, z, parent: index });
    }
  }
  if (end < 0)
    throw new Error(
      `No physical walking route from ${start.toArray()} to ${target.toArray()}.`,
    );
  const points = [target];
  for (let index = end; index > 0; index = queue[index].parent)
    points.push(
      start
        .clone()
        .add(
          new THREE.Vector3(queue[index].x * 0.35, 0, queue[index].z * 0.35),
        ),
    );
  points.push(start);
  points.reverse();
  const route: THREE.Vector3[] = [];
  for (let index = 0; index < points.length - 1;) {
    let next = points.length - 1;
    while (next > index + 1 && !lineClear(points[index], points[next])) next--;
    route.push(points[next]);
    index = next;
  }
  return route;
}

function furnishedCompanion() {
  const graph = analyzeProject(
    [20, 88, 69, 1, 2, 3, 4].flatMap((room) =>
      Array.from(
        { length: room === 88 || room === 69 ? 12 : 8 },
        (_, index) => ({
          path: `src/room${room}/file${index}.ts`,
          content: "export const value = 1",
        }),
      ),
    ),
    "pets",
  );
  const layout = layoutWorld(graph);
  const entry = [...layout.positions].find(
    ([, position]) => position.furniture === "bed",
  );
  if (!entry) throw new Error("The generated fixture has no bed.");
  const [id, item] = entry;
  const building = layout.buildings.find(
    (candidate) => candidate.id === item.buildingId,
  )!;
  const room = building.rooms.find((candidate) =>
    candidate.nodeIds.includes(id),
  )!;
  const collisions = new CollisionWorld();
  const scene = new THREE.Scene();
  const batches = [new VoxelBatch(), new VoxelBatch(true), new VoxelBatch()];
  furnishBuilding(
    building,
    layout,
    batches[0],
    batches[1],
    batches[2],
    collisions,
    new Set(),
  );
  const furnitureMeshes = batches.map((batch) => batch.build(scene));
  const clips = new Set<string>();
  const observed: { pet?: THREE.Object3D } = {};
  const original = petModels.createPet;
  vi.spyOn(petModels, "createPet").mockImplementation((kind, seed) => {
    const model = original(kind, seed);
    const animate = model.animate;
    model.animate = (clip, time, locomotion) => {
      if (model.group === observed.pet) clips.add(clip.name);
      animate(clip, time, locomotion);
    };
    return model;
  });
  const pets = new Pets(layout, collisions, scene);
  const normal = new THREE.Vector3(
    Math.sin(item.rotation),
    0,
    Math.cos(item.rotation),
  );
  const approach = new THREE.Vector3(
    item.x,
    item.floorY,
    item.z,
  ).addScaledVector(normal, 2.5);
  const entrance = new THREE.Vector3(
    building.x,
    0,
    building.z + building.depth / 2 + 2,
  );
  const player = {
    position: { x: building.x, y: 1.75, z: entrance.z - 3 },
    grounded: true,
    active: false,
  };
  const camera = new THREE.Vector3(
    building.x,
    2,
    building.z + building.depth / 2,
  );
  pets.update(0.08, camera, player);
  const root = scene.getObjectByName("Neighborhood pets")!;
  const pet = root.children.find(
    (child) =>
      child.name === "Cyber cat" &&
      Math.abs(child.position.x - building.x) < 2 &&
      Math.abs(child.position.z - entrance.z) < 0.1,
  )!;
  if (!pet) throw new Error("The fixture house has no cat.");
  observed.pet = pet;
  const homePosition = pet.position.clone();
  player.active = true;
  const history: THREE.Vector3[] = [];
  const tick = (seconds: number) => {
    for (let time = 0; time < seconds; time += 0.08) {
      camera.copy(player.position);
      pets.update(0.08, camera, player);
      history.push(pet.position.clone());
    }
  };
  const walk = (target: THREE.Vector3) => {
    const start = new THREE.Vector3(
      player.position.x,
      player.position.y - 1.75,
      player.position.z,
    );
    const route = walkingRoute(start, target, building, collisions);
    let previous = start;
    for (const waypoint of route) {
      const steps = Math.ceil(previous.distanceTo(waypoint) / 0.56);
      for (let index = 1; index <= steps; index++) {
        const point = previous.clone().lerp(waypoint, index / steps);
        player.position = { x: point.x, y: point.y + 1.75, z: point.z };
        tick(0.08);
      }
      previous = waypoint;
    }
  };
  tick(0.3);
  const route = [
    new THREE.Vector3(building.hallX, 0, entrance.z - 7),
    new THREE.Vector3(building.hallX, room.floorY, room.door.z),
    new THREE.Vector3(room.door.x, room.floorY, room.door.z),
    approach,
  ];
  for (const point of route) walk(point);
  return {
    pets,
    scene,
    player,
    pet,
    item,
    room,
    approach,
    normal,
    clips,
    tick,
    walk,
    furnitureMeshes,
    building,
    collisions,
    homePosition,
    route,
    history,
  };
}

it("lets the cat reach and rest on a real bed", () => {
  const height = 0.8;
  const fixture = furnishedCompanion();
  const { item, pet, tick, clips, furnitureMeshes, scene, pets } = fixture;
  let maximum = pet.position.y;
  for (let step = 0; step < 450; step++) {
    tick(0.08);
    maximum = Math.max(maximum, pet.position.y);
    if (Math.abs(pet.position.y - item.floorY - height) < 0.00001) break;
  }
  tick(0.5);

  expect(pet.position.y).toBeCloseTo(item.floorY + height);
  expect(maximum).toBeGreaterThan(item.floorY + height + 0.05);
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    pet.position.clone().add(new THREE.Vector3(0, 0.1, 0)),
    new THREE.Vector3(0, -1, 0),
    0,
    0.2,
  );
  expect(ray.intersectObjects(furnitureMeshes)[0]?.distance).toBeCloseTo(0.1);
  expect(clips.has("cat-jump")).toBe(true);
  expect(clips.has("cat-curl")).toBe(true);
  expect(pet.getObjectByName("tail-tip")!.rotation.y).toBeGreaterThan(1);
  tick(100);
  const restClips = animationCatalog.filter(
    (animation) => clips.has(animation.name) && animation.tags.includes("rest"),
  );
  expect(restClips.length).toBeGreaterThan(1);
  expect(pet.position.y).toBeCloseTo(item.floorY + height);
  pets.dispose();
  disposeGroup(scene);
});

it("resumes current breadcrumbs after a bed detour instead of replaying the old approach", () => {
  const fixture = furnishedCompanion();
  const { pet, player, item, room, tick, walk, pets, scene } = fixture;
  for (
    let time = 0;
    time < 36 && Math.abs(pet.position.y - item.floorY - 0.8) > 0.00001;
    time += 0.08
  )
    tick(0.08);
  expect(pet.position.y).toBeCloseTo(item.floorY + 0.8);
  const doorway = new THREE.Vector3(room.door.x, item.floorY, room.door.z);
  walk(doorway);
  const outside = doorway
    .clone()
    .add(
      new THREE.Vector3(
        Math.sin(room.door.rotation) * 3,
        0,
        Math.cos(room.door.rotation) * 3,
      ),
    );
  walk(outside);
  tick(5);
  expect(pet.position.y).toBeCloseTo(item.floorY + 0.04);
  const feet = new THREE.Vector3(
    player.position.x,
    item.floorY,
    player.position.z,
  );
  expect(pet.position.distanceTo(feet)).toBeGreaterThan(3);
  expect(pet.position.distanceTo(feet)).toBeLessThan(4.2);
  const before = pet.position.clone();
  tick(4);
  expect(pet.position.distanceTo(before)).toBeLessThan(0.1);
  pets.dispose();
  disposeGroup(scene);
});

it("keeps paws above paths and returns home along the walked route when the player leaves", () => {
  const fixture = furnishedCompanion();
  const {
    pet,
    item,
    building,
    homePosition,
    route,
    history,
    collisions,
    tick,
    walk,
    pets,
    scene,
  } = fixture;
  expect(homePosition.y).toBeCloseTo(0.14);
  for (
    let time = 0;
    time < 36 && Math.abs(pet.position.y - item.floorY - 0.8) > 0.00001;
    time += 0.08
  )
    tick(0.08);
  expect(pet.position.y).toBeCloseTo(item.floorY + 0.8);
  const start = history.length;
  for (const point of route.slice(0, -1).reverse()) walk(point);
  walk(new THREE.Vector3(building.x, 0, building.z + building.depth / 2 + 8));
  tick(45);
  expect(pet.position.distanceTo(homePosition)).toBeLessThan(0.05);
  const settled = pet.position.clone();
  tick(8);
  expect(pet.position.distanceTo(settled)).toBeLessThan(0.01);
  for (let index = start + 1; index < history.length; index++) {
    const point = history[index];
    if (point.y > 0.2) continue;
    for (const box of collisions.nearby(point)) {
      if (box.maxY <= point.y + 0.08 || box.minY >= point.y + 0.66) continue;
      const dx = Math.max(box.minX, Math.min(point.x, box.maxX)) - point.x;
      const dz = Math.max(box.minZ, Math.min(point.z, box.maxZ)) - point.z;
      expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(0.2);
    }
    const previous = history[index - 1];
    if (previous.y > 0.2) continue;
    expect(
      Math.hypot(point.x - previous.x, point.z - previous.z),
    ).toBeLessThanOrEqual(3.81 * 0.08);
  }
  pets.dispose();
  disposeGroup(scene);
});
