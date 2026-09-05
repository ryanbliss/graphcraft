import { wayfindingSigns } from "./wayfinding.ts";
import * as THREE from "three";
import { hash } from "../graph/types.ts";
import type { WorldLayout } from "./layout.ts";
import type { DistrictTitlePlacement } from "./district-titles.ts";
import { VoxelBatch, solid } from "./geometry.ts";
import type { CollisionWorld } from "./physics.ts";
import { renderSigns, type Sign } from "./signs.ts";
import { buildExteriorAsset, selectExteriorAsset } from "./exterior-assets.ts";

interface Lot {
  x: number;
  z: number;
  width: number;
  depth: number;
}
const overlaps = (a: Lot, b: Lot) =>
  Math.abs(a.x - b.x) * 2 < a.width + b.width &&
  Math.abs(a.z - b.z) * 2 < a.depth + b.depth;
class Lots {
  private cells = new Map<string, Lot[]>();
  private keys(lot: Lot): string[] {
    const keys: string[] = [];
    for (
      let x = Math.floor((lot.x - lot.width / 2) / 16);
      x <= Math.floor((lot.x + lot.width / 2) / 16);
      x++
    )
      for (
        let z = Math.floor((lot.z - lot.depth / 2) / 16);
        z <= Math.floor((lot.z + lot.depth / 2) / 16);
        z++
      )
        keys.push(`${x}:${z}`);
    return keys;
  }
  add(lot: Lot) {
    for (const key of this.keys(lot)) {
      const cell = this.cells.get(key) ?? [];
      cell.push(lot);
      this.cells.set(key, cell);
    }
  }
  free(lot: Lot) {
    return this.keys(lot).every((key) =>
      (this.cells.get(key) ?? []).every((other) => !overlaps(lot, other)),
    );
  }
}
export function buildStreetscape(
  layout: WorldLayout,
  titles: DistrictTitlePlacement[],
  blocks: VoxelBatch,
  lights: VoxelBatch,
  colliders: CollisionWorld,
  parent: THREE.Group,
) {
  const waterVertices: number[] = [];
  const occupied = new Lots();
  for (const b of layout.buildings)
    occupied.add({ ...b, width: b.width + 8, depth: b.depth + 12 });
  for (const t of titles)
    occupied.add({ ...t, width: t.width + 5, depth: t.depth + 5 });
  for (const d of layout.districts)
    occupied.add({
      x: d.x + 6,
      z: d.z + d.depth / 2 + 5,
      width: 24,
      depth: 20,
    });
  for (const path of layout.paths)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i];
      occupied.add({
        x: (a.x + b.x) / 2,
        z: (a.z + b.z) / 2,
        width: Math.abs(a.x - b.x) + 7,
        depth: Math.abs(a.z - b.z) + 7,
      });
    }
  const colors = ["#ff52bc", "#53ffe0", "#9b74ff", "#ffc95c", "#71e6ff"];
  const destinations = new Map(
    [...layout.buildings, ...layout.regions].map((b) => [b.id, b.name]),
  );
  const signs: Sign[] = [];
  const place = (
    x: number,
    z: number,
    seed: string,
    owner: string,
    foliage = false,
  ) => {
    const asset = selectExteriorAsset(seed, foliage ? "foliage" : undefined);
    const lot = { x, z, width: asset.width + 2, depth: asset.depth + 2 };
    if (!occupied.free(lot)) return;
    occupied.add(lot);
    const color = colors[hash(seed) % colors.length];
    buildExteriorAsset(asset, blocks, lights, { x, z, color, owner });
    colliders.add({
      minX: x - asset.width / 2,
      maxX: x + asset.width / 2,
      minZ: z - asset.depth / 2,
      maxZ: z + asset.depth / 2,
      minY: 0,
      maxY: asset.height,
    });
  };
  // Furnish the edges, keeping entrances and the entire walking network clear.
  for (const b of layout.buildings)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++)
        place(
          b.x + side * (b.width / 2 + 8),
          b.z + (i - 1) * b.depth * 0.3,
          `${b.id}:street:${side}:${i}`,
          b.id,
          i === 0,
        );
    }
  const forks = new Set<string>();
  for (const path of layout.paths) {
    if (path.points.length < 2) continue;
    const candidate = path.points
      .slice(0, -1)
      .map((a, i) => {
        const x = a.x + 6,
          z = a.z + 6;
        const b = path.points[i + 1];
        const alongX = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
        return {
          a,
          b,
          alongX,
          key: `${Math.round(a.x / 8)}:${Math.round(a.z / 8)}`,
          lot: { x, z, width: alongX ? 3 : 8, depth: alongX ? 8 : 3 },
        };
      })
      .find((item) => !forks.has(item.key) && occupied.free(item.lot));
    if (!candidate) continue;
    const { a, b, key, lot, alongX } = candidate;
    const { x, z } = lot;
    forks.add(key);
    occupied.add(lot);
    const color = colors[hash(path.target) % colors.length];
    solid(blocks, colliders, x, 2, z, 0.5, 4, 0.5, "#253441", path.target);
    blocks.add(
      x,
      4.5,
      z,
      alongX ? 0.4 : 7.6,
      2,
      alongX ? 7.6 : 0.4,
      "#0e182b",
      path.target,
    );
    lights.add(
      x,
      5.57,
      z,
      alongX ? 0.55 : 7.8,
      0.12,
      alongX ? 7.8 : 0.55,
      color,
      path.target,
    );
    signs.push(
      ...wayfindingSigns(
        path.target,
        destinations.get(path.target) ?? path.target,
        color,
        x,
        z,
        { x: b.x - a.x, z: b.z - a.z },
      ),
    );
  }
  // Empty lots become bounded reflecting gardens, never water across a route.
  for (const district of layout.districts) {
    for (
      let z = district.z - district.depth / 2 + 26;
      z < district.z + district.depth / 2 - 26;
      z += 48
    )
      for (
        let x = district.x - district.width / 2 + 36;
        x < district.x + district.width / 2 - 36;
        x += 72
      ) {
        const seed = `${district.id}:${x}:${z}`,
          value = hash(seed);
        let width = 48 + (value % 3) * 6,
          depth = 26 + ((value >>> 4) % 3) * 6;
        if (!occupied.free({ x, z, width: width + 4, depth: depth + 4 })) {
          width = 20;
          depth = 16;
        }
        const lot = { x, z, width: width + 4, depth: depth + 4 };
        if (!occupied.free(lot)) continue;
        occupied.add(lot);
        const color = colors[value % colors.length];
        blocks.add(
          x,
          0.03,
          z,
          width + 4,
          0.1,
          depth + 4,
          "#243b49",
          district.id,
        );
        const wet = value % 4 !== 0;
        if (wet) {
          for (const [dx, dz] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, -1],
            [1, 1],
            [-1, 1],
          ])
            waterVertices.push(
              x + (dx * width) / 2,
              0.18,
              z + (dz * depth) / 2,
            );
          for (const side of [-1, 1]) {
            solid(
              blocks,
              colliders,
              x + side * (width / 2 + 0.3),
              0.35,
              z,
              0.6,
              0.7,
              depth + 1.2,
              "#344e59",
              district.id,
            );
            solid(
              blocks,
              colliders,
              x,
              0.35,
              z + side * (depth / 2 + 0.3),
              width,
              0.7,
              0.6,
              "#344e59",
              district.id,
            );
            lights.add(
              x + side * (width / 2 + 0.3),
              0.72,
              z,
              0.16,
              0.06,
              depth + 1,
              color,
              district.id,
            );
          }
        }
        for (let i = 0; i < 3; i++) {
          const px = x + (i - 1) * width * 0.25,
            pz = z + Math.sin(value + i * 2) * depth * 0.24;
          blocks.add(px, 0.25, pz, 6, 0.4, 6, "#293845", district.id);
          const asset = selectExteriorAsset(`${seed}:${i}`, "foliage");
          buildExteriorAsset(asset, blocks, lights, {
            x: px,
            z: pz,
            y: 0.45,
            color,
            owner: district.id,
          });
          colliders.add({
            minX: px - asset.width / 2,
            maxX: px + asset.width / 2,
            minZ: pz - asset.depth / 2,
            maxZ: pz + asset.depth / 2,
            minY: 0,
            maxY: asset.height + 0.45,
          });
        }
      }
  }
  const water = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 location;
      void main(){
        location=position.xz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      uniform float time; varying vec2 location;
      void main(){
        #include <logdepthbuf_fragment>
        float wave=sin(location.x*.65+sin(location.y*.35+time)*2.0-time*1.3);
        float ripple=pow(max(0.0,wave),18.0);
        vec3 color=mix(vec3(.015,.20,.28),vec3(.08,.65,.72),ripple*.55);
        gl_FragColor=vec4(color,1.0);
      }`,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(waterVertices, 3),
  );
  parent.add(new THREE.Mesh(geometry, water));
  return { signs: renderSigns(signs, parent, 512, 96), water };
}
