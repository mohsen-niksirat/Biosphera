/**
 * Biosphera - Seasonal Cycle Engine
 * Four seasons layered on top of the circadian cycle. Each season scales
 * vegetation growth and metabolic burn, forcing periodic adaptation.
 */

const SEASONS = {
  spring: { food: 1.35, metabolism: 0.95, tint: 'rgba(74, 222, 128, 0.045)' },
  summer: { food: 1.0, metabolism: 1.0, tint: 'rgba(250, 204, 21, 0.055)' },
  autumn: { food: 0.7, metabolism: 1.05, tint: 'rgba(234, 88, 12, 0.065)' },
  winter: { food: 0.45, metabolism: 1.2, tint: 'rgba(191, 219, 254, 0.09)' }
};

const ORDER = ['spring', 'summer', 'autumn', 'winter'];

export class SeasonCycle {
  constructor(seasonDuration = 75) {
    this.seasonDuration = seasonDuration;
    this.time = 0;
    this.isLocked = false;
    this.lockedSeason = null;
  }

  update(dt) {
    if (this.isLocked) return;
    this.time = (this.time + dt) % (this.seasonDuration * ORDER.length);
  }

  getSeason() {
    if (this.isLocked && this.lockedSeason) return this.lockedSeason;
    return ORDER[Math.floor(this.time / this.seasonDuration) % ORDER.length];
  }

  getMultipliers() {
    return SEASONS[this.getSeason()];
  }

  getTint() {
    return SEASONS[this.getSeason()].tint;
  }

  /** Click behavior: Auto → lock Spring → Summer → Autumn → Winter → Auto */
  cycleLock() {
    if (this.isLocked) {
      const idx = ORDER.indexOf(this.lockedSeason);
      if (idx === ORDER.length - 1) {
        this.isLocked = false;
        this.lockedSeason = null;
        return 'auto';
      }
      this.lockedSeason = ORDER[idx + 1];
    } else {
      this.isLocked = true;
      this.lockedSeason = ORDER[0];
    }
    return this.lockedSeason;
  }
}
