/** Follow small stair rises without changing the player's collision body. */
export class CameraHeight {
  private height?: number;
  reset(height: number) {
    this.height = height;
  }
  sample(height: number, grounded: boolean, dt: number): number {
    if (
      this.height === undefined ||
      Math.abs(height - this.height) > 1 ||
      !grounded
    ) {
      this.height = height;
    } else {
      this.height += (height - this.height) * (1 - Math.exp(-12 * dt));
    }
    return this.height;
  }
}
