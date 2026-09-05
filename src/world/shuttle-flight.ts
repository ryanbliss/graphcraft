import * as THREE from "three";
import { ShipWake } from "./ship-wake.ts";
import { buildParachutist } from "./parachutist.ts";
import type { PlayerPhysics, Vec3 } from "./physics.ts";
import { disposeGroup, lineGeometry } from "./geometry.ts";

export const flightDuration = 8;
const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
export function flightPosition(
  from: Vec3,
  to: Vec3,
  clearance: number,
  seconds: number,
): Vec3 {
  const t = Math.max(0, Math.min(1, seconds / flightDuration));
  const travel = smooth((t - 0.23) / 0.54);
  const lift = smooth(t / 0.23) * (1 - smooth((t - 0.77) / 0.23));
  return {
    x: from.x + (to.x - from.x) * travel,
    y: clearance * lift,
    z: from.z + (to.z - from.z) * travel,
  };
}
interface Ride {
  ship: THREE.Group;
  destinationShip?: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  arrival: { x: number; z: number };
  clearance: number;
  seconds: number;
  heading: number;
  complete: (landed: boolean) => void;
}

export class ShuttleFlight {
  private ride?: Ride;
  private wake: ShipWake;
  private canopy = new THREE.Group();
  private label = document.createElement("div");
  private descentSeconds = 0;
  private heading = 0;
  private bailoutFrom = new THREE.Vector3();
  private bailoutRotation = new THREE.Quaternion();
  private state: "idle" | "flight" | "parachute" = "idle";
  get active() {
    return this.state !== "idle";
  }
  get parachuting() {
    return this.state === "parachute";
  }
  constructor(private scene: THREE.Scene) {
    this.wake = new ShipWake(scene);
    this.label.className = "flight-hint";
    this.label.setAttribute("role", "status");
    this.label.hidden = true;
    document.body.append(this.label);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: "#66ead4",
        emissive: "#176968",
        emissiveIntensity: 0.7,
        side: THREE.DoubleSide,
        metalness: 0.4,
        roughness: 0.45,
      }),
    );
    dome.position.y = 5.2;
    this.canopy.add(dome);
    const cords: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      cords.push(
        Math.cos(a) * 3,
        5.2,
        Math.sin(a) * 3,
        (Math.cos(a) >= 0 ? 1 : -1) * 0.72,
        0.75,
        0.14,
      );
    }
    this.canopy.add(lineGeometry(cords, "#d8ffac", 0.9));
    this.canopy.add(buildParachutist());
    this.canopy.visible = false;
    this.scene.add(this.canopy);
  }
  start(
    ship: THREE.Group,
    destinationShip: THREE.Group | undefined,
    to: THREE.Vector3,
    arrival: { x: number; z: number },
    clearance: number,
  ): Promise<boolean> {
    this.cancel();
    this.state = "flight";
    this.wake.attach(ship);
    this.label.hidden = false;
    this.label.textContent = "Taking off";
    if (destinationShip && destinationShip !== ship)
      destinationShip.visible = false;
    return new Promise((complete) => {
      this.ride = {
        ship,
        destinationShip,
        from: ship.position.clone(),
        to,
        arrival,
        clearance,
        seconds: 0,
        heading: Math.atan2(to.x - ship.position.x, to.z - ship.position.z),
        complete,
      };
    });
  }
  jump(player: PlayerPhysics): boolean {
    const ride = this.ride;
    if (this.state !== "flight" || !ride || ride.ship.position.y < 8)
      return false;
    this.state = "parachute";
    this.descentSeconds = 0;
    this.heading = ride.heading;
    const p = ride.ship.position;
    player.teleport(
      p.x + Math.cos(ride.heading) * 6,
      p.z - Math.sin(ride.heading) * 6,
      p.y + 3,
    );
    player.grounded = false;
    player.velocity.y = 1;
    this.canopy.visible = true;
    this.label.textContent = "Parachute deployed · W A S D to steer";
    return true;
  }
  update(
    dt: number,
    player: PlayerPhysics,
    camera: THREE.PerspectiveCamera,
    direction: { x: number; z: number },
    bounds: { width: number; depth: number },
    look?: { yaw: number; pitch: number },
  ) {
    const ride = this.ride;
    if (ride) {
      ride.seconds += dt;
      const p = flightPosition(
        ride.from,
        ride.to,
        ride.clearance,
        ride.seconds,
      );
      ride.ship.position.set(p.x, p.y, p.z);
      ride.ship.rotation.set(
        0,
        ride.heading,
        Math.sin((ride.seconds / flightDuration) * Math.PI * 2) * 0.055,
      );
      this.wake.update(ride.ship, ride.seconds);
      if (this.state === "flight") {
        const landing = smooth((ride.seconds - 6) / 2);
        const turn = Math.atan2(
          Math.sin(Math.PI - ride.heading),
          Math.cos(Math.PI - ride.heading),
        );
        const h = ride.heading + turn * landing;
        camera.position.set(
          p.x - Math.sin(h) * (13 - landing * 10),
          p.y + 9 + landing * 5,
          p.z - Math.cos(h) * (13 - landing * 10),
        );
        camera.lookAt(
          p.x + Math.sin(h) * 5 * (1 - landing),
          p.y + 3.2,
          p.z + Math.cos(h) * 5 * (1 - landing),
        );
        this.label.textContent =
          ride.seconds < 1.8
            ? "Taking off"
            : ride.seconds > 6.2
              ? "Landing"
              : "Space to jump out";
      }
      if (ride.seconds >= flightDuration + 0.35) {
        const landed = this.state === "flight";
        if (landed) {
          player.teleport(ride.arrival.x, ride.arrival.z);
          this.state = "idle";
          this.label.hidden = true;
        }
        this.restoreShip();
        ride.complete(landed);
      }
    }
    if (this.state === "parachute") {
      if (this.descentSeconds === 0) {
        this.bailoutFrom.copy(camera.position);
        this.bailoutRotation.copy(camera.quaternion);
      }
      this.descentSeconds += dt;
      for (let remaining = dt; remaining > 0; remaining -= 1 / 120)
        player.step(
          Math.min(remaining, 1 / 120),
          direction,
          false,
          false,
          "parachute",
        );
      const p = player.position;
      p.x = Math.max(
        -bounds.width / 2 - 18,
        Math.min(bounds.width / 2 + 18, p.x),
      );
      p.z = Math.max(
        -bounds.depth / 2 - 18,
        Math.min(bounds.depth / 2 + 18, p.z),
      );
      const targetHeading = look ? look.yaw + Math.PI : this.heading;
      const turn = Math.atan2(
        Math.sin(targetHeading - this.heading),
        Math.cos(targetHeading - this.heading),
      );
      this.heading += turn * (1 - Math.exp(-10 * dt));
      this.canopy.position.set(p.x, p.y - 0.65, p.z);
      this.canopy.rotation.set(
        0,
        this.heading,
        Math.max(-0.18, Math.min(0.18, -turn * 0.3)),
      );
      this.canopy.scale.setScalar(
        0.2 + 0.8 * smooth(this.descentSeconds / 0.5),
      );
      const pitch = Math.max(-0.95, Math.min(0.1, look?.pitch ?? -0.32));
      const distance = Math.cos(pitch) * 12;
      camera.position.set(
        p.x - Math.sin(this.heading) * distance,
        p.y + 2 - Math.sin(pitch) * 12,
        p.z - Math.cos(this.heading) * distance,
      );
      camera.lookAt(p.x, p.y + 2, p.z);
      const blend = smooth(this.descentSeconds / 0.45);
      camera.position.lerpVectors(this.bailoutFrom, camera.position, blend);
      camera.quaternion.slerp(this.bailoutRotation, 1 - blend);
      if (player.grounded) this.cancel();
    }
  }
  private restoreShip() {
    this.wake.reset();
    if (!this.ride) return;
    this.ride.ship.position.copy(this.ride.from);
    this.ride.ship.rotation.set(0, 0, 0);
    if (this.ride.destinationShip) this.ride.destinationShip.visible = true;
    this.ride = undefined;
  }
  cancel() {
    const ride = this.ride;
    this.restoreShip();
    ride?.complete(false);
    this.state = "idle";
    this.canopy.visible = false;
    this.label.hidden = true;
  }
  dispose() {
    this.cancel();
    this.wake.dispose();
    this.label.remove();
    this.canopy.removeFromParent();
    disposeGroup(this.canopy);
  }
}
