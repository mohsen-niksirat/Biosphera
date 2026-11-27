/**
 * Biosphera - Main Application Entrypoint
 * Orchestrates simulation, WebAudio, population dynamics, Gene Lab, God Brush, Day/Night Cycle, Gladiator Trials,
 * Phylogenetic Cladogram, and Social Snapshot Exporter.
 */

import { World } from './engine/World.js';
import { Camera } from './render/Camera.js';
import { Renderer } from './render/Renderer.js';
import { Inspector } from './ui/Inspector.js';
import { Controls } from './ui/Controls.js';
import { SoundEngine } from './audio/SoundEngine.js';
import { PopulationChart } from './ui/PopulationChart.js';
import { AchievementsEngine } from './engine/Achievements.js';
import { GeneLab } from './ui/GeneLab.js';
import { GodBrush } from './ui/GodBrush.js';
import { ArenaTrial } from './engine/ArenaTrial.js';
import { DayNightCycle } from './engine/DayNightCycle.js';
import { Cladogram } from './engine/Cladogram.js';
import { SnapshotExporter } from './ui/Snapshot.js';
import { SeasonCycle } from './engine/SeasonCycle.js';
import { SpeciesRegistry } from './engine/SpeciesRegistry.js';
import { HallOfFame } from './engine/HallOfFame.js';
import { EvolutionChart } from './ui/EvolutionChart.js';
import { Minimap } from './ui/Minimap.js';
import { WorldSettings } from './ui/WorldSettings.js';
import { WorldIO } from './engine/WorldIO.js';
import { Challenges } from './engine/Challenges.js';
import { setIcon, setLabel, setPressed, setupModalDismissal, isModalOpen, openModal, closeModal, showCopyDialog } from './ui/dom.js';

const SAVE_KEY = 'biosphera_ecosave';
const AUTOSAVE_KEY = 'biosphera_autosave';

class BiospheraApp {
  constructor() {
    this.canvas = document.getElementById('sim-canvas');
    if (!this.canvas) throw new Error('Could not find #sim-canvas');

    // 1. Audio Engine, Charts & Achievements
    this.soundEngine = new SoundEngine();
    this.chart = new PopulationChart('chart-canvas', 160);
    this.evoChart = new EvolutionChart('evo-chart-canvas', 140);
    this.achievements = new AchievementsEngine();
    this.dayNight = new DayNightCycle(85);
    this.seasons = new SeasonCycle(75);
    this.species = new SpeciesRegistry();
    this.records = new HallOfFame();
    this.challenges = new Challenges();
    this.lastAutosave = performance.now();

    // 2. World & Camera
    this.world = new World(2400, 1800);
    this.camera = new Camera(0, 0, 0.75);
    this.renderer = new Renderer(this.canvas, this.camera, this.world);

    // 2b. Whole-biome map + live world rules
    this.minimap = new Minimap('minimap-canvas', this.world, this.camera, this.canvas, 'minimap-panel');
    this.settings = new WorldSettings('settings-modal', this.world, this.dayNight, () => this.syncToggleButtons());

    // 3. UI Modules & Controls
    this.inspector = new Inspector('inspector-panel');
    this.controls = new Controls(this.world, this.soundEngine);

    // 4. God Brush Engine
    this.godBrush = new GodBrush(this.world, this.camera, this.soundEngine, (msg) => {
      this.controls.showToast(msg);
    });

    // 5. Gene Lab
    this.geneLab = new GeneLab('genelab-modal', (engineeredDNA) => {
      const centerWorld = this.camera.screenToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5);
      const injected = this.world.spawnOrganismAt(centerWorld.x, centerWorld.y, engineeredDNA);
      this.renderer.selectedOrganism = injected;
      this.inspector.inspect(injected);
      this.camera.follow(injected);
      this.achievements.unlock('bio_engineer');
      this.controls.showToast('Engineered lifeform injected.');
    });

    // 6. Gladiator Arena Trial
    this.arenaTrial = new ArenaTrial('arena-modal', this.soundEngine, (res) => {
      if (res.score >= 78) {
        this.achievements.unlock('gladiator');
      }
    });

    // 7. Phylogenetic Cladogram
    this.cladogram = new Cladogram('cladogram-canvas', (targetOrg) => {
      this.camera.follow(targetOrg);
      this.renderer.selectedOrganism = targetOrg;
      this.inspector.inspect(targetOrg);
      this.controls.showToast('Camera locked on living lineage.');
    });

    // 8. Hook Achievements Unlocked
    this.achievements.onUnlock = (trophy) => {
      this.soundEngine.playBirth();
      this.controls.showToast(`Milestone unlocked: ${trophy.title}`);
      this.logFieldEvent(`Milestone: ${trophy.title}`, 'milestone');
      this.updateTrophyBadge();
    };

