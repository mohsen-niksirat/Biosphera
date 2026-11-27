import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DNA } from '../src/genetics/DNA.js';
import { NeuralNet } from '../src/brain/NeuralNet.js';

describe('DNA', () => {
  it('creates valid default traits and a 9-input brain', () => {
    const dna = new DNA();
    assert.ok(dna.size >= 8 && dna.size <= 16);
    assert.ok(dna.speed >= 2 && dna.speed <= 4);
    assert.ok(dna.diet >= -1 && dna.diet <= 1);
    assert.equal(dna.brain.topology.inputs, 9);
    assert.equal(dna.brain.topology.outputs, 4);
  });

  it('keeps mutated traits within physiological bounds', () => {
    let dna = new DNA();
    for (let i = 0; i < 40; i++) {
      dna = dna.mutate(1.0, 1.0);
      assert.ok(dna.size >= 6 && dna.size <= 22);
      assert.ok(dna.speed >= 1.2 && dna.speed <= 5.5);
      assert.ok(dna.sensorRange >= 60 && dna.sensorRange <= 320);
      assert.ok(dna.sensorFov >= Math.PI * 0.4 && dna.sensorFov <= Math.PI * 1.8);
      assert.ok(dna.colorHue >= 0 && dna.colorHue < 360);
      assert.ok(dna.diet >= -1 && dna.diet <= 1);
      assert.ok(dna.reproduceThreshold >= 130 && dna.reproduceThreshold <= 240);
      assert.ok(dna.gestationShare >= 0.4 && dna.gestationShare <= 0.6);
    }
  });

  it('performs sexual crossover for matching and mismatched topologies', () => {
    const a = new DNA({ size: 10, diet: -0.8 });
    const b = new DNA({ size: 18, diet: 0.8 });
    const child = DNA.crossover(a, b);
    assert.ok(child.size === 10 || child.size === 18);
    assert.ok(child.diet === -0.8 || child.diet === 0.8);
    assert.equal(child.brain.topology.inputs, 9);

    // Legacy 8-input parent vs 9-input parent falls back to parent A's brain
    const legacy = new DNA({
      brain: new NeuralNet({ inputs: 8, hiddens: [7], outputs: 4 })
    });
    const fallbackChild = DNA.crossover(legacy, b);
    assert.equal(fallbackChild.brain.topology.inputs, 8);
  });

  it('serializes and deserializes cleanly, ignoring whitespace', () => {
    const dna = new DNA({ size: 14.5, speed: 3.25, diet: -0.5, colorHue: 180 });
    const encoded = dna.serialize();
    const withSpaces = encoded.slice(0, 20) + '\n  ' + encoded.slice(20);
    const restored = DNA.deserialize(withSpaces);

    assert.ok(restored instanceof DNA);
    assert.equal(restored.size, 14.5);
    assert.equal(restored.speed, 3.25);
    assert.equal(restored.diet, -0.5);
    assert.equal(restored.colorHue, 180);
  });

  it('returns null for corrupt or non-finite DNA strings', () => {
    assert.equal(DNA.deserialize('not-valid-base64!!!'), null);
    assert.equal(DNA.deserialize(btoa('{}')), null);

    const badPayload = btoa(JSON.stringify({
      s: 'NaN', v: 2, sr: 100, fov: 2, h: 10, d: 0, rt: 150, gs: 0.5,
      b: new NeuralNet().serialize()
    }));
    assert.equal(DNA.deserialize(badPayload), null);
  });
});
