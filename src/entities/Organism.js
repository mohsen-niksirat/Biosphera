/**
 * Biosphera - Organism (Living Agent)
 */

import { DNA } from '../genetics/DNA.js';
import { wrapDelta, wrapCoord } from '../engine/wrapDelta.js';

export class Organism {
  constructor(x, y, dna, generation = 1, parentId = null, initialEnergy = 90) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.parentId = parentId;
    this.dna = dna || new DNA();
    this.generation = generation;

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = Math.random() * Math.PI * 2;
    this.radius = this.dna.size;

    this.energy = initialEnergy;
    this.maxEnergy = this.dna.reproduceThreshold * (1.25 + (this.dna.fatReserve ?? 0.2) * 0.5);
    this.health = 100;
    this.age = 0;
    this.isDead = false;

    this.plantsEaten = 0;
    this.meatEaten = 0;
    this.kills = 0;
    this.childrenCount = 0;
    this.reproduceCooldown = 6.0; // Must mature before reproducing
    this.biteCooldown = 0; // Predation is rate-limited so prey can escape
    this.infectedTimer = 0;

    this.latestInputs = new Float32Array(14);
    this.latestOutputs = new Float32Array(4);
    this.memoryState = new Float32Array(2);
    this.nearestTarget = null;
    this.tailPhase = Math.random() * Math.PI * 2;
  }

  update(dt, worldWidth, worldHeight, nearbyFoods, nearbyOrganisms, nearbyHazards, env = {}) {
    if (this.isDead) return null;

    this.age += dt;
    if (this.reproduceCooldown > 0) {
      this.reproduceCooldown -= dt;
    }
    if (this.biteCooldown > 0) {
      this.biteCooldown -= dt;
    }
    this.tailPhase += dt * (2 + Math.hypot(this.vx, this.vy) * (2.5 / 60));

    // 1. SENSE
    const inputs = this.sense(nearbyFoods, nearbyOrganisms, nearbyHazards, env);
    this.latestInputs.set(inputs);

    // 2. THINK
    const outputs = this.dna.brain.feedForward(inputs);
    this.latestOutputs.set(outputs);
    const hiddenLayer = this.dna.brain.layerActivations[1];
    if (hiddenLayer && hiddenLayer.length >= 2) {
      this.memoryState[0] = hiddenLayer[0];
      this.memoryState[1] = hiddenLayer[1];
    }

    const steer = outputs[0];
    const thrust = (outputs[1] + 1) * 0.5;
    const biteAction = outputs[2];
    const splitIntent = outputs[3];

    // 3. ACT & MOVE
    const finCount = this.dna.finCount ?? 2;
    const armor = this.dna.armor ?? 0.15;
    const jawPower = this.dna.jawPower ?? 1.0;
    const fatReserve = this.dna.fatReserve ?? 0.2;

    const maxTurnRate = Math.PI * (1.8 + finCount * 0.15);
    this.heading += steer * maxTurnRate * dt;
    this.heading = (this.heading + Math.PI * 3) % (Math.PI * 2) - Math.PI;

    // All kinematics in px/second (frame-rate independent; tuned for a 60 FPS baseline)
    const speedMult = (1 - armor * 0.25) * (1 - fatReserve * 0.12);
    const accel = thrust * this.dna.speed * speedMult * (1 + finCount * 0.05) * 45 * 60;
    this.vx += Math.cos(this.heading) * accel * dt;
    this.vy += Math.sin(this.heading) * accel * dt;

    const drag = 0.92;
    this.vx *= Math.pow(drag, dt * 60);
    this.vy *= Math.pow(drag, dt * 60);

    const currentSpeed = Math.hypot(this.vx, this.vy);
    const maxSpeed = this.dna.speed * speedMult * 1.5 * 60;
    if (currentSpeed > maxSpeed) {
      this.vx = (this.vx / currentSpeed) * maxSpeed;
      this.vy = (this.vy / currentSpeed) * maxSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Toroidal world wrapping
    this.x = wrapCoord(this.x, worldWidth);
    this.y = wrapCoord(this.y, worldHeight);

    // 4. METABOLISM & ENERGY BURN (speed normalized back to 60fps-frame units so burn rates stay calibrated)
    const immunity = this.dna.immunity ?? 0.25;
    const basalCost = 0.35 + (this.dna.size / 15) * 0.25 + armor * 0.25 + (jawPower - 0.5) * 0.12 + finCount * 0.03 + immunity * 0.12;
    const frameSpeed = currentSpeed / 60;
    const kineticCost = (frameSpeed * frameSpeed * 0.04) * (this.dna.size / 10) * (1 + fatReserve * 0.2);
    const sensorCost = (this.dna.sensorRange / 200) * 0.15;
    const totalBurn = (basalCost + kineticCost + sensorCost) * dt * (env.metabolismMult ?? 1);

    this.energy -= totalBurn;

    // Pathogen contagion: gentle energy drain + proximity transmission scaled by (1 - immunity)
    if (this.infectedTimer > 0) {
      this.infectedTimer = Math.max(0, this.infectedTimer - dt);
      this.energy -= 1.8 * (1 - immunity * 0.5) * dt;
      for (let i = 0; i < nearbyOrganisms.length; i++) {
        const other = nearbyOrganisms[i];
        if (other.id === this.id || other.isDead || (other.infectedTimer ?? 0) > 0) continue;
        const dx = wrapDelta(other.x - this.x, env.width);
        const dy = wrapDelta(other.y - this.y, env.height);
        if (Math.hypot(dx, dy) <= this.radius + other.radius + 18) {
          const spreadChance = Math.min(1, 0.8 * dt * (1 - (other.dna.immunity ?? 0.25)));
          if (Math.random() < spreadChance) {
            other.infectedTimer = 8.0 + Math.random() * 4.0;
          }
        }
      }
    }

    // Hazards
    for (const hazard of nearbyHazards) {
      const dx = wrapDelta(hazard.x - this.x, env.width);
      const dy = wrapDelta(hazard.y - this.y, env.height);
      if (Math.hypot(dx, dy) < hazard.radius + this.radius) {
        this.energy -= hazard.dps * (1 - armor * 0.3) * dt;
      }
    }

    // 5. INTERACT
    if (biteAction > 0) {
      this.performFeeding(nearbyFoods, nearbyOrganisms, env);
    }

    // 6. AGEING
    const naturalLifespan = 180 + (this.dna.size * 5);
    if (this.age > naturalLifespan) {
      const senescence = ((this.age - naturalLifespan) / 30) * 12 * dt;
      this.energy -= senescence;
    }

    if (this.energy <= 0) {
      this.isDead = true;
      return null;
    }

    // 7. REPRODUCTION (Restricted by maturity age, cooldown & local crowd density)
    if (
      env.allowBirth !== false &&
      splitIntent > 0.35 &&
      this.energy >= this.dna.reproduceThreshold &&
      this.age >= 6.0 &&
      this.reproduceCooldown <= 0
    ) {
      let localCrowding = 0;
      const crowdCheckRadius = this.radius * 4;
      for (let i = 0; i < nearbyOrganisms.length; i++) {
        const o = nearbyOrganisms[i];
        if (o.id !== this.id && !o.isDead) {
          const dx = wrapDelta(o.x - this.x, env.width);
          const dy = wrapDelta(o.y - this.y, env.height);
          if (Math.hypot(dx, dy) < crowdCheckRadius) {
            localCrowding++;
          }
        }
      }

      if (localCrowding < 6) {
        // Sexual mode: seek a willing nearby mate; parthenogenesis only as a
        // low-population fallback so the biome never dies out by chance.
        if (env.sexual) {
          const partner = this.findMate(nearbyOrganisms, env);
          if (partner) {
            return this.mateWith(partner, env);
          }
          if ((env.population ?? Infinity) >= 12) {
            return null;
          }
        }
        return this.reproduce(env);
      }
    }

    return null;
  }

  findMate(nearbyOrganisms, env = {}) {
    let best = null;
    let bestDist = Infinity;
    for (const other of nearbyOrganisms) {
      if (other.id === this.id || other.isDead) continue;
      if (other.age < 6.0 || other.reproduceCooldown > 0) continue;
      if (other.energy < other.dna.reproduceThreshold * 0.55) continue;
      const dx = wrapDelta(other.x - this.x, env.width);
      const dy = wrapDelta(other.y - this.y, env.height);
      const d = Math.hypot(dx, dy);
      if (d < this.radius + other.radius + 30 && d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return best;
  }

  mateWith(partner, env = {}) {
    const cooldown = 9.0 + Math.random() * 4.0;
    this.reproduceCooldown = cooldown;
    partner.reproduceCooldown = cooldown;

    const contribution = 0.3;
    const childEnergy = (this.energy + partner.energy) * contribution * 0.9;
    this.energy *= 1 - contribution;
    partner.energy *= 1 - contribution;
    this.childrenCount++;
    partner.childrenCount++;

    const childDNA = DNA.crossover(this.dna, partner.dna).mutate(
      Math.min(1, 0.08 * (env.mutationScale ?? 1)),
      Math.min(1, 0.25 * (env.mutationScale ?? 1))
    );
    const spawnDist = this.radius + childDNA.size + 4;
    const angle = Math.random() * Math.PI * 2;
    const childX = wrapCoord(this.x + Math.cos(angle) * spawnDist, env.width);
    const childY = wrapCoord(this.y + Math.sin(angle) * spawnDist, env.height);

    return new Organism(
      childX,
      childY,
      childDNA,
      Math.max(this.generation, partner.generation) + 1,
      this.id,
      childEnergy
    );
  }

  kinSimilarity(other) {
    let dh = Math.abs(this.dna.colorHue - other.dna.colorHue) % 360;
    if (dh > 180) dh = 360 - dh;
    const dHue = dh / 180;
    const dDiet = Math.abs(this.dna.diet - other.dna.diet) / 2;
    const dist = 0.65 * dHue + 0.35 * dDiet;
    return 1 - 2 * dist;
  }

  sense(foods, organisms, hazards, env = {}) {
    const inputs = [0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0];
    this.nearestTarget = null;

    let closestFoodDist = Infinity;
    let closestFoodAngle = 0;
    let closestFoodType = 'plant';

    // Sense Food
    for (const f of foods) {
      if (f.energy <= 0) continue; // consumed or expired: not real food anymore
      if (this.dna.diet < -0.2 && f.type === 'meat') continue;
      if (this.dna.diet > 0.2 && f.type === 'plant') continue;

      const dx = wrapDelta(f.x - this.x, env.width);
      const dy = wrapDelta(f.y - this.y, env.height);
      const dist = Math.hypot(dx, dy);

      if (dist <= this.dna.sensorRange && dist < closestFoodDist) {
        const targetAngle = Math.atan2(dy, dx);
        let relAngle = targetAngle - this.heading;
        relAngle = (relAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI;

        if (Math.abs(relAngle) <= this.dna.sensorFov * 0.5) {
          closestFoodDist = dist;
          closestFoodAngle = relAngle;
          closestFoodType = f.type;
        }
      }
    }

    if (closestFoodDist < Infinity) {
      inputs[0] = 1 - (closestFoodDist / this.dna.sensorRange);
      inputs[1] = closestFoodAngle / Math.PI;
      // Relative wrapped vector to the target — correct across the world seam
      this.nearestTarget = {
        dx: Math.cos(this.heading + closestFoodAngle) * closestFoodDist,
        dy: Math.sin(this.heading + closestFoodAngle) * closestFoodDist,
        type: closestFoodType
      };
    }

    // Sense Organisms
    let closestOrgDist = Infinity;
    let closestOrgAngle = 0;
    let perceivedRole = 0;
    let closestOrg = null;

    for (const other of organisms) {
      if (other.id === this.id || other.isDead) continue;

      const dx = wrapDelta(other.x - this.x, env.width);
      const dy = wrapDelta(other.y - this.y, env.height);
      const dist = Math.hypot(dx, dy);

      if (dist <= this.dna.sensorRange && dist < closestOrgDist) {
        const targetAngle = Math.atan2(dy, dx);
        let relAngle = targetAngle - this.heading;
        relAngle = (relAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI;

        if (Math.abs(relAngle) <= this.dna.sensorFov * 0.5) {
          closestOrgDist = dist;
          closestOrgAngle = relAngle;
          closestOrg = other;

          if (this.dna.diet > 0.1 && other.dna.size < this.dna.size * 1.15) {
            perceivedRole = 1.0;
          } else if (other.dna.diet > 0.1 && other.dna.size > this.dna.size * 0.9) {
            perceivedRole = -1.0;
          } else {
            perceivedRole = 0.1;
          }
        }
      }
    }

    if (closestOrgDist < Infinity) {
      inputs[2] = 1 - (closestOrgDist / this.dna.sensorRange);
      inputs[3] = closestOrgAngle / Math.PI;
      inputs[4] = perceivedRole;
      inputs[13] = this.kinSimilarity(closestOrg);
    }

    // Sense hazard
    let closestHazardDist = Infinity;
    for (const h of hazards) {
      const dx = wrapDelta(h.x - this.x, env.width);
      const dy = wrapDelta(h.y - this.y, env.height);
      const dist = Math.hypot(dx, dy);
      if (dist < closestHazardDist) {
        closestHazardDist = dist;
      }
    }
    inputs[5] = closestHazardDist < 120 ? (1 - closestHazardDist / 120) : 0;
    inputs[6] = Math.min(1.0, this.energy / this.dna.reproduceThreshold);
    inputs[7] = 1.0;
    // Pheromone scent (food attracts, death repels) — 9th neural input
    inputs[8] = env.pheromones ? env.pheromones.sample(this.x, this.y) : 0;
    // Internal state inputs: age/senescence ratio & reproduction readiness
    const naturalLifespan = 180 + (this.dna.size * 5);
    inputs[9] = Math.min(1.0, this.age / naturalLifespan);
    inputs[10] = (this.age >= 6.0 && this.reproduceCooldown <= 0 && this.energy >= this.dna.reproduceThreshold)
      ? 1.0
      : Math.min(0.95, Math.max(0, this.energy / this.dna.reproduceThreshold) * (this.reproduceCooldown <= 0 ? 0.8 : 0.2));
    // Recurrent memory from previous hidden state
    inputs[11] = this.memoryState[0];
    inputs[12] = this.memoryState[1];

    return inputs;
  }

  performFeeding(nearbyFoods, nearbyOrganisms, env = {}) {
    const mouthReach = this.radius + 6;

    for (let i = 0; i < nearbyFoods.length; i++) {
      const food = nearbyFoods[i];
      if (food.energy <= 0) continue; // already consumed this substep
      // Same dietary filter as sense(): a strict carnivore never targets plants
      // and a strict herbivore never targets meat, so neither should eat them
      // merely by drifting over them (it would pollute plantsEaten/meatEaten).
      if (this.dna.diet < -0.2 && food.type === 'meat') continue;
      if (this.dna.diet > 0.2 && food.type === 'plant') continue;
      const dx = wrapDelta(food.x - this.x, env.width);
      const dy = wrapDelta(food.y - this.y, env.height);
      const dist = Math.hypot(dx, dy);

      if (dist <= mouthReach + food.radius) {
        let efficiency = 1.0;
        if (food.type === 'plant') {
          efficiency = Math.max(0.1, 1 - Math.max(0, this.dna.diet));
        } else {
          efficiency = Math.max(0.1, 1 + Math.min(0, this.dna.diet));
        }

        const gained = food.energy * efficiency;
        this.energy = Math.min(this.maxEnergy, this.energy + gained);
        if (food.type === 'plant') this.plantsEaten++;
        else this.meatEaten++;
        food.energy = 0;
        env.onEat?.(this, food.type);
        break;
      }
    }

    // Predation. Rate-limited by biteCooldown: without it a predator in
    // contact bites every substep (~30x/s), killing prey instantly and
    // crashing the ecosystem into cyclic herbivore extinction.
    if (this.dna.diet > -0.2 && this.biteCooldown <= 0) {
      const starving = this.energy < this.dna.reproduceThreshold * 0.25;
      for (const other of nearbyOrganisms) {
        if (other.id === this.id || other.isDead) continue;
        // Conspecific bite-inhibition: avoid friendly-fire predation on close kin unless critically starving
        if (!starving && this.kinSimilarity(other) > 0.65) continue;
        const dx = wrapDelta(other.x - this.x, env.width);
        const dy = wrapDelta(other.y - this.y, env.height);
        const dist = Math.hypot(dx, dy);

        if (dist <= mouthReach + other.radius && other.dna.size <= this.dna.size * 1.3) {
          const biteDmg = (this.dna.size * 2.5) * (1 + this.dna.diet) * (this.dna.jawPower ?? 1.0) * (1 - (other.dna.armor ?? 0) * 0.65);
          other.energy -= biteDmg;

          // Attacking costs energy (pursuit/handling). Without a cost, omnivores
          // bite for free and outcompete pure herbivores, who cannot bite back.
          const absorbed = biteDmg * 0.7 * Math.max(0.3, this.dna.diet + 0.5);
          this.energy = Math.min(this.maxEnergy, this.energy + absorbed - biteDmg * 0.12);
          this.biteCooldown = 0.5 + Math.random() * 0.3;

          if (other.energy <= 0) {
            other.isDead = true;
            this.kills++;
          }
          env.onEat?.(this, 'bite');
          break;
        }
      }
    }
  }

  reproduce(env = {}) {
    this.reproduceCooldown = 8.0 + Math.random() * 4.0; // 8-12 seconds cooldown
    const scale = env.mutationScale ?? 1;
    const childDNA = this.dna.mutate(Math.min(1, 0.08 * scale), Math.min(1, 0.25 * scale));
    const share = Math.min(0.45, Math.max(0.3, this.dna.gestationShare));
    const childEnergy = this.energy * share;
    // Overhead metabolic tax ensures parent is well below reproduction threshold
    this.energy = Math.min(this.energy * (1 - share) * 0.85, this.dna.reproduceThreshold * 0.7);
    this.childrenCount++;

    const spawnAngle = this.heading + Math.PI + (Math.random() - 0.5) * 0.8;
    const spawnDist = this.radius + childDNA.size + 4;
    const childX = wrapCoord(this.x + Math.cos(spawnAngle) * spawnDist, env.width);
    const childY = wrapCoord(this.y + Math.sin(spawnAngle) * spawnDist, env.height);

    return new Organism(
      childX,
      childY,
      childDNA,
      this.generation + 1,
      this.id,
      childEnergy
    );
  }
}
