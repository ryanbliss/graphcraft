import { describe, expect, it } from "vitest";
import { SurveyHierarchy } from "../src/world/survey.ts";
import type { Building, Region, WorldLayout } from "../src/world/layout.ts";

function region(id: string, parentId?: string, x = 0, width = 200): Region {
  return {
    id,
    parentId,
    packageId: "package",
    directory: id,
    name: id,
    x,
    z: 0,
    width,
    depth: 100,
    level: parentId ? 1 : 0,
  };
}
function building(id: string, parentId: string, height: number): Building {
  return {
    id,
    parentId,
    packageId: "package",
    directory: id,
    name: id,
    x: -50,
    z: 0,
    width: 60,
    depth: 40,
    height,
    stories: 1,
    hallX: -50,
    template: "studio",
    kind: "module",
    nodes: [],
    rooms: [],
  };
}
function layout(): WorldLayout {
  return {
    regions: [
      region("package"),
      region("wrapper", "package"),
      region("branch", "wrapper"),
      region("alpha", "branch", -50, 80),
      region("beta", "branch", 50, 80),
    ],
    buildings: [
      building("alpha/files", "alpha", 15),
      building("beta/files", "beta", 31),
    ],
    districts: [],
    positions: new Map(),
    paths: [],
    width: 300,
    depth: 200,
    spawn: { x: 0, z: 104 },
  };
}

describe("survey hierarchy", () => {
  it("keeps packages drillable and skips only equivalent wrappers in navigation", () => {
    const survey = new SurveyHierarchy(layout());
    expect(survey.roots().map((target) => target.id)).toEqual(["package"]);
    expect(survey.children().map((target) => target.id)).toEqual(["package"]);
    expect(survey.children("package").map((target) => target.id)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(survey.trail("alpha/files").map((target) => target.id)).toEqual([
      "package",
      "alpha",
      "alpha/files",
    ]);
    expect(survey.parent("alpha")?.id).toBe("package");
    expect(survey.parent("alpha/files")?.id).toBe("alpha");
    expect(survey.parent("package")).toBeUndefined();
    expect(survey.children("alpha/files")).toEqual([]);
    expect(survey.get("branch")?.id).toBe("branch");
  });

  it("retains mixed-content folders and single children that cover different space", () => {
    const mixed = layout();
    mixed.buildings.push(building("package/direct-file", "package", 10));
    const survey = new SurveyHierarchy(mixed);
    expect(survey.children("package").map((target) => target.id)).toEqual([
      "branch",
      "package/direct-file",
    ]);
    expect(survey.trail("alpha").map((target) => target.id)).toEqual([
      "package",
      "branch",
      "alpha",
    ]);
    const shifted = layout();
    shifted.regions[1].x = 4;
    const shiftedSurvey = new SurveyHierarchy(shifted);
    expect(shiftedSurvey.children("package")[0].id).toBe("wrapper");
    expect(shiftedSurvey.parent("wrapper")?.id).toBe("package");
  });

  it("frames descendant roofs and uses the recorded entrance rather than the parcel center", () => {
    const source = layout();
    source.paths = [
      {
        source: "package",
        target: "city:entrance",
        points: [
          { x: 23, z: 50 },
          { x: 23, z: 100 },
        ],
      },
      {
        source: "alpha",
        target: "package",
        points: [
          { x: -50, z: 50 },
          { x: 23, z: 50 },
        ],
      },
    ];
    const survey = new SurveyHierarchy(source);
    expect(survey.frame("package")).toEqual({
      x: 0,
      z: 0,
      width: 200,
      depth: 100,
      height: 31,
    });
    expect(survey.frame()).toEqual({
      x: 0,
      z: 0,
      width: 300,
      depth: 200,
      height: 31,
    });
    expect(survey.entry("package")).toEqual({
      gate: { x: 23, z: 50 },
      position: { x: 23, z: 54 },
      lookAt: { x: 23, z: 46 },
    });
    expect(survey.entry("beta")?.gate).toEqual({ x: 50, z: 50 });
    expect(survey.get("missing")).toBeUndefined();
    expect(survey.frame("missing")).toBeUndefined();
    expect(survey.entry("missing")).toBeUndefined();
    expect(survey.children("missing")).toEqual([]);
    expect(survey.trail("missing")).toEqual([]);
  });
});
