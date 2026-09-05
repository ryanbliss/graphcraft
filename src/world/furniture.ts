import {
  extraFurnitureSize,
  furnishExtraArtifact,
  isExtraFurniture,
} from "./extra-furniture.ts";
import { hash, type GraphNode } from "../graph/types.ts";
import type { FurnitureKind, NodePosition } from "./layout.ts";
import { solid, type VoxelBatch } from "./geometry.ts";
import type { CollisionWorld } from "./physics.ts";
import {
  cyberFurnitureSize,
  furnishCyberArtifact,
  isCyberFurniture,
} from "./cyber-furniture.ts";

export const furnitureSize: Record<
  FurnitureKind,
  { width: number; depth: number; height: number; wall?: boolean }
> = {
  ...cyberFurnitureSize,
  ...extraFurnitureSize,
  bed: { width: 2.5, depth: 4, height: 1.2 },
  sofa: { width: 3.4, depth: 1.4, height: 1.5 },
  armchair: { width: 1.25, depth: 1.35, height: 1.5 },
  desk: { width: 2.5, depth: 1.2, height: 1.8 },
  table: { width: 2.2, depth: 1.4, height: 0.85 },
  stool: { width: 0.7, depth: 0.7, height: 0.85 },
  lamp: { width: 0.7, depth: 0.7, height: 2 },
  bookshelf: { width: 2.2, depth: 0.6, height: 2.6 },
  wardrobe: { width: 1.8, depth: 0.8, height: 2.7 },
  painting: { width: 2.4, depth: 0.12, height: 1.6, wall: true },
  terminal: { width: 1.2, depth: 0.8, height: 2.1 },
  planter: { width: 1, depth: 1, height: 1.6 },
  cabinet: { width: 1.4, depth: 0.8, height: 1.2 },
  workbench: { width: 3, depth: 1.3, height: 1.7 },
};

