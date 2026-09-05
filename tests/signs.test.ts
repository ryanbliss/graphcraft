import {
  extraFurnitureSize,
  isExtraFurniture,
} from "../src/world/extra-furniture.ts";
import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { analyzeProject } from "../src/graph/analyze.ts";
import { hash } from "../src/graph/types.ts";
import {
  cyberFurnitureSize,
  isCyberFurniture,
} from "../src/world/cyber-furniture.ts";
import { layoutWorld, type FurnitureKind } from "../src/world/layout.ts";
import { buildingSigns, filePlacards } from "../src/world/signs.ts";
import { furnishArtifact, furnitureSize } from "../src/world/furniture.ts";
import { furnishBuilding } from "../src/world/interiors.ts";
import { disposeGroup, VoxelBatch } from "../src/world/geometry.ts";
import { CollisionWorld } from "../src/world/physics.ts";

afterEach(() => vi.unstubAllGlobals());

it("places both hallway signs in front of their solid doorway headers", () => {
  const context = {
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    measureText: (text: string) => ({ width: text.length * 10 }),
  };
  vi.stubGlobal("document", {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
  const graph = analyzeProject(
    ["one", "two"].flatMap((directory) =>
      Array.from({ length: 4 }, (_, index) => ({
        path: `src/${directory}/file${index}.ts`,
        content: "export const value = 1",
      })),
    ),
    "doorway signs",
  );
  const layout = layoutWorld(graph);
  const scene = new THREE.Group();
  const signs = buildingSigns(layout, graph, scene);
  const blocks = new VoxelBatch();
  for (const building of layout.buildings)
    furnishBuilding(
      building,
      layout,
      blocks,
      new VoxelBatch(true),
      new VoxelBatch(),
      new CollisionWorld(),
      new Set(),
    );
  const walls = blocks.build(scene);
  scene.updateMatrixWorld(true);
  const sides = new Set<string>();
  for (const building of layout.buildings) {
    for (const room of building.rooms) {
      sides.add(room.side);
      const normal = new THREE.Vector3(
        Math.sin(room.door.rotation),
        0,
        Math.cos(room.door.rotation),
      );
      const origin = new THREE.Vector3(
        room.door.x,
        room.floorY + 4,
        room.door.z,
      ).addScaledVector(normal, 2);
      const ray = new THREE.Raycaster(origin, normal.negate(), 0, 3);
      const signHit = ray.intersectObjects(signs)[0];
      const wallHit = ray.intersectObject(walls)[0];
      expect(signHit, room.id).toBeDefined();
      expect(wallHit, room.id).toBeDefined();
      expect(signHit.distance, room.id).toBeLessThan(wallHit.distance - 0.04);
    }
  }
  expect(sides.size).toBe(2);
  disposeGroup(scene);
});

function recordingCanvas() {
  const draws: {
    text: string;
    font: number;
    width: number;
    available: number;
    scaleX: number;
    scaleY: number;
  }[] = [];
  const context = {
    font: "",
    available: 0,
    scaleX: 1,
    scaleY: 1,
    save() {},
    restore() {},
    translate() {},
    strokeRect() {},
    scale(x: number, y: number) {
      this.scaleX = x;
      this.scaleY = y;
    },
    fillRect(_x: number, _y: number, width: number) {
      this.available = width - 24;
    },
    measureText(text: string) {
      return {
        width: text.length * Number.parseFloat(this.font.split(" ")[1]) * 0.6,
      };
    },
    fillText(text: string) {
      draws.push({
        text,
        font: Number.parseFloat(this.font.split(" ")[1]),
        width: this.measureText(text).width,
        available: this.available,
        scaleX: this.scaleX,
        scaleY: this.scaleY,
      });
    },
  };
  vi.stubGlobal("document", {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
  return draws;
}

it("fits complete filenames uniformly before considering word-boundary wrapping", () => {
  for (const name of [
    "compare.spec.ts",
    "benchmarks.ts",
    "dependencyResolutionSynchronizationCoordinator.spec.ts",
  ]) {
    const draws = recordingCanvas();
    const graph = analyzeProject(
      [{ path: `src/${name}`, content: "export const value = 1" }],
      "labels",
    );
    const layout = layoutWorld(graph);
    const node = graph.nodes[0];
    for (const kind of Object.keys(furnitureSize) as FurnitureKind[]) {
      const scene = new THREE.Group();
      layout.positions.set(node.id, {
        x: 0,
        y: 3,
        z: 0,
        floorY: 0,
        rotation: 0,
        furniture: kind,
        buildingId: "building",
      });
      const start = draws.length;
      const [mesh] = filePlacards(layout, graph, scene);
      const lines = draws.slice(start);
      if (name !== "dependencyResolutionSynchronizationCoordinator.spec.ts") {
        expect(
          lines.map((line) => line.text),
          kind,
        ).toEqual([name]);
      } else {
        expect(lines.map((line) => line.text).join(""), kind).toBe(name);
        expect(lines.at(-1)!.text.endsWith(".spec.ts"), kind).toBe(true);
      }
      const vertices = mesh.geometry.getAttribute("position");
      const width = vertices.getX(1) - vertices.getX(0);
      const height = vertices.getY(2) - vertices.getY(1);
      for (const line of lines) {
        expect(line.width, kind).toBeLessThanOrEqual(line.available);
        // Canvas scaling and the physical quad cancel, preserving glyph proportions.
        expect((line.scaleX * width) / 512, kind).toBeCloseTo(
          (line.scaleY * height) / 48,
          6,
        );
      }
      if (kind === "lamp" && name === "compare.spec.ts")
        expect(lines[0].font).toBeLessThan(64);
      disposeGroup(scene);
    }
  }
});

it("backs every plaque corner with real furniture and leaves its reading face clear", () => {
  recordingCanvas();
  const variants = new Map<number, string>();
  for (let index = 0; variants.size < 3; index++) {
    const path = `src/variant${index}/compare.spec.ts`;
    variants.set(hash(`${path}:shape`) % 3, path);
  }
  const kinds: FurnitureKind[] = [
    "painting",
    "cabinet",
    ...Object.keys(cyberFurnitureSize).filter(isCyberFurniture),
    ...Object.keys(extraFurnitureSize).filter(isExtraFurniture),
  ];
  for (const [variant, path] of variants) {
    const graph = analyzeProject(
      [{ path, content: "export const value = 1" }],
      "mounts",
    );
    const layout = layoutWorld(graph),
      node = graph.nodes[0];
    expect(hash(`${node.id}:shape`) % 3).toBe(variant);
    for (const kind of kinds)
      for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const label = `${kind}, variant ${variant}, rotation ${rotation / Math.PI}π`;
        const scene = new THREE.Group();
        const position = {
          x: 0,
          y: 3,
          z: 0,
          floorY: 0,
          rotation,
          furniture: kind,
          buildingId: "building",
        };
        layout.positions.set(node.id, position);
        const [plaque] = filePlacards(layout, graph, scene);
        const vertices = plaque.geometry.getAttribute("position");
        const corners = Array.from({ length: 4 }, (_, index) =>
          new THREE.Vector3().fromBufferAttribute(vertices, index),
        );
        const center = corners
          .reduce((sum, point) => sum.add(point), new THREE.Vector3())
          .multiplyScalar(0.25);
        if (kind === "painting" || kind === "cabinet") {
          expect(corners[0].distanceTo(corners[1]), label).toBeCloseTo(
            kind === "painting" ? 2.1 : 1.2,
          );
          if (rotation === 0) expect(center.x, label).toBeCloseTo(0);
        }
        if (kind === "painting") {
          expect(corners[0].y, label).toBeCloseTo(2.21);
          expect(corners[2].y, label).toBeCloseTo(2.39);
        }
        const normal = corners[1]
          .clone()
          .sub(corners[0])
          .cross(corners[2].clone().sub(corners[0]))
          .normalize();
        const batches = [
          new VoxelBatch(),
          new VoxelBatch(true),
          new VoxelBatch(),
        ];
        furnishArtifact(
          node,
          position,
          batches[0],
          batches[1],
          batches[2],
          new CollisionWorld(),
          false,
        );
        const furniture = batches.map((batch) => batch.build(scene));
        scene.updateMatrixWorld(true);
        const samples = [
          ...corners.map((corner) => corner.clone().lerp(center, 0.01)),
          center,
        ];
        for (const [index, sample] of samples.entries()) {
          const detail = `${label}, sample ${index}`;
          const ray = new THREE.Raycaster(
            sample.clone().addScaledVector(normal, 4),
            normal.clone().negate(),
            0,
            4.1,
          );
          const labelHit = ray.intersectObject(plaque)[0];
          const bodyHit = ray.intersectObjects(furniture)[0];
          expect.soft(labelHit, detail).toBeDefined();
          expect.soft(bodyHit, detail).toBeDefined();
          if (!labelHit || !bodyHit) continue;
          expect
            .soft(bodyHit.distance - labelHit.distance, detail)
            .toBeGreaterThan(0.01);
          if (index < corners.length)
            expect
              .soft(bodyHit.distance - labelHit.distance, detail)
              .toBeLessThan(0.04);
        }
        disposeGroup(scene);
      }
  }
});
