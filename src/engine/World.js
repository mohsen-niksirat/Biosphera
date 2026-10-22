/**
 * Biosphera - Ecosystem World Simulation
 */

import { Organism } from '../entities/Organism.js';
import { Food } from '../entities/Food.js';
import { Hazard } from '../entities/Hazard.js';
import { SpatialHash } from './SpatialHash.js';
import { DNA } from '../genetics/DNA.js';

export class World {
  constructor(width = 2400, height = 1800) {
    this.width = width;
    this.height = height;

    this.organisms = [];
    this.foods = [];
    this.hazards = [];

    this.spatialOrganisms = new SpatialHash(90);
    this.spatialFoods = new SpatialHash(70);

    this.foodSpawnRate = 18;
    this.maxFoodCap = 450;
    this.timeScale = 1;
    this.isPaused = false;

    this.iceAgeTimer = 0;
    this.radiationTimer = 0;

    this.totalBorn = 0;
    this.totalDeaths = 0;
    this.maxGeneration = 1;
    this.deadLifespans = [];

    this.initDefaultWorld();
  }

  initDefaultWorld() {
    for (let i = 0; i < 220; i++) {
      this.foods.push(new Food(Math.random() * this.width, Math.random() * this.height, 'plant'));
    }

    this.hazards.push(new Hazard(this.width * 0.25, this.height * 0.35, 60, 45));
    this.hazards.push(new Hazard(this.width * 0.75, this.height * 0.65, 75, 45));

    this.spawnRandomPopulation(35);
  }

  spawnRandomPopulation(count) {
    for (let i = 0; i < count; i++) {
      const org = new Organism(
        Math.random() * this.width,
        Math.random() * this.height,
        new DNA(),
        1
      );
      this.organisms.push(org);
      this.totalBorn++;
    }
  }

  spawnOrganismAt(x, y, customDNA) {
    const org = new Organism(x, y, customDNA || new DNA(), 1);
    this.organisms.push(org);
    this.totalBorn++;
    return org;
  }

  update(rawDt) {
    if (this.isPaused) return;

    const dt = Math.min(0.1, rawDt * this.timeScale);

    if (this.iceAgeTimer > 0) this.iceAgeTimer -= dt;
    if (this.radiationTimer > 0) this.radiationTimer -= dt;

    // 1. REFRESH SPATIAL HASHES
    this.spatialOrganisms.clear();
    for (let i = 0; i < this.organisms.length; i++) {
      this.spatialOrganisms.insert(this.organisms[i]);
    }

    this.spatialFoods.clear();
    for (let i = 0; i < this.foods.length; i++) {
      this.spatialFoods.insert(this.foods[i]);
    }

    // 2. UPDATE HAZARDS
    for (let i = 0; i < this.hazards.length; i++) {
      this.hazards[i].update(dt);
    }

    // 3. SPAWN NATURAL VEGETATION
    if (this.iceAgeTimer <= 0 && this.foods.length < this.maxFoodCap) {
      const toSpawn = Math.floor(this.foodSpawnRate * dt + (Math.random() < (this.foodSpawnRate * dt % 1) ? 1 : 0));
      for (let i = 0; i < toSpawn; i++) {
        const cluster = Math.random() < 0.6 && this.foods.length > 0;
        let fx = Math.random() * this.width;
        let fy = Math.random() * this.height;

        if (cluster) {
          const pivot = this.foods[Math.floor(Math.random() * this.foods.length)];
          const angle = Math.random() * Math.PI * 2;
          const dist = 10 + Math.random() * 80;
          fx = (pivot.x + Math.cos(angle) * dist + this.width) % this.width;
          fy = (pivot.y + Math.sin(angle) * dist + this.height) % this.height;
        }

        this.foods.push(new Food(fx, fy, 'plant'));
      }
    }

    // 4. UPDATE EXISTING FOOD
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const food = this.foods[i];
      if (food.energy <= 0 || !food.update(dt)) {
        this.foods.splice(i, 1);
      }
    }

    // 5. UPDATE ORGANISMS
    const newborns = [];

    for (let i = this.organisms.length - 1; i >= 0; i--) {
      const org = this.organisms[i];
      const nearbyFoods = this.spatialFoods.query(org.x, org.y, org.dna.sensorRange);
      const nearbyOrganisms = this.spatialOrganisms.query(org.x, org.y, org.dna.sensorRange);

      const offspring = org.update(
        dt,
        this.width,
        this.height,
        nearbyFoods,
        nearbyOrganisms,
        this.hazards
      );

      if (offspring) {
        newborns.push(offspring);
        this.totalBorn++;
        if (offspring.generation > this.maxGeneration) {
          this.maxGeneration = offspring.generation;
        }
      }

      if (org.isDead) {
        this.totalDeaths++;
        this.deadLifespans.push(org.age);
        if (this.deadLifespans.length > 100) this.deadLifespans.shift();

        const meatCount = Math.max(1, Math.floor(org.radius / 5));
        for (let m = 0; m < meatCount; m++) {
          const dropX = (org.x + (Math.random() - 0.5) * 15 + this.width) % this.width;
          const dropY = (org.y + (Math.random() - 0.5) * 15 + this.height) % this.height;
          this.foods.push(new Food(dropX, dropY, 'meat', 35));
        }

        this.organisms.splice(i, 1);
      }
    }

    for (let i = 0; i < newborns.length; i++) {
      this.organisms.push(newborns[i]);
    }

    if (this.organisms.length === 0) {
      this.spawnRandomPopulation(15);
    }
  }

  triggerIceAge() {
    this.iceAgeTimer = 18;
  }

  triggerFoodSurge() {
    for (let i = 0; i < 150; i++) {
      this.foods.push(new Food(Math.random() * this.width, Math.random() * this.height, 'plant'));
    }
  }

  triggerRadiationFlare() {
    this.radiationTimer = 15;
    for (const org of this.organisms) {
      org.dna = org.dna.mutate(0.4, 0.6);
    }
  }

  triggerToxicBloom() {
    const rx = Math.random() * this.width;
    const ry = Math.random() * this.height;
    this.hazards.push(new Hazard(rx, ry, 70 + Math.random() * 40, 50));
    if (this.hazards.length > 6) {
      this.hazards.shift();
    }
  }

  clearAll() {
    this.organisms = [];
    this.foods = [];
    this.spawnRandomPopulation(20);
  }

  getStats(fps) {
    let herbivores = 0;
    let carnivores = 0;
    let omnivores = 0;

    for (const o of this.organisms) {
      if (o.dna.diet < -0.2) herbivores++;
      else if (o.dna.diet > 0.2) carnivores++;
      else omnivores++;
    }

    const avgLifespan = this.deadLifespans.length > 0
      ? this.deadLifespans.reduce((a, b) => a + b, 0) / this.deadLifespans.length
      : 0;

    return {
      population: this.organisms.length,
      maxGeneration: this.maxGeneration,
      herbivores,
      carnivores,
      omnivores,
      avgLifespan: Math.round(avgLifespan),
      foodCount: this.foods.length,
      totalBorn: this.totalBorn,
      totalDeaths: this.totalDeaths,
      fps: Math.round(fps)
    };
  }
}
