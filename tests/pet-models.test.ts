import { expect, it } from "vitest";
import * as THREE from "three";
import {
  animationCatalog,
  neutralPetPose,
  samplePetAnimation,
  type PetAnimation,
  type PetSpecies,
} from "../src/world/pet-animations.ts";
import { createPet } from "../src/world/pet-models.ts";

const species: PetSpecies[] = ["cat", "dog"];
function clip(name: string) {
  const animation = animationCatalog.find(
    (candidate) => candidate.name === name,
  );
  if (!animation) throw new Error(`Missing animation ${name}.`);
  return animation;
}

it("offers 72 distinct authored clips across species and movement contexts", () => {
  expect(animationCatalog).toHaveLength(72);
  expect(
    new Set(animationCatalog.map((animation) => animation.name)).size,
  ).toBe(72);
  expect(
    new Set(
      animationCatalog.map((animation) => JSON.stringify(animation.poses)),
    ).size,
  ).toBe(72);
  for (const kind of species) {
    const animations = animationCatalog.filter(
      (animation) => animation.species === kind,
    );
    expect(animations).toHaveLength(36);
    for (const tag of ["follow", "idle", "rest", "play"])
      expect(
        animations.some((animation) =>
          animation.tags.some((value) => value === tag),
        ),
      ).toBe(true);
  }
  const pose = { ...neutralPetPose };
  for (const animation of animationCatalog) {
    expect(animation.duration).toBeGreaterThan(0);
    expect(animation.poses.length).toBeGreaterThanOrEqual(3);
    for (let sample = 0; sample < 11; sample++) {
      samplePetAnimation(animation, (animation.duration * sample) / 10, pose);
      expect(Object.values(pose).every(Number.isFinite), animation.name).toBe(
        true,
      );
    }
  }
  samplePetAnimation(clip("cat-curl"), 1, pose);
  expect(pose.tailTip).toBeGreaterThan(1);
  expect(pose.headYaw).toBeGreaterThan(1);
});

it("resets target poses and blends clip changes without moving the navigation group", () => {
  const pet = createPet("cat", 3);
  pet.group.position.set(12, 6, -5);
  pet.group.rotation.y = 0.75;
  pet.animate(clip("cat-curl"), 1);
  const tail = pet.group.getObjectByName("tail-tip")!;
  const head = pet.group.getObjectByName("head")!;
  const before = tail.rotation.y;
  const neutral: PetAnimation = {
    name: "cat-neutral",
    species: "cat",
    duration: 2,
    tags: ["idle"],
    poses: [{}, {}, {}],
  };
  pet.animate(neutral, 0);
  expect(tail.rotation.y).toBeCloseTo(before);
  pet.animate(neutral, 0.15);
  expect(tail.rotation.y).toBeCloseTo(before / 2);
  pet.animate(neutral, 0.3);
  expect(tail.rotation.y).toBe(0);
  expect(head.rotation.x).toBe(0);
  expect(Math.abs(head.rotation.y)).toBeLessThan(0.05);
  expect(Math.abs(head.rotation.z)).toBeLessThan(0.03);
  expect(pet.group.getObjectByName("eye-left")!.scale.y).toBe(1);
  expect(pet.group.position.toArray()).toEqual([12, 6, -5]);
  expect(pet.group.rotation.y).toBe(0.75);
  const reused = { ...neutralPetPose };
  samplePetAnimation(clip("cat-curl"), 1, reused);
  samplePetAnimation(neutral, 0.5, reused);
  expect(reused).toEqual(neutralPetPose);
  pet.dispose();
});

it("builds grounded articulated species with varied coats and disposes shared resources once", () => {
  for (const kind of species) {
    const pet = createPet(kind, 2);
    expect(pet.group.scale.x).toBeCloseTo(0.78 * 0.75);
    expect(pet.group.scale.y).toBe(pet.group.scale.x);
    expect(pet.group.scale.z).toBe(pet.group.scale.x);
    const bounds = new THREE.Box3().setFromObject(pet.group);
    expect(bounds.min.y, kind).toBeGreaterThanOrEqual(-0.005);
    expect(bounds.min.y, kind).toBeLessThan(0.02);
    for (const name of [
      "body",
      "head",
      "ear-left",
      "ear-right",
      "tail",
      "tail-tip",
      "front-left",
      "front-right",
      "eye-left",
      "eye-right",
      "nose",
      "closed-mouth",
    ])
      expect(pet.group.getObjectByName(name), `${kind}:${name}`).toBeDefined();
    const materials = new Set<THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>();
    pet.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(material);
      expect(object.userData.signIds).toBeUndefined();
    });
    let disposed = 0;
    for (const resource of [...materials, ...geometries])
      resource.addEventListener("dispose", () => disposed++);
    const parent = new THREE.Group();
    parent.add(pet.group);
    pet.dispose();
    pet.dispose();
    expect(disposed).toBe(materials.size + geometries.size);
    expect(parent.children).toHaveLength(0);
    expect(pet.group.children).toHaveLength(0);
  }
  const a = createPet("cat", 0);
  const b = createPet("cat", 1);
  const firstMesh = (root: THREE.Group) =>
    root
      .getObjectByName("body")!
      .children.find((child) => child instanceof THREE.Mesh);
  const materialA = firstMesh(a.group)?.material;
  const materialB = firstMesh(b.group)?.material;
  expect(materialA).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(materialB).toBeInstanceOf(THREE.MeshStandardMaterial);
  if (
    materialA instanceof THREE.MeshStandardMaterial &&
    materialB instanceof THREE.MeshStandardMaterial
  )
    expect(materialA.color.getHex()).not.toBe(materialB.color.getHex());
  a.dispose();
  b.dispose();
});

