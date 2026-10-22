/**
 * Biosphera - Organism (Living Agent)
 * Senses the environment, processes via NeuralNet, navigates, forages, hunts, and reproduces.
 */

import { DNA } from '../genetics/DNA';
import { Food } from './Food';
import { Hazard } from './Hazard';
import { SpatialEntity } from '../engine/SpatialHash';

export class Organism implements SpatialEntity {
  public id: string;
  public parentId: string | null;
  public dna: DNA;

  // Spatial physics
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public heading: number; // In radians
  public radius: number;

  // Metabolic state
  public energy: number;
  public maxEnergy: number;
  public health: number;
  public age: number;
  public generation: number;
  public isDead: boolean;

  // Achievements / lineage
  public plantsEaten: number;
  public kills: number;
  public childrenCount: number;

  // Recent sensory snapshot for UI visualization
  public latestInputs: Float32Array;
  public latestOutputs: Float32Array;
  public nearestTarget: { x: number; y: number; type: 'plant' | 'meat' | 'prey' | 'predator' | 'hazard' } | null;

  // Visual wiggle effect
  public tailPhase: number;

  constructor(
    x: number,
    y: number,
    dna: DNA,
    generation: number = 1,
    parentId: string | null = null,
    initialEnergy: number = 90
  ) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.parentId = parentId;
    this.dna = dna;
    this.generation = generation;

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = Math.random() * Math.PI * 2;
    this.radius = dna.size;

    this.energy = initialEnergy;
    this.maxEnergy = dna.reproduceThreshold * 1.35;
    this.health = 100;
    this.age = 0;
    this.isDead = false;

    this.plantsEaten = 0;
    this.kills = 0;
    this.childrenCount = 0;

