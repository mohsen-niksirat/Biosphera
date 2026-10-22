/**
 * Biosphera - High Performance Canvas 2D Renderer
 * Enhanced with multi-jointed swimming spines, ambient marine plankton, and particle bursts.
 */

export class Renderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not acquire 2D context');
    this.ctx = ctx;
    this.camera = camera;

    this.selectedOrganism = null;
    this.hoveredOrganism = null;

    // Ambient floating plankton/dust in water
    this.ambientParticles = [];
    for (let i = 0; i < 90; i++) {
      this.ambientParticles.push({
        x: Math.random() * 2400,
        y: Math.random() * 1800,
        r: 0.8 + Math.random() * 1.5,
        speed: 0.2 + Math.random() * 0.4,
        angle: Math.random() * Math.PI * 2,
        alpha: 0.15 + Math.random() * 0.25
      });
    }
  }

  render(world) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // 1. CLEAR & BACKGROUND
    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 2. WORLD BOUNDARY & GRID
    this.drawWorldGrid(world);

    // 3. AMBIENT DRIFTING PLANKTON
    this.drawAmbientPlankton(world);

    // 4. HAZARDS
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

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. FOOD
    for (let i = 0; i < world.foods.length; i++) {
      const f = world.foods[i];
      if (!this.isInView(f.x, f.y, f.radius + 10)) continue;

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      if (f.type === 'plant') {
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 5;
      } else {
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 6;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 6. BURST PARTICLES
    for (let i = 0; i < world.particles.length; i++) {
      const p = world.particles[i];
      if (!this.isInView(p.x, p.y, p.size)) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 7. ORGANISMS
    for (let i = 0; i < world.organisms.length; i++) {
      const org = world.organisms[i];
      if (!this.isInView(org.x, org.y, org.dna.sensorRange + 25)) continue;

      const isSelected = this.selectedOrganism === org;
      const isHovered = this.hoveredOrganism === org;

      this.drawOrganism(org, isSelected, isHovered);
    }

    ctx.restore();

    // 8. ATMOSPHERIC OVERLAYS
    if (world.currentPreset === 'glacial' || world.iceAgeTimer > 0) {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.12)';
      ctx.fillRect(0, 0, width, height);
    } else if (world.radiationTimer > 0) {
      ctx.fillStyle = 'rgba(217, 70, 239, 0.08)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  drawAmbientPlankton(world) {
    const ctx = this.ctx;
    ctx.fillStyle = '#38bdf8';

    for (let i = 0; i < this.ambientParticles.length; i++) {
      const pt = this.ambientParticles[i];
      pt.x = (pt.x + Math.cos(pt.angle) * pt.speed + world.width) % world.width;
      pt.y = (pt.y + Math.sin(pt.angle) * pt.speed + world.height) % world.height;

      if (!this.isInView(pt.x, pt.y, pt.r)) continue;

      ctx.globalAlpha = pt.alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  drawWorldGrid(world) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
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

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, world.width, world.height);
  }

  drawOrganism(org, isSelected, isHovered) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(org.x, org.y);

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
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.05)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (org.nearestTarget) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
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

    if (isSelected) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      const reticleR = org.radius + 14;
      ctx.beginPath();
      ctx.arc(0, 0, reticleR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, reticleR + 4, -0.4, 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, reticleR + 4, Math.PI - 0.4, Math.PI + 0.4);
      ctx.stroke();
    }

    ctx.rotate(org.heading);

    // Dynamic Multi-Segment Undulating Spine (Tadpole / Microbe Swimming)
    const spineSegments = 4;
    const segLength = (org.radius * 1.8) / spineSegments;
    const baseWiggle = org.radius * 0.45;

    ctx.beginPath();
    ctx.moveTo(-org.radius * 0.6, 0);

    let curX = -org.radius * 0.6;
    for (let s = 1; s <= spineSegments; s++) {
      const nextX = curX - segLength;
      const phaseOffset = s * 0.75;
      const wY = Math.sin(org.tailPhase + phaseOffset) * (baseWiggle * (s / spineSegments));
      ctx.lineTo(nextX, wY);
      curX = nextX;
    }

    ctx.strokeStyle = `hsla(${org.dna.colorHue}, 75%, 60%, 0.65)`;
    ctx.lineWidth = Math.max(1.5, org.radius * 0.22);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, org.radius * 1.15, org.radius * 0.85, 0, 0, Math.PI * 2);

    const lightness = 45 + (org.energy / org.dna.reproduceThreshold) * 20;
    ctx.fillStyle = `hsl(${org.dna.colorHue}, 75%, ${lightness}%)`;
    ctx.fill();

    ctx.strokeStyle = org.dna.diet > 0.2 ? '#f43f5e' : (org.dna.diet < -0.2 ? '#10b981' : '#facc15');
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Energy Ring
    ctx.beginPath();
    const energyRatio = Math.min(1.0, org.energy / org.dna.reproduceThreshold);
    ctx.arc(0, 0, org.radius * 0.5, 0, Math.PI * 2 * energyRatio);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes
    const eyeOffsetX = org.radius * 0.6;
    const eyeOffsetY = org.radius * 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeOffsetX, -eyeOffsetY, 2.5, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX, eyeOffsetY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(eyeOffsetX + 1, -eyeOffsetY, 1.2, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX + 1, eyeOffsetY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  isInView(x, y, radius) {
    const left = this.camera.x - radius;
    const right = this.camera.x + this.canvas.width / this.camera.zoom + radius;
    const top = this.camera.y - radius;
    const bottom = this.camera.y + this.canvas.height / this.camera.zoom + radius;
    return x >= left && x <= right && y >= top && y <= bottom;
  }
}
