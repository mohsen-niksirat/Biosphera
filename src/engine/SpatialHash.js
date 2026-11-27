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

  _getAxisCellRanges(pos, radius, worldSize) {
    if (!Number.isFinite(worldSize)) {
      return [[
        Math.floor((pos - radius) / this.cellSize),
        Math.floor((pos + radius) / this.cellSize)
      ]];
    }

    const maxCell = Math.floor(worldSize / this.cellSize);
    if (radius * 2 >= worldSize) {
      return [[0, maxCell]];
    }

    const pMin = Math.floor(Math.max(0, pos - radius) / this.cellSize);
    const pMax = Math.floor(Math.min(worldSize, pos + radius) / this.cellSize);

    if (pos - radius < 0) {
      const wMin = Math.floor((pos - radius + worldSize) / this.cellSize);
      const wMax = maxCell;
      return wMin <= pMax ? [[pMin, wMax]] : [[pMin, pMax], [wMin, wMax]];
    }

    if (pos + radius > worldSize) {
      const wMin = 0;
      const wMax = Math.floor((pos + radius - worldSize) / this.cellSize);
      return wMax >= pMin ? [[wMin, pMax]] : [[wMin, wMax], [pMin, pMax]];
    }

    return [[pMin, pMax]];
  }

  query(x, y, radius) {
    const xRanges = this._getAxisCellRanges(x, radius, this.worldWidth);
    const yRanges = this._getAxisCellRanges(y, radius, this.worldHeight);

    const results = [];
    const rSq = radius * radius;

    for (let rx = 0; rx < xRanges.length; rx++) {
      const [minCx, maxCx] = xRanges[rx];
      for (let ry = 0; ry < yRanges.length; ry++) {
        const [minCy, maxCy] = yRanges[ry];
        for (let cx = minCx; cx <= maxCx; cx++) {
          for (let cy = minCy; cy <= maxCy; cy++) {
            const cell = this.grid.get(this.getKey(cx, cy));
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
