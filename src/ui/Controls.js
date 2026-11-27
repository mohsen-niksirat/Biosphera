/**
 * Biosphera - Top HUD, Bottom Toolbar & God Mode Controls
 */

import { DNA } from '../genetics/DNA.js';
import { setIcon, setLabel, setPressed, openModal, closeModal, showConfirm, showAlert } from './dom.js';

export class Controls {
  constructor(world, soundEngine) {
    this.world = world;
    this.soundEngine = soundEngine;
    this.onImportDNA = null;
    this.onSeasonCycle = null;
    this.onSave = null;
    this.onLoad = null;
    this.onFieldEvent = null;
    this.bindEvents();
  }

  bindEvents() {
    // Play / Pause
    const btnPlayPause = document.getElementById('btn-play-pause');
    btnPlayPause?.addEventListener('click', () => {
      this.world.isPaused = !this.world.isPaused;
      setIcon(btnPlayPause, this.world.isPaused ? 'i-play' : 'i-pause');
      setLabel(btnPlayPause, this.world.isPaused ? 'Resume' : 'Pause');
      setPressed(btnPlayPause, !this.world.isPaused);
    });

    // Speed Multipliers
    const speedButtons = document.querySelectorAll('.btn-speed');
    speedButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        speedButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        const target = e.currentTarget;
        target.classList.add('active');
        target.setAttribute('aria-pressed', 'true');
        const speed = parseFloat(target.dataset.speed || '1');
        this.world.timeScale = speed;
      });
    });

    // Sound toggle
    const btnSound = document.getElementById('btn-sound');
    btnSound?.addEventListener('click', () => {
      if (this.soundEngine) {
        const isAudible = this.soundEngine.toggleMute();
        setIcon(btnSound, isAudible ? 'i-volume-on' : 'i-volume-off');
        setLabel(btnSound, isAudible ? 'Sound: On' : 'Sound: Off');
        btnSound.classList.toggle('active', isAudible);
        setPressed(btnSound, isAudible);
        this.showToast(isAudible ? 'Audio soundscape activated' : 'Audio muted');
      }
    });

    // Scenario / Preset selector
    const selectScenario = document.getElementById('select-scenario');
    selectScenario?.addEventListener('change', async (e) => {
      const preset = e.target.value;
      const label = e.target.options[e.target.selectedIndex].text;
      const confirmed = await showConfirm({
        title: 'Switch Scenario',
        message: `Switch scenario to "${label}"? This will reset the current population.`,
        confirmLabel: 'Switch Scenario',
        danger: true
      });
      if (confirmed) {
        this.world.loadPreset(preset);
        this.showToast(`Loaded scenario: ${label}`);
      } else {
        selectScenario.value = this.world.currentPreset;
      }
    });

    // Chart drawer toggle
    const btnToggleChart = document.getElementById('btn-toggle-chart');
    const chartDrawer = document.getElementById('chart-drawer');
    btnToggleChart?.addEventListener('click', () => {
      if (chartDrawer) {
        const isOpen = chartDrawer.classList.toggle('open');
        btnToggleChart.classList.toggle('active', isOpen);
        setPressed(btnToggleChart, isOpen);
        btnToggleChart.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    });

    // Environmental Interventions (God Mode)
    document.getElementById('btn-ice-age')?.addEventListener('click', () => {
      this.world.triggerIceAge();
      this.showToast('Ice age triggered. Plant growth frozen.');
      this.onFieldEvent?.('Ice age triggered — vegetation frozen.', 'disaster');
    });

    document.getElementById('btn-food-bloom')?.addEventListener('click', () => {
      const added = this.world.triggerFoodSurge();
      this.showToast(`Food bloom: ${added} plants sprouted.`);
    });

    document.getElementById('btn-radiation')?.addEventListener('click', () => {
      this.world.triggerRadiationFlare();
      this.showToast('Radiation flare. Rapid mutations triggered.');
      this.onFieldEvent?.('Radiation flare — mutation spike active.', 'disaster');
    });

    document.getElementById('btn-toxic-vent')?.addEventListener('click', () => {
      this.world.triggerToxicBloom();
      this.showToast('New toxic thermal vent formed.');
      this.onFieldEvent?.('Thermal toxic vent erupted.', 'disaster');
    });

    document.getElementById('btn-pathogen')?.addEventListener('click', () => {
      this.world.triggerPathogenWave?.();
      this.showToast('Pathogen wave released.');
      this.onFieldEvent?.('Pathogen wave released — contagion spreading.', 'disaster');
    });

    // Water currents toggle
    const btnCurrents = document.getElementById('btn-currents');
    btnCurrents?.addEventListener('click', () => {
      this.world.currentStrength = this.world.currentStrength > 0 ? 0 : 0.9;
      btnCurrents.classList.toggle('active', this.world.currentStrength > 0);
      setPressed(btnCurrents, this.world.currentStrength > 0);
      this.showToast(this.world.currentStrength > 0 ? 'Ocean currents unleashed.' : 'Water stilled.');
    });

    // Sexual reproduction toggle
    const btnMating = document.getElementById('btn-mating');
    btnMating?.addEventListener('click', () => {
      this.world.sexualReproduction = !this.world.sexualReproduction;
      btnMating.classList.toggle('active', this.world.sexualReproduction);
      setPressed(btnMating, this.world.sexualReproduction);
      this.showToast(this.world.sexualReproduction
        ? 'Sexual reproduction on. Genomes recombine with a mate.'
        : 'Parthenogenesis restored. Offspring are cloned and mutated.');
    });

    // Season cycle (delegated to main app)
    document.getElementById('btn-season')?.addEventListener('click', () => {
      this.onSeasonCycle?.();
    });

    // Ecosystem save / load (delegated to main app)
    document.getElementById('btn-save')?.addEventListener('click', () => this.onSave?.());
    document.getElementById('btn-load')?.addEventListener('click', () => this.onLoad?.());

    document.getElementById('btn-spawn-more')?.addEventListener('click', () => {
      this.world.spawnRandomPopulation(20);
      this.showToast('20 diverse genesis organisms injected.');
    });

    document.getElementById('btn-reset-world')?.addEventListener('click', async () => {
      const confirmed = await showConfirm({
        title: 'Reset Ecosystem',
        message: 'Reset entire ecosystem to initial state? All living lineages will be lost.',
        confirmLabel: 'Reset World',
        danger: true
      });
      if (confirmed) {
        this.world.clearAll();
        this.showToast('Ecosystem re-seeded.');
      }
    });

    // DNA Import Modal
    const modal = document.getElementById('dna-modal');
    const btnOpenImport = document.getElementById('btn-import-dna');
    const btnCloseModal = document.getElementById('close-modal');
    const btnSubmitDNA = document.getElementById('btn-submit-dna');
    const dnaInput = document.getElementById('dna-textarea');

    btnOpenImport?.addEventListener('click', () => {
      if (modal) openModal(modal);
      if (dnaInput) dnaInput.value = '';
    });

    btnCloseModal?.addEventListener('click', () => {
      closeModal(modal);
    });

    btnSubmitDNA?.addEventListener('click', () => {
      const val = dnaInput?.value.trim();
      if (!val) return;

      const dna = DNA.deserialize(val);
      if (dna) {
        this.onImportDNA?.(dna);
        closeModal(modal);
        this.showToast('Custom organism imported into biosphere!');
      } else {
        showAlert({
          title: 'Invalid DNA String',
          message: 'Invalid DNA string format. Paste a Base64 string exported from Biosphera.'
        });
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
    if (elGen) elGen.innerText = stats.maxGeneration.toString();
    if (elEcosystem) {
      elEcosystem.innerHTML = `
        <span class="diet-legend"><i class="dot dot-herb"></i>${stats.herbivores}</span>
        <span class="diet-legend"><i class="dot dot-carn"></i>${stats.carnivores}</span>
        <span class="diet-legend"><i class="dot dot-omni"></i>${stats.omnivores}</span>`;
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
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }
}
