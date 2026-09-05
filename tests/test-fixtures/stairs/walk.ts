import * as THREE from "three";
import { analyzeProject } from "../../../src/graph/analyze.ts";
import { layoutWorld } from "../../../src/world/layout.ts";
import { buildCity } from "../../../src/world/city.ts";
import { PlayerPhysics } from "../../../src/world/physics.ts";
import { stairwells } from "../../../src/world/stairs.ts";

const result = document.querySelector<HTMLOutputElement>("#result")!;
try {
  const graph = analyzeProject(
    Array.from({ length: 56 }, (_, i) => ({
      path: `src/room${Math.floor(i / 8)}/file${i}.ts`,
      content: "export const value = 1;",
    })),
    "Stair access",
  );
  const layout = layoutWorld(graph);
  const building = layout.buildings[0];
  const city = buildCity(graph, layout);
  const player = new PlayerPhysics(city.colliders);
  function walk(x: number, z: number) {
    for (let tick = 0; tick < 3000; tick++) {
      const dx = x - player.position.x;
      const dz = z - player.position.z;
      const distance = Math.hypot(dx, dz);
      if (
        distance < 0.025 &&
        Math.hypot(player.velocity.x, player.velocity.z) < 0.05
      )
        return;
      const speed = Math.min(1, distance * 2) / Math.max(0.001, distance);
      player.step(1 / 120, { x: dx * speed, z: dz * speed }, false, false);
    }
    throw new Error(
      `Blocked at ${JSON.stringify(player.position)} approaching ${x}, ${z}`,
    );
  }
  const front = building.z + building.depth / 2;
  const rear = building.z - building.depth / 2;
  for (const well of stairwells(building)) {
    const entry = well.entryZ - well.direction;
    const landing = well.exitZ + well.direction;
    const laneX = well.x - 0.8;
    player.teleport(building.x, front + 2);
    walk(building.x, front - 3);
    walk(building.hallX, front - 3);
    if (well.direction > 0) walk(building.hallX, rear + 3);
    walk(laneX, well.direction > 0 ? rear + 3 : front - 3);
    walk(laneX, entry);
    walk(laneX, landing);
    if (Math.abs(player.position.y - 7.15) > 0.01)
      throw new Error(`Stair arrival was at height ${player.position.y}`);
    walk(well.x - 2.7, landing);
    walk(well.x - 2.7, front - 3);
    walk(building.hallX, front - 3);
    for (const room of building.rooms.filter((room) => room.floorY === 5.4)) {
      walk(building.hallX, room.door.z);
      walk(room.x, room.door.z);
      walk(building.hallX, room.door.z);
    }
    walk(building.hallX, front - 3);
    walk(well.x - 2.7, front - 3);
    walk(well.x - 2.7, landing);
    walk(laneX, landing);
    walk(laneX, entry);
    if (Math.abs(player.position.y - 1.75) > 0.01)
      throw new Error(`Stair descent was at height ${player.position.y}`);
  }
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setSize(innerWidth, innerHeight - 30);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#081320");
  scene.add(city.group, new THREE.HemisphereLight(0xa8d7ee, 0x293040, 2));
  const camera = new THREE.PerspectiveCamera(
    60,
    innerWidth / (innerHeight - 30),
    0.1,
    2000,
  );
  camera.position.set(building.x, 1.75, front - 3);
  const frontWell = stairwells(building)[1];
  camera.lookAt(frontWell.x, 2, frontWell.entryZ - 1);
  renderer.render(scene, camera);
  document.body.append(renderer.domElement);
  result.textContent =
    "Both stairwells reach furnished upper rooms and return to the ground floor.";
  result.dataset.status = "passed";
} catch (error) {
  result.dataset.status = "failed";
  result.textContent = error instanceof Error ? error.message : String(error);
}
