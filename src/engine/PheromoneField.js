/**
 * Biosphera - Chemical Pheromone Field
 * A coarse two-channel scent grid. Organisms deposit scent while eating,
 * killing and dying; the field decays and diffuses over time and is sensed
 * through an extra neural input, enabling trail-following and danger avoidance.
 */

const CELL = 60;

export class PheromoneField {
  constructor(width = 2400, height = 1800) {
    this.cols = Math.max(1, Math.ceil(width / CELL));
    this.rows = Math.max(1, Math.ceil(height / CELL));
    this.food = new Float32Array(this.cols * this.rows);
    this.danger = new Float32Array(this.cols * this.rows);
    this._decayTimer = 0;
  }

  _index(x, y) {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / CELL)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / CELL)));
    return cy * this.cols + cx;
  }

  deposit(x, y, channel, amount) {
    const i = this._index(x, y);
    if (channel === 'food') {
      this.food[i] = Math.min(3, this.food[i] + amount);
    } else {
      this.danger[i] = Math.min(3, this.danger[i] + amount);
    }
  }

  /** Scent signal in [-1, 1]: food attracts, danger repels. */
  sample(x, y) {
    const i = this._index(x, y);
    return Math.max(-1, Math.min(1, this.food[i] * 0.45 - this.danger[i] * 0.6));
  }

  update(dt) {
    this._decayTimer += dt;
    if (this._decayTimer < 0.6) return;
    this._decayTimer = 0;

    const { cols, rows, food, danger } = this;
    const blur = (src) => {
      const out = new Float32Array(src.length);
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const i = cy * cols + cx;
          let sum = 0;
          let n = 0;
          for (let oy = -1; oy <= 1; oy++) {
            const yy = cy + oy;
            if (yy < 0 || yy >= rows) continue;
            for (let ox = -1; ox <= 1; ox++) {
              const xx = cx + ox;
              if (xx < 0 || xx >= cols) continue;
              sum += src[yy * cols + xx];
              n++;
            }
          }
          out[i] = (sum / n) * 0.86;
        }
      }
      return out;
    };

    this.food = blur(food);
    this.danger = blur(danger);
  }
}
