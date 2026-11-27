/**
 * Biosphera - Real-time Population Dynamics & Ecology Chart
 * Visualizes Lotka-Volterra predator-prey oscillations and food balance over time.
 */

export class PopulationChart {
  constructor(canvasId, maxHistory = 140) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.maxHistory = maxHistory;
    this.history = [];
    this.lastRecordTime = 0;
  }

  record(stats, now) {
    if (!this.canvas || now - this.lastRecordTime < 600) return; // Sample every 600ms
    this.lastRecordTime = now;

    this.history.push({
      t: now,
      herbivores: stats.herbivores,
      carnivores: stats.carnivores,
      omnivores: stats.omnivores,
      // Scaled series for the chart; raw plant count kept for CSV export
      food: Math.min(stats.population * 2.5, stats.foodCount * 0.4),
      plants: stats.foodCount
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.render();
  }

  reset() {
    this.history = [];
    this.lastRecordTime = 0;
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /** Population history as CSV, with a relative time axis in seconds. */
  csv() {
    if (!this.canvas || this.history.length === 0) return null;
    const t0 = this.history[0].t;
    const rows = ['time_s,herbivores,carnivores,omnivores,plants'];
    for (const pt of this.history) {
      const time = ((pt.t - t0) / 1000).toFixed(1);
      rows.push(`${time},${pt.herbivores},${pt.carnivores},${pt.omnivores},${pt.plants ?? ''}`);
    }
    return rows.join('\n');
  }

  render() {
    if (!this.ctx || this.history.length < 2) return;

    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect.width || 340));
    const h = Math.max(70, Math.round(rect.height || 96));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 28, r: 6, t: 8, b: 16 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    // Background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (const frac of [0, 0.5, 1]) {
      const gy = Math.round(pad.t + plotH * frac) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.l, gy);
      ctx.lineTo(w - pad.r, gy);
      ctx.stroke();
    }

    // Find max value for adaptive scaling
    let maxVal = 25;
    for (const pt of this.history) {
      const top = Math.max(pt.herbivores, pt.carnivores, pt.omnivores, pt.food);
      if (top > maxVal) maxVal = top;
    }
    maxVal = Math.ceil(maxVal * 1.15);

    // Y-axis & X-axis ticks
    ctx.font = '9px ui-monospace, Consolas, monospace';
    ctx.fillStyle = 'rgba(143, 169, 179, 0.78)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(maxVal), pad.l - 4, pad.t + 2);
    ctx.fillText(String(Math.round(maxVal * 0.5)), pad.l - 4, pad.t + plotH * 0.5);
    ctx.fillText('0', pad.l - 4, pad.t + plotH);

    const spanSec = Math.round((this.history[this.history.length - 1].t - this.history[0].t) / 1000);
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(`-${spanSec}s`, pad.l, h - 2);
    ctx.textAlign = 'right';
    ctx.fillText('now', w - pad.r, h - 2);

    // Helper to draw a series line
    const drawSeries = (color, key, dash = []) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.setLineDash(dash);

      for (let i = 0; i < this.history.length; i++) {
        const x = pad.l + (i / (this.maxHistory - 1)) * plotW;
        const val = this.history[i][key];
        const y = pad.t + plotH - (val / maxVal) * plotH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Draw lines
    drawSeries('rgba(52, 211, 153, 0.45)', 'food', [2, 2]); // Dotted vegetation
    drawSeries('#34d399', 'herbivores');                     // Solid green
    drawSeries('#fb7185', 'carnivores');                     // Solid rose
    drawSeries('#fbbf24', 'omnivores');                      // Solid amber
  }
}
