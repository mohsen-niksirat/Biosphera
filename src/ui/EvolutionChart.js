/**
 * Biosphera - Evolution Trends Chart
 * Tracks how average genome traits (size, speed, vision, diet, generation)
 * drift across the population over time — visualizing directional selection.
 */

const SCALES = {
  size: { max: 22, color: '#38bdf8', label: 'Size' },
  speed: { max: 5.5, color: '#f43f5e', label: 'Speed' },
  vision: { max: 320, color: '#a78bfa', label: 'Vision' },
  diet: { max: 2, offset: 1, color: '#10b981', label: 'Diet' },
  generation: { max: 30, color: '#facc15', label: 'Gen' }
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

  render() {
    if (!this.ctx || this.history.length < 2) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    for (const [key, cfg] of Object.entries(SCALES)) {
      ctx.beginPath();
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 1.5;

      for (let i = 0; i < this.history.length; i++) {
        const raw = this.history[i][key];
        const norm = (raw + (cfg.offset || 0)) / (this.maxHistory && key === 'generation'
          ? Math.max(cfg.max, raw + (cfg.offset || 0))
          : cfg.max + (cfg.offset || 0));
        const x = (i / (this.maxHistory - 1)) * w;
        const y = h - Math.min(1, Math.max(0, norm)) * (h - 6) - 3;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  legendHTML() {
    return Object.values(SCALES)
      .map((c) => `<span class="legend-dot" style="color:${c.color}">● ${c.label}</span>`)
      .join(' ');
  }
}