    this.latestInputs = new Float32Array(8);
    this.latestOutputs = new Float32Array(4);
    this.nearestTarget = null;
    this.tailPhase = Math.random() * Math.PI * 2;
  }

  /**
   * Sense nearby entities, run the neural network, update velocity and metabolic cost
   */
  public update(
    dt: number,
    worldWidth: number,
    worldHeight: number,
    nearbyFoods: Food[],
    nearbyOrganisms: Organism[],
    nearbyHazards: Hazard[]
  ): Organism | null {
    if (this.isDead) return null;

    this.age += dt;
    this.tailPhase += dt * (2 + Math.hypot(this.vx, this.vy) * 2.5);

    // 1. SENSE ENVIRONMENT
    const inputs = this.sense(nearbyFoods, nearbyOrganisms, nearbyHazards);
    this.latestInputs.set(inputs);

    // 2. THINK (Forward pass through neural network)
    const outputs = this.dna.brain.feedForward(inputs);
    this.latestOutputs.set(outputs);

    // Actuators
    const steer = outputs[0];     // [-1, 1] -> left / right
    const thrust = (outputs[1] + 1) * 0.5; // Map from [-1, 1] to [0, 1]
    const biteAction = outputs[2]; // > 0 to bite / graze
    const splitIntent = outputs[3]; // > 0.3 to reproduce

    // 3. ACT & MOVE
    const maxTurnRate = Math.PI * 2.2;
    this.heading += steer * maxTurnRate * dt;
    // Normalize heading to [-PI, PI]
    this.heading = (this.heading + Math.PI * 3) % (Math.PI * 2) - Math.PI;

    const accel = thrust * this.dna.speed * 45;
    this.vx += Math.cos(this.heading) * accel * dt;
    this.vy += Math.sin(this.heading) * accel * dt;

    // Water Drag / friction
    const drag = 0.92;
    this.vx *= Math.pow(drag, dt * 60);
    this.vy *= Math.pow(drag, dt * 60);

    // Clamp speed
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
    // Basal metabolic rate + kinetic cost (quadratic to speed) + sensor range cost
    const basalCost = 0.35 + (this.dna.size / 15) * 0.25;
    const kineticCost = (currentSpeed * currentSpeed * 0.04) * (this.dna.size / 10);
    const sensorCost = (this.dna.sensorRange / 200) * 0.15;
    const totalBurn = (basalCost + kineticCost + sensorCost) * dt;

    this.energy -= totalBurn;

    // Check hazard damage
    for (const hazard of nearbyHazards) {
      const dist = Math.hypot(hazard.x - this.x, hazard.y - this.y);
      if (dist < hazard.radius + this.radius) {
        this.energy -= hazard.dps * dt;
      }
    }

    // 5. INTERACT: FORAGE & HUNT
    if (biteAction > 0) {
      this.performFeeding(nearbyFoods, nearbyOrganisms);
    }

    // 6. AGEING & MORTALITY
    // Older organisms experience gentle metabolic decay
    const naturalLifespan = 180 + (this.dna.size * 5); // 180-250 seconds
    if (this.age > naturalLifespan) {
      const senescence = ((this.age - naturalLifespan) / 30) * 12 * dt;
      this.energy -= senescence;
    }

    if (this.energy <= 0) {
      this.isDead = true;
      return null;
    }

    // 7. REPRODUCTION (Mitosis / Asexual budding)
    if (splitIntent > 0.25 && this.energy >= this.dna.reproduceThreshold) {
      return this.reproduce();
    }

    return null;
  }

  /**
   * Build 8 sensory inputs for the neural network
   */
  private sense(foods: Food[], organisms: Organism[], hazards: Hazard[]): number[] {
    const inputs = [0, 0, 0, 0, 0, 0, 0, 1.0]; // Default: no targets, bias=1
    this.nearestTarget = null;

    let closestFoodDist = Infinity;
    let closestFoodAngle = 0;
    let closestFoodType: 'plant' | 'meat' = 'plant';

    // Sense Food
    for (const f of foods) {
      // Herbivores prefer plants, carnivores prefer meat
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
      inputs[0] = 1 - (closestFoodDist / this.dna.sensorRange); // 1 = right in front, 0 = far
      inputs[1] = closestFoodAngle / (Math.PI);                  // [-1, 1]
      this.nearestTarget = {
        x: this.x + Math.cos(this.heading + closestFoodAngle) * closestFoodDist,
        y: this.y + Math.sin(this.heading + closestFoodAngle) * closestFoodDist,
        type: closestFoodType
      };
    }

    // Sense Other Organisms (Prey vs Predators)
    let closestOrgDist = Infinity;
    let closestOrgAngle = 0;
    let perceivedRole = 0; // -1: predator, +1: prey, 0: neutral

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

          // Determine role:
          // If self is carnivore and other is smaller -> prey (+1)
          // If other is carnivore and larger than self -> predator (-1)
          if (this.dna.diet > 0.1 && other.dna.size < this.dna.size * 1.15) {
            perceivedRole = 1.0; // Prey!
          } else if (other.dna.diet > 0.1 && other.dna.size > this.dna.size * 0.9) {
            perceivedRole = -1.0; // Predator danger!
          } else {
            perceivedRole = 0.1; // Competitor/neutral
          }
        }
      }
    }

    if (closestOrgDist < Infinity) {
      inputs[2] = 1 - (closestOrgDist / this.dna.sensorRange);
      inputs[3] = closestOrgAngle / Math.PI;
      inputs[4] = perceivedRole;
    }

    // Sense nearest hazard
    let closestHazardDist = Infinity;
    for (const h of hazards) {
      const dist = Math.hypot(h.x - this.x, h.y - this.y);
      if (dist < closestHazardDist) {
        closestHazardDist = dist;
      }
    }
    inputs[5] = closestHazardDist < 120 ? (1 - closestHazardDist / 120) : 0;

    // Internal state
    inputs[6] = Math.min(1.0, this.energy / this.dna.reproduceThreshold);
    inputs[7] = 1.0; // constant bias

    return inputs;
  }

  /**
   * Feeding logic: Graze plants or attack prey
   */
  private performFeeding(nearbyFoods: Food[], nearbyOrganisms: Organism[]): void {
    const mouthReach = this.radius + 6;

    // Graze food
    for (let i = 0; i < nearbyFoods.length; i++) {
      const food = nearbyFoods[i];
      const dist = Math.hypot(food.x - this.x, food.y - this.y);

      if (dist <= mouthReach + food.radius) {
        let efficiency = 1.0;
        if (food.type === 'plant') {
          // Efficiency depends on herbivore diet
          efficiency = Math.max(0.1, 1 - Math.max(0, this.dna.diet));
        } else {
          // Meat efficiency depends on carnivore diet
          efficiency = Math.max(0.1, 1 + Math.min(0, this.dna.diet));
        }

        const gained = food.energy * efficiency;
        this.energy = Math.min(this.maxEnergy, this.energy + gained);
        this.plantsEaten++;
        food.energy = 0; // Mark food consumed
        break;
      }
    }

    // Hunt other organisms (if carnivore/omnivore)
    if (this.dna.diet > -0.2) {
      for (const other of nearbyOrganisms) {
        if (other.id === this.id || other.isDead) continue;
        const dist = Math.hypot(other.x - this.x, other.y - this.y);

        if (dist <= mouthReach + other.radius && other.dna.size <= this.dna.size * 1.3) {
          // Deal bite damage
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

  /**
   * Asexual division / Budding
   */
  private reproduce(): Organism {
    const childDNA = this.dna.mutate(0.08, 0.25);
    const childEnergy = this.energy * this.dna.gestationShare;
    this.energy -= childEnergy;
    this.childrenCount++;

    // Spawn child slightly behind or to the side of parent
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
