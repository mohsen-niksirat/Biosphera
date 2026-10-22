/**
 * Biosphera - Interactive God Brush & Fluid Shockwave Engine
 * Allows users to paint vegetation, drop meat, plant hazards, or create physical water ripples.
 */

import { Food } from '../entities/Food.js';
import { Hazard } from '../entities/Hazard.js';

export class GodBrush {
  constructor(world, camera, soundEngine, showToastCallback) {
    this.world = world;
    this.camera = camera;
    this.soundEngine = soundEngine;
    this.showToast = showToastCallback;

    this.currentMode = 'select'; // 'select' | 'plant' | 'meat' | 'hazard' | 'current'
    this.isBrushing = false;
    this.lastBrushTime = 0;

    this.ripples = []; // Fluid current shockwaves
  }

  setMode(mode) {
    this.currentMode = mode;
    const canvas = document.getElementById('sim-canvas');
    if (!canvas) return;

    if (mode === 'select') {
      canvas.style.cursor = 'grab';
    } else if (mode === 'current') {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'cell';
    }
  }

  handleMouseDown(screenX, screenY) {
    if (this.currentMode === 'select') return false;

    this.isBrushing = true;
    this.applyBrush(screenX, screenY);
    return true; // Handled
  }

  handleMouseMove(screenX, screenY) {
    if (this.currentMode === 'select' || !this.isBrushing) return;

    const now = performance.now();
    if (now - this.lastBrushTime > 60) { // Throttle brush stroke
      this.lastBrushTime = now;
      this.applyBrush(screenX, screenY);
    }
  }

  handleMouseUp() {
    this.isBrushing = false;
  }

  applyBrush(screenX, screenY) {
    const worldPos = this.camera.screenToWorld(screenX, screenY);
    const wx = Math.max(20, Math.min(this.world.width - 20, worldPos.x));
    const wy = Math.max(20, Math.min(this.world.height - 20, worldPos.y));

    switch (this.currentMode) {
      case 'plant': {
        if (this.world.foods.length < this.world.maxFoodCap) {
          for (let i = 0; i < 3; i++) {
            const offsetX = (Math.random() - 0.5) * 24;
            const offsetY = (Math.random() - 0.5) * 24;
            this.world.foods.push(new Food(wx + offsetX, wy + offsetY, 'plant'));
          }
          this.world.addParticleBurst(wx, wy, '#10b981', 5);
          this.soundEngine?.playEat();
        }
        break;
      }

      case 'meat': {
        if (this.world.foods.length < this.world.maxFoodCap) {
          this.world.foods.push(new Food(wx, wy, 'meat', 45));
          this.world.addParticleBurst(wx, wy, '#f43f5e', 7);
          this.soundEngine?.playEat();
        }
        break;
      }

      case 'hazard': {
        this.world.hazards.push(new Hazard(wx, wy, 55, 45));
        this.world.addParticleBurst(wx, wy, '#ef4444', 12);
        this.soundEngine?.playDisaster();
        this.showToast?.('🧪 Hazardous vent placed.');
        this.setMode('select'); // One-off placement
        break;
      }

      case 'current': {
        // Shockwave ripple pushing entities
        this.createShockwave(wx, wy, 160, 320);
        this.soundEngine?.playDisaster();
        break;
      }
    }
  }

  createShockwave(x, y, radius = 180, force = 280) {
    this.ripples.push({
      x,
      y,
      radius: 5,
      maxRadius: radius,
      force,
      alpha: 0.9,
      speed: 360
    });

    // Apply repulsive physical impulse to nearby organisms
    const affectedOrgs = this.world.spatialOrganisms.query(x, y, radius);
    for (const org of affectedOrgs) {
      const dx = org.x - x;
      const dy = org.y - y;
      const dist = Math.hypot(dx, dy) || 1;
      const impulse = (1 - dist / radius) * (force / org.radius);
      org.vx += (dx / dist) * impulse;
      org.vy += (dy / dist) * impulse;
    }

    // Also push food particles
    const affectedFoods = this.world.spatialFoods.query(x, y, radius);
    for (const f of affectedFoods) {
      const dx = f.x - x;
      const dy = f.y - y;
      const dist = Math.hypot(dx, dy) || 1;
      f.x += (dx / dist) * 15;
      f.y += (dy / dist) * 15;
    }
  }

  update(dt) {
    // Update active ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.speed * dt;
      r.alpha -= dt * 1.5;
      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
      }
    }
  }

  render(ctx) {
    if (this.ripples.length === 0) return;

    ctx.save();
    for (const r of this.ripples) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0, r.alpha)})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}
