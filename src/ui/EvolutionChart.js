/**
 * Biosphera - Evolution Trends Chart
 * Tracks how average genome traits (size, speed, vision, diet, generation)
 * drift across the population over time — visualizing directional selection.
 */

const SCALES = {
  size: { max: 22, color: '#3fe0d0', label: 'Size' },
  speed: { max: 5.5, color: '#fb7185', label: 'Speed' },
  vision: { max: 320, color: '#8fa9b3', label: 'Vision' },
  diet: { max: 2, offset: 1, color: '#34d399', label: 'Diet' },
  generation: { max: 30, color: '#fbbf24', label: 'Gen' }
};

export class EvolutionChart {
  constructor(canvasId, maxHistory = 140) {
    this.canvas = (typeof document !== 'undefined' && canvasId) ? document.getElementById(canvasId) : null;
    if (this.canvas) this.ctx = this.canvas.getContext('2d');
    this.maxHistory = maxHistory;
    this.history = [];
    this.lastRecordTime = 0;
    this.mode = 'trends'; // 'trends' | 'scatter'
    this.organisms = [];
    this.scatterPoints = [];
    this.hoveredId = null;
    this.onSelectOrganism = null;
    this.tooltip = typeof document !== 'undefined' ? document.getElementById('scatter-tooltip') : null;

    this.bindScatterEvents();
  }