it("rejects a mismatched species clip and non-finite animation times", () => {
  const pet = createPet("cat", 0);
  expect(() => pet.animate(clip("dog-walk"), 0)).toThrow(
    "Cannot animate cat with dog-walk",
  );
  expect(() => pet.animate(clip("cat-walk"), Number.NaN)).toThrow(
    "Pet animation time must be finite",
  );
  pet.dispose();
});

it("plants stance paws in world space as the pet advances", () => {
  for (const kind of ["cat", "dog"] as const) {
    const pet = createPet(kind, 0);
    const walk = animationCatalog.find(
      (c) => c.species === kind && c.tags.includes("follow"),
    )!;
    const cycle = ((kind === "cat" ? 0.4 : 0.48) * pet.group.scale.x) / 0.6;
    const positions: THREE.Vector3[] = [];
    for (const phase of [0.1, 0.2, 0.3]) {
      const distance = phase * cycle;
      pet.group.position.z = distance;
      pet.animate(walk, phase, { distance, speed: 1.7 });
      pet.group.updateWorldMatrix(true, true);
      const paw = pet.group
        .getObjectByName("front-left")!
        .getObjectByName("paw")!;
      positions.push(paw.getWorldPosition(new THREE.Vector3()));
    }
    expect(
      Math.hypot(
        positions[0].x - positions[1].x,
        positions[0].z - positions[1].z,
      ),
    ).toBeLessThan(0.002);
    expect(
      Math.hypot(
        positions[1].x - positions[2].x,
        positions[1].z - positions[2].z,
      ),
    ).toBeLessThan(0.002);
    pet.dispose();
  }
});

it("eases into walking and settles planted limbs gradually when movement stops", () => {
  for (const kind of ["cat", "dog"] as const) {
    const pet = createPet(kind, 0);
    const walk = clip(`${kind}-walk`);
    const idle = animationCatalog.find(
      (animation) =>
        animation.species === kind && animation.tags.includes("idle"),
    )!;
    const knee = pet.group.getObjectByName("knee")!;
    const paw = pet.group
      .getObjectByName("front-left")!
      .getObjectByName("paw")!;
    const position = new THREE.Vector3();
    pet.animate(idle, 0);
    paw.getWorldPosition(position);
    pet.animate(walk, 0, { distance: 0.11, speed: 1.7 });
    expect(knee.rotation.x).toBeGreaterThan(0);
    expect(knee.rotation.x).toBeLessThan(0.1);
    expect(
      paw.getWorldPosition(new THREE.Vector3()).distanceTo(position),
    ).toBeLessThan(0.02);

    for (let frame = 1; frame < 60; frame++) {
      const distance = (frame / 60) * 1.7;
      pet.group.position.z = distance;
      pet.animate(walk, frame / 60, { distance, speed: 1.7 });
    }
    let previousKnee = knee.rotation.x;
    paw.getWorldPosition(position);
    for (let frame = 0; frame < 30; frame++) {
      pet.animate(idle, frame / 60);
      const current = paw.getWorldPosition(new THREE.Vector3());
      expect(current.distanceTo(position)).toBeLessThan(0.02);
      expect(Math.abs(knee.rotation.x - previousKnee)).toBeLessThan(0.07);
      expect(knee.rotation.x).toBeLessThanOrEqual(previousKnee);
      if (frame === 0) expect(knee.rotation.x).toBeGreaterThan(0.5);
      previousKnee = knee.rotation.x;
      position.copy(current);
    }
    expect(knee.rotation.x).toBe(0);
    pet.dispose();
  }
});

