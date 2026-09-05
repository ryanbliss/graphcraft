import * as THREE from "three";
import { hash } from "../graph/types.ts";
import { random, type Room, type WorldLayout } from "./layout.ts";

type ShotKind = "city" | "building" | "path" | "room" | "ship";
type Shot =
  | {
      kind: "pan";
      from: THREE.Vector3;
      to: THREE.Vector3;
      focusFrom: THREE.Vector3;
      focusTo: THREE.Vector3;
    }
  | {
      kind: "orbit";
      center: THREE.Vector3;
      radius: number;
      height: number;
      angle: number;
      sweep: number;
    }
  | { kind: "ship"; ship: THREE.Object3D; offset: THREE.Vector3 };

const fadeDuration = 0.4;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Survey shots stay on paths, in doorways, or above roofs. Cuts happen under a fade. */
export class CinemaCamera {
  private readonly rng: () => number;
  private readonly roof: number;
  private readonly rooms: Room[];
  private readonly segments: [THREE.Vector3, THREE.Vector3][] = [];
  private deck: ShotKind[] = [];
  private shot?: Shot;
  private elapsed = 0;
  private duration = 10;
  private phase: "playing" | "out" | "in" = "playing";
  private fade = 0;
  private lastKind?: ShotKind;
  private readonly position = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();

