import * as THREE from "three";
import { withNeonFlicker } from "./neon-flicker.ts";

const canopyRadius = 3.1;
const canopyHeight = 5.2;

/** The pilot and suspension cords are attached by ShuttleFlight. */
export function buildCatCanopy(): THREE.Group {
  const canopy = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({
    color: "#ff69b5",
    emissive: "#b91973",
    emissiveIntensity: 0.45,
    metalness: 0.3,
    roughness: 0.38,
    side: THREE.DoubleSide,
  });
  const rose = shell.clone();
  rose.color.set("#e52d91");
  const blush = shell.clone();
  blush.color.set("#ffabd3");
  const neon = withNeonFlicker(
    new THREE.MeshBasicMaterial({ color: "#3ee9ff" }),
  );
  const white = withNeonFlicker(
    new THREE.MeshBasicMaterial({ color: "#edfbff" }),
  );
  const dark = new THREE.MeshStandardMaterial({
    color: "#261039",
    roughness: 0.3,
    metalness: 0.4,
  });
  const sphere = new THREE.SphereGeometry(1, 16, 12);

  for (let panel = 0; panel < 8; panel++) {
    const material = panel % 2 === 0 ? shell : rose;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(
        canopyRadius,
        6,
        10,
        (panel * Math.PI) / 4,
        Math.PI / 4,
        0,
        Math.PI / 2,
      ),
      material,
    );
    dome.position.y = canopyHeight;
    canopy.add(dome);
  }

  function tube(points: THREE.Vector3[], radius = 0.035) {
    const curve = new THREE.CatmullRomCurve3(points);
    canopy.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, points.length * 3, radius, 5, false),
        neon,
      ),
    );
  }

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(canopyRadius, 0.065, 6, 64),
    neon,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = canopyHeight;
  canopy.add(rim);
  for (let rib = 0; rib < 8; rib++) {
    const angle = (rib * Math.PI) / 4;
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= 10; step++) {
      const arc = (step * Math.PI) / 20;
      const radius = canopyRadius + 0.035;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * Math.sin(arc) * radius,
          canopyHeight + Math.cos(arc) * radius,
          Math.sin(angle) * Math.sin(arc) * radius,
        ),
      );
    }
    tube(points, 0.026);
  }

  for (const side of [-1, 1]) {
    const ear = new THREE.Shape();
    ear.moveTo(-0.72, 0);
    ear.lineTo(0.72, 0);
    ear.lineTo(side * 0.24, 2.1);
    ear.closePath();
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(ear, {
        depth: 0.65,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.08,
        bevelSegments: 1,
        steps: 1,
      }),
      [blush, rose],
    );
    mesh.position.set(side * 1.75, 7.1, -0.325);
    canopy.add(mesh);

    for (const facing of [-1, 1]) {
      const inset = new THREE.Shape();
      inset.moveTo(-0.44, 0.22);
      inset.lineTo(0.44, 0.22);
      inset.lineTo(side * 0.19, 1.64);
      inset.closePath();
      const inner = new THREE.Mesh(new THREE.ShapeGeometry(inset), rose);
      inner.position.set(side * 1.75, 7.1, facing * 0.42);
      canopy.add(inner);
      tube([
        new THREE.Vector3(side * 1.75 - 0.53, 7.25, facing * 0.44),
        new THREE.Vector3(side * 1.75 + side * 0.22, 8.96, facing * 0.44),
        new THREE.Vector3(side * 1.75 + 0.53, 7.25, facing * 0.44),
      ]);
    }
  }

  for (const facing of [-1, 1]) {
    function feature(x: number, y: number): THREE.Group {
      const z = facing * Math.sqrt(canopyRadius ** 2 - x * x - y * y);
      const normal = new THREE.Vector3(x, y, z).normalize();
      const group = new THREE.Group();
      group.position.set(x, canopyHeight + y, z);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      canopy.add(group);
      return group;
    }
    function oval(
      group: THREE.Group,
      material: THREE.Material,
      position: [number, number, number],
      scale: [number, number, number],
    ) {
      const mesh = new THREE.Mesh(sphere, material);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      group.add(mesh);
    }

    for (const side of [-1, 1]) {
      const eye = feature(side * 1.02, 1.22);
      oval(eye, dark, [0, 0, 0.055], [0.62, 0.72, 0.15]);
      oval(eye, neon, [0, 0, 0.19], [0.48, 0.57, 0.09]);
      oval(eye, dark, [0, 0, 0.27], [0.18, 0.41, 0.055]);
      oval(eye, white, [-0.16, 0.21, 0.31], [0.14, 0.16, 0.045]);
      oval(eye, white, [0.15, -0.2, 0.29], [0.06, 0.07, 0.035]);
      const cheek = feature(side * 1.8, 0.5);
      oval(cheek, blush, [0, 0, 0.05], [0.37, 0.17, 0.075]);
      for (let whisker = 0; whisker < 2; whisker++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.045, 0.045),
          neon,
        );
        stripe.position.set(side * 0.09, whisker * 0.16 - 0.08, 0.14);
        stripe.rotation.z = side * (whisker === 0 ? -0.2 : 0.2);
        cheek.add(stripe);
      }
    }
    const muzzle = feature(0, 0.5);
    oval(muzzle, blush, [-0.18, 0, 0.04], [0.3, 0.2, 0.12]);
    oval(muzzle, blush, [0.18, 0, 0.04], [0.3, 0.2, 0.12]);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.2, 3), neon);
    nose.rotation.z = Math.PI;
    nose.position.set(0, 0.17, 0.17);
    muzzle.add(nose);
  }
  return canopy;
}
