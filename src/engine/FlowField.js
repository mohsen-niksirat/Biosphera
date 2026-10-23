/**
 * Biosphera - Water Current Flow Field
 * A smooth, slowly evolving gyre system that pushes organisms and drifting food,
 * adding environmental pressure organisms must adapt to.
 */

export class FlowField {
  constructor(width = 2400, height = 1800) {
    this.width = width;
    this.height = height;
    this.time = Math.random() * 100;
  }

  update(dt) {
    this.time += dt * 0.12;
  }

  /** Sample the current velocity (px/s) at a world position. */
  sample(x, y) {
    const nx = x / this.width;
    const ny = y / this.height;
    const t = this.time;

    // Two counter-rotating gyres + a slow global drift
    const vx =
      Math.sin(ny * Math.PI * 3 + t) * 22 +
      Math.sin((nx + ny) * Math.PI * 2 - t * 0.6) * 12;
    const vy =
      Math.cos(nx * Math.PI * 3 - t * 0.8) * 18 +
      Math.cos((nx - ny) * Math.PI * 2 + t * 0.5) * 10;

    return { vx, vy };
  }
}
