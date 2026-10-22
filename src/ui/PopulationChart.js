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
      herbivores: stats.herbivores,
      carnivores: stats.carnivores,
      omnivores: stats.omnivores,
      food: Math.min(stats.population * 2.5, stats.foodCount * 0.4) // Scaled for comparison
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.render();
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
    drawSeries('rgba(16, 185, 129, 0.4)', 'food', [2, 2]); // Dotted vegetation
    drawSeries('#10b981', 'herbivores');                    // Solid Green
    drawSeries('#f43f5e', 'carnivores');                    // Solid Red
    drawSeries('#facc15', 'omnivores');                     // Solid Gold
  }
}
