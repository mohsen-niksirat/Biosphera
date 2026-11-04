/**
 * Biosphera - Toroidal world helpers
 * The world wraps at its edges, so distances and directions must be measured
 * along the shortest wrapped path, not raw coordinate deltas.
 */

/**
 * Shortest signed delta between two positions on one wrapping axis.
 * Pass Infinity (or leave undefined via a missing env field) to disable wrapping.
 */
export function wrapDelta(d, worldSize) {
  if (d > worldSize * 0.5) return d - worldSize;
  if (d < -worldSize * 0.5) return d + worldSize;
  return d;
}

/**
 * Wrap an absolute position onto [0, worldSize). A non-finite worldSize
 * (caller without world dimensions) leaves the value untouched.
 */
export function wrapCoord(v, worldSize) {
  if (!Number.isFinite(worldSize)) return v;
  return ((v % worldSize) + worldSize) % worldSize;
}
