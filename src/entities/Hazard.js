/**
 * Biosphera - Environmental Hazards
 */

export class Hazard {
  constructor(x, y, radius = 40, dps = 35) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.dps = dps;
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.pulsePhase += dt * 2;
  }
}
