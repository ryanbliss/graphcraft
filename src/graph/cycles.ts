import type { GraphEdge, GraphNode } from "./types.ts";
export function findCycles(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const forward = new Map<string, string[]>(),
    reverse = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.kind === "external") continue;
    forward.set(node.id, []);
    reverse.set(node.id, []);
  }
  for (const edge of edges) {
    if (edge.kind === "type" || !forward.has(edge.target)) continue;
    forward.get(edge.source)?.push(edge.target);
    reverse.get(edge.target)?.push(edge.source);
  }
  const visited = new Set<string>(),
    order: string[] = [];
  for (const id of forward.keys()) {
    if (visited.has(id)) continue;
    visited.add(id);
    const stack: { id: string; index: number }[] = [{ id, index: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1],
        neighbors = forward.get(frame.id)!;
      if (frame.index < neighbors.length) {
        const next = neighbors[frame.index++];
        if (!visited.has(next)) {
          visited.add(next);
          stack.push({ id: next, index: 0 });
        }
      } else {
        order.push(frame.id);
        stack.pop();
      }
    }
  }
  visited.clear();
  const groups: string[][] = [];
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    if (visited.has(id)) continue;
    const members: string[] = [],
      stack = [id];
    visited.add(id);
    while (stack.length) {
      const next = stack.pop()!;
      members.push(next);
      for (const parent of reverse.get(next)!) {
        if (visited.has(parent)) continue;
        visited.add(parent);
        stack.push(parent);
      }
    }
    if (members.length > 1 || forward.get(id)!.includes(id))
      groups.push(members.sort());
  }
  return groups.sort((a, b) => a[0].localeCompare(b[0]));
}
