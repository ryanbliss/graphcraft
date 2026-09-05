export type CyberFurnitureKind =
  | "media"
  | "hologram"
  | "saber"
  | "arena"
  | "shower"
  | "bath"
  | "bar"
  | "neon-tree"
  | "neon-cat"
  | "arcade";

export const cyberFurnitureSize: Record<
  CyberFurnitureKind,
  { width: number; depth: number; height: number; wall?: boolean }
> = {
  media: { width: 4, depth: 2.4, height: 2.8 },
  hologram: { width: 2.4, depth: 2.4, height: 2.8 },
  saber: { width: 2.6, depth: 0.25, height: 1.9, wall: true },
  arena: { width: 6, depth: 6, height: 3.2 },
  shower: { width: 2.2, depth: 2.2, height: 3 },
  bath: { width: 3.4, depth: 2.4, height: 1.6 },
  bar: { width: 4, depth: 2.4, height: 2.9 },
  "neon-tree": { width: 2.6, depth: 2.6, height: 3 },
  "neon-cat": { width: 1.4, depth: 1.4, height: 1.8 },
  arcade: { width: 1.6, depth: 1.6, height: 2.7 },
};

export const cyberPlaqueMounts: Record<
  CyberFurnitureKind,
  { x: number; y: number; z: number; width: number; height: number }
> = {
  media: { x: 0, y: 0.42, z: 1.2, width: 2.3, height: 0.24 },
  hologram: { x: 0, y: 0.28, z: 1.2, width: 1.65, height: 0.22 },
  saber: { x: 0, y: 0.19, z: 0.125, width: 1.8, height: 0.22 },
  arena: { x: 0, y: 0.2, z: 3, width: 2.8, height: 0.24 },
  shower: { x: 0, y: 0.2, z: 1.1, width: 1.5, height: 0.22 },
  bath: { x: 0, y: 0.42, z: 1.2, width: 2.25, height: 0.24 },
  bar: { x: 0, y: 0.68, z: 1.2, width: 2.4, height: 0.26 },
  "neon-tree": { x: 0, y: 0.27, z: 1.3, width: 1.6, height: 0.22 },
  "neon-cat": { x: 0, y: 0.15, z: 0.7, width: 1.1, height: 0.18 },
  arcade: { x: 0, y: 0.42, z: 0.8, width: 1.15, height: 0.24 },
};

export function isCyberFurniture(value: string): value is CyberFurnitureKind {
  return Object.hasOwn(cyberFurnitureSize, value);
}

export type FurniturePart = (
  dx: number,
  y: number,
  dz: number,
  w: number,
  h: number,
  d: number,
  color: string,
  body?: boolean,
  glow?: boolean,
) => void;

