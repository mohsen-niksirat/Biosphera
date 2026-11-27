import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { wrapDelta, wrapCoord } from '../src/engine/wrapDelta.js';

describe('wrapDelta', () => {
  it('returns raw delta when within half world size', () => {
    assert.equal(wrapDelta(100, 2400), 100);
    assert.equal(wrapDelta(-100, 2400), -100);
    assert.equal(wrapDelta(0, 2400), 0);
  });

  it('wraps across the positive seam to negative shortest path', () => {
    assert.equal(wrapDelta(2350, 2400), -50);
    assert.equal(wrapDelta(1201, 2400), -1199);
  });

  it('wraps across the negative seam to positive shortest path', () => {
    assert.equal(wrapDelta(-2350, 2400), 50);
    assert.equal(wrapDelta(-1201, 2400), 1199);
  });

  it('leaves delta untouched when worldSize is Infinity or undefined', () => {
    assert.equal(wrapDelta(5000, Infinity), 5000);
    assert.equal(wrapDelta(-5000, undefined), -5000);
  });
});

describe('wrapCoord', () => {
  it('wraps coordinates onto [0, worldSize)', () => {
    assert.equal(wrapCoord(2450, 2400), 50);
    assert.equal(wrapCoord(-50, 2400), 2350);
    assert.equal(wrapCoord(2400, 2400), 0);
    assert.equal(wrapCoord(0, 2400), 0);
  });

  it('handles multiple wraps', () => {
    assert.equal(wrapCoord(5000, 2400), 200);
    assert.equal(wrapCoord(-2500, 2400), 2300);
  });

  it('leaves value untouched for non-finite worldSize', () => {
    assert.equal(wrapCoord(-42, Infinity), -42);
    assert.equal(wrapCoord(9999, undefined), 9999);
  });
});
