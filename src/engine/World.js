/**
 * Biosphera - Ecosystem World Simulation
 */

import { Organism } from '../entities/Organism.js';
import { Food } from '../entities/Food.js';
import { Hazard } from '../entities/Hazard.js';
import { SpatialHash } from './SpatialHash.js';
import { DNA } from '../genetics/DNA.js';
import { FlowField } from './FlowField.js';
import { PheromoneField } from './PheromoneField.js';

export class World {
  constructor(width = 2400, height = 1800) {
    this.width = width;
    this.height = height;

    this.organisms = [];
    this.foods = [];
    this.hazards = [];
    this.particles = []; // Visual particle bursts (mitosis, eating, deaths)

    this.spatialOrganisms = new SpatialHash(90);
    this.spatialFoods = new SpatialHash(70);

    this.foodSpawnRate = 16;
    this.maxFoodCap = 300;
    this.maxPopulationCap = 160; // Optimal carrying capacity for 60 FPS
    this.timeScale = 1;
    this.isPaused = false;
    this.currentPreset = 'sanctuary';

    this.iceAgeTimer = 0;
    this.radiationTimer = 0;

    // Environment systems
    this.flow = new FlowField(width, height);
    this.pheromones = new PheromoneField(width, height);
    this.currentStrength = 0.35;   // water current push strength (0 disables)
    this.sexualReproduction = false;
    this.foodRateMultiplier = 1;   // set by the season cycle
    this.metabolismMultiplier = 1; // set by the season cycle

    this.totalBorn = 0;
    this.totalDeaths = 0;
    this.maxGeneration = 1;
    this.deadLifespans = [];

    // Per-step environment shared with every organism update
    this._env = {
      sexual: false,
      metabolismMult: 1,
      population: 0,
      pheromones: this.pheromones,
      onEat: (org, type) => this._handleEat(org, type)
    };

    // Audio callback
    this.onEvent = null;

    this.loadPreset('sanctuary');
  }

  _handleEat(org, type) {
    if (type === 'bite') {
      this.pheromones.deposit(org.x, org.y, 'danger', 0.4);
      this.onEvent?.('attack');
    } else {
      this.pheromones.deposit(org.x, org.y, 'food', 0.5);
      this.onEvent?.('eat');
    }
  }

