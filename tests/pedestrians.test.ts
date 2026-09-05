import { expect, it } from "vitest";
import * as THREE from "three";
import type { WorldLayout } from "../src/world/layout.ts";
import { Pedestrians } from "../src/world/pedestrians.ts";

function layout(count = 1, length = 35): WorldLayout {
  return {
    buildings: [],
    districts: [],
    regions: [],
    positions: new Map(),
    width: length,
    depth: count * 20,
    spawn: { x: 0, z: 0 },
    paths: Array.from({ length: count }, (_, index) => ({
      source: `source:${index}`,
      target: `target:${index}`,
      points: [
        { x: 0, z: index * 20 },
        { x: length, z: index * 20 },
      ],
    })),
  };
}

it("creates a sparse deterministic population with varied outfits and articulated anatomy", () => {
  const a = new THREE.Scene(),
    b = new THREE.Scene();
  const first = new Pedestrians(layout(40, 100), a);
  const second = new Pedestrians(layout(40, 100), b);
  const people = a.getObjectByName("Pedestrians")!.children;
  const repeated = b.getObjectByName("Pedestrians")!.children;
  expect(people).toHaveLength(8);
  const colors = new Set<string>();
  for (let index = 0; index < people.length; index++) {
    const person = people[index];
    expect(person.position).toEqual(repeated[index].position);
    const bounds = new THREE.Box3().setFromObject(person);
    expect(bounds.max.y).toBeGreaterThan(1.8);
    expect(bounds.max.y).toBeLessThan(2);
    expect(bounds.min.y).toBeGreaterThanOrEqual(0.024);
    expect(person.getObjectByName("Elbow")!.parent!.name).toBe("Shoulder");
    expect(person.getObjectByName("Knee")!.parent!.name).toBe("Hip");
    const jacket = person.getObjectByName("Jacket")!.children[0];
    expect(jacket).toBeInstanceOf(THREE.InstancedMesh);
    if (jacket instanceof THREE.InstancedMesh) {
      const color = new THREE.Color();
      jacket.getColorAt(0, color);
      colors.add(color.getHexString());
    }
  }
  expect(colors.size).toBe(4);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 1, 5),
    new THREE.Vector3(0, 0, -1),
  );
  expect(ray.intersectObject(a.getObjectByName("Pedestrians")!, true)).toEqual(
    [],
  );
  first.dispose();
  second.dispose();
});

it("walks beside the paths, pauses, and reverses continuously without teleporting at their ends", () => {
  const scene = new THREE.Scene();
  const pedestrians = new Pedestrians(layout(), scene);
  const person = scene.getObjectByName("Pedestrians")!.children[0];
  const viewer = new THREE.Vector3(-100, 2, 100);
  const previous = person.position.clone();
  let previousHeading = person.rotation.y;
  let forward = false,
    backward = false,
    paused = false,
    jointMoved = false;
  for (let step = 0; step < 1800; step++) {
    pedestrians.update(0.1, viewer);
    const dx = person.position.x - previous.x;
    forward ||= dx > 0.001;
    backward ||= dx < -0.001;
    paused ||= Math.abs(dx) < 0.00001;
    jointMoved ||= Math.abs(person.getObjectByName("Knee")!.rotation.x) > 0.1;
    expect(Math.abs(dx)).toBeLessThanOrEqual(0.121);
    expect(person.position.x).toBeGreaterThanOrEqual(2.5);
    expect(person.position.x).toBeLessThanOrEqual(32.5);
    expect(person.position.z).toBe(-1.9);
    const turn = Math.atan2(
      Math.sin(person.rotation.y - previousHeading),
      Math.cos(person.rotation.y - previousHeading),
    );
    expect(Math.abs(turn)).toBeLessThan(0.82);
    previous.copy(person.position);
    previousHeading = person.rotation.y;
  }
  expect({ forward, backward, paused, jointMoved }).toEqual({
    forward: true,
    backward: true,
    paused: true,
    jointMoved: true,
  });
  pedestrians.update(60, viewer);
  expect(person.position.distanceTo(previous)).toBeLessThan(0.13);
  pedestrians.dispose();
});

