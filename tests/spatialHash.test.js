import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialHash } from '../src/engine/SpatialHash.js';

describe('SpatialHash', () => {
  it('finds entities within radius and excludes out-of-range entities', () => {
    const hash = new SpatialHash(80, 800, 800);
    const a = { id: 'a', x: 100, y: 100 };
    const b = { id: 'b', x: 140, y: 130 }; // dist = 50
    const c = { id: 'c', x: 220, y: 100 }; // dist = 120
    hash.insert(a);
    hash.insert(b);
    hash.insert(c);

    const res = hash.query(100, 100, 60);
    const ids = res.map((e) => e.id).sort();
    assert.deepEqual(ids, ['a', 'b']);
  });

  it('clears all stored entities', () => {
    const hash = new SpatialHash(80, 800, 800);
    hash.insert({ id: 'a', x: 50, y: 50 });
    assert.equal(hash.query(50, 50, 20).length, 1);
    hash.clear();
    assert.equal(hash.query(50, 50, 20).length, 0);
  });

  it('finds entities across toroidal world seams when worldSize is a multiple of cellSize', () => {
    const hash = new SpatialHash(80, 800, 800);
    const nearOrigin = { id: 'origin', x: 10, y: 10 };
    const nearCorner = { id: 'corner', x: 790, y: 790 };
    hash.insert(nearOrigin);
    hash.insert(nearCorner);

    // Wrapped distance between (10,10) and (790,790) is hypot(20, 20) ≈ 28.28
    const fromOrigin = hash.query(10, 10, 40).map((e) => e.id).sort();
    assert.deepEqual(fromOrigin, ['corner', 'origin']);

    const fromCorner = hash.query(790, 790, 40).map((e) => e.id).sort();
    assert.deepEqual(fromCorner, ['corner', 'origin']);
  });

  it('does not return duplicate entities near seams', () => {
    const hash = new SpatialHash(80, 800, 800);
    const edge = { id: 'edge', x: 5, y: 400 };
    hash.insert(edge);

    const res = hash.query(795, 400, 30);
    assert.equal(res.length, 1);
    assert.equal(res[0].id, 'edge');
  });

  it.todo('wraps correctly when worldWidth is not an exact multiple of cellSize (e.g. 2400 / 70)');
});