  loadPreset(presetName) {
    this.currentPreset = presetName;
    this.organisms = [];
    this.foods = [];
    this.hazards = [];
    this.particles = [];
    this.deadLifespans = [];
    this.maxGeneration = 1;
    this.radiationTimer = 0;
    this.iceAgeTimer = 0;
    this.pheromones = new PheromoneField(this.width, this.height);
    this._env.pheromones = this.pheromones;

    switch (presetName) {
      case 'wasteland':
        // Predator Wasteland: Scarce food, carnivores dominate
        this.foodSpawnRate = 6;
        this.maxFoodCap = 180;
        for (let i = 0; i < 80; i++) {
          this.foods.push(new Food(Math.random() * this.width, Math.random() * this.height, 'plant'));
        }
        for (let i = 0; i < 40; i++) {
          const dna = new DNA({ diet: 0.7 + Math.random() * 0.3, speed: 3.5 });
          this.spawnOrganismAt(Math.random() * this.width, Math.random() * this.height, dna);
        }
        break;

      case 'radiation':
        // Radiation Trench: Multiple toxic vents, hyper mutations
        this.foodSpawnRate = 18;
        this.maxFoodCap = 280;
        for (let i = 0; i < 5; i++) {
          this.hazards.push(new Hazard(Math.random() * this.width, Math.random() * this.height, 70, 50));
        }
        for (let i = 0; i < 150; i++) {
          this.foods.push(new Food(Math.random() * this.width, Math.random() * this.height, 'plant'));
        }
        this.spawnRandomPopulation(35);
        break;

      case 'glacial':
        // Glacial Tundra: Low vegetation, high energy requirements
        this.foodSpawnRate = 8;
        this.maxFoodCap = 180;
        this.iceAgeTimer = 99999; // Permanent chill
        for (let i = 0; i < 100; i++) {
          this.foods.push(new Food(Math.random() * this.width, Math.random() * this.height, 'plant'));
        }
        this.spawnRandomPopulation(25);
        break;

      case 'sanctuary':
      default:
        // Balanced Primordial Reef
        this.foodSpawnRate = 16;
        this.maxFoodCap = 260;
        this.iceAgeTimer = 0;
        for (let i = 0; i < 160; i++) {
          this.foods.push(new Food(Math.random() * this.width, Math.random() * this.height, 'plant'));
        }
        this.hazards.push(new Hazard(this.width * 0.25, this.height * 0.35, 60, 45));
        this.hazards.push(new Hazard(this.width * 0.75, this.height * 0.65, 75, 45));
        this.spawnRandomPopulation(35);
        break;
    }
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

  addParticleBurst(x, y, color = '#38bdf8', count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 1.5 + Math.random() * 2.5,
        alpha: 1.0,
        decay: 1.5 + Math.random() * 2
      });
    }
  }

  update(rawDt) {
    if (this.isPaused) return;

    // Fixed-step integration: scaled time is split into <=1/30s substeps so speed
    // multipliers advance the whole simulation (movement included) without letting
    // fast-forward steps tunnel through food or prey.
    let remaining = Math.min(0.2, rawDt * this.timeScale);
    while (remaining > 1e-6) {
      const step = Math.min(1 / 30, remaining);
      this.stepOnce(step);
      remaining -= step;
    }
  }

  stepOnce(dt) {
    if (this.currentPreset !== 'glacial' && this.iceAgeTimer > 0) this.iceAgeTimer -= dt;
    if (this.radiationTimer > 0) this.radiationTimer -= dt;

    this.flow.update(dt);
    this.pheromones.update(dt);

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

    // 3. SPAWN VEGETATION (rate scaled by the season cycle)
    if ((this.currentPreset === 'glacial' || this.iceAgeTimer <= 0) && this.foods.length < this.maxFoodCap) {
      const effectiveRate = this.foodSpawnRate * this.foodRateMultiplier;
      const toSpawn = Math.floor(effectiveRate * dt + (Math.random() < (effectiveRate * dt % 1) ? 1 : 0));
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
    this._env.sexual = this.sexualReproduction;
    this._env.metabolismMult = this.metabolismMultiplier;
    this._env.population = this.organisms.length;

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
        this.hazards,
        this._env
      );

      if (offspring && (this.organisms.length + newborns.length) < this.maxPopulationCap) {
        newborns.push(offspring);
        this.totalBorn++;
        this.addParticleBurst(org.x, org.y, `hsl(${org.dna.colorHue}, 80%, 65%)`, 10);
        this.onEvent?.('birth');
        this.pheromones.deposit(org.x, org.y, 'food', 0.25);
        if (offspring.generation > this.maxGeneration) {
          this.maxGeneration = offspring.generation;
        }
      }

      if (org.isDead) {
        this.totalDeaths++;
        this.deadLifespans.push(org.age);
        if (this.deadLifespans.length > 100) this.deadLifespans.shift();

        this.addParticleBurst(org.x, org.y, '#f43f5e', 8);
        this.pheromones.deposit(org.x, org.y, 'danger', 1.0);

        // Controlled meat drop: prevent food explosions
        if (this.foods.length < this.maxFoodCap) {
          const meatCount = org.radius > 16 ? 2 : 1;
          for (let m = 0; m < meatCount; m++) {
            const dropX = (org.x + (Math.random() - 0.5) * 15 + this.width) % this.width;
            const dropY = (org.y + (Math.random() - 0.5) * 15 + this.height) % this.height;
            this.foods.push(new Food(dropX, dropY, 'meat', 35));
            this.pheromones.deposit(dropX, dropY, 'food', 0.6);
          }
        }

        this.organisms.splice(i, 1);
      }
    }

    for (let i = 0; i < newborns.length; i++) {
      this.organisms.push(newborns[i]);
    }

    // Auto rescue from extinction
    if (this.organisms.length === 0) {
      this.spawnRandomPopulation(15);
    }

    // 5.5 WATER CURRENTS — push organisms & drift food along the flow field
    if (this.currentStrength > 0) {
      for (const org of this.organisms) {
        const f = this.flow.sample(org.x, org.y);
        org.x = (org.x + f.vx * this.currentStrength * dt + this.width) % this.width;
        org.y = (org.y + f.vy * this.currentStrength * dt + this.height) % this.height;
      }
      for (const food of this.foods) {
        const f = this.flow.sample(food.x, food.y);
        food.x = (food.x + f.vx * this.currentStrength * 0.4 * dt + this.width) % this.width;
        food.y = (food.y + f.vy * this.currentStrength * 0.4 * dt + this.height) % this.height;
      }
    }

    // 6. UPDATE VISUAL PARTICLES
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  triggerIceAge() {
    this.iceAgeTimer = 18;
    this.onEvent?.('disaster');
  }

  triggerFoodSurge() {
    const toAdd = Math.min(60, Math.max(15, this.maxFoodCap - this.foods.length));
    for (let i = 0; i < toAdd; i++) {
      this.foods.push(new Food(Math.random() * this.width, Math.random() * this.height, 'plant'));
    }
    this.onEvent?.('eat');
    return toAdd;
  }

  triggerRadiationFlare() {
    this.radiationTimer = 15;
    for (const org of this.organisms) {
      org.dna = org.dna.mutate(0.4, 0.6);
    }
    this.onEvent?.('disaster');
  }

  triggerToxicBloom() {
    const rx = Math.random() * this.width;
    const ry = Math.random() * this.height;
    this.hazards.push(new Hazard(rx, ry, 70 + Math.random() * 40, 50));
    if (this.hazards.length > 6) {
      this.hazards.shift();
    }
    this.onEvent?.('disaster');
  }

  clearAll() {
    // Full reset: re-seed the current scenario from scratch (organisms, food, hazards, timers)
    this.loadPreset(this.currentPreset);
  }

  serializeState() {
    return {
      version: 1,
      preset: this.currentPreset,
      width: this.width,
      height: this.height,
      foodSpawnRate: this.foodSpawnRate,
      maxFoodCap: this.maxFoodCap,
      maxPopulationCap: this.maxPopulationCap,
      iceAgeTimer: this.iceAgeTimer,
      radiationTimer: this.radiationTimer,
      totalBorn: this.totalBorn,
      totalDeaths: this.totalDeaths,
      maxGeneration: this.maxGeneration,
      currentStrength: this.currentStrength,
      sexualReproduction: this.sexualReproduction,
      organisms: this.organisms.map((o) => ({
        x: +o.x.toFixed(1),
        y: +o.y.toFixed(1),
        gen: o.generation,
        parent: o.parentId,
        id: o.id,
        dna: o.dna.serialize(),
        energy: +o.energy.toFixed(1),
        age: +o.age.toFixed(1),
        pe: o.plantsEaten,
        me: o.meatEaten,
        k: o.kills,
        cc: o.childrenCount,
        cd: +o.reproduceCooldown.toFixed(1)
      })),
      foods: this.foods.map((f) => [
        +f.x.toFixed(1), +f.y.toFixed(1),
        f.type === 'meat' ? 1 : 0,
        +f.energy.toFixed(1), +f.age.toFixed(1)
      ]),
      hazards: this.hazards.map((h) => [+h.x.toFixed(1), +h.y.toFixed(1), h.radius, h.dps])
    };
  }

  loadState(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.organisms)) return false;

    this.currentPreset = data.preset || 'sanctuary';
    this.width = data.width;
    this.height = data.height;
    this.flow.width = this.width;
    this.flow.height = this.height;
    this.pheromones = new PheromoneField(this.width, this.height);
    this._env.pheromones = this.pheromones;

    this.foodSpawnRate = data.foodSpawnRate;
    this.maxFoodCap = data.maxFoodCap;
    this.maxPopulationCap = data.maxPopulationCap;
    this.iceAgeTimer = data.iceAgeTimer;
    this.radiationTimer = data.radiationTimer;
    this.totalBorn = data.totalBorn;
    this.totalDeaths = data.totalDeaths;
    this.maxGeneration = data.maxGeneration;
    this.currentStrength = data.currentStrength ?? this.currentStrength;
    this.sexualReproduction = !!data.sexualReproduction;

    this.organisms = [];
    for (const s of data.organisms) {
      const dna = DNA.deserialize(s.dna);
      if (!dna) continue;
      const org = new Organism(s.x, s.y, dna, s.gen || 1, s.parent || null, s.energy);
      if (s.id) org.id = s.id;
      org.age = s.age || 0;
      org.plantsEaten = s.pe || 0;
      org.meatEaten = s.me || 0;
      org.kills = s.k || 0;
      org.childrenCount = s.cc || 0;
      org.reproduceCooldown = s.cd || 0;
      this.organisms.push(org);
    }

    this.foods = (data.foods || []).map(([x, y, isMeat, energy, age]) => {
      const f = new Food(x, y, isMeat ? 'meat' : 'plant', energy);
      f.age = age;
      return f;
    });

    this.hazards = (data.hazards || []).map(([x, y, radius, dps]) => new Hazard(x, y, radius, dps));
    this.particles = [];
    return true;
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
