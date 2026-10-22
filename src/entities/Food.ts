/**
 * Biosphera - Food Entity (Plants & Meat)
 */

import { SpatialEntity } from '../engine/SpatialHash';

export type FoodType = 'plant' | 'meat';

export class Food implements SpatialEntity {
  public id: string;
  public x: number;
  public y: number;
  public energy: number;
  public maxEnergy: number;
  public type: FoodType;
  public radius: number;
  public age: number;
  public maxAge: number; // Meat rots over time

  constructor(x: number, y: number, type: FoodType = 'plant', energy: number = 25) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.x = x;
    this.y = y;
    this.type = type;
    this.energy = energy;
    this.maxEnergy = energy;
    this.radius = type === 'plant' ? 3.5 : 4.5;
    this.age = 0;
    this.maxAge = type === 'meat' ? 60 : 300; // seconds before decomposition
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.type === 'meat') {
      // Meat slowly rots and shrinks
      const decay = (dt / this.maxAge) * this.maxEnergy;
      this.energy -= decay;
      this.radius = Math.max(1.5, 4.5 * (this.energy / this.maxEnergy));
      return this.energy > 1;
    }
    return this.age < this.maxAge;
  }
}
