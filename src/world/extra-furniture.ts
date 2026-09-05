import type { FurniturePart } from "./cyber-furniture.ts";

export type ExtraFurnitureKind =
  | "drone"
  | "robot"
  | "aquarium"
  | "synth"
  | "dj"
  | "ramen"
  | "vending"
  | "hoverbike"
  | "med-pod"
  | "terrarium"
  | "computer-wall"
  | "trophy"
  | "robot-arm"
  | "shrine"
  | "telescope"
  | "satellite"
  | "portal"
  | "crystal";

export const extraFurnitureSize: Record<
  ExtraFurnitureKind,
  { width: number; depth: number; height: number; wall?: boolean }
> = {
  drone: { width: 2.4, depth: 2.4, height: 2.2 },
  robot: { width: 1.8, depth: 1.8, height: 2.6 },
  aquarium: { width: 3.2, depth: 1.8, height: 2.8 },
  synth: { width: 3, depth: 1.6, height: 2.4 },
  dj: { width: 3.2, depth: 1.8, height: 2.2 },
  ramen: { width: 3.2, depth: 2.4, height: 2.8 },
  vending: { width: 1.8, depth: 1.5, height: 2.8 },
  hoverbike: { width: 3.6, depth: 2, height: 2.2 },
  "med-pod": { width: 3.4, depth: 2.2, height: 2.6 },
  terrarium: { width: 2.2, depth: 1.8, height: 2.8 },
  "computer-wall": { width: 3.2, depth: 0.3, height: 1.9, wall: true },
  trophy: { width: 2.4, depth: 0.3, height: 1.8, wall: true },
  "robot-arm": { width: 2.2, depth: 2.2, height: 2.5 },
  shrine: { width: 2.4, depth: 2, height: 2.8 },
  telescope: { width: 2.8, depth: 2.2, height: 2.9 },
  satellite: { width: 2.4, depth: 2.4, height: 2.8 },
  portal: { width: 2.8, depth: 1.8, height: 3.2 },
  crystal: { width: 2.2, depth: 2.2, height: 2.8 },
};

export const extraPlaqueMounts: Record<
  ExtraFurnitureKind,
  { x: number; y: number; z: number; width: number; height: number }
> = {
  drone: { x: 0, y: 0.22, z: 1.2, width: 1.6, height: 0.22 },
  robot: { x: 0, y: 0.18, z: 0.9, width: 1.2, height: 0.2 },
  aquarium: { x: 0, y: 0.3, z: 0.9, width: 2.4, height: 0.24 },
  synth: { x: 0, y: 0.48, z: 0.8, width: 2.2, height: 0.24 },
  dj: { x: 0, y: 0.48, z: 0.9, width: 2.3, height: 0.24 },
  ramen: { x: 0, y: 0.58, z: 1.2, width: 2.3, height: 0.24 },
  vending: { x: 0, y: 0.3, z: 0.75, width: 1.2, height: 0.24 },
  hoverbike: { x: 0, y: 0.2, z: 1, width: 2.5, height: 0.22 },
  "med-pod": { x: 0, y: 0.3, z: 1.1, width: 2.4, height: 0.24 },
  terrarium: { x: 0, y: 0.25, z: 0.9, width: 1.5, height: 0.22 },
  "computer-wall": { x: 0, y: 0.18, z: 0.15, width: 2.4, height: 0.22 },
  trophy: { x: 0, y: 0.18, z: 0.15, width: 1.7, height: 0.22 },
  "robot-arm": { x: 0, y: 0.24, z: 1.1, width: 1.5, height: 0.22 },
  shrine: { x: 0, y: 0.22, z: 1, width: 1.6, height: 0.22 },
  telescope: { x: 0, y: 0.22, z: 1.1, width: 1.9, height: 0.22 },
  satellite: { x: 0, y: 0.22, z: 1.2, width: 1.6, height: 0.22 },
  portal: { x: 0, y: 0.22, z: 0.9, width: 1.9, height: 0.22 },
  crystal: { x: 0, y: 0.22, z: 1.1, width: 1.5, height: 0.22 },
};

export function isExtraFurniture(value: string): value is ExtraFurnitureKind {
  return Object.hasOwn(extraFurnitureSize, value);
}

