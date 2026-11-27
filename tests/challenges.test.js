import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Challenges } from '../src/engine/Challenges.js';
import { World } from '../src/engine/World.js';
import { DNA } from '../src/genetics/DNA.js';

describe('Challenges', () => {
  it('evaluates all 4 scientific challenges and tracks newly completed IDs', () => {
    const challenges = new Challenges();
    const world = new World(1200, 900);
    world.organisms = [];

    const speciesRegistry = { species: [{ name: 'A' }, { name: 'B' }] };
    const seasonCycle = { getSeason: () => 'spring' };

    // Initial evaluation: none completed
    const first = challenges.evaluate(world, speciesRegistry, seasonCycle);
    assert.equal(first.challenges.length, 4);
    assert.deepEqual(first.newlyCompleted, []);

    // Trigger apex_predator (diet > 0.65, gen >= 5, kills >= 3) & century_lineage (gen >= 10)
    const apex = world.spawnOrganismAt(200, 200, new DNA({ diet: 0.8 }));
    apex.generation = 10;
    apex.kills = 3;

    // Trigger speciation (3+ species)
    speciesRegistry.species.push({ name: 'C' });

    // Trigger winter_survivor (30+ organisms in winter)
    for (let i = 0; i < 29; i++) {
      world.spawnOrganismAt(300 + i, 300, new DNA());
    }
    const winterCycle = { getSeason: () => 'winter' };

    const second = challenges.evaluate(world, speciesRegistry, winterCycle);
    assert.deepEqual(
      second.newlyCompleted.sort(),
      ['apex_predator', 'century_lineage', 'speciation', 'winter_survivor']
    );
    assert.ok(second.challenges.every((c) => c.completed && c.progress === c.target));

    // Subsequent evaluation does not re-emit newlyCompleted and stays completed
    world.organisms = [];
    const third = challenges.evaluate(world, { species: [] }, { getSeason: () => 'summer' });
    assert.deepEqual(third.newlyCompleted, []);
    assert.ok(third.challenges.every((c) => c.completed));
  });
});
