import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { StreetTraffic, insideVehicle } from "../src/world/street-traffic.ts";
import { CollisionWorld } from "../src/world/physics.ts";
import { Pedestrians, sidewalkRoutes } from "../src/world/pedestrians.ts";
import type { WorldLayout } from "../src/world/layout.ts";

function layout(): WorldLayout {
  return {
    width: 60,
    depth: 30,
    buildings: [],
    districts: [],
    regions: [],
    positions: new Map(),
    spawn: { x: -28, z: 0 },
    paths: [
      {
        source: "a",
        target: "b",
        points: [
          { x: -30, z: 0 },
          { x: 30, z: 0 },
        ],
      },
    ],
  };
}

describe("shared streets", () => {
  it("brakes for a crossing player and resumes after the lane clears", () => {
    const traffic = new StreetTraffic(layout(), new THREE.Scene());
    const player = { x: -15, y: 1.75, z: -0.6 };
    for (let frame = 0; frame < 600; frame++)
      traffic.update(1 / 60, [], player);
    const car = traffic.vehicles[0];
    expect(car.position.x).toBeLessThan(player.x - 1.6);
    const stopped = car.position.x;
    for (let frame = 0; frame < 60; frame++) traffic.update(1 / 60, [], player);
    expect(car.position.x - stopped).toBeLessThan(0.01);
    player.z = 3;
    for (let frame = 0; frame < 120; frame++)
      traffic.update(1 / 60, [], player);
    expect(car.position.x - stopped).toBeGreaterThan(4);
    traffic.dispose();
  });

  it("places pedestrians beside traffic without lateral dodging", () => {
    const graph = layout(),
      scene = new THREE.Scene();
    const traffic = new StreetTraffic(graph, scene),
      people = new Pedestrians(graph, scene);
    const viewer = new THREE.Vector3(0, 30, 20);
    let traveled = 0;
    for (let frame = 0; frame < 2400; frame++) {
      const before = people.positions[0].x;
      people.update(1 / 60, viewer);
      traffic.update(1 / 60, people.positions);
      const person = people.positions[0],
        car = traffic.vehicles[0];
      expect(person.z).toBe(-1.9);
      expect(Math.abs(person.z) - 0.38).toBeGreaterThan(1.2);
      expect(insideVehicle(person, car, 0.38)).toBe(false);
      traveled += Math.abs(person.x - before);
    }
    expect(traveled).toBeGreaterThan(15);
    traffic.dispose();
    people.dispose();
  });

  it("chooses an unobstructed sidewalk side and skips routes with neither side clear", () => {
    const graph = layout(),
      colliders = new CollisionWorld();
    colliders.add({
      minX: -1,
      maxX: 1,
      minZ: -2.3,
      maxZ: -1.5,
      minY: 0,
      maxY: 1.5,
    });
    const routes = sidewalkRoutes(graph, colliders);
    expect(routes).toHaveLength(1);
    expect(routes[0].from.z).toBe(1.9);
    expect(routes[0].to.z).toBe(1.9);
    graph.buildings.push({
      id: "wall",
      name: "wall",
      directory: "wall",
      parentId: "root",
      packageId: "app",
      nodes: [],
      rooms: [],
      x: 0,
      z: 1.9,
      width: 3,
      depth: 1,
      height: 10,
      stories: 1,
      hallX: 0,
      template: "studio",
      kind: "module",
    });
    expect(sidewalkRoutes(graph, colliders)).toHaveLength(0);
  });
});
