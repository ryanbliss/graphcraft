import * as THREE from "three";
import { withNeonFlicker } from "./neon-flicker.ts";
import {
  neutralPetPose,
  samplePetAnimation,
  type PetAnimation,
  type PetSpecies,
} from "./pet-animations.ts";

export type { PetSpecies } from "./pet-animations.ts";
export interface PetModel {
  group: THREE.Group;
  animate(
    clip: PetAnimation,
    time: number,
    locomotion?: { distance: number; speed: number; turn?: number },
  ): void;
  dispose(): void;
}
type Triple = [number, number, number];
const coats = [
  "#ffc0dc",
  "#a7dcff",
  "#b9afff",
  "#ffe0a0",
  "#9ee6cf",
  "#faf0ee",
];
const accents = [
  "#ff4caf",
  "#59e9ff",
  "#bf7aff",
  "#ffab56",
  "#52ffd4",
  "#fb7aca",
];

/** Articulated pets face +Z; navigation owns the outer group transform. */
export function createPet(species: PetSpecies, seed: number): PetModel {
  const group = new THREE.Group();
  group.name = `Cyber ${species}`;
  group.scale.setScalar(0.585);
  const variant = Math.abs(Math.trunc(seed)) % coats.length;
  const coat = new THREE.MeshStandardMaterial({
    color: coats[variant],
    roughness: 0.88,
    metalness: 0.02,
  });
  const panel = new THREE.MeshStandardMaterial({
    color: accents[variant],
    roughness: 0.76,
    metalness: 0.08,
  });
  const cream = new THREE.MeshStandardMaterial({
    color: "#fff1ed",
    roughness: 0.6,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#18233a",
    roughness: 0.2,
    metalness: 0.3,
  });
  const pink = new THREE.MeshStandardMaterial({
    color: "#ff8bab",
    roughness: 0.6,
  });
  const neon = withNeonFlicker(
    new THREE.MeshBasicMaterial({
      color: variant % 2 === 0 ? "#59ecff" : "#ff70d0",
      toneMapped: false,
    }),
    { seed },
  );
  const glint = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 4);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const materials = [coat, panel, cream, dark, pink, neon, glint];
  const geometries = [sphere, box, cone, cylinder];
  const parts: THREE.Mesh[] = [];
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: Triple,
    scale: Triple,
    rotation?: Triple,
  ) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.scale.set(...scale);
    if (rotation) object.rotation.set(...rotation);
    parent.add(object);
    parts.push(object);
    return object;
  }
  function joint(parent: THREE.Object3D, name: string, position: Triple) {
    const object = new THREE.Group();
    object.name = name;
    object.position.set(...position);
    parent.add(object);
    return object;
  }
  const dog = species === "dog";
  const bodyHeight = dog ? 0.6 : 0.5;
  const body = joint(group, "body", [0, bodyHeight, 0]);
  const head = joint(body, "head", [0, 0.22, 0.4]);
  const tail = joint(body, "tail", [0, 0.02, -0.39]);
  const tailTip = joint(tail, "tail-tip", [0, 0, -0.29]);
  const ears = [-1, 1].map((side) =>
    joint(head, side < 0 ? "ear-left" : "ear-right", [side * 0.19, 0.16, 0]),
  );
  const front = [-1, 1].map((side) =>
    joint(body, side < 0 ? "front-left" : "front-right", [
      side * 0.19,
      -0.12,
      0.27,
    ]),
  );
  const back = [-1, 1].map((side) =>
    joint(body, side < 0 ? "back-left" : "back-right", [
      side * 0.19,
      -0.12,
      -0.27,
    ]),
  );
  const eyes: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const paws: THREE.Group[] = [];

  mesh(
    body,
    sphere,
    coat,
    [0, 0, 0],
    [dog ? 0.29 : 0.245, dog ? 0.26 : 0.23, 0.45],
  );
  mesh(body, sphere, cream, [0, -0.085, 0.22], [0.19, 0.16, 0.2]);
  mesh(head, sphere, coat, [0, 0, 0], [dog ? 0.29 : 0.28, 0.25, 0.245]);
  for (const side of [-1, 1]) {
    const eye = joint(head, side < 0 ? "eye-left" : "eye-right", [
      side * 0.105,
      0.04,
      0.226,
    ]);
    eyes.push(eye);
    mesh(eye, sphere, dark, [0, 0, 0], [0.043, 0.054, 0.019]);
    mesh(eye, sphere, glint, [-0.012, 0.017, 0.017], [0.01, 0.012, 0.004]);
    mesh(body, box, panel, [side * 0.225, 0.04, -0.08], [0.027, 0.105, 0.3]);
    mesh(body, box, neon, [side * 0.243, 0.04, -0.08], [0.014, 0.025, 0.21]);
  }

  const legLength = dog ? 0.46 : 0.36;
  for (const leg of [...front, ...back]) {
    mesh(
      leg,
      sphere,
      coat,
      [0, -legLength / 4, 0],
      [dog ? 0.09 : 0.073, legLength / 4 + 0.018, 0.075],
    );
    const knee = joint(leg, "knee", [0, -legLength / 2, 0]);
    knees.push(knee);
    mesh(
      knee,
      sphere,
      coat,
      [0, -legLength / 4, 0],
      [dog ? 0.078 : 0.065, legLength / 4 + 0.014, 0.068],
    );
    const paw = joint(knee, "paw", [0, -legLength / 2, 0]);
    paws.push(paw);
    mesh(
      paw,
      sphere,
      cream,
      [0, 0.045, 0.028],
      [dog ? 0.112 : 0.092, 0.067, 0.113],
    );
    mesh(paw, box, neon, [0, 0.091, 0.081], [0.07, 0.015, 0.014]);
  }
  mesh(
    body,
    cylinder,
    dark,
    [0, 0.06, 0.29],
    [0.26, 0.075, 0.25],
    [Math.PI / 2, 0, 0],
  );
  mesh(body, sphere, neon, [0, -0.14, 0.34], [0.055, 0.061, 0.023]);
  const nose = mesh(
    head,
    sphere,
    dark,
    [0, -0.052, 0.244],
    [dog ? 0.035 : 0.029, dog ? 0.026 : 0.021, 0.018],
  );
  nose.name = "nose";
  const mouth = mesh(
    head,
    sphere,
    dark,
    [0, -0.092, 0.23],
    [0.032, 0.004, 0.006],
  );
  mouth.name = "closed-mouth";

  for (const [index, side] of [-1, 1].entries()) {
    if (dog) {
      mesh(
        ears[index],
        sphere,
        panel,
        [side * 0.047, -0.13, -0.035],
        [0.106, 0.25, 0.078],
        [0.1, 0, side * 0.18],
      );
      mesh(
        ears[index],
        sphere,
        neon,
        [side * 0.074, -0.29, 0.012],
        [0.069, 0.043, 0.017],
      );
    } else {
      mesh(
        ears[index],
        cone,
        coat,
        [0, 0.075, -0.015],
        [0.13, 0.25, 0.1],
        [0, Math.PI / 4, -side * 0.15],
      );
      mesh(
        ears[index],
        cone,
        pink,
        [0, 0.075, 0.04],
        [0.065, 0.155, 0.025],
        [0, Math.PI / 4, -side * 0.15],
      );
      mesh(
        ears[index],
        sphere,
        neon,
        [side * 0.012, 0.173, 0.014],
        [0.012, 0.014, 0.012],
      );
    }
  }
  mesh(tail, sphere, coat, [0, 0, -0.15], [dog ? 0.085 : 0.058, 0.057, 0.2]);
  mesh(
    tailTip,
    sphere,
    panel,
    [0, 0, -0.13],
    [dog ? 0.09 : 0.055, 0.057, 0.19],
  );
  mesh(
    tailTip,
    sphere,
    neon,
    [0, 0, -0.29],
    [dog ? 0.058 : 0.042, 0.047, 0.049],
  );

  const pose = { ...neutralPetPose };
  const targetPose = { ...neutralPetPose };
  const transitionPose = { ...neutralPetPose };
  const channels = Object.keys(pose) as (keyof typeof pose)[];
  const legs = [...front, ...back];
  let previousClip: PetAnimation | undefined;
  let transitionStart = 0;
  let disposed = false;
  let faceTime = (Math.abs(seed) % 97) / 19;
  let previousTime = 0;
  let locomotionBlend = 0;
  let traveledDistance = 0;
  let turnDistance = 0;
  let turnBlend = 0;
  const blinkPeriod = 3.7 + (Math.abs(seed) % 23) / 10;
  return {
    group,
    animate(clip, time, locomotion) {
      if (clip.species !== species)
        throw new Error(`Cannot animate ${species} with ${clip.name}.`);
      if (!Number.isFinite(time))
        throw new Error("Pet animation time must be finite.");
      const initialFrame = previousClip === undefined;
      const frameStep =
        clip === previousClip
          ? Math.min(0.1, Math.max(0, time - previousTime))
          : 1 / 60;
      faceTime += frameStep;
      const moving = locomotion !== undefined && locomotion.speed > 0.02;
      const turning = Math.abs(locomotion?.turn ?? 0) > 0.04;
      const stepping = moving || turning;
      if (moving) traveledDistance = locomotion.distance;
      if (turning)
        turnDistance += Math.abs(locomotion?.turn ?? 0) * frameStep * 0.22;
      if (stepping) {
        const target = moving ? 0 : 1;
        turnBlend += THREE.MathUtils.clamp(
          target - turnBlend,
          -frameStep / 0.25,
          frameStep / 0.25,
        );
      }
      if (initialFrame) {
        locomotionBlend = Number(stepping);
        turnBlend = Number(turning && !moving);
      } else {
        const duration = stepping ? 0.25 : 0.35;
        locomotionBlend += THREE.MathUtils.clamp(
          Number(stepping) - locomotionBlend,
          -frameStep / duration,
          frameStep / duration,
        );
      }
      previousTime = time;
      if (clip !== previousClip) {
        Object.assign(transitionPose, pose);
        transitionStart = previousClip ? time : time - 0.3;
        previousClip = clip;
      }
      samplePetAnimation(clip, time, targetPose);
      const blend = Math.max(0, Math.min(1, (time - transitionStart) / 0.3));
      const eased = blend * blend * (3 - 2 * blend);
      for (const channel of channels)
        pose[channel] =
          transitionPose[channel] +
          (targetPose[channel] - transitionPose[channel]) * eased;
      body.position.y = bodyHeight + pose.lift;
      body.rotation.set(pose.lean, pose.turn, pose.roll);
      head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);
      tail.rotation.set(pose.tail, pose.tailYaw, 0);
      tailTip.rotation.set(0, pose.tailTip, 0);
      ears[0].rotation.set(0, 0, pose.earLeft);
      ears[1].rotation.set(0, 0, pose.earRight);
      front[0].rotation.set(pose.frontLeft, 0, 0);
      front[1].rotation.set(pose.frontRight, 0, 0);
      back[0].rotation.set(pose.backLeft, 0, 0);
      back[1].rotation.set(pose.backRight, 0, 0);
      const legLength = dog ? 0.46 : 0.36;
      for (const leg of legs)
        leg.scale.y = Math.max(0.3, 1 + pose.lift / legLength);
      const blinkPhase = faceTime % blinkPeriod;
      let blink = 0;
      if (blinkPhase < 0.085)
        blink = Math.sin(((blinkPhase / 0.085) * Math.PI) / 2);
      else if (blinkPhase < 0.12) blink = 1;
      else if (blinkPhase < 0.29)
        blink = Math.cos((((blinkPhase - 0.12) / 0.17) * Math.PI) / 2);
      for (const eye of eyes) {
        eye.scale.y = Math.max(0.055, 1 - Math.max(blink, pose.blink));
        eye.rotation.y = Math.sin(faceTime * 0.42) * 0.035;
      }
      head.rotation.y += Math.sin(faceTime * 0.47) * 0.045;
      head.rotation.z += Math.sin(faceTime * 0.33 + variant) * 0.025;
      for (const knee of knees) knee.rotation.x = 0;
      for (const paw of paws) paw.rotation.x = 0;
      if (locomotionBlend > 0) {
        const stroke = dog ? 0.48 : 0.4;
        const cycle = traveledDistance / ((stroke * group.scale.x) / 0.6);
        const turnCycle = turnDistance / ((stroke * group.scale.x) / 0.6);
        body.position.y = THREE.MathUtils.lerp(
          body.position.y,
          bodyHeight - 0.075,
          locomotionBlend,
        );
        body.rotation.x *= 1 - locomotionBlend;
        body.rotation.y *= 1 - locomotionBlend;
        body.rotation.z *= 1 - locomotionBlend;
        head.rotation.set(
          THREE.MathUtils.lerp(head.rotation.x, -0.04, locomotionBlend),
          head.rotation.y * (1 - locomotionBlend),
          THREE.MathUtils.lerp(
            head.rotation.z,
            Math.sin(cycle * Math.PI * 2) * 0.018,
            locomotionBlend,
          ),
        );
        for (const [index, leg] of legs.entries()) {
          const phase = (cycle + [0, 0.5, 0.5, 0][index]) % 1;
          const stance = phase < 0.6;
          const swing = (phase - 0.6) / 0.4;
          const walkingZ = stance
            ? stroke * (0.5 - phase / 0.6)
            : stroke * (-0.5 + swing * swing * (3 - 2 * swing));
          const walkingLift = stance ? 0 : Math.sin(swing * Math.PI) * 0.085;
          const turnPhase = (turnCycle + [0, 0.5, 0.5, 0][index]) % 1;
          const turnSwing = (turnPhase - 0.6) / 0.4;
          const turningZ =
            turnPhase < 0.6
              ? stroke * 0.04 * (0.5 - turnPhase / 0.6)
              : stroke *
                0.04 *
                (-0.5 + turnSwing * turnSwing * (3 - 2 * turnSwing));
          const turningLift =
            turnPhase < 0.6 ? 0 : Math.sin(turnSwing * Math.PI) * 0.06;
          const z = THREE.MathUtils.lerp(walkingZ, turningZ, turnBlend);
          const footLift = THREE.MathUtils.lerp(
            walkingLift,
            turningLift,
            turnBlend,
          );
          const y = -(bodyHeight - 0.075 - 0.12 - 0.022) + footLift;
          const reach = Math.min(legLength - 0.001, Math.hypot(y, z));
          const bend = Math.acos(reach / legLength);
          const hip = Math.atan2(-z, -y) - bend;
          leg.scale.y = THREE.MathUtils.lerp(leg.scale.y, 1, locomotionBlend);
          leg.rotation.x = THREE.MathUtils.lerp(
            leg.rotation.x,
            hip,
            locomotionBlend,
          );
          knees[index].rotation.x = bend * 2 * locomotionBlend;
          paws[index].rotation.x = (-hip - bend * 2) * locomotionBlend;
        }
        tail.rotation.x = THREE.MathUtils.lerp(
          tail.rotation.x,
          dog ? 0.45 : 0.8,
          locomotionBlend,
        );
        tail.rotation.y = THREE.MathUtils.lerp(
          tail.rotation.y,
          Math.sin(cycle * Math.PI) * 0.12,
          locomotionBlend,
        );
      }
      // Keep every pose above its support surface, including curls and bows.
      group.updateWorldMatrix(true, true);
      let lowest = Infinity;
      for (const part of parts) {
        const m = part.matrixWorld.elements;
        let extent = Math.abs(m[1]) + Math.abs(m[5]) * 0.5 + Math.abs(m[9]);
        if (part.geometry === sphere) extent = Math.hypot(m[1], m[5], m[9]);
        else if (part.geometry === box)
          extent = (Math.abs(m[1]) + Math.abs(m[5]) + Math.abs(m[9])) * 0.5;
        lowest = Math.min(lowest, m[13] - extent);
      }
      const lift = group.matrixWorld.elements[13] - lowest;
      if (lift > 0) body.position.y += lift / group.scale.y;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
