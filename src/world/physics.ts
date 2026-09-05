export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Collider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}
export class CollisionWorld {
  private cells = new Map<string, Collider[]>();
  add(box: Collider) {
    for (let x = Math.floor(box.minX / 12); x <= Math.floor(box.maxX / 12); x++)
      for (
        let z = Math.floor(box.minZ / 12);
        z <= Math.floor(box.maxZ / 12);
        z++
      ) {
        const key = `${x},${z}`,
          cell = this.cells.get(key);
        if (cell) cell.push(box);
        else this.cells.set(key, [box]);
      }
  }
  nearby(position: Vec3): Set<Collider> {
    const boxes = new Set<Collider>();
    for (
      let x = Math.floor((position.x - 0.5) / 12);
      x <= Math.floor((position.x + 0.5) / 12);
      x++
    )
      for (
        let z = Math.floor((position.z - 0.5) / 12);
        z <= Math.floor((position.z + 0.5) / 12);
        z++
      )
        for (const box of this.cells.get(`${x},${z}`) ?? []) boxes.add(box);
    return boxes;
  }
}
export class PlayerPhysics {
  position: Vec3 = { x: 0, y: 1.75, z: 0 };
  velocity: Vec3 = { x: 0, y: 0, z: 0 };
  grounded = true;
  constructor(private world: CollisionWorld) {}
  teleport(x: number, z: number, floorY = 0) {
    this.position = { x, y: floorY + 1.75, z };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.grounded = true;
  }
  step(
    dt: number,
    direction: { x: number; z: number },
    jump: boolean,
    sprint: boolean,
  ) {
    const speed = sprint ? 13 : 7,
      damping = 1 - Math.exp(-14 * dt);
    this.velocity.x += (direction.x * speed - this.velocity.x) * damping;
    this.velocity.z += (direction.z * speed - this.velocity.z) * damping;
    if (jump && this.grounded) {
      this.velocity.y = 8;
      this.grounded = false;
    }
    this.velocity.y -= 24 * dt;
    const height = 1.75,
      radius = 0.38;
    for (const axis of ["x", "z"] as const) {
      this.position[axis] += this.velocity[axis] * dt;
      for (const box of this.world.nearby(this.position)) {
        if (
          this.position.y - height >= box.maxY - 0.01 ||
          this.position.y <= box.minY
        )
          continue;
        const cx = Math.max(box.minX, Math.min(this.position.x, box.maxX));
        const cz = Math.max(box.minZ, Math.min(this.position.z, box.maxZ));
        if (
          (this.position.x - cx) ** 2 + (this.position.z - cz) ** 2 >=
          radius ** 2 - 1e-8
        )
          continue;
        const rise = box.maxY - (this.position.y - height);
        if (this.grounded && rise > 0 && rise <= 0.32) {
          const raisedY = box.maxY + height;
          const headBlocked = [...this.world.nearby(this.position)].some(
            (other) =>
              other !== box &&
              other.minY < raisedY &&
              other.maxY > this.position.y &&
              this.position.x + radius > other.minX &&
              this.position.x - radius < other.maxX &&
              this.position.z + radius > other.minZ &&
              this.position.z - radius < other.maxZ,
          );
          if (!headBlocked) {
            this.position.y = raisedY;
            continue;
          }
        }
        if (axis === "x")
          this.position.x =
            this.velocity.x > 0 ? box.minX - radius : box.maxX + radius;
        else
          this.position.z =
            this.velocity.z > 0 ? box.minZ - radius : box.maxZ + radius;
        this.velocity[axis] = 0;
      }
    }
    const previousY = this.position.y;
    this.position.y += this.velocity.y * dt;
    this.grounded = false;
    for (const box of this.world.nearby(this.position)) {
      if (
        this.position.x + radius <= box.minX ||
        this.position.x - radius >= box.maxX ||
        this.position.z + radius <= box.minZ ||
        this.position.z - radius >= box.maxZ
      )
        continue;
      if (
        this.velocity.y < 0 &&
        previousY - height >= box.maxY - 0.02 &&
        this.position.y - height < box.maxY
      ) {
        this.position.y = box.maxY + height;
        this.velocity.y = 0;
        this.grounded = true;
      }
      if (
        this.velocity.y > 0 &&
        previousY <= box.minY &&
        this.position.y >= box.minY
      ) {
        this.position.y = box.minY - 0.01;
        this.velocity.y = 0;
      }
    }
    if (this.position.y < height) {
      this.position.y = height;
      this.velocity.y = 0;
      this.grounded = true;
    }
  }
}
