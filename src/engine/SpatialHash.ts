/**
 * Biosphera - Spatial Hash Grid
 * Efficient O(1) neighbor search and collision detection for thousands of agents.
 */

export interface SpatialEntity {
  x: number;
  y: number;
  radius?: number;
}

export class SpatialHash<T extends SpatialEntity> {
  private cellSize: number;
  private grid: Map<string, T[]>;

  constructor(cellSize: number = 80) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  private getKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  public clear(): void {
    this.grid.clear();
  }

  public insert(entity: T): void {
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

  /**
   * Query all entities within a circular radius
   */
  public query(x: number, y: number, radius: number): T[] {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const results: T[] = [];
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
