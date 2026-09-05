import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CinemaCamera } from "../src/world/cinema.ts";
import type { WorldLayout } from "../src/world/layout.ts";

function fixture(): WorldLayout {
  return {
    width: 120,
    depth: 100,
    spawn: { x: 0, z: 45 },
    districts: [],
    regions: [],
    paths: [
      {
        source: "a",
        target: "b",
        points: [
          { x: -40, z: 40 },
          { x: 40, z: 40 },
        ],
      },
    ],
    buildings: [
      {
        id: "tower",
        name: "Tower",
        directory: "src",
        parentId: "root",
        packageId: "app",
        nodes: [],
        x: 0,
        z: 0,
        width: 24,
        depth: 24,
        height: 30,
        stories: 5,
        hallX: 0,
        template: "studio",
        kind: "module",
        rooms: [
          {
            id: "room",
            directory: "src",
            name: "Room",
            nodeIds: ["file"],
            floorY: 5.4,
            x: 7,
            z: 0,
            width: 10,
            depth: 12,
            side: "right",
            door: { x: 2, z: 0, rotation: -Math.PI / 2 },
          },
        ],
      },
    ],
    positions: new Map([
      [
        "file",
        {
          x: 8,
          y: 6.5,
          z: 0,
          floorY: 5.4,
          rotation: 0,
          furniture: "desk",
          buildingId: "tower",
        },
      ],
    ]),
  };
}

function view() {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(70, 65, 80);
  const target = new THREE.Vector3(0, 12, 0);
  camera.lookAt(target);
  return { camera, target };
}

describe("survey cinema", () => {
  it("inherits the manual camera on startup and after reset without a cut", () => {
    const cinema = new CinemaCamera(fixture());
    const { camera, target } = view();
    const originalPosition = camera.position.clone();
    const originalTarget = target.clone();
    expect(cinema.update(0, camera, target, [])).toBe(false);
    expect(camera.position.equals(originalPosition)).toBe(true);
    expect(target.equals(originalTarget)).toBe(true);
    for (let i = 0; i < 240; i++) cinema.update(1 / 60, camera, target, []);
    expect(camera.position.equals(originalPosition)).toBe(true);
    expect(target.distanceTo(originalTarget)).toBeGreaterThan(1);
    cinema.reset();
    camera.position.set(-20, 40, 70);
    target.set(0, 10, 5);
    const manualTarget = target.clone();
    cinema.update(0, camera, target, []);
    expect(camera.position.toArray()).toEqual([-20, 40, 70]);
    expect(target.equals(manualTarget)).toBe(true);
    expect(cinema.fadeOpacity).toBe(0);
  });

  it("varies safe street, doorway, and roof shots and conceals distant cuts", () => {
    const cinema = new CinemaCamera(fixture());
    const { camera, target } = view();
    const seen = new Set<string>();
    let lastCut = 0;
    for (let frame = 0; frame < 5400; frame++) {
      const before = camera.position.clone();
      const cut = cinema.update(1 / 60, camera, target, []);
      expect(Number.isFinite(camera.position.length())).toBe(true);
      if (!cut) expect(camera.position.distanceTo(before)).toBeLessThan(1);
      else {
        expect(cinema.fadeOpacity).toBe(1);
        expect((frame - lastCut) / 60).toBeGreaterThanOrEqual(8);
        expect((frame - lastCut) / 60).toBeLessThan(13);
        lastCut = frame;
        if (Math.abs(camera.position.y - 7.6) < 0.01) {
          seen.add("room");
          expect(camera.position.x).toBeCloseTo(2.7);
          expect(camera.position.z).toBe(0);
          expect(target.x).toBe(8);
        } else if (camera.position.y === 2.4) {
          seen.add("path");
          expect(camera.position.z).toBe(40);
          expect(Math.abs(camera.position.x)).toBeLessThan(40);
        } else {
          seen.add("roof");
          expect(camera.position.y).toBeGreaterThan(30);
        }
      }
    }
    expect(seen).toEqual(new Set(["room", "path", "roof"]));
  });

  it("follows a moving world-space courier and fades away when it stops flying", () => {
    const cinema = new CinemaCamera(fixture());
    const { camera, target } = view();
    const parent = new THREE.Group();
    parent.position.set(15, 70, 25);
    const ship = new THREE.Object3D();
    parent.add(ship);
    let following = false;
    for (let frame = 0; frame < 5400; frame++) {
      if (cinema.update(1 / 60, camera, target, [ship]) && target.y === 70) {
        following = true;
        break;
      }
    }
    expect(following).toBe(true);
    const before = camera.position.clone();
    for (let frame = 0; frame < 120; frame++) {
      parent.position.x += 0.1;
      cinema.update(1 / 60, camera, target, [ship]);
    }
    expect(camera.position.x - before.x).toBeGreaterThan(8);
    expect(target.x).toBeGreaterThan(23);
    expect(camera.position.y).toBeGreaterThan(30);
    // A courier may be recycled elsewhere as soon as it stops flying.
    parent.position.set(10000, 10000, 10000);
    let replaced = false;
    for (let frame = 0; frame < 60; frame++) {
      const previous = camera.position.clone();
      if (cinema.update(1 / 60, camera, target, [])) {
        replaced = true;
        expect(cinema.fadeOpacity).toBe(1);
        break;
      }
      expect(camera.position.distanceTo(previous)).toBeLessThan(1);
    }
    expect(replaced).toBe(true);
  });

  it("uses local roof clearance for building shots while retaining obstacle safety", () => {
    for (const nearby of [false, true]) {
      const layout = fixture();
      layout.buildings[0].height = 10;
      layout.buildings.push({
        ...layout.buildings[0],
        id: "tall",
        height: 200,
        x: nearby ? 0 : 1000,
        z: nearby ? 0 : 1000,
        width: 200,
        depth: 200,
        rooms: [],
      });
      const cinema = new CinemaCamera(layout);
      const { camera, target } = view();
      let found = false;
      for (let frame = 0; frame < 4200; frame++) {
        if (
          cinema.update(1 / 30, camera, target, []) &&
          target.x === 0 &&
          target.y === 6.5 &&
          target.z === 0
        ) {
          found = true;
          if (nearby) expect(camera.position.y).toBeGreaterThanOrEqual(204);
          else expect(camera.position.y).toBeLessThan(40);
          break;
        }
      }
      expect(found).toBe(true);
    }
  });

  it("handles an empty layout deterministically", () => {
    const layout = fixture();
    layout.buildings = [];
    layout.paths = [];
    layout.positions.clear();
    const a = new CinemaCamera(layout),
      b = new CinemaCamera(layout);
    const first = view(),
      second = view();
    for (let frame = 0; frame < 1200; frame++) {
      a.update(1 / 60, first.camera, first.target, []);
      b.update(1 / 60, second.camera, second.target, []);
      expect(first.camera.position.equals(second.camera.position)).toBe(true);
      expect(first.target.equals(second.target)).toBe(true);
    }
  });
});
