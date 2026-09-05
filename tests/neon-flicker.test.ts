import { expect, it } from "vitest";
import * as THREE from "three";
import {
  VoxelBatch,
  disposeGroup,
  lineGeometry,
} from "../src/world/geometry.ts";
import {
  installNeonFlicker,
  neonFlickerAt,
  updateNeonFlicker,
  withNeonFlicker,
} from "../src/world/neon-flicker.ts";

it("keeps slow circuit sequences occasional, asynchronous, and above blackout brightness", () => {
  let affected = 0;
  let samples = 0;
  let peakConcurrent = 0;
  let minimum = 1;
  let maximum = 0;
  let maximumFrameChange = 0;
  const previous = Array.from({ length: 64 }, (_, circuit) =>
    neonFlickerAt(0, circuit),
  );
  for (let seconds = 0; seconds < 180; seconds += 0.02) {
    let concurrent = 0;
    for (let circuit = 0; circuit < 64; circuit++) {
      const brightness = neonFlickerAt(seconds, circuit);
      minimum = Math.min(minimum, brightness);
      maximum = Math.max(maximum, brightness);
      maximumFrameChange = Math.max(
        maximumFrameChange,
        Math.abs(brightness - previous[circuit]),
      );
      previous[circuit] = brightness;
      if (brightness < 0.999) {
        affected++;
        concurrent++;
      }
      samples++;
    }
    peakConcurrent = Math.max(peakConcurrent, concurrent);
  }
  expect(affected / samples).toBeGreaterThan(0.04);
  expect(minimum).toBeGreaterThanOrEqual(0.68);
  expect(maximum).toBe(1);
  expect(affected / samples).toBeLessThan(0.12);
  expect(peakConcurrent).toBeLessThan(16);
  expect(maximumFrameChange).toBeLessThan(0.012);
  expect(neonFlickerAt(46.1, 0)).toBeCloseTo(0.88);
  expect(neonFlickerAt(46.8, 0)).toBeCloseTo(0.96);
  expect(neonFlickerAt(47.9, 0)).toBeCloseTo(0.68);
  expect(neonFlickerAt(48.7, 0)).toBeCloseTo(0.9);
  expect(neonFlickerAt(49.8, 0)).toBe(1);
  expect(neonFlickerAt(47.9, 1)).toBe(1);
});

it("eases continuously through pulse turns, recovery, and the next sequence boundary", () => {
  const step = 0.0001;
  for (const seconds of [45, 46.1, 46.8, 47.9, 48.7, 49.8, 90]) {
    const center = neonFlickerAt(seconds, 0);
    const before = neonFlickerAt(seconds - step, 0);
    const after = neonFlickerAt(seconds + step, 0);
    expect(Math.abs(center - before) / step).toBeLessThan(0.001);
    expect(Math.abs(after - center) / step).toBeLessThan(0.001);
  }
  for (const seconds of [50, 60, 75, 89.9])
    expect(neonFlickerAt(seconds, 0)).toBe(1);
});

it("uses stable spatial circuits for glow instances without changing solid materials", () => {
  const root = new THREE.Group();
  const lights = new VoxelBatch(true);
  const solid = new VoxelBatch();
  for (const x of [0, 1, 8, 16])
    lights.add(x, 1, 0, 1, 1, 1, "#ff55cc", "building");
  const mesh = lights.build(root);
  const repeated = lights.build(root);
  const circuit = mesh.geometry.getAttribute("neonCircuit");
  expect(circuit).toBeInstanceOf(THREE.InstancedBufferAttribute);
  expect(circuit.array).toEqual(
    repeated.geometry.getAttribute("neonCircuit").array,
  );
  expect(circuit.getX(0)).toBe(circuit.getX(1));
  expect(new Set(circuit.array).size).toBeGreaterThan(1);
  expect(
    solid.build(root).geometry.getAttribute("neonCircuit"),
  ).toBeUndefined();
  const lines = lineGeometry(
    [0, 0, 0, 1, 0, 0, 10, 0, 0, 11, 0, 0],
    "#ffffff",
    1,
  );
  root.add(lines);
  const lineCircuits = lines.geometry.getAttribute("neonCircuit");
  expect(lineCircuits.getX(0)).toBe(lineCircuits.getX(1));
  expect(lineCircuits.getX(2)).toBe(lineCircuits.getX(3));
  disposeGroup(root);
});

it("shares one GPU brightness table and disables dips for reduced motion", () => {
  const material = withNeonFlicker(new THREE.MeshBasicMaterial(), {
    circuits: true,
  });
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
  };
  const parameters = shader as Parameters<THREE.Material["onBeforeCompile"]>[0];
  material.onBeforeCompile(parameters, {} as THREE.WebGLRenderer);
  const table = parameters.uniforms.neonBrightness.value;
  expect(table).toBeInstanceOf(Float32Array);
  expect(parameters.vertexShader).toContain("attribute float neonCircuit;");
  expect(parameters.vertexShader).toContain(
    "vNeonBrightness = neonBrightness[",
  );
  expect(parameters.fragmentShader).toContain(
    "outgoingLight *= vNeonBrightness;",
  );
  updateNeonFlicker(47.9);
  expect(table[0]).toBeCloseTo(0.68);
  updateNeonFlicker(47.9, true);
  expect(Array.from(table)).toEqual(Array(64).fill(1));
  material.dispose();
});

it("only modulates the emitted light of lit materials and leaves ordinary surfaces alone", () => {
  const root = new THREE.Group();
  const ordinary = new THREE.MeshStandardMaterial({ color: "#ff88dd" });
  const neon = new THREE.MeshStandardMaterial({
    emissive: "#ff88dd",
    emissiveIntensity: 0.5,
  });
  root.add(
    new THREE.Mesh(new THREE.BoxGeometry(), ordinary),
    new THREE.Mesh(new THREE.BoxGeometry(), neon),
  );
  const originalCompile = ordinary.onBeforeCompile;
  installNeonFlicker(root);
  expect(ordinary.onBeforeCompile).toBe(originalCompile);
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  } as Parameters<THREE.Material["onBeforeCompile"]>[0];
  neon.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  expect(shader.fragmentShader).toContain(
    "totalEmissiveRadiance *= vNeonBrightness;",
  );
  expect(shader.fragmentShader).not.toContain(
    "outgoingLight *= vNeonBrightness;",
  );
  const installedCompile = neon.onBeforeCompile;
  installNeonFlicker(root);
  expect(neon.onBeforeCompile).toBe(installedCompile);
  disposeGroup(root);
});
