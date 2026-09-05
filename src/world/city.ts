import * as THREE from "three";
import { hash, type ProjectGraph } from "../graph/types.ts";
import { palette, type WorldLayout, type Building } from "./layout.ts";
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
  routes: THREE.Group;
  colliders: CollisionWorld;
  pickables: THREE.Object3D[];
  traffic: THREE.Points;
  trafficRoutes: Route[];
  titlePlacements: DistrictTitlePlacement[];
  titles: THREE.Group;
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
  for (const path of layout.paths)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i];
      if (a.x === b.x && a.z === b.z) continue;
      blocks.add(
        (a.x + b.x) / 2,
        0.035,
        (a.z + b.z) / 2,
        Math.max(2.4, Math.abs(a.x - b.x)),
        0.04,
        Math.max(2.4, Math.abs(a.z - b.z)),
        "#354650",
      );
    }
  function building(b: Building) {
    blocks.owner = b.id;
    lights.owner = b.id;
    const { x, z, width: w, depth: d } = b,
      color = palette[b.kind];
    solid(blocks, colliders, x, 1.3, z - d / 2, w, 2.6, 0.6, "#283948", b.id);
    solid(blocks, colliders, x - w / 2, 1.3, z, 0.6, 2.6, d, "#263744", b.id);
    solid(blocks, colliders, x + w / 2, 1.3, z, 0.6, 2.6, d, "#263744", b.id);
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
    solid(blocks, colliders, x, 4.9, z + d / 2, 5, 0.6, 1.1, "#3d505a", b.id);
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
            "#e5c59c",
          );
      }
    lights.add(x, 2.68, z - d / 2, w, 0.08, 0.72, color);
    for (const side of [-1, 1])
      lights.add(x + (side * w) / 2, 2.68, z, 0.72, 0.08, d, color);
    const facade =
      b.kind === "module" || b.kind === "schema" ? "#735b54" : "#344b58";
    for (let floor = 0; floor < b.stories; floor++) {
      const floorY = floor * 5.4;
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
            d,
            facade,
          );
          solid(
            blocks,
            colliders,
            x,
            floorY + 0.55,
            z + (side * d) / 2,
            w,
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
          d + 1,
          "#62717a",
        );
        solid(
          blocks,
          colliders,
          x,
          floorY + 4.95,
          z + (side * d) / 2,
          w + 1,
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
            "#e4c89a",
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
    ) => accents.add(b.x + dx, y, b.z + dz, w, h, d, "#d6c594");
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
          lanternDepth,
        );
        glass(
          0,
          top + 0.25 + glassHeight / 2,
          (side * lanternDepth) / 2,
          lanternWidth,
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
          lanternWidth + 0.3,
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
            glassHeight,
            0.2,
            "#708d85",
          );
      }
    } else {
      deck(0, 0, width, depth);
      if (b.template === "studio") {
        for (let tier = 0; tier < 7; tier++)
          panel(
            0,
            top + 0.25 + (rise * tier) / 7,
            0,
            width * (1 - tier / 8),
            rise / 7 + 0.05,
            depth,
            "#6a555e",
          );
        panel(0, top + rise + 0.03, 0, 0.4, 0.18, depth, "#ba9680");
        glow(0, top + rise * 0.46, depth / 2 - 0.03, width * 0.46, 0.14, 0.1);
      } else if (b.template === "townhouse") {
        for (const side of [-1, 1]) {
          const ridge = side < 0 ? rise : rise * 0.72;
          const dx = (side * width) / 4;
          for (let tier = 0; tier < 6; tier++)
            panel(
              dx,
              top + 0.25 + (ridge * tier) / 6,
              0,
              (width / 2) * (1 - tier / 7),
              ridge / 6 + 0.05,
              depth,
              side < 0 ? "#70535d" : "#586c6b",
            );
          panel(dx, top + ridge + 0.04, 0, 0.3, 0.18, depth, "#b79985");
          panel(
            dx,
            top + ridge * 0.55,
            depth / 2 - 1,
            3.5,
            ridge * 0.8,
            1.8,
            "#41565f",
          );
          glass(
            dx,
            top + ridge * 0.55,
            depth / 2 - 0.07,
            2.8,
            ridge * 0.6,
            0.08,
          );
          glow(dx, top + ridge * 0.42, depth / 2 - 0.01, 2.5, 0.12, 0.05);
          panel(dx, top + ridge * 0.97, depth / 2 - 1, 4, 0.2, 2, "#b09882");
        }
      } else {
        const sawDepth = (depth - 4) / 3;
        for (let bay = 0; bay < 3; bay++) {
          const dz = -depth / 2 + 2 + (bay + 0.5) * sawDepth;
          for (let tier = 0; tier < 4; tier++)
            panel(
              -3,
              top + 0.3 + (rise * 0.55 * tier) / 4,
              dz + (tier * sawDepth) / 8,
              width - 8,
              (rise * 0.55) / 4 + 0.06,
              sawDepth * (1 - tier / 4),
              "#65766f",
            );
          glass(
            -3,
            top + rise * 0.32,
            dz + sawDepth / 2,
            width - 9,
            rise * 0.45,
            0.08,
          );
        }
        const utilityX = width / 2 - 3;
        panel(utilityX, top + 0.65, -depth / 4, 4.5, 1.05, 5, "#93978c");
        panel(utilityX, top + rise / 2, depth / 4, 2, rise - 0.2, 2, "#617982");
        panel(
          utilityX,
          top + rise - 0.05,
          depth / 4,
          2.7,
          0.22,
          2.7,
          "#a4aaa0",
        );
        panel(utilityX, top + 0.35, 0, 0.65, 0.45, depth / 2, "#9fa595");
        for (let slat = 0; slat < 5; slat++)
          panel(
            utilityX - 1.6 + slat * 0.8,
            top + 1.2,
            -depth / 4,
            0.18,
            0.08,
            4.2,
            "#3d5358",
          );
      }
    }
    roof.build(roofGroup);
    const ceilingMesh = ceilings.build(roofGroup);
    if (!Array.isArray(ceilingMesh.material)) ceilingMesh.material.dispose();
    ceilingMesh.material = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    if (b.template !== "studio") {
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
  buildTransitStops(layout, blocks, lights, colliders);
  const titlePlacements = planDistrictTitles(layout, graph);
  const titles = new THREE.Group();
  group.add(titles);
  const titleMeshes = buildDistrictTitles(titlePlacements, titles);
  const solidMesh = blocks.build(group),
    fileMesh = files.build(group);
  const lightMesh = lights.build(group);
  const signMeshes = [
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
    routes,
    colliders,
    pickables: [
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
    titles,
  };
}
export function animateTraffic(city: City, time: number) {
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
