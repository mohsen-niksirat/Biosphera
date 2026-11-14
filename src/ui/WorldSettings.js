/**
 * Biosphera - World Rules Panel
 * Live controls for the pressures that shape a run: carrying capacity,
 * vegetation ceiling, mutation intensity, current strength and day length.
 */

import { openModal, closeModal } from './dom.js';

const DEFAULTS = {
  capacity: 160,
  foodCap: 300,
  mutation: 1,
  current: 0.35,
  dayLength: 85
};

export class WorldSettings {
  constructor(modalId, world, dayNight, onChange) {
    this.modal = document.getElementById(modalId);
    this.world = world;
    this.dayNight = dayNight;
    this.onChange = onChange;

    this.inputs = {
      capacity: document.getElementById('set-capacity'),
      foodCap: document.getElementById('set-food-cap'),
      mutation: document.getElementById('set-mutation'),
      current: document.getElementById('set-current'),
      dayLength: document.getElementById('set-day-length')
    };

    this.outputs = {
      capacity: document.getElementById('out-capacity'),
      foodCap: document.getElementById('out-food-cap'),
      mutation: document.getElementById('out-mutation'),
      current: document.getElementById('out-current'),
      dayLength: document.getElementById('out-day-length')
    };

    this.bindEvents();
  }

  bindEvents() {
    if (!this.modal) return;

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      closeModal(this.modal);
    });

    document.getElementById('btn-settings-done')?.addEventListener('click', () => {
      closeModal(this.modal);
    });

    document.getElementById('btn-settings-reset')?.addEventListener('click', () => {
      this.apply(DEFAULTS);
    });

    for (const key of Object.keys(this.inputs)) {
      this.inputs[key]?.addEventListener('input', () => this.apply());
    }
  }

  /** Read the current control values (or a supplied preset) and push them into the world. */
  apply(values = null) {
    const read = (key) => {
      const el = this.inputs[key];
      return el ? parseFloat(el.value) : DEFAULTS[key];
    };

    const next = values || {
      capacity: read('capacity'),
      foodCap: read('foodCap'),
      mutation: read('mutation'),
      current: read('current'),
      dayLength: read('dayLength')
    };

    this.world.maxPopulationCap = Math.round(next.capacity);
    this.world.maxFoodCap = Math.round(next.foodCap);
    this.world.mutationScale = next.mutation;
    this.world.currentStrength = next.current;
    if (this.dayNight) this.dayNight.cycleDuration = next.dayLength;

    this.syncInputs(next);
    this.updateOutputs(next);
    this.onChange?.();
  }

  syncInputs(values) {
    for (const [key, el] of Object.entries(this.inputs)) {
      if (el) el.value = values[key];
    }
  }

  updateOutputs(values) {
    if (this.outputs.capacity) this.outputs.capacity.textContent = `${Math.round(values.capacity)}`;
    if (this.outputs.foodCap) this.outputs.foodCap.textContent = `${Math.round(values.foodCap)}`;
    if (this.outputs.mutation) this.outputs.mutation.textContent = `${values.mutation.toFixed(1)}x`;
    if (this.outputs.current) this.outputs.current.textContent = `${values.current.toFixed(2)}`;
    if (this.outputs.dayLength) this.outputs.dayLength.textContent = `${Math.round(values.dayLength)}s`;
  }

  /** Refresh controls from the live world, then show the panel. */
  open() {
    const live = {
      capacity: this.world.maxPopulationCap,
      foodCap: this.world.maxFoodCap,
      mutation: this.world.mutationScale ?? 1,
      current: this.world.currentStrength,
      dayLength: this.dayNight ? this.dayNight.cycleDuration : DEFAULTS.dayLength
    };
    this.syncInputs(live);
    this.updateOutputs(live);
    openModal(this.modal);
  }
}
