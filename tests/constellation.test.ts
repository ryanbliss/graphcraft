import { describe, expect, it, vi } from "vitest";
import {
  celestialEdges,
  celestialPositions,
  placeCelestialLabels,
  createCelestialModel,
  createCelestialSpace,
  celestialContext,
  orbitalPositions,
  ConstellationMap,
  CelestialLabelLayout,
  type CelestialItem,
} from "../src/world/constellation.ts";
import { layoutWorld } from "../src/world/layout.ts";
import { analyzeProject } from "../src/graph/analyze.ts";
import type { ProjectGraph } from "../src/graph/types.ts";

function project(packages: number, files: number): ProjectGraph {
  const graph: ProjectGraph = {
    name: "Celestial fixture",
    nodes: [],
    packages: [],
    edges: [],
    diagnostics: [],
    cycles: [],
    seed: 17,
  };
  for (let pkg = 0; pkg < packages; pkg++) {
    const packageId = `package-${pkg}`,
      directory = packageId;
    graph.packages.push({ id: packageId, name: packageId, directory });
    for (let file = 0; file < files; file++) {
      const folder = `${directory}/src/room-${file % 3}`;
      graph.nodes.push({
        id: `${folder}/file-${file}.ts`,
        name: `file-${file}.ts`,
        directory: folder,
        packageId,
        kind: "module",
        lines: 10,
        exports: [],
        components: [],
        incoming: 0,
        outgoing: 0,
      });
    }
  }
  return graph;
}

