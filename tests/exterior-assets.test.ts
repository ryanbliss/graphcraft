import { expect, it } from "vitest";
import * as THREE from "three";
import {
  exteriorAssets,
  buildExteriorAsset,
  selectExteriorAsset,
} from "../src/world/exterior-assets.ts";
import { VoxelBatch, disposeGroup } from "../src/world/geometry.ts";

it("provides over fifty named exterior forms and stable category selection", () => {
  expect(exteriorAssets.length).toBeGreaterThan(50);
  expect(new Set(exteriorAssets.map((asset) => asset.id)).size).toBe(
    exteriorAssets.length,
  );
  expect(new Set(exteriorAssets.map((asset) => asset.name)).size).toBe(
    exteriorAssets.length,
  );
  for (let i = 0; i < 100; i++) {
    expect(selectExteriorAsset(`parcel-${i}`)).toBe(
      selectExteriorAsset(`parcel-${i}`),
    );
    expect(selectExteriorAsset(`parcel-${i}`, "foliage").category).toBe(
      "foliage",
    );
  }
});

it("keeps each distinct shape within its placement bounds in every orientation", () => {
  const shapes = new Set<string>();
  for (const asset of exteriorAssets) {
    for (let quarterTurns = 0; quarterTurns < 4; quarterTurns++) {
      const blocks = new VoxelBatch();
      const lights = new VoxelBatch(true);
      const group = new THREE.Group();
      buildExteriorAsset(asset, blocks, lights, {
        x: 10,
        z: -20,
        y: 2,
        quarterTurns,
      });
      const meshes = [blocks.build(group), lights.build(group)];
      const bounds = new THREE.Box3().setFromObject(group);
      const width = quarterTurns % 2 === 0 ? asset.width : asset.depth;
      const depth = quarterTurns % 2 === 0 ? asset.depth : asset.width;
      const epsilon = 0.00001;
      expect(bounds.min.x, `${asset.name} left`).toBeGreaterThanOrEqual(
        10 - width / 2 - epsilon,
      );
      expect(bounds.max.x, `${asset.name} right`).toBeLessThanOrEqual(
        10 + width / 2 + epsilon,
      );
      expect(bounds.min.z, `${asset.name} back`).toBeGreaterThanOrEqual(
        -20 - depth / 2 - epsilon,
      );
      expect(bounds.max.z, `${asset.name} front`).toBeLessThanOrEqual(
        -20 + depth / 2 + epsilon,
      );
      expect(bounds.min.y, `${asset.name} base`).toBeGreaterThanOrEqual(
        2 - epsilon,
      );
      expect(bounds.max.y, `${asset.name} top`).toBeLessThanOrEqual(
        2 + asset.height + epsilon,
      );
      if (quarterTurns === 0)
        shapes.add(
          JSON.stringify(
            meshes.map((mesh) => Array.from(mesh.instanceMatrix.array)),
          ),
        );
      disposeGroup(group);
    }
  }
  expect(shapes.size).toBe(exteriorAssets.length);
});

it("avoids exposed coplanar faces and duplicate boxes even with matching finishes", () => {
  interface Part {
    bounds: [[number, number], [number, number], [number, number]];
    color: string;
  }
  class Parts extends VoxelBatch {
    constructor(
      private parts: Part[],
      private finish: string,
    ) {
      super();
    }
    override add(
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
    ) {
      this.parts.push({
        bounds: [
          [x - w / 2, x + w / 2],
          [y - h / 2, y + h / 2],
          [z - d / 2, z + d / 2],
        ],
        color: `${this.finish}:${color}`,
      });
    }
  }
  const overlaps: string[] = [];
  for (const asset of exteriorAssets) {
    const parts: Part[] = [];
    buildExteriorAsset(
      asset,
      new Parts(parts, "solid"),
      new Parts(parts, "light"),
      { x: 0, z: 0 },
    );
    for (let a = 0; a < parts.length; a++)
      for (let b = a + 1; b < parts.length; b++) {
        const first = parts[a],
          second = parts[b];
        for (let axis = 0; axis < 3; axis++) {
          for (const face of [0, 1]) {
            if (
              Math.abs(first.bounds[axis][face] - second.bounds[axis][face]) >
              0.000001
            )
              continue;
            const otherAxes = [0, 1, 2].filter((other) => other !== axis);
            const intersection = otherAxes.map((other) => [
              Math.max(first.bounds[other][0], second.bounds[other][0]),
              Math.min(first.bounds[other][1], second.bounds[other][1]),
            ]);
            if (intersection.some(([min, max]) => max - min <= 0.000001))
              continue;
            // Branches may meet inside a trunk; only exposed intersections can shimmer.
            const outward =
              first.bounds[axis][face] + (face === 0 ? -0.00001 : 0.00001);
            const buried = parts.some(
              (part, index) =>
                index !== a &&
                index !== b &&
                part.bounds[axis][0] < outward &&
                part.bounds[axis][1] > outward &&
                otherAxes.every(
                  (other, index) =>
                    part.bounds[other][0] <=
                      intersection[index][0] + 0.000001 &&
                    part.bounds[other][1] >= intersection[index][1] - 0.000001,
                ),
            );
            if (!buried)
              overlaps.push(
                `${asset.id}: parts ${a}/${b} (${first.color}/${second.color}), axis ${axis}, face ${face}`,
              );
          }
        }
      }
  }
  expect(overlaps).toEqual([]);
});
