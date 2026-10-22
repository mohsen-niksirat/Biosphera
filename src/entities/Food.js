/**
 * Biosphera - Food Entity (Plants & Meat)
 */

export class Food {
  constructor(x, y, type = 'plant', energy = 25) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.x = x;
    this.y = y;
    this.type = type;
    this.energy = energy;
    this.maxEnergy = energy;
    this.radius = type === 'plant' ? 3.5 : 4.5;
    this.age = 0;
    this.maxAge = type === 'meat' ? 60 : 300;
  }

  update(dt) {
    this.age += dt;
    if (this.type === 'meat') {
      const decay = (dt / this.maxAge) * this.maxEnergy;
      this.energy -= decay;
      this.radius = Math.max(1.5, 4.5 * (this.energy / this.maxEnergy));
      return this.energy > 1;
    }
    return this.age < this.maxAge;
  }
}
