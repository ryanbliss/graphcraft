import { expect, it } from "vitest";
import { analyzeProject } from "../src/graph/analyze.ts";
import { hash } from "../src/graph/types.ts";
import { furnishArtifact, furnitureSize } from "../src/world/furniture.ts";
import { VoxelBatch } from "../src/world/geometry.ts";
import { furnishBuilding } from "../src/world/interiors.ts";
import { layoutWorld, type FurnitureKind } from "../src/world/layout.ts";
import { CollisionWorld } from "../src/world/physics.ts";

type Box = { min: number[]; max: number[] };
type Rect = { left: number; right: number; bottom: number; top: number };
const epsilon = 1e-7;
class Capture extends VoxelBatch {
  readonly captured: Box[] = [];
  override add(...[x, y, z, w, h, d]: Parameters<VoxelBatch["add"]>) {
    this.captured.push({
      min: [x - w / 2, y - h / 2, z - d / 2],
      max: [x + w / 2, y + h / 2, z + d / 2],
    });
  }
}

function subtract(rect: Rect, cover: Rect): Rect[] {
  const left = Math.max(rect.left, cover.left);
  const right = Math.min(rect.right, cover.right);
  const bottom = Math.max(rect.bottom, cover.bottom);
  const top = Math.min(rect.top, cover.top);
  if (right <= left + epsilon || top <= bottom + epsilon) return [rect];
  return [
    { ...rect, right: left },
    { ...rect, left: right },
    { left, right, bottom: rect.bottom, top: bottom },
    { left, right, bottom: top, top: rect.top },
  ].filter(
    (part) =>
      part.right - part.left > epsilon && part.top - part.bottom > epsilon,
  );
}

// Opposing faces at a butt joint are valid. Only shared outward faces can flicker.
function exposedDuplicates(boxes: Box[], floors: number[]) {
  const duplicates: {
    first: number;
    second: number;
    axis: number;
    plane: number;
  }[] = [];
  for (let first = 0; first < boxes.length; first++)
    for (let second = first + 1; second < boxes.length; second++)
      for (const axis of [0, 1, 2])
        for (const sign of [-1, 1]) {
          const a = boxes[first],
            b = boxes[second];
          const face = sign === 1 ? "max" : "min";
          const plane = a[face][axis];
          if (Math.abs(plane - b[face][axis]) > epsilon) continue;
          // Story slabs hide their fixtures' downward-facing floor contacts.
          if (
            axis === 1 &&
            sign === -1 &&
            floors.some((y) => Math.abs(y - plane) < epsilon)
          )
            continue;
          const [u, v] = [0, 1, 2].filter((dimension) => dimension !== axis);
          const overlap = {
            left: Math.max(a.min[u], b.min[u]),
            right: Math.min(a.max[u], b.max[u]),
            bottom: Math.max(a.min[v], b.min[v]),
            top: Math.min(a.max[v], b.max[v]),
          };
          if (
            overlap.right - overlap.left <= epsilon ||
            overlap.top - overlap.bottom <= epsilon
          )
            continue;
          let exposed = [overlap];
          for (const cover of boxes) {
            const beyond = plane + sign * 1e-5;
            if (
              cover === a ||
              cover === b ||
              cover.min[axis] >= beyond ||
              cover.max[axis] <= beyond
            )
              continue;
            exposed = exposed.flatMap((rect) =>
              subtract(rect, {
                left: cover.min[u],
                right: cover.max[u],
                bottom: cover.min[v],
                top: cover.max[v],
              }),
            );
            if (!exposed.length) break;
          }
          if (exposed.length) duplicates.push({ first, second, axis, plane });
        }
  return duplicates;
}

it("keeps exposed furniture faces separate across every authored shape", () => {
  const node = analyzeProject(
    [{ path: "fixture.ts", content: "export const item = 1" }],
    "audit",
  ).nodes[0];
  const ids = Array.from({ length: 3 }, (_, variant) => {
    let seed = 0;
    while (hash(`fixture${seed}:shape`) % 3 !== variant) seed++;
    return `fixture${seed}`;
  });
  for (const kind of Object.keys(furnitureSize) as FurnitureKind[])
    for (const id of ids) {
      const batch = new Capture();
      furnishArtifact(
        { ...node, id },
        {
          x: 0,
          y: 3,
          z: 0,
          floorY: 0,
          rotation: 0,
          furniture: kind,
          buildingId: "audit",
        },
        batch,
        batch,
        batch,
        new CollisionWorld(),
        true,
      );
      expect(exposedDuplicates(batch.captured, [0]), `${kind} ${id}`).toEqual(
        [],
      );
    }
});

it("joins room corners, stair rails and floor inlays without exposed duplicate faces", () => {
  const graph = analyzeProject(
    Array.from({ length: 32 }, (_, directory) =>
      Array.from({ length: directory < 2 ? 72 : 24 }, (_, file) => ({
        path: `src/room${directory}/file${file}.ts`,
        content: "export const item = 1",
      })),
    ).flat(),
    "audit",
  );
  const layout = layoutWorld(graph);
  for (const building of layout.buildings) {
    const batch = new Capture();
    furnishBuilding(
      building,
      layout,
      batch,
      batch,
      batch,
      new CollisionWorld(),
      new Set(),
    );
    expect(
      exposedDuplicates(
        batch.captured,
        Array.from({ length: building.stories }, (_, story) => story * 5.4),
      ),
      building.id,
    ).toEqual([]);
  }
});
