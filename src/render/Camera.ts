/**
 * Biosphera - Viewport & Camera Controller
 * Supports pan, zoom, coordinate transformation, and organism tracking.
 */

import { Organism } from '../entities/Organism';

export class Camera {
  public x: number;
  public y: number;
  public zoom: number;
  public minZoom: number;
  public maxZoom: number;

  public target: Organism | null;

  constructor(initialX: number = 0, initialY: number = 0, initialZoom: number = 0.8) {
    this.x = initialX;
    this.y = initialY;
    this.zoom = initialZoom;
    this.minZoom = 0.2;
    this.maxZoom = 3.5;
    this.target = null;
  }

  public follow(org: Organism | null): void {
    this.target = org;
  }

  public update(screenWidth: number, screenHeight: number): void {
    if (this.target && !this.target.isDead) {
      // Smooth lerp towards target
      const targetScreenX = this.target.x - (screenWidth / 2) / this.zoom;
      const targetScreenY = this.target.y - (screenHeight / 2) / this.zoom;
      this.x += (targetScreenX - this.x) * 0.08;
      this.y += (targetScreenY - this.y) * 0.08;
    } else if (this.target && this.target.isDead) {
      this.target = null;
    }
  }

  public zoomAt(delta: number, screenX: number, screenY: number): void {
    this.target = null; // Break tracking on manual zoom
    const zoomFactor = delta < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

    // Zoom centered around the mouse cursor
    const worldX = this.x + screenX / this.zoom;
    const worldY = this.y + screenY / this.zoom;

    this.zoom = newZoom;
    this.x = worldX - screenX / this.zoom;
    this.y = worldY - screenY / this.zoom;
  }

  public pan(dx: number, dy: number): void {
    this.target = null; // Break tracking on manual pan
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  public screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.x + sx / this.zoom,
      y: this.y + sy / this.zoom
    };
  }
}