it("stops beside the viewer and resumes after they move away", () => {
  const scene = new THREE.Scene();
  const pedestrians = new Pedestrians(layout(), scene);
  const person = scene.getObjectByName("Pedestrians")!.children[0];
  const initial = person.position.clone();
  const nearby = initial.clone().add(new THREE.Vector3(0, 1.6, 0));
  for (let step = 0; step < 30; step++) pedestrians.update(0.1, nearby);
  expect(person.position.x).toBe(initial.x);
  expect(person.getObjectByName("Elbow")!.rotation.x).toBeLessThan(-0.8);
  for (let step = 0; step < 30; step++)
    pedestrians.update(0.1, new THREE.Vector3(100, 10, 100));
  expect(Math.abs(person.position.x - initial.x)).toBeGreaterThan(1);
  pedestrians.dispose();
});

it("populates a visited neighborhood only with invisible distant actors and restores survey distribution", () => {
  const scene = new THREE.Scene();
  const pedestrians = new Pedestrians(layout(80, 100), scene);
  const people = scene.getObjectByName("Pedestrians")!.children;
  const originalPaths = people.map((person) => person.position.z);
  const previous = people.map((person) => person.position.clone());
  const viewer = new THREE.Vector3(50, 1.6, 710);
  let relocations = 0;
  const advance = (steps: number) => {
    for (let step = 0; step < steps; step++) {
      pedestrians.update(0.1, viewer);
      for (let index = 0; index < people.length; index++) {
        const person = people[index];
        if (person.position.distanceTo(previous[index]) > 1) {
          relocations++;
          expect(person.visible).toBe(false);
          person.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            for (const material of materials) expect(material.opacity).toBe(0);
          });
        }
        previous[index].copy(person.position);
      }
    }
  };
  advance(60);
  expect(relocations).toBeGreaterThan(0);
  const nearby = people.filter(
    (person) => person.visible && person.position.distanceTo(viewer) < 90,
  );
  expect(nearby.length).toBeGreaterThanOrEqual(2);
  expect(nearby.length).toBeLessThanOrEqual(3);
  expect(people[0].position.z).toBe(originalPaths[0]);
  expect(people).toHaveLength(8);
  viewer.y = 250;
  advance(60);
  expect(people.map((person) => person.position.z)).toEqual(originalPaths);
  expect(people.every((person) => person.visible)).toBe(true);
  pedestrians.dispose();
});

it("keeps nearby actors in place while other actors redistribute", () => {
  const scene = new THREE.Scene();
  const pedestrians = new Pedestrians(layout(80, 100), scene);
  const people = scene.getObjectByName("Pedestrians")!.children;
  const nearby = people[3];
  const position = nearby.position.clone();
  const viewer = position.clone().add(new THREE.Vector3(0, 1.6, 0));
  for (let step = 0; step < 100; step++) {
    pedestrians.update(0.1, viewer);
    expect(nearby.position.x).toBe(position.x);
    expect(nearby.position.z).toBe(position.z);
    expect(nearby.visible).toBe(true);
  }
  pedestrians.dispose();
});

it("skips tiny or duplicate paths and disposes only its own resources", () => {
  const scene = new THREE.Scene();
  const original = new THREE.Group();
  scene.add(original);
  const empty = new Pedestrians(layout(3, 10), scene);
  expect(scene.getObjectByName("Pedestrians")!.children).toHaveLength(0);
  empty.dispose();
  const world = layout();
  world.paths.push({
    ...world.paths[0],
    points: [...world.paths[0].points].reverse(),
  });
  const pedestrians = new Pedestrians(world, scene);
  const root = scene.getObjectByName("Pedestrians")!;
  expect(root.children).toHaveLength(1);
  const geometries = new Set<THREE.BufferGeometry>();
  const disposed = new Set<THREE.BufferGeometry>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    object.geometry.addEventListener("dispose", () =>
      disposed.add(object.geometry),
    );
  });
  pedestrians.dispose();
  expect(disposed).toEqual(geometries);
  expect(scene.children).toEqual([original]);
});
