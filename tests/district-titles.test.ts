import { readFileSync } from "node:fs";
import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import type { ProjectGraph } from "../src/graph/types.ts";
import { layoutWorld, type WorldLayout } from "../src/world/layout.ts";
import {
  buildDistrictTitles,
  planDistrictTitles,
} from "../src/world/district-titles.ts";
import { disposeGroup } from "../src/world/geometry.ts";

const graph: ProjectGraph = JSON.parse(
  readFileSync(new URL("../public/demo.graph.json", import.meta.url), "utf8"),
);
afterEach(() => vi.unstubAllGlobals());

it("places every demo title outside expanded building footprints and inside city bounds", () => {
  const layout = layoutWorld(graph);
  const titles = planDistrictTitles(layout, graph);
  expect(titles).toHaveLength(layout.districts.length);
  for (const title of titles) {
    expect(title.width).toBeGreaterThanOrEqual(12);
    expect(title.depth).toBeGreaterThanOrEqual(2);
    expect(Math.abs(title.x) + title.width / 2).toBeLessThanOrEqual(
      layout.width / 2,
    );
    expect(Math.abs(title.z) + title.depth / 2).toBeLessThanOrEqual(
      layout.depth / 2,
    );
    expect(title.id).toBe(
      layout.regions.find(
        (region) => region.packageId === title.packageId && !region.parentId,
      )!.id,
    );
    expect(title.title).toBe(
      graph.packages.find((pkg) => pkg.id === title.packageId)!.name,
    );
    for (const building of layout.buildings) {
      const clearX =
        Math.abs(title.x - building.x) >=
        (title.width + building.width) / 2 + 2 - 1e-8;
      const clearZ =
        Math.abs(title.z - building.z) >=
        (title.depth + building.depth) / 2 + 2 - 1e-8;
      expect(clearX || clearZ, `${title.title} overlaps ${building.id}`).toBe(
        true,
      );
    }
  }
  expect(planDistrictTitles(layout, graph)).toEqual(titles);
});

const occupiedDistrict = (): WorldLayout => {
  const layout = layoutWorld(graph),
    district = layout.districts[0],
    building = layout.buildings[0];
  return {
    ...layout,
    width: 120,
    depth: 120,
    districts: [{ ...district, x: 0, z: -10, width: 70, depth: 60 }],
    buildings: [{ ...building, x: 0, z: -10, width: 70, depth: 60 }],
  };
};
it("uses a clear entrance forecourt when the district interior is occupied", () => {
  const layout = occupiedDistrict();
  const [title] = planDistrictTitles(layout, graph);
  expect(title).toBeDefined();
  expect(title.forecourt).toBe(true);
  expect(title.z - title.depth / 2).toBeGreaterThanOrEqual(22);
  expect(title.z + title.depth / 2).toBeLessThanOrEqual(60);
});
it("never substitutes a roof overlay when neither district nor forecourt has space", () => {
  const layout = occupiedDistrict();
  layout.buildings[0].width = 120;
  layout.buildings[0].depth = 120;
  layout.buildings[0].z = 0;
  expect(planDistrictTitles(layout, graph)).toEqual([]);
});
it("scales names to genuinely large open fields", () => {
  const layout = occupiedDistrict();
  layout.width = 1800;
  layout.depth = 1600;
  layout.districts[0] = {
    ...layout.districts[0],
    x: 0,
    z: 0,
    width: 1600,
    depth: 1400,
  };
  layout.buildings[0] = {
    ...layout.buildings[0],
    x: -500,
    z: -450,
    width: 100,
    depth: 100,
  };
  const [title] = planDistrictTitles(layout, graph);
  expect(title.width).toBeGreaterThan(100);
  expect(title.titleHeight).toBe(32);
  expect(title.depth).toBe(40);
});
it("renders transparent source lettering with compatible pick IDs and no geometry above buildings", () => {
  const calls: string[] = [];
  const context = {
    font: "",
    clearRect() {},
    measureText(text: string) {
      return {
        width: text.length * Number.parseFloat(this.font.split(" ")[1]) * 0.6,
      };
    },
    fillText(text: string) {
      calls.push(text);
    },
  };
  vi.stubGlobal("document", {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
  const titles = planDistrictTitles(layoutWorld(graph), graph),
    group = new THREE.Group();
  const meshes = buildDistrictTitles(titles, group);
  expect(meshes).toHaveLength(titles.length * 2);
  group.updateMatrixWorld(true);
  for (const [index, title] of titles.entries()) {
    expect(calls).toContain(title.title);
    const ground = meshes[index * 2],
      raised = meshes[index * 2 + 1];
    for (const mesh of [ground, raised]) {
      expect(mesh.userData.signIds).toEqual([title.id]);
      expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      if (!(mesh.material instanceof THREE.MeshBasicMaterial))
        throw new Error("Expected title material");
      expect(mesh.material.transparent).toBe(true);
      expect(mesh.material.depthWrite).toBe(false);
      const bounds = new THREE.Box3().setFromObject(mesh);
      expect(bounds.min.x).toBeGreaterThanOrEqual(
        title.x - title.width / 2 - 1e-5,
      );
      expect(bounds.max.x).toBeLessThanOrEqual(
        title.x + title.width / 2 + 1e-5,
      );
      expect(bounds.min.z).toBeGreaterThanOrEqual(
        title.z - title.depth / 2 - 1e-5,
      );
      expect(bounds.max.z).toBeLessThanOrEqual(
        title.z + title.depth / 2 + 1e-5,
      );
    }
    expect(new THREE.Box3().setFromObject(raised).min.y).toBeCloseTo(2.8);
  }
  disposeGroup(group);
});
