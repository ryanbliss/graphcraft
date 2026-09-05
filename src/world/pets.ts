import * as THREE from "three";
import { hash } from "../graph/types.ts";
import {
  random,
  type Building,
  type Room,
  type WorldLayout,
} from "./layout.ts";
import { CollisionWorld, type Collider, type Vec3 } from "./physics.ts";
import { createPet } from "./pet-models.ts";
import {
  animationCatalog,
  type PetAnimation,
  type PetSpecies,
} from "./pet-animations.ts";

type PetModel = ReturnType<typeof createPet>;
type Actor = {
  model: PetModel;
  species: PetSpecies;
  home?: Building;
  clip: PetAnimation;
  time: number;
  rng: () => number;
  state: "idle" | "follow" | "approach" | "jump" | "rest" | "return" | "home";
  goal?: THREE.Vector3;
  jumpFrom?: THREE.Vector3;
  jumpTime: number;
  dismount?: THREE.Vector3;
  returnTo?: THREE.Vector3;
  approachRoute?: THREE.Vector3[];
  landing: "furniture" | "ground";
  following: number;
  pause: number;
  routeHome: THREE.Vector3[];
  returningHome: boolean;
  distance: number;
  blocked: boolean;
};

/** Follow the route the player actually walked, including doorways and stairs. */
export class PetTrail {
  readonly points: THREE.Vector3[] = [];
  private last?: THREE.Vector3;
  record(eye: Vec3): boolean {
    const feet = new THREE.Vector3(eye.x, eye.y - 1.75, eye.z);
    if (this.last && this.last.distanceTo(feet) > 12) {
      this.clear();
      this.last = feet;
      return false;
    }
    if (!this.last || this.last.distanceTo(feet) > 0.4) {
      this.points.push(feet);
      this.last = feet;
      if (this.points.length > 512) this.points.shift();
    }
    return true;
  }
  clear() {
    this.points.length = 0;
    this.last = undefined;
  }
}

export class Pets {
  private actors: Actor[] = [];
  private companion?: Actor;
  private trail = new PetTrail();
  private refresh = 0;
  private decision = 0;
  private still = 0;
  private lastPlayer = new THREE.Vector3();
  private feet = new THREE.Vector3();
  private root = new THREE.Group();
  private surfaces = new CollisionWorld();
  private surfaceBuildings = new Map<Collider, Building>();
  private walkClips = new Map<PetSpecies, PetAnimation>();

  constructor(
    private layout: WorldLayout,
    private collisions: CollisionWorld,
    scene: THREE.Scene,
  ) {
    this.root.name = "Neighborhood pets";
    for (const path of layout.paths)
      for (let index = 1; index < path.points.length; index++) {
        const a = path.points[index - 1],
          b = path.points[index];
        const width = Math.max(2.4, Math.abs(a.x - b.x)) + 0.6;
        const depth = Math.max(2.4, Math.abs(a.z - b.z)) + 0.6;
        this.surfaces.add({
          minX: (a.x + b.x - width) / 2,
          maxX: (a.x + b.x + width) / 2,
          minZ: (a.z + b.z - depth) / 2,
          maxZ: (a.z + b.z + depth) / 2,
          minY: 0,
          maxY: 0.14,
        });
      }
    for (const building of layout.buildings) {
      const bounds = {
        minX: building.x - building.width / 2,
        maxX: building.x + building.width / 2,
        minZ: building.z - building.depth / 2,
        maxZ: building.z + building.depth / 2,
        minY: 0,
        maxY: building.stories * 5.4,
      };
      this.surfaces.add(bounds);
      this.surfaceBuildings.set(bounds, building);
    }
    for (const species of ["cat", "dog"] as const) {
      const walk = animationCatalog.find(
        (clip) => clip.species === species && clip.tags.includes("follow"),
      );
      if (!walk) throw new Error(`Missing ${species} walking animation`);
      this.walkClips.set(species, walk);
    }
    const species: PetSpecies[] = ["cat", "dog", "cat", "dog"];
    for (
      let i = 0;
      i < Math.min(species.length, layout.buildings.length);
      i++
    ) {
      const model = createPet(species[i], hash(`city-pet:${i}`));
      model.group.visible = false;
      model.group.traverse((object) => {
        object.raycast = () => {};
      });
      this.root.add(model.group);
      const actor: Actor = {
        model,
        species: species[i],
        clip: this.walkClips.get(species[i])!,
        time: 0,
        rng: random(hash(`pet-behavior:${i}`)),
        state: "idle",
        jumpTime: 0,
        landing: "ground",
        following: 0,
        pause: 0,
        routeHome: [],
        returningHome: false,
        distance: 0,
        blocked: false,
      };
      this.chooseAnimation(actor, "idle");
      this.actors.push(actor);
    }
    scene.add(this.root);
  }

