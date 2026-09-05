import * as THREE from "three";
import { CollisionWorld } from "./physics.ts";
import { hash } from "../graph/types.ts";
import { withNeonFlicker } from "./neon-flicker.ts";
interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  id?: string;
}
export class VoxelBatch {
  private boxes: Box[] = [];
  owner: string | undefined;
  constructor(private glow = false) {}
  add(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    id?: string,
  ) {
    this.boxes.push({ x, y, z, w, h, d, color, id: id ?? this.owner });
  }
  build(parent: THREE.Object3D): THREE.InstancedMesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = this.glow
      ? new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.76,
          metalness: 0.3,
        });
    const mesh = new THREE.InstancedMesh(geometry, material, this.boxes.length),
      dummy = new THREE.Object3D();
    const ids: (string | undefined)[] = [];
    const circuits = this.glow
      ? new Float32Array(this.boxes.length)
      : undefined;
    this.boxes.forEach((box, i) => {
      dummy.position.set(box.x, box.y, box.z);
      dummy.scale.set(box.w, box.h, box.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(
        i,
        new THREE.Color(box.color).multiplyScalar(this.glow ? 1.7 : 1),
      );
      ids.push(box.id);
      if (circuits)
        circuits[i] =
          hash(
            `${box.id ?? ""}:${Math.floor(box.x / 8)},${Math.floor(box.y / 8)},${Math.floor(box.z / 8)}`,
          ) % 64;
    });
    if (circuits) {
      geometry.setAttribute(
        "neonCircuit",
        new THREE.InstancedBufferAttribute(circuits, 1),
      );
      withNeonFlicker(material, { circuits: true });
    }
    mesh.userData.ids = ids;
    mesh.computeBoundingSphere();
    parent.add(mesh);
    return mesh;
  }
}
export function solid(
  batch: VoxelBatch,
  colliders: CollisionWorld,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  id?: string,
) {
  batch.add(x, y, z, w, h, d, color, id);
  colliders.add({
    minX: x - w / 2,
    maxX: x + w / 2,
    minY: y - h / 2,
    maxY: y + h / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
  });
}
export function lineGeometry(
  segments: number[],
  color: string,
  opacity: number,
): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(segments, 3),
  );
  const circuits = new Float32Array(segments.length / 3);
  for (let vertex = 0; vertex < circuits.length; vertex += 2) {
    const start = vertex * 3;
    const circuit =
      hash(`${segments[start]},${segments[start + 1]},${segments[start + 2]}`) %
      64;
    circuits[vertex] = circuit;
    circuits[vertex + 1] = circuit;
  }
  geometry.setAttribute("neonCircuit", new THREE.BufferAttribute(circuits, 1));
  return new THREE.LineSegments(
    geometry,
    withNeonFlicker(
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
      { circuits: true },
    ),
  );
}
export function disposeGroup(group: THREE.Object3D) {
  const materials = new Set<THREE.Material>(),
    geometries = new Set<THREE.BufferGeometry>();
  group.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points
    ) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
    material.dispose();
  }
  group.clear();
}
