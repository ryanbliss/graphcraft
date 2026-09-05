import * as THREE from "three";
import { VoxelBatch } from "./geometry.ts";

export function buildParachutist(): THREE.Group {
  const group = new THREE.Group();
  const suit = new VoxelBatch();
  const trim = new VoxelBatch(true);
  // Jacket and collar leave a visible neck between helmet and shoulders.
  suit.add(0, 0.04, 0, 0.76, 0.94, 0.46, "#27354b");
  suit.add(0, 0.54, 0, 0.47, 0.16, 0.4, "#152334");
  suit.add(0, 0.7, 0, 0.23, 0.18, 0.23, "#687b89");
  suit.add(0, 1.02, 0, 0.55, 0.49, 0.53, "#546c7b");
  suit.add(0, 1.08, 0.28, 0.46, 0.22, 0.055, "#0d223b");
  trim.add(0, 1.07, 0.315, 0.41, 0.075, 0.025, "#78dce5");
  suit.add(0, 0.85, 0.26, 0.37, 0.11, 0.1, "#1a2a3c");
  // Harness, back-mounted canopy pack and emergency beacon.
  suit.add(0, 0.07, -0.32, 0.52, 0.7, 0.23, "#536876");
  suit.add(0, 0.08, -0.46, 0.31, 0.46, 0.07, "#1d2f44");
  trim.add(0, 0.31, -0.505, 0.26, 0.08, 0.025, "#78ddce");
  suit.add(0, -0.34, 0, 0.8, 0.14, 0.5, "#111e30");
  suit.add(0, -0.33, 0.27, 0.19, 0.13, 0.08, "#b4a67b");
  for (const side of [-1, 1]) {
    suit.add(side * 0.24, 0.05, 0.25, 0.1, 0.8, 0.065, "#0e202c");
    suit.add(side * 0.24, 0.05, -0.48, 0.08, 0.65, 0.065, "#172634");
    suit.add(side * 0.49, 0.39, 0, 0.3, 0.22, 0.39, "#697d86");
    suit.add(side * 0.54, 0.14, 0.01, 0.25, 0.45, 0.28, "#2a4661");
    suit.add(side * 0.57, -0.04, 0.08, 0.25, 0.2, 0.3, "#142338");
    suit.add(side * 0.66, 0.24, 0.12, 0.22, 0.48, 0.24, "#425b70");
    suit.add(side * 0.7, 0.53, 0.14, 0.24, 0.22, 0.25, "#8c9c9b");
    suit.add(side * 0.72, 0.69, 0.14, 0.08, 0.25, 0.09, "#1b2935");
    trim.add(side * 0.65, 0.39, -0.012, 0.13, 0.07, 0.025, "#80d8de");
    suit.add(side * 0.21, -0.61, 0.01, 0.3, 0.46, 0.31, "#26354a");
    suit.add(side * 0.21, -0.78, 0.18, 0.24, 0.2, 0.1, "#617584");
    suit.add(side * 0.21, -0.95, 0, 0.26, 0.34, 0.28, "#1d2b40");
    suit.add(side * 0.21, -1.15, 0.08, 0.32, 0.18, 0.46, "#102033");
    trim.add(side * 0.21, -1.17, -0.16, 0.2, 0.045, 0.025, "#70cbbb");
  }
  suit.build(group);
  trim.build(group);
  return group;
}