  update(
    dt: number,
    camera: THREE.Vector3,
    player: { position: Vec3; grounded: boolean; active: boolean },
  ) {
    const step = Math.min(0.08, Math.max(0, dt));
    this.refresh -= step;
    this.decision -= step;
    const reviewTrail = this.decision <= 0;
    this.feet.set(
      player.position.x,
      player.position.y - 1.75,
      player.position.z,
    );
    if (this.refresh <= 0) {
      this.refresh = 2;
      this.populate(camera);
    }
    if (player.active && player.grounded) {
      this.still =
        this.lastPlayer.distanceTo(this.feet) < 0.025 ? this.still + step : 0;
      this.lastPlayer.copy(this.feet);
      if (!this.trail.record(player.position)) this.release();
      if (
        this.companion?.home &&
        !this.insideHome(this.companion.home, this.feet)
      )
        this.release();
      if (!this.companion && this.decision <= 0) {
        const pet = this.actors.find(
          (actor) =>
            actor.model.group.visible &&
            !actor.returningHome &&
            actor.home &&
            this.insideHome(actor.home, this.feet) &&
            actor.model.group.position.distanceTo(this.feet) < 9 &&
            this.clearPath(actor.model.group.position, this.feet),
        );
        if (pet) {
          this.companion = pet;
          pet.state = "follow";
          this.trail.clear();
          this.trail.record(player.position);
        }
      }
    } else this.still = 0;
    if (this.decision <= 0) {
      this.decision = 0.2;
      if (
        this.companion &&
        player.active &&
        this.still > 2.5 &&
        this.companion.state === "follow"
      )
        this.seekFurniture(this.companion);
    }
    for (const actor of this.actors) {
      if (!actor.model.group.visible) continue;
      let walking = false;
      const before = actor.model.group.position.clone();
      const beforeHeading = actor.model.group.rotation.y;
      if (
        (actor === this.companion && player.active && player.grounded) ||
        actor.returningHome
      ) {
        if (
          actor.state === "rest" &&
          !actor.returningHome &&
          actor.model.group.position.distanceTo(this.feet) > 6
        ) {
          actor.state = actor.species === "dog" ? "follow" : "jump";
          actor.jumpFrom = actor.model.group.position.clone();
          actor.goal = actor.dismount?.clone() ?? this.feet.clone();
          actor.jumpTime = 0;
          actor.landing = "ground";
          if (actor.species === "dog") this.rejoinTrail(actor);
          else this.chooseJumpAnimation(actor);
        }
        if (actor.state === "follow") {
          const first = this.trail.points[0];
          if (
            reviewTrail &&
            first &&
            (actor.blocked ||
              first.distanceTo(this.feet) >
                actor.model.group.position.distanceTo(this.feet) + 0.4)
          )
            this.rejoinTrail(actor);
          const target = this.trail.points[0];
          actor.pause = Math.max(0, actor.pause - step);
          if (
            target &&
            actor.pause === 0 &&
            (actor.model.group.position.distanceTo(this.feet) > 3.5 ||
              (!this.sameRoom(actor) &&
                actor.model.group.position.distanceTo(this.feet) > 1.6))
          ) {
            walking = true;
            actor.following += step;
            if (
              this.move(
                actor,
                target,
                step,
                actor.model.group.position.distanceTo(this.feet) > 6
                  ? 3.8
                  : 1.7,
              )
            )
              this.trail.points.shift();
            if (
              actor.following > 4.5 &&
              actor.model.group.position.distanceTo(this.feet) < 4.5 &&
              this.sameRoom(actor)
            ) {
              actor.following = 0;
              actor.pause = 1.2 + actor.rng() * 1.8;
              walking = false;
              this.chooseAnimation(actor, actor.rng() < 0.25 ? "play" : "idle");
            }
          }
        } else if (actor.state === "home") {
          const target = actor.routeHome.at(-1);
          if (target) {
            walking = true;
            if (this.move(actor, target, step, 1.7)) actor.routeHome.pop();
          } else {
            actor.state = "idle";
            actor.returningHome = false;
            actor.routeHome.push(actor.model.group.position.clone());
            this.chooseAnimation(actor, "idle");
          }
        } else if (actor.state === "approach" && actor.goal) {
          const approach = actor.approachRoute?.[0] ?? actor.jumpFrom!;
          walking = true;
          if (this.move(actor, approach, step, 1.7)) {
            actor.approachRoute?.shift();
            if (!actor.approachRoute?.length) {
              actor.state = "jump";
              actor.jumpFrom = actor.model.group.position.clone();
              actor.jumpTime = 0;
              actor.landing = "furniture";
              this.chooseJumpAnimation(actor);
            }
          }
        } else if (actor.state === "return" && actor.returnTo) {
          walking = true;
          if (this.move(actor, actor.returnTo, step, 1.7)) {
            this.rejoinTrail(actor);
            actor.state = "follow";
          }
        } else if (actor.state === "jump" && actor.goal && actor.jumpFrom) {
          actor.jumpTime += step;
          const t = Math.min(1, actor.jumpTime / 1.1);
          actor.model.group.position.lerpVectors(actor.jumpFrom, actor.goal, t);
          actor.model.group.position.y += Math.sin(t * Math.PI) * 0.65;
          if (t === 1) {
            if (actor.landing === "furniture") {
              actor.state = "rest";
              if (actor.returningHome) this.startDismount(actor);
              else this.chooseAnimation(actor, "rest");
              if (actor.species === "cat" && !actor.returningHome) {
                actor.clip = animationCatalog.find(
                  (clip) => clip.name === "cat-curl",
                )!;
                actor.time = 0;
              }
            } else {
              actor.state = actor.returningHome
                ? "home"
                : this.rejoinTrail(actor)
                  ? "follow"
                  : "return";
              this.chooseAnimation(actor, "follow");
            }
          }
        }
      }
      if (actor.state !== "jump")
        this.placeOnGround(actor.model.group.position);
      const traveled = Math.hypot(
        actor.model.group.position.x - before.x,
        actor.model.group.position.z - before.z,
      );
      const speed = step ? traveled / step : 0;
      const turn = step
        ? (actor.model.group.rotation.y - beforeHeading) / step
        : 0;
      actor.distance += traveled;
      walking = walking && speed > 0.02;
      if (walking && !actor.returningHome) this.recordHome(actor);
      if (
        !walking &&
        actor.state !== "jump" &&
        actor.clip.tags.includes("follow")
      )
        this.chooseAnimation(actor, "idle");
      if (
        actor.state !== "jump" &&
        walking &&
        (!actor.clip.tags.includes("follow") ||
          actor.time >= actor.clip.duration)
      ) {
        this.chooseAnimation(actor, "follow");
      } else if (
        actor.state !== "jump" &&
        !walking &&
        actor.time >= actor.clip.duration
      ) {
        let tag: PetAnimation["tags"][number] = "idle";
        if (actor.state === "rest") {
          tag = "rest";
        } else {
          const mood = actor.rng();
          if (mood < 0.3) tag = "play";
          else if (mood < 0.45) tag = "rest";
        }
        this.chooseAnimation(actor, tag);
      }
      actor.time += step;
      actor.model.animate(
        actor.clip,
        actor.time,
        walking || Math.abs(turn) > 0.05
          ? { distance: actor.distance, speed, turn }
          : undefined,
      );
    }
  }

