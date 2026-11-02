/**
 * Biosphera - Spatial Hash Grid
 */

export class SpatialHash {
  constructor(cellSize = 80, worldWidth = Infinity, worldHeight = Infinity) {
    this.cellSize = cellSize;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.grid = new Map();
  }

  getKey(cx, cy) {
    return `${cx}:${cy}`;
  }

  clear() {
    this.grid.clear();
  }

  insert(entity) {
    const cx = Math.floor(entity.x / this.cellSize);
    const cy = Math.floor(entity.y / this.cellSize);
    const key = this.getKey(cx, cy);

    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push(entity);
  }

  query(x, y, radius) {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    // Toroidal world: when the query box crosses an edge, also scan the
    // opposite side's cells (shifted by one full grid span). The offsets
    // produce disjoint cell sets, so no entity is returned twice.
    const xOffsets = [0];
    const yOffsets = [0];
    if (Number.isFinite(this.worldWidth)) {
      const cols = Math.ceil(this.worldWidth / this.cellSize);
      if (x - radius < 0) xOffsets.push(cols);
      if (x + radius > this.worldWidth) xOffsets.push(-cols);
    }
    if (Number.isFinite(this.worldHeight)) {
      const rows = Math.ceil(this.worldHeight / this.cellSize);
      if (y - radius < 0) yOffsets.push(rows);
      if (y + radius > this.worldHeight) yOffsets.push(-rows);
    }

    const results = [];
    const rSq = radius * radius;

    for (const ox of xOffsets) {
      for (const oy of yOffsets) {
        for (let cx = minCx; cx <= maxCx; cx++) {
          for (let cy = minCy; cy <= maxCy; cy++) {
            const cell = this.grid.get(this.getKey(cx + ox, cy + oy));
            if (!cell) continue;

            for (let i = 0; i < cell.length; i++) {
              const item = cell[i];
              let dx = item.x - x;
              let dy = item.y - y;
              if (Number.isFinite(this.worldWidth)) {
                if (dx > this.worldWidth * 0.5) dx -= this.worldWidth;
                else if (dx < -this.worldWidth * 0.5) dx += this.worldWidth;
              }
              if (Number.isFinite(this.worldHeight)) {
                if (dy > this.worldHeight * 0.5) dy -= this.worldHeight;
                else if (dy < -this.worldHeight * 0.5) dy += this.worldHeight;
              }
              if (dx * dx + dy * dy <= rSq) {
                results.push(item);
              }
            }
          }
        }
      }
    }

    return results;
  }
}