it("keeps animated geometry above the support plane through walks and resting poses", () => {
  const point = new THREE.Vector3();
  for (const kind of species) {
    const pet = createPet(kind, 1);
    for (const animation of animationCatalog.filter(
      (c) => c.species === kind,
    )) {
      for (const phase of [0.15, 0.4, 0.7]) {
        const movement = animation.tags.includes("follow")
          ? { distance: phase, speed: 1.7 }
          : undefined;
        pet.animate(animation, animation.duration * phase, movement);
        pet.group.updateWorldMatrix(true, true);
        let lowest = Infinity;
        pet.group.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const vertices = object.geometry.getAttribute("position");
          for (let i = 0; i < vertices.count; i++) {
            point
              .fromBufferAttribute(vertices, i)
              .applyMatrix4(object.matrixWorld);
            lowest = Math.min(lowest, point.y);
          }
        });
        expect(lowest, `${animation.name} at ${phase}`).toBeGreaterThanOrEqual(
          -0.001,
        );
      }
    }
    pet.dispose();
  }
});

it("takes small grounded steps during stationary turns and settles back to idle", () => {
  const vertex = new THREE.Vector3();
  for (const kind of species) {
    const pet = createPet(kind, 0);
    const idle: PetAnimation = {
      name: "quiet-turn",
      species: kind,
      duration: 20,
      tags: ["idle"],
      poses: [{}],
    };
    const front = pet.group.getObjectByName("front-left")!;
    const foot = front.getObjectByName("paw")!;
    pet.animate(idle, 0);
    const previous = foot.getWorldPosition(new THREE.Vector3());
    let minimumHeight = Infinity,
      maximumHeight = -Infinity,
      maximumStep = 0;
    for (let frame = 1; frame <= 120; frame++) {
      pet.group.rotation.y += 2.2 / 60;
      pet.animate(idle, frame / 60, { distance: 0, speed: 0, turn: 2.2 });
      pet.group.updateWorldMatrix(true, true);
      const current = foot.getWorldPosition(new THREE.Vector3());
      maximumStep = Math.max(maximumStep, current.distanceTo(previous));
      minimumHeight = Math.min(minimumHeight, current.y);
      maximumHeight = Math.max(maximumHeight, current.y);
      previous.copy(current);
      if (frame % 12 !== 0) continue;
      let lowest = Infinity;
      pet.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.getAttribute("position");
        for (let index = 0; index < positions.count; index++) {
          vertex
            .fromBufferAttribute(positions, index)
            .applyMatrix4(object.matrixWorld);
          lowest = Math.min(lowest, vertex.y);
        }
      });
      expect(lowest).toBeGreaterThanOrEqual(-0.001);
    }
    expect(pet.group.position.length()).toBe(0);
    expect(maximumHeight - minimumHeight).toBeGreaterThan(0.015);
    expect(maximumStep).toBeLessThan(0.06);
    for (let frame = 121; frame <= 150; frame++) pet.animate(idle, frame / 60);
    expect(front.rotation.x).toBe(0);
    expect(front.getObjectByName("knee")!.rotation.x).toBe(0);
    pet.dispose();
  }
});

it("keeps the shallow eyes attached to each species' head", () => {
  for (const kind of species) {
    const pet = createPet(kind, 0);
    const head = pet.group.getObjectByName("head")!;
    const face = head.children.find((object) => object instanceof THREE.Mesh);
    if (!(face instanceof THREE.Mesh)) throw new Error("Expected a head mesh.");
    for (const name of ["eye-left", "eye-right"]) {
      const eye = pet.group.getObjectByName(name)!;
      const dark = eye.children[0];
      const rear = eye.position.z - dark.scale.z;
      const insideHead =
        (eye.position.x / face.scale.x) ** 2 +
        (eye.position.y / face.scale.y) ** 2 +
        (rear / face.scale.z) ** 2;
      expect(insideHead).toBeLessThan(1);
    }
    pet.dispose();
  }
});

it("blinks briefly even when the selected pose has no blink keys", () => {
  const pet = createPet("cat", 3);
  const idle: PetAnimation = {
    name: "quiet",
    species: "cat",
    duration: 20,
    tags: ["idle"],
    poses: [{}],
  };
  const eye = pet.group.getObjectByName("eye-left")!;
  let closed = 0,
    open = 0;
  for (let frame = 0; frame < 600; frame++) {
    pet.animate(idle, frame / 60);
    if (eye.scale.y < 0.2) closed++;
    if (eye.scale.y > 0.9) open++;
  }
  expect(closed).toBeGreaterThan(5);
  expect(closed).toBeLessThan(40);
  expect(open).toBeGreaterThan(500);
  pet.dispose();
});