    // 9. Hook world sound events
    this.world.onEvent = (evt) => {
      switch (evt) {
        case 'birth':
          this.soundEngine.playBirth();
          if (this.world.radiationTimer > 0) this.achievements.unlock('mutant_x');
          break;
        case 'eat':
          this.soundEngine.playEat();
          break;
        case 'attack':
          this.soundEngine.playAttack();
          if (this.dayNight.getPhase() === 'night') {
            this.achievements.unlock('nocturnal_hunter');
          }
          break;
        case 'disaster':
          this.soundEngine.playDisaster();
          break;
        case 'ice_age_end':
          // Survived the full freeze — unlock only when it ends, not when triggered
          this.achievements.unlock('ice_survivor');
          this.logFieldEvent('Ice age ended — survivors endured.', 'rescue');
          break;
      }
    };

    this.controls.onFieldEvent = (msg, kind) => this.logFieldEvent(msg, kind);

    // Scenario switch / full reset wipes the world — drop stale selections and history
    this.world.onReset = () => {
      this.renderer.selectedOrganism = null;
      this.renderer.hoveredOrganism = null;
      this.inspector.deselect();
      this.camera.target = null;
      this.species = new SpeciesRegistry();
      this.challenges = new Challenges();
      this.chart.reset();
      this.evoChart.reset();
      this.lastSeason = '';
      this.knownSpecies.clear();
      this.speciesBootstrapped = false;
      this.lastLoggedGenMilestone = 1;
      this.updateChallengesBadge();
      this.logFieldEvent('Biosphere reset — new genesis seeded.', 'info');
    };

    // Loop & Field Log state
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.frameCount = 0;
    this.lastFpsUpdate = this.startTime;
    this.currentFps = 60;
    this.lastDayPhase = '';
    this.lastSeason = '';
    this.knownSpecies = new Set();
    this.speciesBootstrapped = false;
    this.lastLoggedGenMilestone = 1;

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.pressX = 0;
    this.pressY = 0;

    this.resizeCanvas();
    // Center the initial view on the middle of the world using the real canvas size
    this.centerCameraOnWorld();
    this.setupEventListeners();
    this.setupUIBindings();
    this.setupHotkeys();
    this.setupPWA();
    setupModalDismissal();
    this.updateTrophyBadge();
    this.updateChallengesBadge();
    this.updateSeasonButton();
    this.syncToggleButtons();
    document.getElementById('trends-legend')?.insertAdjacentHTML('afterbegin', this.evoChart.legendHTML());

