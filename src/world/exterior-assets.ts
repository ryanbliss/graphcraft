import { hash } from "../graph/types.ts";
import { VoxelBatch } from "./geometry.ts";

type Category = "foliage" | "utility" | "civic" | "sculpture" | "lighting";
type Family =
  | "tree"
  | "shrub"
  | "reed"
  | "fungus"
  | "relay"
  | "cooler"
  | "battery"
  | "kiosk"
  | "bench"
  | "shelter"
  | "arch"
  | "sculpture"
  | "lamp";
export interface ExteriorAsset {
  id: string;
  name: string;
  category: Category;
  width: number;
  depth: number;
  height: number;
  family: Family;
  variant: number;
}
interface AssetFamily {
  family: Family;
  category: Category;
  width: number;
  depth: number;
  height: number;
  names: readonly string[];
}
const families: AssetFamily[] = [
  {
    family: "tree",
    category: "foliage",
    width: 4.8,
    depth: 4.8,
    height: 6.7,
    names: [
      "Neon umbrella tree",
      "Forked lantern tree",
      "Tiered cypress",
      "Weeping fiber tree",
    ],
  },
  {
    family: "shrub",
    category: "foliage",
    width: 3.8,
    depth: 3.8,
    height: 2.5,
    names: [
      "Coral hedge",
      "Prism succulent",
      "Split fern bed",
      "Spiral topiary",
    ],
  },
  {
    family: "reed",
    category: "foliage",
    width: 3.8,
    depth: 3.8,
    height: 4.8,
    names: [
      "Luminous reed bed",
      "Fan palm planter",
      "Crystal bamboo",
      "Antenna grass",
    ],
  },
  {
    family: "fungus",
    category: "foliage",
    width: 4.8,
    depth: 4.8,
    height: 4.7,
    names: [
      "Lantern mushroom",
      "Stepped shelf garden",
      "Twin glowcaps",
      "Spore canopy",
    ],
  },
  {
    family: "relay",
    category: "utility",
    width: 3.8,
    depth: 3.8,
    height: 6.8,
    names: [
      "Crossbar relay",
      "Twin mast repeater",
      "Panel antenna",
      "Ring receiver",
    ],
  },
  {
    family: "cooler",
    category: "utility",
    width: 4.8,
    depth: 3.8,
    height: 4.7,
    names: [
      "Twin condenser",
      "Fin radiator",
      "Exhaust stack",
      "Cooling manifold",
    ],
  },
  {
    family: "battery",
    category: "utility",
    width: 3.8,
    depth: 3.8,
    height: 4.7,
    names: [
      "Cell bank",
      "Transformer cage",
      "Charge pedestal",
      "Power cabinet",
    ],
  },
  {
    family: "kiosk",
    category: "civic",
    width: 3.8,
    depth: 3.8,
    height: 4.7,
    names: [
      "Map terminal",
      "Two sided directory",
      "Public console",
      "Beacon directory",
    ],
  },
  {
    family: "bench",
    category: "civic",
    width: 4.8,
    depth: 3.8,
    height: 3.3,
    names: [
      "Split seat bench",
      "Canopy perch",
      "Planter bench",
      "Courtyard corner seat",
    ],
  },
  {
    family: "shelter",
    category: "civic",
    width: 5.8,
    depth: 4.8,
    height: 5.2,
    names: [
      "Cantilever shelter",
      "Butterfly shelter",
      "Twin portal canopy",
      "Stepped awning",
    ],
  },
  {
    family: "arch",
    category: "sculpture",
    width: 5.8,
    depth: 3.8,
    height: 6.8,
    names: [
      "Offset portal",
      "Twin gate sculpture",
      "Broken halo",
      "Stacked gateway",
    ],
  },
  {
    family: "sculpture",
    category: "sculpture",
    width: 4.8,
    depth: 4.8,
    height: 6.8,
    names: [
      "Suspended prism",
      "Offset monolith",
      "Cross axis sculpture",
      "Stepped spiral",
    ],
  },
  {
    family: "lamp",
    category: "lighting",
    width: 4.8,
    depth: 3.8,
    height: 6.8,
    names: [
      "Crane streetlamp",
      "Twin arm lantern",
      "Stacked light column",
      "Frame lantern",
    ],
  },
];
export const exteriorAssets: readonly ExteriorAsset[] = families.flatMap(
  (family) =>
    family.names.map((name, variant) => ({
      ...family,
      id: `${family.family}-${variant}`,
      name,
      variant,
    })),
);
export function selectExteriorAsset(
  seed: string,
  category?: Category,
): ExteriorAsset {
  const candidates = category
    ? exteriorAssets.filter((asset) => asset.category === category)
    : exteriorAssets;
  return candidates[hash(seed) % candidates.length];
}
export interface ExteriorPlacement {
  x: number;
  z: number;
  y?: number;
  quarterTurns?: number;
  color?: string;
  owner?: string;
}
/** Footprints include every branch and overhang. Placement owns ground collision. */
export function buildExteriorAsset(
  asset: ExteriorAsset,
  blocks: VoxelBatch,
  lights: VoxelBatch,
  placement: ExteriorPlacement,
): void {
  const { x, z, y = 0, quarterTurns = 0, color = "#61c7c1", owner } = placement;
  const turn = ((quarterTurns % 4) + 4) % 4;
  const swap = turn % 2 === 1;
  const v = asset.variant;
  const metal = "#3c5264",
    pale = "#8a9aa5",
    dark = "#223342",
    leaf = "#315c69";
  const box = (
    dx: number,
    dy: number,
    dz: number,
    w: number,
    h: number,
    d: number,
    tint = metal,
    lit = false,
  ) => {
    let rx = dx,
      rz = dz;
    if (turn === 1) {
      rx = -dz;
      rz = dx;
    }
    if (turn === 2) {
      rx = -dx;
      rz = -dz;
    }
    if (turn === 3) {
      rx = dz;
      rz = -dx;
    }
    (lit ? lights : blocks).add(
      x + rx,
      y + dy,
      z + rz,
      swap ? d : w,
      h,
      swap ? w : d,
      tint,
      owner,
    );
  };
  const glow = (
    dx: number,
    dy: number,
    dz: number,
    w: number,
    h: number,
    d: number,
  ) => box(dx, dy, dz, w, h, d, color, true);
  const planter = () => {
    box(0, 0.3, 0, 3.2, 0.6, 3.2, metal);
    box(0, 0.65, 0, 2.8, 0.12, 2.8, dark);
    glow(0, 0.32, 1.64, 2.6, 0.16, 0.14);
  };
  const post = (px: number, pz: number, height: number) =>
    box(px, height / 2 + 0.35, pz, 0.32, height, 0.32, pale);
  switch (asset.family) {
    case "tree": {
      planter();
      box(0, 2.5, 0, 0.5, 3.7, 0.5, pale);
      if (v === 0) {
        box(0, 4.4, 0, 4.4, 0.6, 4.4, leaf);
        box(0, 4.95, 0, 3.1, 0.5, 3.1, leaf);
        glow(0, 4.06, 0, 4, 0.15, 4);
      } else if (v === 1) {
        for (const side of [-1, 1]) {
          box(side * 0.8, 3.7, 0, 1.8, 0.3, 0.3, pale);
          box(side * 1.4, 4.7 + side * 0.4, 0, 1.6, 1.8, 2.4, leaf);
          glow(side * 1.4, 3.7 + side * 0.4, 0, 1.3, 0.18, 2);
        }
      } else if (v === 2) {
        for (let tier = 0; tier < 4; tier++) {
          const span = 3.4 - tier * 0.7;
          box(0, 3 + tier * 0.85, 0, span, 0.7, span, leaf);
          glow(0, 2.59 + tier * 0.85, 0, span * 0.8, 0.16, span * 0.8);
        }
      } else {
        box(0, 5.2, 0, 4.1, 0.6, 3.9, leaf);
        for (let branch = 0; branch < 5; branch++) {
          const px = -1.6 + branch * 0.8;
          const drop = 1.3 + (branch % 3) * 0.5;
          for (const side of [-1, 1])
            glow(px, 4.8 - drop / 2, side * 1.7, 0.17, drop, 0.2);
        }
      }
      break;
    }
    case "shrub": {
      planter();
      if (v === 0) {
        for (let i = 0; i < 5; i++) {
          box(-1.2 + i * 0.6, 1.1 + (i % 2) * 0.2, 0, 0.45, 0.9, 1.4, leaf);
          glow(-1.2 + i * 0.6, 1.7 + (i % 2) * 0.2, 0, 0.5, 0.35, 1.5);
        }
      } else if (v === 1) {
        box(0, 1.25, 0, 1.3, 1.2, 1.3, leaf);
        for (const side of [-1, 1]) {
          box(side * 0.9, 1, 0, 0.5, 0.7, 1.7, leaf);
          glow(0, 1, side * 1, 0.45, 0.8, 0.4);
        }
        glow(0, 1.96, 0, 0.7, 0.22, 0.7);
      } else if (v === 2) {
        for (const side of [-1, 1]) {
          box(side * 0.6, 1.15, 0, 0.24, 1, 2.2, leaf);
          for (let i = 0; i < 3; i++)
            glow(
              side * (0.5 + i * 0.27),
              1.7 - i * 0.2,
              0,
              0.3,
              0.2,
              2 - i * 0.4,
            );
        }
      } else {
        for (let i = 0; i < 4; i++) {
          box(
            i % 2 === 0 ? -0.3 : 0.3,
            0.95 + i * 0.35,
            0,
            1.5 - i * 0.2,
            0.3,
            1.7 - i * 0.25,
            leaf,
          );
          glow(
            i % 2 === 0 ? -0.3 : 0.3,
            1.13 + i * 0.35,
            0,
            1.3 - i * 0.2,
            0.1,
            1.4 - i * 0.25,
          );
        }
      }
      break;
    }
    case "reed": {
      planter();
      const stalks = v === 1 ? 3 : 5;
      for (let i = 0; i < stalks; i++) {
        const px = (i - (stalks - 1) / 2) * 0.5;
        const height = 1.5 + ((i * 3 + v) % 5) * 0.45;
        const pz = i % 2 === 0 ? -0.45 : 0.45;
        box(px, 0.7 + height / 2, pz, 0.17, height, 0.17, pale);
        if (v === 0) glow(px, 0.7 + height, pz, 0.3, 0.65, 0.3);
        if (v === 1) {
          box(px, 0.75 + height, pz, 1.45, 0.2, 0.3, leaf);
          glow(px, 1 + height, pz, 0.85, 0.22, 0.22);
        }
        if (v === 2)
          for (let joint = 0; joint < 3; joint++)
            glow(px, 1 + joint * 0.65, pz, 0.3, 0.2, 0.3);
        if (v === 3) {
          box(px + 0.22, height + 0.45, pz, 0.6, 0.2, 0.2, leaf);
          glow(px + 0.45, height + 0.7, pz, 0.15, 0.45, 0.15);
        }
      }
      break;
    }
    case "fungus": {
      planter();
      const cap = (px: number, pz: number, height: number, span: number) => {
        box(px, 0.7 + height / 2, pz, 0.34, height, 0.34, pale);
        glow(px, height + 0.75, pz, span * 0.8, 0.17, span * 0.8);
        box(px, height + 1.05, pz, span, 0.42, span, leaf);
        box(px, height + 1.37, pz, span * 0.6, 0.22, span * 0.6, leaf);
      };
      if (v === 0) cap(0, 0, 2.5, 3.8);
      if (v === 1)
        for (let i = 0; i < 3; i++)
          cap(-0.65 + i * 0.5, -0.5 + i * 0.4, 0.8 + i * 0.7, 2);
      if (v === 2) {
        cap(-1, 0, 1.9, 2.2);
        cap(1, 0.6, 2.8, 2);
      }
      if (v === 3)
        for (const px of [-1, 1])
          for (const pz of [-1, 1]) cap(px, pz, 1.2 + (px + pz + 2) * 0.3, 1.7);
      break;
    }
    case "relay": {
      box(0, 0.35, 0, 2, 0.7, 2, dark);
      post(0, 0, 5.5);
      if (v === 0)
        for (let i = 0; i < 3; i++) {
          box(0, 3 + i, 0, 3.2 - i * 0.7, 0.25, 0.3, pale);
          glow(1.5 - i * 0.35, 3 + i, 0, 0.25, 0.45, 0.35);
        }
      if (v === 1)
        for (const side of [-1, 1]) {
          post(side * 0.9, 0, 4.4);
          glow(side * 0.9, 4.95, 0, 0.3, 0.6, 0.3);
          box(side * 0.45, 2.5, 0, 0.9, 0.25, 0.25, pale);
        }
      if (v === 2) {
        box(0, 4.4, 0, 2.2, 2.5, 0.6, metal);
        glow(0, 4.4, 0.38, 1.75, 1.95, 0.15);
      }
      if (v === 3)
        for (const side of [-1, 1]) {
          box(side * 1.1, 4.8, 0, 0.25, 2.1, 0.3, pale);
          glow(0, 4.8 + side, 0, 2.4, 0.2, 0.44);
        }
      break;
    }
    case "cooler": {
      box(0, 0.2, 0, 4.2, 0.4, 3, dark);
      if (v === 0)
        for (const side of [-1, 1]) {
          box(side * 1.1, 1.3, 0, 1.6, 1.8, 2.4, pale);
          box(side * 1.1, 2.35, 0, 1.3, 0.3, 1.3, dark);
          glow(side * 1.1, 1.2, 1.27, 0.8, 0.16, 0.16);
        }
      if (v === 1) {
        box(0, 1.4, 0, 3.8, 1.6, 1.6, metal);
        for (let i = 0; i < 6; i++)
          box(-1.65 + i * 0.65, 1.8, 0, 0.25, 2.5, 2.4, pale);
      }
      if (v === 2)
        for (const side of [-1, 1]) {
          const height = side < 0 ? 2.7 : 3.7;
          box(side * 0.9, height / 2 + 0.4, 0, 1, height, 1, metal);
          box(side * 0.9, height + 0.52, 0, 1.35, 0.24, 1.35, pale);
          glow(side * 0.9, height + 0.68, 0, 0.8, 0.08, 0.8);
        }
      if (v === 3) {
        box(0, 1.6, -0.6, 3.4, 2.4, 0.8, pale);
        for (let i = 0; i < 3; i++) {
          box(-1.1 + i * 1.1, 1.1, 0.4, 0.45, 1.5, 1.8, metal);
          glow(-1.1 + i * 1.1, 1.9, 0.4, 0.25, 0.14, 1.5);
        }
      }
      break;
    }
    case "battery": {
      box(0, 0.2, 0, 3.2, 0.4, 3, dark);
      if (v === 0)
        for (let i = 0; i < 3; i++) {
          box(-1 + i, 1.6, 0, 0.8, 2.5, 1.7, pale);
          glow(-1 + i, 2.1, 0.93, 0.5, 0.9, 0.14);
        }
      if (v === 1) {
        box(0, 1.4, 0, 1.6, 2, 1.6, metal);
        for (const px of [-1.2, 1.2])
          for (const pz of [-1.1, 1.1]) post(px, pz, 2.8);
        box(0, 3.25, 0, 2.8, 0.3, 2.6, pale);
        glow(0, 2.5, 0.85, 1.3, 0.2, 0.16);
      }
      if (v === 2) {
        box(0, 1.7, 0, 1, 2.8, 0.9, pale);
        box(0, 3.3, 0, 2.6, 0.45, 1.8, metal);
        for (const side of [-1, 1]) glow(side * 1.05, 2.7, 0, 0.3, 0.8, 0.3);
      }
      if (v === 3) {
        box(0, 1.9, 0, 2.8, 3, 1.5, metal);
        for (let i = 0; i < 4; i++)
          box(0, 0.9 + i * 0.65, 0.85, 2.3, 0.36, 0.2, pale);
        glow(1.1, 3.6, 0, 0.3, 0.2, 1);
      }
      break;
    }
    case "kiosk": {
      box(0, 0.25, 0, 2.6, 0.5, 2.4, dark);
      const screen = (
        px: number,
        py: number,
        pz: number,
        w: number,
        h: number,
      ) => {
        box(px, py, pz, w + 0.35, h + 0.35, 0.5, metal);
        glow(px, py, pz + 0.33, w, h, 0.14);
      };
      if (v === 0) {
        post(0, 0, 1.6);
        screen(0, 2.7, 0, 2.3, 1.7);
        box(0, 3.85, 0.2, 3, 0.3, 1.4, pale);
      }
      if (v === 1) {
        post(0, 0, 3.4);
        screen(-0.8, 2.7, -0.2, 1.2, 1.6);
        screen(0.8, 1.7, 0.2, 1.2, 1.6);
      }
      if (v === 2) {
        box(0, 1.1, 0, 2.2, 1.7, 1.3, metal);
        screen(0, 2.3, -0.35, 1.8, 1.1);
        box(0, 1.6, 0.85, 2.5, 0.3, 1.1, pale);
      }
      if (v === 3) {
        box(0, 2.1, 0, 0.8, 3.6, 0.8, pale);
        screen(0, 2.3, 0.3, 1.5, 2);
        glow(0, 4.25, 0, 1.6, 0.35, 1.6);
      }
      break;
    }
    case "bench": {
      for (const side of [-1, 1]) box(side * 1.4, 0.4, 0, 0.4, 0.8, 1.1, metal);
      box(0, 0.95, 0, 3.6, 0.3, 1.3, pale);
      glow(0, 0.66, 0.6, 3, 0.16, 0.18);
      if (v === 0) {
        for (const side of [-1, 1])
          box(side * 1, 1.5, -0.6, 1.3, 0.9, 0.25, metal);
      }
      if (v === 1) {
        post(-1.6, -0.75, 2.6);
        box(0, 3.05, 0, 4.2, 0.3, 2.4, metal);
      }
      if (v === 2) {
        box(1.6, 1.05, 0, 0.8, 1.5, 1.6, metal);
        box(1.6, 1.95, 0, 0.7, 0.4, 1.3, leaf);
        glow(1.6, 2.22, 0, 0.5, 0.15, 1);
      }
      if (v === 3) {
        box(-1.45, 0.95, 0.7, 0.7, 0.3, 2.2, pale);
        box(0, 1.57, -0.6, 3.6, 0.9, 0.25, metal);
        box(-1.85, 1.57, 0.65, 0.25, 0.9, 2.3, metal);
      }
      break;
    }
    case "shelter": {
      if (v === 0) {
        for (const px of [-1.9, 1.9]) post(px, -1.5, 4);
        box(0, 4.6, 0, 5.4, 0.5, 4.2, metal);
        glow(0, 4.26, 0.8, 4.6, 0.18, 0.4);
      }
      if (v === 1) {
        for (const pz of [-1.4, 1.4]) post(0, pz, 3.5);
        for (const side of [-1, 1]) {
          box(side * 1.3, 4.05, 0, 2.6, 0.45, 3.9, metal);
          box(side * 2.1, 4.45, 0, 1, 0.35, 3.9, pale);
          glow(side * 2.15, 3.8, 0, 0.5, 0.18, 3.5);
        }
      }
      if (v === 2) {
        for (const pz of [-1.6, 1.6]) {
          for (const px of [-2.2, 2.2]) post(px, pz, 3.8);
          box(0, 4.35, pz, 4.8, 0.5, 0.7, pale);
          glow(0, 4, pz, 4.2, 0.16, 0.3);
        }
        box(0, 4.72, 0, 3.8, 0.24, 3, metal);
      }
      if (v === 3) {
        for (const px of [-2, 2]) post(px, -1.3, 3.4);
        for (let tier = 0; tier < 3; tier++) {
          box(0, 4 + tier * 0.35, -1.2 + tier * 1.1, 4.8, 0.3, 1.3, metal);
          glow(0, 3.78 + tier * 0.35, -1 + tier * 1.1, 4, 0.14, 0.35);
        }
      }
      break;
    }
    case "arch": {
      if (v === 0) {
        box(-2, 2.9, 0, 0.65, 5.8, 0.8, pale);
        box(1.4, 2.3, 0, 0.65, 4.6, 0.8, metal);
        box(-0.3, 5.6, 0, 4.7, 0.6, 0.8, pale);
        glow(-0.3, 5.18, 0, 3.6, 0.2, 0.5);
      }
      if (v === 1)
        for (const side of [-1, 1]) {
          box(side * 1.8, 2.8, side * 0.6, 0.6, 5.6, 0.6, metal);
          box(side * 0.7, 5.8, side * 0.6, 2.8, 0.4, 0.6, pale);
          glow(side * 1.8, 3, side * 0.6 + 0.38, 0.25, 4, 0.15);
        }
      if (v === 2) {
        for (const side of [-1, 1]) {
          box(side * 2, 3.1, 0, 0.6, 4.4, 0.6, pale);
          glow(side * 1.35, side < 0 ? 5.65 : 0.65, 0, 1.9, 0.5, 0.6);
        }
      }
      if (v === 3)
        for (let tier = 0; tier < 3; tier++) {
          const span = 4.8 - tier * 1.1;
          box(0, 2.2 + tier * 1.7, 0, span, 0.4, 0.8, pale);
          for (const side of [-1, 1])
            box(
              side * (span / 2 - 0.25),
              1.3 + tier * 1.7,
              0,
              0.5,
              1.4,
              0.7,
              metal,
            );
          glow(0, 1.91 + tier * 1.7, 0, span - 1, 0.16, 0.4);
        }
      break;
    }
    case "sculpture": {
      box(0, 0.3, 0, 3.5, 0.6, 3.5, metal);
      if (v === 0) {
        for (const side of [-1, 1]) post(side * 1.6, 0, 5.4);
        box(0, 5.95, 0, 3.8, 0.4, 0.6, pale);
        box(0, 4.5, 0, 1.4, 2.3, 1.4, metal);
        glow(0, 3.22, 0, 1.7, 0.25, 1.7);
      }
      if (v === 1) {
        box(-0.5, 2.4, 0, 1.4, 3.7, 1.5, pale);
        box(0.6, 4.3, 0, 1.2, 3.6, 1.2, metal);
        glow(0.05, 3.5, 0.84, 0.2, 2.7, 0.2);
      }
      if (v === 2) {
        box(0, 3.2, 0, 0.6, 5.2, 0.6, pale);
        box(0, 4, 0, 4.2, 0.65, 0.8, metal);
        box(0, 2.8, 0, 0.8, 0.65, 4.2, metal);
        glow(0, 4.43, 0, 3.8, 0.18, 0.5);
        glow(0, 3.23, 0, 0.5, 0.18, 3.8);
      }
      if (v === 3)
        for (let tier = 0; tier < 6; tier++) {
          const dx = [0.8, 0, -0.8, 0][tier % 4];
          const dz = [0, 0.8, 0, -0.8][tier % 4];
          box(dx, 1.1 + tier * 0.8, dz, 1.5, 0.65, 1.5, pale);
          glow(dx, 1.5 + tier * 0.8, dz, 1.2, 0.14, 1.2);
        }
      break;
    }
    case "lamp": {
      box(0, 0.25, 0, 1.1, 0.5, 1.1, metal);
      post(0, 0, 5.5);
      if (v === 0) {
        box(0.8, 5.8, 0, 2.1, 0.3, 0.4, pale);
        glow(1.65, 5.45, 0, 0.7, 0.4, 0.7);
      }
      if (v === 1)
        for (const side of [-1, 1]) {
          box(side * 0.8, 5.3, 0, 1.6, 0.25, 0.3, pale);
          glow(side * 1.4, 4.65, 0, 0.55, 1, 0.55);
          box(side * 1.4, 5.35, 0, 0.85, 0.25, 0.85, metal);
        }
      if (v === 2)
        for (let tier = 0; tier < 4; tier++) {
          box(0, 2.3 + tier, 0, 1.4, 0.4, 1.4, metal);
          glow(0, 1.96 + tier, 0, 1.05, 0.2, 1.05);
        }
      if (v === 3) {
        for (const side of [-1, 1]) box(side * 0.8, 4.8, 0, 0.2, 2, 0.7, pale);
        box(0, 5.9, 0, 1.8, 0.25, 0.7, pale);
        glow(0, 4.8, 0, 0.6, 1.6, 0.5);
      }
      break;
    }
  }
}
