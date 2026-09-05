import { extraPlaqueMounts } from "./extra-furniture.ts";
import * as THREE from "three";
import type { ProjectGraph } from "../graph/types.ts";
import { palette, type WorldLayout, type FurnitureKind } from "./layout.ts";
import { roomTheme } from "./interiors.ts";
import { furnitureSize } from "./furniture.ts";
import { stairwells } from "./stairs.ts";
import { cyberPlaqueMounts } from "./cyber-furniture.ts";
const plaqueMounts: Record<
  FurnitureKind,
  { x: number; y: number; z: number; width: number; height: number }
> = {
  ...cyberPlaqueMounts,
  ...extraPlaqueMounts,
  bed: { x: 0, y: 0.27, z: 2, width: 2, height: 0.24 },
  sofa: { x: 0, y: 0.5, z: 0.7, width: 2.6, height: 0.23 },
  armchair: { x: 0, y: 0.5, z: 0.675, width: 1, height: 0.23 },
  desk: { x: 0, y: 1.64, z: -0.184, width: 1.08, height: 0.17 },
  table: { x: 0, y: 0.72, z: 0.7, width: 1.9, height: 0.11 },
  stool: { x: 0, y: 0.75, z: 0.35, width: 0.62, height: 0.14 },
  lamp: { x: 0, y: 0.1, z: 0.33, width: 0.58, height: 0.16 },
  bookshelf: { x: 0, y: 2.46, z: 0.3, width: 1.85, height: 0.17 },
  wardrobe: { x: 0, y: 2.25, z: 0.4, width: 1.55, height: 0.22 },
  painting: { x: 0, y: 0.1, z: 0.06, width: 2.1, height: 0.18 },
  terminal: { x: 0, y: 1.66, z: 0.191, width: 0.87, height: 0.15 },
  planter: { x: 0, y: 0.28, z: 0.38, width: 0.66, height: 0.22 },
  cabinet: { x: 0, y: 0.94, z: 0.4, width: 1.2, height: 0.22 },
  workbench: { x: 0, y: 1.59, z: -0.404, width: 2.5, height: 0.19 },
};

