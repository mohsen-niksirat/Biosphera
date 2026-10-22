/**
 * Biosphera - Circadian Day/Night Cycle Engine
 * Controls environmental lighting, diurnal plant photosynthesis, and nocturnal bioluminescence.
 */

export type TimeOfDay = 'day' | 'dusk' | 'night' | 'dawn';

export class DayNightCycle {
  constructor(cycleDuration = 90) { // 90 seconds per full 24h cycle
    this.cycleDuration = cycleDuration;
    this.time = 0; // 0 to cycleDuration
    this.isLocked = false;
    this.lockedMode = null; // 'day' | 'night' | null
  }

  update(dt) {
    if (this.isLocked) return;

    this.time = (this.time + dt) % this.cycleDuration;
  }

  getProgress() {
    return this.time / this.cycleDuration; // 0 to 1
  }

  getPhase() {
    if (this.isLocked && this.lockedMode) return this.lockedMode;

    const p = this.getProgress();
    if (p < 0.45) return 'day';
    if (p < 0.55) return 'dusk';
    if (p < 0.90) return 'night';
    return 'dawn';
  }

  getLighting() {
    if (this.isLocked && this.lockedMode === 'day') {
      return { darkness: 0, tint: 'rgba(56, 189, 248, 0)', isBioluminescent: false };
    }
    if (this.isLocked && this.lockedMode === 'night') {
      return { darkness: 0.65, tint: 'rgba(2, 6, 23, 0.72)', isBioluminescent: true };
    }

    const p = this.getProgress();

    // Day: 0 to 0.45
    if (p < 0.45) {
      return { darkness: 0, tint: 'rgba(0,0,0,0)', isBioluminescent: false };
    }
    // Dusk: 0.45 to 0.55
    if (p < 0.55) {
      const t = (p - 0.45) / 0.10;
      return {
        darkness: t * 0.65,
        tint: `rgba(49, 16, 74, ${t * 0.45})`, // Purple/indigo twilight
        isBioluminescent: t > 0.4
      };
    }
    // Deep Night: 0.55 to 0.90
    if (p < 0.90) {
      return {
        darkness: 0.68,
        tint: 'rgba(2, 6, 23, 0.75)', // Abyssal night
        isBioluminescent: true
      };
    }
    // Dawn: 0.90 to 1.0
    const t = 1 - (p - 0.90) / 0.10;
    return {
      darkness: t * 0.65,
      tint: `rgba(249, 115, 22, ${t * 0.35})`, // Amber morning light
      isBioluminescent: t > 0.4
    };
  }

  toggleLock(mode) {
    if (this.lockedMode === mode) {
      this.isLocked = false;
      this.lockedMode = null;
    } else {
      this.isLocked = true;
      this.lockedMode = mode;
    }
    return this.lockedMode || 'auto';
  }
}
