import type { Sign } from "./signs.ts";

/** Each face has its own orientation and arrow, so the back never reads mirrored. */
export function wayfindingSigns(
  id: string,
  name: string,
  color: string,
  x: number,
  z: number,
  direction: { x: number; z: number },
): Sign[] {
  const yaw = Math.abs(direction.x) > Math.abs(direction.z) ? Math.PI / 2 : 0;
  return [yaw, yaw + Math.PI].map((rotation) => {
    const forward =
      direction.x * Math.sin(rotation) + direction.z * Math.cos(rotation);
    return {
      id,
      title: `${forward < 0 ? "↑" : "↓"} ${name}`,
      subtitle: "",
      color,
      x: x + Math.sin(rotation) * 0.27,
      y: 4.5,
      z: z + Math.cos(rotation) * 0.27,
      width: 7.3,
      height: 1.7,
      rotation,
    };
  });
}
