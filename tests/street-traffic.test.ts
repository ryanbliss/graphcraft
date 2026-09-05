import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  StreetTraffic,
  streetGreen,
  streetNetwork,
} from "../src/world/street-traffic.ts";
import type { WorldLayout } from "../src/world/layout.ts";

function layout(): WorldLayout {
  return {
    width: 100,
    depth: 100,
    buildings: [],
    districts: [],
    regions: [],
    positions: new Map(),
    spawn: { x: 0, z: 0 },
    paths: [
      {
        source: "west",
        target: "east",
        points: [
          { x: -20, z: 0 },
          { x: 20, z: 0 },
        ],
      },
      {
        source: "south",
        target: "north",
        points: [
          { x: 0, z: -20 },
          { x: 0, z: 20 },
        ],
      },
    ],
  };
}
function cars(scene: THREE.Scene) {
  return scene
    .getObjectByName("street-traffic")!
    .children.filter((child) => child.name.startsWith("courier-car-"));
}

describe("street traffic", () => {
  it("splits crossing roads, T junctions and overlaps without duplicate edges", () => {
    const graph = layout();
    graph.paths.push({
      source: "t",
      target: "end",
      points: [
        { x: 10, z: -12 },
        { x: 10, z: 0 },
      ],
    });
    graph.paths.push({
      source: "overlap",
      target: "east",
      points: [
        { x: 0, z: 0 },
        { x: 20, z: 0 },
      ],
    });
    graph.paths.push({
      source: "tiny",
      target: "door",
      points: [
        { x: 20, z: 0 },
        { x: 23, z: 0 },
      ],
    });
    const { nodes } = streetNetwork(graph);
    expect(nodes.find((n) => n.x === 0 && n.z === 0)?.neighbors).toHaveLength(
      4,
    );
    expect(nodes.find((n) => n.x === 10 && n.z === 0)?.neighbors).toHaveLength(
      3,
    );
    expect(nodes.some((n) => n.x === 23)).toBe(false);
    for (const [index, node] of nodes.entries()) {
      expect(new Set(node.neighbors).size).toBe(node.neighbors.length);
      for (const next of node.neighbors) {
        expect(nodes[next].neighbors).toContain(index);
        expect(node.x === nodes[next].x || node.z === nodes[next].z).toBe(true);
      }
    }
  });

  it("retains neighborhood roads beyond the former longest-road limit", () => {
    const graph = layout();
    graph.paths = Array.from({ length: 130 }, (_, index) => ({
      source: String(index),
      target: "end",
      points: [
        { x: 0, z: index * 12 },
        { x: 1000 - index, z: index * 12 },
      ],
    }));
    const { nodes } = streetNetwork(graph);
    expect(nodes.some((node) => node.z === 129 * 12)).toBe(true);
    expect(nodes).toHaveLength(260);
  });

  it("keeps a nearby pool after a district move without relocating visible cars", () => {
    const graph = layout();
    graph.width = graph.depth = 1000;
    graph.paths = [];
    for (let coordinate = -500; coordinate <= 500; coordinate += 100) {
      graph.paths.push({
        source: "x",
        target: "x",
        points: [
          { x: -500, z: coordinate },
          { x: 500, z: coordinate },
        ],
      });
      graph.paths.push({
        source: "z",
        target: "z",
        points: [
          { x: coordinate, z: -500 },
          { x: coordinate, z: 500 },
        ],
      });
    }
    const scene = new THREE.Scene(),
      traffic = new StreetTraffic(graph, scene),
      fleet = cars(scene);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 6500);
    const player = { x: 0, y: 1.75, z: 0 };
    let relocations = 0;
    const advance = (seconds: number) => {
      camera.position.set(player.x, player.y, player.z);
      camera.lookAt(player.x, player.y, player.z - 20);
      camera.updateMatrixWorld();
      const view = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
      for (let frame = 0; frame < seconds * 60; frame++) {
        const before = fleet.map((car) => ({
          position: car.position.clone(),
          visible: car.visible,
        }));
        traffic.update(1 / 60, [], player, camera);
        fleet.forEach((car, index) => {
          car.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              if (material.opacity === 1)
                expect(material.depthWrite).toBe(true);
              if (!car.visible) expect(material.opacity).toBe(0);
            }
          });
          if (!car.visible) expect(traffic.vehicles[index].speed).toBe(0);
          if (car.position.distanceTo(before[index].position) < 5) return;
          relocations++;
          expect(
            before[index].visible &&
              view.intersectsSphere(
                new THREE.Sphere(before[index].position, 3),
              ),
          ).toBe(false);
          expect(view.intersectsSphere(new THREE.Sphere(car.position, 3))).toBe(
            false,
          );
        });
      }
    };
    const nearby = () =>
      fleet.filter(
        (car) =>
          Math.hypot(car.position.x - player.x, car.position.z - player.z) < 90,
      ).length;
    advance(60);
    expect(nearby()).toBeGreaterThanOrEqual(3);
    player.x = 300;
    player.z = 300;
    advance(6);
    expect(nearby()).toBeGreaterThanOrEqual(3);
    advance(54);
    expect(nearby()).toBeGreaterThanOrEqual(3);
    expect(fleet).toHaveLength(8);
    expect(relocations).toBeGreaterThan(0);
    traffic.dispose();
  });

  it("keeps cars outside building entrances", () => {
    const graph = layout();
    graph.buildings.push({
      id: "house",
      name: "House",
      directory: "src",
      parentId: "root",
      packageId: "app",
      nodes: [],
      rooms: [],
      x: 20,
      z: -10,
      width: 10,
      depth: 20,
      height: 10,
      stories: 1,
      hallX: 20,
      template: "studio",
      kind: "module",
    });
    const { nodes } = streetNetwork(graph);
    expect(nodes.some((n) => n.x === 20 && n.z === 0)).toBe(false);
    expect(nodes.some((n) => n.x === 17.5 && n.z === 0)).toBe(true);
  });

  it("uses deterministic sparse cars and continuously traverses roads without teleporting", () => {
    const graph = layout();
    for (let z = 10; z < 150; z += 10)
      graph.paths.push({
        source: String(z),
        target: "other",
        points: [
          { x: -20, z },
          { x: 20, z },
        ],
      });
    const a = new THREE.Scene(),
      b = new THREE.Scene();
    const first = new StreetTraffic(graph, a),
      second = new StreetTraffic(graph, b);
    const fleet = cars(a),
      other = cars(b);
    expect(fleet).toHaveLength(8);
    for (let frame = 0; frame < 1800; frame++) {
      const previous = fleet.map((car) => car.position.clone());
      first.update(1 / 60);
      second.update(1 / 60);
      fleet.forEach((car, index) => {
        expect(car.position.equals(other[index].position)).toBe(true);
        expect(car.position.distanceTo(previous[index])).toBeLessThan(0.35);
        expect(car.position.y).toBe(0);
      });
    }
    first.dispose();
    second.dispose();
    expect(a.children).toHaveLength(0);
  });

  it("keeps close crossings flowing after cars pass between them", () => {
    const graph = layout();
    graph.spawn = { x: -10, z: 0 };
    graph.paths.push({
      source: "close",
      target: "north",
      points: [
        { x: 3, z: -20 },
        { x: 3, z: 20 },
      ],
    });
    const scene = new THREE.Scene(),
      traffic = new StreetTraffic(graph, scene);
    const fleet = cars(scene),
      traveled = fleet.map(() => 0);
    for (let frame = 0; frame < 7200; frame++) {
      const before = fleet.map((car) => car.position.clone());
      traffic.update(1 / 60);
      if (frame >= 3600)
        fleet.forEach(
          (car, index) =>
            (traveled[index] += car.position.distanceTo(before[index])),
        );
    }
    for (const distance of traveled) expect(distance).toBeGreaterThan(30);
    traffic.dispose();
  });

  it("places a full-sized glowing vehicle near spawn without later relocation", () => {
    const graph = layout();
    graph.spawn = { x: -12, z: 1 };
    const scene = new THREE.Scene(),
      traffic = new StreetTraffic(graph, scene);
    const car = cars(scene)[0];
    expect(
      Math.hypot(
        car.position.x - graph.spawn.x,
        car.position.z - graph.spawn.z,
      ),
    ).toBeLessThan(4);
    const size = new THREE.Box3()
      .setFromObject(car)
      .getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(1);
    expect(Math.max(size.x, size.z)).toBeGreaterThan(2.4);
    expect(Math.min(size.x, size.z)).toBeLessThan(1.2);
    let lamps = 0;
    car.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshBasicMaterial
      ) {
        expect(object.material.toneMapped).toBe(false);
        lamps++;
      }
    });
    expect(lamps).toBeGreaterThan(5);
    traffic.dispose();
  });

  it("visibly stops before a red junction and resumes when its signal is green", () => {
    const scene = new THREE.Scene(),
      traffic = new StreetTraffic(layout(), scene);
    const fleet = cars(scene);
    const stationary = new Map<THREE.Object3D, number>(),
      stopped = new Set<THREE.Object3D>(),
      resumed = new Set<THREE.Object3D>();
    for (let frame = 0; frame < 3000; frame++) {
      const before = fleet.map((car) => car.position.clone());
      traffic.update(1 / 60);
      fleet.forEach((car, index) => {
        const travel = car.position.distanceTo(before[index]);
        const count = travel < 0.0001 ? (stationary.get(car) ?? 0) + 1 : 0;
        stationary.set(car, count);
        const axis =
          Math.abs(car.position.x) > Math.abs(car.position.z) ? "x" : "z";
        if (count === 45 && !streetGreen(axis, (frame + 1) / 60)) {
          const queueIndex =
            (Math.max(Math.abs(car.position.x), Math.abs(car.position.z)) -
              2.2) /
            3.2;
          expect(queueIndex).toBeGreaterThanOrEqual(-0.01);
          expect(queueIndex).toBeCloseTo(Math.round(queueIndex), 1);
          stopped.add(car);
        }
        if (
          stopped.has(car) &&
          travel > 0.01 &&
          streetGreen(axis, (frame + 1) / 60)
        )
          resumed.add(car);
      });
    }
    expect(stopped.size).toBeGreaterThan(0);
    expect(resumed.size).toBe(stopped.size);
    traffic.dispose();
  });
});