export function furnishCyberArtifact(
  kind: CyberFurnitureKind,
  part: FurniturePart,
  seed: number,
  variant: number,
): void {
  const hull = "#162936";
  const metal = "#465c69";
  const ceramic = "#a4b9be";
  const cyan = "#56f3e1";
  const pink = "#f173d7";
  const lime = "#bded6c";
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
  const display = (x: number, y: number, z: number, w: number, h: number) => {
    body(x, y, z, w, h, 0.16);
    part(x, y, z + 0.095, w - 0.14, h - 0.14, 0.02, "#153c4a");
    if (kind === "media" || kind === "arcade") {
      const pixel = (
        dx: number,
        dy: number,
        pw: number,
        ph: number,
        color: string,
      ) => glow(x + dx * w, y + dy * h, z + 0.12, pw * w, ph * h, 0.012, color);
      if (variant === 0) {
        pixel(-0.35, -0.1, 0.025, 0.31, cyan);
        pixel(0.35, 0.1, 0.025, 0.31, pink);
        for (let dash = 0; dash < 7; dash++)
          pixel(0, -0.3 + dash * 0.1, 0.012, 0.04, ceramic);
        pixel(0.12, 0.16, 0.04, 0.07, lime);
      } else if (variant === 1) {
        const invader = ["0011100", "0111110", "1101011", "1111111", "1010101"];
        for (let row = 0; row < invader.length; row++)
          for (let column = 0; column < invader[row].length; column++)
            if (invader[row][column] === "1")
              pixel(
                (column - 3) * 0.095,
                0.28 - row * 0.09,
                0.074,
                0.065,
                lime,
              );
        pixel(0, -0.27, 0.2, 0.06, cyan);
        pixel(0, -0.205, 0.055, 0.04, cyan);
        pixel(0.22, -0.15, 0.015, 0.06, pink);
      } else {
        pixel(0, -0.34, 0.76, 0.045, cyan);
        pixel(0.19, 0.01, 0.27, 0.045, pink);
        pixel(-0.2, -0.08, 0.065, 0.08, lime);
        pixel(-0.2, -0.18, 0.075, 0.085, pink);
        for (const dx of [-0.225, -0.175])
          pixel(dx, -0.27, 0.025, 0.07, ceramic);
        for (const dx of [0.12, 0.28]) pixel(dx, 0.21, 0.045, 0.09, lime);
        pixel(-0.24, 0.29, 0.18, 0.045, ceramic);
      }
      return;
    }
    for (let row = 0; row < 5; row++) {
      const barWidth = (0.35 + ((seed + row) % 4) * 0.13) * w;
      glow(
        x - w * 0.08,
        y - h * 0.3 + row * h * 0.14,
        z + 0.12,
        barWidth,
        0.025,
        0.012,
      );
    }
  };
  const outline = (
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
  const figurine = (
    x: number,
    y: number,
    z: number,
    scale: number,
    pose: number,
    color: string,
  ) => {
    for (const side of [-1, 1]) {
      glow(
        x + side * 0.17 * scale,
        y + 0.3 * scale,
        z,
        0.18 * scale,
        0.6 * scale,
        0.23 * scale,
        color,
      );
      const armY = pose === 1 ? 1.13 : 0.84;
      const armX = pose === 2 ? 0.43 : 0.35;
      glow(
        x + side * armX * scale,
        y + armY * scale,
        z + 0.05 * scale,
        0.14 * scale,
        0.47 * scale,
        0.16 * scale,
        color,
      );
    }
    for (let band = 0; band < 3; band++)
      glow(
        x,
        y + (0.73 + band * 0.17) * scale,
        z,
        (0.52 - band * 0.045) * scale,
        0.13 * scale,
        0.29 * scale,
        color,
      );
    glow(
      x,
      y + 1.42 * scale,
      z,
      0.34 * scale,
      0.34 * scale,
      0.32 * scale,
      color,
    );
    part(
      x,
      y + 1.45 * scale,
      z + 0.173 * scale,
      0.24 * scale,
      0.055 * scale,
      0.02 * scale,
      hull,
    );
  };

  switch (kind) {
    case "media": {
      body(0, 0.35, 0.3, 3.7, 0.7, 1.6);
      body(0, 0.74, 0.3, 3.9, 0.08, 1.8, metal);
      for (const x of [-1.45, 1.45]) {
        body(x, 1.23, -0.25, 0.5, 0.9, 0.55, metal);
        for (const y of [1.03, 1.43])
          glow(x, y, 0.037, 0.27, 0.17, 0.025, cyan);
      }
      if (variant === 0) {
        body(0, 1.17, -0.69, 0.2, 0.78, 0.22, metal);
        display(0, 1.94, -0.56, 2.3, 1.45);
      } else if (variant === 1) {
        for (const side of [-1, 1]) {
          body(side * 0.66, 1.04, -0.67, 0.13, 0.52, 0.18, metal);
          display(side * 0.66, 1.83, -0.55, 1.2, 1.78);
        }
      } else {
        display(0, 2.08, -0.66, 3.4, 1.08);
        body(0, 1.22, -0.75, 0.25, 0.75, 0.22, metal);
        display(0, 1.15, 0.03, 1.48, 0.53);
      }
      body(-0.6, 0.84, 0.73, 0.94, 0.12, 0.42, ceramic);
      for (const x of [-0.87, -0.32]) glow(x, 0.91, 0.75, 0.08, 0.02, 0.16);
      body(0.74, 0.84, 0.69, 0.66, 0.12, 0.4, metal);
      break;
    }
    case "hologram": {
      body(0, 0.22, 0, 2.3, 0.44, 2.3);
      body(0, 0.5, 0, 1.8, 0.12, 1.8, metal);
      outline(0, 0.59, 0, 1.55, 1.55, cyan);
      if (variant === 0) figurine(0, 0.68, 0, 1.27, 1, accent);
      else if (variant === 1) {
        for (let level = 0; level < 6; level++) {
          const width = level < 3 ? 0.5 + level * 0.34 : 2.02 - level * 0.22;
          outline(
            0,
            0.83 + level * 0.31,
            0,
            width,
            width,
            level % 2 ? pink : cyan,
          );
        }
        glow(0, 1.54, 0, 0.08, 1.6, 0.08, lime);
      } else {
        for (const x of [-0.62, 0, 0.62]) {
          const height = x === 0 ? 1.8 : 1.16;
          for (let level = 0.12; level < height; level += 0.23)
            glow(x, 0.7 + level, 0, 0.4, 0.13, 0.55, x === 0 ? pink : cyan);
        }
      }
      break;
    }
    case "saber": {
      body(0, 0.95, -0.09, 2.6, 1.9, 0.07);
      for (const side of [-1, 1])
        glow(side * 1.21, 1.1, -0.041, 0.025, 1.45, 0.02, cyan);
      if (variant === 0) {
        for (const x of [-0.48, 0.48]) {
          body(x, 0.66, 0.015, 0.13, 0.38, 0.1, metal);
          body(x, 0.88, 0.02, 0.32, 0.05, 0.08, ceramic);
          glow(x, 1.32, 0.02, 0.065, 0.8, 0.06, x < 0 ? cyan : pink);
        }
      } else if (variant === 1) {
        body(-0.78, 1.04, 0.015, 0.42, 0.13, 0.1, metal);
        body(-0.53, 1.04, 0.02, 0.06, 0.35, 0.08, ceramic);
        glow(0.27, 1.04, 0.02, 1.48, 0.065, 0.06, lime);
        glow(0.88, 1.13, 0.02, 0.22, 0.075, 0.06, lime);
      } else {
        for (let blade = 0; blade < 3; blade++) {
          const y = 0.64 + blade * 0.43;
          body(-0.78, y, 0.015, 0.34, 0.1, 0.1, metal);
          glow(0.19, y, 0.02, 1.44, 0.045, 0.05, [pink, cyan, lime][blade]);
        }
      }
      break;
    }
    case "arena": {
      body(0, 0.18, 0, 5.9, 0.36, 5.9);
      outline(0, 0.39, 0, 5.55, 5.55, cyan);
      outline(0, 0.39, 0, 3.9, 3.9, pink);
      for (const x of [-2.55, 2.55])
        for (const z of [-2.55, 2.55]) {
          body(x, 0.91, z, 0.28, 1.1, 0.28, metal);
          glow(x, 1.51, z, 0.19, 0.08, 0.19, cyan);
        }
      if (variant === 0) {
        figurine(-1.05, 0.48, 0, 1.55, 1, cyan);
        figurine(1.05, 0.48, 0, 1.55, 2, pink);
      } else if (variant === 1) {
        figurine(-1.35, 0.48, 0.65, 1.5, 0, cyan);
        for (let level = 0; level < 5; level++)
          outline(1.25, 0.75 + level * 0.44, -0.65, 1.2, 1.2, pink);
        glow(1.25, 1.62, -0.65, 0.12, 2.1, 0.12, lime);
      } else {
        for (const x of [-1.7, 1.7]) {
          body(x, 1.69, -0.9, 0.18, 2.6, 0.3, metal);
          glow(x, 1.8, -0.733, 0.06, 2.15, 0.025, pink);
        }
        for (const y of [0.84, 1.5, 2.16, 2.82])
          glow(0, y, -0.9, 3.12, 0.035, 0.04, y < 2 ? cyan : pink);
        figurine(0, 0.48, 1.2, 1.36, 1, lime);
      }
      break;
    }
    case "shower": {
      body(0, 0.16, 0, 2.16, 0.32, 2.16, metal);
      outline(0, 0.35, 0, 1.9, 1.9, cyan);
      body(0, 1.64, -0.94, 1.86, 2.6, 0.16);
      display(-0.49, 1.63, -0.79, 0.5, 0.65);
      if (variant === 0) {
        body(0.23, 2.62, -0.17, 1.15, 0.16, 1.5, metal);
        for (const x of [-0.12, 0.23, 0.58])
          for (const z of [-0.47, -0.03, 0.41])
            for (let drop = 0; drop < 6; drop++)
              glow(x, 0.65 + drop * 0.3, z, 0.017, 0.15, 0.017, cyan);
      } else if (variant === 1) {
        for (const x of [-0.86, 0.86]) {
          body(x, 1.64, -0.02, 0.16, 2.6, 1.63, metal);
          for (const y of [0.7, 1.17, 1.64, 2.11, 2.58])
            glow(x * 0.85, y, 0, 0.018, 0.1, 1.2, cyan);
        }
      } else {
        body(0.68, 1.4, -0.77, 0.18, 1.9, 0.14, ceramic);
        for (let jet = 0; jet < 5; jet++) {
          glow(0.68, 0.7 + jet * 0.36, -0.64, 0.09, 0.07, 0.05, pink);
          glow(0.68, 0.7 + jet * 0.36, -0.25, 0.025, 0.025, 0.53, cyan);
        }
        body(-0.2, 0.75, -0.35, 1.15, 0.12, 0.7, ceramic);
        body(-0.2, 0.54, -0.57, 0.55, 0.28, 0.2, metal);
      }
      break;
    }
    case "bath": {
      body(0, 0.22, 0, 3.15, 0.44, 2.15);
      for (const side of [-1, 1]) {
        body(side * 1.56, 0.63, 0, 0.2, 0.7, 2.3, ceramic);
        body(0, 0.63, side * 1.05, 2.92, 0.7, 0.2, metal);
      }
      part(0, 0.61, 0, 2.88, 0.05, 1.86, "#18737f");
      outline(0, 0.66, 0, 2.64, 1.62, cyan);
      if (variant === 0) {
        body(-0.92, 1.1, -0.81, 0.92, 0.38, 0.42, hull);
        body(1.3, 1.1, -0.38, 0.15, 0.42, 0.16, metal);
        body(1.12, 1.35, -0.38, 0.51, 0.06, 0.16, ceramic);
      } else if (variant === 1) {
        for (const x of [-0.8, 0.8]) {
          body(x, 1.18, -0.86, 0.64, 0.54, 0.3, hull);
          glow(x, 1.24, -0.697, 0.42, 0.07, 0.026, pink);
        }
      } else {
        body(0, 1.22, -1.07, 2.88, 0.65, 0.18, hull);
        display(0, 1.27, -0.86, 1.34, 0.42);
        for (const x of [-1.17, 1.17])
          glow(x, 1.29, -0.96, 0.08, 0.42, 0.025, lime);
      }
      break;
    }
    case "bar": {
      body(0, 0.58, 0.42, 3.72, 1.16, 1.35);
      body(0, 1.23, 0.4, 4, 0.14, 1.5, metal);
      glow(0, 1.32, 0.97, 3.7, 0.025, 0.055, pink);
      body(0, 1.48, -1.03, 3.8, 2.7, 0.16);
      const shelves = variant === 1 ? 3 : 2;
      for (let row = 0; row < shelves; row++) {
        const y = 1.43 + row * 0.43;
        body(0, y, -0.66, 3.56, 0.08, 0.5, metal);
        for (let bottle = 0; bottle < 6; bottle++) {
          const x = -1.38 + bottle * 0.55;
          part(
            x,
            y + 0.17,
            -0.64,
            0.15,
            0.25,
            0.14,
            bottle % 2 ? "#395c72" : "#526242",
          );
          glow(
            x,
            y + 0.19,
            -0.557,
            0.1,
            0.04,
            0.018,
            [cyan, pink, lime][bottle % 3],
          );
          part(x, y + 0.32, -0.64, 0.06, 0.05, 0.07, ceramic);
        }
      }
      if (variant === 0) {
        for (const x of [-1.08, 1.08]) {
          body(x, 1.54, 0.14, 0.12, 0.48, 0.12, ceramic);
          body(x + 0.13, 1.81, 0.14, 0.38, 0.06, 0.12, metal);
        }
      } else if (variant === 1) display(0, 2.62, -0.79, 2.1, 0.45);
      else {
        body(-1.02, 1.63, 0.04, 0.86, 0.66, 0.62, ceramic);
        display(-1.02, 1.68, 0.37, 0.6, 0.38);
        for (const x of [0.3, 0.85, 1.4])
          outline(x, 1.35, 0.57, 0.34, 0.34, cyan);
      }
      break;
    }
    case "neon-tree": {
      body(0, 0.24, 0, 2.25, 0.48, 2.25);
      outline(0, 0.51, 0, 2.04, 2.04, cyan);
      if (variant === 0) {
        body(-0.18, 1.22, -0.12, 0.26, 1.4, 0.25, metal);
        for (let tier = 0; tier < 3; tier++) {
          const x = tier % 2 ? 0.32 : -0.3;
          const y = 1.52 + tier * 0.47;
          body(x, y, 0, 1.62 - tier * 0.14, 0.12, 0.68, metal);
          for (let leaf = 0; leaf < 5; leaf++)
            glow(
              x - 0.62 + leaf * 0.31,
              y + 0.17,
              (leaf % 2) * 0.18,
              0.25,
              0.17,
              0.46,
              leaf % 2 ? pink : cyan,
            );
        }
      } else if (variant === 1) {
        for (const x of [-0.73, 0, 0.73]) {
          const height = x === 0 ? 2.25 : 1.68;
          body(x, 0.52 + height / 2, -0.1, 0.14, height, 0.14, "#37635d");
          for (let node = 0.34; node < height; node += 0.43) {
            glow(x, 0.52 + node, -0.1, 0.18, 0.055, 0.18, lime);
            glow(x + 0.18, 0.64 + node, 0.03, 0.3, 0.07, 0.22, cyan);
          }
        }
      } else {
        body(0, 1.23, 0, 0.2, 1.42, 0.2, metal);
        for (let tier = 0; tier < 4; tier++) {
          const spread = 2.18 - tier * 0.43;
          outline(
            0,
            1.32 + tier * 0.42,
            0,
            spread,
            spread,
            tier % 2 ? cyan : pink,
          );
        }
        glow(0, 2.81, 0, 0.16, 0.22, 0.16, lime);
      }
      break;
    }
    case "neon-cat": {
      body(0, 0.11, 0, 1.34, 0.22, 1.3);
      let headX = 0,
        headY = 1.15,
        headZ = 0.25;
      if (variant === 0) {
        body(0, 0.62, -0.14, 0.63, 0.8, 0.68, ceramic);
        for (const x of [-0.22, 0.22])
          body(x, 0.34, 0.37, 0.21, 0.24, 0.43, metal);
        body(-0.49, 0.65, -0.37, 0.15, 0.86, 0.16, metal);
        glow(-0.49, 1.11, -0.37, 0.13, 0.06, 0.14, pink);
      } else if (variant === 1) {
        headX = 0.22;
        headY = 0.87;
        headZ = 0.27;
        body(-0.1, 0.54, -0.05, 0.88, 0.47, 0.87, ceramic);
        body(-0.5, 1.01, -0.43, 0.14, 1.26, 0.14, metal);
        glow(-0.5, 1.7, -0.43, 0.11, 0.1, 0.11, cyan);
        for (const x of [-0.42, 0.27])
          body(x, 0.3, 0.29, 0.19, 0.16, 0.38, metal);
      } else {
        headX = 0.26;
        headY = 0.68;
        headZ = 0.3;
        body(-0.07, 0.42, -0.06, 0.97, 0.38, 0.92, ceramic);
        body(-0.52, 0.51, 0.12, 0.12, 0.34, 0.75, metal);
        body(-0.23, 0.55, 0.48, 0.44, 0.14, 0.12, metal);
        glow(-0.16, 0.635, 0.48, 0.24, 0.025, 0.08, pink);
      }
      body(headX, headY, headZ, 0.55, 0.44, 0.45, metal);
      for (const side of [-1, 1]) {
        body(
          headX + side * 0.18,
          headY + 0.32,
          headZ - 0.03,
          0.16,
          0.18,
          0.27,
          ceramic,
        );
        glow(
          headX + side * 0.18,
          headY + 0.33,
          headZ + 0.119,
          0.08,
          0.09,
          0.026,
          pink,
        );
        glow(
          headX + side * 0.13,
          headY + 0.05,
          headZ + 0.239,
          0.085,
          0.075,
          0.028,
          lime,
        );
      }
      glow(headX, headY - 0.05, headZ + 0.247, 0.055, 0.035, 0.012, pink);
      break;
    }
    case "arcade": {
      body(0, 0.48, -0.05, 1.48, 0.96, 1.36);
      body(0, 1.24, -0.57, 1.34, 0.54, 0.3, metal);
      if (variant === 0) {
        display(0, 1.81, -0.25, 1.28, 1.05);
        body(0, 2.48, -0.25, 1.52, 0.25, 0.8, metal);
        glow(0, 2.49, 0.167, 1.16, 0.11, 0.035, pink);
      } else if (variant === 1) {
        display(0, 1.63, -0.19, 1.34, 0.64);
        display(0, 2.28, -0.28, 1.06, 0.52);
        for (const x of [-0.7, 0.7])
          glow(x, 1.81, -0.05, 0.05, 1.2, 0.07, cyan);
      } else {
        display(0, 1.92, -0.23, 1.04, 1.45);
        for (const x of [-0.69, 0.69]) {
          body(x, 1.81, -0.32, 0.15, 1.58, 0.5, metal);
          glow(x, 1.83, -0.053, 0.055, 1.24, 0.034, lime);
        }
      }
      body(0, 1.09, 0.35, 1.5, 0.15, 0.7, metal);
      body(-0.36, 1.27, 0.42, 0.09, 0.2, 0.09, ceramic);
      glow(-0.36, 1.39, 0.42, 0.14, 0.05, 0.14, pink);
      for (let button = 0; button < 3; button++)
        glow(
          0.04 + button * 0.18,
          1.185,
          0.42,
          0.1,
          0.03,
          0.1,
          [pink, cyan, lime][button],
        );
      break;
    }
  }

  const mount = cyberPlaqueMounts[kind];
  body(
    mount.x,
    mount.y,
    mount.z - 0.04,
    mount.width + 0.04,
    mount.height + 0.07,
    0.08,
  );
}
