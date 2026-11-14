/**
 * Biosphera - Genetic Engineering Laboratory (Gene Lab)
 * Interactive visual DNA customizer with real-time swimming preview.
 */

import { DNA } from '../genetics/DNA.js';
import { openModal, closeModal } from './dom.js';

export class GeneLab {
  constructor(modalId, onSpawnCallback) {
    this.modal = document.getElementById(modalId);
    this.previewCanvas = document.getElementById('gene-preview-canvas');
    this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d') : null;
    this.onSpawn = onSpawnCallback;

    // Current engineered traits
    this.traits = {
      size: 12,
      speed: 3.0,
      sensorRange: 160,
      sensorFov: Math.PI * 0.9,
      diet: -0.6, // Herbivore leaning
      colorHue: 175
    };

    this.previewPhase = 0;
    this.animFrame = null;

    this.modal?.addEventListener('modal:close', () => this.stopPreview());

    this.bindInputs();
  }

  bindInputs() {
    if (!this.modal) return;

    const bindSlider = (id, key, transform = (v) => parseFloat(v)) => {
      const el = document.getElementById(id);
      const valLabel = document.getElementById(`${id}-val`);
      el?.addEventListener('input', (e) => {
        const val = transform(e.target.value);
        this.traits[key] = val;
        if (valLabel) valLabel.innerText = e.target.value;
        this.updateMetabolicStats();
      });
    };

    bindSlider('gene-size', 'size');
    bindSlider('gene-speed', 'speed');
    bindSlider('gene-vision', 'sensorRange');
    bindSlider('gene-fov', 'sensorFov', (v) => (parseFloat(v) * Math.PI) / 180);
    bindSlider('gene-diet', 'diet');
    bindSlider('gene-hue', 'colorHue', (v) => parseInt(v));

    document.getElementById('btn-close-genelab')?.addEventListener('click', () => {
      this.close();
    });

    document.getElementById('btn-spawn-engineered')?.addEventListener('click', () => {
      const engineeredDNA = new DNA({
        size: this.traits.size,
        speed: this.traits.speed,
        sensorRange: this.traits.sensorRange,
        sensorFov: this.traits.sensorFov,
        diet: this.traits.diet,
        colorHue: this.traits.colorHue
      });
      this.onSpawn?.(engineeredDNA);
      this.close();
    });
  }

  open() {
    if (!this.modal) return;
    openModal(this.modal);
    this.updateMetabolicStats();
    this.startPreviewLoop();
  }

  stopPreview() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  close() {
    if (!this.modal) return;
    closeModal(this.modal);
    this.stopPreview();
  }

  updateMetabolicStats() {
    const elBasal = document.getElementById('stat-burn-basal');
    const elKinetic = document.getElementById('stat-burn-kinetic');
    const elDiet = document.getElementById('stat-diet-badge');

    const basal = 0.35 + (this.traits.size / 15) * 0.25;
    // Sprint burn happens at max speed = speed * 1.5 (Organism movement cap),
    // so the real kinetic cost is (1.5 * speed)^2 — 2.25x the naive speed^2.
    const kinetic = ((this.traits.speed * 1.5) * (this.traits.speed * 1.5) * 0.04) * (this.traits.size / 10);

    if (elBasal) elBasal.innerText = `${basal.toFixed(2)}/s`;
    if (elKinetic) elKinetic.innerText = `${kinetic.toFixed(2)}/s`;

    if (elDiet) {
      if (this.traits.diet < -0.2) {
        elDiet.innerHTML = '<i class="dot dot-herb"></i>Herbivore';
        elDiet.className = 'badge badge-herbivore';
      } else if (this.traits.diet > 0.2) {
        elDiet.innerHTML = '<i class="dot dot-carn"></i>Carnivore';
        elDiet.className = 'badge badge-carnivore';
      } else {
        elDiet.innerHTML = '<i class="dot dot-omni"></i>Omnivore';
        elDiet.className = 'badge badge-omnivore';
      }
    }
  }

  startPreviewLoop() {
    // Guard against stacked rAF chains when open() is called while already open
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    const render = () => {
      this.previewPhase += 0.06 * this.traits.speed;
      this.drawPreview();
      this.animFrame = requestAnimationFrame(render);
    };
    render();
  }

  drawPreview() {
    if (!this.previewCtx || !this.previewCanvas) return;
    const ctx = this.previewCtx;
    const w = this.previewCanvas.width;
    const h = this.previewCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Deep water circular dish
    ctx.fillStyle = '#02060d';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);

    // Vision cone
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(
      0,
      0,
      Math.min(w * 0.45, this.traits.sensorRange * 0.45),
      -this.traits.sensorFov * 0.5,
      this.traits.sensorFov * 0.5
    );
    ctx.closePath();
    ctx.fillStyle = 'rgba(63, 224, 208, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(63, 224, 208, 0.35)';
    ctx.stroke();

    // Multi-segment tail
    const segments = 4;
    const segLen = (this.traits.size * 2) / segments;
    const baseWiggle = this.traits.size * 0.5;

    ctx.beginPath();
    ctx.moveTo(-this.traits.size * 0.6, 0);
    let curX = -this.traits.size * 0.6;
    for (let s = 1; s <= segments; s++) {
      const nextX = curX - segLen;
      const wY = Math.sin(this.previewPhase + s * 0.8) * (baseWiggle * (s / segments));
      ctx.lineTo(nextX, wY);
      curX = nextX;
    }
    ctx.strokeStyle = `hsla(${this.traits.colorHue}, 75%, 60%, 0.75)`;
    ctx.lineWidth = Math.max(1.8, this.traits.size * 0.24);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, this.traits.size * 1.15, this.traits.size * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${this.traits.colorHue}, 75%, 55%)`;
    ctx.fill();
    ctx.strokeStyle = this.traits.diet > 0.2 ? '#fb7185' : (this.traits.diet < -0.2 ? '#34d399' : '#fbbf24');
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Eyes
    const eyeX = this.traits.size * 0.6;
    const eyeY = this.traits.size * 0.45;
    ctx.fillStyle = '#dcecf2';
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, 2.8, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050d14';
    ctx.beginPath();
    ctx.arc(eyeX + 1, -eyeY, 1.4, 0, Math.PI * 2);
    ctx.arc(eyeX + 1, eyeY, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