describe("hierarchical constellation", () => {
  it("groups the overview by real top-level folders while preserving package names inside", () => {
    const files = [
      { path: "notes.json", content: "{}" },
      { path: "backend/package.json", content: '{"name":"@example/server"}' },
    ];
    for (let index = 0; index < 26; index++)
      files.push({
        path: `frontend/packages/tool-${index}/package.json`,
        content: JSON.stringify({ name: `@example/tool-${index}` }),
      });
    const graph = analyzeProject(files, "Workspace");
    const model = createCelestialModel(graph, layoutWorld(graph));
    expect(model.root.children.map((item) => item.name).sort()).toEqual([
      "Workspace",
      "backend",
      "frontend",
    ]);
    const frontend = model.root.children.find(
      (item) => item.name === "frontend",
    )!;
    expect(frontend.path).toBe("frontend");
    const packages = [...model.items.values()].filter(
      (item) => item.kind === "package" && item.path.startsWith("frontend/"),
    );
    expect(packages).toHaveLength(26);
    for (const pkg of packages) {
      expect(pkg.name).toMatch(/^@example\/tool-/);
      let ancestor = pkg;
      while (ancestor.parentId !== frontend.id)
        ancestor = model.items.get(ancestor.parentId!)!;
      expect(ancestor.parentId).toBe(frontend.id);
    }
    expect(new Set(frontend.files)).toEqual(
      new Set(
        graph.nodes
          .filter((node) => node.id.startsWith("frontend/"))
          .map((node) => node.id),
      ),
    );
  });
  it("keeps each label attached through camera travel and eases collision adjustments after settling", () => {
    const labels = new CelestialLabelLayout();
    const points = Array.from({ length: 17 }, (_, index) => ({
      id: String(index),
      x: 640,
      y: 360,
      width: 220,
      height: 40,
    }));
    let previous = labels.update(points, 1280, 720, 0, false);
    for (let frame = 1; frame <= 240; frame++) {
      const next = labels.update(points, 1280, 720, frame / 60, false);
      next.forEach((rectangle, index) =>
        expect(
          Math.hypot(
            rectangle.x - previous[index].x,
            rectangle.y - previous[index].y,
          ),
        ).toBeLessThanOrEqual(4.001),
      );
      previous = next;
    }
    const moving = points
      .slice(1)
      .map((point) => ({ ...point, x: point.x + 180, y: point.y - 70 }));
    const during = labels.update(moving, 1280, 720, 4.02, true);
    during.forEach((rectangle, index) => {
      expect(rectangle.x - previous[index + 1].x).toBeCloseTo(180, 8);
      expect(rectangle.y - previous[index + 1].y).toBeCloseTo(-70, 8);
    });
    for (let index = 0; index < previous.length; index++)
      for (const other of previous.slice(index + 1)) {
        const rectangle = previous[index];
        expect(
          rectangle.x < other.x + other.width &&
            rectangle.x + rectangle.width > other.x &&
            rectangle.y < other.y + other.height &&
            rectangle.y + rectangle.height > other.y,
        ).toBe(false);
      }
  });

  it("fits crowded labels at their measured widths", () => {
    const rectangles = placeCelestialLabels(
      Array.from({ length: 24 }, (_, index) => ({
        x: 640,
        y: 360,
        width: index % 2 ? 360 : 220,
        height: 40,
      })),
      1280,
      720,
    );
    for (let index = 0; index < rectangles.length; index++) {
      const rectangle = rectangles[index];
      expect(rectangle.x).toBeGreaterThanOrEqual(0);
      expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(1280);
      expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(630);
      for (const other of rectangles.slice(index + 1))
        expect(
          rectangle.x < other.x + other.width &&
            rectangle.x + rectangle.width > other.x &&
            rectangle.y < other.y + other.height &&
            rectangle.y + rectangle.height > other.y,
        ).toBe(false);
    }
  });

  it("frames a sky entry at its current galaxy without navigating through the universe", () => {
    const element = () => ({
      clientWidth: 1280,
      clientHeight: 720,
      style: { setProperty() {} },
      classList: { add() {} },
      setAttribute() {},
      append() {},
      replaceChildren() {},
      remove() {},
      getContext: () => ({
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect() {},
        measureText: (text: string) => ({ width: text.length * 7 }),
      }),
    });
    vi.stubGlobal("document", {
      createElement: element,
      createElementNS: element,
    });
    try {
      const graph = project(2, 18);
      const navigate = vi.fn();
      const map = new ConstellationMap(
        graph,
        layoutWorld(graph),
        document.createElement("div"),
        {
          select: vi.fn(),
          navigate,
        },
      );
      map.open();
      map.moveOrbits(1800);
      navigate.mockClear();
      const galaxy = map.model.root.children[1];
      const entry = map.entryView(galaxy.id);
      expect(navigate).not.toHaveBeenCalled();
      const expected = orbitalPositions(
        map.model,
        createCelestialSpace(map.model, 1280 / 720),
        [galaxy.id],
        1800,
      );
      expect(entry.point).toEqual(expected.get(galaxy.id));
      map.open(galaxy.id, true);
      expect(navigate).toHaveBeenCalledTimes(1);
      const [destination] = navigate.mock.calls[0];
      expect(destination.distanceTo(entry.point)).toBeLessThan(entry.span);
      expect(map.moveOrbits(0).length()).toBe(0);
      map.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("synchronizes an unopened branch to the current orbit time without a later camera drift", () => {
    const graph = project(2, 18);
    const model = createCelestialModel(graph, layoutWorld(graph));
    const initial = createCelestialSpace(model);
    const places = createCelestialSpace(model);
    const previouslyVisible = model.root.children[0];
    const elapsed = 1800;
    const synchronize = (ids: string[]) => {
      for (const [id, point] of orbitalPositions(model, initial, ids, elapsed))
        places.get(id)!.point.copy(point);
    };
    synchronize(
      celestialContext(model, previouslyVisible).map((item) => item.id),
    );
    const newlyOpened = model.root.children[1].children[0].children.at(-1)!;
    expect(places.get(newlyOpened.id)!.point).toEqual(
      initial.get(newlyOpened.id)!.point,
    );
    const context = celestialContext(model, newlyOpened).map((item) => item.id);
    synchronize(context);
    const cameraTarget = places.get(newlyOpened.id)!.point.clone();
    expect(
      cameraTarget.distanceTo(initial.get(newlyOpened.id)!.point),
    ).toBeGreaterThan(1);
    const complete = orbitalPositions(
      model,
      initial,
      model.items.keys(),
      elapsed,
    );
    for (const id of context)
      expect(places.get(id)!.point).toEqual(complete.get(id));
    synchronize(context);
    expect(places.get(newlyOpened.id)!.point).toEqual(cameraTarget);
  });

  it("moves descendants with their parents while preserving each orbital path", () => {
    const graph = project(2, 18);
    const model = createCelestialModel(graph, layoutWorld(graph));
    const initial = createCelestialSpace(model);
    const planet = model.root.children[0].children[0].children[0];
    const moon = planet.children[0];
    const positions = orbitalPositions(model, initial, [moon.id], 20);
    expect(positions).toEqual(orbitalPositions(model, initial, [moon.id], 20));
    expect(positions.get(planet.id)).not.toEqual(initial.get(planet.id)!.point);
    expect(positions.get(moon.id)).not.toEqual(initial.get(moon.id)!.point);
    const before = initial
      .get(moon.id)!
      .point.clone()
      .sub(initial.get(planet.id)!.point);
    const after = positions
      .get(moon.id)!
      .clone()
      .sub(positions.get(planet.id)!);
    expect(Math.hypot(after.x, after.z / 0.76)).toBeCloseTo(
      Math.hypot(before.x, before.z / 0.76),
      8,
    );
    expect(after.y).toBeCloseTo(before.y, 8);
    const paused = orbitalPositions(model, initial, [moon.id], 0);
    expect(
      paused.get(moon.id)!.distanceTo(initial.get(moon.id)!.point),
    ).toBeLessThan(1e-10);
  });

  it("keeps nested bodies at stable, distinct positions with their parents in context", () => {
    const graph = project(17, 18);
    const model = createCelestialModel(graph, layoutWorld(graph));
    const places = createCelestialSpace(model);
    const galaxy = model.root.children[0];
    const system = galaxy.children[0];
    const planet = system.children[0];
    const moon = planet.children[0];
    for (const child of [galaxy, system, planet, moon]) {
      const place = places.get(child.id)!;
      const parent = places.get(child.parentId!)!;
      expect(place.span).toBeLessThan(parent.span);
      expect(place.point.distanceTo(parent.point)).toBeGreaterThan(place.span);
      expect(place.point.distanceTo(parent.point)).toBeLessThan(
        parent.span * 1.6,
      );
    }
    const context = celestialContext(model, planet);
    const ids = context.map((item) => item.id);
    for (const item of [galaxy, system, planet, moon])
      expect(ids).toContain(item.id);
    expect(ids).toContain(model.root.children[1].id);
    expect(context.length).toBeLessThanOrEqual(160);
    expect(new Set(ids).size).toBe(ids.length);
    expect(places).toEqual(createCelestialSpace(model));
  });

  it.each([17, 24])(
    "places %i crowded labels without overlap at desktop size",
    (count) => {
      const rectangles = placeCelestialLabels(
        Array.from({ length: count }, () => ({ x: 640, y: 360 })),
        1280,
        720,
      );
      expect(rectangles).toHaveLength(count);
      for (let index = 0; index < rectangles.length; index++) {
        const rectangle = rectangles[index];
        expect(rectangle.x).toBeGreaterThanOrEqual(0);
        expect(rectangle.y).toBeGreaterThanOrEqual(200);
        expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(1280);
        expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(630);
        for (const other of rectangles.slice(index + 1)) {
          const overlaps =
            rectangle.x < other.x + other.width &&
            rectangle.x + rectangle.width > other.x &&
            rectangle.y < other.y + other.height &&
            rectangle.y + rectangle.height > other.y;
          expect(overlaps).toBe(false);
        }
      }
    },
  );

  it("maps package, building, and room membership to exact file moons", () => {
    const graph = project(1, 18);
    const model = createCelestialModel(graph, layoutWorld(graph));
    const galaxy = model.root.children[0],
      system = galaxy.children[0];
    expect(galaxy.kind).toBe("package");
    expect(system.kind).toBe("building");
    expect(system.children.every((child) => child.kind === "room")).toBe(true);
    const moons = system.children.flatMap((child) => child.children);
    expect(moons.every((moon) => moon.kind === "file")).toBe(true);
    expect(moons.map((moon) => moon.sourceId).sort()).toEqual(
      graph.nodes.map((node) => node.id).sort(),
    );
    for (const moon of moons)
      expect(model.sources.get(moon.sourceId!)?.parentId).toBe(moon.parentId);
  });

  it("bounds every drill level without dropping or inventing project entities", () => {
    const graph = project(120, 1);
    const model = createCelestialModel(graph, layoutWorld(graph));
    const leaves: string[] = [];
    for (const group of model.root.children) {
      expect(group.name).toBe(
        `${group.children[0].name} +${group.children.length - 1} more`,
      );
    }
    const visit = (item: CelestialItem) => {
      expect(item.children.length).toBeLessThanOrEqual(24);
      if (item.kind === "file") leaves.push(item.sourceId!);
      const members = item.children.flatMap((child) => child.files);
      if (item.children.length)
        expect(members.sort()).toEqual([...item.files].sort());
      for (const child of item.children) {
        expect(child.parentId).toBe(item.id);
        visit(child);
      }
    };
    visit(model.root);
    expect(leaves.sort()).toEqual(graph.nodes.map((node) => node.id).sort());
    expect(new Set(leaves).size).toBe(graph.nodes.length);
  });

  it("aggregates directed edges only between visible owners and caps dense views", () => {
    const graph = project(18, 2);
    const model = createCelestialModel(graph, layoutWorld(graph));
    for (const source of graph.nodes)
      for (const target of graph.nodes) {
        if (source.id !== target.id)
          graph.edges.push({
            source: source.id,
            target: target.id,
            kind: "import",
            specifier: target.id,
          });
      }
    const edges = celestialEdges(graph, model.root.children);
    expect(edges).toHaveLength(120);
    expect(
      edges.every((edge) => edge.source !== edge.target && edge.weight === 4),
    ).toBe(true);
    const pair = model.root.children.slice(0, 2);
    expect(celestialEdges(graph, pair)).toEqual(
      [
        { source: pair[0].id, target: pair[1].id, weight: 4 },
        { source: pair[1].id, target: pair[0].id, weight: 4 },
      ].sort((a, b) => a.source.localeCompare(b.source)),
    );
    const positions = celestialPositions(model.root.children);
    expect(positions).toEqual(celestialPositions(model.root.children));
    expect(
      new Set([...positions.values()].map((point) => point.toArray().join(",")))
        .size,
    ).toBe(18);
  });
});
