/**
 * Biosphera - Viewport & Camera Controller
 */

export class Camera {
  constructor(initialX = 0, initialY = 0, initialZoom = 0.8) {
    this.x = initialX;
    this.y = initialY;
    this.zoom = initialZoom;
    this.minZoom = 0.2;
    this.maxZoom = 3.5;
    this.target = null;
    this.pixelRatio = 1; // set by the app on resize (HiDPI backing store)
  }

  /** Device pixels per world unit: zoom multiplied by the backing-store ratio. */
  get scale() {
    return this.zoom * (this.pixelRatio || 1);
  }

  follow(org) {
    this.target = org;
  }

  update(screenWidth, screenHeight, dt = 1 / 60) {
    if (this.target && !this.target.isDead) {
      const targetScreenX = this.target.x - (screenWidth / 2) / this.scale;
      const targetScreenY = this.target.y - (screenHeight / 2) / this.scale;
      const t = 1 - Math.pow(0.92, dt * 60); // frame-rate independent smoothing
      this.x += (targetScreenX - this.x) * t;
      this.y += (targetScreenY - this.y) * t;
    } else if (this.target && this.target.isDead) {
      this.target = null;
    }
  }

  zoomAt(delta, screenX, screenY) {
    this.target = null;
    const zoomFactor = delta < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

    const worldX = this.x + screenX / this.scale;
    const worldY = this.y + screenY / this.scale;

    this.zoom = newZoom;
    this.x = worldX - screenX / this.scale;
    this.y = worldY - screenY / this.scale;
  }

  zoomByRatio(ratio, screenX, screenY) {
    this.target = null;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * ratio));
    const worldX = this.x + screenX / this.scale;
    const worldY = this.y + screenY / this.scale;
    this.zoom = newZoom;
    this.x = worldX - screenX / this.scale;
    this.y = worldY - screenY / this.scale;
  }

  pan(dx, dy) {
    this.target = null;
    this.x -= dx / this.scale;
    this.y -= dy / this.scale;
  }

  screenToWorld(sx, sy) {
    return {
      x: this.x + sx / this.scale,
      y: this.y + sy / this.scale
    };
  }
}
