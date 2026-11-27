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
    if (!this.ctx || this.history.length < 2) return;

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

  legendHTML() {
    return Object.values(SCALES)
      .map((c) => `<span class="legend-dot" style="color:${c.color}">${c.label}</span>`)
      .join(' ');
  }
}
