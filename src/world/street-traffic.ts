import * as THREE from "three";
import type { Vec3 } from "./physics.ts";
import { withNeonFlicker } from "./neon-flicker.ts";
import { hash } from "../graph/types.ts";
import { random, type WorldLayout } from "./layout.ts";

type Point = { x: number; z: number };
export interface StreetNode extends Point {
  neighbors: number[];
}
export interface StreetNetwork {
  nodes: StreetNode[];
}

/** Bound intersection work even for very large source graphs. */
export function streetNetwork(layout: WorldLayout): StreetNetwork {
  const segments: { a: Point; b: Point; length: number; splits: Point[] }[] =
    [];
  const entrances = new Set(
    layout.buildings.map((b) => `${b.x}:${b.z + b.depth / 2}`),
  );
  for (const path of layout.paths)
    for (let i = 1; i < path.points.length; i++) {
      const start = path.points[i - 1],
        end = path.points[i];
      const originalLength = Math.hypot(end.x - start.x, end.z - start.z);
      if (originalLength < 8) continue;
      const a = { ...start },
        b = { ...end };
      const dx = (end.x - start.x) / originalLength,
        dz = (end.z - start.z) / originalLength;
      if (entrances.has(`${a.x}:${a.z}`)) {
        a.x += dx * 2.5;
        a.z += dz * 2.5;
      }
      if (entrances.has(`${b.x}:${b.z}`)) {
        b.x -= dx * 2.5;
        b.z -= dz * 2.5;
      }
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length >= 8 && (a.x === b.x || a.z === b.z))
        segments.push({ a, b, length, splits: [a, b] });
    }
  segments.sort((a, b) => b.length - a.length);
  segments.length = Math.min(96, segments.length);
  const contains = (s: (typeof segments)[number], p: Point) =>
    p.x >= Math.min(s.a.x, s.b.x) &&
    p.x <= Math.max(s.a.x, s.b.x) &&
    p.z >= Math.min(s.a.z, s.b.z) &&
    p.z <= Math.max(s.a.z, s.b.z);
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i],
        b = segments[j];
      if ((a.a.x === a.b.x) !== (b.a.x === b.b.x)) {
        const p =
          a.a.x === a.b.x ? { x: a.a.x, z: b.a.z } : { x: b.a.x, z: a.a.z };
        if (contains(a, p) && contains(b, p)) {
          a.splits.push(p);
          b.splits.push(p);
        }
      } else {
        for (const p of [a.a, a.b]) if (contains(b, p)) b.splits.push(p);
        for (const p of [b.a, b.b]) if (contains(a, p)) a.splits.push(p);
      }
    }
  const nodes: StreetNode[] = [],
    indices = new Map<string, number>();
  const index = (p: Point) => {
    const key = `${p.x}:${p.z}`;
    const existing = indices.get(key);
    if (existing !== undefined) return existing;
    const id = nodes.length;
    indices.set(key, id);
    nodes.push({ ...p, neighbors: [] });
    return id;
  };
  for (const segment of segments) {
    segment.splits.sort(
      (a, b) =>
        (a.x - segment.a.x) ** 2 +
        (a.z - segment.a.z) ** 2 -
        ((b.x - segment.a.x) ** 2 + (b.z - segment.a.z) ** 2),
    );
    let previous = index(segment.splits[0]);
    for (const point of segment.splits.slice(1)) {
      const next = index(point);
      if (previous !== next && !nodes[previous].neighbors.includes(next)) {
        nodes[previous].neighbors.push(next);
        nodes[next].neighbors.push(previous);
      }
      previous = next;
    }
  }
  return { nodes };
}

export function streetGreen(axis: "x" | "z", time: number): boolean {
  return Math.floor(time / 6) % 2 === (axis === "x" ? 0 : 1);
}

export interface StreetVehicle {
  position: Vec3;
  yaw: number;
  speed: number;
  width: number;
  length: number;
}

