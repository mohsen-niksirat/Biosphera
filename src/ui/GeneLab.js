/**
 * Biosphera - Genetic Engineering Laboratory (Gene Lab)
 * Interactive visual DNA customizer with real-time swimming preview.
 */

import { DNA } from '../genetics/DNA.js';

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
    this.modal.style.display = 'flex';
    this.updateMetabolicStats();
    this.startPreviewLoop();
  }

  close() {
    if (!this.modal) return;
    this.modal.style.display = 'none';
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  updateMetabolicStats() {
    const elBasal = document.getElementById('stat-burn-basal');
    const elKinetic = document.getElementById('stat-burn-kinetic');
    const elDiet = document.getElementById('stat-diet-badge');

    const basal = 0.35 + (this.traits.size / 15) * 0.25;
    const kinetic = (this.traits.speed * this.traits.speed * 0.04) * (this.traits.size / 10);

    if (elBasal) elBasal.innerText = `${basal.toFixed(2)}/s`;
    if (elKinetic) elKinetic.innerText = `${kinetic.toFixed(2)}/s`;

    if (elDiet) {
      if (this.traits.diet < -0.2) {
        elDiet.innerText = '🌿 Herbivore';
        elDiet.className = 'badge badge-herbivore';
      } else if (this.traits.diet > 0.2) {
        elDiet.innerText = '🥩 Carnivore';
        elDiet.className = 'badge badge-carnivore';
      } else {
        elDiet.innerText = '🌾 Omnivore';
        elDiet.className = 'badge badge-omnivore';
      }
    }
  }

  startPreviewLoop() {
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
    ctx.fillStyle = '#060a14';
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
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
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
    ctx.strokeStyle = this.traits.diet > 0.2 ? '#f43f5e' : (this.traits.diet < -0.2 ? '#10b981' : '#facc15');
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Eyes
    const eyeX = this.traits.size * 0.6;
    const eyeY = this.traits.size * 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, 2.8, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(eyeX + 1, -eyeY, 1.4, 0, Math.PI * 2);
    ctx.arc(eyeX + 1, eyeY, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
