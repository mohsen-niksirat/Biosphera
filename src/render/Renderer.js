/**
 * Biosphera - High Performance Canvas 2D Renderer
 * Supports Day/Night Lighting, Nocturnal Bioluminescence Bloom, Cached Glow Sprites,
 * Diegetic State Halos, Neural-Driven Kinematics, and Parallax Marine Snow.
 */

const PENTATONIC_GLOW_BUCKETS = 24; // 15-degree hue buckets for cached glow sprites

export class Renderer {
  constructor(canvas, camera, world = null) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not acquire 2D context');
    this.ctx = ctx;
    this.camera = camera;

    this.selectedOrganism = null;
    this.hoveredOrganism = null;
    this.viewMode = 'standard'; // 'standard' | 'sensory' | 'heatmap'
    this.showPheromones = false;
    this.showCurrents = false;

    // Offscreen pheromone overlay buffer
    this.pheromoneCanvas = document.createElement('canvas');
    this.pheromoneCtx = this.pheromoneCanvas.getContext('2d');
    this.pheromoneImgData = null;

    // Offscreen sprite caches (eliminates per-frame createRadialGradient & shadowBlur)
    this.hazardSprite = this._createRadialSprite(
      256,
      [
        [0, 'rgba(251, 113, 133, 0.42)'],
        [0.6, 'rgba(190, 24, 93, 0.18)'],
        [1, 'rgba(127, 29, 29, 0)']
      ]
    );
    this.plantGlowSprite = this._createRadialSprite(64, [
      [0, 'rgba(52, 211, 153, 0.55)'],
      [0.45, 'rgba(52, 211, 153, 0.18)'],
      [1, 'rgba(52, 211, 153, 0)']
    ]);
    this.meatGlowSprite = this._createRadialSprite(64, [
      [0, 'rgba(251, 113, 133, 0.6)'],
      [0.45, 'rgba(251, 113, 133, 0.2)'],
      [1, 'rgba(251, 113, 133, 0)']
    ]);
    this.heatGlowSprites = {
      high: this._createRadialSprite(96, [
        [0, 'rgba(251, 113, 133, 0.7)'],
        [0.5, 'rgba(251, 113, 133, 0.22)'],
        [1, 'rgba(251, 113, 133, 0)']
      ]),
      mid: this._createRadialSprite(96, [
        [0, 'rgba(251, 191, 36, 0.65)'],
        [0.5, 'rgba(251, 191, 36, 0.2)'],
        [1, 'rgba(251, 191, 36, 0)']
      ]),
      low: this._createRadialSprite(96, [
        [0, 'rgba(63, 224, 208, 0.6)'],
        [0.5, 'rgba(63, 224, 208, 0.18)'],
        [1, 'rgba(63, 224, 208, 0)']
      ])
    };
    this.hueGlowSprites = new Map();

    // Half-resolution offscreen bioluminescent bloom buffer
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d');

