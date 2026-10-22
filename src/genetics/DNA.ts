/**
 * Biosphera - Genetic Architecture (DNA)
 * Encodes morphological traits, metabolic properties, and neural weights.
 */

import { NeuralNet, BrainTopology } from '../brain/NeuralNet';

export const DEFAULT_BRAIN_TOPOLOGY: BrainTopology = {
  inputs: 8,
  hiddens: [7],
  outputs: 4
};

export interface DNAParams {
  size: number;              // Radius in pixels [6, 22]
  speed: number;             // Top speed capability [1.5, 5.5]
  sensorRange: number;       // Visual range [60, 320]
  sensorFov: number;         // Field of view in radians [0.4 * PI, 1.8 * PI]
  colorHue: number;          // Base visual hue [0, 360]
  diet: number;              // -1.0 (pure herbivore) to +1.0 (pure carnivore)
  reproduceThreshold: number;// Energy needed to split [130, 240]
  gestationShare: number;    // % of energy given to newborn [0.4, 0.6]
  brain: NeuralNet;
}

export class DNA {
  public size: number;
  public speed: number;
  public sensorRange: number;
  public sensorFov: number;
  public colorHue: number;
  public diet: number;
  public reproduceThreshold: number;
  public gestationShare: number;
  public brain: NeuralNet;

  constructor(params?: Partial<DNAParams>) {
    this.size = params?.size ?? (8 + Math.random() * 8);
    this.speed = params?.speed ?? (2.0 + Math.random() * 2.0);
    this.sensorRange = params?.sensorRange ?? (100 + Math.random() * 120);
    this.sensorFov = params?.sensorFov ?? (Math.PI * 0.8 + (Math.random() - 0.5) * 0.6);
    this.colorHue = params?.colorHue ?? Math.floor(Math.random() * 360);
    this.diet = params?.diet ?? (Math.random() * 2 - 1); // Random diet on genesis
    this.reproduceThreshold = params?.reproduceThreshold ?? (140 + Math.random() * 60);
    this.gestationShare = params?.gestationShare ?? (0.45 + Math.random() * 0.1);
    this.brain = params?.brain ?? new NeuralNet(DEFAULT_BRAIN_TOPOLOGY);
  }

  /**
   * Produce a mutated offspring DNA
   */
  public mutate(rate: number = 0.08, power: number = 0.25): DNA {
    const mutateNum = (val: number, min: number, max: number, prob: number = rate): number => {
      if (Math.random() < prob) {
        const delta = (Math.random() * 2 - 1) * (max - min) * 0.12 * (power / 0.25);
        return Math.max(min, Math.min(max, val + delta));
      }
      return val;
    };

    const newBrain = this.brain.clone();
    newBrain.mutate(rate, power);

    // Hue shifts slightly on mutation
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
   * Serialize DNA to base64 for one-click sharing or export
   */
  public serialize(): string {
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

  public static deserialize(dnaString: string): DNA {
    try {
      const parsed = JSON.parse(atob(dnaString));
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
      console.error('Failed to parse DNA string:', e);
      return new DNA();
    }
  }
}
