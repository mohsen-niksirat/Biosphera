/**
 * Biosphera - Genetic Architecture (DNA)
 */

import { NeuralNet, DEFAULT_BRAIN_TOPOLOGY } from '../brain/NeuralNet.js';

export class DNA {
  constructor(params = {}) {
    this.size = params.size ?? (8 + Math.random() * 8);
    this.speed = params.speed ?? (2.0 + Math.random() * 2.0);
    this.sensorRange = params.sensorRange ?? (100 + Math.random() * 120);
    this.sensorFov = params.sensorFov ?? (Math.PI * 0.8 + (Math.random() - 0.5) * 0.6);
    this.colorHue = params.colorHue ?? Math.floor(Math.random() * 360);
    this.diet = params.diet ?? (Math.random() * 2 - 1); // -1: herbivore, +1: carnivore
    this.reproduceThreshold = params.reproduceThreshold ?? (140 + Math.random() * 60);
    this.gestationShare = params.gestationShare ?? (0.45 + Math.random() * 0.1);
    this.brain = params.brain ?? new NeuralNet(DEFAULT_BRAIN_TOPOLOGY);
  }

  mutate(rate = 0.08, power = 0.25) {
    const mutateNum = (val, min, max, prob = rate) => {
      if (Math.random() < prob) {
        const delta = (Math.random() * 2 - 1) * (max - min) * 0.12 * (power / 0.25);
        return Math.max(min, Math.min(max, val + delta));
      }
      return val;
    };

    const newBrain = this.brain.clone();
    newBrain.mutate(rate, power);

    let newHue = this.colorHue;
    if (Math.random() < rate * 2) {
      newHue = (this.colorHue + (Math.random() * 40 - 20) + 360) % 360;
    }

    return new DNA({
      size: mutateNum(this.size, 6, 22),
      speed: mutateNum(this.speed, 1.2, 5.5),
      sensorRange: mutateNum(this.sensorRange, 60, 320),
      sensorFov: mutateNum(this.sensorFov, Math.PI * 0.4, Math.PI * 1.8),
      colorHue: newHue,
      diet: mutateNum(this.diet, -1.0, 1.0),
      reproduceThreshold: mutateNum(this.reproduceThreshold, 130, 240),
      gestationShare: mutateNum(this.gestationShare, 0.4, 0.6),
      brain: newBrain
    });
  }

  /**
   * Sexual recombination: each trait is picked from either parent, and the brain
   * inherits whole neurons (weight rows) from a single parent to keep circuits coherent.
   */
  static crossover(a, b) {
    const pick = (va, vb) => (Math.random() < 0.5 ? va : vb);

    let brain;
    if (a.brain.topology.inputs === b.brain.topology.inputs &&
        a.brain.topology.outputs === b.brain.topology.outputs) {
      const weights = a.brain.weights.map((layer, l) =>
        layer.map((_, j) => (Math.random() < 0.5 ? a.brain.weights[l][j] : b.brain.weights[l][j]))
          .map((row) => Float32Array.from(row))
      );
      const biases = a.brain.biases.map((layer, l) =>
        layer.map((_, j) => (Math.random() < 0.5 ? a.brain.biases[l][j] : b.brain.biases[l][j]))
      );
      brain = new NeuralNet(a.brain.topology, weights, biases);
    } else {
      brain = a.brain.clone(); // Mismatched topologies (e.g. legacy 8-input DNA): fall back to one parent
    }

    return new DNA({
      size: pick(a.size, b.size),
      speed: pick(a.speed, b.speed),
      sensorRange: pick(a.sensorRange, b.sensorRange),
      sensorFov: pick(a.sensorFov, b.sensorFov),
      colorHue: pick(a.colorHue, b.colorHue),
      diet: pick(a.diet, b.diet),
      reproduceThreshold: pick(a.reproduceThreshold, b.reproduceThreshold),
      gestationShare: pick(a.gestationShare, b.gestationShare),
      brain
    });
  }

  serialize() {
    const payload = {
      s: Number(this.size.toFixed(2)),
      v: Number(this.speed.toFixed(2)),
      sr: Number(this.sensorRange.toFixed(1)),
      fov: Number(this.sensorFov.toFixed(2)),
      h: Math.round(this.colorHue),
      d: Number(this.diet.toFixed(2)),
      rt: Number(this.reproduceThreshold.toFixed(1)),
      gs: Number(this.gestationShare.toFixed(2)),
      b: this.brain.serialize()
    };
    return btoa(JSON.stringify(payload));
  }

  static deserialize(dnaString) {
    try {
      const compact = String(dnaString).replace(/\s+/g, '');
      const parsed = JSON.parse(atob(compact));
      if (!parsed || typeof parsed !== 'object' || !parsed.b) return null;
      const brain = NeuralNet.deserialize(parsed.b);
      return new DNA({
        size: parsed.s,
        speed: parsed.v,
        sensorRange: parsed.sr,
        sensorFov: parsed.fov,
        colorHue: parsed.h,
        diet: parsed.d,
        reproduceThreshold: parsed.rt,
        gestationShare: parsed.gs,
        brain
      });
    } catch (e) {
      console.warn('Failed to parse DNA string:', e.message);
      return null;
    }
  }
}
