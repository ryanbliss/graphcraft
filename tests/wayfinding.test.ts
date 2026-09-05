import { expect, it } from "vitest";
import { wayfindingSigns } from "../src/world/wayfinding.ts";
it("puts independently readable directions outside both faces of a path-facing board", () => {
  for (const direction of [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ]) {
    const faces = wayfindingSigns("api", "API", "#ffffff", 10, 20, direction);
    expect(faces).toHaveLength(2);
    expect(new Set(faces.map((face) => face.title[0]))).toEqual(
      new Set(["↑", "↓"]),
    );
    for (const face of faces) {
      const normal = {
        x: Math.sin(face.rotation!),
        z: Math.cos(face.rotation!),
      };
      expect((face.x - 10) * normal.x + (face.z - 20) * normal.z).toBeCloseTo(
        0.27,
      );
      expect(
        Math.abs(normal.x * direction.x + normal.z * direction.z),
      ).toBeCloseTo(1);
      expect(face.id).toBe("api");
    }
  }
});
