import * as THREE from "three";
import { expect, it } from "vitest";
import { hash, type GraphNode } from "../src/graph/types.ts";
import { furnishArtifact, furnitureSize } from "../src/world/furniture.ts";
import { disposeGroup, VoxelBatch } from "../src/world/geometry.ts";
import type { FurnitureKind } from "../src/world/layout.ts";
import { CollisionWorld } from "../src/world/physics.ts";

const ids = Array.from({ length: 3 }, (_, variant) => {
  let index = 0;
  while (hash(`file${index}:shape`) % 3 !== variant) index++;
  return `file${index}`;
});
const build = (kind: FurnitureKind, id: string, rotation = 0) => {
  const node: GraphNode = {
    id,
    name: id,
    packageId: "project",
    directory: "src",
    kind: "module",
    lines: 1,
    exports: [],
    components: [],
    incoming: 0,
    outgoing: 0,
  };
  const group = new THREE.Group();
  const batches = [new VoxelBatch(), new VoxelBatch(true), new VoxelBatch()];
  furnishArtifact(
    node,
    {
      x: 0,
      y: 3,
      z: 0,
      floorY: 0,
      rotation,
      furniture: kind,
      buildingId: "building",
    },
    batches[0],
    batches[1],
    batches[2],
    new CollisionWorld(),
    true,
  );
  const meshes = batches.map((batch) => batch.build(group));
  group.updateMatrixWorld(true);
  return { group, meshes };
};

it("keeps every construction and clickable part inside its allocated footprint at all orientations", () => {
  const matrix = new THREE.Matrix4();
  for (const kind of Object.keys(furnitureSize) as FurnitureKind[]) {
    const size = furnitureSize[kind];
    for (const id of ids)
      for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const { group, meshes } = build(kind, id, rotation);
        const width =
          Math.abs(Math.cos(rotation)) * size.width +
          Math.abs(Math.sin(rotation)) * size.depth;
        const depth =
          Math.abs(Math.sin(rotation)) * size.width +
          Math.abs(Math.cos(rotation)) * size.depth;
        const base = size.wall ? 3 - size.height / 2 : 0;
        const envelope = new THREE.Box3(
          new THREE.Vector3(-width / 2 - 1e-5, base - 1e-5, -depth / 2 - 1e-5),
          new THREE.Vector3(
            width / 2 + 1e-5,
            base + size.height + 1e-5,
            depth / 2 + 1e-5,
          ),
        );
        for (const mesh of meshes)
          for (let index = 0; index < mesh.count; index++) {
            mesh.getMatrixAt(index, matrix);
            const box = new THREE.Box3(
              new THREE.Vector3(-0.5, -0.5, -0.5),
              new THREE.Vector3(0.5, 0.5, 0.5),
            ).applyMatrix4(matrix);
            expect(
              envelope.containsBox(box),
              `${kind} ${id} part ${index}: ${JSON.stringify(box)}`,
            ).toBe(true);
            expect(mesh.userData.ids[index]).toBe(id);
          }
        disposeGroup(group);
      }
  }
});

it("selects repeatable structural variants rather than recoloring identical furniture", () => {
  const matrix = new THREE.Matrix4();
  const signature = (kind: FurnitureKind, id: string) => {
    const { group, meshes } = build(kind, id);
    const parts: number[][] = [];
    for (const mesh of meshes)
      for (let index = 0; index < mesh.count; index++) {
        mesh.getMatrixAt(index, matrix);
        parts.push([...matrix.elements]);
      }
    disposeGroup(group);
    return JSON.stringify(parts);
  };
  for (const kind of Object.keys(furnitureSize) as FurnitureKind[]) {
    const variants = ids.map((id) => signature(kind, id));
    expect(new Set(variants).size, kind).toBe(3);
    expect(signature(kind, ids[0])).toBe(variants[0]);
  }
});

it("exposes artwork, storage panels and console screens in front of opaque bodies", () => {
  const probes: { kind: FurnitureKind; x: number; y: number; color: string }[] =
    [
      { kind: "painting", x: -1.02, y: 3.5, color: "#203640" },
      { kind: "painting", x: 0.59, y: 3.45, color: "#702c42" },
      { kind: "wardrobe", x: 0.6, y: 2.1, color: "#465560" },
      { kind: "cabinet", x: 0.4, y: 0.58, color: "#465560" },
      { kind: "desk", x: 0.4, y: 1.64, color: "#24444e" },
      { kind: "terminal", x: 0.3, y: 1.64, color: "#24444e" },
    ];
  for (const probe of probes) {
    const { group, meshes } = build(probe.kind, ids[0]);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(probe.x, probe.y, 5),
      new THREE.Vector3(0, 0, -1),
    );
    const hit = ray.intersectObjects(meshes)[0];
    expect(hit, probe.kind).toBeDefined();
    if (
      !(hit.object instanceof THREE.InstancedMesh) ||
      hit.instanceId === undefined
    )
      throw new Error("Expected artifact instance");
    const color = new THREE.Color();
    hit.object.getColorAt(hit.instanceId, color);
    const expected =
      probe.kind === "painting" && probe.x === 0.59
        ? ["#15555c", "#702c42", "#b35a2d", "#514467"][hash(ids[0]) % 4]
        : probe.color;
    expect(color.getHexString(), probe.kind).toBe(
      new THREE.Color(expected).getHexString(),
    );
    disposeGroup(group);
  }
});

