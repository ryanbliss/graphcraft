import * as THREE from "three";
import { WorldEngine } from "../../../src/world/engine.ts";
import { disposeGroup } from "../../../src/world/geometry.ts";

const container = document.querySelector<HTMLElement>("#world")!;
const result = document.querySelector<HTMLElement>("#result")!;
const engine = new WorldEngine(container, {
  select() {},
  hover() {},
  mode() {},
  lock() {},
  error(message) {
    throw new Error(message);
  },
});

try {
  disposeGroup(engine.scene);
  engine.renderer.setPixelRatio(1);
  engine.renderer.setSize(256, 256, false);
  engine.composer.setPixelRatio(1);
  engine.composer.setSize(256, 256);
  engine.camera.aspect = 1;
  engine.camera.near = 0.1;
  engine.camera.far = 8640;
  engine.camera.updateProjectionMatrix();

  // Measured Neo layout bounds and the real city ground/district top heights.
  const geometry = new THREE.PlaneGeometry(1200.5, 1728);
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: "#ff0000", toneMapped: false }),
  );
  const district = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: "#00ff00", toneMapped: false }),
  );
  for (const mesh of [ground, district]) {
    mesh.rotation.x = -Math.PI / 2;
    engine.scene.add(mesh);
  }
  ground.position.y = -0.05;
  district.position.y = -0.015;

  const origin = new THREE.Vector3(950.4, 794.88, 1123.2);
  const axis = new THREE.Vector3(0, 1, 0);
  const gl = engine.renderer.getContext();
  const pixels = new Uint8Array(65 * 65 * 4);
  const reference = new Uint8Array(pixels.length);
  const samples: { angle: number; groundLast: boolean; wrongPixels: number }[] =
    [];
  for (const angle of [-0.18, 0, 0.001, 0.18]) {
    engine.camera.position.copy(origin).applyAxisAngle(axis, angle);
    engine.camera.lookAt(0, 0, 0);
    engine.camera.updateMatrixWorld();
    // The upper surface alone supplies the expected color after bloom/tone mapping.
    ground.visible = false;
    engine.composer.render();
    gl.readPixels(96, 96, 65, 65, gl.RGBA, gl.UNSIGNED_BYTE, reference);
    if (reference[1] < reference[0] + 40)
      throw new Error(
        "Expected the isolated district surface to render green.",
      );
    ground.visible = true;
    for (const groundLast of [false, true]) {
      ground.renderOrder = groundLast ? 1 : 0;
      district.renderOrder = groundLast ? 0 : 1;
      engine.composer.render();
      gl.readPixels(96, 96, 65, 65, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let wrongPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const difference = Math.max(
          Math.abs(pixels[i] - reference[i]),
          Math.abs(pixels[i + 1] - reference[i + 1]),
          Math.abs(pixels[i + 2] - reference[i + 2]),
        );
        if (difference > 2) wrongPixels++;
      }
      samples.push({ angle, groundLast, wrongPixels });
    }
  }
  result.textContent = JSON.stringify(samples, null, 2);
  result.dataset.errors = String(
    samples.reduce((total, sample) => total + sample.wrongPixels, 0),
  );
} finally {
  engine.dispose();
}
