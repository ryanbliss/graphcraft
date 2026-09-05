import { unionSurfaces, type SurfaceRect } from "./road-surfaces.ts";
import * as THREE from "three";
import { CollisionWorld } from "./physics.ts";
import { hash } from "../graph/types.ts";
import { disposeGroup, VoxelBatch } from "./geometry.ts";
import { random, type WorldLayout } from "./layout.ts";

interface Walkway {
  from: THREE.Vector3;
  to: THREE.Vector3;
  length: number;
  heading: number;
}
/** Choose a clear side for the whole route, never steering around traffic. */
export function sidewalkRoutes(
  layout: WorldLayout,
  colliders?: CollisionWorld,
): Walkway[] {
  const buildings = new CollisionWorld();
  for (const b of layout.buildings)
    buildings.add({
      minX: b.x - b.width / 2,
      maxX: b.x + b.width / 2,
      minZ: b.z - b.depth / 2,
      maxZ: b.z + b.depth / 2,
      minY: 0,
      maxY: b.height,
    });
  const routes: Walkway[] = [],
    seen = new Set<string>();
  const clear = (from: THREE.Vector3, to: THREE.Vector3) => {
    const minX = Math.min(from.x, to.x) - 0.45,
      maxX = Math.max(from.x, to.x) + 0.45;
    const minZ = Math.min(from.z, to.z) - 0.45,
      maxZ = Math.max(from.z, to.z) + 0.45;
    const steps = Math.ceil(from.distanceTo(to) / 8);
    const checked = new Set<object>();
    for (let i = 0; i <= steps; i++) {
      const point = {
        x: from.x + ((to.x - from.x) * i) / steps,
        y: 0,
        z: from.z + ((to.z - from.z) * i) / steps,
      };
      for (const world of colliders ? [buildings, colliders] : [buildings])
        for (const box of world.nearby(point)) {
          if (checked.has(box)) continue;
          checked.add(box);
          if (
            box.maxY > 0.04 &&
            box.minY < 1.95 &&
            box.minX < maxX &&
            box.maxX > minX &&
            box.minZ < maxZ &&
            box.maxZ > minZ
          )
            return false;
        }
    }
    return true;
  };
  for (const path of layout.paths)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i],
        length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 15 || (a.x !== b.x && a.z !== b.z)) continue;
      const key = [`${a.x}:${a.z}`, `${b.x}:${b.z}`].sort().join("/");
      if (seen.has(key)) continue;
      seen.add(key);
      const dx = (b.x - a.x) / length,
        dz = (b.z - a.z) / length;
      for (const side of [1, -1]) {
        const from = new THREE.Vector3(
          a.x + dx * 2.5 + dz * 1.9 * side,
          0,
          a.z + dz * 2.5 - dx * 1.9 * side,
        );
        const to = new THREE.Vector3(
          b.x - dx * 2.5 + dz * 1.9 * side,
          0,
          b.z - dz * 2.5 - dx * 1.9 * side,
        );
        if (!clear(from, to)) continue;
        routes.push({
          from,
          to,
          length: length - 5,
          heading: Math.atan2(dx, dz),
        });
        break;
      }
    }
  return routes;
}

interface Person {
  root: THREE.Group;
  head: THREE.Group;
  arms: THREE.Group[];
  elbows: THREE.Group[];
  legs: THREE.Group[];
  knees: THREE.Group[];
  route: Walkway;
  home: Walkway;
  homeDistance: number;
  materials: THREE.Material[];
  opacity: number;
  distance: number;
  direction: number;
  speed: number;
  state: "walk" | "pause" | "turn";
  wait: number;
  nextPause: number;
  gait: number;
  stride: number;
  seed: () => number;
}