    // Multi-layer parallax marine snow particles for deep-ocean depth
    const worldW = world?.width ?? 2400;
    const worldH = world?.height ?? 1800;
    this.ambientParticles = [];
    const depths = [0.35, 0.65, 1.0];
    for (let i = 0; i < 120; i++) {
      const depth = depths[i % depths.length];
      this.ambientParticles.push({
        x: Math.random() * worldW,
        y: Math.random() * worldH,
        depth,
        r: (0.7 + Math.random() * 1.4) * (0.55 + depth * 0.55),
        speed: (0.15 + Math.random() * 0.35) * depth,
        angle: Math.random() * Math.PI * 2,
        alpha: (0.1 + Math.random() * 0.22) * (0.5 + depth * 0.5)
      });
    }
  }

  _createRadialSprite(size, stops) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const gctx = c.getContext('2d');
    const half = size * 0.5;
    const grad = gctx.createRadialGradient(half, half, 0, half, half, half);
    for (let i = 0; i < stops.length; i++) {
      grad.addColorStop(stops[i][0], stops[i][1]);
    }
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, size, size);
    return c;
  }

  _getHueGlowSprite(hue) {
    const step = 360 / PENTATONIC_GLOW_BUCKETS;
    const bucket = Math.round(((hue % 360) + 360) % 360 / step) * step;
    let sprite = this.hueGlowSprites.get(bucket);
    if (!sprite) {
      sprite = this._createRadialSprite(96, [
        [0, `hsla(${bucket}, 100%, 65%, 0.72)`],
        [0.4, `hsla(${bucket}, 95%, 55%, 0.28)`],
        [1, `hsla(${bucket}, 90%, 50%, 0)`]
      ]);
      this.hueGlowSprites.set(bucket, sprite);
    }
    return sprite;
  }

  _ensureBloomSize(width, height) {
    const bw = Math.max(1, Math.floor(width * 0.5));
    const bh = Math.max(1, Math.floor(height * 0.5));
    if (this.bloomCanvas.width !== bw || this.bloomCanvas.height !== bh) {
      this.bloomCanvas.width = bw;
      this.bloomCanvas.height = bh;
    }
    return { bw, bh };
  }

  render(world, godBrush = null, dayNight = null, seasonTint = null) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    const lighting = dayNight ? dayNight.getLighting() : { darkness: 0, tint: 'rgba(0,0,0,0)', isBioluminescent: false };
    const isBioluminescent = lighting.isBioluminescent || this.viewMode === 'heatmap';

    // 1. CLEAR & BACKGROUND
    ctx.fillStyle = lighting.darkness > 0.4 ? '#02060d' : '#050d14';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.scale(this.camera.scale, this.camera.scale);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 2. WORLD BOUNDARY & GRID
    this.drawWorldGrid(world);

    // 2.5 BIOME HABITAT ZONES (subtle deep-ocean floor rings)
    if (world.habitats && world.habitats.length > 0) {
      this.drawHabitats(world);
    }

    // 2.6 OPTIONAL OVERLAYS (Pheromone scent & Water currents)
    if (this.showPheromones && world.pheromones) {
      this.drawPheromones(world);
    }
    if (this.showCurrents) {
      this.drawCurrents(world);
    }

    // 3. PARALLAX MARINE SNOW / DRIFTING PLANKTON
    this.drawAmbientPlankton(world, isBioluminescent);

    // 4. HAZARDS (cached offscreen radial sprite — zero per-frame gradient allocations)
    for (let i = 0; i < world.hazards.length; i++) {
      const h = world.hazards[i];
      const pulse = 1 + Math.sin(h.pulsePhase) * 0.08;
      const r = h.radius * pulse;
      if (!this.isInView(h.x, h.y, r)) continue;

      ctx.drawImage(this.hazardSprite, h.x - r, h.y - r, r * 2, r * 2);

      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. FOOD (High performance batch rendering; glow handled via bloom/sprites, zero shadowBlur)
    const plantColor = '#34d399';
    const meatColor = '#fb7185';

    // Batch draw plants
    ctx.beginPath();
    let hasPlants = false;
    for (let i = 0; i < world.foods.length; i++) {
      const f = world.foods[i];
      if (f.type === 'plant' && this.isInView(f.x, f.y, f.radius + 10)) {
        ctx.moveTo(f.x + f.radius, f.y);
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        hasPlants = true;
      }
    }
    if (hasPlants) {
      ctx.fillStyle = plantColor;
      ctx.fill();
    }

    // Batch draw meats
    ctx.beginPath();
    let hasMeats = false;
    for (let i = 0; i < world.foods.length; i++) {
      const f = world.foods[i];
      if (f.type === 'meat' && this.isInView(f.x, f.y, f.radius + 10)) {
        ctx.moveTo(f.x + f.radius, f.y);
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        hasMeats = true;
      }
    }
    if (hasMeats) {
      ctx.fillStyle = meatColor;
      ctx.fill();
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

    // 6.5 GOD BRUSH SHOCKWAVES
    if (godBrush) {
      godBrush.render(ctx);
    }

    // 7. ORGANISMS
    for (let i = 0; i < world.organisms.length; i++) {
      const org = world.organisms[i];
      if (!this.isInView(org.x, org.y, (org.dna?.sensorRange ?? 120) + 25)) continue;

      const isSelected = this.selectedOrganism === org;
      const isHovered = this.hoveredOrganism === org;

      this.drawOrganism(org, isSelected, isHovered, isBioluminescent);
    }

    ctx.restore();

    // 8. DAY/NIGHT & ATMOSPHERIC LIGHTING TINT
    if (lighting.darkness > 0.05) {
      ctx.fillStyle = lighting.tint;
      ctx.fillRect(0, 0, width, height);
    }

    if (seasonTint) {
      ctx.fillStyle = seasonTint;
      ctx.fillRect(0, 0, width, height);
    }

    if (world.currentPreset === 'glacial' || world.iceAgeTimer > 0) {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.12)';
      ctx.fillRect(0, 0, width, height);
    } else if (world.radiationTimer > 0) {
      ctx.fillStyle = 'rgba(217, 70, 239, 0.08)';
      ctx.fillRect(0, 0, width, height);
    }

    // 9. HALF-RESOLUTION BIOLUMINESCENT BLOOM PASS (composited after darkness tint)
    this.renderBloomPass(world, width, height, isBioluminescent);
  }

  renderBloomPass(world, width, height, isBioluminescent) {
    if (!this.bloomCtx) return;

    const { bw, bh } = this._ensureBloomSize(width, height);
    const bctx = this.bloomCtx;
    bctx.clearRect(0, 0, bw, bh);

    bctx.save();
    bctx.scale(0.5 * this.camera.scale, 0.5 * this.camera.scale);
    bctx.translate(-this.camera.x, -this.camera.y);
    bctx.globalCompositeOperation = 'lighter';

    let drewAny = false;

    // Food glow in nocturnal/bioluminescent mode (capped for huge food counts)
    if (isBioluminescent && world.foods.length < 180) {
      for (let i = 0; i < world.foods.length; i++) {
        const f = world.foods[i];
        const glowR = f.radius * 3.4;
        if (!this.isInView(f.x, f.y, glowR)) continue;
        const sprite = f.type === 'meat' ? this.meatGlowSprite : this.plantGlowSprite;
        bctx.drawImage(sprite, f.x - glowR, f.y - glowR, glowR * 2, glowR * 2);
        drewAny = true;
      }
    }

    // Organism bioluminescent bloom (all organisms at night/heatmap, high-energy organisms during day)
    for (let i = 0; i < world.organisms.length; i++) {
      const org = world.organisms[i];
      const reproThresh = org.dna?.reproduceThreshold || 100;
      const energyRatio = Math.min(1.4, org.energy / reproThresh);
      if (!isBioluminescent && energyRatio < 0.8) continue;

      const glowR = org.radius * (isBioluminescent ? 3.2 : 2.3);
      if (!this.isInView(org.x, org.y, glowR)) continue;

      let sprite;
      if (this.viewMode === 'heatmap') {
        const speed = Math.hypot(org.vx, org.vy);
        sprite = speed > 150
          ? this.heatGlowSprites.high
          : (speed > 72 ? this.heatGlowSprites.mid : this.heatGlowSprites.low);
      } else {
        sprite = this._getHueGlowSprite(org.dna?.colorHue ?? 175);
      }

      bctx.globalAlpha = isBioluminescent ? Math.min(1, 0.45 + energyRatio * 0.45) : 0.45;
      bctx.drawImage(sprite, org.x - glowR, org.y - glowR, glowR * 2, glowR * 2);
      drewAny = true;
    }

    bctx.restore();

    if (drewAny) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = isBioluminescent ? 0.85 : 0.5;
      ctx.drawImage(this.bloomCanvas, 0, 0, width, height);
      ctx.restore();
    }
  }

  drawAmbientPlankton(world, isBioluminescent) {
    const ctx = this.ctx;
    ctx.fillStyle = isBioluminescent ? '#3fe0d0' : 'rgba(63, 224, 208, 0.7)';
    const flow = world.flow;
    const viewW = this.canvas.width / this.camera.scale;
    const viewH = this.canvas.height / this.camera.scale;

    for (let i = 0; i < this.ambientParticles.length; i++) {
      const pt = this.ambientParticles[i];

      if (!world.isPaused) {
        if (flow) {
          const f = flow.sample(pt.x, pt.y);
          pt.x = (pt.x + f.vx * 0.05 * pt.depth + world.width) % world.width;
          pt.y = (pt.y + f.vy * 0.05 * pt.depth + world.height) % world.height;
        } else {
          pt.x = (pt.x + Math.cos(pt.angle) * pt.speed + world.width) % world.width;
          pt.y = (pt.y + Math.sin(pt.angle) * pt.speed + world.height) % world.height;
        }
      }

      // Parallax shift relative to camera origin, wrapped into the world bounds
      const px = ((pt.x + this.camera.x * (1 - pt.depth)) % world.width + world.width) % world.width;
      const py = ((pt.y + this.camera.y * (1 - pt.depth)) % world.height + world.height) % world.height;

      if (px < this.camera.x - pt.r || px > this.camera.x + viewW + pt.r) continue;
      if (py < this.camera.y - pt.r || py > this.camera.y + viewH + pt.r) continue;

      ctx.globalAlpha = isBioluminescent ? pt.alpha * 1.5 : pt.alpha;
      ctx.beginPath();
      ctx.arc(px, py, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  drawWorldGrid(world) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(220, 236, 242, 0.07)';
    ctx.lineWidth = 1;

    const gridSize = 100;
    const viewW = this.canvas.width / this.camera.scale;
    const viewH = this.canvas.height / this.camera.scale;
    const startX = Math.floor(Math.max(0, this.camera.x) / gridSize) * gridSize;
    const endX = Math.min(world.width, this.camera.x + viewW);
    const startY = Math.floor(Math.max(0, this.camera.y) / gridSize) * gridSize;
    const endY = Math.min(world.height, this.camera.y + viewH);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, Math.max(0, this.camera.y));
      ctx.lineTo(x, Math.min(world.height, this.camera.y + viewH));
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(Math.max(0, this.camera.x), y);
      ctx.lineTo(Math.min(world.width, this.camera.x + viewW), y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(63, 224, 208, 0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, world.width, world.height);
  }

  drawHabitats(world) {
    const ctx = this.ctx;
    const habitats = world.habitats;
    for (let i = 0; i < habitats.length; i++) {
      const h = habitats[i];
      const r = h.radius ?? 260;
      if (!this.isInView(h.x, h.y, r + 20)) continue;

      const key = String(h.type || h.id || h.name || '').toLowerCase();
      let stroke = 'rgba(56, 189, 248, 0.22)';
      let fill = 'rgba(56, 189, 248, 0.04)';
      if (key.includes('reef') || key.includes('coral')) {
        stroke = 'rgba(45, 212, 191, 0.24)';
        fill = 'rgba(45, 212, 191, 0.045)';
      } else if (key.includes('thermal') || key.includes('trench') || key.includes('vent')) {
        stroke = 'rgba(245, 158, 11, 0.24)';
        fill = 'rgba(245, 158, 11, 0.045)';
      } else if (key.includes('upwell') || key.includes('nutrient')) {
        stroke = 'rgba(52, 211, 153, 0.24)';
        fill = 'rgba(52, 211, 153, 0.045)';
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Inner organic contour ring
      ctx.beginPath();
      ctx.arc(h.x, h.y, r * 0.72, 0, Math.PI * 2);
      ctx.setLineDash([4, 14]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      if (h.name && this.camera.zoom >= 0.45) {
        ctx.fillStyle = stroke.replace(/0\.\d+\)$/, '0.55)');
        ctx.font = '600 11px ui-monospace, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(h.name.toUpperCase(), h.x, h.y - r + 18);
      }
      ctx.restore();
    }
  }

  drawPheromones(world) {
    const ph = world.pheromones;
    if (!ph || !this.pheromoneCtx || !ph.cols || !ph.rows) return;

    if (this.pheromoneCanvas.width !== ph.cols || this.pheromoneCanvas.height !== ph.rows) {
      this.pheromoneCanvas.width = ph.cols;
      this.pheromoneCanvas.height = ph.rows;
      this.pheromoneImgData = this.pheromoneCtx.createImageData(ph.cols, ph.rows);
    }

    const data = this.pheromoneImgData.data;
    const len = ph.cols * ph.rows;
    const food = ph.food;
    const danger = ph.danger;

    for (let i = 0; i < len; i++) {
      const f = Math.min(1, (food[i] || 0) * 0.55);
      const d = Math.min(1, (danger[i] || 0) * 0.65);
      const idx = i * 4;

      if (f < 0.015 && d < 0.015) {
        data[idx + 3] = 0;
        continue;
      }

      // Blend food (bio-teal/emerald) and danger (soft rose)
      const total = f + d;
      data[idx] = Math.round((36 * f + 251 * d) / total);
      data[idx + 1] = Math.round((216 * f + 100 * d) / total);
      data[idx + 2] = Math.round((178 * f + 130 * d) / total);
      data[idx + 3] = Math.min(175, Math.round(Math.max(f, d) * 165));
    }

    this.pheromoneCtx.putImageData(this.pheromoneImgData, 0, 0);

    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.pheromoneCanvas, 0, 0, world.width, world.height);
    ctx.restore();
  }

  drawCurrents(world) {
    const flow = world.flowField ?? world.flow;
    if (!flow || typeof flow.sample !== 'function') return;

    const ctx = this.ctx;
    const step = 140;
    const viewW = this.canvas.width / this.camera.scale;
    const viewH = this.canvas.height / this.camera.scale;
    const startX = Math.floor(Math.max(0, this.camera.x) / step) * step + step * 0.5;
    const endX = Math.min(world.width, this.camera.x + viewW);
    const startY = Math.floor(Math.max(0, this.camera.y) / step) * step + step * 0.5;
    const endY = Math.min(world.height, this.camera.y + viewH);
    const phase = (flow.time ?? 0) * 2.2;

    ctx.save();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.24)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();

    for (let y = startY; y <= endY; y += step) {
      for (let x = startX; x <= endX; x += step) {
        const { vx, vy } = flow.sample(x, y);
        const mag = Math.hypot(vx, vy);
        if (mag < 1) continue;

        const nx = vx / mag;
        const ny = vy / mag;
        const len = Math.min(42, 14 + mag * 0.75);
        const drift = Math.sin(phase + (x + y) * 0.01) * 6;
        const cx = x + nx * drift;
        const cy = y + ny * drift;
        const ex = cx + nx * len;
        const ey = cy + ny * len;

        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);

        // Subtle chevron tip
        const head = 5.5;
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - nx * head + ny * head * 0.55, ey - ny * head - nx * head * 0.55);
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - nx * head - ny * head * 0.55, ey - ny * head + nx * head * 0.55);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  drawOrganism(org, isSelected, isHovered, isBioluminescent) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(org.x, org.y);

    const dna = org.dna || {};
    const reproThresh = dna.reproduceThreshold || 100;
    const energyRatio = Math.max(0, org.energy / reproThresh);
    const healthRatio = (org.health ?? 100) / 100;
    const steerOutput = org.latestOutputs?.[0] ?? 0;
    const thrustOutput = ((org.latestOutputs?.[1] ?? 0) + 1) * 0.5;
    const biteOutput = org.latestOutputs?.[2] ?? 0;
    const splitOutput = org.latestOutputs?.[3] ?? 0;

    const showSensors = isSelected || isHovered || this.viewMode === 'sensory';

    // A. SENSORY CONE
    if (showSensors) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(
        0,
        0,
        dna.sensorRange ?? 120,
        org.heading - (dna.sensorFov ?? Math.PI * 0.7) * 0.5,
        org.heading + (dna.sensorFov ?? Math.PI * 0.7) * 0.5
      );
      ctx.closePath();
      ctx.fillStyle = isSelected ? 'rgba(63, 224, 208, 0.14)' : 'rgba(220, 236, 242, 0.04)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? 'rgba(63, 224, 208, 0.45)' : 'rgba(220, 236, 242, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (org.nearestTarget) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        // Relative wrapped vector to the target — stays correct across the seam
        ctx.lineTo(org.nearestTarget.dx, org.nearestTarget.dy);
        ctx.strokeStyle = org.nearestTarget.type === 'plant' ? '#34d399' : '#fb7185';
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // B. TARGET RETICLE
    if (isSelected) {
      ctx.strokeStyle = '#3fe0d0';
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

    // B2. DIEGETIC STATE HALOS (hunting / mating / starving) — skipped when zoomed way out
    if (this.camera.zoom >= 0.35) {
      const isStarving = energyRatio < 0.25 || healthRatio < 0.35;
      const isMating = (org.reproduceCooldown ?? 0) <= 0 && (energyRatio >= 0.9 || splitOutput > 0.35);
      const isHunting = (dna.diet ?? 0) > 0.15 && (biteOutput > 0.15 || org.nearestTarget?.type === 'meat');

      if (isStarving) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, org.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.restore();
      } else if (isMating) {
        ctx.beginPath();
        ctx.arc(0, 0, org.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }

      if (isHunting) {
        ctx.beginPath();
        ctx.arc(0, 0, org.radius + 7, -0.55, 0.55);
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.72)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    // C. NEURAL-DRIVEN MULTI-SEGMENT UNDULATING SPINE / FLAGELLA
    const spineSegments = 6;
    const segLength = (org.radius * 2.0) / spineSegments;
    const baseWiggle = org.radius * (0.28 + thrustOutput * 0.35);
    const turnBend = steerOutput * org.radius * 0.22;

    ctx.beginPath();
    ctx.moveTo(-org.radius * 0.6, 0);

    let curX = -org.radius * 0.6;
    for (let s = 1; s <= spineSegments; s++) {
      const nextX = curX - segLength;
      const ratio = s / spineSegments;
      const phaseOffset = s * 0.65;
      const wY = Math.sin(org.tailPhase + phaseOffset) * (baseWiggle * ratio) + turnBend * ratio * ratio;
      ctx.lineTo(nextX, wY);
      curX = nextX;
    }

    ctx.strokeStyle = `hsla(${dna.colorHue ?? 175}, 75%, 60%, ${isBioluminescent ? 0.9 : 0.65})`;
    ctx.lineWidth = Math.max(1.5, org.radius * 0.22);
    ctx.lineCap = 'round';
    ctx.stroke();

    // C2. EVOLVABLE LATERAL FINS (finCount)
    const finCount = Math.min(6, Math.max(0, Math.round(dna.finCount ?? 0)));
    if (finCount > 0) {
      const pairs = Math.ceil(finCount / 2);
      const finFlutter = Math.sin(org.tailPhase * 1.15) * 0.35 * (0.5 + thrustOutput);
      ctx.strokeStyle = `hsla(${dna.colorHue ?? 175}, 70%, 68%, 0.55)`;
      ctx.lineWidth = Math.max(1.2, org.radius * 0.14);
      for (let p = 0; p < pairs; p++) {
        const fx = org.radius * (0.2 - p * 0.45);
        const fy = org.radius * 0.78;
        const finLen = org.radius * 0.55;
        // Left fin
        ctx.beginPath();
        ctx.moveTo(fx, -fy);
        ctx.lineTo(fx - finLen * (0.7 + finFlutter * 0.3), -fy - finLen * 0.55);
        ctx.stroke();
        // Right fin (draw if even or more than 1 remaining)
        if (p * 2 + 1 < finCount || finCount % 2 === 0) {
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx - finLen * (0.7 - finFlutter * 0.3), fy + finLen * 0.55);
          ctx.stroke();
        }
      }
    }

    // D. BODY (subtle fatReserve widens lateral profile)
    const fatReserve = Math.max(0, dna.fatReserve ?? 0);
    const radiusX = org.radius * 1.15;
    const radiusY = org.radius * (0.85 + Math.min(0.28, fatReserve * 0.22));

    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);

    const lightness = 45 + Math.min(1, energyRatio) * 20;

    if (this.viewMode === 'heatmap') {
      const speed = Math.hypot(org.vx, org.vy);
      ctx.fillStyle = speed > 150 ? '#fb7185' : (speed > 72 ? '#fbbf24' : '#3fe0d0');
    } else if (isBioluminescent) {
      ctx.fillStyle = `hsl(${dna.colorHue ?? 175}, 85%, 60%)`;
    } else {
      ctx.fillStyle = `hsl(${dna.colorHue ?? 175}, 75%, ${lightness}%)`;
    }

    ctx.fill();

    // Armor plating rim (armor) or diet outline
    const armor = Math.max(0, dna.armor ?? 0);
    const diet = dna.diet ?? 0;
    ctx.strokeStyle = diet > 0.2 ? '#fb7185' : (diet < -0.2 ? '#34d399' : '#fbbf24');
    ctx.lineWidth = 1.6 + Math.min(2.2, armor * 1.8);
    ctx.stroke();

    if (armor > 0.15) {
      ctx.beginPath();
      ctx.ellipse(0, 0, radiusX * 0.96, radiusY * 0.96, 0, Math.PI * 0.25, Math.PI * 0.75);
      ctx.strokeStyle = 'rgba(220, 236, 242, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, radiusX * 0.96, radiusY * 0.96, 0, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
    }

    // D2. MANDIBLES / JAW POWER (jawPower)
    const jawPower = Math.max(0, dna.jawPower ?? 0);
    if (jawPower > 0.12) {
      const jawLen = org.radius * (0.35 + Math.min(0.4, jawPower * 0.35));
      const jawOpen = biteOutput > 0 ? 0.35 : 0.15;
      ctx.strokeStyle = diet > 0.2 ? '#fda4af' : '#cbd5e1';
      ctx.lineWidth = Math.max(1.4, org.radius * 0.14);
      ctx.beginPath();
      ctx.moveTo(radiusX * 0.85, -org.radius * 0.25);
      ctx.lineTo(radiusX * 0.85 + jawLen, -org.radius * (0.25 + jawOpen));
      ctx.moveTo(radiusX * 0.85, org.radius * 0.25);
      ctx.lineTo(radiusX * 0.85 + jawLen, org.radius * (0.25 + jawOpen));
      ctx.stroke();
    }

    // E. ENERGY RING
    ctx.beginPath();
    const clampedEnergy = Math.min(1.0, energyRatio);
    ctx.arc(0, 0, org.radius * 0.5, 0, Math.PI * 2 * clampedEnergy);
    ctx.strokeStyle = isBioluminescent ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // F. EYES
    const eyeOffsetX = org.radius * 0.6;
    const eyeOffsetY = org.radius * 0.45;
    ctx.fillStyle = '#dcecf2';
    ctx.beginPath();
    ctx.arc(eyeOffsetX, -eyeOffsetY, 2.5, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX, eyeOffsetY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#050d14';
    ctx.beginPath();
    ctx.arc(eyeOffsetX + 1, -eyeOffsetY, 1.2, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX + 1, eyeOffsetY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  isInView(x, y, radius) {
    const left = this.camera.x - radius;
    const right = this.camera.x + this.canvas.width / this.camera.scale + radius;
    const top = this.camera.y - radius;
    const bottom = this.camera.y + this.canvas.height / this.camera.scale + radius;
    return x >= left && x <= right && y >= top && y <= bottom;
  }
}