/** Footprint test shared by walkers and street vehicle avoidance. */
export function insideVehicle(
  point: Vec3,
  vehicle: StreetVehicle,
  margin = 0.38,
): boolean {
  if (Math.abs(point.y - vehicle.position.y) > 2) return false;
  const dx = point.x - vehicle.position.x,
    dz = point.z - vehicle.position.z;
  const side = dx * Math.cos(vehicle.yaw) - dz * Math.sin(vehicle.yaw);
  const forward = dx * Math.sin(vehicle.yaw) + dz * Math.cos(vehicle.yaw);
  return (
    Math.abs(side) < vehicle.width / 2 + margin &&
    Math.abs(forward) < vehicle.length / 2 + margin
  );
}

interface Car {
  mesh: THREE.Group;
  from: number;
  to: number;
  progress: number;
  speed: number;
}
interface Signal {
  axis: "x" | "z";
  red: THREE.MeshBasicMaterial;
  green: THREE.MeshBasicMaterial;
}

export class StreetTraffic {
  private readonly group = new THREE.Group();
  private readonly network: StreetNetwork;
  private readonly cars: Car[] = [];
  private readonly signals: Signal[] = [];
  private readonly rng: () => number;
  private time = 0;
  private readonly signalNodes = new Set<number>();
  private readonly reservations = new Map<
    number,
    { car: Car; remaining: number }
  >();
  private readonly desiredPosition = new THREE.Vector3();
  private readonly junctionGroups: number[];

  constructor(layout: WorldLayout, scene: THREE.Scene) {
    this.group.name = "street-traffic";
    this.network = streetNetwork(layout);
    this.rng = random(hash(`${layout.width}:${layout.depth}:traffic`));
    const { nodes } = this.network;
    this.junctionGroups = nodes.map((_, index) => index);
    const root = (index: number): number => {
      while (this.junctionGroups[index] !== index)
        index = this.junctionGroups[index];
      return index;
    };
    // Closely spaced crossings need one reservation to avoid blocking one another.
    nodes.forEach((node, index) => {
      if (node.neighbors.length < 3) return;
      for (const next of node.neighbors)
        if (
          nodes[next].neighbors.length >= 3 &&
          Math.hypot(node.x - nodes[next].x, node.z - nodes[next].z) < 6
        )
          this.junctionGroups[root(next)] = root(index);
    });
    this.junctionGroups.forEach(
      (_, index) => (this.junctionGroups[index] = root(index)),
    );
    nodes.forEach((node, index) => {
      if (node.neighbors.length >= 3 && this.signalNodes.size < 12) {
        this.signalNodes.add(index);
        for (const axis of ["x", "z"] as const) this.signal(node, axis);
      }
    });
    const edges: [number, number][] = [];
    nodes.forEach((node, from) => {
      for (const to of node.neighbors)
        if (
          from < to &&
          Math.hypot(node.x - nodes[to].x, node.z - nodes[to].z) >= 8
        )
          edges.push([from, to]);
    });
    const spawnProgress = ([from, to]: [number, number]) => {
      const a = nodes[from],
        b = nodes[to],
        dx = b.x - a.x,
        dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      return Math.max(
        3 / length,
        Math.min(
          1 - 3 / length,
          ((layout.spawn.x - a.x) * dx + (layout.spawn.z - a.z) * dz) /
            (length * length),
        ),
      );
    };
    const spawnDistance = (edge: [number, number]) => {
      const a = nodes[edge[0]],
        b = nodes[edge[1]],
        t = spawnProgress(edge);
      return Math.hypot(
        a.x + (b.x - a.x) * t - layout.spawn.x,
        a.z + (b.z - a.z) * t - layout.spawn.z,
      );
    };
    let closest = 0;
    for (let i = 1; i < edges.length; i++)
      if (spawnDistance(edges[i]) < spawnDistance(edges[closest])) closest = i;
    const nearSpawn = edges.splice(closest, 1)[0];
    for (let i = edges.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [edges[i], edges[j]] = [edges[j], edges[i]];
    }
    if (nearSpawn) edges.unshift(nearSpawn);
    for (const [from, to] of edges.slice(0, 8)) {
      const mesh = this.car();
      mesh.name = `courier-car-${this.cars.length}`;
      this.cars.push({
        mesh,
        from,
        to,
        progress:
          this.cars.length === 0
            ? spawnProgress([from, to])
            : 0.2 + this.rng() * 0.3,
        speed: 0,
      });
      this.group.add(mesh);
    }
    scene.add(this.group);
    this.update(0);
  }

