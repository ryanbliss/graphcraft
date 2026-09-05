import * as THREE from "three";
import type { ProjectGraph } from "../graph/types.ts";
import type { WorldLayout } from "./layout.ts";

interface Rectangle {
  x: number;
  z: number;
  width: number;
  depth: number;
}
export interface DistrictTitlePlacement extends Rectangle {
  id: string;
  packageId: string;
  title: string;
  path: string;
  color: string;
  titleHeight: number;
  forecourt: boolean;
}
const overlap = (a: Rectangle, b: Rectangle) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
  Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;

function clearRectangles(area: Rectangle, obstacles: Rectangle[]): Rectangle[] {
  let spaces = [area];
  for (const obstacle of obstacles) {
    const next: Rectangle[] = [];
    for (const space of spaces) {
      if (!overlap(space, obstacle)) {
        next.push(space);
        continue;
      }
      const left = space.x - space.width / 2,
        right = space.x + space.width / 2;
      const rear = space.z - space.depth / 2,
        front = space.z + space.depth / 2;
      const cutLeft = Math.max(left, obstacle.x - obstacle.width / 2);
      const cutRight = Math.min(right, obstacle.x + obstacle.width / 2);
      const cutRear = Math.max(rear, obstacle.z - obstacle.depth / 2);
      const cutFront = Math.min(front, obstacle.z + obstacle.depth / 2);
      const add = (x1: number, z1: number, x2: number, z2: number) => {
        if (x2 - x1 >= 2 && z2 - z1 >= 2)
          next.push({
            x: (x1 + x2) / 2,
            z: (z1 + z2) / 2,
            width: x2 - x1,
            depth: z2 - z1,
          });
      };
      add(left, rear, right, cutRear);
      add(left, cutFront, right, front);
      add(left, cutRear, cutLeft, cutFront);
      add(cutRight, cutRear, right, cutFront);
    }
    spaces = next;
  }
  return spaces;
}

export function planDistrictTitles(
  layout: WorldLayout,
  graph: ProjectGraph,
): DistrictTitlePlacement[] {
  const packages = new Map(graph.packages.map((pkg) => [pkg.id, pkg]));
  const roots = new Map(
    layout.regions
      .filter((region) => !region.parentId)
      .map((region) => [region.packageId, region]),
  );
  const obstacles: Rectangle[] = layout.buildings.map((building) => ({
    x: building.x,
    z: building.z,
    width: building.width + 4,
    depth: building.depth + 4,
  }));
  for (const district of layout.districts) {
    const entranceZ = district.z + district.depth / 2;
    // Keep the district arrival approach clear.
    obstacles.push({ x: district.x, z: entranceZ, width: 17, depth: 2 });
    // Reserve the existing shuttle pad, hull and offset signpost.
    obstacles.push({
      x: district.x + 6.5,
      z: entranceZ + 5,
      width: 12,
      depth: 11,
    });
  }
  const titles: DistrictTitlePlacement[] = [];
  for (const district of layout.districts) {
    const root = roots.get(district.id);
    if (!root) continue;
    const pkg = packages.get(district.id);
    const title = pkg?.name ?? district.name;
    const ratio = Math.max(4, title.length * 0.58);
    const desiredWidth = Math.min(
      720,
      ratio * Math.min(40, Math.max(6, district.depth * 0.12)),
    );
    const entranceZ = district.z + district.depth / 2;
    const choose = (areas: Rectangle[]) => {
      let best: Rectangle | undefined;
      let bestScore = -Infinity;
      for (const area of areas)
        for (const space of clearRectangles(area, obstacles)) {
          const width = Math.min(
            desiredWidth,
            space.width,
            space.depth * ratio,
          );
          const depth = width / ratio;
          if (width < 12 || depth < 2) continue;
          const x = Math.max(
            space.x - space.width / 2 + width / 2,
            Math.min(district.x, space.x + space.width / 2 - width / 2),
          );
          const z = Math.max(
            space.z - space.depth / 2 + depth / 2,
            Math.min(
              entranceZ - depth / 2 - 2,
              space.z + space.depth / 2 - depth / 2,
            ),
          );
          const distance = Math.hypot(x - district.x, z - entranceZ);
          const score =
            width / desiredWidth -
            (0.3 * distance) / Math.max(district.width, district.depth);
          if (score > bestScore) {
            best = { x, z, width, depth };
            bestScore = score;
          }
        }
      return best;
    };
    const interior = choose([
      {
        x: district.x,
        z: district.z,
        width: district.width - 4,
        depth: district.depth - 4,
      },
    ]);
    const cityLeft = -layout.width / 2 + 2,
      cityRight = layout.width / 2 - 2;
    const cityRear = -layout.depth / 2 + 2,
      cityFront = layout.depth / 2 - 2;
    const left = Math.max(cityLeft, district.x - district.width / 2);
    const right = Math.min(cityRight, district.x + district.width / 2);
    const front = Math.min(cityFront, entranceZ + 20);
    const rear = Math.max(cityRear, entranceZ + 1);
    const forecourt = {
      x: (left + right) / 2,
      z: (rear + front) / 2,
      width: right - left,
      depth: front - rear,
    };
    const placement =
      interior ??
      choose(forecourt.width > 0 && forecourt.depth > 0 ? [forecourt] : []);
    // A fully occupied layout has no honest place for a title.
    if (!placement) continue;
    titles.push({
      ...placement,
      id: root.id,
      packageId: district.id,
      title,
      path: pkg?.directory ?? root.directory,
      color: district.color,
      titleHeight: Math.min(32, placement.depth),
      forecourt: !interior,
    });
    obstacles.push({
      ...placement,
      width: placement.width + 2,
      depth: placement.depth + 2,
    });
  }
  return titles;
}

