import { type Building, type Room, type WorldLayout } from "./layout.ts";
import { solid, type VoxelBatch } from "./geometry.ts";
import type { CollisionWorld } from "./physics.ts";
import { stairwells } from "./stairs.ts";
import { hash } from "../graph/types.ts";
import { furnishArtifact } from "./furniture.ts";
import { roomContentHeight, roomTheme, type RoomTheme } from "./room-plan.ts";
export { roomTheme } from "./room-plan.ts";

const storyHeight = 5.4;
const finishes: Record<RoomTheme, [string, string, string, string]> = {
  bedroom: ["#42404c", "#542e44", "#efaa70", "#292a36"],
  lounge: ["#3b394b", "#512d51", "#d586c5", "#292a36"],
  studio: ["#34444e", "#214b52", "#65d8cd", "#25353e"],
  library: ["#3c424c", "#45405d", "#d2b087", "#2c2c38"],
  workshop: ["#38414b", "#4c3a2e", "#e3ac63", "#2a3038"],
  arcade: ["#302e47", "#522848", "#e375ca", "#252337"],
  spa: ["#48595c", "#285b5c", "#87e0d0", "#334a4c"],
  dojo: ["#383746", "#552e3e", "#e98493", "#302a39"],
  bar: ["#373445", "#573641", "#edb46d", "#302934"],
  garden: ["#374a47", "#284b43", "#b3d894", "#293a36"],
  gallery: ["#414659", "#353550", "#aaa1e8", "#303443"],
};

export function roomCeilingHeight(room: Room): number {
  return Math.max(
    room.nodeIds.length <= 3 ? 3.3 : 4.6,
    roomContentHeight(room) + 0.65,
  );
}

