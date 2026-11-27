import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NeuralNet, DEFAULT_BRAIN_TOPOLOGY } from '../src/brain/NeuralNet.js';

describe('NeuralNet', () => {
  it('initializes with default topology (9 -> [7] -> 4) and produces bounded outputs', () => {
    const net = new NeuralNet();
    assert.deepEqual(net.topology, DEFAULT_BRAIN_TOPOLOGY);
    assert.equal(net.weights.length, 2);
    assert.equal(net.biases.length, 2);

    const out = net.feedForward([0.5, -0.2, 0.8, 0, 1, 0, 0.7, 1, 0.1]);
    assert.equal(out.length, 4);
    for (let i = 0; i < out.length; i++) {
      assert.ok(Number.isFinite(out[i]));
      assert.ok(out[i] >= -1 && out[i] <= 1);
    }
  });

  it('is deterministic for identical inputs', () => {
    const net = new NeuralNet();
    const inputs = [0.3, 0.1, -0.4, 0.2, 0, 0.5, 0.9, 1, -0.2];
    const out1 = Float32Array.from(net.feedForward(inputs));
    const out2 = Float32Array.from(net.feedForward(inputs));
    assert.deepEqual(out1, out2);
  });

  it('clones independently without sharing weight or bias buffers', () => {
    const net = new NeuralNet();
    const clone = net.clone();
    const before = net.weights[0][0][0];
    clone.weights[0][0][0] = before === 1 ? -1 : 1;
    assert.equal(net.weights[0][0][0], before);
  });

  it('clamps weights to [-3, 3] and biases to [-2, 2] during mutation', () => {
    const net = new NeuralNet();
    for (let i = 0; i < 50; i++) {
      net.mutate(1.0, 2.0);
    }
    for (const layer of net.weights) {
      for (const row of layer) {
        for (const w of row) {
          assert.ok(w >= -3 && w <= 3, `weight out of bounds: ${w}`);
        }
      }
    }
    for (const layer of net.biases) {
      for (const b of layer) {
        assert.ok(b >= -2 && b <= 2, `bias out of bounds: ${b}`);
      }
    }
  });

  it('round-trips through serialize and deserialize', () => {
    const net = new NeuralNet();
    const inputs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0, -0.1];
    const expected = Float32Array.from(net.feedForward(inputs));

    const restored = NeuralNet.deserialize(net.serialize());
    const actual = Float32Array.from(restored.feedForward(inputs));
    assert.deepEqual(actual, expected);
  });

  it('rejects tampered topologies, mismatched shapes, and non-finite weights', () => {
    const valid = new NeuralNet().serialize();

    assert.throws(() => NeuralNet.deserialize({ ...valid, topology: { inputs: 0, hiddens: [7], outputs: 4 } }));
    assert.throws(() => NeuralNet.deserialize({ ...valid, weights: [] }));

    const badWeight = structuredClone(valid);
    badWeight.weights[0][0][0] = NaN;
    assert.throws(() => NeuralNet.deserialize(badWeight));

    const badBias = structuredClone(valid);
    badBias.biases[0].pop();
    assert.throws(() => NeuralNet.deserialize(badBias));
  });
});