  constructor(private readonly layout: WorldLayout) {
    let seed = hash(`${layout.width}:${layout.depth}`);
    this.roof = 0;
    this.rooms = [];
    for (const building of layout.buildings) {
      seed ^= hash(building.id);
      this.roof = Math.max(this.roof, building.height);
      for (const room of building.rooms)
        if (room.nodeIds.some((id) => layout.positions.has(id)))
          this.rooms.push(room);
    }
    this.rng = random(seed);
    for (const path of layout.paths)
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1],
          b = path.points[i];
        const from = new THREE.Vector3(a.x, 2.4, a.z);
        const to = new THREE.Vector3(b.x, 2.4, b.z);
        if (from.distanceTo(to) >= 8) this.segments.push([from, to]);
      }
  }

  get fadeOpacity() {
    return this.fade;
  }

  reset() {
    this.shot = undefined;
    this.elapsed = 0;
    this.phase = "playing";
    this.fade = 0;
  }

  update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    target: THREE.Vector3,
    ships: readonly THREE.Object3D[],
  ): boolean {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    let changed = false;
    if (!this.shot) {
      // Inherit the user's view and pan in place before the first distant cut.
      const direction = target.clone().sub(camera.position);
      if (direction.lengthSq() < 0.01) camera.getWorldDirection(direction);
      const end = direction
        .clone()
        .applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.16);
      this.shot = {
        kind: "pan",
        from: camera.position.clone(),
        to: camera.position.clone(),
        focusFrom: camera.position.clone().add(direction),
        focusTo: camera.position.clone().add(end),
      };
      this.duration = 8 + this.rng() * 4;
    }
    if (this.phase === "out") {
      this.fade = Math.min(1, this.fade + step / fadeDuration);
      if (this.fade === 1) {
        this.shot = this.plan(ships);
        this.elapsed = 0;
        this.duration = 8 + this.rng() * 4;
        this.phase = "in";
        changed = true;
      }
    } else {
      if (this.phase === "in") {
        this.fade = Math.max(0, this.fade - step / fadeDuration);
        if (this.fade === 0) this.phase = "playing";
      }
      this.elapsed += step;
      if (this.elapsed >= this.duration) this.phase = "out";
      if (this.shot.kind === "ship" && !ships.includes(this.shot.ship))
        this.phase = "out";
    }
    if (this.shot.kind !== "ship" || ships.includes(this.shot.ship))
      this.sample(ease(Math.min(1, this.elapsed / this.duration)));
    if (this.shot.kind === "ship" && !changed) {
      const blend = 1 - Math.exp(-step * 3);
      camera.position.lerp(this.position, blend);
      target.lerp(this.focus, blend);
    } else {
      camera.position.copy(this.position);
      target.copy(this.focus);
    }
    camera.lookAt(target);
    return changed;
  }

  private choose<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }

  private plan(ships: readonly THREE.Object3D[]): Shot {
    if (!this.deck.length) {
      this.deck = ["city"];
      if (this.layout.buildings.length) this.deck.push("building");
      if (this.rooms.length) this.deck.push("room");
      if (this.segments.length) this.deck.push("path");
      if (ships.length) this.deck.push("ship");
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
      if (this.deck.length > 1 && this.deck.at(-1) === this.lastKind)
        [this.deck[0], this.deck[this.deck.length - 1]] = [
          this.deck[this.deck.length - 1],
          this.deck[0],
        ];
    }
    const kind = this.deck.pop()!;
    this.lastKind = kind;
    if (kind === "ship" && ships.length)
      return {
        kind: "ship",
        ship: this.choose(ships),
        offset: new THREE.Vector3(14, 9, 18),
      };
    if (kind === "room") {
      const room = this.choose(this.rooms);
      const toward =
        Math.sign(room.x - room.door.x) || (room.side === "left" ? -1 : 1);
      const eye = new THREE.Vector3(
        room.door.x + toward * 0.7,
        room.floorY + 2.2,
        room.door.z,
      );
      const artifacts = room.nodeIds.flatMap((id) => {
        const point = this.layout.positions.get(id);
        return point ? [point] : [];
      });
      const artifact = this.choose(artifacts);
      const focus = new THREE.Vector3(
        artifact.x,
        Math.max(room.floorY + 1, Math.min(room.floorY + 2.6, artifact.y)),
        artifact.z,
      );
      return {
        kind: "pan",
        from: eye,
        to: eye.clone(),
        focusFrom: focus.clone().add(new THREE.Vector3(0, 0, -0.45)),
        focusTo: focus.clone().add(new THREE.Vector3(0, 0, 0.45)),
      };
    }
    if (kind === "path") {
      const [a, b] = this.choose(this.segments);
      const direction = b.clone().sub(a).normalize();
      if (this.rng() < 0.5) direction.negate();
      const center = a.clone().lerp(b, 0.5);
      const distance = Math.min(12, a.distanceTo(b) * 0.55);
      const from = center.clone().addScaledVector(direction, -distance / 2);
      const to = center.clone().addScaledVector(direction, distance / 2);
      const ahead = direction
        .multiplyScalar(12)
        .add(new THREE.Vector3(0, 1.3, 0));
      return {
        kind: "pan",
        from,
        to,
        focusFrom: from.clone().add(ahead),
        focusTo: to.clone().add(ahead),
      };
    }
    const center = new THREE.Vector3(0, this.roof * 0.28, 0);
    let radius = Math.max(
      24,
      Math.hypot(this.layout.width, this.layout.depth) * 0.55,
    );
    if (kind === "building") {
      const building = this.choose(this.layout.buildings);
      center.set(building.x, building.height * 0.65, building.z);
      radius = Math.max(18, Math.hypot(building.width, building.depth) * 0.9);
    }
    const angle = this.rng() * Math.PI * 2;
    const sweep = (this.rng() < 0.5 ? -1 : 1) * 0.35;
    const height =
      kind === "building"
        ? Math.max(
            center.y + radius * 0.55,
            this.orbitClearance(center, radius, angle, sweep),
          )
        : this.roof + Math.max(12, radius * 0.3);
    return { kind: "orbit", center, radius, height, angle, sweep };
  }

  private orbitClearance(
    center: THREE.Vector3,
    radius: number,
    angle: number,
    sweep: number,
  ) {
    const low = Math.min(angle, angle + sweep),
      high = Math.max(angle, angle + sweep);
    const angles = [low, high];
    // Include extrema so the bounds contain the entire arc, not just its endpoints.
    for (
      let quarter = Math.ceil(low / (Math.PI / 2));
      quarter <= Math.floor(high / (Math.PI / 2));
      quarter++
    )
      angles.push((quarter * Math.PI) / 2);
    const bounds = new THREE.Box2();
    for (const value of angles)
      bounds.expandByPoint(
        new THREE.Vector2(
          center.x + Math.cos(value) * radius,
          center.z + Math.sin(value) * radius,
        ),
      );
    bounds.expandByScalar(2);
    let height = 0;
    for (const building of this.layout.buildings)
      if (
        building.x + building.width / 2 >= bounds.min.x &&
        building.x - building.width / 2 <= bounds.max.x &&
        building.z + building.depth / 2 >= bounds.min.y &&
        building.z - building.depth / 2 <= bounds.max.y
      )
        height = Math.max(height, building.height + 4);
    return height;
  }

  private sample(t: number) {
    const shot = this.shot!;
    if (shot.kind === "pan") {
      this.position.lerpVectors(shot.from, shot.to, t);
      this.focus.lerpVectors(shot.focusFrom, shot.focusTo, t);
    } else if (shot.kind === "orbit") {
      const angle = shot.angle + shot.sweep * t;
      this.position.set(
        shot.center.x + Math.cos(angle) * shot.radius,
        shot.height,
        shot.center.z + Math.sin(angle) * shot.radius,
      );
      this.focus.copy(shot.center);
    } else {
      shot.ship.getWorldPosition(this.focus);
      this.position.copy(this.focus).add(shot.offset);
      this.position.y = Math.max(this.position.y, this.roof + 8);
    }
  }
}