  private populate(camera: THREE.Vector3) {
    const candidates: { building: Building; distance: number }[] = [];
    for (const building of this.layout.buildings) {
      const distance = Math.hypot(
        building.x - camera.x,
        building.z + building.depth / 2 - camera.z,
      );
      if (distance > 150) continue;
      candidates.push({ building, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const occupied = new Set(
      this.actors
        .filter(
          (actor) =>
            actor.home &&
            (actor === this.companion ||
              actor.model.group.position.distanceTo(camera) < 100),
        )
        .map((actor) => actor.home!.id),
    );
    for (const actor of this.actors) {
      if (actor === this.companion || actor.returningHome) continue;
      if (actor.home && actor.model.group.position.distanceTo(camera) < 100)
        continue;
      const next = candidates.find(
        (candidate) => !occupied.has(candidate.building.id),
      );
      if (!next) {
        actor.model.group.visible = false;
        actor.home = undefined;
        continue;
      }
      actor.home = next.building;
      occupied.add(next.building.id);
      actor.model.group.position.set(
        next.building.x + (actor.species === "dog" ? -1.35 : 1.35),
        0.05,
        next.building.z + next.building.depth / 2 + 2,
      );
      actor.model.group.rotation.y = Math.PI;
      actor.model.group.visible = true;
      actor.state = "idle";
      this.placeOnGround(actor.model.group.position);
      actor.routeHome = [actor.model.group.position.clone()];
      this.chooseAnimation(actor, "idle");
    }
  }

  private clearPath(a: THREE.Vector3, b: THREE.Vector3) {
    const length = a.distanceTo(b);
    if (Math.abs(a.y - b.y) > 0.5) return false;
    for (let t = 0; t <= length; t += 0.35) {
      const point = a.clone().lerp(b, length ? t / length : 0);
      if (this.occupied(point)) return false;
    }
    return true;
  }

  private move(actor: Actor, target: THREE.Vector3, dt: number, speed: number) {
    const point = actor.model.group.position;
    const destination = target.clone();
    this.placeOnGround(destination);
    const delta = destination.clone().sub(point),
      distance = delta.length();
    const angle = Math.atan2(delta.x, delta.z);
    const turn = Math.atan2(
      Math.sin(angle - actor.model.group.rotation.y),
      Math.cos(angle - actor.model.group.rotation.y),
    );
    const rotationStep = Math.max(-dt * 2.2, Math.min(dt * 2.2, turn));
    actor.model.group.rotation.y += rotationStep;
    if (distance > 0.08 && Math.abs(turn - rotationStep) > 0.5) return false;
    const next = point
      .clone()
      .addScaledVector(
        delta,
        distance ? Math.min(1, (speed * dt) / distance) : 0,
      );
    for (const box of this.collisions.nearby(next)) {
      if (!this.overlaps(next, box)) continue;
      if (
        box.maxY <= destination.y + 0.08 &&
        box.maxY >= point.y &&
        box.maxY - point.y <= 0.34
      )
        next.y = Math.max(next.y, box.maxY);
    }
    if (this.occupied(next)) {
      actor.blocked = true;
      return false;
    }
    actor.blocked = false;
    point.copy(next);
    return distance <= speed * dt;
  }

  private overlaps(point: Vec3, box: Collider) {
    const dx = Math.max(box.minX, Math.min(point.x, box.maxX)) - point.x;
    const dz = Math.max(box.minZ, Math.min(point.z, box.maxZ)) - point.z;
    return (
      dx * dx + dz * dz < 0.205 ** 2 &&
      point.y + 0.68 > box.minY &&
      point.y + 0.06 < box.maxY
    );
  }

  private occupied(point: Vec3) {
    for (const box of this.collisions.nearby(point))
      if (this.overlaps(point, box)) return true;
    return false;
  }

  private sameRoom(actor: Actor) {
    const roomAt = (point: Vec3) =>
      actor.home?.rooms.find(
        (room) =>
          Math.abs(point.y - room.floorY) < 0.5 &&
          Math.abs(room.x - point.x) < room.width / 2 &&
          Math.abs(room.z - point.z) < room.depth / 2,
      );
    return roomAt(actor.model.group.position) === roomAt(this.feet);
  }

  private insideHome(home: Building, point: Vec3) {
    return (
      Math.abs(point.x - home.x) < home.width / 2 &&
      Math.abs(point.z - home.z) < home.depth / 2
    );
  }

  private placeOnGround(point: THREE.Vector3) {
    let path = false;
    let home: Building | undefined;
    for (const surface of this.surfaces.nearby(point)) {
      if (
        point.x < surface.minX ||
        point.x > surface.maxX ||
        point.z < surface.minZ ||
        point.z > surface.maxZ
      )
        continue;
      const building = this.surfaceBuildings.get(surface);
      if (building) home = building;
      else path = true;
    }
    if (!home) {
      if (point.y >= -0.05 && point.y <= 0.2) point.y = path ? 0.14 : 0;
      return;
    }
    const floor = Math.round(point.y / 5.4) * 5.4;
    if (Math.abs(point.y - floor) > 0.2) return;
    point.y = floor + 0.04;
  }

  private recordHome(actor: Actor) {
    const point = actor.model.group.position;
    if ((actor.routeHome.at(-1)?.distanceTo(point) ?? Infinity) < 0.35) return;
    const visited = actor.routeHome.findIndex(
      (old) => old.distanceTo(point) < 0.35,
    );
    if (visited >= 0) actor.routeHome.splice(visited + 1);
    else actor.routeHome.push(point.clone());
  }

  private startDismount(actor: Actor) {
    actor.state = "jump";
    actor.jumpFrom = actor.model.group.position.clone();
    actor.goal =
      actor.dismount?.clone() ??
      actor.returnTo?.clone() ??
      actor.routeHome.at(-1)?.clone();
    actor.jumpTime = 0;
    actor.landing = "ground";
    this.chooseJumpAnimation(actor);
  }

  private seekFurniture(actor: Actor) {
    if (actor.species === "dog") {
      actor.state = "rest";
      this.chooseAnimation(actor, "rest");
      return;
    }
    let room: Room | undefined;
    for (const building of this.layout.buildings) {
      if (
        Math.abs(building.x - this.feet.x) > building.width / 2 ||
        Math.abs(building.z - this.feet.z) > building.depth / 2
      )
        continue;
      room = building.rooms.find(
        (room) =>
          Math.abs(room.floorY - this.feet.y) < 0.4 &&
          Math.abs(room.x - this.feet.x) < room.width / 2 &&
          Math.abs(room.z - this.feet.z) < room.depth / 2,
      );
      if (room) break;
    }
    if (!room || actor.model.group.position.distanceTo(this.feet) > 5) return;
    for (const id of room.nodeIds) {
      const p = this.layout.positions.get(id);
      if (!p) continue;
      if (p.furniture !== "bed") continue;
      const height = 0.8;
      const offset = 2.5;
      const approach = new THREE.Vector3(
        p.x + Math.sin(p.rotation) * offset,
        p.floorY,
        p.z + Math.cos(p.rotation) * offset,
      );
      let route = [approach];
      if (!this.clearPath(actor.model.group.position, approach)) {
        const connection = this.trail.points.findIndex((point) =>
          this.clearPath(point, approach),
        );
        if (connection < 0) continue;
        const first = this.trail.points[0];
        if (!first || !this.clearPath(actor.model.group.position, first))
          continue;
        route = [
          ...this.trail.points
            .slice(0, connection + 1)
            .map((point) => point.clone()),
          approach,
        ];
      }
      actor.approachRoute = route;
      actor.returnTo = actor.model.group.position.clone();
      actor.dismount = approach.clone();
      actor.jumpFrom = approach;
      const dz = 0.16;
      actor.goal = new THREE.Vector3(
        p.x + Math.sin(p.rotation) * dz,
        p.floorY + height,
        p.z + Math.cos(p.rotation) * dz,
      );
      actor.state = "approach";
      return;
    }
  }

  private chooseJumpAnimation(actor: Actor) {
    actor.clip = animationCatalog.find((clip) => clip.name === "cat-jump")!;
    actor.time = 0;
  }

  private rejoinTrail(actor: Actor): boolean {
    const point = actor.model.group.position;
    for (let index = this.trail.points.length - 1; index >= 0; index--) {
      const target = this.trail.points[index];
      if (point.distanceTo(target) > 12 || !this.clearPath(point, target))
        continue;
      this.trail.points.splice(0, index);
      return true;
    }
    return false;
  }

  private chooseAnimation(actor: Actor, tag: PetAnimation["tags"][number]) {
    const choices = animationCatalog.filter(
      (clip) => clip.species === actor.species && clip.tags.includes(tag),
    );
    if (!choices.length) return;
    actor.clip = choices[Math.floor(actor.rng() * choices.length)];
    actor.time = 0;
  }
  private release() {
    const actor = this.companion;
    if (actor) {
      actor.returningHome = true;
      actor.pause = 0;
      if (actor.state === "rest" && actor.species !== "dog")
        this.startDismount(actor);
      else if (actor.state !== "jump") actor.state = "home";
    }
    this.companion = undefined;
    this.trail.clear();
  }
  dispose() {
    this.root.removeFromParent();
    for (const actor of this.actors) actor.model.dispose();
  }
}
