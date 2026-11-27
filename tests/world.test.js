import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import { DNA } from '../src/genetics/DNA.js';

describe('World', () => {
  it('initializes sanctuary preset and switches presets cleanly', () => {
    const world = new World(1200, 900);
    assert.equal(world.currentPreset, 'sanctuary');
    assert.equal(world.organisms.length, 35);
    assert.equal(world.foods.length, 160);
    assert.equal(world.hazards.length, 2);

    world.loadPreset('wasteland');
    assert.equal(world.currentPreset, 'wasteland');
    assert.equal(world.organisms.length, 40);
    assert.equal(world.hazards.length, 0);

    world.loadPreset('glacial');
    assert.equal(world.currentPreset, 'glacial');
    assert.ok(world.iceAgeTimer > 1000);
  });

  it('respects pause state and advances simulation when unpaused', () => {
    const world = new World(1200, 900);
    const first = world.organisms[0];
    const startAge = first.age;

    world.isPaused = true;
    world.update(0.1);
    assert.equal(first.age, startAge);

    world.isPaused = false;
    world.update(0.1);
    assert.ok(first.age > startAge);
  });

  it('rescues ecosystem from extinction when all organisms die', () => {
    const world = new World(1200, 900);
    world.foods = [];
    world.foodSpawnRate = 0;
    for (const org of world.organisms) {
      org.dna.diet = -1;
      org.energy = 0.001;
    }
    // Step enough time for basal metabolism to kill everyone
    for (let i = 0; i < 5; i++) {
      world.stepOnce(0.1);
    }
    assert.equal(world.organisms.length, 15);
  });

  it('triggers disasters and respects caps', () => {
    const world = new World(1200, 900);
    world.triggerIceAge();
    assert.equal(world.iceAgeTimer, 18);

    const added = world.triggerFoodSurge();
    assert.ok(added > 0);
    assert.ok(world.foods.length <= world.maxFoodCap);

    world.triggerRadiationFlare();
    assert.equal(world.radiationTimer, 15);

    for (let i = 0; i < 8; i++) {
      world.triggerToxicBloom();
    }
    assert.ok(world.hazards.length <= 6);
  });

  it('serializes and restores full world state, rejecting invalid payloads', () => {
    const world = new World(1200, 900);
    world.sexualReproduction = true;
    world.mutationScale = 1.5;
    world.spawnOrganismAt(300, 400, new DNA({ size: 19, diet: 0.75 }));
    world.stepOnce(0.05);

    const snapshot = world.serializeState();
    const restored = new World(800, 600);
    assert.equal(restored.loadState(snapshot), true);

    assert.equal(restored.width, 1200);
    assert.equal(restored.height, 900);
    assert.equal(restored.sexualReproduction, true);
    assert.equal(restored.mutationScale, 1.5);
    assert.equal(restored.organisms.length, world.organisms.length);
    assert.equal(restored.foods.length, world.foods.length);
    assert.equal(restored.hazards.length, world.hazards.length);

    assert.equal(restored.loadState(null), false);
    assert.equal(restored.loadState({ version: 2, organisms: [] }), false);
    assert.equal(restored.loadState({ version: 1, width: -10, height: 100, organisms: [] }), false);
  });

  it('computes accurate ecology stats', () => {
    const world = new World(1200, 900);
    world.organisms = [];
    world.spawnOrganismAt(100, 100, new DNA({ diet: -0.8 }));
    world.spawnOrganismAt(200, 200, new DNA({ diet: 0.8 }));
    world.spawnOrganismAt(300, 300, new DNA({ diet: 0.0 }));

    const stats = world.getStats(59.6);
    assert.equal(stats.population, 3);
    assert.equal(stats.herbivores, 1);
    assert.equal(stats.carnivores, 1);
    assert.equal(stats.omnivores, 1);
    assert.equal(stats.fps, 60);
  });

  it('cleans up predation deaths immediately within the same stepOnce', () => {
    const world = new World(1200, 900);
    world.organisms = [];
    world.foods = [];
    const prey = world.spawnOrganismAt(400, 400, new DNA({ size: 8, diet: -0.9, armor: 0 }));
    prey.energy = 1;
    const predator = world.spawnOrganismAt(402, 400, new DNA({ size: 18, diet: 1.0, jawPower: 2.0 }));
    predator.performFeeding([], [prey], { width: 1200, height: 900 });
    assert.equal(prey.isDead, true);

    world.stepOnce(0.05);
    assert.ok(!world.organisms.includes(prey), 'dead prey should be removed immediately');
    assert.ok(world.totalDeaths >= 1);
  });

  it('initializes 3 spatial habitats and recycles decayed meat into plant fertilizer', async () => {
    const { Food } = await import('../src/entities/Food.js');
    const world = new World(1200, 900);
    assert.equal(world.habitats.length, 3);
    assert.deepEqual(world.habitats.map((h) => h.type).sort(), ['reef', 'thermal', 'upwelling']);

    world.organisms = [];
    world.currentStrength = 0;
    world.foods = [new Food(500, 500, 'meat', 1.01)];
    // Decaying meat drops below 1 energy and spawns a plant pulse
    world.stepOnce(2.0);
    const plants = world.foods.filter((f) => f.type === 'plant' && Math.hypot(f.x - 500, f.y - 500) < 1);
    assert.ok(plants.length >= 1, 'decayed meat should spawn a plant fertilizer pulse');
  });
});
