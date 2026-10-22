/**
 * Biosphera - Organism (Living Agent)
 */

import { DNA } from '../genetics/DNA.js';

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
    this.maxEnergy = this.dna.reproduceThreshold * 1.35;
    this.health = 100;
    this.age = 0;
    this.isDead = false;

    this.plantsEaten = 0;
    this.kills = 0;
    this.childrenCount = 0;
    this.reproduceCooldown = 6.0; // Must mature before reproducing

    this.latestInputs = new Float32Array(8);
    this.latestOutputs = new Float32Array(4);
    this.nearestTarget = null;
    this.tailPhase = Math.random() * Math.PI * 2;
  }

  update(dt, worldWidth, worldHeight, nearbyFoods, nearbyOrganisms, nearbyHazards) {
    if (this.isDead) return null;

    this.age += dt;
    if (this.reproduceCooldown > 0) {
      this.reproduceCooldown -= dt;
    }
    this.tailPhase += dt * (2 + Math.hypot(this.vx, this.vy) * 2.5);

    // 1. SENSE
    const inputs = this.sense(nearbyFoods, nearbyOrganisms, nearbyHazards);
    this.latestInputs.set(inputs);

    // 2. THINK
    const outputs = this.dna.brain.feedForward(inputs);
    this.latestOutputs.set(outputs);

    const steer = outputs[0];
    const thrust = (outputs[1] + 1) * 0.5;
    const biteAction = outputs[2];
    const splitIntent = outputs[3];

    // 3. ACT & MOVE
    const maxTurnRate = Math.PI * 2.2;
    this.heading += steer * maxTurnRate * dt;
    this.heading = (this.heading + Math.PI * 3) % (Math.PI * 2) - Math.PI;

    const accel = thrust * this.dna.speed * 45;
    this.vx += Math.cos(this.heading) * accel * dt;
    this.vy += Math.sin(this.heading) * accel * dt;

    const drag = 0.92;
    this.vx *= Math.pow(drag, dt * 60);
    this.vy *= Math.pow(drag, dt * 60);

    const currentSpeed = Math.hypot(this.vx, this.vy);
    const maxSpeed = this.dna.speed * 1.5;
    if (currentSpeed > maxSpeed) {
      this.vx = (this.vx / currentSpeed) * maxSpeed;
      this.vy = (this.vy / currentSpeed) * maxSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Toroidal world wrapping
    if (this.x < 0) this.x += worldWidth;
    else if (this.x > worldWidth) this.x -= worldWidth;
    if (this.y < 0) this.y += worldHeight;
    else if (this.y > worldHeight) this.y -= worldHeight;

    // 4. METABOLISM & ENERGY BURN
    const basalCost = 0.35 + (this.dna.size / 15) * 0.25;
    const kineticCost = (currentSpeed * currentSpeed * 0.04) * (this.dna.size / 10);
    const sensorCost = (this.dna.sensorRange / 200) * 0.15;
    const totalBurn = (basalCost + kineticCost + sensorCost) * dt;

    this.energy -= totalBurn;

    // Hazards
    for (const hazard of nearbyHazards) {
      const dist = Math.hypot(hazard.x - this.x, hazard.y - this.y);
      if (dist < hazard.radius + this.radius) {
        this.energy -= hazard.dps * dt;
      }
    }

    // 5. INTERACT
    if (biteAction > 0) {
      this.performFeeding(nearbyFoods, nearbyOrganisms);
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
          const d = Math.hypot(o.x - this.x, o.y - this.y);
          if (d < crowdCheckRadius) {
            localCrowding++;
          }
        }
      }

      if (localCrowding < 6) {
        return this.reproduce();
      }
    }

    return null;
  }

  sense(foods, organisms, hazards) {
    const inputs = [0, 0, 0, 0, 0, 0, 0, 1.0];
    this.nearestTarget = null;

    let closestFoodDist = Infinity;
    let closestFoodAngle = 0;
    let closestFoodType = 'plant';

    // Sense Food
    for (const f of foods) {
      if (this.dna.diet < -0.2 && f.type === 'meat') continue;
      if (this.dna.diet > 0.2 && f.type === 'plant') continue;

      const dx = f.x - this.x;
      const dy = f.y - this.y;
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
      this.nearestTarget = {
        x: this.x + Math.cos(this.heading + closestFoodAngle) * closestFoodDist,
        y: this.y + Math.sin(this.heading + closestFoodAngle) * closestFoodDist,
        type: closestFoodType
      };
    }

    // Sense Organisms
    let closestOrgDist = Infinity;
    let closestOrgAngle = 0;
    let perceivedRole = 0;

    for (const other of organisms) {
      if (other.id === this.id || other.isDead) continue;

      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= this.dna.sensorRange && dist < closestOrgDist) {
        const targetAngle = Math.atan2(dy, dx);
        let relAngle = targetAngle - this.heading;
        relAngle = (relAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI;

        if (Math.abs(relAngle) <= this.dna.sensorFov * 0.5) {
          closestOrgDist = dist;
          closestOrgAngle = relAngle;

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
    }

    // Sense hazard
    let closestHazardDist = Infinity;
    for (const h of hazards) {
      const dist = Math.hypot(h.x - this.x, h.y - this.y);
      if (dist < closestHazardDist) {
        closestHazardDist = dist;
      }
    }
    inputs[5] = closestHazardDist < 120 ? (1 - closestHazardDist / 120) : 0;
    inputs[6] = Math.min(1.0, this.energy / this.dna.reproduceThreshold);
    inputs[7] = 1.0;

    return inputs;
  }

  performFeeding(nearbyFoods, nearbyOrganisms) {
    const mouthReach = this.radius + 6;

    for (let i = 0; i < nearbyFoods.length; i++) {
      const food = nearbyFoods[i];
      const dist = Math.hypot(food.x - this.x, food.y - this.y);

      if (dist <= mouthReach + food.radius) {
        let efficiency = 1.0;
        if (food.type === 'plant') {
          efficiency = Math.max(0.1, 1 - Math.max(0, this.dna.diet));
        } else {
          efficiency = Math.max(0.1, 1 + Math.min(0, this.dna.diet));
        }

        const gained = food.energy * efficiency;
        this.energy = Math.min(this.maxEnergy, this.energy + gained);
        this.plantsEaten++;
        food.energy = 0;
        break;
      }
    }

    if (this.dna.diet > -0.2) {
      for (const other of nearbyOrganisms) {
        if (other.id === this.id || other.isDead) continue;
        const dist = Math.hypot(other.x - this.x, other.y - this.y);

        if (dist <= mouthReach + other.radius && other.dna.size <= this.dna.size * 1.3) {
          const biteDmg = (this.dna.size * 2.5) * (1 + this.dna.diet);
          other.energy -= biteDmg;

          const absorbed = biteDmg * 0.7 * Math.max(0.3, this.dna.diet + 0.5);
          this.energy = Math.min(this.maxEnergy, this.energy + absorbed);

          if (other.energy <= 0) {
            other.isDead = true;
            this.kills++;
          }
          break;
        }
      }
    }
  }

  reproduce() {
    this.reproduceCooldown = 8.0 + Math.random() * 4.0; // 8-12 seconds cooldown
    const childDNA = this.dna.mutate(0.08, 0.25);
    const share = Math.min(0.45, Math.max(0.3, this.dna.gestationShare));
    const childEnergy = this.energy * share;
    // Overhead metabolic tax ensures parent is well below reproduction threshold
    this.energy = Math.min(this.energy * (1 - share) * 0.85, this.dna.reproduceThreshold * 0.7);
    this.childrenCount++;

    const spawnAngle = this.heading + Math.PI + (Math.random() - 0.5) * 0.8;
    const spawnDist = this.radius + childDNA.size + 4;
    const childX = this.x + Math.cos(spawnAngle) * spawnDist;
    const childY = this.y + Math.sin(spawnAngle) * spawnDist;

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
