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
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    // Find max value for adaptive scaling
    let maxVal = 25;
    for (const pt of this.history) {
      const top = Math.max(pt.herbivores, pt.carnivores, pt.omnivores, pt.food);
      if (top > maxVal) maxVal = top;
    }
    maxVal *= 1.15;

    // Helper to draw a series line
    const drawSeries = (color, key, dash = []) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.setLineDash(dash);

      for (let i = 0; i < this.history.length; i++) {
        const x = (i / (this.maxHistory - 1)) * w;
        const val = this.history[i][key];
        const y = h - (val / maxVal) * (h - 6) - 3;

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
