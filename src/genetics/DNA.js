/**
 * Biosphera - Genetic Architecture (DNA)
 */

import { NeuralNet, DEFAULT_BRAIN_TOPOLOGY } from '../brain/NeuralNet.js';

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

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
    this.jawPower = params.jawPower ?? (0.8 + Math.random() * 0.4);
    this.armor = params.armor ?? (Math.random() * 0.35);
    this.finCount = params.finCount ?? (1 + Math.floor(Math.random() * 3));
    this.fatReserve = params.fatReserve ?? (0.2 + Math.random() * 0.4);
    this.brain = params.brain ?? new NeuralNet(DEFAULT_BRAIN_TOPOLOGY);
  }

  mutate(rate = 0.08, power = 0.25) {
    const mutateNum = (val, min, max, prob = rate) => {
      if (Math.random() < prob) {
        const delta = (Math.random() * 2 - 1) * (max - min) * 0.12 * (power / 0.25);
        return clamp(val + delta, min, max);
      }
      return val;
    };

    const newBrain = this.brain.clone();
    newBrain.mutate(rate, power);

    let newHue = this.colorHue;
    if (Math.random() < rate * 2) {
      newHue = (this.colorHue + (Math.random() * 40 - 20) + 360) % 360;
    }

    let newFinCount = this.finCount;
    if (Math.random() < rate) {
      newFinCount = clamp(this.finCount + (Math.random() < 0.5 ? -1 : 1), 0, 6);
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
      jawPower: mutateNum(this.jawPower, 0.5, 2.0),
      armor: mutateNum(this.armor, 0.0, 1.0),
      finCount: newFinCount,
      fatReserve: mutateNum(this.fatReserve, 0.0, 1.0),
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
        a.brain.topology.outputs === b.brain.topology.outputs &&
        a.brain.weights.length === b.brain.weights.length &&
        a.brain.weights.every((layer, l) => layer.length === b.brain.weights[l].length)) {
      const weights = a.brain.weights.map((layer, l) =>
        layer.map((_, j) => (Math.random() < 0.5 ? a.brain.weights[l][j] : b.brain.weights[l][j]))
          .map((row) => Float32Array.from(row))
      );
      const biases = a.brain.biases.map((layer, l) =>
        layer.map((_, j) => (Math.random() < 0.5 ? a.brain.biases[l][j] : b.brain.biases[l][j]))
      );
      brain = new NeuralNet(a.brain.topology, weights, biases);
    } else {
      brain = a.brain.clone(); // Mismatched topologies (e.g. legacy 8/9-input DNA): fall back to one parent
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
      jawPower: pick(a.jawPower, b.jawPower),
      armor: pick(a.armor, b.armor),
      finCount: pick(a.finCount, b.finCount),
      fatReserve: pick(a.fatReserve, b.fatReserve),
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
      jp: Number(this.jawPower.toFixed(2)),
      ar: Number(this.armor.toFixed(2)),
      fc: Math.round(this.finCount),
      fr: Number(this.fatReserve.toFixed(2)),
      b: this.brain.serialize()
    };
    return btoa(JSON.stringify(payload));
  }

  static deserialize(dnaString) {
    try {
      const compact = String(dnaString).replace(/\s+/g, '');
      const parsed = JSON.parse(atob(compact));
      if (!parsed || typeof parsed !== 'object' || !parsed.b) return null;

      // Every required trait must be a finite number: a corrupt or hand-edited string
      // must be rejected, not silently imported as a NaN-bodied organism.
      const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      const optNum = (v, fallback) => (v === undefined ? fallback : num(v));

      const raw = {
        size: num(parsed.s),
        speed: num(parsed.v),
        sensorRange: num(parsed.sr),
        sensorFov: num(parsed.fov),
        colorHue: num(parsed.h),
        diet: num(parsed.d),
        reproduceThreshold: num(parsed.rt),
        gestationShare: num(parsed.gs),
        jawPower: optNum(parsed.jp, 1.0),
        armor: optNum(parsed.ar, 0.15),
        finCount: optNum(parsed.fc, 2),
        fatReserve: optNum(parsed.fr, 0.2)
      };
      if (Object.values(raw).some((v) => v === null)) return null;
      if (raw.size <= 0 || raw.speed <= 0 || raw.sensorRange <= 0 ||
          raw.sensorFov <= 0 || raw.reproduceThreshold <= 0 || raw.gestationShare <= 0) {
        return null;
      }

      const fields = {
        size: clamp(raw.size, 4, 30),
        speed: clamp(raw.speed, 0.5, 8.0),
        sensorRange: clamp(raw.sensorRange, 20, 500),
        sensorFov: clamp(raw.sensorFov, 0.1, Math.PI * 2),
        colorHue: ((raw.colorHue % 360) + 360) % 360,
        diet: clamp(raw.diet, -1.0, 1.0),
        reproduceThreshold: clamp(raw.reproduceThreshold, 40, 500),
        gestationShare: clamp(raw.gestationShare, 0.1, 0.9),
        jawPower: clamp(raw.jawPower, 0.5, 2.0),
        armor: clamp(raw.armor, 0.0, 1.0),
        finCount: Math.round(clamp(raw.finCount, 0, 6)),
        fatReserve: clamp(raw.fatReserve, 0.0, 1.0)
      };

      const brain = NeuralNet.deserialize(parsed.b);
      return new DNA({ ...fields, brain });
    } catch (e) {
      console.warn('Failed to parse DNA string:', e.message);
      return null;
    }
  }
}
