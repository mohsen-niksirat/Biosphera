/**
 * Biosphera - High Performance Canvas 2D Renderer
 * Visualizes the ecosystem, swimming animations, sensory arcs, and biome atmosphere.
 */

import { World } from '../engine/World';
import { Camera } from './Camera';
import { Organism } from '../entities/Organism';

export class Renderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public camera: Camera;

  public selectedOrganism: Organism | null;
  public hoveredOrganism: Organism | null;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not acquire 2D context');
    this.ctx = ctx;
    this.camera = camera;

    this.selectedOrganism = null;
    this.hoveredOrganism = null;
  }

  public render(world: World): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // 1. CLEAR & BACKGROUND
    ctx.fillStyle = '#060a12'; // Deep abyssal blue
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Apply camera transformation
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 2. WORLD BOUNDARY & GRID
    this.drawWorldGrid(world);

    // 3. HAZARDS
    for (let i = 0; i < world.hazards.length; i++) {
      const h = world.hazards[i];
      const pulse = 1 + Math.sin(h.pulsePhase) * 0.08;

      const grad = ctx.createRadialGradient(h.x, h.y, 5, h.x, h.y, h.radius * pulse);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
      grad.addColorStop(0.6, 'rgba(185, 28, 28, 0.2)');
      grad.addColorStop(1, 'rgba(127, 29, 29, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Hazard core
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. FOOD (Plants & Meat)
    for (let i = 0; i < world.foods.length; i++) {
      const f = world.foods[i];
      // Cull food outside camera view
      if (!this.isInView(f.x, f.y, f.radius + 10)) continue;

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      if (f.type === 'plant') {
        ctx.fillStyle = '#10b981'; // Emerald
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 4;
      } else {
        ctx.fillStyle = '#f43f5e'; // Crimson Meat
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 5;
      }
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }

    // 5. ORGANISMS
    for (let i = 0; i < world.organisms.length; i++) {
      const org = world.organisms[i];
      if (!this.isInView(org.x, org.y, org.dna.sensorRange + 20)) continue;

      const isSelected = this.selectedOrganism === org;
      const isHovered = this.hoveredOrganism === org;

      this.drawOrganism(org, isSelected, isHovered);
    }

    ctx.restore();

    // 6. ATMOSPHERIC OVERLAYS
    if (world.iceAgeTimer > 0) {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.12)';
      ctx.fillRect(0, 0, width, height);
    } else if (world.radiationTimer > 0) {
      ctx.fillStyle = 'rgba(217, 70, 239, 0.08)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  private drawWorldGrid(world: World): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.lineWidth = 1;

    const gridSize = 100;
    const startX = Math.floor(Math.max(0, this.camera.x) / gridSize) * gridSize;
    const endX = Math.min(world.width, this.camera.x + this.canvas.width / this.camera.zoom);
    const startY = Math.floor(Math.max(0, this.camera.y) / gridSize) * gridSize;
    const endY = Math.min(world.height, this.camera.y + this.canvas.height / this.camera.zoom);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, Math.max(0, this.camera.y));
      ctx.lineTo(x, Math.min(world.height, this.camera.y + this.canvas.height / this.camera.zoom));
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(Math.max(0, this.camera.x), y);
      ctx.lineTo(Math.min(world.width, this.camera.x + this.canvas.width / this.camera.zoom), y);
    }
    ctx.stroke();

    // World border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, world.width, world.height);
  }

  private drawOrganism(org: Organism, isSelected: boolean, isHovered: boolean): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(org.x, org.y);

    // A. SENSOR FIELD OF VIEW (if hovered or selected)
    if (isSelected || isHovered) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(
        0,
        0,
        org.dna.sensorRange,
        org.heading - org.dna.sensorFov * 0.5,
        org.heading + org.dna.sensorFov * 0.5
      );
      ctx.closePath();
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Line to nearest perceived target
      if (org.nearestTarget) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        // Transform target coordinates relative to organism
        const relX = org.nearestTarget.x - org.x;
        const relY = org.nearestTarget.y - org.y;
        ctx.lineTo(relX, relY);
        ctx.strokeStyle = org.nearestTarget.type === 'plant' ? '#10b981' : '#f43f5e';
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // B. TARGET RETICLE (if selected)
    if (isSelected) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      const reticleR = org.radius + 12;
      ctx.beginPath();
      ctx.arc(0, 0, reticleR, 0, Math.PI * 2);
      ctx.stroke();

      // Corner brackets
      ctx.beginPath();
      ctx.arc(0, 0, reticleR + 4, -0.4, 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, reticleR + 4, Math.PI - 0.4, Math.PI + 0.4);
      ctx.stroke();
    }

    // Rotate to match heading
    ctx.rotate(org.heading);

    // C. FLAGELLA / TAIL WIGGLE
    const speed = Math.hypot(org.vx, org.vy);
    const tailLength = org.radius * 1.6;
    const wiggle = Math.sin(org.tailPhase) * (org.radius * 0.5);

    ctx.beginPath();
    ctx.moveTo(-org.radius * 0.7, 0);
    ctx.quadraticCurveTo(
      -org.radius - tailLength * 0.5,
      wiggle * 0.6,
      -org.radius - tailLength,
      wiggle
    );
    ctx.strokeStyle = `hsla(${org.dna.colorHue}, 70%, 60%, 0.6)`;
    ctx.lineWidth = Math.max(1.5, org.radius * 0.22);
    ctx.stroke();

    // D. ORGANISM BODY
    ctx.beginPath();
    // Hydrodynamic teardrop
    ctx.ellipse(0, 0, org.radius * 1.15, org.radius * 0.85, 0, 0, Math.PI * 2);

    // Color based on diet and DNA hue
    // Herbivore = cyan/green shift, Carnivore = intense red/orange shift
    const lightness = 45 + (org.energy / org.dna.reproduceThreshold) * 20;
    ctx.fillStyle = `hsl(${org.dna.colorHue}, 75%, ${lightness}%)`;
    ctx.fill();

    ctx.strokeStyle = org.dna.diet > 0.2 ? '#f43f5e' : (org.dna.diet < -0.2 ? '#10b981' : '#facc15');
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // E. ENERGY RING
    ctx.beginPath();
    const energyRatio = Math.min(1.0, org.energy / org.dna.reproduceThreshold);
    ctx.arc(0, 0, org.radius * 0.5, 0, Math.PI * 2 * energyRatio);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // F. EYES / SENSORS
    const eyeOffsetX = org.radius * 0.6;
    const eyeOffsetY = org.radius * 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeOffsetX, -eyeOffsetY, 2.5, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX, eyeOffsetY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye pupils looking forward
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(eyeOffsetX + 1, -eyeOffsetY, 1.2, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX + 1, eyeOffsetY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private isInView(x: number, y: number, radius: number): boolean {
    const left = this.camera.x - radius;
    const right = this.camera.x + this.canvas.width / this.camera.zoom + radius;
    const top = this.camera.y - radius;
    const bottom = this.camera.y + this.canvas.height / this.camera.zoom + radius;
    return x >= left && x <= right && y >= top && y <= bottom;
  }
}