  bindScatterEvents() {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.mode !== 'scatter' || this.scatterPoints.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let nearest = null;
      let bestDist = 14;
      for (const pt of this.scatterPoints) {
        const d = Math.hypot(pt.x - mx, pt.y - my);
        if (d < bestDist) {
          bestDist = d;
          nearest = pt;
        }
      }
      this.hoveredId = nearest ? nearest.org.id : null;
      this.canvas.style.cursor = nearest ? 'pointer' : 'default';
      if (this.tooltip) {
        if (nearest) {
          const o = nearest.org;
          const niche = o.dna.diet < -0.2 ? 'Herb' : (o.dna.diet > 0.2 ? 'Carn' : 'Omni');
          this.tooltip.textContent = `#${o.id} ${o.speciesName || ''} · ${niche} · ${o.dna.size.toFixed(1)}px · ${o.dna.speed.toFixed(1)}x`;
          this.tooltip.hidden = false;
        } else {
          this.tooltip.hidden = true;
        }
      }
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.hoveredId !== null) {
        this.hoveredId = null;
        if (this.tooltip) this.tooltip.hidden = true;
        this.canvas.style.cursor = 'default';
        if (this.mode === 'scatter') this.render();
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.mode !== 'scatter' || this.scatterPoints.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let nearest = null;
      let bestDist = 14;
      for (const pt of this.scatterPoints) {
        const d = Math.hypot(pt.x - mx, pt.y - my);
        if (d < bestDist) {
          bestDist = d;
          nearest = pt;
        }
      }
      if (nearest) {
        this.onSelectOrganism?.(nearest.org);
      }
    });
  }

  setMode(mode) {
    this.mode = mode === 'scatter' ? 'scatter' : 'trends';
    if (this.mode !== 'scatter' && this.tooltip) {
      this.tooltip.hidden = true;
      this.hoveredId = null;
      if (this.canvas) this.canvas.style.cursor = 'default';
    }
    this.render();
  }

  updateScatter(organisms) {
    this.organisms = organisms || [];
    if (this.mode === 'scatter') {
      this.render();
    }
  }

  /** stats: { avgSize, avgSpeed, avgVision, avgDiet, avgGeneration } */
  record(stats, now) {
    if (!this.canvas || now - this.lastRecordTime < 600) return;
    this.lastRecordTime = now;

    this.history.push({
      size: stats.avgSize,
      speed: stats.avgSpeed,
      vision: stats.avgVision,
      diet: stats.avgDiet,
      generation: stats.avgGeneration
    });

    if (this.history.length > this.maxHistory) this.history.shift();
    this.render();
  }

  reset() {
    this.history = [];
    this.lastRecordTime = 0;
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  render() {
    if (!this.ctx) return;
    if (this.mode === 'scatter') {
      this.renderScatter();
      return;
    }
    if (this.history.length < 2) return;

    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect.width || 340));
    const h = Math.max(80, Math.round(rect.height || 112));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 30, r: 6, t: 8, b: 16 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (const frac of [0, 0.5, 1]) {
      const gy = Math.round(pad.t + plotH * frac) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.l, gy);
      ctx.lineTo(w - pad.r, gy);
      ctx.stroke();
    }

    ctx.font = '9px ui-monospace, Consolas, monospace';
    ctx.fillStyle = 'rgba(143, 169, 179, 0.78)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('100%', pad.l - 4, pad.t + 2);
    ctx.fillText('50%', pad.l - 4, pad.t + plotH * 0.5);
    ctx.fillText('0%', pad.l - 4, pad.t + plotH);

    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(`-${Math.round((this.history.length * 600) / 1000)}s`, pad.l, h - 2);
    ctx.textAlign = 'right';
    ctx.fillText('now', w - pad.r, h - 2);

    for (const cfg of Object.values(SCALES)) {
      const key = cfg.label === 'Gen' ? 'generation' : cfg.label.toLowerCase();
      ctx.beginPath();
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 1.5;

      for (let i = 0; i < this.history.length; i++) {
        const raw = this.history[i][key];
        const norm = (raw + (cfg.offset || 0)) / (cfg.max + (cfg.offset || 0));
        const x = pad.l + (i / (this.maxHistory - 1)) * plotW;
        const y = pad.t + plotH - Math.min(1, Math.max(0, norm)) * plotH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  renderScatter() {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect.width || 340));
    const h = Math.max(80, Math.round(rect.height || 112));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 30, r: 8, t: 8, b: 16 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (const frac of [0, 0.5, 1]) {
      const gy = Math.round(pad.t + plotH * frac) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.l, gy);
      ctx.lineTo(w - pad.r, gy);
      ctx.stroke();
    }

    // Axes labels (X: Size 6..22, Y: Speed 1.5..5.5)
    ctx.font = '9px ui-monospace, Consolas, monospace';
    ctx.fillStyle = 'rgba(143, 169, 179, 0.78)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('5.5x', pad.l - 4, pad.t + 2);
    ctx.fillText('3.5x', pad.l - 4, pad.t + plotH * 0.5);
    ctx.fillText('1.5x', pad.l - 4, pad.t + plotH);

    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText('6px', pad.l, h - 2);
    ctx.textAlign = 'center';
    ctx.fillText('Size', pad.l + plotW * 0.5, h - 2);
    ctx.textAlign = 'right';
    ctx.fillText('22px', w - pad.r, h - 2);

    this.scatterPoints = [];
    for (let i = 0; i < this.organisms.length; i++) {
      const org = this.organisms[i];
      if (!org || org.isDead) continue;
      const sx = Math.min(1, Math.max(0, (org.dna.size - 6) / 16));
      const sy = Math.min(1, Math.max(0, (org.dna.speed - 1.5) / 4));
      const px = pad.l + sx * plotW;
      const py = pad.t + plotH - sy * plotH;
      const r = 2.4 + Math.min(3.5, (org.energy / Math.max(1, org.dna.reproduceThreshold)) * 3.2);
      const color = org.dna.diet < -0.2 ? '#34d399' : (org.dna.diet > 0.2 ? '#fb7185' : '#fbbf24');

      this.scatterPoints.push({ x: px, y: py, org });

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = org.id === this.hoveredId ? 1 : 0.78;
      ctx.fill();
      if (org.id === this.hoveredId) {
        ctx.strokeStyle = '#dcecf2';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  legendHTML() {
    return Object.values(SCALES)
      .map((c) => `<span class="legend-dot" style="color:${c.color}">${c.label}</span>`)
      .join(' ');
  }
}