interface Sign {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation?: number;
}
export function buildingSigns(
  layout: WorldLayout,
  graph: ProjectGraph,
  parent: THREE.Object3D,
) {
  const packages = new Map(graph.packages.map((pkg) => [pkg.id, pkg]));
  const signs: Sign[] = layout.buildings.map((building) => {
    const pkg = packages.get(building.packageId);
    let path = building.directory;
    if (pkg?.directory)
      path = path.slice(pkg.directory.length).replace(/^\//, "");
    return {
      id: building.id,
      title: building.name,
      subtitle: `${pkg?.name ?? graph.name} / ${path || "."}`,
      color: palette[building.kind],
      x: building.x,
      y: 5.2,
      z: building.z + building.depth / 2 + 0.85,
      width: 6,
      height: 2.25,
    };
  });
  for (const building of layout.buildings) {
    for (const well of stairwells(building))
      for (let floor = 0; floor < building.stories; floor++) {
        signs.push({
          id: building.id,
          title: floor === building.stories - 1 ? "Stairs ↓" : "Stairs ↑",
          subtitle: "",
          color: "#8eead9",
          x: well.x,
          y: floor * 5.4 + 3.4,
          z: well.entryZ - well.direction * 1.3,
          width: 2.5,
          height: 0.55,
          rotation: well.direction > 0 ? Math.PI : 0,
        });
      }
    for (const room of building.rooms) {
      const direction = room.door.rotation;
      signs.push({
        id: room.id,
        title: room.name,
        subtitle: roomTheme(room),
        color: palette[building.kind],
        x: room.door.x + Math.sin(direction) * 0.21,
        y: room.floorY + 4,
        z: room.door.z + Math.cos(direction) * 0.21,
        width: 2.8,
        height: 1.05,
        rotation: direction,
      });
    }
  }
  return renderSigns(signs, parent);
}
export function filePlacards(
  layout: WorldLayout,
  graph: ProjectGraph,
  parent: THREE.Object3D,
) {
  const signs: Sign[] = graph.nodes.map((node) => {
    const position = layout.positions.get(node.id)!;
    const size = furnitureSize[position.furniture];
    const mount = plaqueMounts[position.furniture];
    const width = mount.width;
    const base = size.wall ? position.y - size.height / 2 : position.floorY;
    const labelY = base + mount.y;
    const offset = mount.z + 0.012;
    return {
      id: node.id,
      title: node.name,
      subtitle: "",
      color: palette[node.kind],
      x:
        position.x +
        mount.x * Math.cos(position.rotation) +
        Math.sin(position.rotation) * offset,
      y: labelY,
      z:
        position.z -
        mount.x * Math.sin(position.rotation) +
        Math.cos(position.rotation) * offset,
      width,
      height: mount.height,
      rotation: position.rotation,
    };
  });
  return renderSigns(signs, parent, 512, 48);
}
function renderSigns(
  signs: Sign[],
  parent: THREE.Object3D,
  cellWidth = 256,
  cellHeight = 96,
) {
  const meshes: THREE.Mesh[] = [],
    columns = 2048 / cellWidth,
    batchSize = columns * Math.floor(2048 / cellHeight);
  // Atlases bound texture size and batch the physical signs into a few draw calls.
  for (let start = 0; start < signs.length; start += batchSize) {
    const batch = signs.slice(start, start + batchSize),
      canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = Math.max(
      cellHeight,
      Math.ceil(batch.length / columns) * cellHeight,
    );
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create directory sign texture.");
    const vertices: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    batch.forEach((sign, i) => {
      const left = (i % columns) * cellWidth,
        top = Math.floor(i / columns) * cellHeight;
      context.save();
      context.translate(left, top);
      const designWidth = (96 * sign.width) / sign.height;
      const textWidth = designWidth - 24;
      context.scale(cellWidth / designWidth, cellHeight / 96);
      context.fillStyle = "#122530";
      context.fillRect(0, 0, designWidth, 96);
      context.strokeStyle = sign.color;
      context.lineWidth = 2;
      context.strokeRect(2, 2, designWidth - 4, 92);
      context.fillStyle = sign.color;
      context.textAlign = "center";
      context.textBaseline = "middle";
      let fontSize = sign.subtitle ? 21 : 64;
      context.font = `500 ${fontSize}px monospace`;
      while (
        fontSize > 11 &&
        context.measureText(sign.title).width > textWidth
      ) {
        fontSize--;
        context.font = `500 ${fontSize}px monospace`;
      }
      let lines = wrapSignTitle(context, sign.title, textWidth);
      if (lines.length > 2)
        lines = [
          lines[0],
          fitText(context, lines.slice(1).join(""), textWidth),
        ];
      let titleY = lines.length === 1 ? 34 : 23;
      const lineHeight = fontSize + 3;
      if (!sign.subtitle)
        titleY = lines.length === 1 ? 48 : 48 - lineHeight / 2;
      for (const [index, line] of lines.entries())
        context.fillText(line, designWidth / 2, titleY + index * lineHeight);
      if (sign.subtitle) {
        context.fillStyle = "#b8d1d9";
        context.font = "12px monospace";
        context.fillText(
          fitText(context, sign.subtitle, textWidth),
          designWidth / 2,
          77,
        );
      }
      context.restore();
      const { x, y, z, width: w, height: h } = sign;
      const cos = Math.cos(sign.rotation ?? 0),
        sin = Math.sin(sign.rotation ?? 0);
      for (const [dx, dy] of [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ])
        vertices.push(x + dx * cos, y + dy, z - dx * sin);
      const u = left / canvas.width,
        v = 1 - (top + cellHeight) / canvas.height,
        uw = cellWidth / canvas.width,
        vh = cellHeight / canvas.height;
      uv.push(u, v, u + uw, v, u + uw, v + vh, u, v + vh);
      const offset = i * 4;
      indices.push(
        offset,
        offset + 1,
        offset + 2,
        offset,
        offset + 2,
        offset + 3,
      );
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    mesh.userData.signIds = batch.map((sign) => sign.id);
    parent.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

function wrapSignTitle(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  const words = text.split(/(?<=[\s/_-])|(?<=[a-z0-9])(?=[A-Z])/);
  for (const word of words) {
    if (line && context.measureText(line + word).width > width) {
      lines.push(fitText(context, line, width));
      line = "";
    }
    line += word;
  }
  if (line) lines.push(fitText(context, line, width));
  return lines;
}
function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
): string {
  if (context.measureText(text).width <= width) return text;
  const extension = text.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  let result = extension ? text.slice(0, -extension.length) : text;
  while (result && context.measureText(result + "…" + extension).width > width)
    result = result.slice(0, -1);
  return result + "…" + extension;
}
