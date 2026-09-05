import * as THREE from "three";
import { disposeGroup, VoxelBatch } from "./geometry.ts";
import { random } from "./layout.ts";

const smooth = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

interface Courier {
  ship: THREE.Group;
  exhaust: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  materials: THREE.Material[];
  from: number;
  to: number;
  seconds: number;
  duration: number;
  delay: number;
  altitude: number;
}

/** Decorative objects are kept outside the city's interaction and collision sets. */
export class AmbientSky {
  private root = new THREE.Group();
  private stars: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private traffic = new THREE.Group();
  private ports: THREE.Vector3[];
  private couriers: Courier[] = [];
  private seed = random(0x51a7c0);
  private cameraPosition = new THREE.Vector3();
  private nearest = new THREE.Vector3();

  constructor(scene: THREE.Scene, shuttles: Map<string, THREE.Group>) {
    this.root.name = "Ambient sky";
    this.ports = [...shuttles.values()].map((ship) =>
      ship
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(3.1, 0.2, 3.1)),
    );
    const positions: number[] = [];
    const colors: number[] = [];
    const variations: number[] = [];
    const palette = ["#8cefff", "#c2b1ff", "#ef99dd", "#d6f6ff"];
    for (let i = 0; i < 640; i++) {
      const azimuth = this.seed() * Math.PI * 2;
      const height = 0.07 + this.seed() * 0.93;
      const radius = Math.sqrt(1 - height * height);
      positions.push(
        Math.cos(azimuth) * radius * 3300,
        height * 3300,
        Math.sin(azimuth) * radius * 3300,
      );
      const color = new THREE.Color(palette[i % palette.length]);
      colors.push(color.r, color.g, color.b);
      variations.push(this.seed());
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute(
      "variation",
      new THREE.Float32BufferAttribute(variations, 1),
    );
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float variation;
        uniform float time;
        varying vec3 tint;
        varying float brightness;
        void main() {
          tint = color;
          brightness = 0.46 + 0.16 * sin(time * (0.35 + variation * 0.45) + variation * 80.0);
          gl_PointSize = 1.8 + variation * 2.1;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 tint;
        varying float brightness;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float core = 1.0 - smoothstep(0.07, 0.28, length(p));
          float halo = (1.0 - smoothstep(0.0, 0.5, length(p))) * 0.22;
          gl_FragColor = vec4(tint, (core + halo) * brightness);
        }
      `,
    });
    this.stars = new THREE.Points(geometry, material);
    this.stars.name = "Neon stars";
    this.stars.frustumCulled = false;
    this.stars.raycast = () => {};
    this.root.add(this.stars, this.traffic);
    for (let i = 0; i < 3; i++) this.couriers.push(this.createCourier(i));
    scene.add(this.root);
  }

  private createCourier(index: number): Courier {
    const ship = new THREE.Group();
    ship.name = "Distant courier";
    const hull = new VoxelBatch();
    const glow = new VoxelBatch(true);
    hull.add(0, 0.8, 0, 1.15, 0.55, 2.5, "#8295ad");
    hull.add(0, 0.9, 1.3, 0.7, 0.35, 0.65, "#bccfd8");
    hull.add(0, 1.2, 0.4, 0.8, 0.3, 0.9, "#152a42");
    glow.add(0, 1.24, 0.88, 0.65, 0.18, 0.06, "#97eeff");
    for (const side of [-1, 1]) {
      hull.add(side * 0.9, 0.6, -0.45, 0.75, 0.2, 1.4, "#597085");
      hull.add(side * 0.4, 1.2, -0.95, 0.15, 0.6, 0.45, "#a1b8c6");
      glow.add(
        side * 1.2,
        0.65,
        -0.45,
        0.12,
        0.12,
        0.7,
        index % 2 ? "#ffa0df" : "#84eeff",
      );
      glow.add(side * 0.35, 0.8, -1.28, 0.3, 0.28, 0.08, "#b8faff");
    }
    hull.build(ship);
    glow.build(ship);
    const exhaust = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 2.5, 5),
      new THREE.MeshBasicMaterial({
        color: "#71daff",
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    exhaust.rotation.x = -Math.PI / 2;
    exhaust.position.set(0, 0.8, -2.35);
    ship.add(exhaust);
    const materials: THREE.Material[] = [];
    ship.traverse((object) => {
      object.raycast = () => {};
      if (!(object instanceof THREE.Mesh)) return;
      const entries = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of entries) {
        material.transparent = true;
        materials.push(material);
      }
    });
    ship.visible = false;
    this.traffic.add(ship);
    return {
      ship,
      exhaust,
      materials,
      from: -1,
      to: -1,
      seconds: 0,
      duration: 1,
      delay: 3 + index * 12,
      altitude: 140,
    };
  }

  private start(courier: Courier): boolean {
    if (this.ports.length < 2) return false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const from = Math.floor(this.seed() * this.ports.length);
      const to = Math.floor(this.seed() * this.ports.length);
      if (from === to) continue;
      if (
        this.couriers.some(
          (other) =>
            other.from >= 0 &&
            (other.from === from ||
              other.to === from ||
              other.from === to ||
              other.to === to),
        )
      )
        continue;
      const a = this.ports[from];
      const b = this.ports[to];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared < 30 * 30) continue;
      const t = THREE.MathUtils.clamp(
        ((this.cameraPosition.x - a.x) * dx +
          (this.cameraPosition.z - a.z) * dz) /
          distanceSquared,
        0,
        1,
      );
      this.nearest.set(a.x + dx * t, this.cameraPosition.y, a.z + dz * t);
      if (this.nearest.distanceToSquared(this.cameraPosition) < 70 * 70)
        continue;
      courier.from = from;
      courier.to = to;
      courier.seconds = 0;
      courier.duration = 28 + Math.sqrt(distanceSquared) / 16;
      courier.altitude = 140 + this.seed() * 50;
      courier.ship.position.copy(a);
      courier.ship.rotation.set(0, Math.atan2(dx, dz), 0);
      courier.ship.visible = true;
      return true;
    }
    return false;
  }

  get flyingShips(): THREE.Object3D[] {
    return this.couriers
      .filter((courier) => courier.from >= 0 && courier.ship.visible)
      .map((courier) => courier.ship);
  }

  update(dt: number, camera: THREE.Camera, active = true, cinema = false) {
    camera.getWorldPosition(this.cameraPosition);
    this.stars.position.copy(this.cameraPosition);
    this.stars.material.uniforms.time.value += dt;
    this.traffic.visible = active;
    if (!active) return;
    for (const courier of this.couriers) {
      if (courier.from < 0) {
        courier.delay -= dt;
        if (courier.delay <= 0 && !this.start(courier)) courier.delay = 5;
        continue;
      }
      courier.seconds += dt;
      const t = courier.seconds / courier.duration;
      const travel = smooth((t - 0.22) / 0.56);
      const lift = smooth(t / 0.22) * (1 - smooth((t - 0.78) / 0.22));
      courier.ship.position.lerpVectors(
        this.ports[courier.from],
        this.ports[courier.to],
        travel,
      );
      courier.ship.position.y += courier.altitude * lift;
      courier.ship.rotation.z = Math.sin(t * Math.PI * 2) * 0.04 * lift;
      const fade =
        (cinema
          ? 1
          : smooth(
              (courier.ship.position.distanceTo(this.cameraPosition) - 45) / 25,
            )) *
        smooth(t / 0.025) *
        (1 - smooth((t - 0.975) / 0.025));
      for (const material of courier.materials) material.opacity = fade;
      courier.exhaust.material.opacity = fade * 0.5;
      courier.exhaust.scale.y =
        (0.3 + lift * 0.7) * (0.94 + Math.sin(courier.seconds * 23) * 0.06);
      if (t >= 1) {
        courier.ship.visible = false;
        courier.from = -1;
        courier.to = -1;
        courier.delay = 14 + this.seed() * 20;
      }
    }
  }

  dispose() {
    this.root.removeFromParent();
    disposeGroup(this.root);
  }
}
