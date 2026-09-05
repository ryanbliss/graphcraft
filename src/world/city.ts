import { buildRoadSurfaces } from "./road-surfaces.ts";
import { buildStreetscape } from "./streetscape.ts";
import * as THREE from "three";
import { hash, type ProjectGraph } from "../graph/types.ts";
import { type WorldLayout, type Building } from "./layout.ts";
import { CollisionWorld } from "./physics.ts";
import { buildingSigns, filePlacards } from "./signs.ts";
import { furnishBuilding, roomCeilingHeight } from "./interiors.ts";
import { buildTransitStops } from "./transit.ts";
import {
  buildDistrictTitles,
  planDistrictTitles,
  type DistrictTitlePlacement,
} from "./district-titles.ts";
import { VoxelBatch, solid, lineGeometry } from "./geometry.ts";
export interface Route {
  source: string;
  target: string;
  points: THREE.Vector3[];
  lengths: number[];
  length: number;
  seed: number;
}
export interface City {
  group: THREE.Group;
  roofs: Map<string, THREE.Object3D>;
  shuttles: Map<string, THREE.Group>;
  routes: THREE.Group;
  colliders: CollisionWorld;
  pickables: THREE.Object3D[];
  traffic: THREE.Points;
  trafficRoutes: Route[];
  titlePlacements: DistrictTitlePlacement[];
  titles: THREE.Group;
  water: THREE.ShaderMaterial;
}
export function buildCity(graph: ProjectGraph, layout: WorldLayout): City {
  const group = new THREE.Group(),
    routes = new THREE.Group();
  const blocks = new VoxelBatch(),
    lights = new VoxelBatch(true),
    files = new VoxelBatch(),
    colliders = new CollisionWorld();
  const roofs = new Map<string, THREE.Object3D>();
  const cyclicNodes = new Set(graph.cycles?.flat() ?? []);
  blocks.add(0, -0.8, 0, layout.width + 50, 1.5, layout.depth + 50, "#111d28");
  for (const side of [-1, 1]) {
    solid(
      blocks,
      colliders,
      side * (layout.width / 2 + 24),
      0.95,
      0,
      1,
      1.9,
      layout.depth + 49,
      "#253a49",
    );
    solid(
      blocks,
      colliders,
      0,
      0.95,
      side * (layout.depth / 2 + 24),
      layout.width + 49,
      1.9,
      1,
      "#253a49",
    );
    lights.add(
      side * (layout.width / 2 + 24),
      1.95,
      0,
      0.2,
      0.08,
      layout.depth + 49,
      "#729dba",
    );
    lights.add(
      0,
      1.95,
      side * (layout.depth / 2 + 24),
      layout.width + 49,
      0.08,
      0.2,
      "#729dba",
    );
  }
  for (const district of layout.districts) {
    const { x, z, width: w, depth: d } = district;
    blocks.add(x, -0.09, z, w - 2, 0.15, d - 2, "#192634");
    for (const sign of [-1, 1]) {
      lights.add(x, 0.04, z + (sign * d) / 2, w, 0.06, 0.12, district.color);
      lights.add(x + (sign * w) / 2, 0.04, z, 0.12, 0.06, d, district.color);
      for (const side of [-1, 1]) {
        blocks.add(
          x + (sign * w) / 2,
          1.3,
          z + (side * d) / 2,
          1,
          2.6,
          1,
          "#344350",
        );
        lights.add(
          x + (sign * w) / 2,
          2.7,
          z + (side * d) / 2,
          0.5,
          0.3,
          0.5,
          district.color,
        );
      }
    }
  }
  buildRoadSurfaces(layout.paths, blocks, lights);
  function building(b: Building) {
    blocks.owner = b.id;
    lights.owner = b.id;
    const { x, z, width: w, depth: d } = b;
    const neonStyle = hash(`${b.id}:neon`) % 4;
    const color = ["#ff42b3", "#59eadc", "#fd70d3", "#69cfff"][neonStyle];
    const accent = neonStyle % 2 === 0 ? "#61e8ff" : "#ff59bf";
    solid(
      blocks,
      colliders,
      x,
      1.3,
      z - d / 2,
      w + 0.6,
      2.6,
      0.6,
      "#283948",
      b.id,
    );
    solid(
      blocks,
      colliders,
      x - w / 2,
      1.3,
      z + 0.15,
      0.6,
      2.6,
      d - 0.3,
      "#263744",
      b.id,
    );
    solid(
      blocks,
      colliders,
      x + w / 2,
      1.3,
      z + 0.15,
      0.6,
      2.6,
      d - 0.3,
      "#263744",
      b.id,
    );
    const wing = (w - 4.5) / 2;
    for (const side of [-1, 1]) {
      solid(
        blocks,
        colliders,
        x + side * (w / 2 - wing / 2),
        2.2,
        z + d / 2,
        wing,
        4.4,
        0.7,
        "#344654",
        b.id,
      );
      lights.add(
        x + side * (w / 2 - wing / 2),
        4.5,
        z + d / 2,
        wing,
        0.12,
        0.85,
        color,
      );
      solid(
        blocks,
        colliders,
        x + side * 2.35,
        2.4,
        z + d / 2,
        0.25,
        4.8,
        0.9,
        "#263744",
      );
      lights.add(x + side * 2.3, 2.1, z + d / 2 + 0.5, 0.1, 4.2, 0.08, color);
    }
    solid(blocks, colliders, x, 4.9, z + d / 2, 5, 0.6, 1.2, "#3d505a", b.id);
    lights.add(x, 4.86, z + d / 2 + 0.6, 3.8, 0.24, 0.12, color);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const pierHeight = b.stories * 5.4;
        const px = x + sx * (w / 2 - 0.5);
        const pz = z + sz * (d / 2 - 0.5);
        solid(
          blocks,
          colliders,
          px,
          pierHeight / 2,
          pz,
          0.85,
          pierHeight,
          0.85,
          "#344957",
          b.id,
        );
        for (let floor = 0; floor < b.stories; floor++)
          lights.add(
            px,
            floor * 5.4 + 3.3,
            pz + sz * 0.44,
            0.25,
            1.35,
            0.025,
            accent,
          );
      }
    lights.add(x, 2.68, z - d / 2, w + 0.72, 0.08, 0.72, color);
    for (const side of [-1, 1])
      lights.add(
        x + (side * w) / 2,
        2.68,
        z + 0.18,
        0.72,
        0.08,
        d - 0.36,
        color,
      );
    const facade =
      b.kind === "module" || b.kind === "schema" ? "#735b54" : "#344b58";
    for (let floor = 0; floor < b.stories; floor++) {
      const floorY = floor * 5.4;
      // Mounted outside the cladding; the entrance gap stays open.
      for (const side of [-1, 1]) {
        const run = (w - 6) / 2;
        for (const end of [-1, 1]) {
          const railX = x + side * (3 + run / 2);
          const railZ = z + end * (d / 2 + 0.43);
          blocks.add(railX, floorY + 0.78, railZ, run, 0.25, 0.16, "#111b30");
          lights.add(
            railX,
            floorY + 0.78,
            railZ + end * 0.12,
            run - 0.22,
            0.085,
            0.065,
            end === side ? color : accent,
          );
        }
        const railX = x + side * (w / 2 + 0.46);
        const sectionCount = Math.max(1, Math.floor(d / 9));
        const section = (d - 2) / sectionCount;
        for (let i = 0; i < sectionCount; i++) {
          const railZ = z - d / 2 + 1 + (i + 0.5) * section;
          blocks.add(
            railX,
            floorY + 0.78,
            railZ,
            0.18,
            0.26,
            section - 0.65,
            "#111b30",
          );
          lights.add(
            railX + side * 0.13,
            floorY + 0.78,
            railZ,
            0.065,
            0.095,
            section - 0.9,
            (i + floor) % 2 === 0 ? color : accent,
          );
        }
      }
      const facadeSide = hash(`${b.id}:facade`) % 2 === 0 ? -1 : 1;
      for (const end of [-1, 1]) {
        const finZ = z + end * (d / 2 - 1.1);
        blocks.add(
          x + facadeSide * (w / 2 + 0.35),
          floorY + 3.1,
          finZ,
          0.5,
          3.1,
          0.8,
          "#758793",
        );
        lights.add(
          x + facadeSide * (w / 2 + 0.64),
          floorY + 3.4,
          finZ,
          0.12,
          1.5,
          0.34,
          color,
        );
      }
      for (const side of [-1, 1]) {
        if (floor > 0) {
          solid(
            blocks,
            colliders,
            x + (side * w) / 2,
            floorY + 0.55,
            z,
            0.5,
            1.1,
            d - 0.5,
            facade,
          );
          solid(
            blocks,
            colliders,
            x,
            floorY + 0.55,
            z + (side * d) / 2,
            w + 0.5,
            1.1,
            0.5,
            facade,
          );
        }
        solid(
          blocks,
          colliders,
          x + (side * w) / 2,
          floorY + 4.95,
          z,
          1.1,
          0.45,
          d - 1.1,
          "#62717a",
        );
        solid(
          blocks,
          colliders,
          x,
          floorY + 4.95,
          z + (side * d) / 2,
          w + 1.1,
          0.45,
          1.1,
          "#62717a",
        );
        for (let offset = -d / 2 + 4; offset < d / 2 - 2; offset += 4) {
          solid(
            blocks,
            colliders,
            x + (side * w) / 2,
            floorY + 2.75,
            z + offset,
            0.45,
            4.2,
            0.45,
            facade,
          );
          lights.add(
            x + side * (w / 2 + 0.3),
            floorY + 2.1,
            z + offset + 1.6,
            0.05,
            1.05,
            1.4,
            (hash(b.id) + floor + Math.round(offset)) % 4 === 0
              ? "#e4c89a"
              : accent,
          );
        }
      }
    }
    furnishBuilding(b, layout, blocks, lights, files, colliders, cyclicNodes);
    blocks.owner = b.id;
    lights.owner = b.id;
  }

  function buildRoof(b: Building) {
    const roofGroup = new THREE.Group();
    const roof = new VoxelBatch();
    const ceilings = new VoxelBatch();
    const glazing = new VoxelBatch();
    const accents = new VoxelBatch(true);
    roof.owner = glazing.owner = accents.owner = b.id;
    for (const room of b.rooms) {
      const ceiling = roomCeilingHeight(room);
      solid(
        ceilings,
        colliders,
        room.x,
        room.floorY + ceiling + 0.09,
        room.z,
        room.width,
        0.18,
        room.depth,
        "#35424f",
        room.id,
      );
      for (
        let z = room.z - room.depth / 2 + 1.2;
        z < room.z + room.depth / 2;
        z += 2.4
      ) {
        ceilings.add(
          room.x,
          room.floorY + ceiling - 0.06,
          z,
          room.width - 0.24,
          0.12,
          0.12,
          "#142431",
          room.id,
        );
      }
      const coveX =
        room.x + (room.side === "left" ? 1 : -1) * (room.width / 2 - 0.45);
      ceilings.add(
        coveX,
        room.floorY + ceiling - 0.2,
        room.z,
        0.3,
        0.2,
        room.depth - 0.4,
        "#152b37",
        room.id,
      );
      accents.add(
        coveX,
        room.floorY + ceiling - 0.31,
        room.z,
        0.12,
        0.035,
        room.depth - 0.9,
        "#79acae",
        room.id,
      );
    }
    const top = b.stories * 5.4;
    const roofNeon = hash(`${b.id}:neon`) % 2 === 0 ? "#ff52bb" : "#62e3ff";
    for (const side of [-1, 1]) {
      accents.add(
        b.x + side * (b.width / 2 + 0.1),
        top + 0.7,
        b.z,
        0.12,
        0.16,
        b.depth - 1,
        roofNeon,
      );
      accents.add(
        b.x,
        top + 0.7,
        b.z + side * (b.depth / 2 + 0.1),
        b.width - 1,
        0.16,
        0.12,
        side < 0 ? "#ff77d2" : "#6bedef",
      );
    }
    const width = b.width - 0.6;
    const depth = b.depth - 0.6;
    const rise = Math.min(3.6, Math.max(1.2, b.height - top - 0.15));
    const panel = (
      dx: number,
      y: number,
      dz: number,
      w: number,
      h: number,
      d: number,
      color: string,
    ) => roof.add(b.x + dx, y, b.z + dz, w, h, d, color);
    const glass = (
      dx: number,
      y: number,
      dz: number,
      w: number,
      h: number,
      d: number,
    ) => glazing.add(b.x + dx, y, b.z + dz, w, h, d, "#8cbfb4");
    const glow = (
      dx: number,
      y: number,
      dz: number,
      w: number,
      h: number,
      d: number,
    ) => accents.add(b.x + dx, y, b.z + dz, w, h, d, roofNeon);
    const deck = (dx: number, dz: number, w: number, d: number) =>
      solid(
        roof,
        colliders,
        b.x + dx,
        top + 0.1,
        b.z + dz,
        w,
        0.25,
        d,
        "#344954",
        b.id,
      );

    if (b.template === "atrium") {
      const lanternWidth = Math.min(10, width * 0.36);
      const lanternDepth = depth - 5;
      const wingWidth = (width - lanternWidth) / 2;
      const glassHeight = rise - 0.45;
      for (const side of [-1, 1]) {
        const wingX = (side * (lanternWidth + wingWidth)) / 2;
        deck(wingX, 0, wingWidth, depth);
        deck(0, side * (depth / 2 - 1.25), lanternWidth, 2.5);
        panel(
          wingX,
          top + 0.35,
          0,
          wingWidth - 0.5,
          0.25,
          depth - 0.5,
          "#596970",
        );
        glass(
          (side * lanternWidth) / 2,
          top + 0.25 + glassHeight / 2,
          0,
          0.09,
          glassHeight,
          lanternDepth - 0.09,
        );
        glass(
          0,
          top + 0.25 + glassHeight / 2,
          (side * lanternDepth) / 2,
          lanternWidth + 0.09,
          glassHeight,
          0.09,
        );
        panel(
          (side * lanternWidth) / 2,
          top + rise - 0.1,
          0,
          0.3,
          0.3,
          lanternDepth + 0.3,
          "#87958c",
        );
        glow(
          side * (lanternWidth / 2 - 0.15),
          top + 0.3,
          0,
          0.08,
          0.06,
          lanternDepth,
        );
        for (let strip = 0; strip < 3; strip++)
          panel(
            side * (lanternWidth / 2 + 1.5 + strip * 2.8),
            top + 0.51,
            0,
            0.16,
            0.12,
            depth - 1,
            "#85928a",
          );
      }
      glass(0, top + rise - 0.1, 0, lanternWidth - 0.2, 0.1, lanternDepth);
      for (let dz = -lanternDepth / 2; dz <= lanternDepth / 2 + 0.1; dz += 4) {
        panel(
          0,
          top + rise + 0.02,
          dz,
          lanternWidth - 0.3,
          0.18,
          0.2,
          "#91a299",
        );
        for (const side of [-1, 1])
          panel(
            (side * lanternWidth) / 2,
            top + 0.25 + glassHeight / 2,
            dz,
            0.18,
            glassHeight + 0.06,
            0.2,
            "#708d85",
          );
      }
    } else {
      deck(0, 0, width, depth);
      const silhouette = hash(`${b.id}:roof`) % 4;
      const cladding = ["#47626d", "#635164", "#4e6966", "#5c6779"][silhouette];
      const crownY = top + 0.45;
      // Broad volumes keep the skyline readable without a stack of thin ribs.
      if (silhouette === 0) {
        const crownWidth = width * 0.62;
        const crownDepth = depth * 0.64;
        const dx = -width * 0.1;
        panel(
          dx,
          crownY + rise * 0.32,
          -depth * 0.06,
          crownWidth,
          rise * 0.64,
          crownDepth,
          cladding,
        );
        panel(
          dx,
          crownY + rise * 0.64 + 0.22,
          -depth * 0.06,
          crownWidth + 1.2,
          0.44,
          crownDepth + 1.2,
          "#8b9c9e",
        );
        glow(
          dx,
          crownY + rise * 0.64 - 0.12,
          depth * 0.26 + 0.08,
          crownWidth - 1,
          0.2,
          0.16,
        );
        glass(
          dx,
          crownY + rise * 0.31,
          depth * 0.26 + 0.06,
          crownWidth - 1.2,
          rise * 0.34,
          0.12,
        );
        panel(
          width * 0.34,
          crownY + rise * 0.44,
          -depth * 0.27,
          1.25,
          rise * 0.88,
          depth * 0.28,
          "#354c5b",
        );
      } else if (silhouette === 1) {
        for (const side of [-1, 1]) {
          const crownHeight = rise * (side < 0 ? 0.82 : 0.48);
          const dx = side * width * 0.27;
          panel(
            dx,
            crownY + crownHeight / 2,
            -depth * 0.1,
            width * 0.31,
            crownHeight,
            depth * 0.72,
            cladding,
          );
          panel(
            dx,
            crownY + crownHeight + 0.16,
            -depth * 0.1,
            width * 0.35,
            0.32,
            depth * 0.77,
            "#91a6aa",
          );
          glow(
            dx + side * width * 0.157,
            crownY + crownHeight * 0.5,
            -depth * 0.1,
            0.16,
            0.22,
            depth * 0.62,
          );
        }
        glass(0, top + 0.3, 0, width * 0.17, 0.14, depth * 0.68);
        for (const side of [-1, 1])
          panel(
            side * width * 0.092,
            top + 0.45,
            0,
            0.22,
            0.35,
            depth * 0.7,
            "#8a9d9e",
          );
      } else if (silhouette === 2) {
        panel(
          -width * 0.17,
          crownY + rise * 0.38,
          -depth * 0.15,
          width * 0.54,
          rise * 0.76,
          depth * 0.51,
          cladding,
        );
        // Seat the lower crown on the deck, below the adjoining crown underside.
        panel(
          width * 0.17,
          crownY + rise * 0.2 - 0.1125,
          depth * 0.19,
          width * 0.53,
          rise * 0.4 + 0.225,
          depth * 0.37,
          "#425a69",
        );
        panel(
          -width * 0.12,
          crownY + rise * 0.76 + 0.2,
          -depth * 0.1,
          width * 0.72,
          0.4,
          depth * 0.67,
          "#7b8e99",
        );
        glow(
          -width * 0.12,
          crownY + rise * 0.76 - 0.11,
          depth * 0.235,
          width * 0.68,
          0.18,
          0.16,
        );
        glass(
          width * 0.17,
          crownY + rise * 0.4 + 0.08,
          depth * 0.19,
          width * 0.38,
          0.12,
          depth * 0.25,
        );
      } else {
        const centerWidth = width * 0.52;
        const centerDepth = depth * 0.57;
        panel(
          0,
          crownY + rise * 0.21,
          0,
          centerWidth,
          rise * 0.42,
          centerDepth,
          cladding,
        );
        glass(
          0,
          crownY + rise * 0.42 + 0.1,
          0,
          centerWidth - 0.8,
          0.16,
          centerDepth - 0.8,
        );
        for (const side of [-1, 1]) {
          panel(
            side * width * 0.33,
            crownY + rise * 0.42,
            0,
            0.9,
            rise * 0.84,
            depth * 0.77,
            "#6e8691",
          );
          glow(
            side * width * 0.33,
            crownY + rise * 0.84 + 0.07,
            0,
            0.45,
            0.14,
            depth * 0.74,
          );
        }
        panel(
          0,
          crownY + rise * 0.84 + 0.18,
          -depth * 0.31,
          width * 0.76,
          0.36,
          depth * 0.17,
          "#90a3a7",
        );
      }
      for (const side of [-1, 1]) {
        panel(
          side * (width / 2 - 0.2),
          top + 0.495,
          0,
          0.4,
          0.54,
          depth,
          "#516572",
        );
        glow(
          side * (width / 2 - 0.2),
          top + 0.815,
          -depth * 0.2,
          0.22,
          0.1,
          depth * 0.4,
        );
      }
    }
    roof.build(roofGroup);
    const ceilingMesh = ceilings.build(roofGroup);
    if (!Array.isArray(ceilingMesh.material)) ceilingMesh.material.dispose();
    ceilingMesh.material = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    {
      const glassMesh = glazing.build(roofGroup);
      if (glassMesh.material instanceof THREE.MeshStandardMaterial) {
        glassMesh.material.transparent = true;
        glassMesh.material.opacity = 0.5;
        glassMesh.material.depthWrite = false;
        glassMesh.material.roughness = 0.18;
        glassMesh.material.metalness = 0.15;
      }
    }
    accents.build(roofGroup);
    roofs.set(b.id, roofGroup);
    group.add(roofGroup);
  }
  for (const b of layout.buildings) {
    building(b);
    buildRoof(b);
  }
  const shuttles = buildTransitStops(layout, blocks, lights, colliders);
  group.add(...shuttles.values());
  const titlePlacements = planDistrictTitles(layout, graph);
  const titles = new THREE.Group();
  group.add(titles);
  const titleMeshes = buildDistrictTitles(titlePlacements, titles);
  blocks.owner = undefined;
  lights.owner = undefined;
  const streetscape = buildStreetscape(
    layout,
    titlePlacements,
    blocks,
    lights,
    colliders,
    group,
  );
  const solidMesh = blocks.build(group),
    fileMesh = files.build(group);
  const lightMesh = lights.build(group);
  const signMeshes = [
    ...streetscape.signs,
    ...buildingSigns(layout, graph, group),
    ...filePlacards(layout, graph, group),
  ];
  const buildingMap = new Map(layout.buildings.map((b) => [b.id, b]));
  const aggregate = new Map<
    string,
    { a: Building; b: Building; weight: number }
  >();
  for (const edge of graph.edges) {
    const a = layout.positions.get(edge.source)!,
      b = layout.positions.get(edge.target)!;
    if (a.buildingId === b.buildingId) continue;
    const key = `${a.buildingId}>${b.buildingId}`,
      old = aggregate.get(key);
    if (old) old.weight++;
    else
      aggregate.set(key, {
        a: buildingMap.get(a.buildingId)!,
        b: buildingMap.get(b.buildingId)!,
        weight: 1,
      });
  }
  const routeLines: number[] = [],
    trafficRoutes: Route[] = [];
  const routeEntries = [...aggregate.entries()]
    .sort(
      ([keyA, a], [keyB, b]) => b.weight - a.weight || keyA.localeCompare(keyB),
    )
    .slice(0, 96);
  const stride = Math.max(1, Math.ceil(routeEntries.length / 220));
  routeEntries.forEach(([key, { a, b, weight }], index) => {
    const start = new THREE.Vector3(a.x, a.height + 2, a.z - a.depth / 2),
      end = new THREE.Vector3(b.x, b.height + 2, b.z - b.depth / 2),
      control = start.clone().lerp(end, 0.5);
    control.y =
      Math.max(a.height, b.height) + 14 + start.distanceTo(end) * 0.14;
    const points = new THREE.QuadraticBezierCurve3(
      start,
      control,
      end,
    ).getPoints(20);
    let length = 0;
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
      routeLines.push(...points[i - 1].toArray(), ...points[i].toArray());
      length += points[i].distanceTo(points[i - 1]);
      lengths.push(length);
    }
    if (index % stride === 0)
      trafficRoutes.push({
        source: a.id,
        target: b.id,
        points,
        lengths,
        length,
        seed: (hash(key + weight) % 1000) / 1000,
      });
  });
  routes.add(lineGeometry(routeLines, "#74e4ce", 0.19));
  const trafficGeometry = new THREE.BufferGeometry();
  trafficGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      new Float32Array(trafficRoutes.length * 3),
      3,
    ),
  );
  const traffic = new THREE.Points(
    trafficGeometry,
    new THREE.PointsMaterial({
      color: "#d6ffb6",
      size: 0.55,
      sizeAttenuation: true,
      toneMapped: false,
    }),
  );
  traffic.frustumCulled = false;
  routes.add(traffic);
  group.add(routes);
  return {
    group,
    roofs,
    shuttles,
    routes,
    colliders,
    pickables: [
      ...shuttles.values(),
      fileMesh,
      solidMesh,
      lightMesh,
      ...signMeshes,
      ...titleMeshes,
      ...roofs.values(),
    ],
    traffic,
    trafficRoutes,
    titlePlacements,
    water: streetscape.water,
    titles,
  };
}
export function animateTraffic(city: City, time: number) {
  city.water.uniforms.time.value = time;
  const attribute = city.traffic.geometry.getAttribute("position");
  const position = new THREE.Vector3();
  city.trafficRoutes.forEach((route, i) => {
    const distance = (time * 9 + route.seed * route.length) % route.length;
    let segment = 1;
    while (
      segment < route.lengths.length - 1 &&
      route.lengths[segment] < distance
    )
      segment++;
    const span = route.lengths[segment] - route.lengths[segment - 1];
    position.lerpVectors(
      route.points[segment - 1],
      route.points[segment],
      span > 0 ? (distance - route.lengths[segment - 1]) / span : 0,
    );
    attribute.setXYZ(i, position.x, position.y, position.z);
  });
  attribute.needsUpdate = true;
}
