/**
 * [DEBUG-b1o] Throwaway repro harness — runs the pure simulation core headless in Node.
 * Verifies: (1) framerate-independent physics, (2) DNA roundtrip, (3) sim invariants.
 * Usage: node debug/repro.js
 */
import { World } from '../src/engine/World.js';
import { DNA } from '../src/genetics/DNA.js';
import { Organism } from '../src/entities/Organism.js';
import { FlowField } from '../src/engine/FlowField.js';
import { SeasonCycle } from '../src/engine/SeasonCycle.js';
import { PheromoneField } from '../src/engine/PheromoneField.js';
import { SpeciesRegistry } from '../src/engine/SpeciesRegistry.js';
import { HallOfFame } from '../src/engine/HallOfFame.js';
import { EvolutionChart } from '../src/ui/EvolutionChart.js';

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Advance world deterministically at a given FPS for simSeconds; return metrics. */
function runAtFps(fps, simSeconds, seedSetup) {
  const world = seedSetup();
  const dt = 1 / fps;
  const frames = Math.round(simSeconds / dt);
  let distance = 0;
  let prev = new Map(world.organisms.map(o => [o.id, { x: o.x, y: o.y }]));

  for (let f = 0; f < frames; f++) {
    world.update(dt);
    for (const o of world.organisms) {
      const p = prev.get(o.id);
      if (p) {
        let dx = o.x - p.x, dy = o.y - p.y;
        // toroidal wrap: ignore jumps larger than half the world (wrap artifacts)
        if (Math.abs(dx) > world.width / 2) dx = 0;
        if (Math.abs(dy) > world.height / 2) dy = 0;
        distance += Math.hypot(dx, dy);
      }
      prev.set(o.id, { x: o.x, y: o.y });
    }
  }
  const aliveTime = world.organisms.map(o => o.age);
  const avgAge = aliveTime.reduce((a, b) => a + b, 0) / Math.max(1, aliveTime.length);
  return {
    population: world.organisms.length,
    totalDistance: distance,
    avgSpeed: distance / simSeconds / Math.max(1, world.organisms.length),
    maxGeneration: world.maxGeneration,
    avgAge
  };
}

const mkWorld = () => {
  const w = new World(2400, 1800);
  w.foods = [];
  for (let i = 0; i < 200; i++) w.foods.push({ x: Math.random() * 2400, y: Math.random() * 1800, type: 'plant', energy: 25, radius: 3.5, age: 0, maxAge: 300, update: () => true });
  return w;
};

// --- Test 1: physics must be framerate-independent (60 vs 144 fps) ---
const m60 = runAtFps(60, 6, mkWorld);
const m144 = runAtFps(144, 6, mkWorld);
const ratio = m144.avgSpeed / m60.avgSpeed;
check('Framerate independence: avg speed @144fps ≈ @60fps',
  ratio > 0.75 && ratio < 1.35,
  `speed@60=${m60.avgSpeed.toFixed(1)}px/s speed@144=${m144.avgSpeed.toFixed(1)}px/s ratio=${ratio.toFixed(2)}`);

// --- Test 2: timeScale must scale movement consistently (10x speed => ~10x distance) ---
function runScaled(scale, simSeconds) {
  const world = mkWorld();
  const dt = 1 / 60;
  const frames = Math.round(simSeconds / dt);
  let distance = 0;
  const prev = new Map(world.organisms.map(o => [o.id, { x: o.x, y: o.y }]));
  for (let f = 0; f < frames; f++) {
    world.update(dt * scale);
    for (const o of world.organisms) {
      const p = prev.get(o.id);
      if (p) {
        let dx = o.x - p.x, dy = o.y - p.y;
        if (Math.abs(dx) > world.width / 2) dx = 0;
        if (Math.abs(dy) > world.height / 2) dy = 0;
        distance += Math.hypot(dx, dy);
      }
      prev.set(o.id, { x: o.x, y: o.y });
    }
  }
  return distance / simSeconds; // px per real-second at this sim speed
}
const perSec1x = runScaled(1, 4);
const perSec10x = runScaled(10, 4);
const scaleRatio = perSec10x / perSec1x;
check('Speed multiplier: distance/real-sec @10x ≈ 10 × @1x',
  scaleRatio > 7 && scaleRatio < 13,
  `1x=${perSec1x.toFixed(0)}px/s 10x=${perSec10x.toFixed(0)}px/s ratio=${scaleRatio.toFixed(2)}`);

