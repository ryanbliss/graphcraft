import { hash } from "../graph/types.ts";
import type { NavigationPath } from "./layout.ts";
import { VoxelBatch } from "./geometry.ts";

export interface SurfaceRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Disjoint rectangles covering a union, including partial overlaps and crossings. */
export function unionSurfaces(rectangles: SurfaceRect[]): SurfaceRect[] {
  const events = new Map<number, { index: number; entering: boolean }[]>();
  rectangles.forEach((r, index) => {
    if (r.maxX <= r.minX || r.maxZ <= r.minZ) return;
    for (const [x, entering] of [
      [r.minX, true],
      [r.maxX, false],
    ] as const) {
      const changes = events.get(x) ?? [];
      changes.push({ index, entering });
      events.set(x, changes);
    }
  });
  const xs = [...events.keys()].sort((a, b) => a - b);
  const active = new Set<number>();
  const output: SurfaceRect[] = [];
  let previous = new Map<string, SurfaceRect>();
  for (let i = 0; i < xs.length - 1; i++) {
    const x = xs[i],
      nextX = xs[i + 1];
    for (const event of events.get(x)!) {
      if (event.entering) active.add(event.index);
      else active.delete(event.index);
    }
    const intervals = [...active]
      .map((index) => rectangles[index])
      .sort((a, b) => a.minZ - b.minZ || a.maxZ - b.maxZ);
    const merged: { minZ: number; maxZ: number }[] = [];
    for (const r of intervals) {
      const last = merged.at(-1);
      if (last && r.minZ <= last.maxZ) last.maxZ = Math.max(last.maxZ, r.maxZ);
      else merged.push({ minZ: r.minZ, maxZ: r.maxZ });
    }
    const next = new Map<string, SurfaceRect>();
    for (const interval of merged) {
      const key = `${interval.minZ}:${interval.maxZ}`;
      const existing = previous.get(key);
      const rect = existing ?? { minX: x, maxX: nextX, ...interval };
      rect.maxX = nextX;
      if (!existing) output.push(rect);
      next.set(key, rect);
    }
    previous = next;
  }
  return output;
}

interface Run {
  alongX: boolean;
  fixed: number;
  start: number;
  end: number;
}

/** Cancel shared edges before placing rails along the outside of joined roads. */
function boundaryRails(surfaces: SurfaceRect[], width: number): SurfaceRect[] {
  const lines = new Map<
    string,
    { alongX: boolean; fixed: number; events: Map<number, number> }
  >();
  const edge = (
    alongX: boolean,
    fixed: number,
    start: number,
    end: number,
    inward: number,
  ) => {
    const key = `${alongX}:${fixed}`;
    const line = lines.get(key) ?? {
      alongX,
      fixed,
      events: new Map<number, number>(),
    };
    line.events.set(start, (line.events.get(start) ?? 0) + inward);
    line.events.set(end, (line.events.get(end) ?? 0) - inward);
    lines.set(key, line);
  };
  for (const r of surfaces) {
    edge(true, r.minZ, r.minX, r.maxX, 1);
    edge(true, r.maxZ, r.minX, r.maxX, -1);
    edge(false, r.minX, r.minZ, r.maxZ, 1);
    edge(false, r.maxX, r.minZ, r.maxZ, -1);
  }
  const rails: SurfaceRect[] = [];
  for (const { alongX, fixed, events } of lines.values()) {
    const positions = [...events.keys()].sort((a, b) => a - b);
    let inward = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      const start = positions[i],
        end = positions[i + 1];
      inward += events.get(start)!;
      if (!inward) continue;
      const min = Math.min(fixed, fixed + inward * width);
      const max = Math.max(fixed, fixed + inward * width);
      rails.push(
        alongX
          ? { minX: start, maxX: end, minZ: min, maxZ: max }
          : { minX: min, maxX: max, minZ: start, maxZ: end },
      );
    }
  }
  return unionSurfaces(rails);
}
function roadRuns(paths: NavigationPath[]): Run[] {
  const lines = new Map<string, Run[]>();
  for (const path of paths)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i];
      if (a.x === b.x && a.z === b.z) continue;
      if (a.x !== b.x && a.z !== b.z)
        throw new Error("Road surfaces require axis-aligned paths.");
      const alongX = a.z === b.z,
        fixed = alongX ? a.z : a.x;
      const start = Math.min(alongX ? a.x : a.z, alongX ? b.x : b.z);
      const end = Math.max(alongX ? a.x : a.z, alongX ? b.x : b.z);
      const key = `${alongX}:${fixed}`;
      const runs = lines.get(key) ?? [];
      runs.push({ alongX, fixed, start, end });
      lines.set(key, runs);
    }
  const output: Run[] = [];
  for (const runs of lines.values()) {
    runs.sort((a, b) => a.start - b.start || a.end - b.end);
    let current: Run | undefined;
    for (const run of runs) {
      if (current && run.start <= current.end)
        current.end = Math.max(current.end, run.end);
      else {
        current = { ...run };
        output.push(current);
      }
    }
  }
  return output;
}

