import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Organism } from '../src/entities/Organism.js';
import { DNA } from '../src/genetics/DNA.js';
import { Food } from '../src/entities/Food.js';
import { Hazard } from '../src/entities/Hazard.js';
import { PheromoneField } from '../src/engine/PheromoneField.js';

describe('Organism', () => {
  it('senses matching food across toroidal seams and respects dietary filters', () => {
    const herbivore = new Organism(10, 100, new DNA({ diet: -0.9, sensorRange: 150, sensorFov: Math.PI * 1.8 }));
    herbivore.heading = Math.PI; // looking left toward x=2390

    const meat = new Food(2390, 100, 'meat', 35);
    const plant = new Food(2380, 100, 'plant', 25);
    const pheromones = new PheromoneField(2400, 1800);
    pheromones.deposit(10, 100, 'food', 1.0);

    const inputs = herbivore.sense([meat, plant], [], [], {
      width: 2400,
      height: 1800,
      pheromones
    });

    // Should ignore meat and sense plant at wrapped distance 30
    assert.ok(inputs[0] > 0.75 && inputs[0] < 0.85, `unexpected food proximity: ${inputs[0]}`);
    assert.equal(herbivore.nearestTarget?.type, 'plant');
    assert.equal(inputs[7], 1.0); // bias
    assert.ok(inputs[8] > 0); // pheromone scent
  });

  it('burns energy, takes hazard damage, and dies when energy reaches zero', () => {
    const org = new Organism(100, 100, new DNA({ size: 10 }), 1, null, 20);
    const hazard = new Hazard(100, 100, 50, 100); // 100 dps

    org.update(0.25, 2400, 1800, [], [], [hazard], { width: 2400, height: 1800 });
    assert.equal(org.isDead, true);
    assert.ok(org.energy <= 0);
  });

  it('feeds on plants and limits predation by biteCooldown', () => {
    const omnivore = new Organism(100, 100, new DNA({ diet: 0.0, size: 12 }), 1, null, 80);
    const plant = new Food(102, 100, 'plant', 25);
    let eaten = 0;

    omnivore.performFeeding([plant], [], {
      width: 2400,
      height: 1800,
      onEat: () => { eaten++; }
    });

    assert.equal(plant.energy, 0);
    assert.equal(omnivore.plantsEaten, 1);
    assert.equal(eaten, 1);
    assert.ok(omnivore.energy > 80);

    // Predation test
    const predator = new Organism(200, 200, new DNA({ diet: 0.9, size: 15 }), 1, null, 80);
    const prey = new Organism(205, 200, new DNA({ diet: -0.9, size: 10 }), 1, null, 100);
    predator.performFeeding([], [prey], { width: 2400, height: 1800 });
    assert.ok(prey.energy < 100);
    assert.ok(predator.biteCooldown > 0);

    // Immediate second bite is blocked by biteCooldown
    const energyAfterFirstBite = prey.energy;
    predator.performFeeding([], [prey], { width: 2400, height: 1800 });
    assert.equal(prey.energy, energyAfterFirstBite);
  });

  it('reproduces asexually and sexually with energy transfer and generation increment', () => {
    const parent = new Organism(500, 500, new DNA({ reproduceThreshold: 140, gestationShare: 0.45 }), 2, null, 160);
    const child = parent.reproduce({ width: 2400, height: 1800 });

    assert.equal(child.generation, 3);
    assert.equal(child.parentId, parent.id);
    assert.equal(parent.childrenCount, 1);
    assert.ok(parent.reproduceCooldown >= 8);
    assert.ok(parent.energy <= parent.dna.reproduceThreshold * 0.7);
    assert.ok(child.energy > 0);

    const mateA = new Organism(600, 600, new DNA({ reproduceThreshold: 140 }), 4, null, 150);
    const mateB = new Organism(610, 600, new DNA({ reproduceThreshold: 140 }), 3, null, 150);
    const sexualChild = mateA.mateWith(mateB, { width: 2400, height: 1800 });

    assert.equal(sexualChild.generation, 5);
    assert.equal(mateA.childrenCount, 1);
    assert.equal(mateB.childrenCount, 1);
    assert.ok(mateA.reproduceCooldown >= 9);
    assert.ok(mateB.reproduceCooldown >= 9);
  });
});
