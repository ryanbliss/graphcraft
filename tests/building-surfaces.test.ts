import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { buildCity } from "../src/world/city.ts";
import { hash, type ProjectGraph } from "../src/graph/types.ts";
import type { Building, WorldLayout } from "../src/world/layout.ts";
import { disposeGroup } from "../src/world/geometry.ts";

// Isolate the authored shell and roof from furniture and canvas-based street signs.
vi.mock("../src/world/signs.ts", () => ({
  buildingSigns: () => [],
  filePlacards: () => [],
}));
vi.mock("../src/world/streetscape.ts", () => ({
  buildStreetscape: () => ({ signs: [], water: new THREE.ShaderMaterial() }),
}));
vi.mock("../src/world/interiors.ts", async (original) => ({
  ...(await original<typeof import("../src/world/interiors.ts")>()),
  furnishBuilding: () => {},
}));

interface Part {
  bounds: [[number, number], [number, number], [number, number]];
  opaque: boolean;
  color: string;
}

it("keeps shell corners and every roof silhouette free of exposed coplanar faces", () => {
  const graph: ProjectGraph = {
    name: "shell",
    nodes: [],
    edges: [],
    packages: [],
    diagnostics: [],
    cycles: [],
    seed: 0,
  };
  const overlaps: string[] = [];
  for (let variant = 0; variant < 5; variant++) {
    let id = "";
    for (let seed = 0; !id; seed++) {
      const candidate = `shell:${seed}`;
      if (hash(`${candidate}:roof`) % 4 === variant % 4) id = candidate;
    }
    for (const stories of [1, 3]) {
      const building: Building = {
        id,
        name: id,
        directory: "",
        parentId: "root",
        packageId: "root",
        nodes: [],
        x: 0,
        z: 0,
        width: 24,
        depth: 30,
        height: stories * 5.4 + 3.75,
        stories,
        hallX: 0,
        rooms: [],
        template: variant === 4 ? "atrium" : "studio",
        kind: "module",
      };
      const layout: WorldLayout = {
        buildings: [building],
        districts: [
          {
            id: "root",
            name: "fixture",
            x: 0,
            z: 0,
            width: 100,
            depth: 100,
            color: "#55ffff",
          },
        ],
        regions: [],
        paths: [],
        positions: new Map(),
        width: 100,
        depth: 100,
        spawn: { x: 0, z: 0 },
      };
      const city = buildCity(graph, layout);
      const parts: Part[] = [];
      const matrix = new THREE.Matrix4(),
        color = new THREE.Color();
      city.group.traverse((object) => {
        if (!(object instanceof THREE.InstancedMesh)) return;
        const ids = object.userData.ids as (string | undefined)[];
        const material = Array.isArray(object.material)
          ? object.material[0]
          : object.material;
        for (let instance = 0; instance < object.count; instance++) {
          if (ids[instance] !== id) continue;
          object.getMatrixAt(instance, matrix);
          object.getColorAt(instance, color);
          const m = matrix.elements;
          parts.push({
            bounds: [
              [m[12] - m[0] / 2, m[12] + m[0] / 2],
              [m[13] - m[5] / 2, m[13] + m[5] / 2],
              [m[14] - m[10] / 2, m[14] + m[10] / 2],
            ],
            opaque: !material.transparent,
            color: color.getHexString(),
          });
        }
      });
      const epsilon = 0.00001;
      for (let a = 0; a < parts.length; a++)
        for (let b = a + 1; b < parts.length; b++) {
          const first = parts[a],
            second = parts[b];
          for (let axis = 0; axis < 3; axis++)
            for (const face of [0, 1]) {
              const plane = first.bounds[axis][face];
              if (axis === 1 && face === 0 && plane < epsilon) continue;
              if (Math.abs(plane - second.bounds[axis][face]) > epsilon)
                continue;
              const otherAxes = [0, 1, 2].filter((other) => other !== axis);
              const rectangle = otherAxes.map((other) => [
                Math.max(first.bounds[other][0], second.bounds[other][0]),
                Math.min(first.bounds[other][1], second.bounds[other][1]),
              ]);
              if (rectangle.some(([min, max]) => max - min <= epsilon))
                continue;
              const outward = plane + (face === 0 ? -epsilon : epsilon);
              const buried = parts.some(
                (part, index) =>
                  index !== a &&
                  index !== b &&
                  part.opaque &&
                  part.bounds[axis][0] < outward &&
                  part.bounds[axis][1] > outward &&
                  otherAxes.every(
                    (other, index) =>
                      part.bounds[other][0] <= rectangle[index][0] + epsilon &&
                      part.bounds[other][1] >= rectangle[index][1] - epsilon,
                  ),
              );
              if (!buried)
                overlaps.push(
                  `${variant}/${stories}: ${a}/${b} ${first.color}/${second.color} axis${axis} face${face} at${plane.toFixed(3)}`,
                );
            }
        }
      disposeGroup(city.group);
      city.water.dispose();
    }
  }
  expect(overlaps).toEqual([]);
});
