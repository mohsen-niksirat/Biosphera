/**
 * Biosphera - Top HUD, Bottom Toolbar & God Mode Controls
 */

import { DNA } from '../genetics/DNA.js';

export class Controls {
  constructor(world) {
    this.world = world;
    this.onImportDNA = null;
    this.bindEvents();
  }

  bindEvents() {
    const btnPlayPause = document.getElementById('btn-play-pause');
    btnPlayPause?.addEventListener('click', () => {
      this.world.isPaused = !this.world.isPaused;
      if (btnPlayPause) {
        btnPlayPause.innerText = this.world.isPaused ? '▶ Resume' : '⏸ Pause';
      }
    });

    const speedButtons = document.querySelectorAll('.btn-speed');
    speedButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        speedButtons.forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        const speed = parseFloat(target.dataset.speed || '1');
        this.world.timeScale = speed;
      });
    });

    document.getElementById('btn-ice-age')?.addEventListener('click', () => {
      this.world.triggerIceAge();
      this.showToast('❄️ Ice Age triggered! Plant growth frozen.');
    });

    document.getElementById('btn-food-bloom')?.addEventListener('click', () => {
      this.world.triggerFoodSurge();
      this.showToast('🍃 Food Bloom! 150 plant nutrients sprouted.');
    });

    document.getElementById('btn-radiation')?.addEventListener('click', () => {
      this.world.triggerRadiationFlare();
      this.showToast('☢️ Cosmic Radiation Flare! Rapid genetic mutations triggered.');
    });

    document.getElementById('btn-toxic-vent')?.addEventListener('click', () => {
      this.world.triggerToxicBloom();
      this.showToast('🧪 New toxic thermal vent formed.');
    });

    document.getElementById('btn-spawn-more')?.addEventListener('click', () => {
      this.world.spawnRandomPopulation(20);
      this.showToast('🧬 Injected 20 new diverse genesis organisms.');
    });

    document.getElementById('btn-reset-world')?.addEventListener('click', () => {
      if (confirm('Reset entire ecosystem to initial state?')) {
        this.world.clearAll();
        this.showToast('🔄 Ecosystem re-seeded.');
      }
    });

    const modal = document.getElementById('dna-modal');
    const btnOpenImport = document.getElementById('btn-import-dna');
    const btnCloseModal = document.getElementById('close-modal');
    const btnSubmitDNA = document.getElementById('btn-submit-dna');
    const dnaInput = document.getElementById('dna-textarea');

    btnOpenImport?.addEventListener('click', () => {
      if (modal) modal.style.display = 'flex';
      if (dnaInput) dnaInput.value = '';
    });

    btnCloseModal?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });

    btnSubmitDNA?.addEventListener('click', () => {
      const val = dnaInput?.value.trim();
      if (val) {
        try {
          const dna = DNA.deserialize(val);
          this.onImportDNA?.(dna);
          if (modal) modal.style.display = 'none';
          this.showToast('🧬 Custom organism imported into biosphere!');
        } catch {
          alert('Invalid DNA string format.');
        }
      }
    });
  }

  updateStats(stats) {
    const elPop = document.getElementById('stat-pop');
    const elGen = document.getElementById('stat-gen');
    const elEcosystem = document.getElementById('stat-diet-ratio');
    const elFood = document.getElementById('stat-food');
    const elLifespan = document.getElementById('stat-lifespan');
    const elFps = document.getElementById('stat-fps');

    if (elPop) elPop.innerText = stats.population.toString();
    if (elGen) elGen.innerText = `Gen ${stats.maxGeneration}`;
    if (elEcosystem) {
      elEcosystem.innerHTML = `🌿 ${stats.herbivores} | 🥩 ${stats.carnivores} | 🌾 ${stats.omnivores}`;
    }
    if (elFood) elFood.innerText = stats.foodCount.toString();
    if (elLifespan) elLifespan.innerText = `${stats.avgLifespan}s`;
    if (elFps) elFps.innerText = stats.fps.toString();
  }

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }
}