export function furnishArtifact(
  node: GraphNode,
  p: NodePosition,
  blocks: VoxelBatch,
  lights: VoxelBatch,
  files: VoxelBatch,
  colliders: CollisionWorld,
  cyclic: boolean,
): void {
  const size = furnitureSize[p.furniture];
  const base = size.wall ? p.y - size.height / 2 : p.floorY;
  const cos = Math.cos(p.rotation),
    sin = Math.sin(p.rotation);
  const seed = hash(node.id);
  const variant = hash(`${node.id}:shape`) % 3;
  const fabric = ["#15555c", "#702c42", "#b35a2d", "#514467"][seed % 4];
  const frame = "#26323d";
  const panel = "#465560";
  const alloy = "#829092";
  const accent = seed % 2 ? "#58bdb3" : "#dfa34b";
  const part = (
    dx: number,
    y: number,
    dz: number,
    w: number,
    h: number,
    d: number,
    color: string,
    body = false,
    glow = false,
  ) => {
    const x = p.x + dx * cos + dz * sin;
    const z = p.z - dx * sin + dz * cos;
    const width = Math.abs(cos) * w + Math.abs(sin) * d;
    const depth = Math.abs(sin) * w + Math.abs(cos) * d;
    if (body)
      solid(blocks, colliders, x, base + y, z, width, h, depth, color, node.id);
    else
      (glow ? lights : files).add(
        x,
        base + y,
        z,
        width,
        h,
        depth,
        color,
        node.id,
      );
  };
  const legs = (w: number, d: number, height: number) => {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        part(
          sx * (w / 2 - 0.12),
          height / 2,
          sz * (d / 2 - 0.12),
          0.15,
          height,
          0.15,
          "#47545b",
          true,
        );
  };
  const screen = (x: number, y: number, z: number, w: number, h: number) => {
    part(x, y, z, w, h, 0.08, frame);
    part(x, y, z + 0.045, w - 0.12, h - 0.12, 0.02, "#24444e");
    // Leave the upper display clear for the actual file title.
    for (let line = 0; line < 3; line++)
      part(
        x - w * 0.17,
        y - h * 0.05 - line * h * 0.15,
        z + 0.06,
        w * (0.25 + ((seed + line) % 3) * 0.12),
        0.018,
        0.01,
        accent,
      );
  };
  if (isExtraFurniture(p.furniture))
    furnishExtraArtifact(p.furniture, part, seed, variant);
  else if (isCyberFurniture(p.furniture))
    furnishCyberArtifact(p.furniture, part, seed, variant);
  else
    switch (p.furniture) {
      case "bed": {
        part(0, 0.25, -0.02, 2.5, 0.5, 3.96, frame, true);
        part(0, 0.87, -1.85, 2.5, 0.66, 0.3, panel, true);
        const padWidth = variant === 1 ? 1.85 : 2.12;
        const padX = variant === 1 ? -0.14 : 0;
        for (let segment = 0; segment < 3; segment++)
          part(
            padX,
            0.65,
            -0.92 + segment * 1.08,
            padWidth,
            0.3,
            1.02,
            fabric,
            true,
          );
        part(padX, 0.88, -1.36, padWidth - 0.12, 0.17, 0.48, "#61797c");
        if (variant === 0) {
          for (const side of [-1, 1]) {
            part(side * 1.15, 0.62, 0.1, 0.2, 0.24, 3.2, panel);
            part(side * 1.15, 0.75, 0.8, 0.08, 0.02, 1.3, accent, false, true);
          }
        } else if (variant === 1) {
          part(1.08, 0.72, -0.55, 0.34, 0.44, 2.3, panel, true);
          part(1.08, 0.95, -1.13, 0.25, 0.02, 0.56, accent);
          for (let slot = 0; slot < 3; slot++)
            part(1.08, 0.95, -0.6 + slot * 0.3, 0.2, 0.02, 0.08, alloy);
        } else {
          part(0, 1.04, -1.65, 1.35, 0.17, 0.08, fabric);
          for (const x of [-0.96, 0.96])
            part(x, 0.97, -1.685, 0.07, 0.3, 0.025, accent, false, true);
          part(0, 0.65, 1.76, 2.35, 0.26, 0.3, panel);
        }
        for (const x of [-0.89, 0.89])
          part(x, 0.27, 1.985, 0.38, 0.045, 0.03, alloy);
        break;
      }
      case "sofa":
      case "armchair": {
        const w = size.width,
          d = size.depth;
        if (variant === 0) legs(w - 0.14, d - 0.12, 0.25);
        else if (variant === 1)
          part(0, 0.19, 0, w * 0.64, 0.38, d * 0.65, panel, true);
        else
          for (const side of [-1, 1])
            part(
              side * (w / 2 - 0.2),
              0.19,
              0,
              0.18,
              0.38,
              d - 0.08,
              alloy,
              true,
            );
        part(0, 0.5, -0.015, w - 0.04, 0.3, d - 0.03, frame, true);
        const seats = p.furniture === "sofa" ? 2 + (variant % 2) : 1;
        const seatWidth = (w - 0.4) / seats;
        for (let seat = 0; seat < seats; seat++) {
          const x = -w / 2 + 0.2 + seatWidth * (seat + 0.5);
          const backHeight = variant === 2 && seat % 2 === 0 ? 0.65 : 0.8;
          part(x, 0.74, 0.11, seatWidth - 0.04, 0.24, d - 0.4, fabric, true);
          part(
            x,
            0.7 + backHeight / 2,
            -d / 2 + 0.16,
            seatWidth - 0.04,
            backHeight,
            0.3,
            fabric,
            true,
          );
          part(x, 1.16, -d / 2 + 0.316, seatWidth * 0.65, 0.04, 0.012, panel);
        }
        for (const side of [-1, 1]) {
          const armDepth = variant === 1 ? d * 0.6 : d - 0.08;
          part(
            side * (w / 2 - 0.09),
            0.85,
            0.02,
            0.18,
            0.52,
            armDepth,
            frame,
            true,
          );
          part(
            side * (w / 2 - 0.09),
            1.12,
            0.1,
            0.14,
            0.035,
            armDepth * 0.55,
            alloy,
          );
        }
        part(
          -w * 0.32,
          0.53,
          d / 2 - 0.006,
          w * 0.13,
          0.04,
          0.012,
          accent,
          false,
          true,
        );
        break;
      }
      case "desk":
        part(-0.83, 0.43, -0.025, 0.64, 0.86, 1.05, frame, true);
        part(1.08, 0.42, -0.12, 0.18, 0.84, 0.84, alloy, true);
        part(0, 0.89, 0, 2.5, 0.14, 1.2, panel, true);
        part(-0.83, 0.5, 0.515, 0.51, 0.54, 0.03, fabric);
        part(-0.83, 0.73, 0.539, 0.3, 0.024, 0.012, accent);
        part(0, 1.24, -0.35, 0.18, 0.57, 0.16, alloy);
        screen(0, 1.51, -0.25, 1.26, 0.56);
        if (variant === 0) screen(-0.91, 1.37, -0.24, 0.48, 0.7);
        else if (variant === 1) {
          screen(0.9, 1.3, -0.12, 0.5, 0.5);
          part(0.9, 1.07, -0.25, 0.12, 0.2, 0.12, alloy);
        } else {
          part(0, 1.05, -0.44, 2.35, 0.17, 0.25, frame);
          for (const x of [-0.96, 0.96])
            part(x, 1.2, -0.32, 0.25, 0.45, 0.23, fabric);
        }
        part(0.15, 0.985, 0.28, 1.05, 0.05, 0.3, frame);
        for (let row = 0; row < 3; row++)
          part(0.1, 1.015, 0.2 + row * 0.07, 0.78, 0.01, 0.035, alloy);
        break;
      case "table":
        if (variant === 0) part(0, 0.32, 0, 0.6, 0.64, 0.7, frame, true);
        else if (variant === 1)
          for (const x of [-0.78, 0.78])
            part(x, 0.32, 0, 0.2, 0.64, 1.22, frame, true);
        else {
          part(0, 0.32, 0, 1.85, 0.64, 0.2, frame, true);
          part(0, 0.12, 0, 0.3, 0.24, 1.25, alloy, true);
        }
        part(0, 0.72, 0, 2.2, 0.14, 1.4, panel, true);
        part(0, 0.805, 0, 1.55, 0.03, 0.93, "#24444e");
        for (let stripe = 0; stripe < 3 + variant; stripe++)
          part(-0.56 + stripe * 0.23, 0.829, 0.05, 0.025, 0.008, 0.55, accent);
        part(0.82, 0.812, 0, 0.08, 0.04, 0.75, fabric);
        break;
      case "stool":
        if (variant === 0) {
          part(0, 0.32, 0, 0.17, 0.64, 0.17, alloy, true);
          part(0, 0.055, 0, 0.65, 0.11, 0.65, frame, true);
        } else if (variant === 1)
          for (const x of [-0.25, 0.25])
            part(x, 0.33, 0, 0.12, 0.66, 0.6, panel, true);
        else {
          part(0, 0.34, 0, 0.6, 0.68, 0.6, frame, true);
          for (const y of [0.22, 0.43])
            part(0, y, 0.305, 0.42, 0.055, 0.01, alloy);
        }
        part(0, 0.745, 0, 0.7, 0.17, 0.7, fabric, true);
        part(0.27, 0.835, 0, 0.045, 0.01, 0.49, accent);
        break;
      case "lamp":
        part(0, 0.1, 0, 0.66, 0.2, 0.66, frame, true);
        if (variant === 0) {
          part(-0.2, 0.97, -0.1, 0.12, 1.74, 0.12, alloy, true);
          part(0, 1.87, 0, 0.7, 0.18, 0.5, frame);
          part(0, 1.773, 0, 0.5, 0.014, 0.3, accent, false, true);
        } else if (variant === 1) {
          for (const x of [-0.22, 0.22]) {
            part(x, 1.1, 0, 0.15, 1.8, 0.18, frame, true);
            part(x, 1.18, 0.097, 0.06, 1.46, 0.014, accent, false, true);
          }
        } else {
          part(0, 0.75, 0, 0.1, 1.5, 0.1, alloy, true);
          for (const x of [-0.28, 0.28]) {
            part(x, 1.58, 0, 0.12, 0.84, 0.16, frame);
            part(x, 1.58, 0.088, 0.035, 0.67, 0.016, accent, false, true);
          }
          for (const y of [1.21, 1.94]) part(0, y, 0, 0.44, 0.12, 0.16, frame);
        }
        break;
      case "bookshelf":
        part(0, 1.3, -0.26, 2.2, 2.6, 0.08, frame, true);
        for (const x of [-1.055, 1.055])
          part(x, 1.3, 0.04, 0.09, 2.6, 0.52, panel, true);
        for (let shelf = 0; shelf < 4; shelf++) {
          const y = 0.12 + shelf * 0.79;
          // Shelves meet the back panel and top trim without duplicating their faces.
          const shelfDepth = shelf === 3 ? 0.48 : 0.52;
          part(
            0,
            y,
            -0.22 + shelfDepth / 2,
            2.02,
            0.09,
            shelfDepth,
            panel,
            true,
          );
          if (shelf === 3) continue;
          if (variant === 1 && shelf === 1) {
            part(0, y + 0.37, 0.04, 1.94, 0.6, 0.44, fabric);
            part(0.62, y + 0.42, 0.268, 0.32, 0.05, 0.016, accent);
          } else if (variant === 2) {
            for (let cartridge = 0; cartridge < 4; cartridge++) {
              const x = -0.76 + cartridge * 0.5;
              part(x, y + 0.34, 0, 0.42, 0.53, 0.42, panel);
              part(x, y + 0.34, 0.224, 0.3, 0.4, 0.028, fabric);
              part(x, y + 0.45, 0.245, 0.2, 0.025, 0.014, accent);
            }
          } else
            for (let book = 0; book < 8; book++) {
              const bookSeed = hash(`${node.id}:${shelf}:${book}`);
              const h = 0.4 + (bookSeed % 4) * 0.065;
              const x = -0.88 + book * 0.25;
              part(
                x,
                y + 0.06 + h / 2,
                0.03,
                0.17,
                h,
                0.36,
                [fabric, alloy, "#5c797d"][bookSeed % 3],
              );
              part(x, y + 0.21, 0.217, 0.12, 0.035, 0.014, frame);
            }
        }
        part(0, 2.46, 0.28, 2.02, 0.2, 0.04, frame, true);
        break;
      case "wardrobe": {
        part(0, 1.35, -0.04, 1.8, 2.7, 0.72, frame, true);
        const door = (x: number, y: number, w: number, h: number) => {
          part(x, y, 0.35, w, h, 0.055, panel);
          part(
            x + w * 0.28,
            y,
            0.39,
            0.045,
            Math.min(h * 0.35, 0.35),
            0.02,
            alloy,
          );
          part(
            x - w * 0.2,
            y + h * 0.29,
            0.383,
            w * 0.22,
            0.035,
            0.012,
            accent,
          );
        };
        if (variant === 0)
          for (const x of [-0.44, 0.44]) door(x, 1.37, 0.82, 2.44);
        else if (variant === 1) {
          door(-0.3, 1.37, 1.1, 2.44);
          for (let bay = 0; bay < 3; bay++)
            door(0.59, 0.56 + bay * 0.8, 0.49, 0.71);
        } else
          for (let bay = 0; bay < 3; bay++) {
            door(0, 0.56 + bay * 0.8, 1.66, 0.71);
            for (let seam = 0; seam < 3; seam++)
              part(
                -0.12,
                0.39 + bay * 0.8 + seam * 0.1,
                0.383,
                1.07,
                0.014,
                0.008,
                frame,
              );
          }
        break;
      }
      case "painting":
        part(0, 0.8, -0.045, 2.4, 1.6, 0.03, frame, true);
        for (const side of [-1, 1])
          part(side * 1.15, 0.85, 0.015, 0.1, 1.3, 0.09, frame, true);
        part(0, 1.55, 0.015, 2.4, 0.1, 0.09, frame, true);
        part(0, 0.1, 0.015, 2.4, 0.2, 0.09, frame, true);
        part(0, 0.8, -0.014, 2.2, 1.4, 0.012, "#203640");
        part(-1.07, 0.8, 0.01, 0.025, 1.27, 0.01, accent, false, true);
        if (variant === 0) {
          part(0.59, 1.18, 0.023, 0.38, 0.32, 0.006, fabric);
          for (let tower = 0; tower < 7; tower++) {
            const h = 0.25 + (hash(`${node.id}:art:${tower}`) % 9) * 0.075;
            const x = -0.93 + tower * 0.31;
            part(x, 0.21 + h / 2, 0.032, 0.25, h, 0.008, "#4b747c");
            for (let level = 0.32; level < h + 0.08; level += 0.18)
              part(x, level, 0.046, 0.09, 0.025, 0.006, accent);
          }
        } else if (variant === 1) {
          for (let circuit = 0; circuit < 5; circuit++) {
            const x = -0.78 + circuit * 0.39;
            const y = 0.35 + (circuit % 3) * 0.32;
            part(x, 0.79, 0.022, 0.025, 0.95, 0.008, "#4b747c");
            part(x + 0.08, y, 0.032, 0.18, 0.028, 0.008, accent);
            part(x + 0.17, y, 0.043, 0.12, 0.12, 0.008, fabric);
          }
        } else
          for (let band = 0; band < 9; band++) {
            const barSeed = hash(`${node.id}:signal:${band}`);
            part(
              ((barSeed % 5) - 2) * 0.09,
              0.25 + band * 0.135,
              0.025,
              0.6 + (barSeed % 7) * 0.17,
              0.065,
              0.008,
              band % 3 ? accent : fabric,
            );
            part(0.87, 0.25 + band * 0.135, 0.036, 0.11, 0.025, 0.008, alloy);
          }
        break;
      case "terminal":
        part(0, 0.45, 0, 0.85, 0.9, 0.7, frame, true);
        part(0, 1.47, -0.13, 1.2, 1.26, 0.48, panel, true);
        screen(0, 1.53, 0.125, 1.02, 0.61);
        part(0, 0.96, 0.22, 1.16, 0.15, 0.35, panel, true);
        if (variant === 0) {
          part(0, 1.055, 0.24, 0.8, 0.04, 0.23, alloy);
          part(0, 1.98, 0.126, 0.84, 0.08, 0.032, fabric);
        } else if (variant === 1) {
          screen(0, 1.08, 0.18, 0.78, 0.25);
          for (const x of [-0.45, 0.45])
            part(x, 1.98, 0.13, 0.12, 0.08, 0.04, accent);
        } else {
          part(-0.38, 1.055, 0.24, 0.24, 0.04, 0.23, fabric);
          for (let key = 0; key < 3; key++)
            part(0.02 + key * 0.17, 1.065, 0.24, 0.1, 0.06, 0.1, alloy);
          part(0, 1.98, 0.13, 0.56, 0.045, 0.04, accent, false, true);
        }
        break;
      case "planter":
        part(0, 0.27, -0.025, 0.8, 0.54, 0.75, frame, true);
        part(0, 0.3, 0.36, 0.6, 0.3, 0.02, "#2c686a");
        part(-0.24, 0.3, 0.376, 0.04, 0.22, 0.012, accent);
        part(0, 0.57, 0, 0.86, 0.12, 0.86, panel);
        if (variant === 0) {
          part(0, 1.05, 0, 0.12, 0.95, 0.12, alloy);
          for (let tier = 0; tier < 3; tier++) {
            const x = tier % 2 ? 0.22 : -0.22;
            part(x, 0.87 + tier * 0.28, 0.03, 0.52, 0.17, 0.48, "#477d68");
          }
        } else if (variant === 1) {
          for (const x of [-0.43, 0.43])
            part(x, 1.07, -0.22, 0.1, 0.98, 0.1, alloy);
          part(0, 1.54, -0.04, 0.76, 0.12, 0.56, frame);
          part(0, 1.471, -0.04, 0.76, 0.014, 0.32, accent, false, true);
          for (const x of [-0.22, 0.22]) {
            part(x, 0.94, 0.03, 0.065, 0.68, 0.065, "#69816b");
            part(x, 1.15, 0.03, 0.35, 0.24, 0.4, "#477d68");
          }
        } else {
          part(0, 1.07, -0.28, 0.14, 0.95, 0.12, alloy);
          for (let tier = 0; tier < 2; tier++) {
            part(0, 0.9 + tier * 0.43, 0, 0.83, 0.1, 0.64, panel);
            for (const x of [-0.24, 0, 0.24])
              part(x, 1.04 + tier * 0.43, 0, 0.18, 0.2, 0.33, "#477d68");
          }
        }
        break;
      case "cabinet": {
        part(0, 0.6, -0.035, 1.4, 1.2, 0.73, frame, true);
        const drawer = (x: number, y: number, w: number, h: number) => {
          part(x, y, 0.36, w, h, 0.045, panel);
          part(x, y, 0.395, Math.min(0.25, w * 0.5), 0.035, 0.01, alloy);
          part(x - w * 0.3, y + h * 0.28, 0.387, 0.065, 0.025, 0.008, accent);
        };
        if (variant === 0)
          for (let bay = 0; bay < 3; bay++)
            drawer(0, 0.22 + bay * 0.36, 1.26, 0.27);
        else if (variant === 1)
          for (const x of [-0.33, 0.33]) drawer(x, 0.6, 0.6, 1.04);
        else {
          drawer(-0.33, 0.6, 0.6, 1.04);
          for (let bay = 0; bay < 3; bay++)
            drawer(0.33, 0.22 + bay * 0.36, 0.6, 0.27);
        }
        break;
      }
      case "workbench":
        legs(2.9, 1.2, 0.9);
        part(0, 0.96, 0, 3, 0.12, 1.3, panel, true);
        for (const x of [-1.35, 1.35])
          part(x, 1.34, -0.5, 0.15, 0.68, 0.18, alloy);
        part(0, 1.59, -0.49, 2.55, 0.22, 0.17, frame);
        if (variant === 0) {
          part(-0.36, 1.38, -0.38, 0.27, 0.4, 0.32, fabric);
          part(-0.36, 1.14, -0.35, 0.09, 0.16, 0.12, alloy);
          part(0, 1.035, 0.07, 1.92, 0.03, 0.74, frame);
          for (const x of [-0.8, 0.8])
            part(x, 1.057, 0.07, 0.025, 0.014, 0.64, accent);
        } else if (variant === 1) {
          for (const x of [-0.68, 0.68]) {
            part(x, 1.17, -0.3, 0.1, 0.29, 0.1, alloy);
            screen(x, 1.33, -0.24, 0.91, 0.35);
          }
          part(0, 1.055, 0.27, 1.82, 0.07, 0.31, frame);
        } else {
          part(0.15, 1.075, 0, 1.75, 0.11, 0.74, frame);
          for (const x of [-0.53, 0.83])
            part(x, 1.25, 0.02, 0.18, 0.35, 0.51, alloy);
          part(-1.03, 1.2, -0.02, 0.43, 0.36, 0.48, fabric);
          part(-1.03, 1.388, -0.02, 0.25, 0.016, 0.3, accent);
        }
        break;
    }
  if (cyclic) {
    const markerY = Math.min(size.height - 0.045, 0.37);
    part(
      size.width / 2 - 0.17,
      markerY,
      size.depth / 2 - 0.01,
      0.05,
      0.05,
      0.02,
      "#cb8aa5",
      false,
      true,
    );
  }
}