  private box(
    group: THREE.Group,
    size: [number, number, number],
    position: [number, number, number],
    color: string,
    glow = false,
  ) {
    const material = glow
      ? withNeonFlicker(
          new THREE.MeshBasicMaterial({ color, toneMapped: false }),
        )
      : new THREE.MeshStandardMaterial({
          color,
          roughness: 0.45,
          metalness: 0.5,
        });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    group.add(mesh);
    return mesh;
  }

  private car() {
    const car = new THREE.Group();
    car.scale.set(1.36, 1.95, 1.75);
    const colors = ["#355e83", "#714977", "#987244", "#42716b"];
    this.box(
      car,
      [0.68, 0.3, 1.65],
      [0, 0.36, 0],
      colors[Math.floor(this.rng() * colors.length)],
    );
    this.box(car, [0.55, 0.27, 0.72], [0, 0.62, -0.1], "#172638");
    this.box(car, [0.48, 0.13, 0.025], [0, 0.68, 0.27], "#70dbe4", true);
    this.box(car, [0.72, 0.035, 1.2], [0, 0.2, 0], "#b45df6", true);
    this.box(car, [0.52, 0.04, 0.12], [0, 0.71, -0.65], "#566c84");
    this.box(car, [0.1, 0.015, 0.4], [0, 0.52, 0.59], "#8df3f0", true);
    for (const side of [-1, 1]) {
      this.box(car, [0.015, 0.16, 0.55], [side * 0.28, 0.66, -0.1], "#416f86");
      this.box(car, [0.02, 0.19, 0.025], [side * 0.29, 0.65, -0.05], "#111c2a");
      this.box(car, [0.015, 0.2, 0.58], [side * 0.345, 0.37, -0.1], "#273c52");
      this.box(car, [0.02, 0.025, 0.12], [side * 0.36, 0.44, 0.05], "#8bafbf");
      for (let vent = 0; vent < 3; vent++)
        this.box(
          car,
          [0.02, 0.1, 0.04],
          [side * 0.35, 0.4, -0.6 + vent * 0.07],
          "#101a25",
        );
      this.box(
        car,
        [0.15, 0.08, 0.04],
        [side * 0.22, 0.43, 0.84],
        "#d5ffff",
        true,
      );
      this.box(
        car,
        [0.18, 0.06, 0.04],
        [side * 0.2, 0.4, -0.84],
        "#ff3870",
        true,
      );
      for (const end of [-1, 1]) {
        this.box(
          car,
          [0.12, 0.22, 0.3],
          [side * 0.35, 0.2, end * 0.52],
          "#101b29",
        );
        this.box(
          car,
          [0.015, 0.1, 0.15],
          [side * 0.415, 0.2, end * 0.52],
          "#48cddb",
          true,
        );
      }
    }
    return car;
  }