const outfits = [
  { jacket: "#ca4d96", panel: "#6d254f", trim: "#78f4ed", coat: true },
  { jacket: "#398eab", panel: "#163649", trim: "#ff9ed7", coat: false },
  { jacket: "#8d6cae", panel: "#3d315e", trim: "#95f2ff", coat: false },
  { jacket: "#ced0b2", panel: "#5c6770", trim: "#ffa7e0", coat: true },
] as const;

export class Pedestrians {
  private root = new THREE.Group();
  private sidewalks = new THREE.Group();
  private people: Person[] = [];
  private pathsByCell = new Map<string, Walkway[]>();
  private redistributionDelay = 0;

  constructor(
    layout: WorldLayout,
    scene: THREE.Scene,
    colliders?: CollisionWorld,
  ) {
    this.root.name = "Pedestrians";
    const routes = sidewalkRoutes(layout, colliders);
    let totalLength = 0;
    const pavement = new VoxelBatch();
    const surfaces: SurfaceRect[] = [];
    for (const route of routes) {
      totalLength += route.length;
      surfaces.push({
        minX:
          Math.min(route.from.x, route.to.x) -
          (route.from.x === route.to.x ? 0.45 : 0),
        maxX:
          Math.max(route.from.x, route.to.x) +
          (route.from.x === route.to.x ? 0.45 : 0),
        minZ:
          Math.min(route.from.z, route.to.z) -
          (route.from.z === route.to.z ? 0.45 : 0),
        maxZ:
          Math.max(route.from.z, route.to.z) +
          (route.from.z === route.to.z ? 0.45 : 0),
      });
      const steps = Math.ceil(route.length / 32);
      let previousCell = "";
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const x = route.from.x + (route.to.x - route.from.x) * t,
          z = route.from.z + (route.to.z - route.from.z) * t;
        const key = `${Math.floor(x / 64)},${Math.floor(z / 64)}`;
        if (key === previousCell) continue;
        previousCell = key;
        const paths = this.pathsByCell.get(key);
        if (paths) paths.push(route);
        else this.pathsByCell.set(key, [route]);
      }
    }
    for (const r of unionSurfaces(surfaces))
      pavement.add(
        (r.minX + r.maxX) / 2,
        0.012,
        (r.minZ + r.maxZ) / 2,
        r.maxX - r.minX,
        0.024,
        r.maxZ - r.minZ,
        "#25333e",
      );
    this.sidewalks.name = "Sidewalks";
    pavement.build(this.sidewalks);
    scene.add(this.sidewalks);
    const spawnDistance = (route: Walkway) =>
      Math.hypot(
        (route.from.x + route.to.x) / 2 - layout.spawn.x,
        (route.from.z + route.to.z) / 2 - layout.spawn.z,
      );
    routes.sort((a, b) => spawnDistance(a) - spawnDistance(b));
    const count = Math.min(8, routes.length, Math.ceil(totalLength / 180));
    for (let index = 0; index < count; index++) {
      const route = routes[Math.floor((index * routes.length) / count)];
      const seed = random(hash(`${route.from.x}:${route.from.z}:${index}`));
      const person = this.buildPerson(index, route, seed);
      this.people.push(person);
      this.root.add(person.root);
      this.place(person);
    }
    this.root.traverse((object) => {
      object.raycast = () => {};
    });
    scene.add(this.root);
  }

  private buildPerson(
    index: number,
    route: Walkway,
    seed: () => number,
  ): Person {
    const root = new THREE.Group();
    root.name = `Pedestrian ${index + 1}`;
    root.scale.setScalar(1.01);
    const outfit = outfits[index % outfits.length];
    const skin = ["#ba876d", "#835747", "#e3b59b", "#a2746f"][index % 4];
    const part = (
      parent: THREE.Group,
      name: string,
      x: number,
      y: number,
      z: number,
      draw: (body: VoxelBatch, glow: VoxelBatch) => void,
      luminous = false,
    ) => {
      const group = new THREE.Group();
      group.name = name;
      group.position.set(x, y, z);
      const body = new VoxelBatch();
      const glow = new VoxelBatch(true);
      glow.owner = `pedestrian:${index}:${name}`;
      draw(body, glow);
      body.build(group);
      if (luminous) glow.build(group);
      parent.add(group);
      return group;
    };
    part(
      root,
      "Jacket",
      0,
      0,
      0,
      (body, glow) => {
        body.add(0, 1.19, 0, 0.43, 0.47, 0.27, outfit.jacket);
        body.add(0, 0.91, 0, 0.35, 0.16, 0.25, "#253044");
        body.add(0, 0.99, 0.15, 0.39, 0.07, 0.05, "#101c2c");
        body.add(0, 1.45, 0, 0.29, 0.11, 0.29, outfit.panel);
        body.add(0, 1.53, 0, 0.13, 0.12, 0.14, skin);
        body.add(0, 1.2, -0.2, 0.26, 0.35, 0.14, outfit.panel);
        for (const side of [-1, 1]) {
          body.add(side * 0.25, 1.4, 0, 0.16, 0.17, 0.3, outfit.panel);
          body.add(side * 0.12, 1.13, 0.155, 0.12, 0.13, 0.025, outfit.panel);
          glow.add(side * 0.15, 1.32, 0.145, 0.05, 0.15, 0.018, outfit.trim);
          if (outfit.coat)
            body.add(side * 0.16, 0.82, -0.12, 0.2, 0.43, 0.18, outfit.jacket);
        }
        glow.add(0, 1.21, 0.146, 0.025, 0.37, 0.012, outfit.trim);
      },
      true,
    );
    const head = part(
      root,
      "Head",
      0,
      1.64,
      0,
      (body, glow) => {
        body.add(0, 0, 0, 0.25, 0.28, 0.24, skin);
        body.add(0, 0.12, -0.02, 0.28, 0.11, 0.25, outfit.panel);
        body.add(0, 0.015, 0.131, 0.23, 0.075, 0.025, "#122236");
        body.add(0, -0.065, 0.129, 0.085, 0.025, 0.03, skin);
        glow.add(0, 0.027, 0.149, 0.19, 0.024, 0.015, outfit.trim);
        if (index % 3 === 0) {
          body.add(0, 0.17, 0.015, 0.3, 0.09, 0.28, outfit.jacket);
          body.add(0, 0.13, 0.14, 0.29, 0.035, 0.13, outfit.panel);
        } else if (index % 3 === 1) {
          body.add(0, 0.22, -0.025, 0.085, 0.16, 0.2, outfit.jacket);
        } else {
          body.add(0, 0.015, -0.11, 0.29, 0.31, 0.1, outfit.jacket);
          body.add(-0.15, 0.035, 0, 0.055, 0.12, 0.13, "#233044");
          glow.add(-0.185, 0.04, 0, 0.018, 0.055, 0.065, outfit.trim);
        }
      },
      true,
    );
    const arms: THREE.Group[] = [],
      elbows: THREE.Group[] = [];
    const legs: THREE.Group[] = [],
      knees: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const arm = part(root, "Shoulder", side * 0.275, 1.39, 0, (body) => {
        body.add(side * 0.025, -0.14, 0, 0.14, 0.29, 0.17, outfit.jacket);
      });
      const elbow = part(
        arm,
        "Elbow",
        side * 0.025,
        -0.28,
        0,
        (body, glow) => {
          body.add(0, -0.115, 0.012, 0.12, 0.23, 0.14, outfit.panel);
          body.add(0, -0.265, 0.012, 0.11, 0.095, 0.12, skin);
          if (side < 0) {
            body.add(0, -0.19, 0.092, 0.105, 0.075, 0.03, "#162737");
            glow.add(0, -0.19, 0.113, 0.074, 0.042, 0.01, outfit.trim);
          }
        },
        side < 0,
      );
      const leg = part(root, "Hip", side * 0.115, 0.89, 0, (body) => {
        body.add(0, -0.19, 0, 0.17, 0.38, 0.2, "#283249");
        body.add(side * 0.095, -0.13, 0, 0.035, 0.17, 0.15, outfit.panel);
      });
      const knee = part(leg, "Knee", 0, -0.39, 0, (body) => {
        body.add(0, -0.17, 0, 0.145, 0.34, 0.17, "#202b3e");
        body.add(0, -0.01, 0.095, 0.15, 0.11, 0.05, outfit.panel);
        body.add(0, -0.38, 0.052, 0.19, 0.14, 0.28, "#101e2e");
        body.add(0, -0.429, 0.058, 0.2, 0.035, 0.3, "#748b97");
      });
      arms.push(arm);
      elbows.push(elbow);
      legs.push(leg);
      knees.push(knee);
    }
    for (const child of root.children) child.position.y -= 0.05;
    const direction = index % 2 ? -1 : 1;
    root.rotation.y = route.heading + (direction < 0 ? Math.PI : 0);
    const materials: THREE.Material[] = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const entries = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of entries) {
        material.transparent = true;
        materials.push(material);
      }
    });
    const distance = route.length * (0.2 + seed() * 0.6);
    return {
      root,
      head,
      arms,
      elbows,
      legs,
      knees,
      route,
      home: route,
      homeDistance: distance,
      materials,
      opacity: 1,
      distance,
      direction,
      speed: 0.75 + seed() * 0.45,
      state: "walk",
      wait: 0,
      nextPause: 8 + seed() * 14,
      gait: seed() * Math.PI * 2,
      stride: 0,
      seed,
    };
  }

  private place(person: Person) {
    person.root.position.lerpVectors(
      person.route.from,
      person.route.to,
      person.distance / person.route.length,
    );
    person.root.position.y =
      0.026 + Math.abs(Math.sin(person.gait)) * 0.012 * person.stride;
  }

  private moveTo(person: Person, route: Walkway, distance: number) {
    person.route = route;
    person.distance = distance;
    person.state = "walk";
    person.stride = 0;
    person.root.rotation.y =
      route.heading + (person.direction < 0 ? Math.PI : 0);
    this.place(person);
  }

  private populateNearby(viewer: THREE.Vector3) {
    let nearby = this.people.filter(
      (person) => person.root.position.distanceToSquared(viewer) < 90 * 90,
    ).length;
    if (nearby >= 3) return;
    const routes = new Set<Walkway>();
    const cellX = Math.floor(viewer.x / 64),
      cellZ = Math.floor(viewer.z / 64);
    for (const dx of [0, -1, 1]) {
      if (routes.size >= 64) break;
      for (const dz of [0, -1, 1]) {
        for (const route of this.pathsByCell.get(
          `${cellX + dx},${cellZ + dz}`,
        ) ?? []) {
          routes.add(route);
          if (routes.size >= 64) break;
        }
        if (routes.size >= 64) break;
      }
    }
    // Keep the first figure on the spawn path; move only invisible distant figures.
    for (let index = 1; index < this.people.length && nearby < 3; index++) {
      const person = this.people[index];
      if (
        person.opacity > 0 ||
        person.root.position.distanceToSquared(viewer) <= 110 * 110
      )
        continue;
      let best: { route: Walkway; distance: number } | undefined;
      let score = Infinity;
      for (const route of routes) {
        if (this.people.some((other) => other.route === route)) continue;
        const dx = (route.to.x - route.from.x) / route.length;
        const dz = (route.to.z - route.from.z) / route.length;
        const projected =
          (viewer.x - route.from.x) * dx + (viewer.z - route.from.z) * dz;
        const offset = person.seed() < 0.5 ? -22 : 22;
        const distance = THREE.MathUtils.clamp(
          projected + offset,
          1,
          route.length - 1,
        );
        const x = route.from.x + dx * distance,
          z = route.from.z + dz * distance;
        const separation = Math.hypot(x - viewer.x, z - viewer.z);
        if (separation < 18 || separation > 80) continue;
        if (
          this.people.some(
            (other) =>
              Math.hypot(other.root.position.x - x, other.root.position.z - z) <
              14,
          )
        )
          continue;
        const candidateScore = Math.abs(separation - 35) + person.seed() * 15;
        if (candidateScore >= score) continue;
        score = candidateScore;
        best = { route, distance };
      }
      if (!best) continue;
      this.moveTo(person, best.route, best.distance);
      nearby++;
    }
  }

  get positions(): readonly THREE.Vector3[] {
    return this.people
      .filter((person) => person.root.visible)
      .map((person) => person.root.position);
  }

  update(dt: number, viewer: THREE.Vector3) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    const groundView = viewer.y < 12;
    for (const person of this.people) {
      const restoreHome = !groundView && person.route !== person.home;
      const distant =
        groundView &&
        person.root.position.distanceToSquared(viewer) > 100 * 100;
      const targetOpacity = restoreHome || distant ? 0 : 1;
      person.opacity += THREE.MathUtils.clamp(
        targetOpacity - person.opacity,
        -dt * 0.7,
        dt * 0.7,
      );
      for (const material of person.materials) {
        material.opacity = person.opacity;
        material.depthWrite = person.opacity === 1;
      }
      person.root.visible = person.opacity > 0;
      if (restoreHome && person.opacity === 0)
        this.moveTo(person, person.home, person.homeDistance);
      const nearViewer = person.root.position.distanceToSquared(viewer) < 3.6;
      if (person.state === "walk" && !nearViewer) {
        person.distance = THREE.MathUtils.clamp(
          person.distance + person.direction * person.speed * dt,
          0,
          person.route.length,
        );
        person.gait += person.speed * dt * 7.2;
        person.nextPause -= dt;
        if (person.distance === 0 || person.distance === person.route.length) {
          person.direction *= -1;
          person.state = "turn";
        } else if (person.nextPause <= 0) {
          person.state = "pause";
          person.wait = 2 + person.seed() * 2;
          person.nextPause = 12 + person.seed() * 18;
        }
      } else if (person.state === "pause") {
        person.wait -= dt;
        if (person.wait <= 0) person.state = "walk";
      }
      const target =
        person.route.heading + (person.direction < 0 ? Math.PI : 0);
      const turn = Math.atan2(
        Math.sin(target - person.root.rotation.y),
        Math.cos(target - person.root.rotation.y),
      );
      person.root.rotation.y += turn * (1 - Math.exp(-3 * dt));
      if (person.state === "turn" && Math.abs(turn) < 0.025)
        person.state = "walk";
      const walking = person.state === "walk" && !nearViewer;
      person.stride +=
        (Number(walking) - person.stride) * (1 - Math.exp(-5 * dt));
      const gesture = 1 - person.stride;
      person.head.rotation.y =
        gesture * Math.sin(person.wait * 1.2 + person.gait) * 0.3;
      person.head.rotation.x = gesture * 0.14;
      for (let limb = 0; limb < 2; limb++) {
        const swing = Math.sin(person.gait + limb * Math.PI) * person.stride;
        person.legs[limb].rotation.x = swing * 0.32;
        person.knees[limb].rotation.x = Math.max(0, -swing) * 0.42;
        person.arms[limb].rotation.x = -swing * 0.25 - gesture * 0.3;
        person.elbows[limb].rotation.x =
          -0.13 - (limb === 0 ? gesture * 1.05 : gesture * 0.12);
      }
      this.place(person);
    }
    this.redistributionDelay -= dt;
    if (groundView && this.redistributionDelay <= 0) {
      this.redistributionDelay = 2;
      this.populateNearby(viewer);
    }
  }

  dispose() {
    this.root.removeFromParent();
    this.sidewalks.removeFromParent();
    disposeGroup(this.sidewalks);
    disposeGroup(this.root);
    this.people = [];
    this.pathsByCell.clear();
  }
}
