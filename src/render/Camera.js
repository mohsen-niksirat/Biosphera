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
  }

  follow(org) {
    this.target = org;
  }

  update(screenWidth, screenHeight) {
    if (this.target && !this.target.isDead) {
      const targetScreenX = this.target.x - (screenWidth / 2) / this.zoom;
      const targetScreenY = this.target.y - (screenHeight / 2) / this.zoom;
      this.x += (targetScreenX - this.x) * 0.08;
      this.y += (targetScreenY - this.y) * 0.08;
    } else if (this.target && this.target.isDead) {
      this.target = null;
    }
  }

  zoomAt(delta, screenX, screenY) {
    this.target = null;
    const zoomFactor = delta < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

    const worldX = this.x + screenX / this.zoom;
    const worldY = this.y + screenY / this.zoom;

    this.zoom = newZoom;
    this.x = worldX - screenX / this.zoom;
    this.y = worldY - screenY / this.zoom;
  }

  pan(dx, dy) {
    this.target = null;
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  screenToWorld(sx, sy) {
    return {
      x: this.x + sx / this.zoom,
      y: this.y + sy / this.zoom
    };
  }
}