export function furnishExtraArtifact(
  kind: ExtraFurnitureKind,
  part: FurniturePart,
  seed: number,
  variant: number,
): void {
  const hull = "#182d3b",
    metal = "#476674",
    porcelain = "#bdd0d0";
  const cyan = "#65eedd",
    pink = "#f57ac4",
    lime = "#c4eb79",
    amber = "#ffc67e";
  const accent = [cyan, pink, lime][seed % 3];
  const body = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color = hull,
  ) => part(x, y, z, w, h, d, color, true);
  const glow = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color = accent,
  ) => part(x, y, z, w, h, d, color, false, true);
  const rim = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    color = accent,
  ) => {
    for (const side of [-1, 1]) {
      glow(x + side * (w / 2 - 0.025), y, z, 0.05, 0.035, d, color);
      glow(x, y, z + side * (d / 2 - 0.025), w - 0.1, 0.035, 0.05, color);
    }
  };
  const screen = (x: number, y: number, z: number, w: number, h: number) => {
    body(x, y, z, w, h, 0.12);
    part(x, y, z + 0.075, w - 0.1, h - 0.1, 0.018, "#254953");
    for (let row = 0; row < 4; row++)
      glow(
        x - w * 0.07,
        y + h * (0.24 - row * 0.15),
        z + 0.096,
        w * (0.37 + ((row + seed) % 3) * 0.12),
        0.02,
        0.012,
        cyan,
      );
  };
  const plinth = (w: number, d: number, h = 0.34) => {
    body(0, h / 2, 0, w, h, d);
    rim(0, h + 0.035, 0, w - 0.2, d - 0.2, cyan);
  };
  const upright = (x: number, y: number, z: number, w: number, h: number) => {
    for (const side of [-1, 1]) {
      body(x + side * (w / 2 - 0.06), y, z, 0.12, h, 0.14, metal);
      body(x, y + side * (h / 2 - 0.06), z, w - 0.24, 0.12, 0.14, metal);
    }
  };
  const bowl = (x: number, y: number, z: number, w: number, color: string) => {
    body(x, y, z, w * 0.64, 0.18, w * 0.64, color);
    body(x, y + 0.15, z, w, 0.1, w, color);
    part(x, y + 0.21, z, w * 0.78, 0.018, w * 0.78, amber);
  };
  const rotor = (x: number, y: number, z: number, w: number) => {
    body(x, y, z, w, 0.09, w, metal);
    glow(x, y + 0.06, z, w - 0.12, 0.025, 0.055, cyan);
    glow(x, y + 0.085, z, 0.055, 0.018, w - 0.12, cyan);
  };
  const fish = (
    x: number,
    y: number,
    z: number,
    scale: number,
    color: string,
  ) => {
    glow(x, y, z, 0.45 * scale, 0.18 * scale, 0.16 * scale, color);
    glow(x - 0.3 * scale, y, z, 0.12 * scale, 0.3 * scale, 0.08 * scale, color);
    part(
      x + 0.15 * scale,
      y + 0.015 * scale,
      z + 0.093 * scale,
      0.04 * scale,
      0.045 * scale,
      0.02 * scale,
      hull,
    );
  };

  switch (kind) {
    case "drone": {
      plinth(2.3, 2.3);
      if (variant === 0) {
        body(0, 1.26, 0, 0.6, 0.3, 0.8, porcelain);
        for (const x of [-0.7, 0.7])
          for (const z of [-0.7, 0.7]) {
            body(x * 0.52, 1.21, z * 0.52, 0.16, 0.12, 0.5, metal);
            rotor(x, 1.36, z, 0.7);
          }
        glow(0, 1.2, 0.419, 0.24, 0.09, 0.038, pink);
      } else if (variant === 1) {
        body(0, 1.12, 0, 0.65, 0.35, 1.25, porcelain);
        for (const x of [-0.78, 0.78]) {
          body(x * 0.5, 1.08, 0, 0.4, 0.1, 0.16, metal);
          rotor(x, 1.24, 0, 0.72);
          glow(x, 1.08, 0, 0.4, 0.04, 0.4, cyan);
        }
        body(0, 1.43, -0.42, 0.16, 0.27, 0.3, metal);
      } else {
        body(0, 1.22, 0, 1.92, 0.16, 0.52, porcelain);
        body(0, 1.35, 0.03, 0.38, 0.3, 1.3, metal);
        for (const x of [-0.86, 0.86]) {
          body(x, 1.43, -0.1, 0.13, 0.26, 0.32, hull);
          glow(x, 1.225, 0.278, 0.15, 0.055, 0.035, pink);
        }
        glow(0, 1.34, -0.642, 0.2, 0.12, 0.02, cyan);
      }
      for (const x of [-0.24, 0.24]) glow(x, 0.7, 0, 0.025, 0.42, 0.025, cyan);
      break;
    }
    case "robot": {
      plinth(1.7, 1.7, 0.3);
      if (variant === 0) {
        for (const x of [-0.24, 0.24]) {
          body(x, 0.77, 0, 0.25, 0.56, 0.3, metal);
          body(x, 0.41, 0.15, 0.3, 0.16, 0.48, porcelain);
          body(x * 2.1, 1.37, 0, 0.16, 0.7, 0.18, porcelain);
        }
        body(0, 1.47, 0, 0.66, 0.74, 0.46, porcelain);
        body(0, 2.09, 0, 0.56, 0.38, 0.43, metal);
        glow(0, 2.1, 0.232, 0.36, 0.065, 0.032, lime);
      } else if (variant === 1) {
        body(0, 0.69, 0, 1.12, 0.47, 0.91, metal);
        for (const x of [-0.64, 0.64]) body(x, 0.54, 0, 0.19, 0.4, 0.7, hull);
        body(0, 1.12, 0, 0.15, 0.38, 0.15, porcelain);
        screen(0, 1.58, 0.03, 0.91, 0.7);
        body(0, 2.02, 0, 0.08, 0.17, 0.08, metal);
        glow(0, 2.15, 0, 0.15, 0.07, 0.15, pink);
      } else {
        body(0, 1.12, 0, 0.67, 0.4, 0.68, porcelain);
        for (const x of [-0.65, 0.65])
          for (const z of [-0.5, 0.5]) {
            body(x, 0.65, z, 0.14, 0.62, 0.16, metal);
            body(x * 0.7, 0.98, z, 0.48, 0.12, 0.13, porcelain);
          }
        body(0, 1.43, 0.14, 0.4, 0.22, 0.35, metal);
        for (const x of [-0.1, 0.1])
          glow(x, 1.45, 0.331, 0.1, 0.07, 0.024, amber);
      }
      break;
    }
    case "aquarium": {
      plinth(3.1, 1.7, 0.5);
      part(0, 0.55, 0, 2.86, 0.035, 1.42, "#235b6a");
      upright(0, 1.63, -0.73, 2.96, 2.1);
      rim(0, 2.7, 0, 2.95, 1.5, cyan);
      if (variant === 0) {
        for (const x of [-0.87, 0, 0.87]) {
          const y = x === 0 ? 2.04 : 1.61;
          glow(x, y, 0, 0.63, 0.12, 0.5, pink);
          glow(x, y + 0.12, 0, 0.41, 0.09, 0.34, cyan);
          for (const offset of [-0.19, 0, 0.19])
            for (let strand = 0; strand < 4; strand++)
              glow(
                x + offset,
                y - 0.17 - strand * 0.15,
                offset,
                0.025,
                0.09,
                0.025,
                pink,
              );
        }
      } else if (variant === 1) {
        for (let koi = 0; koi < 5; koi++)
          fish(
            -0.92 + koi * 0.45,
            1.06 + (koi % 3) * 0.4,
            (koi % 2) * 0.28,
            0.9,
            koi % 2 ? porcelain : amber,
          );
        for (const x of [-1.16, 1.16])
          glow(x, 0.99, -0.4, 0.06, 0.8, 0.06, lime);
      } else {
        for (const x of [-0.89, 0, 0.89]) {
          body(x, 1.05, -0.2, 0.14, 0.92, 0.15, "#39727b");
          for (let branch = 0; branch < 4; branch++)
            glow(
              x + (branch % 2 ? 0.18 : -0.18),
              0.86 + branch * 0.25,
              -0.1,
              0.25,
              0.13,
              0.3,
              pink,
            );
        }
        fish(0.47, 2.08, 0.28, 1.4, cyan);
        fish(-0.6, 1.87, 0.32, 0.8, amber);
      }
      break;
    }
    case "synth": {
      body(0, 0.45, -0.07, 2.8, 0.9, 1.24);
      const keyboard = (x: number, y: number, z: number, w: number) => {
        body(x, y, z, w, 0.14, 0.5, metal);
        for (let key = 0; key < 14; key++) {
          const dx = x - w * 0.43 + key * w * 0.066;
          part(dx, y + 0.083, z + 0.05, w * 0.052, 0.025, 0.31, porcelain);
          if (key % 3)
            part(
              dx + w * 0.026,
              y + 0.112,
              z - 0.02,
              w * 0.027,
              0.025,
              0.17,
              hull,
            );
        }
      };
      if (variant === 0) {
        keyboard(0, 1.05, 0.26, 2.8);
        screen(0.65, 1.51, -0.47, 1.03, 0.65);
        for (let knob = 0; knob < 5; knob++)
          glow(-1.08 + knob * 0.2, 1.19, -0.23, 0.1, 0.08, 0.1, pink);
      } else if (variant === 1) {
        keyboard(0, 1.04, 0.36, 2.74);
        keyboard(0, 1.51, -0.24, 2.36);
        for (const x of [-1.1, 1.1])
          body(x, 1.18, -0.35, 0.14, 0.52, 0.18, metal);
      } else {
        keyboard(0, 1.03, 0.3, 2.6);
        body(0, 1.69, -0.59, 2.72, 1.3, 0.16, metal);
        for (let column = 0; column < 6; column++)
          for (let row = 0; row < 4; row++)
            glow(
              -1.08 + column * 0.43,
              1.25 + row * 0.27,
              -0.493,
              0.12,
              0.09,
              0.036,
              row % 2 ? cyan : amber,
            );
      }
      break;
    }
    case "dj": {
      body(0, 0.48, 0, 3, 0.96, 1.6);
      body(0, 1.03, 0, 3.18, 0.14, 1.72, metal);
      if (variant === 0) {
        for (const x of [-0.92, 0.92]) {
          body(x, 1.15, 0.12, 0.89, 0.08, 0.89, hull);
          rim(x, 1.211, 0.12, 0.69, 0.69, pink);
          glow(x, 1.25, 0.12, 0.17, 0.035, 0.17, cyan);
        }
        for (let slider = 0; slider < 4; slider++)
          body(-0.22 + slider * 0.15, 1.17, 0.15, 0.07, 0.09, 0.5, porcelain);
      } else if (variant === 1) {
        for (let x = 0; x < 5; x++)
          for (let z = 0; z < 3; z++)
            glow(
              -0.85 + x * 0.42,
              1.16,
              -0.42 + z * 0.42,
              0.31,
              0.06,
              0.31,
              (x + z) % 2 ? cyan : pink,
            );
        screen(0, 1.62, -0.65, 1.72, 0.66);
      } else {
        for (const x of [-1.3, 1.3]) {
          body(x, 1.59, -0.52, 0.43, 0.94, 0.42, hull);
          for (let band = 0; band < 5; band++)
            glow(x, 1.29 + band * 0.16, -0.287, 0.27, 0.055, 0.026, lime);
        }
        screen(0, 1.54, -0.49, 1.55, 0.76);
        for (let pad = 0; pad < 6; pad++)
          glow(-0.8 + pad * 0.32, 1.17, 0.45, 0.2, 0.05, 0.2, pink);
      }
      break;
    }
    case "ramen": {
      body(0, 0.58, 0, 3, 1.16, 2.14);
      body(0, 1.24, 0, 3.18, 0.16, 2.3, metal);
      for (const x of [-1.34, 1.34])
        body(x, 2.06, -0.96, 0.13, 1.4, 0.16, metal);
      body(0, 2.58, -0.96, 2.5, 0.22, 0.2, "#672b4b");
      for (const x of [-0.78, 0, 0.78])
        glow(x, 2.58, -0.842, 0.29, 0.09, 0.03, amber);
      if (variant === 0) {
        for (const x of [-0.85, 0, 0.85]) {
          bowl(x, 1.43, 0.42, 0.61, porcelain);
          for (let steam = 0; steam < 3; steam++)
            glow(
              x + 0.045 * (steam % 2),
              1.84 + steam * 0.19,
              0.42,
              0.035,
              0.1,
              0.035,
              cyan,
            );
        }
      } else if (variant === 1) {
        body(-0.74, 1.58, -0.18, 1.06, 0.48, 0.89, porcelain);
        rim(-0.74, 1.85, -0.18, 0.88, 0.7, amber);
        for (let basket = 0; basket < 3; basket++)
          body(0.65, 1.46 + basket * 0.24, 0.2, 0.81, 0.17, 0.81, "#947756");
      } else {
        bowl(-0.64, 1.47, 0.08, 1.15, hull);
        body(-1.26, 1.57, 0.08, 0.3, 0.08, 0.11, metal);
        body(0.69, 1.43, 0.23, 0.83, 0.13, 0.66, porcelain);
        for (let roll = 0; roll < 4; roll++)
          part(0.43 + roll * 0.18, 1.55, 0.23, 0.12, 0.08, 0.32, amber);
      }
      break;
    }
    case "vending": {
      body(0, 1.35, -0.06, 1.72, 2.7, 1.22);
      body(0, 1.54, 0.578, 1.52, 1.94, 0.035, metal);
      if (variant === 0) {
        for (let row = 0; row < 4; row++)
          for (let col = 0; col < 3; col++) {
            const x = -0.49 + col * 0.48,
              y = 0.86 + row * 0.39;
            part(
              x,
              y,
              0.615,
              0.31,
              0.27,
              0.025,
              col % 2 ? "#76516f" : "#446a63",
            );
            glow(x, y + 0.065, 0.64, 0.18, 0.045, 0.015, amber);
          }
      } else if (variant === 1) {
        for (const x of [-0.45, 0, 0.45]) {
          part(x, 1.38, 0.62, 0.25, 1.16, 0.025, "#225763");
          for (let bottle = 0; bottle < 3; bottle++) {
            glow(
              x,
              0.96 + bottle * 0.36,
              0.653,
              0.15,
              0.23,
              0.026,
              [cyan, pink, lime][bottle],
            );
            part(
              x,
              1.11 + bottle * 0.36,
              0.653,
              0.055,
              0.035,
              0.025,
              porcelain,
            );
          }
        }
      } else {
        for (const x of [-0.43, 0.43]) {
          body(x, 1.71, 0.62, 0.62, 0.7, 0.05, "#345269");
          for (let capsule = 0; capsule < 6; capsule++)
            glow(
              x - 0.18 + (capsule % 3) * 0.18,
              1.53 + Math.floor(capsule / 3) * 0.27,
              0.667,
              0.11,
              0.13,
              0.025,
              capsule % 2 ? pink : lime,
            );
          body(x, 1.12, 0.65, 0.37, 0.09, 0.05, porcelain);
        }
      }
      body(0, 0.64, 0.662, 0.84, 0.17, 0.05, hull);
      glow(0, 2.48, 0.641, 1.25, 0.06, 0.026, pink);
      break;
    }
    case "hoverbike": {
      plinth(3.5, 1.9, 0.3);
      body(0, 0.76, 0, 2.47, 0.38, 0.65, metal);
      const saddle = variant === 1 ? 1.3 : 0.77;
      body(-0.22, 1.07, 0, saddle, 0.19, 0.57, "#6c3f61");
      if (variant === 0) {
        for (const x of [-1.24, 1.24]) {
          body(x, 0.64, 0, 0.54, 0.26, 1.36, porcelain);
          for (const z of [-0.47, 0.47])
            glow(x, 0.49, z, 0.37, 0.035, 0.3, cyan);
        }
        body(0.91, 1.29, 0, 0.12, 0.55, 0.16, metal);
        body(0.91, 1.6, 0, 0.16, 0.07, 0.97, porcelain);
      } else if (variant === 1) {
        for (const x of [-1.29, 1.29]) {
          body(x, 0.82, 0, 0.71, 0.36, 0.76, porcelain);
          body(x, 1.05, 0, 0.4, 0.08, 0.57, metal);
        }
        body(0.61, 1.31, 0, 0.26, 0.26, 0.68, hull);
        glow(1.67, 0.83, 0, 0.026, 0.1, 0.4, lime);
      } else {
        body(-1.1, 1.2, 0, 0.88, 0.46, 1.14, porcelain);
        for (const z of [-0.69, 0.69]) {
          body(0.61, 0.63, z, 1.76, 0.21, 0.23, hull);
          glow(1.45, 0.64, z, 0.05, 0.12, 0.17, pink);
        }
        body(0.93, 1.21, 0, 0.1, 0.5, 0.15, metal);
        body(0.93, 1.5, 0, 0.13, 0.07, 0.88, porcelain);
      }
      break;
    }
    case "med-pod": {
      plinth(3.3, 2.1, 0.43);
      body(0, 0.82, 0, 2.95, 0.22, 1.32, porcelain);
      body(0, 0.995, 0, 2.66, 0.12, 1.1, "#366c71");
      if (variant === 0) {
        for (const x of [-1.12, 1.12]) {
          upright(x, 1.57, -0.6, 0.51, 1.8);
          glow(x, 1.68, -0.512, 0.24, 1.4, 0.025, cyan);
        }
        body(0, 2.5, -0.6, 2.74, 0.12, 0.5, metal);
      } else if (variant === 1) {
        for (const x of [-1.09, 0, 1.09]) {
          for (const z of [-0.78, 0.78])
            body(x, 1.46, z, 0.12, 1.3, 0.12, metal);
          body(x, 2.15, 0, 0.12, 0.08, 1.68, porcelain);
          glow(x, 2.08, 0, 0.06, 0.025, 1.39, cyan);
        }
      } else {
        body(-1.24, 1.65, -0.71, 0.16, 1.55, 0.16, metal);
        body(-0.62, 2.47, -0.71, 1.39, 0.08, 0.18, porcelain);
        body(0, 2.19, -0.71, 0.22, 0.46, 0.3, metal);
        glow(0, 1.89, -0.71, 0.14, 0.12, 0.19, pink);
        screen(1.19, 1.63, -0.52, 0.6, 0.67);
      }
      break;
    }
    case "terrarium": {
      plinth(2.1, 1.7, 0.43);
      upright(0, 1.56, -0.69, 1.95, 2.12);
      rim(0, 2.65, 0, 1.94, 1.42, cyan);
      if (variant === 0) {
        for (const x of [-0.59, 0, 0.59]) {
          const height = x === 0 ? 1.65 : 1.12;
          body(x, 0.51 + height / 2, 0, 0.19, height, 0.2, "#42664c");
          glow(x, 0.51 + height / 2, 0.119, 0.035, height - 0.12, 0.018, lime);
          body(x + 0.18, 0.97, 0, 0.13, 0.38, 0.14, "#42664c");
        }
      } else if (variant === 1) {
        for (let mushroom = 0; mushroom < 5; mushroom++) {
          const x = -0.7 + mushroom * 0.35,
            z = (mushroom % 2) * 0.4 - 0.2;
          const y = mushroom % 2 ? 1.38 : 0.99;
          body(x, 0.51 + (y - 0.51) / 2, z, 0.075, y - 0.51, 0.075, porcelain);
          glow(x, y + 0.08, z, 0.43, 0.13, 0.41, mushroom % 2 ? pink : cyan);
        }
      } else {
        body(-0.18, 1.05, -0.14, 0.2, 1.06, 0.21, metal);
        for (let tier = 0; tier < 3; tier++) {
          const x = tier % 2 ? 0.22 : -0.2;
          body(
            x,
            1.15 + tier * 0.44,
            0,
            1.01 - tier * 0.17,
            0.1,
            0.55,
            "#48664d",
          );
          glow(x, 1.26 + tier * 0.44, 0, 0.87 - tier * 0.17, 0.09, 0.43, pink);
        }
      }
      break;
    }
    case "computer-wall": {
      body(0, 0.95, -0.12, 3.2, 1.9, 0.06);
      if (variant === 0) {
        for (const x of [-0.98, 0, 0.98]) screen(x, 1.13, -0.02, 0.89, 1.09);
      } else if (variant === 1) {
        screen(-0.43, 1.13, -0.02, 1.98, 1.22);
        for (let row = 0; row < 3; row++)
          screen(1.02, 0.71 + row * 0.42, -0.02, 0.64, 0.35);
      } else {
        for (let row = 0; row < 2; row++)
          for (let col = 0; col < 4; col++)
            screen(-1.12 + col * 0.75, 0.86 + row * 0.59, -0.02, 0.65, 0.5);
      }
      break;
    }
    case "trophy": {
      body(0, 0.9, -0.12, 2.4, 1.8, 0.06);
      if (variant === 0) {
        body(0, 0.53, 0.005, 0.76, 0.12, 0.11, metal);
        body(0, 0.78, 0.005, 0.12, 0.32, 0.1, amber);
        body(0, 1.14, 0.005, 0.69, 0.36, 0.11, amber);
        for (const x of [-0.46, 0.46]) {
          body(x, 1.21, 0.005, 0.14, 0.34, 0.08, metal);
          glow(x, 1.22, 0.058, 0.08, 0.19, 0.018, lime);
        }
      } else if (variant === 1) {
        body(0, 1.03, 0.005, 1.03, 0.71, 0.13, metal);
        body(0, 1.45, 0.005, 0.69, 0.1, 0.11, porcelain);
        glow(0, 1.13, 0.083, 0.77, 0.1, 0.018, cyan);
        for (const x of [-0.7, 0.7])
          body(x, 1.2, 0.005, 0.18, 0.49, 0.1, porcelain);
      } else {
        glow(0, 1.14, 0.014, 0.1, 0.93, 0.07, pink);
        body(0, 0.58, 0.014, 0.13, 0.16, 0.09, metal);
        body(0, 0.71, 0.014, 0.5, 0.06, 0.09, amber);
        for (let feather = 0; feather < 3; feather++)
          for (const side of [-1, 1])
            glow(
              side * (0.26 + feather * 0.23),
              1.36 - feather * 0.16,
              0.018,
              0.13,
              0.29,
              0.06,
              cyan,
            );
      }
      break;
    }
    case "robot-arm": {
      plinth(2.1, 2.1);
      if (variant === 0) {
        body(-0.58, 0.78, -0.2, 0.42, 0.75, 0.48, metal);
        body(-0.47, 1.53, -0.2, 0.26, 0.69, 0.28, porcelain);
        body(0.06, 1.94, -0.2, 1.17, 0.16, 0.25, metal);
        body(0.58, 1.66, -0.2, 0.17, 0.38, 0.2, porcelain);
        for (const x of [0.41, 0.75])
          body(x, 1.34, -0.2, 0.09, 0.22, 0.13, metal);
        glow(0.58, 1.2, -0.2, 0.12, 0.06, 0.12, pink);
      } else if (variant === 1) {
        for (const side of [-1, 1]) {
          body(side * 0.7, 1.06, -0.27, 0.22, 1.33, 0.3, porcelain);
          body(side * 0.47, 1.78, -0.27, 0.61, 0.11, 0.2, metal);
          glow(side * 0.19, 1.62, -0.27, 0.07, 0.17, 0.1, cyan);
        }
        body(0, 0.79, 0.15, 0.6, 0.68, 0.5, metal);
        glow(0, 1.17, 0.15, 0.3, 0.055, 0.3, pink);
      } else {
        body(0, 0.97, -0.36, 0.33, 1.16, 0.33, porcelain);
        body(0, 1.62, -0.01, 0.24, 0.11, 0.9, metal);
        body(0, 1.87, 0.37, 0.5, 0.31, 0.44, porcelain);
        for (const x of [-0.3, 0.3])
          body(x, 1.53, 0.37, 0.09, 0.31, 0.13, metal);
        glow(0, 1.24, 0.37, 0.1, 0.2, 0.1, lime);
      }
      break;
    }
    case "shrine": {
      plinth(2.3, 1.9);
      body(0, 0.57, 0.07, 1.52, 0.35, 1.2, metal);
      if (variant === 0) {
        for (const x of [-0.86, 0.86])
          body(x, 1.48, -0.46, 0.16, 2.13, 0.2, "#754257");
        body(0, 2.68, -0.46, 2.25, 0.15, 0.29, metal);
        body(0, 2.34, -0.46, 1.51, 0.11, 0.19, "#754257");
        glow(0, 1.32, 0.07, 0.25, 0.74, 0.25, amber);
      } else if (variant === 1) {
        for (const x of [-0.61, 0.61]) {
          body(x, 1.24, 0.07, 0.12, 0.94, 0.12, metal);
          glow(x, 1.92, 0.07, 0.49, 0.47, 0.42, amber);
          body(x, 2.22, 0.07, 0.59, 0.08, 0.52, hull);
        }
      } else {
        for (let roof = 0; roof < 4; roof++) {
          const width = 1.8 - roof * 0.33;
          body(0, 1.02 + roof * 0.42, -0.16, width, 0.11, width * 0.65, metal);
          glow(
            0,
            1.19 + roof * 0.42,
            -0.16,
            width * 0.52,
            0.19,
            width * 0.4,
            pink,
          );
        }
      }
      break;
    }
    case "telescope": {
      plinth(2.7, 2.1);
      body(0, 1.09, -0.03, 0.23, 1.4, 0.24, metal);
      if (variant === 0) {
        body(0, 1.92, -0.04, 2.21, 0.43, 0.55, porcelain);
        body(1.17, 1.92, -0.04, 0.13, 0.6, 0.72, metal);
        glow(1.253, 1.92, -0.04, 0.025, 0.42, 0.51, cyan);
        body(-1.2, 1.92, -0.04, 0.15, 0.2, 0.25, metal);
      } else if (variant === 1) {
        for (const x of [-0.57, 0.57]) {
          body(x, 2.07, -0.08, 0.63, 0.61, 1.3, porcelain);
          glow(x, 2.07, 0.596, 0.45, 0.42, 0.032, cyan);
        }
        body(0, 1.71, -0.08, 1.57, 0.08, 0.2, metal);
      } else {
        body(0, 1.79, -0.05, 0.55, 0.51, 0.57, metal);
        upright(0, 2.1, 0.33, 2.04, 1.35);
        for (let band = 0; band < 5; band++)
          glow(-0.74 + band * 0.37, 2.1, 0.426, 0.13, 0.95, 0.03, cyan);
      }
      break;
    }
    case "satellite": {
      plinth(2.3, 2.3);
      body(0, 0.81, 0, 0.12, 0.82, 0.12, metal);
      if (variant === 0) {
        body(0, 1.54, 0, 0.58, 0.67, 0.6, "#917552");
        for (const x of [-0.83, 0.83]) {
          body(x, 1.55, 0, 0.59, 0.1, 1.66, metal);
          for (let cell = 0; cell < 5; cell++)
            glow(x, 1.625, -0.63 + cell * 0.31, 0.46, 0.035, 0.2, cyan);
        }
        body(0, 2.16, 0, 0.08, 0.45, 0.08, porcelain);
      } else if (variant === 1) {
        body(0, 1.39, 0, 0.4, 0.45, 0.4, porcelain);
        for (let tier = 0; tier < 4; tier++)
          rim(
            0,
            1.7 + tier * 0.2,
            0,
            1.9 - tier * 0.42,
            1.9 - tier * 0.42,
            cyan,
          );
        glow(0, 2.45, 0, 0.07, 0.3, 0.07, pink);
      } else {
        body(0, 1.49, 0, 0.67, 0.62, 0.67, metal);
        for (const side of [-1, 1]) {
          glow(side * 0.7, 1.49, 0, 0.49, 0.47, 0.06, lime);
          glow(0, 1.49, side * 0.7, 0.06, 0.47, 0.49, pink);
        }
        body(0, 2.03, 0, 0.24, 0.34, 0.24, porcelain);
      }
      break;
    }
    case "portal": {
      plinth(2.7, 1.7, 0.34);
      if (variant === 0) {
        upright(0, 1.82, -0.1, 2.43, 2.72);
        for (let line = 0; line < 11; line++)
          glow(
            -0.97 + line * 0.194,
            1.82,
            -0.005,
            0.045,
            2.33,
            0.03,
            line % 2 ? pink : cyan,
          );
      } else if (variant === 1) {
        for (const x of [-1.08, 1.08]) {
          body(x, 1.75, -0.16, 0.38, 2.68, 0.5, metal);
          glow(x, 1.78, 0.108, 0.19, 2.29, 0.035, cyan);
        }
        for (let step = 0; step < 8; step++)
          glow(0, 0.65 + step * 0.32, 0, 1.63, 0.06, 0.04, pink);
      } else {
        for (const side of [-1, 1]) {
          body(side * 1.1, 1.75, 0, 0.18, 1.8, 0.24, metal);
          body(side * 0.91, 2.77, 0, 0.2, 0.19, 0.22, metal);
          body(side * 0.69, 2.98, 0, 0.21, 0.17, 0.2, metal);
        }
        body(0, 3.12, 0, 1.12, 0.1, 0.2, metal);
        for (let tier = 0; tier < 7; tier++)
          rim(0, 0.75 + tier * 0.32, 0, 1.5, 0.48, tier % 2 ? cyan : lime);
      }
      break;
    }
    case "crystal": {
      plinth(2.1, 2.1);
      const shard = (
        x: number,
        z: number,
        y: number,
        w: number,
        h: number,
        color: string,
      ) => {
        for (let tier = 0; tier < 4; tier++) {
          const width = w * (1 - tier * 0.19);
          glow(
            x,
            y + ((tier + 0.5) * h) / 4,
            z,
            width,
            h / 4 - 0.035,
            width * 0.76,
            color,
          );
        }
      };
      if (variant === 0) {
        shard(0, 0, 0.52, 0.97, 2.04, cyan);
        for (const x of [-0.79, 0.79]) shard(x, 0.12, 0.49, 0.3, 0.7, pink);
      } else if (variant === 1) {
        shard(-0.6, 0, 0.5, 0.63, 1.4, pink);
        shard(0.03, -0.36, 0.5, 0.57, 2.16, lime);
        shard(0.65, 0.29, 0.5, 0.6, 1.13, cyan);
      } else {
        for (let tier = 0; tier < 6; tier++) {
          const width = tier < 3 ? 0.34 + tier * 0.32 : 1.3 - (tier - 2) * 0.28;
          rim(0, 0.84 + tier * 0.31, 0, width, width, tier % 2 ? cyan : pink);
        }
        glow(0, 1.64, 0, 0.1, 1.3, 0.1, lime);
      }
      break;
    }
  }
  const mount = extraPlaqueMounts[kind];
  body(
    mount.x,
    mount.y,
    mount.z - 0.04,
    mount.width + 0.04,
    mount.height + 0.06,
    0.08,
  );
}
