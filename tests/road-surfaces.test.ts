import { expect, it } from "vitest";
import * as THREE from "three";
import {
  buildRoadSurfaces,
  unionSurfaces,
  type SurfaceRect,
} from "../src/world/road-surfaces.ts";
import { VoxelBatch, disposeGroup } from "../src/world/geometry.ts";
import type { NavigationPath } from "../src/world/layout.ts";

function boxes(paths: NavigationPath[]) {
  const b = new VoxelBatch(),
    l = new VoxelBatch(true),
    root = new THREE.Group();
  buildRoadSurfaces(paths, b, l);
  b.build(root);
  l.build(root);
  const output: THREE.Box3[] = [];
  for (const child of root.children) {
    const mesh = child as THREE.InstancedMesh;
    for (let i = 0; i < mesh.count; i++) {
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(i, m);
      output.push(
        new THREE.Box3(
          new THREE.Vector3(-0.5, -0.5, -0.5),
          new THREE.Vector3(0.5, 0.5, 0.5),
        ).applyMatrix4(m),
      );
    }
  }
  disposeGroup(root);
  return output;
}
function overlap(a: SurfaceRect, b: SurfaceRect) {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 1e-4 &&
    Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 1e-4
  );
}
it("unions duplicates, reversed partial runs, crossings and touching surfaces without filling gaps", () => {
  const input = [
    { minX: 0, maxX: 10, minZ: 0, maxZ: 2 },
    { minX: 0, maxX: 10, minZ: 0, maxZ: 2 },
    { minX: 5, maxX: 15, minZ: 0, maxZ: 2 },
    { minX: 6, maxX: 8, minZ: -4, maxZ: 6 },
    { minX: 15, maxX: 18, minZ: 0, maxZ: 2 },
    { minX: 20, maxX: 22, minZ: 0, maxZ: 2 },
  ];
  const output = unionSurfaces(input);
  expect(
    output.reduce((sum, r) => sum + (r.maxX - r.minX) * (r.maxZ - r.minZ), 0),
  ).toBe(56);
  for (let i = 0; i < output.length; i++)
    for (let j = i + 1; j < output.length; j++)
      expect(overlap(output[i], output[j])).toBe(false);
  expect(unionSurfaces(input.slice().reverse())).toEqual(output);
  for (let x = -1; x < 24; x += 0.5)
    for (let z = -5; z < 7; z += 0.5) {
      const contains = (r: SurfaceRect) =>
        x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ;
      expect(output.some(contains)).toBe(input.some(contains));
    }
});
it("renders shared roads once at every surface height, independent of dependency order", () => {
  const routes: NavigationPath[] = [
    {
      source: "a",
      target: "b",
      points: [
        { x: 0, z: 0 },
        { x: 60, z: 0 },
      ],
    },
    {
      source: "c",
      target: "d",
      points: [
        { x: 40, z: 0 },
        { x: 10, z: 0 },
      ],
    },
    {
      source: "e",
      target: "f",
      points: [
        { x: 25, z: -20 },
        { x: 25, z: 20 },
      ],
    },
  ];
  const rendered = boxes(routes);
  for (let i = 0; i < rendered.length; i++)
    for (let j = i + 1; j < rendered.length; j++) {
      const a = rendered[i],
        b = rendered[j];
      if (Math.abs(a.max.y - b.max.y) > 1e-4) continue;
      expect(
        overlap(
          { minX: a.min.x, maxX: a.max.x, minZ: a.min.z, maxZ: a.max.z },
          { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z },
        ),
      ).toBe(false);
    }
  expect(boxes(routes.slice().reverse())).toEqual(rendered);
});

it("fills bends and keeps edge rails out of through lanes at elbows and junctions", () => {
  for (const points of [
    [
      { x: -12, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: 12 },
    ],
    [
      { x: -12, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: 3 },
      { x: 12, z: 3 },
    ],
  ]) {
    const rendered = boxes([{ source: "street", target: "door", points }]);
    const pavement = rendered.filter(
      (box) => Math.abs(box.max.y - 0.055) < 1e-5,
    );
    const rails = rendered.filter((box) => Math.abs(box.max.y - 0.105) < 1e-5);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      for (let t = 0.08; t < 0.99; t += 0.04) {
        const x = a.x + (b.x - a.x) * t,
          z = a.z + (b.z - a.z) * t;
        expect(
          pavement.some((box) =>
            box.containsPoint(new THREE.Vector3(x, 0.04, z)),
          ),
        ).toBe(true);
        expect(
          rails.some((box) => box.containsPoint(new THREE.Vector3(x, 0.1, z))),
        ).toBe(false);
      }
    }
    expect(
      pavement.some((box) =>
        box.containsPoint(new THREE.Vector3(0.8, 0.04, -0.8)),
      ),
    ).toBe(true);
  }
  const cross = boxes([
    {
      source: "west",
      target: "east",
      points: [
        { x: -12, z: 0 },
        { x: 12, z: 0 },
      ],
    },
    {
      source: "south",
      target: "north",
      points: [
        { x: 0, z: -12 },
        { x: 0, z: 12 },
      ],
    },
  ]);
  const rails = cross.filter((box) => Math.abs(box.max.y - 0.105) < 1e-5);
  const crossing = new THREE.Box3(
    new THREE.Vector3(-1, 0.09, -1),
    new THREE.Vector3(1, 0.1, 1),
  );
  expect(rails.some((box) => box.intersectsBox(crossing))).toBe(false);
});