    requestAnimationFrame((t) => this.loop(t));
  }

  setupPWA() {
    // Dev and raw HTTP serve un-hashed module URLs. A cache-first worker there
    // would pin stale source files, so only the built app registers it.
    const isProduction = import.meta.env && import.meta.env.PROD === true;
    if (isProduction && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  resizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const container = this.canvas.parentElement || document.body;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || (window.innerHeight - 60);

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // The camera maps world units to device pixels; keep the ratio in sync.
    if (this.camera) this.camera.pixelRatio = dpr;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Mouse Controls
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      if (this.godBrush.handleMouseDown(mouseX, mouseY)) {
        return;
      }

      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.pressX = e.clientX;
      this.pressY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      this.godBrush.handleMouseMove(mouseX, mouseY);

      if (this.isDragging) {
        const dx = (e.clientX - this.dragStartX) * (this.canvas.width / rect.width);
        const dy = (e.clientY - this.dragStartY) * (this.canvas.height / rect.height);
        this.camera.pan(dx, dy);
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      } else {
        const worldCoords = this.camera.screenToWorld(mouseX, mouseY);
        const candidates = this.world.spatialOrganisms.query(worldCoords.x, worldCoords.y, 40);
        this.renderer.hoveredOrganism = candidates.length > 0 ? candidates[0] : null;
      }
    });

    window.addEventListener('mouseup', (e) => {
      this.godBrush.handleMouseUp();

      if (this.isDragging) {
        // Compare against the original press point — dragStart* is updated every
        // mousemove for incremental panning, so it can't detect total drag distance.
        const movedDist = Math.hypot(e.clientX - this.pressX, e.clientY - this.pressY);
        if (movedDist < 6) {
          this.handleCanvasClick(e.clientX, e.clientY);
        }
      }
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const screenX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const screenY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      this.camera.zoomAt(e.deltaY, screenX, screenY);
    }, { passive: false });

    // Touch Controls (Mobile drag to pan, pinch to zoom, tap to inspect)
    let lastTouchX = 0;
    let lastTouchY = 0;
    let initialPinchDistance = null;
    let isPinching = false;
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const touchX = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
        const touchY = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

        touchStartTime = performance.now();
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;

        if (this.godBrush.handleMouseDown(touchX, touchY)) {
          return;
        }

        this.isDragging = true;
        this.dragStartX = touch.clientX;
        this.dragStartY = touch.clientY;
      } else if (e.touches.length === 2) {
        isPinching = true;
        this.isDragging = false;
        this.godBrush.handleMouseUp();
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();

      if (e.touches.length === 2 && isPinching && initialPinchDistance) {
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = currentDistance / initialPinchDistance;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;

        const rect = this.canvas.getBoundingClientRect();
        const screenX = (midX - rect.left) * (this.canvas.width / rect.width);
        const screenY = (midY - rect.top) * (this.canvas.height / rect.height);

        this.camera.zoomByRatio(ratio, screenX, screenY);
        initialPinchDistance = currentDistance;
      } else if (e.touches.length === 1 && !isPinching) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const touchX = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
        const touchY = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

        if (this.godBrush.currentMode !== 'select') {
          this.godBrush.handleMouseMove(touchX, touchY);
        } else if (this.isDragging) {
          const dx = (touch.clientX - lastTouchX) * (this.canvas.width / rect.width);
          const dy = (touch.clientY - lastTouchY) * (this.canvas.height / rect.height);
          this.camera.pan(dx, dy);
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        this.godBrush.handleMouseUp();
        if (this.isDragging && !isPinching) {
          const elapsed = performance.now() - touchStartTime;
          const movedDist = Math.hypot(lastTouchX - touchStartX, lastTouchY - touchStartY);
          if (elapsed < 350 && movedDist < 12) {
            this.handleCanvasClick(touchStartX, touchStartY);
          }
        }
        this.isDragging = false;
        isPinching = false;
        initialPinchDistance = null;
      } else if (e.touches.length === 1) {
        isPinching = false;
        initialPinchDistance = null;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    });

    this.canvas.addEventListener('touchcancel', () => {
      this.isDragging = false;
      isPinching = false;
      initialPinchDistance = null;
      this.godBrush.handleMouseUp();
    });
  }

  handleCanvasClick(clientX, clientY) {
    if (this.godBrush.currentMode !== 'select') return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = (clientX - rect.left) * (this.canvas.width / rect.width);
    const mouseY = (clientY - rect.top) * (this.canvas.height / rect.height);

    const worldCoords = this.camera.screenToWorld(mouseX, mouseY);
    const candidates = this.world.spatialOrganisms.query(worldCoords.x, worldCoords.y, 35);

    if (candidates.length > 0) {
      const selected = candidates[0];
      this.renderer.selectedOrganism = selected;
      this.inspector.inspect(selected);
    } else {
      this.renderer.selectedOrganism = null;
      this.inspector.deselect();
    }
  }

  setupUIBindings() {
    // Species list inside the Lineage modal
    document.getElementById('btn-lineage')?.addEventListener('click', () => {
      const modal = document.getElementById('lineage-modal');
      if (modal) {
        openModal(modal);
        this.cladogram.rebuildTree(this.world);
        this.renderSpeciesList();
        this.renderGenerationHistogram();
      }
    });
    document.querySelectorAll('.btn-brush').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.godBrush.setMode(e.currentTarget.dataset.brush);
      });
    });
    // Single source of truth for brush button highlighting (covers one-off
    // placements that auto-revert to the select brush)
    this.godBrush.onModeChange = (mode) => {
      document.querySelectorAll('.btn-brush').forEach((b) => {
        b.classList.toggle('active', b.dataset.brush === mode);
      });
    };

    // View Mode selector
    document.getElementById('select-view-mode')?.addEventListener('change', (e) => {
      this.renderer.viewMode = e.target.value;
      this.controls.showToast(`View mode: ${e.target.options[e.target.selectedIndex].text}`);
    });

    // Pheromone Scent & Ocean Currents Overlays
    const btnOverlayScent = document.getElementById('btn-overlay-scent');
    btnOverlayScent?.addEventListener('click', () => {
      this.renderer.showPheromones = !this.renderer.showPheromones;
      const active = Boolean(this.renderer.showPheromones);
      btnOverlayScent.classList.toggle('active', active);
      setPressed(btnOverlayScent, active);
      this.controls.showToast(active ? 'Pheromone scent overlay on.' : 'Pheromone scent overlay off.');
    });

    const btnOverlayCurrents = document.getElementById('btn-overlay-currents');
    btnOverlayCurrents?.addEventListener('click', () => {
      this.renderer.showCurrents = !this.renderer.showCurrents;
      const active = Boolean(this.renderer.showCurrents);
      btnOverlayCurrents.classList.toggle('active', active);
      setPressed(btnOverlayCurrents, active);
      this.controls.showToast(active ? 'Current streamlines overlay on.' : 'Current streamlines overlay off.');
    });

    // Day / Night cycle toggle — 3-state: Auto → locked Day → locked Night → Auto
    const btnDayNight = document.getElementById('btn-day-night');
    btnDayNight?.addEventListener('click', () => {
      const dn = this.dayNight;
      // toggleLock unlocks only when re-passing the currently locked mode, so
      // walking day → night → night is what returns the cycle to Auto.
      dn.toggleLock(dn.isLocked ? 'night' : 'day');
      this.updateDayNightButton();
      const phase = dn.getPhase();
      this.controls.showToast(dn.isLocked
        ? (phase === 'night' ? 'Bioluminescent night locked.' : 'Diurnal light locked.')
        : 'Day/night cycle restored to automatic.');
    });

    // Whole-biome map toggle
    const btnMinimap = document.getElementById('btn-minimap');
    const toggleMinimap = () => {
      const open = this.minimap.toggle();
      btnMinimap?.classList.toggle('active', open);
      setPressed(btnMinimap, open);
      document.getElementById('minimap-panel')?.setAttribute('aria-hidden', open ? 'false' : 'true');
    };
    btnMinimap?.addEventListener('click', toggleMinimap);
    this.toggleMinimap = toggleMinimap;

    // Live world rules (capacity, mutation, currents, day length)
    document.getElementById('btn-settings')?.addEventListener('click', () => this.settings.open());

    // Portable ecosystem files
    document.getElementById('btn-export-world')?.addEventListener('click', () => {
      WorldIO.downloadWorld(this.world, (msg) => this.controls.showToast(msg));
    });

    const worldFileInput = document.getElementById('world-file-input');
    document.getElementById('btn-import-world')?.addEventListener('click', () => worldFileInput?.click());
    worldFileInput?.addEventListener('change', async () => {
      const file = worldFileInput.files && worldFileInput.files[0];
      if (!file) return;
      const result = await WorldIO.readWorldFile(file);
      worldFileInput.value = '';
      if (!result.ok) {
        this.controls.showToast(result.error);
        return;
      }
      if (this.world.loadState(result.state)) {
        this.afterWorldLoaded('Ecosystem imported from file.');
      } else {
        this.controls.showToast('Save data is corrupted or from an unsupported version.');
      }
    });

    // Ecology history as CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      WorldIO.downloadCSV(this.chart, (msg) => this.controls.showToast(msg));
    });

    // Camera follow
    this.inspector.onFollow = (org) => {
      this.camera.follow(org);
      this.controls.showToast(`Tracking organism #${org.id}`);
    };

    // Gladiator Arena Trial trigger
    this.inspector.onArenaTrial = (org) => {
      this.arenaTrial.start(org.dna);
    };

    // Clone
    this.inspector.onClone = (org) => {
      const childDNA = org.dna.mutate(0.04, 0.15);
      const clone = this.world.spawnOrganismAt(org.x + 20, org.y + 20, childDNA);
      this.renderer.selectedOrganism = clone;
      this.inspector.inspect(clone);
      this.controls.showToast('Organism cloned with a fresh mutation.');
    };

    // Clone to Gene Lab
    this.inspector.onCloneToLab = (org) => {
      this.geneLab.openWithDNA(org.dna);
    };

    // Kill
    this.inspector.onKill = (org) => {
      org.isDead = true;
      this.renderer.selectedOrganism = null;
      this.controls.showToast('Organism terminated.');
    };

    // Export DNA
    this.inspector.onExport = (dnaString) => {
      this.achievements.unlock('dna_globetrotter');
      navigator.clipboard.writeText(dnaString).then(() => {
        this.controls.showToast('DNA string copied to clipboard.');
      }).catch(() => {
        showCopyDialog({
          title: 'Export Organism DNA',
          message: 'Clipboard access unavailable. Copy the Base64 DNA string below:',
          value: dnaString
        });
      });
    };

    // Import DNA
    this.controls.onImportDNA = (dna) => {
      const centerWorld = this.camera.screenToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5);
      const injected = this.world.spawnOrganismAt(centerWorld.x, centerWorld.y, dna);
      this.renderer.selectedOrganism = injected;
      this.inspector.inspect(injected);
      this.camera.follow(injected);
    };

    // Fullscreen toggle
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Gene Lab modal trigger
    document.getElementById('btn-open-genelab')?.addEventListener('click', () => {
      this.geneLab.open();
    });

    // Trophies modal trigger
    document.getElementById('btn-trophies')?.addEventListener('click', () => {
      this.showTrophiesModal();
    });

    document.getElementById('btn-close-trophies')?.addEventListener('click', () => {
      closeModal(document.getElementById('trophies-modal'));
    });

    // Scientific Challenges modal trigger
    document.getElementById('btn-challenges')?.addEventListener('click', () => {
      this.showChallengesModal();
    });

    document.getElementById('btn-close-challenges')?.addEventListener('click', () => {
      closeModal(document.getElementById('challenges-modal'));
    });

    // Cladogram Lineage modal
    document.getElementById('btn-close-lineage')?.addEventListener('click', () => {
      closeModal(document.getElementById('lineage-modal'));
    });

    // Snapshot Exporter
    document.getElementById('btn-snapshot')?.addEventListener('click', () => {
      SnapshotExporter.capture(this.canvas, this.world, (msg) => this.controls.showToast(msg));
    });

    // Scientific Guide modal
    document.getElementById('btn-help')?.addEventListener('click', () => {
      openModal(document.getElementById('guide-modal'));
    });

    document.getElementById('btn-close-guide')?.addEventListener('click', () => {
      closeModal(document.getElementById('guide-modal'));
    });

    // Evolution Trends drawer toggle
    document.getElementById('btn-toggle-trends')?.addEventListener('click', (e) => {
      const drawer = document.getElementById('trends-drawer');
      if (drawer) {
        const isOpen = drawer.classList.toggle('open');
        e.currentTarget.classList.toggle('active', isOpen);
        setPressed(e.currentTarget, isOpen);
        e.currentTarget.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    });

    // Collapsible Live Field Log toggle
    const fieldLog = document.getElementById('field-log');
    const btnFieldLog = document.getElementById('btn-toggle-field-log');
    const fieldLogList = document.getElementById('field-log-list');
    btnFieldLog?.addEventListener('click', () => {
      if (!fieldLog || !fieldLogList) return;
      const isOpen = fieldLog.classList.toggle('open');
      fieldLogList.hidden = !isOpen;
      btnFieldLog.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Ecosystem Save / Load & Season cycle (delegated via Controls callbacks)
    this.controls.onSeasonCycle = () => {
      const mode = this.seasons.cycleLock();
      this.updateSeasonButton();
      this.controls.showToast(mode === 'auto' ? 'Seasons: auto cycle' : `Season locked: ${mode}`);
    };

    this.controls.onSave = () => this.saveEcosystem();
    this.controls.onLoad = () => this.loadEcosystem();

    // Mobile Tools Menu Toggle
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const topActions = document.getElementById('top-actions');
    btnMobileMenu?.addEventListener('click', () => {
      topActions?.classList.toggle('mobile-open');
      const open = topActions?.classList.contains('mobile-open') || false;
      btnMobileMenu.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close mobile menu when an action is selected
    topActions?.querySelectorAll('button, select').forEach((el) => {
      el.addEventListener('click', () => {
        if (window.innerWidth <= 1120) {
          topActions.classList.remove('mobile-open');
          btnMobileMenu?.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // Toggle Floating Toolbar (minimize for mobile or clean view)
    const btnToggleToolbar = document.getElementById('btn-toggle-toolbar');
    const bottomBar = document.getElementById('bottom-bar');
    btnToggleToolbar?.addEventListener('click', () => {
      if (bottomBar) {
        bottomBar.classList.toggle('toolbar-minimized');
        const isMin = bottomBar.classList.contains('toolbar-minimized');
        btnToggleToolbar.classList.toggle('minimized', isMin);
        setLabel(btnToggleToolbar, isMin ? 'Show controls' : 'Hide controls');
        setPressed(btnToggleToolbar, !isMin);
      }
    });
  }

  setupHotkeys() {
    window.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.repeat) return; // holding a key must not machine-gun the toggles
      // Never steal browser shortcuts (Ctrl/Cmd+S must still save the page)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Modal dialogs own the keyboard while they are open
      if (isModalOpen()) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          document.getElementById('btn-play-pause')?.click();
          break;
        case 'Digit1':
          document.querySelector('.btn-speed[data-speed="1"]')?.click();
          break;
        case 'Digit2':
          document.querySelector('.btn-speed[data-speed="2"]')?.click();
          break;
        case 'Digit3':
          document.querySelector('.btn-speed[data-speed="5"]')?.click();
          break;
        case 'Digit4':
          document.querySelector('.btn-speed[data-speed="10"]')?.click();
          break;
        case 'KeyM':
          document.getElementById('btn-sound')?.click();
          break;
        case 'KeyN':
          document.getElementById('btn-day-night')?.click();
          break;
        case 'KeyV': {
          const select = document.getElementById('select-view-mode');
          if (select) {
            select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
            select.dispatchEvent(new Event('change'));
          }
          break;
        }
        case 'KeyG':
          this.toggleMinimap?.();
          break;
        case 'KeyC':
          document.getElementById('btn-toggle-chart')?.click();
          break;
        case 'KeyL':
          document.getElementById('btn-open-genelab')?.click();
          break;
        case 'KeyT':
          document.getElementById('btn-trophies')?.click();
          break;
        case 'KeyP':
          SnapshotExporter.capture(this.canvas, this.world, (msg) => this.controls.showToast(msg));
          break;
        case 'KeyF':
          document.getElementById('btn-fullscreen')?.click();
          break;
        case 'KeyS':
          this.saveEcosystem();
          break;
        case 'KeyO':
          this.loadEcosystem();
          break;
        case 'KeyH':
        case 'Slash':
          document.getElementById('btn-help')?.click();
          break;
      }
    });
  }

  updateTrophyBadge() {
    const badge = document.getElementById('trophy-count');
    if (badge) {
      badge.innerText = `${this.achievements.getUnlockedCount()}/${this.achievements.trophies.length}`;
    }
  }

  updateChallengesBadge() {
    const badge = document.getElementById('challenges-count');
    if (badge && this.challenges) {
      badge.innerText = `${this.challenges.completedIds.size}/${this.challenges.challenges.length}`;
    }
  }

  renderChallengesList() {
    const list = document.getElementById('challenges-list');
    if (!list || !this.challenges) return;

    list.innerHTML = this.challenges.challenges.map((c) => {
      const pct = Math.min(100, Math.round((c.progress / Math.max(1, c.target)) * 100));
      return `
        <div class="challenge-card ${c.completed ? 'completed' : ''}">
          <div class="challenge-head">
            <span class="challenge-title">${c.title}</span>
            ${c.completed ? '<span class="badge badge-herbivore">Completed</span>' : '<span class="badge">Active</span>'}
          </div>
          <div class="challenge-desc">${c.description}</div>
          <div class="challenge-progress-row">
            <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>
            <span class="challenge-progress-text">${c.progress} / ${c.target}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  showChallengesModal() {
    const modal = document.getElementById('challenges-modal');
    if (!modal) return;
    this.renderChallengesList();
    openModal(modal);
  }

  updateSeasonButton() {
    const btn = document.getElementById('btn-season');
    if (!btn) return;
    const season = this.seasons.getSeason();
    const label = btn.querySelector('.btn-label');
    if (label) label.textContent = season[0].toUpperCase() + season.slice(1);
    const lock = btn.querySelector('.icon-lock');
    if (lock) lock.hidden = !this.seasons.isLocked;
    btn.classList.toggle('active', this.seasons.isLocked);
    btn.setAttribute('aria-label', `Season: ${season}${this.seasons.isLocked ? ' (locked)' : ' (auto cycle)'}`);
  }

  updateDayNightButton() {
    const btn = document.getElementById('btn-day-night');
    if (!btn) return;
    const phase = this.dayNight.getPhase();
    const locked = this.dayNight.isLocked;
    const icons = { day: 'i-sun', dawn: 'i-sun', dusk: 'i-moon', night: 'i-moon' };
    setIcon(btn, icons[phase] || 'i-cycle');
    setLabel(btn, phase[0].toUpperCase() + phase.slice(1));
    btn.classList.toggle('active', locked);
    setPressed(btn, locked);
    btn.setAttribute('aria-label', `Day/night: ${phase}${locked ? ' (locked)' : ' (automatic)'}`);
  }

  /** Append an emergent biosphere event to the collapsible HUD Field Log. */
  logFieldEvent(message, kind = 'info') {
    const latestEl = document.getElementById('field-log-latest');
    const listEl = document.getElementById('field-log-list');
    if (latestEl) latestEl.textContent = message;
    if (!listEl) return;

    const elapsedSec = Math.max(0, Math.floor((performance.now() - this.startTime) / 1000));
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');

    const item = document.createElement('li');
    item.className = `field-log-item kind-${kind}`;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'field-log-time';
    timeSpan.textContent = `${mins}:${secs}`;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'field-log-msg';
    msgSpan.textContent = message;

    item.append(timeSpan, msgSpan);
    listEl.prepend(item);

    while (listEl.children.length > 30) {
      listEl.lastElementChild?.remove();
    }
  }

  /** Shared post-load reset: drop stale selections and history, recenter the view. */
  afterWorldLoaded(message) {
    this.renderer.selectedOrganism = null;
    this.renderer.hoveredOrganism = null;
    this.inspector.deselect();
    this.camera.target = null;
    this.species = new SpeciesRegistry();
    this.challenges = new Challenges();
    this.chart.reset();
    this.evoChart.reset();
    this.centerCameraOnWorld();
    this.updateSeasonButton();
    this.syncToggleButtons();
    this.updateChallengesBadge();
    this.lastDayPhase = '';
    this.knownSpecies.clear();
    this.speciesBootstrapped = false;
    this.lastLoggedGenMilestone = Math.max(1, Math.floor((this.world.maxGeneration || 1) / 5) * 5);
    this.logFieldEvent(message, 'info');
    this.controls.showToast(message);
  }

  centerCameraOnWorld() {
    const viewW = this.canvas.clientWidth || this.canvas.width;
    const viewH = this.canvas.clientHeight || this.canvas.height;
    this.camera.x = this.world.width * 0.5 - (viewW * 0.5) / this.camera.zoom;
    this.camera.y = this.world.height * 0.5 - (viewH * 0.5) / this.camera.zoom;
  }

  /** Living organisms per generation, drawn into the Lineage modal. */
  renderGenerationHistogram() {
    const canvas = document.getElementById('generation-histogram');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Size the backing store to the dialog width so 10px labels stay legible
    // on phones instead of being scaled down with a fixed 600px canvas.
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(260, Math.round(rect.width || 600));
    if (canvas.width !== cssW || canvas.height !== 120) {
      canvas.width = cssW;
      canvas.height = 120;
    }
    canvas.style.height = '120px';

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const orgs = this.world.organisms;
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.textBaseline = 'middle';

    if (orgs.length === 0) {
      ctx.fillStyle = '#8fa9b3';
      ctx.textAlign = 'center';
      ctx.fillText('No living organisms', w * 0.5, h * 0.5);
      return;
    }

    let min = Infinity;
    let max = -Infinity;
    for (const o of orgs) {
      if (o.generation < min) min = o.generation;
      if (o.generation > max) max = o.generation;
    }

    const bins = new Array(max - min + 1).fill(0);
    for (const o of orgs) bins[o.generation - min]++;
    const peak = Math.max(1, ...bins);

    const pad = { l: 28, r: 10, t: 18, b: 24 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const slot = plotW / bins.length;
    const barW = Math.max(2, slot - 2);

    // Baseline + peak guide
    ctx.strokeStyle = 'rgba(220, 236, 242, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, h - pad.b + 0.5);
    ctx.lineTo(w - pad.r, h - pad.b + 0.5);
    ctx.stroke();

    for (let i = 0; i < bins.length; i++) {
      const barH = (bins[i] / peak) * plotH;
      const x = pad.l + i * slot + 1;
      const y = h - pad.b - barH;
      ctx.fillStyle = bins[i] === peak ? '#3fe0d0' : 'rgba(63, 224, 208, 0.42)';
      if (barH > 0) ctx.fillRect(x, y, barW, barH);
    }

    // Axis labels
    ctx.fillStyle = '#8fa9b3';
    ctx.textAlign = 'right';
    ctx.fillText(`${peak} max`, w - pad.r, 9);

    if (min === max) {
      ctx.textAlign = 'center';
      ctx.fillText(`Gen ${min}`, pad.l + plotW * 0.5, h - 9);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(`Gen ${min}`, pad.l, h - 9);
      ctx.textAlign = 'right';
      ctx.fillText(`Gen ${max}`, w - pad.r, h - 9);
    }
  }

  // Reflect world state onto the toggle buttons (currents/mating start active
  // by default and can also be restored to non-default values by a save load)
  syncToggleButtons() {
    const currents = document.getElementById('btn-currents');
    const mating = document.getElementById('btn-mating');
    const currentsOn = this.world.currentStrength > 0;
    currents?.classList.toggle('active', currentsOn);
    mating?.classList.toggle('active', this.world.sexualReproduction);
    setPressed(currents, currentsOn);
    setPressed(mating, this.world.sexualReproduction);
  }

  renderSpeciesList() {
    const list = document.getElementById('species-list');
    if (!list) return;

    if (this.species.species.length === 0) {
      list.innerHTML = '<p class="modal-desc">No living species detected.</p>';
      return;
    }

    list.innerHTML = this.species.species.map((s) => {
      const dietBadge = s.diet > 0.2
        ? '<span class="badge badge-carnivore"><i class="dot dot-carn"></i>Carnivore</span>'
        : (s.diet < -0.2
          ? '<span class="badge badge-herbivore"><i class="dot dot-herb"></i>Herbivore</span>'
          : '<span class="badge badge-omnivore"><i class="dot dot-omni"></i>Omnivore</span>');
      return `
        <div class="species-row">
          <span class="species-dot" style="background: hsl(${s.hue}, 75%, 55%)"></span>
          <span class="species-name"><em>${s.name}</em></span>
          ${dietBadge}
          <span class="species-count">×${s.count}</span>
          <span class="text-muted">Gen ${s.gen}+</span>
        </div>`;
    }).join('');
  }

  saveEcosystem() {
    try {
      const state = JSON.stringify(this.world.serializeState());
      localStorage.setItem(SAVE_KEY, state);
      this.controls.showToast('Ecosystem saved to browser storage.');
    } catch (e) {
      this.controls.showToast('Save failed: storage full or unavailable.');
      console.warn('Save failed:', e);
    }
  }

  loadEcosystem() {
    try {
      const candidates = [localStorage.getItem(SAVE_KEY), localStorage.getItem(AUTOSAVE_KEY)].filter(Boolean);
      if (candidates.length === 0) {
        this.controls.showToast('No saved ecosystem found.');
        return;
      }

      for (const raw of candidates) {
        try {
          if (this.world.loadState(JSON.parse(raw))) {
            this.afterWorldLoaded('Ecosystem restored from browser storage.');
            return;
          }
        } catch {
          // Corrupt slot: fall through to the autosave before giving up
        }
      }

      this.controls.showToast('Save data is corrupted.');
    } catch (e) {
      this.controls.showToast('Load failed: save data unreadable.');
      console.warn('Load failed:', e);
    }
  }

  autosave() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.world.serializeState()));
    } catch {
      // Quota exceeded or storage unavailable — skip silently
    }
  }

  showTrophiesModal() {
    const modal = document.getElementById('trophies-modal');
    const list = document.getElementById('trophies-list');
    if (!modal || !list) return;

    list.innerHTML = this.achievements.trophies.map(t => `
      <div class="trophy-card ${t.unlocked ? 'unlocked' : ''}">
        <span class="trophy-icon">${t.icon}</span>
        <div class="trophy-info">
          <div class="trophy-title">
            ${t.title}
            ${t.unlocked ? '<span class="badge badge-herbivore">Unlocked</span>' : '<span class="badge">Locked</span>'}
          </div>
          <div class="trophy-desc">${t.description}</div>
          ${t.unlockedAt ? `<div class="trophy-time">Achieved at ${t.unlockedAt}</div>` : ''}
        </div>
      </div>
    `).join('');

    const recordsList = document.getElementById('records-list');
    if (recordsList) recordsList.innerHTML = this.records.renderHTML();

    openModal(modal);
  }

  loop(currentTime) {
    // Clamp to >= 0: the first rAF timestamp can precede the constructor's
    // performance.now(), and a negative dt sends SeasonCycle into ORDER[-1].
    const dt = Math.max(0, Math.min(0.1, (currentTime - this.lastTime) / 1000));
    this.lastTime = currentTime;

    const stats = this.world.getStats(this.currentFps);

    // Track FPS
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
      this.controls.updateStats(this.world.getStats(this.currentFps));
      this.achievements.checkMilestones(this.world);
      this.records.update(this.world, currentTime);
      this.soundEngine.updateTelemetry(this.world, this.dayNight);

      const { challenges, newlyCompleted } = this.challenges.evaluate(this.world, this.species, this.seasons);
      this.updateChallengesBadge();
      if (newlyCompleted.length > 0) {
        for (const id of newlyCompleted) {
          const ch = challenges.find((c) => c.id === id);
          if (ch) {
            this.soundEngine.playBirth();
            this.controls.showToast(`Challenge completed: ${ch.title}`);
            this.logFieldEvent(`Challenge completed: ${ch.title}`, 'milestone');
          }
        }
      }
      const chModal = document.getElementById('challenges-modal');
      if (chModal && chModal.style.display === 'flex') {
        this.renderChallengesList();
      }
    }

    // Record population history in chart
    this.chart.record(stats, currentTime);

    // 1. Simulation Step & Circadian Cycle (frame-skipping fixed-dt for 20x/50x Deep-Time Warp)
    const hadOrganisms = this.world.organisms.length > 0;
    if (this.world.timeScale > 10 && !this.world.isPaused) {
      const stepDt = 1 / 30;
      const maxSubsteps = Math.min(24, Math.max(1, Math.ceil((dt * this.world.timeScale) / stepDt)));
      const stepStart = performance.now();
      for (let s = 0; s < maxSubsteps; s++) {
        this.world.stepOnce(stepDt);
        if (s >= 4 && performance.now() - stepStart > 12) break;
      }
    } else {
      this.world.update(dt);
    }
    if (
      hadOrganisms &&
      this.world.organisms.length === 15 &&
      this.world.organisms.every((o) => o.age === 0 && o.generation === 1)
    ) {
      this.logFieldEvent('Extinction rescue: 15 genesis organisms seeded.', 'rescue');
    }
    this.godBrush.update(dt);
    this.dayNight.update(dt);

    // Seasons drive vegetation growth & metabolism multipliers
    this.seasons.update(dt);
    const seasonMult = this.seasons.getMultipliers();
    this.world.foodRateMultiplier = seasonMult.food;
    this.world.metabolismMultiplier = seasonMult.metabolism;
    const seasonName = this.seasons.getSeason();
    if (seasonName !== this.lastSeason) {
      this.lastSeason = seasonName;
      this.updateSeasonButton();
    }

    // Species auto-classification (throttled internally)
    this.species.update(this.world, currentTime);
    if (this.species.species.length > 0) {
      if (!this.speciesBootstrapped) {
        for (const s of this.species.species) this.knownSpecies.add(s.name);
        this.speciesBootstrapped = true;
      } else {
        for (const s of this.species.species) {
          if (!this.knownSpecies.has(s.name)) {
            this.knownSpecies.add(s.name);
            this.soundEngine.playSpeciation();
            this.logFieldEvent(`New species emerged: ${s.name}`, 'species');
          }
        }
      }
    }

    // Generation milestone logging (every 5 generations)
    const genMilestone = Math.floor(stats.maxGeneration / 5) * 5;
    if (genMilestone >= 5 && genMilestone > this.lastLoggedGenMilestone) {
      this.lastLoggedGenMilestone = genMilestone;
      this.logFieldEvent(`Generation ${genMilestone} reached.`, 'milestone');
    }

    // Evolution trends sampling
    const orgs = this.world.organisms;
    if (orgs.length > 0) {
      let size = 0, speed = 0, vision = 0, diet = 0, gen = 0;
      for (const o of orgs) {
        size += o.dna.size;
        speed += o.dna.speed;
        vision += o.dna.sensorRange;
        diet += o.dna.diet;
        gen += o.generation;
      }
      const n = orgs.length;
      this.evoChart.record({
        avgSize: size / n,
        avgSpeed: speed / n,
        avgVision: vision / n,
        avgDiet: diet / n,
        avgGeneration: gen / n
      }, currentTime);
    }

    // Silent autosave every 90s
    if (currentTime - this.lastAutosave >= 90000) {
      this.lastAutosave = currentTime;
      this.autosave();
    }

    // Day/night readout (rewritten only when the phase or lock state changes)
    const phaseKey = `${this.dayNight.getPhase()}:${this.dayNight.isLocked}`;
    if (phaseKey !== this.lastDayPhase) {
      this.lastDayPhase = phaseKey;
      this.updateDayNightButton();
    }

    // Whole-biome overview
    this.minimap.render(currentTime);

    // 2. Camera tracking
    this.camera.update(this.canvas.width, this.canvas.height, dt);

    // 3. Render Viewport with GodBrush ripples, Day/Night lighting & season tint
    this.renderer.render(this.world, this.godBrush, this.dayNight, this.seasons.getTint());

    // 4. Update Microscope Inspector
    this.inspector.update();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new BiospheraApp();
});