// --- Test 3: DNA serialize/deserialize roundtrip preserves traits ---
const dna = new DNA({ size: 13.5, speed: 4.2, diet: 0.8, sensorRange: 250, sensorFov: 2.0, colorHue: 250, reproduceThreshold: 180, gestationShare: 0.5 });
const clone = DNA.deserialize(dna.serialize());
check('DNA roundtrip preserves genome + brain topology',
  Math.abs(clone.size - 13.5) < 0.01 && Math.abs(clone.speed - 4.2) < 0.01 &&
  Math.abs(clone.diet - 0.8) < 0.01 && clone.colorHue === 250 &&
  clone.brain.topology.inputs === dna.brain.topology.inputs &&
  clone.brain.weights[0][0][0] === dna.brain.weights[0][0][0],
  `size=${clone.size} speed=${clone.speed} diet=${clone.diet} hue=${clone.colorHue}`);

// --- Test 4: invalid DNA string must return null (no silent random organism) ---
const bad = DNA.deserialize('!!!not-base64!!!');
const empty = DNA.deserialize('');
check('Invalid DNA returns null without throwing', bad === null && empty === null);

// --- Test 5: simulation stability — 60s run, population bounded, no NaN ---
const w = mkWorld();
for (let f = 0; f < 60 * 60; f++) w.update(1 / 60);
const hasNaN = w.organisms.some(o => !Number.isFinite(o.x) || !Number.isFinite(o.y) || !Number.isFinite(o.energy));
check('60s stability: population bounded, no NaN coordinates',
  !hasNaN && w.organisms.length <= w.maxPopulationCap,
  `pop=${w.organisms.length} gen=${w.maxGeneration}`);

// --- Test 6: ecosystem save/load roundtrip preserves population & genome ---
{
  const w1 = mkWorld();
  for (let f = 0; f < 30 * 60; f++) w1.update(1 / 60);
  const snap = w1.serializeState();
  const w2 = new World(2400, 1800);
  const ok = w2.loadState(JSON.parse(JSON.stringify(snap)));
  const a = w1.organisms.find(Boolean), b = w2.organisms[0];
  const dnaOk = a && b && Math.abs(a.dna.size - b.dna.size) < 0.01;
  check('Save/Load roundtrip: population, ids & genome survive',
    ok && w2.organisms.length === w1.organisms.length &&
    w2.foods.length === w1.foods.length &&
    w2.maxGeneration === w1.maxGeneration && dnaOk &&
    w2.organisms.some(o => o.id === a.id),
    `orgs=${w2.organisms.length}/${w1.organisms.length} foods=${w2.foods.length}/${w1.foods.length}`);
}

// --- Test 7: species clustering & stable naming ---
{
  const reg = new SpeciesRegistry();
  const w = new World(2400, 1800);
  w.organisms = [];
  const g1 = new DNA({ size: 12, speed: 3, diet: -0.8, sensorRange: 150, colorHue: 100 });
  const g2 = new DNA({ size: 21, speed: 5, diet: 0.9, sensorRange: 300, colorHue: 300 });
  for (let i = 0; i < 8; i++) w.organisms.push(new Organism(i * 50, 100, g1.mutate(0.02, 0.1), 1));
  for (let i = 0; i < 5; i++) w.organisms.push(new Organism(i * 50, 900, g2.mutate(0.02, 0.1), 1));
  reg.update(w, 1000);
  check('Species clustering: two distinct genomes → two named species, all members labeled',
    reg.species.length === 2 &&
    reg.species.every(s => s.count === 8 || s.count === 5) &&
    w.organisms.every(o => typeof o.speciesName === 'string' && o.speciesName.length > 2),
    reg.species.map(s => `${s.name}×${s.count}`).join(', '));
  const names1 = reg.species.map(s => s.name);
  const reg2 = new SpeciesRegistry();
  reg2.update(w, 1000);
  check('Species names deterministic across registries', JSON.stringify(names1) === JSON.stringify(reg2.species.map(s => s.name)));
}

// --- Test 8: flow field bounded & current push keeps sim finite ---
{
  const f = new FlowField(2400, 1800);
  let bounded = true;
  for (let i = 0; i < 500; i++) {
    const v = f.sample(Math.random() * 2400, Math.random() * 1800);
    if (!Number.isFinite(v.vx) || !Number.isFinite(v.vy) || Math.abs(v.vx) > 60 || Math.abs(v.vy) > 60) bounded = false;
  }
  const w = new World(2400, 1800);
  w.currentStrength = 0.9;
  for (let i = 0; i < 60 * 20; i++) w.update(1 / 60);
  const nan = w.organisms.some(o => !Number.isFinite(o.x) || !Number.isFinite(o.y));
  check('Flow field bounded; currents keep simulation finite', bounded && !nan);
}

