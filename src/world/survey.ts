import type { Building, Region, WorldLayout } from "./layout.ts";

export type SurveyTarget = Region | Building;
export interface SurveyFrame {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}
export interface SurveyEntry {
  gate: { x: number; z: number };
  position: { x: number; z: number };
  lookAt: { x: number; z: number };
}
const compareTargets = (a: SurveyTarget, b: SurveyTarget) =>
  a.directory.localeCompare(b.directory) || a.id.localeCompare(b.id);

export class SurveyHierarchy {
  private targets = new Map<string, SurveyTarget>();
  private descendants = new Map<string, SurveyTarget[]>();
  private heights = new Map<string, number>();
  private gates = new Map<string, { x: number; z: number }>();
  private packages: Region[];

  constructor(private layout: WorldLayout) {
    this.packages = layout.regions.filter((region) => !region.parentId);
    for (const target of [...layout.regions, ...layout.buildings]) {
      this.targets.set(target.id, target);
      if (!target.parentId) continue;
      const siblings = this.descendants.get(target.parentId);
      if (siblings) siblings.push(target);
      else this.descendants.set(target.parentId, [target]);
    }
    this.packages.sort(compareTargets);
    for (const children of this.descendants.values())
      children.sort(compareTargets);
    const height = (target: SurveyTarget): number => {
      const value =
        "nodes" in target
          ? target.height
          : Math.max(0, ...(this.descendants.get(target.id) ?? []).map(height));
      this.heights.set(target.id, value);
      return value;
    };
    for (const root of this.packages) height(root);
    for (const path of layout.paths) {
      const point = path.points.at(-1);
      if (point) this.gates.set(path.target, point);
    }
    // Outgoing paths begin at the target's own entrance.
    for (const path of layout.paths) {
      const point = path.points[0];
      if (point) this.gates.set(path.source, point);
    }
  }

  get(id: string): SurveyTarget | undefined {
    return this.targets.get(id);
  }
  roots(): Region[] {
    return [...this.packages];
  }
  private sameScope(parent: SurveyTarget, child: SurveyTarget): boolean {
    return (
      !("nodes" in child) &&
      parent.packageId === child.packageId &&
      this.descendants.get(parent.id)?.length === 1 &&
      Math.abs(parent.x - child.x) < 0.001 &&
      Math.abs(parent.z - child.z) < 0.001 &&
      Math.abs(parent.width - child.width) < 0.001 &&
      Math.abs(parent.depth - child.depth) < 0.001
    );
  }
  private unwrap(target: SurveyTarget): SurveyTarget {
    let current = target;
    for (;;) {
      const child = this.descendants.get(current.id)?.[0];
      if (!child || !this.sameScope(current, child)) return current;
      current = child;
    }
  }
  children(id?: string): SurveyTarget[] {
    if (id === undefined) return this.roots();
    const target = this.get(id);
    if (!target) return [];
    return (this.descendants.get(this.unwrap(target).id) ?? [])
      .map((child) => this.unwrap(child))
      .sort(compareTargets);
  }
  trail(id: string): SurveyTarget[] {
    const ancestors: SurveyTarget[] = [];
    let current = this.get(id);
    while (current) {
      ancestors.push(current);
      current = current.parentId ? this.get(current.parentId) : undefined;
    }
    ancestors.reverse();
    const trail: SurveyTarget[] = [];
    for (let start = 0; start < ancestors.length;) {
      let end = start;
      while (
        end + 1 < ancestors.length &&
        this.sameScope(ancestors[end], ancestors[end + 1])
      )
        end++;
      trail.push(ancestors[start === 0 ? 0 : end]);
      if (start === 0 && end === ancestors.length - 1 && end > 0)
        trail.push(ancestors[end]);
      start = end + 1;
    }
    return trail;
  }
  parent(id: string): Region | undefined {
    const parent = this.trail(id).at(-2);
    return parent && !("nodes" in parent) ? parent : undefined;
  }
  frame(id?: string): SurveyFrame | undefined {
    if (id === undefined)
      return {
        x: 0,
        z: 0,
        width: this.layout.width,
        depth: this.layout.depth,
        height: Math.max(
          0,
          ...this.packages.map((root) => this.heights.get(root.id) ?? 0),
        ),
      };
    const target = this.get(id);
    if (!target) return;
    return {
      x: target.x,
      z: target.z,
      width: target.width,
      depth: target.depth,
      height: this.heights.get(id) ?? 0,
    };
  }
  entry(id: string): SurveyEntry | undefined {
    const target = this.get(id);
    if (!target) return;
    const endpoint = this.gates.get(id) ?? {
      x: target.x,
      z: target.z + target.depth / 2,
    };
    return {
      gate: { ...endpoint },
      position: { x: endpoint.x, z: endpoint.z + 4 },
      lookAt: { x: endpoint.x, z: endpoint.z - 4 },
    };
  }
}