  private signal(node: StreetNode, axis: "x" | "z") {
    const group = new THREE.Group();
    group.position.set(node.x + (axis === "x" ? -2.7 : 2.7), 0, node.z + 2.7);
    if (axis === "x") group.rotation.y = Math.PI / 2;
    this.box(group, [0.09, 2.5, 0.09], [0, 1.25, 0], "#4c6576");
    this.box(group, [0.4, 0.8, 0.24], [0, 2.35, 0], "#101a25");
    const red = withNeonFlicker(
        new THREE.MeshBasicMaterial({ color: "#ff345c", toneMapped: false }),
      ),
      green = withNeonFlicker(
        new THREE.MeshBasicMaterial({ color: "#46ffd3", toneMapped: false }),
      );
    for (const side of [-1, 1])
      for (const [y, material] of [
        [2.53, red],
        [2.18, green],
      ] as const) {
        const lamp = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.23, 0.025),
          material,
        );
        lamp.position.set(0, y, side * 0.135);
        group.add(lamp);
      }
    this.signals.push({ axis, red, green });
    this.group.add(group);
  }

  get vehicles(): readonly StreetVehicle[] {
    return this.cars.map((car) => ({
      position: car.mesh.position,
      yaw: car.mesh.rotation.y,
      speed: car.speed,
      width: 1.15,
      length: 3.01,
    }));
  }

  update(dt: number, people: readonly Vec3[] = [], player?: Vec3) {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    this.time += step;
    const { nodes } = this.network;
    const obstacles = player ? [...people, player] : people;
    for (const signal of this.signals) {
      const green = streetGreen(signal.axis, this.time);
      signal.red.color.set(green ? "#35121c" : "#ff345c");
      signal.green.color.set(green ? "#46ffd3" : "#10372d");
    }
    for (const car of this.cars) {
      const a = nodes[car.from],
        b = nodes[car.to];
      const dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz);
      const remaining = (1 - car.progress) * length;
      let clearance = Infinity;
      if (b.neighbors.length >= 3) {
        const junction = this.junctionGroups[car.to];
        const occupied = this.reservations.get(junction);
        const ownsCrossing = occupied?.car === car;
        const red =
          this.signalNodes.has(car.to) &&
          !streetGreen(dx === 0 ? "z" : "x", this.time);
        if (!ownsCrossing && (red || occupied))
          clearance = Math.max(0, remaining - 2.2);
        else if (remaining <= 2.4) {
          this.reservations.set(junction, { car, remaining: remaining + 3 });
        }
      }
      for (const other of this.cars) {
        if (
          other !== car &&
          other.from === car.from &&
          other.to === car.to &&
          other.progress > car.progress
        )
          clearance = Math.min(
            clearance,
            Math.max(0, (other.progress - car.progress) * length - 3.2),
          );
        // Keep the same following distance when a leader has just rounded a corner.
        if (other !== car && other.from === car.to && other.to !== car.from) {
          const end = nodes[other.to];
          const ahead = other.progress * Math.hypot(end.x - b.x, end.z - b.z);
          clearance = Math.min(clearance, Math.max(0, remaining + ahead - 3.2));
        }
      }
      for (const person of obstacles) {
        if (person.y > 3) continue;
        const ox = person.x - car.mesh.position.x,
          oz = person.z - car.mesh.position.z;
        const ahead = (ox * dx + oz * dz) / length;
        const lateral = Math.abs((ox * dz - oz * dx) / length);
        if (ahead > -0.2 && lateral < 1.04)
          clearance = Math.min(clearance, Math.max(0, ahead - 2.2));
      }
      const desired = Math.min(4.5, Math.sqrt(2 * 5 * clearance));
      car.speed += (desired - car.speed) * (1 - Math.exp(-step * 4));
      const distance = Math.min(car.speed * step, clearance);
      for (const [junction, reservation] of this.reservations)
        if (reservation.car === car) {
          reservation.remaining -= distance;
          if (reservation.remaining <= 0) {
            this.reservations.delete(junction);
          }
        }
      car.progress += distance / length;
      if (car.progress >= 1) {
        const previous = car.from;
        const next = b.neighbors.filter((id) => id !== previous);
        car.from = car.to;
        car.to = next.length
          ? next[Math.floor(this.rng() * next.length)]
          : previous;
        car.progress = 0;
      }
      const start = nodes[car.from],
        end = nodes[car.to];
      const vx = end.x - start.x,
        vz = end.z - start.z,
        span = Math.hypot(vx, vz);
      const x = start.x + vx * car.progress + (vz / span) * 0.6;
      const z = start.z + vz * car.progress - (vx / span) * 0.6;
      if (step === 0) car.mesh.position.set(x, 0, z);
      else
        car.mesh.position.lerp(
          this.desiredPosition.set(x, 0, z),
          1 - Math.exp(-step * 18),
        );
      const yaw = Math.atan2(vx, vz),
        difference = Math.atan2(
          Math.sin(yaw - car.mesh.rotation.y),
          Math.cos(yaw - car.mesh.rotation.y),
        );
      car.mesh.rotation.y +=
        difference * (step === 0 ? 1 : 1 - Math.exp(-step * 8));
    }
  }

  dispose() {
    this.group.removeFromParent();
    const materials = new Set<THREE.Material>();
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(material);
      }
    });
    for (const material of materials) material.dispose();
  }
}
