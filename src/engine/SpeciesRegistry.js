/**
 * Biosphera - Automatic Species Classification & Naming
 * Clusters living organisms by genetic similarity each second and assigns
 * stable, deterministic Latin-esque names to each emerging species.
 */

const PREFIX = [
  'Cyan', 'Velox', 'Nano', 'Mega', 'Umbra', 'Luma', 'Flux', 'Glacia',
  'Pyro', 'Verdi', 'Auro', 'Noct', 'Zephy', 'Coral', 'Abyss', 'Tidal',
  'Sable', 'Iris', 'Kelp', 'Onda'
];
const SUFFIX = ['pod', 'fin', 'dron', 'morph', 'zoid', 'phage', 'ella', 'ura', 'nym', 'cra', 'vis', 'gaia'];

const SIZE_BUCKETS = 4;      // size quantization for name stability
const CLUSTER_THRESHOLD = 0.3;

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** Weighted genetic distance in [0, ~1]. */
function geneticDistance(a, b) {
  const dHue = hueDistance(a.dna.colorHue, b.dna.colorHue) / 180;
  const dSize = Math.abs(a.dna.size - b.dna.size) / 16;
  const dSpeed = Math.abs(a.dna.speed - b.dna.speed) / 4.3;
  const dDiet = Math.abs(a.dna.diet - b.dna.diet) / 2;
  const dVision = Math.abs(a.dna.sensorRange - b.dna.sensorRange) / 260;
  return Math.sqrt(dHue * dHue * 1.2 + dSize * dSize + dSpeed * dSpeed + dDiet * dDiet + dVision * dVision * 0.6);
}

function hashGenome(dna) {
  const key = [
    Math.round(dna.colorHue / 40),
    Math.round(dna.size / 4),
    dna.diet < -0.33 ? 0 : (dna.diet > 0.33 ? 2 : 1),
    Math.round(dna.speed / 1.5),
    Math.round(dna.sensorRange / 80)
  ].join('-');
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class SpeciesRegistry {
  constructor() {
    this.species = [];   // { name, count, hue, diet, gen, members }
    this.nameCache = new Map(); // genome hash → name (keeps names stable)
    this.lastUpdate = 0;
  }

  update(world, now) {
    if (now - this.lastUpdate < 1000) return;
    this.lastUpdate = now;

    const living = world.organisms;
    const clusters = [];

    for (const org of living) {
      let best = null;
      let bestDist = CLUSTER_THRESHOLD;
      for (const cluster of clusters) {
        const d = geneticDistance(cluster.prototype, org);
        if (d < bestDist) {
          bestDist = d;
          best = cluster;
        }
      }
      if (best) {
        best.members.push(org);
      } else {
        clusters.push({ prototype: org, members: [org] });
      }
    }

    const usedNames = new Set();
    this.species = clusters.map((c) => {
      const hash = hashGenome(c.prototype.dna);
      let name = this.nameCache.get(hash);
      if (!name || usedNames.has(name)) {
        name = this._generateName(hash, usedNames);
      }
      usedNames.add(name);
      this.nameCache.set(hash, name);

      let dietSum = 0;
      let gen = Infinity;
      for (const m of c.members) {
        dietSum += m.dna.diet;
        if (m.generation < gen) gen = m.generation;
      }

      for (const m of c.members) m.speciesName = name;

      return {
        name,
        count: c.members.length,
        hue: c.prototype.dna.colorHue,
        diet: dietSum / c.members.length,
        gen
      };
    });

    this.species.sort((a, b) => b.count - a.count);
  }

  _generateName(hash, used) {
    const p = PREFIX[hash % PREFIX.length];
    const s = SUFFIX[Math.floor(hash / PREFIX.length) % SUFFIX.length];
    let name = `${p}${s}`;
    let n = 2;
    while (used.has(name)) {
      name = `${p}${s} ${n++}`;
    }
    return name;
  }
}
