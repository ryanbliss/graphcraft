import * as THREE from "three";

const circuitCount = 64;
const brightness = { value: new Float32Array(circuitCount).fill(1) };
const installed = new WeakSet<THREE.Material>();
const sequence = [
  [0, 1],
  [1.1, 0.88],
  [1.8, 0.96],
  [2.9, 0.68],
  [3.7, 0.9],
  [4.8, 1],
] as const;

/** Broad, eased pulses with long, different quiet intervals for each circuit. */
export function neonFlickerAt(seconds: number, circuit: number): number {
  const period = 45 + ((circuit * 17) % 37);
  const offset = ((circuit * 0.754877666) % 1) * period;
  const phase = (seconds + offset) % period;
  if (phase >= 4.8) return 1;
  for (let index = 1; index < sequence.length; index++) {
    const [end, to] = sequence[index];
    if (phase > end) continue;
    const [start, from] = sequence[index - 1];
    const t = (phase - start) / (end - start);
    return from + (to - from) * t * t * (3 - 2 * t);
  }
  return 1;
}

export function updateNeonFlicker(seconds: number, reducedMotion = false) {
  for (let circuit = 0; circuit < circuitCount; circuit++)
    brightness.value[circuit] = reducedMotion
      ? 1
      : neonFlickerAt(seconds, circuit);
}

export function withNeonFlicker<T extends THREE.Material>(
  material: T,
  options: { circuits?: boolean; seed?: number } = {},
): T {
  if (installed.has(material)) return material;
  installed.add(material);
  const previous = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey();
  const emissive = material instanceof THREE.MeshStandardMaterial;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.neonBrightness = brightness;
    shader.uniforms.neonSeed = { value: options.seed ?? 0 };
    const circuit = options.circuits
      ? "neonCircuit"
      : "neonSeed + dot(modelMatrix[3].xyz, vec3(0.731, 0.193, 0.547))";
    shader.vertexShader = `
      uniform float neonBrightness[${circuitCount}];
      uniform float neonSeed;
      varying float vNeonBrightness;
      ${options.circuits ? "attribute float neonCircuit;" : ""}
      ${shader.vertexShader}
    `.replace(
      "void main() {",
      `void main() {
        vNeonBrightness = neonBrightness[int(mod(floor(${circuit}), ${circuitCount}.0))];`,
    );
    shader.fragmentShader = `varying float vNeonBrightness;\n${shader.fragmentShader}`;
    if (emissive)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vNeonBrightness;",
      );
    else
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "outgoingLight *= vNeonBrightness;\n#include <opaque_fragment>",
      );
  };
  material.customProgramCacheKey = () =>
    `${cacheKey}|neon:${Boolean(options.circuits)}:${emissive}`;
  material.needsUpdate = true;
  return material;
}

/** Called when the world is built; no scene traversal runs in the animation loop. */
export function installNeonFlicker(root: THREE.Object3D) {
  root.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) &&
      !(object instanceof THREE.Line) &&
      !(object instanceof THREE.Points) &&
      !(object instanceof THREE.Sprite)
    )
      return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (material instanceof THREE.ShaderMaterial) continue;
      if (material instanceof THREE.MeshStandardMaterial) {
        if (material.emissiveIntensity > 0 && material.emissive.getHex() !== 0)
          withNeonFlicker(material);
      } else if (
        !material.toneMapped ||
        material.blending === THREE.AdditiveBlending ||
        material instanceof THREE.LineBasicMaterial
      )
        withNeonFlicker(material);
    }
  });
}