export function buildDistrictTitles(
  placements: DistrictTitlePlacement[],
  parent: THREE.Object3D,
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  for (const title of placements) {
    const canvas = document.createElement("canvas");
    const ratio = title.width / title.depth;
    canvas.width = Math.min(2048, Math.ceil(256 * ratio));
    canvas.height = Math.round(canvas.width / ratio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create district title texture.");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#e2ffff";
    context.shadowColor = title.color;
    context.shadowBlur = 6;
    let fontSize = canvas.height * (title.path ? 0.64 : 0.78);
    context.font = `600 ${fontSize}px monospace`;
    const measuredWidth = context.measureText(title.title).width;
    if (measuredWidth > canvas.width * 0.94)
      fontSize *= (canvas.width * 0.94) / measuredWidth;
    context.font = `600 ${fontSize}px monospace`;
    context.fillText(
      title.title,
      canvas.width / 2,
      canvas.height * (title.path ? 0.4 : 0.5),
    );
    if (title.path) {
      let pathSize = canvas.height * 0.16;
      context.font = `400 ${pathSize}px monospace`;
      const pathWidth = context.measureText(title.path).width;
      if (pathWidth > canvas.width * 0.92)
        pathSize *= (canvas.width * 0.92) / pathWidth;
      context.font = `400 ${pathSize}px monospace`;
      context.fillStyle = title.color;
      context.shadowBlur = 0;
      context.fillText(title.path, canvas.width / 2, canvas.height * 0.86);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    for (const ground of [true, false]) {
      const height = ground ? title.depth : title.titleHeight;
      const width = ground ? title.width : (title.width * height) / title.depth;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: new THREE.Color(title.color).multiplyScalar(2.2),
        transparent: true,
        opacity: ground ? 0.56 : 0.88,
        alphaTest: 0.03,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        material,
      );
      if (ground) {
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(title.x, 0.115, title.z);
      } else {
        mesh.position.set(
          title.x,
          2.8 + height / 2,
          title.z - title.depth / 2 + 0.1,
        );
      }
      mesh.userData.signIds = [title.id];
      mesh.userData.districtTitle = title.packageId;
      parent.add(mesh);
      meshes.push(mesh);
    }
  }
  return meshes;
}
