/**
 * Biosphera - Spatial Hash Grid
 */

export class SpatialHash {
  constructor(cellSize = 80) {
    this.cellSize = cellSize;
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

    const results = [];
    const rSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.grid.get(this.getKey(cx, cy));
        if (!cell) continue;

        for (let i = 0; i < cell.length; i++) {
          const item = cell[i];
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= rSq) {
            results.push(item);
          }
        }
      }
    }

    return results;
  }
}
