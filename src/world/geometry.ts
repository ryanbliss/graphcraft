import * as THREE from "three";
import { CollisionWorld } from "./physics.ts";
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
    });
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
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
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
