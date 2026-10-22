/**
 * Biosphera - Environmental Hazards (Toxic vents & Radiation pools)
 */

import { SpatialEntity } from '../engine/SpatialHash';

export class Hazard implements SpatialEntity {
  public id: string;
  public x: number;
  public y: number;
  public radius: number;
  public dps: number; // Damage per second
  public pulsePhase: number;

  constructor(x: number, y: number, radius: number = 40, dps: number = 35) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.dps = dps;
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  public update(dt: number): void {
    this.pulsePhase += dt * 2;
  }
}
