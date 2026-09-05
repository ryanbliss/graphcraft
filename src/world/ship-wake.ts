import * as THREE from "three";
import { disposeGroup } from "./geometry.ts";

const samples = 28;
/** A fixed-size pair of engine wakes; no particles accumulate in the world. */
export class ShipWake {
  private history = Array.from({ length: 2 }, () =>
    Array.from({ length: samples }, () => new THREE.Vector3()),
  );
  private positions = new Float32Array((samples - 1) * 2 * 6 * 3);
  private colors = new Float32Array(this.positions.length);
  private geometry = new THREE.BufferGeometry();
  private ribbon: THREE.Mesh;
  private exhaust = new THREE.Group();
  private count = 0;
  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3),
    );
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.ribbon = new THREE.Mesh(this.geometry, material);
    this.ribbon.frustumCulled = false;
    this.ribbon.visible = false;
    scene.add(this.ribbon);
    for (const side of [-1, 1]) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 3.5, 12),
        new THREE.MeshBasicMaterial({
          color: "#62dfee",
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(side * 1.05, 3.13, -5.25);
      this.exhaust.add(flame);
      const core = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 1.8, 10),
        new THREE.MeshBasicMaterial({ color: "#eaffed", toneMapped: false }),
      );
      core.rotation.x = -Math.PI / 2;
      core.position.set(side * 1.05, 3.13, -4.38);
      this.exhaust.add(core);
    }
  }
  attach(ship: THREE.Group) {
    this.reset();
    ship.add(this.exhaust);
  }
  update(ship: THREE.Group, seconds: number) {
    ship.updateWorldMatrix(true, false);
    this.count = Math.min(samples, this.count + 1);
    const sideX = Math.cos(ship.rotation.y),
      sideZ = -Math.sin(ship.rotation.y);
    let cursor = 0;
    for (let engine = 0; engine < 2; engine++) {
      const points = this.history[engine];
      for (let i = this.count - 1; i > 0; i--) points[i].copy(points[i - 1]);
      points[0].set(engine === 0 ? -1.05 : 1.05, 3.13, -3.6);
      ship.localToWorld(points[0]);
      for (let i = 0; i < this.count - 1; i++) {
        const strength = 1 - i / (samples - 1);
        const width = strength * 0.25;
        for (const [point, side] of [
          [points[i], -1],
          [points[i], 1],
          [points[i + 1], -1],
          [points[i + 1], -1],
          [points[i], 1],
          [points[i + 1], 1],
        ] as const) {
          this.positions[cursor] = point.x + sideX * width * side;
          this.colors[cursor++] = 0.18 * strength;
          this.positions[cursor] = point.y;
          this.colors[cursor++] = 0.9 * strength;
          this.positions[cursor] = point.z + sideZ * width * side;
          this.colors[cursor++] = strength;
        }
      }
    }
    this.geometry.setDrawRange(0, cursor / 3);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.ribbon.visible = this.count > 1 && seconds < 7.9;
    this.exhaust.visible = seconds < 7.9;
    this.exhaust.scale.z = 0.94 + Math.sin(seconds * 43) * 0.06;
  }
  reset() {
    this.count = 0;
    this.ribbon.visible = false;
    this.exhaust.removeFromParent();
  }
  dispose() {
    this.reset();
    this.ribbon.removeFromParent();
    this.geometry.dispose();
    (this.ribbon.material as THREE.Material).dispose();
    disposeGroup(this.exhaust);
  }
}