export function furnishBuilding(
  building: Building,
  layout: WorldLayout,
  blocks: VoxelBatch,
  lights: VoxelBatch,
  files: VoxelBatch,
  colliders: CollisionWorld,
  cyclicNodes: Set<string>,
): void {
  const left = building.x - building.width / 2 + 0.35;
  const right = building.x + building.width / 2;
  const rear = building.z - building.depth / 2;
  const front = building.z + building.depth / 2 - 0.35;
  const wells = stairwells(building);
  const openingLeft = right - 4.2;
  const openingRight = right - 0.8;
  const structure = (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color = "#465362",
  ) =>
    solid(blocks, colliders, x, y, z, width, height, depth, color, building.id);
  const floorSlab = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    y: number,
  ) => {
    if (x2 <= x1 || z2 <= z1) return;
    structure(
      (x1 + x2) / 2,
      y - 0.15,
      (z1 + z2) / 2,
      x2 - x1,
      0.3,
      z2 - z1,
      "#3b4652",
    );
  };

  const blockOwner = blocks.owner;
  const lightOwner = lights.owner;
  blocks.owner = lights.owner = undefined;
  const hallColor = ["#65b8c7", "#ba80b4", "#82bcb3"][hash(building.id) % 3];
  const runnerColor = ["#243f54", "#3c304b", "#27484b"][hash(building.id) % 3];
  const hallX = building.hallX;
  const hallRear = rear + 1;
  const hallFront = front - 6.5;
  const hallLength = hallFront - hallRear;
  for (let floor = 0; floor < building.stories; floor++) {
    const floorY = floor * storyHeight;
    // Finishes stay inside circulation space; every entrance and stair remains clear.
    if (hallLength > 0) {
      const bays = Math.ceil(hallLength / 4);
      const bayLength = hallLength / bays;
      for (const side of [-1, 1]) {
        blocks.add(
          hallX + side * 1.56,
          floorY + 0.045,
          (hallRear + hallFront) / 2,
          0.18,
          0.06,
          hallLength,
          "#617180",
        );
        blocks.add(
          hallX + side * 1.52,
          floorY + 4.68,
          (hallRear + hallFront) / 2,
          0.22,
          0.22,
          hallLength,
          "#263846",
        );
        lights.add(
          hallX + side * 1.52,
          floorY + 4.52,
          (hallRear + hallFront) / 2,
          0.12,
          0.1,
          hallLength - 0.25,
          hallColor,
        );
      }
      for (let bay = 0; bay < bays; bay++) {
        const z = hallRear + (bay + 0.5) * bayLength;
        blocks.add(
          hallX,
          floorY + 0.045,
          z,
          2.82,
          0.06,
          bayLength - 0.12,
          bay % 2 === 0 ? runnerColor : "#2b384b",
        );
        for (const side of [-1, 1])
          lights.add(
            hallX + side * 1.13,
            floorY + 0.112,
            z,
            0.1,
            0.06,
            Math.min(1.1, bayLength * 0.45),
            hallColor,
          );
        if (bay % 2 === 0) {
          blocks.add(hallX, floorY + 4.39, z, 3.38, 0.2, 0.55, "#526578");
          lights.add(hallX, floorY + 4.23, z, 2.7, 0.12, 0.3, "#bdcccb");
        }
      }
    }
    const floorRooms = building.rooms.filter((room) => room.floorY === floorY);
    const wings = [
      [left + 0.8, hallX - 2.25],
      [hallX + 2.25, wells.length ? openingLeft - 0.7 : right - 0.8],
    ];
    for (const [wingLeft, wingRight] of wings) {
      const wingWidth = wingRight - wingLeft;
      if (wingWidth < 3 || hallLength < 3) continue;
      const columns = Math.max(1, Math.floor(wingWidth / 6));
      const rows = Math.max(1, Math.floor(hallLength / 6));
      const cellWidth = wingWidth / columns;
      const cellDepth = hallLength / rows;
      for (let column = 0; column < columns; column++)
        for (let row = 0; row < rows; row++) {
          const x = wingLeft + (column + 0.5) * cellWidth;
          const z = hallRear + (row + 0.5) * cellDepth;
          const width = cellWidth - 0.45;
          const depth = cellDepth - 0.45;
          if (
            floorRooms.some(
              (room) =>
                Math.abs(x - room.x) < (width + room.width) / 2 + 0.5 &&
                Math.abs(z - room.z) < (depth + room.depth) / 2 + 0.5,
            )
          )
            continue;
          blocks.add(
            x,
            floorY + 0.045,
            z,
            width,
            0.06,
            depth,
            (column + row) % 2 === 0 ? runnerColor : "#364258",
          );
          for (const side of [-1, 1]) {
            blocks.add(
              x,
              floorY + 0.111,
              z + side * (depth / 2 - 0.3),
              width - 0.4,
              0.06,
              0.18,
              "#637587",
            );
            lights.add(
              x + side * (width / 2 - 0.35),
              floorY + 0.111,
              z,
              0.16,
              0.06,
              depth - 1.2,
              hallColor,
            );
          }
          // Broad suspended panels make unused wings read as shared concourses.
          if ((column + row) % 2 === 0) {
            const lightWidth = Math.min(3.8, width - 0.6);
            blocks.add(x, floorY + 4.45, z, lightWidth, 0.24, 1.5, "#41566a");
            lights.add(
              x,
              floorY + 4.24,
              z,
              lightWidth - 0.45,
              0.16,
              1.05,
              "#a5c9cb",
            );
            for (const side of [-1, 1])
              blocks.add(
                x + side * (lightWidth / 2 - 0.2),
                floorY + 4.86,
                z,
                0.12,
                0.64,
                0.12,
                "#263846",
              );
          }
        }
    }
    const foyerLeft = left + 1;
    const foyerRight = right - (wells.length ? 4.7 : 1);
    const foyerWidth = foyerRight - foyerLeft;
    const foyerX = (foyerLeft + foyerRight) / 2;
    if (foyerWidth > 0) {
      blocks.add(
        foyerX,
        floorY + 0.045,
        front - 3.4,
        foyerWidth,
        0.06,
        3.8,
        runnerColor,
      );
      for (const side of [-1, 1]) {
        blocks.add(
          foyerX,
          floorY + 0.111,
          front - 3.4 + side * 1.52,
          foyerWidth - 0.4,
          0.06,
          0.16,
          "#718396",
        );
        lights.add(
          foyerX,
          floorY + 0.111,
          front - 3.4 + side * 1.15,
          Math.min(4.2, foyerWidth - 0.6),
          0.06,
          0.12,
          hallColor,
        );
      }
      for (let stripe = -1; stripe <= 1; stripe++)
        blocks.add(
          foyerX + stripe * 0.5,
          floorY + 0.111,
          front - 3.4,
          0.18,
          0.06,
          1.6,
          "#91a1af",
        );
    }
    for (const well of floor < building.stories - 1 ? wells : []) {
      const firstLane = floor % 2 === 0;
      const direction = firstLane ? well.direction : -well.direction;
      const startZ = firstLane ? well.entryZ : well.exitZ;
      const flightX = well.x + (firstLane ? -0.8 : 0.8);
      const markerZ = startZ - direction * 1.3;
      // A three-step arrow identifies the next flight without labels or props.
      for (let arrow = 0; arrow < 3; arrow++)
        lights.add(
          flightX,
          floorY + 0.09,
          markerZ + direction * arrow * 0.28,
          1.1 - arrow * 0.35,
          0.08,
          0.16,
          hallColor,
        );
      blocks.add(
        openingLeft - 0.4,
        floorY + 4.3,
        markerZ,
        0.16,
        1.7,
        0.16,
        "#263846",
      );
      blocks.add(
        openingLeft - 0.4,
        floorY + 3.05,
        markerZ,
        0.3,
        0.85,
        0.5,
        "#304658",
      );
      lights.add(
        openingLeft - 0.61,
        floorY + 3.05,
        markerZ,
        0.12,
        0.57,
        0.28,
        hallColor,
      );
    }

    if (floor > 0) {
      floorSlab(left, rear + 0.35, openingLeft, front, floorY);
      floorSlab(openingRight, rear + 0.35, right - 0.35, front, floorY);
      let slabRear = rear + 0.35;
      for (const well of wells) {
        floorSlab(openingLeft, slabRear, openingRight, well.rear, floorY);
        slabRear = well.front;
        for (const railX of [openingLeft, openingRight]) {
          structure(
            railX,
            floorY + 0.95,
            (well.rear + well.front) / 2,
            0.12,
            0.12,
            9,
            "#a6bbc0",
          );
          for (const railZ of [well.rear + 0.2, well.front - 0.2])
            structure(railX, floorY + 0.5, railZ, 0.12, 1, 0.12);
        }
      }
      floorSlab(openingLeft, slabRear, openingRight, front, floorY);
    }
    if (floor < building.stories - 1) {
      for (const well of wells) {
        const firstLane = floor % 2 === 0;
        const direction = firstLane ? well.direction : -well.direction;
        const startZ = firstLane ? well.entryZ : well.exitZ;
        const flightX = well.x + (firstLane ? -0.8 : 0.8);
        for (let step = 0; step < 18; step++) {
          const z = startZ + direction * (step * 0.5 + 0.25);
          const top = floorY + (step + 1) * 0.3;
          structure(flightX, top - 0.15, z, 1.4, 0.3, 0.5, "#798489");
          lights.add(
            flightX,
            top + 0.015,
            z - direction * 0.22,
            1.2,
            0.025,
            0.035,
            "#d1ddc6",
            building.id,
          );
          for (const side of [-1, 1]) {
            structure(flightX + side * 0.73, top - 0.18, z, 0.12, 0.42, 0.55);
            structure(
              flightX + side * 0.73,
              top + 0.95,
              z,
              0.08,
              0.1,
              0.55,
              "#b7c6c5",
            );
            if (step % 6 === 0)
              structure(flightX + side * 0.73, top + 0.45, z, 0.08, 1, 0.08);
          }
        }
      }
    }
  }
  for (const room of building.rooms) {
    const towardRoom = room.side === "left" ? -1 : 1;
    for (const side of [-1, 1]) {
      const z = room.door.z + side * 2.15;
      if (z < room.z - room.depth / 2 + 0.45) continue;
      if (z > room.z + room.depth / 2 - 0.45) continue;
      blocks.add(
        room.door.x - towardRoom * 0.23,
        room.floorY + 2.85,
        z,
        0.24,
        0.95,
        0.5,
        "#304454",
      );
      lights.add(
        room.door.x - towardRoom * 0.38,
        room.floorY + 2.85,
        z,
        0.12,
        0.65,
        0.27,
        hallColor,
      );
    }
  }
  blocks.owner = blockOwner;
  lights.owner = lightOwner;
  for (const room of building.rooms) {
    const ceiling = roomCeilingHeight(room);
    const theme = roomTheme(room);
    const [wall, accentWall, light, floor] = finishes[theme];
    const trim = "#1b2833";
    const halfWidth = room.width / 2;
    const halfDepth = room.depth / 2;
    const inner = room.side === "left" ? halfWidth : -halfWidth;
    const outer = -inner;
    const part = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
    ) =>
      solid(
        blocks,
        colliders,
        room.x + x,
        room.floorY + y,
        room.z + z,
        w,
        h,
        d,
        color,
        room.id,
      );
    part(0, 2.3, -halfDepth, room.width, 4.6, 0.22, wall);
    part(outer, 2.3, 0, 0.22, 4.6, room.depth, accentWall);
    // A broad internal window gives work rooms a view into their hallway.
    if (theme === "studio" || theme === "workshop") {
      part(0, 0.65, halfDepth, room.width, 1.3, 0.22, wall);
      part(0, 4.15, halfDepth, room.width, 0.9, 0.22, wall);
      for (const side of [-1, 1]) {
        part(side * (halfWidth - 0.65), 2.4, halfDepth, 1.3, 2.2, 0.22, wall);
      }
      for (let x = -halfWidth + 1.4; x <= halfWidth - 1.3; x += 2.4)
        part(x, 2.5, halfDepth, 0.08, 2.5, 0.26, trim);
      part(0, 1.3, halfDepth, room.width, 0.12, 0.4, trim);
      colliders.add({
        minX: room.x - halfWidth,
        maxX: room.x + halfWidth,
        minY: room.floorY + 1.3,
        maxY: room.floorY + 3.7,
        minZ: room.z + halfDepth - 0.11,
        maxZ: room.z + halfDepth + 0.11,
      });
    } else {
      part(0, 2.3, halfDepth, room.width, 4.6, 0.22, wall);
    }
    const doorZ = room.door.z - room.z;
    const wallRear = -halfDepth;
    const wallFront = halfDepth;
    const doorRear = doorZ - 1.5;
    const doorFront = doorZ + 1.5;
    part(
      inner,
      2.3,
      (wallRear + doorRear) / 2,
      0.22,
      4.6,
      doorRear - wallRear,
      wall,
    );
    part(
      inner,
      2.3,
      (doorFront + wallFront) / 2,
      0.22,
      4.6,
      wallFront - doorFront,
      wall,
    );
    part(inner, 4.0, doorZ, 0.32, 1.2, 3, trim);
    lights.add(
      room.door.x,
      room.floorY + 3.36,
      room.door.z,
      0.36,
      0.04,
      2.7,
      light,
      room.id,
    );
    for (const sign of [-1, 1]) {
      part(inner, 1.7, doorZ + sign * 1.5, 0.34, 3.4, 0.12, trim);
      part(0, 0.12, sign * halfDepth, room.width, 0.24, 0.28, trim);
    }
    part(outer, 0.12, 0, 0.28, 0.24, room.depth, trim);
    blocks.add(
      room.x,
      room.floorY + 0.012,
      room.z,
      room.width - 0.25,
      0.025,
      room.depth - 0.25,
      floor,
      room.id,
    );
    // Recessed floor joints and wall service bands belong to the directory.
    for (let x = -halfWidth + 0.3; x < halfWidth; x += 2.2)
      blocks.add(
        room.x + x,
        room.floorY + 0.029,
        room.z,
        0.035,
        0.012,
        room.depth - 0.4,
        "#14232d",
        room.id,
      );
    for (let z = -halfDepth + 0.3; z < halfDepth; z += 3.2)
      blocks.add(
        room.x,
        room.floorY + 0.029,
        room.z + z,
        room.width - 0.4,
        0.012,
        0.035,
        "#14232d",
        room.id,
      );
    part(
      0,
      ceiling - 0.43,
      -halfDepth + 0.05,
      room.width - 0.22,
      0.52,
      0.2,
      trim,
    );
    part(outer, ceiling - 0.43, 0, 0.32, 0.52, room.depth, trim);
    for (let x = -halfWidth + 0.6; x < halfWidth - 0.4; x += 0.38)
      blocks.add(
        room.x + x,
        room.floorY + ceiling - 0.42,
        room.z - halfDepth + 0.16,
        0.11,
        0.27,
        0.025,
        "#4b5b65",
        room.id,
      );
    for (let z = -halfDepth + 0.5; z < halfDepth - 0.2; z += 2.6)
      blocks.add(
        room.x + outer,
        room.floorY + 2.05,
        room.z + z,
        0.235,
        3.65,
        0.04,
        trim,
        room.id,
      );
    lights.add(
      room.x,
      room.floorY + ceiling - 0.72,
      room.z - halfDepth + 0.19,
      room.width - 0.6,
      0.05,
      0.08,
      light,
      room.id,
    );
  }
  for (const node of building.nodes) {
    const position = layout.positions.get(node.id);
    if (!position) throw new Error(`Missing furniture position for ${node.id}`);
    furnishArtifact(
      node,
      position,
      blocks,
      lights,
      files,
      colliders,
      cyclicNodes.has(node.id),
    );
  }
}