it("separates exposed trim from its backing instead of drawing coplanar faces", () => {
  const matrix = new THREE.Matrix4();
  const probes: { kind: FurnitureKind; x: number; y: number; front: number }[] =
    [
      { kind: "sofa", x: -3.4 * 0.32, y: 0.53, front: 0.7 },
      { kind: "armchair", x: -1.25 * 0.32, y: 0.53, front: 0.675 },
      { kind: "bed", x: -0.89, y: 0.27, front: 2 },
      { kind: "painting", x: 1.03, y: 2.57, front: 0.06 },
      { kind: "bookshelf", x: 0.93, y: 0.37, front: 0.3 },
    ];
  for (const id of ids)
    for (const probe of probes) {
      const { group, meshes } = build(probe.kind, id);
      const faces: number[] = [];
      for (const mesh of meshes)
        for (let index = 0; index < mesh.count; index++) {
          mesh.getMatrixAt(index, matrix);
          const box = new THREE.Box3(
            new THREE.Vector3(-0.5, -0.5, -0.5),
            new THREE.Vector3(0.5, 0.5, 0.5),
          ).applyMatrix4(matrix);
          if (
            probe.x > box.min.x &&
            probe.x < box.max.x &&
            probe.y > box.min.y &&
            probe.y < box.max.y
          )
            faces.push(box.max.z);
        }
      faces.sort((a, b) => b - a);
      expect(faces[0], `${probe.kind} front`).toBeCloseTo(probe.front, 5);
      expect(
        faces[0] - faces[1],
        `${probe.kind} backing clearance`,
      ).toBeGreaterThan(0.004);
      disposeGroup(group);
    }
});

it("keeps visible furniture faces distinct on every side of every variant", () => {
  const axes = ["x", "y", "z"] as const;
  const sides = ["min", "max"] as const;
  const tolerance = 1e-5;
  const matrix = new THREE.Matrix4();
  for (const kind of Object.keys(furnitureSize) as FurnitureKind[])
    for (const id of ids)
      for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const { group, meshes } = build(kind, id, rotation);
        const boxes: THREE.Box3[] = [];
        for (const mesh of meshes)
          for (let index = 0; index < mesh.count; index++) {
            mesh.getMatrixAt(index, matrix);
            boxes.push(
              new THREE.Box3(
                new THREE.Vector3(-0.5, -0.5, -0.5),
                new THREE.Vector3(0.5, 0.5, 0.5),
              ).applyMatrix4(matrix),
            );
          }
        const conflicts: string[] = [];
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++)
            for (const axis of axes)
              for (const side of sides) {
                const a = boxes[i],
                  b = boxes[j];
                const plane = a[side][axis];
                if (Math.abs(plane - b[side][axis]) > tolerance) continue;
                // Furniture undersides at floor level are hidden by the floor.
                if (
                  axis === "y" &&
                  side === "min" &&
                  Math.abs(plane) < tolerance
                )
                  continue;
                const [u, v] = axes.filter((value) => value !== axis);
                const lowU = Math.max(a.min[u], b.min[u]),
                  highU = Math.min(a.max[u], b.max[u]),
                  lowV = Math.max(a.min[v], b.min[v]),
                  highV = Math.min(a.max[v], b.max[v]);
                if (highU - lowU < tolerance || highV - lowV < tolerance)
                  continue;
                // Ignore buried joints, but check the center and edges of the overlap.
                let exposed = false;
                for (const fractionU of [0.1, 0.5, 0.9])
                  for (const fractionV of [0.1, 0.5, 0.9]) {
                    const uPoint = lowU + (highU - lowU) * fractionU;
                    const vPoint = lowV + (highV - lowV) * fractionV;
                    const blocked = boxes.some((other, index) => {
                      if (index === i || index === j) return false;
                      const inFront =
                        side === "max"
                          ? other.max[axis] > plane + tolerance
                          : other.min[axis] < plane - tolerance;
                      return (
                        inFront &&
                        other.min[u] < uPoint &&
                        other.max[u] > uPoint &&
                        other.min[v] < vPoint &&
                        other.max[v] > vPoint
                      );
                    });
                    if (!blocked) exposed = true;
                  }
                if (exposed)
                  conflicts.push(`${i}/${j} ${side}.${axis}=${plane}`);
              }
        disposeGroup(group);
        expect(conflicts, `${kind} ${id} rotation ${rotation}`).toEqual([]);
      }
});
