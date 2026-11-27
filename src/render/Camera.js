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

    this.directorMode = 'off'; // 'off' | 'apex' | 'mutant' | 'action'
    this._directorTarget = null;
    this._directorTimer = 0;
    this._lastScreenW = 1280;
    this._lastScreenH = 720;
  }

  /** Device pixels per world unit: zoom multiplied by the backing-store ratio. */
  get scale() {
    return this.zoom * (this.pixelRatio || 1);
  }

  follow(org) {
    this.target = org;
    if (org) {
      this.directorMode = 'off';
      this._directorTarget = null;
    }
  }

  update(screenWidth, screenHeight, dt = 1 / 60) {
    if (screenWidth > 0) this._lastScreenW = screenWidth;
    if (screenHeight > 0) this._lastScreenH = screenHeight;

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

  updateDirector(world, dt = 1 / 60, screenWidth = this._lastScreenW, screenHeight = this._lastScreenH) {
    if (this.directorMode === 'off' || this.target || !world?.organisms?.length) {
      return null;
    }

    this._directorTimer -= dt;
    if (this._directorTimer <= 0 || !this._directorTarget || this._directorTarget.isDead) {
      this._directorTimer = 2.5;
      this._directorTarget = this._pickDirectorTarget(world.organisms);
    }

    const tgt = this._directorTarget;
    if (!tgt) return null;

    const targetScreenX = tgt.x - (screenWidth / 2) / this.scale;
    const targetScreenY = tgt.y - (screenHeight / 2) / this.scale;
    const t = 1 - Math.pow(0.94, dt * 60);
    this.x += (targetScreenX - this.x) * t;
    this.y += (targetScreenY - this.y) * t;
    return tgt;
  }

  _pickDirectorTarget(organisms) {
    let best = null;
    let bestScore = -Infinity;

    for (let i = 0; i < organisms.length; i++) {
      const o = organisms[i];
      if (o.isDead) continue;

      let score = 0;
      if (this.directorMode === 'apex') {
        score = (o.kills ?? 0) * 120 + (o.energy ?? 0);
      } else if (this.directorMode === 'mutant') {
        score = (o.generation ?? 1) * 100 - (o.age ?? 0) * 0.5;
      } else if (this.directorMode === 'action') {
        const speed = Math.hypot(o.vx ?? 0, o.vy ?? 0);
        const biting = (o.latestOutputs?.[2] ?? 0) > 0 ? 150 : 0;
        const pred = (o.dna?.diet ?? 0) > 0.2 ? 60 : 0;
        score = speed + biting + pred;
      }

      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best;
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
    this.directorMode = 'off';
    this._directorTarget = null;
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
