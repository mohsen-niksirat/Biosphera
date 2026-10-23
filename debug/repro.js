/**
 * [DEBUG-b1o] Throwaway repro harness — runs the pure simulation core headless in Node.
 * Verifies: (1) framerate-independent physics, (2) DNA roundtrip, (3) sim invariants.
 * Usage: node debug/repro.js
 */
import { World } from '../src/engine/World.js';
import { DNA } from '../src/genetics/DNA.js';

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

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