export function buildRoadSurfaces(
  paths: NavigationPath[],
  blocks: VoxelBatch,
  lights: VoxelBatch,
) {
  const pavement: SurfaceRect[] = [],
    panels: SurfaceRect[] = [],
    marks: SurfaceRect[] = [];
  const rect = (
    r: Run,
    start: number,
    end: number,
    side: number,
    width: number,
  ): SurfaceRect => {
    if (r.alongX)
      return {
        minX: start,
        maxX: end,
        minZ: r.fixed + side - width / 2,
        maxZ: r.fixed + side + width / 2,
      };
    return {
      minX: r.fixed + side - width / 2,
      maxX: r.fixed + side + width / 2,
      minZ: start,
      maxZ: end,
    };
  };
  const endpoints = new Map<string, { x: number; z: number; axes: number }>();
  for (const run of roadRuns(paths)) {
    pavement.push(rect(run, run.start, run.end, 0, 2.4));
    for (const end of [run.start, run.end]) {
      const x = run.alongX ? end : run.fixed,
        z = run.alongX ? run.fixed : end;
      const key = `${x}:${z}`;
      const point = endpoints.get(key) ?? { x, z, axes: 0 };
      point.axes |= run.alongX ? 1 : 2;
      endpoints.set(key, point);
    }
    const count = Math.min(96, Math.floor((run.end - run.start) / 3.8));
    for (let i = 0; i < count; i++) {
      const center = run.start + ((run.end - run.start) * (i + 0.5)) / count;
      panels.push(rect(run, center - 1.4, center + 1.4, 0, 1.55));
      if (i % 3 === 0)
        marks.push(rect(run, center - 0.09, center + 0.09, 0, 0.7));
    }
  }
  for (const { x, z, axes } of endpoints.values())
    if (axes === 3)
      pavement.push({
        minX: x - 1.2,
        maxX: x + 1.2,
        minZ: z - 1.2,
        maxZ: z + 1.2,
      });
  const surface = unionSurfaces(pavement);
  const add = (
    rectangles: SurfaceRect[],
    y: number,
    h: number,
    color: string,
    batch: VoxelBatch,
  ) => {
    for (const r of unionSurfaces(rectangles)) {
      const x = (r.minX + r.maxX) / 2,
        z = (r.minZ + r.maxZ) / 2;
      const tint =
        batch === lights && hash(`${r.minX}:${r.minZ}`) % 2 === 0
          ? "#ff67c1"
          : color;
      batch.add(x, y, z, r.maxX - r.minX, h, r.maxZ - r.minZ, tint);
    }
  };
  add(surface, 0.035, 0.04, "#354650", blocks);
  add(panels, 0.0775, 0.025, "#3b505e", blocks);
  add(boundaryRails(surface, 0.16), 0.093, 0.024, "#647783", blocks);
  add(marks, 0.123, 0.024, "#65ddeb", lights);
}
