import * as THREE from "three";
import type { WorldLayout } from "./layout.ts";
import { solid, VoxelBatch } from "./geometry.ts";
import type { CollisionWorld } from "./physics.ts";

export function buildTransitStops(
  layout: WorldLayout,
  blocks: VoxelBatch,
  lights: VoxelBatch,
  colliders: CollisionWorld,
): Map<string, THREE.Group> {
  const ships = new Map<string, THREE.Group>();
  for (const district of layout.districts) {
    const owner = `transit:${district.id}`;
    const x = district.x + 6;
    const z = district.z + district.depth / 2 + 5;
    const accent = district.color;
    const padGlow = (
      dx: number,
      y: number,
      dz: number,
      w: number,
      h: number,
      d: number,
      color = accent,
    ) => lights.add(x + dx, y, z + dz, w, h, d, color, owner);
    // Flush landing paint leaves the entrance and cross streets walkable.
    blocks.add(x, 0.055, z, 8.5, 0.04, 8.8, "#243f49", owner);
    for (const side of [-1, 1]) {
      padGlow(side * 4, 0.09, 0, 0.12, 0.04, 8);
      padGlow(0, 0.09, side * 4, 8, 0.04, 0.12);
      padGlow(side * 1.05, 0.1, 0, 0.2, 0.04, 2.3, "#aaccc5");
    }
    padGlow(0, 0.1, 0, 2.3, 0.04, 0.2, "#aaccc5");

    const ship = new THREE.Group();
    ship.position.set(x, 0, z);
    const body = new VoxelBatch();
    const engines = new VoxelBatch(true);
    const hull = (
      dx: number,
      y: number,
      dz: number,
      w: number,
      h: number,
      d: number,
      color: string,
    ) => body.add(dx, y, dz, w, h, d, color, owner);
    const glow = (
      dx: number,
      y: number,
      dz: number,
      w: number,
      h: number,
      d: number,
      color = accent,
    ) => engines.add(dx, y, dz, w, h, d, color, owner);

    // Stepped nose, swept wings, and split tail make a shuttle silhouette.
    hull(0, 3.2, 0, 3.4, 1.05, 5.4, "#b8b8a6");
    hull(0, 3.55, 0.6, 3, 0.55, 4.8, "#dae0cd");
    hull(0, 3.25, 2.9, 2.7, 0.75, 1.1, "#cbd4c3");
    hull(0, 3.25, 3.65, 1.7, 0.55, 0.55, "#dce6d4");
    hull(0, 4.02, 0.4, 2.2, 0.4, 2.3, "#465c62");
    glow(0, 4.04, 1.58, 1.85, 0.3, 0.055, "#ffdc9c");
    hull(0, 3.8, -2.3, 1.9, 0.45, 1.25, "#51676c");
    for (const side of [-1, 1]) {
      hull(side * 2.15, 3.03, -0.8, 1.1, 0.4, 3.3, "#668780");
      hull(side * 3.05, 3.02, -1.35, 0.85, 0.35, 2.1, "#d0d7c2");
      hull(side * 3.4, 3.72, -1.95, 0.35, 1.1, 0.8, "#789486");
      hull(side * 1.23, 4.35, -2.3, 0.3, 1.15, 0.85, "#c5d1bf");
      hull(side * 1.05, 3.13, -3.08, 1.05, 0.85, 0.7, "#293d49");
      glow(side * 1.05, 3.13, -3.45, 0.67, 0.52, 0.08, "#9de5f4");
      glow(side * 1.05, 2.78, -1.8, 0.65, 0.12, 1.05, "#99decd");
      glow(side * 3.45, 3.08, -0.6, 0.16, 0.13, 0.3);
      for (let cabin = 0; cabin < 3; cabin++)
        glow(
          side * 1.72,
          3.49,
          -1.35 + cabin * 1.25,
          0.035,
          0.32,
          0.65,
          "#f5d39a",
        );
      glow(side * 1.2, 3.28, 3.38, 0.35, 0.15, 0.08, "#f2efd5");
    }
    // Layered armor, recessed intake grilles and a segmented canopy.
    hull(0, 4.25, 0.5, 1.85, 0.24, 2.15, "#142b3b");
    for (const side of [-1, 1]) {
      hull(side * 0.92, 4.35, 0.5, 0.1, 0.25, 2.3, "#6e8d94");
      glow(side * 0.7, 4.38, 0.45, 0.08, 0.05, 1.85, "#70cdd8");
      hull(side * 2.12, 3.3, -0.75, 0.82, 0.18, 2.8, "#223749");
      for (let fin = 0; fin < 5; fin++)
        hull(side * 2.12, 3.43, -1.8 + fin * 0.42, 0.66, 0.13, 0.1, "#7e9299");
      hull(side * 3.06, 3.26, -1.35, 0.55, 0.11, 1.8, "#344251");
      glow(side * 3.36, 3.29, -1.3, 0.06, 0.06, 1.6);
      hull(side * 1.75, 2.57, 1.45, 0.16, 0.8, 0.2, "#243946");
      hull(side * 1.75, 2.18, 1.45, 0.55, 0.12, 0.85, "#6c848d");
      hull(side * 1.05, 3.13, -3.59, 0.92, 0.78, 0.14, "#466678");
      glow(side * 1.05, 3.13, -3.68, 0.52, 0.4, 0.05, "#bcf9ff");
    }
    for (let brace = 0; brace < 3; brace++)
      hull(0, 4.42, -0.42 + brace * 0.85, 1.9, 0.12, 0.09, "#81939a");
    hull(0, 4.45, -2.15, 0.18, 0.95, 0.2, "#334c5c");
    glow(0, 4.96, -2.15, 0.18, 0.1, 0.2, "#ffac7a");
    body.build(ship);
    engines.build(ship);
    ships.set(district.id, ship);
    // The stop sign sits beside the pad, away from the district's central path.
    solid(
      blocks,
      colliders,
      x + 4.8,
      1.15,
      z - 3.6,
      0.18,
      2.3,
      0.18,
      "#506c70",
    );
    solid(blocks, colliders, x + 4.8, 2.6, z - 3.6, 1.1, 0.8, 0.22, "#26484b");
    padGlow(4.8, 2.6, -3.47, 0.7, 0.45, 0.03, "#c9f49e");
    padGlow(4.8, 3.1, -3.6, 0.2, 0.12, 0.2, "#d9f6ab");
  }
  return ships;
}