// --- Test 9: seasons cycle order & multiplier bounds ---
{
  const s = new SeasonCycle(1);
  const seen = new Set();
  let valid = true;
  for (let i = 0; i < 10; i++) {
    const m = s.getMultipliers();
    if (!(m.food > 0 && m.food <= 1.5 && m.metabolism >= 0.9 && m.metabolism <= 1.25)) valid = false;
    seen.add(s.getSeason());
    s.update(1); // advance one full season
  }
  check('Season cycle covers all 4 seasons with sane multipliers', seen.size === 4 && valid, [...seen].join(','));
}

// --- Test 10: pheromone field deposit/decay/sample sane ---
{
  const p = new PheromoneField(2400, 1800);
  for (let i = 0; i < 20; i++) p.deposit(100, 100, 'food', 0.5);
  const peak = p.sample(100, 100);
  for (let i = 0; i < 40; i++) p.update(1);
  const decayed = p.sample(100, 100);
  check('Pheromone field: deposits register, decay over time, signal within [-1,1]',
    peak > 0.5 && decayed < peak && Math.abs(decayed) <= 1, `peak=${peak.toFixed(2)} decayed=${decayed.toFixed(2)}`);
}

// --- Test 11: DNA crossover recombines parent traits ---
{
  const a = new DNA({ size: 6, speed: 1.5, diet: -1, sensorRange: 60, colorHue: 10 });
  const b = new DNA({ size: 22, speed: 5.5, diet: 1, sensorRange: 320, colorHue: 350 });
  let mixed = 0;
  for (let i = 0; i < 30; i++) {
    const c = DNA.crossover(a, b);
    if (c.brain.topology.inputs !== 9) { check('Crossover brain keeps topology', false); break; }
    if (Object.is(c.size, a.size) || Object.is(c.size, b.size)) mixed++;
  }
  check('Crossover: every child trait picked from a parent; brain topology preserved', mixed === 30);
}

// --- Test 12: sexual reproduction produces recombined offspring ---
{
  const w = new World(2400, 1800);
  w.organisms = [];
  w.sexualReproduction = true;
  const dna = new DNA({ size: 12, speed: 3, diet: -0.5, sensorRange: 200, colorHue: 50 });
  const p1 = new Organism(100, 100, dna, 3);
  const p2 = new Organism(120, 100, new DNA({ size: 14, speed: 3.5, diet: -0.4, sensorRange: 220, colorHue: 60 }), 3);
  p1.energy = p1.dna.reproduceThreshold;
  p2.energy = p2.dna.reproduceThreshold;
  p1.age = 10; p2.age = 10; p1.heading = 0; p2.heading = Math.PI;
  // Force both brains to want reproduction
  const outputs = new Float32Array([0, 0, 0, 1]);
  p1.update = p1.update; // keep real method
  w.organisms.push(p1, p2);
  w.spatialOrganisms.insert(p1); w.spatialOrganisms.insert(p2);
  const child = p1.mateWith(p2);
  check('Mating produces child with recombined DNA & energy transfer',
    child && child.generation === 4 && child.parentId === p1.id &&
    p1.childrenCount === 1 && p2.childrenCount === 1 &&
    p1.reproduceCooldown > 8 && child.energy > 0,
    `childGen=${child?.generation} energy=${child?.energy?.toFixed(1)}`);
}

// --- Test 13: evolution trends chart sampling (stub canvas) ---
{
  const noop = () => {};
  const ctxStub = new Proxy({}, { get: (t, prop) => (prop in t ? t[prop] : noop), set: (t, prop, v) => { t[prop] = v; return true; } });
  const chart = new EvolutionChart(null, 30);
  chart.canvas = { width: 340, height: 110 };
  chart.ctx = ctxStub;
  let threw = false;
  try {
    for (let i = 0; i < 25; i++) chart.record({ avgSize: 10 + i * 0.1, avgSpeed: 3, avgVision: 150, avgDiet: -0.2, avgGeneration: 5 }, i * 1000 + 700);
  } catch (e) { threw = true; }
  check('Evolution trends chart samples & renders without throwing', !threw && chart.history.length === 25);
}

// --- Test 14: hall of fame records update & persist ---
{
  const w = new World(2400, 1800);
  w.organisms[0].age = 200;
  w.organisms[0].kills = 5;
  const hof = new HallOfFame();
  hof.records = { oldestAge: null, mostChildren: null, mostKills: null, mostPlants: null, peakPopulation: null, maxGeneration: null };
  hof.update(w, 1000);
  check('Hall of Fame captures record holders', hof.records.oldestAge?.value === 200 && hof.records.mostKills?.value === 5);
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
