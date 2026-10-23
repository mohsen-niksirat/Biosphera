/**
 * Biosphera - Main Application Entrypoint
 * Orchestrates simulation, WebAudio, population dynamics, Gene Lab, God Brush, Day/Night Cycle, Gladiator Trials,
 * Phylogenetic Cladogram, and Social Snapshot Exporter.
 */

import './style.css';

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
    this.lastAutosave = performance.now();

    // 2. World & Camera
    this.world = new World(2400, 1800);
    this.camera = new Camera(0, 0, 0.75);
    this.renderer = new Renderer(this.canvas, this.camera);

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
      this.controls.showToast('🧬 Injected custom engineered lifeform!');
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
      this.controls.showToast('🎯 Focused on living lineage');
    });

    // 8. Hook Achievements Unlocked
    this.achievements.onUnlock = (trophy) => {
      this.soundEngine.playBirth();
      this.controls.showToast(`🏆 Milestone Unlocked: ${trophy.icon} ${trophy.title}`);
      this.updateTrophyBadge();
    };

    // 9. Hook world sound events
    this.world.onEvent = (evt) => {
      switch (evt) {
        case 'birth':
          this.soundEngine.playBirth();
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
          if (this.world.iceAgeTimer > 0) this.achievements.unlock('ice_survivor');
          if (this.world.radiationTimer > 0) this.achievements.unlock('mutant_x');
          break;
      }
    };

    // Loop state
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.currentFps = 60;

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.pressX = 0;
    this.pressY = 0;

    this.resizeCanvas();
    // Center the initial view on the middle of the world using the real canvas size
    this.camera.x = this.world.width * 0.5 - (this.canvas.width * 0.5) / this.camera.zoom;
    this.camera.y = this.world.height * 0.5 - (this.canvas.height * 0.5) / this.camera.zoom;
    this.setupEventListeners();
    this.setupUIBindings();
    this.setupHotkeys();
    this.setupPWA();
    this.updateTrophyBadge();
    this.updateSeasonButton();
    document.getElementById('trends-legend')?.insertAdjacentHTML('afterbegin', this.evoChart.legendHTML());

    requestAnimationFrame((t) => this.loop(t));
  }

  setupPWA() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
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
        modal.style.display = 'flex';
        this.cladogram.rebuildTree(this.world);
        this.renderSpeciesList();
      }
    });
    document.querySelectorAll('.btn-brush').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-brush').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.godBrush.setMode(target.dataset.brush);
      });
    });

    // View Mode selector
    document.getElementById('select-view-mode')?.addEventListener('change', (e) => {
      this.renderer.viewMode = e.target.value;
      this.controls.showToast(`👁️ View Mode: ${e.target.options[e.target.selectedIndex].text}`);
    });

    // Day / Night cycle toggle
    const btnDayNight = document.getElementById('btn-day-night');
    btnDayNight?.addEventListener('click', () => {
      const current = this.dayNight.getPhase();
      const next = current === 'night' ? 'day' : 'night';
      const locked = this.dayNight.toggleLock(next);
      if (btnDayNight) {
        btnDayNight.innerText = locked === 'night' ? '🌙 Night' : (locked === 'day' ? '☀️ Day' : '🔄 Auto');
      }
      this.controls.showToast(locked === 'night' ? '🌌 Switched to Bioluminescent Night' : '☀️ Switched to Diurnal Light');
    });

    // Camera follow
    this.inspector.onFollow = (org) => {
      this.camera.follow(org);
      this.controls.showToast(`🎯 Tracking Organism #${org.id}`);
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
      this.controls.showToast('🧬 Organism cloned and mutated!');
    };

    // Kill
    this.inspector.onKill = (org) => {
      org.isDead = true;
      this.renderer.selectedOrganism = null;
      this.controls.showToast('💀 Organism terminated.');
    };

    // Export DNA
    this.inspector.onExport = (dnaString) => {
      this.achievements.unlock('dna_globetrotter');
      navigator.clipboard.writeText(dnaString).then(() => {
        this.controls.showToast('📋 DNA string copied to clipboard!');
      }).catch(() => {
        prompt('Copy DNA string below:', dnaString);
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
      const modal = document.getElementById('trophies-modal');
      if (modal) modal.style.display = 'none';
    });

    // Cladogram Lineage modal
    document.getElementById('btn-close-lineage')?.addEventListener('click', () => {
      const modal = document.getElementById('lineage-modal');
      if (modal) modal.style.display = 'none';
    });

    // Snapshot Exporter
    document.getElementById('btn-snapshot')?.addEventListener('click', () => {
      SnapshotExporter.capture(this.canvas, this.world, (msg) => this.controls.showToast(msg));
    });

    // Scientific Guide modal
    document.getElementById('btn-help')?.addEventListener('click', () => {
      const modal = document.getElementById('guide-modal');
      if (modal) modal.style.display = 'flex';
    });

    document.getElementById('btn-close-guide')?.addEventListener('click', () => {
      const modal = document.getElementById('guide-modal');
      if (modal) modal.style.display = 'none';
    });

    // Evolution Trends drawer toggle
    document.getElementById('btn-toggle-trends')?.addEventListener('click', (e) => {
      const drawer = document.getElementById('trends-drawer');
      if (drawer) {
        drawer.classList.toggle('open');
        e.currentTarget.classList.toggle('active');
      }
    });

    // Ecosystem Save / Load & Season cycle (delegated via Controls callbacks)
    this.controls.onSeasonCycle = () => {
      const mode = this.seasons.cycleLock();
      this.updateSeasonButton();
      this.controls.showToast(mode === 'auto' ? '🌦️ Seasons: Auto Cycle' : `📅 Season locked: ${mode}`);
    };

    this.controls.onSave = () => this.saveEcosystem();
    this.controls.onLoad = () => this.loadEcosystem();

    // Mobile Tools Menu Toggle
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const topActions = document.getElementById('top-actions');
    btnMobileMenu?.addEventListener('click', () => {
      topActions?.classList.toggle('mobile-open');
    });

    // Close mobile menu when an action is selected
    topActions?.querySelectorAll('button, select').forEach((el) => {
      el.addEventListener('click', () => {
        if (window.innerWidth <= 840) {
          topActions.classList.remove('mobile-open');
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
        btnToggleToolbar.innerText = isMin ? '▲ Controls' : '▼ Hide';
      }
    });
  }

  setupHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

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

  updateSeasonButton() {
    const btn = document.getElementById('btn-season');
    if (!btn) return;
    const season = this.seasons.getSeason();
    const icons = { spring: '🌱', summer: '☀️', autumn: '🍂', winter: '❄️' };
    btn.innerText = `${icons[season]} ${season[0].toUpperCase() + season.slice(1)}${this.seasons.isLocked ? ' 🔒' : ''}`;
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
        ? '<span class="badge badge-carnivore">🥩</span>'
        : (s.diet < -0.2 ? '<span class="badge badge-herbivore">🌿</span>' : '<span class="badge badge-omnivore">🌾</span>');
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
      this.controls.showToast('💾 Ecosystem saved to browser storage!');
    } catch (e) {
      this.controls.showToast('⚠️ Save failed: storage full or unavailable.');
      console.warn('Save failed:', e);
    }
  }

  loadEcosystem() {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) {
        this.controls.showToast('📂 No saved ecosystem found.');
        return;
      }
      if (this.world.loadState(JSON.parse(raw))) {
        this.renderer.selectedOrganism = null;
        this.inspector.deselect();
        this.camera.target = null;
        this.updateSeasonButton();
        this.controls.showToast('📂 Ecosystem restored from save!');
      } else {
        this.controls.showToast('⚠️ Save data is corrupted.');
      }
    } catch (e) {
      this.controls.showToast('⚠️ Load failed: save data unreadable.');
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

    modal.style.display = 'flex';
  }

  loop(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    const stats = this.world.getStats(this.currentFps);

    // Track FPS
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
      this.controls.updateStats(stats);
      this.achievements.checkMilestones(this.world);
      this.records.update(this.world, currentTime);
    }

    // Record population history in chart
    this.chart.record(stats, currentTime);

    // 1. Simulation Step & Circadian Cycle
    this.world.update(dt);
    this.godBrush.update(dt);
    this.dayNight.update(dt);

    // Seasons drive vegetation growth & metabolism multipliers
    this.seasons.update(dt);
    const seasonMult = this.seasons.getMultipliers();
    this.world.foodRateMultiplier = seasonMult.food;
    this.world.metabolismMultiplier = seasonMult.metabolism;
    if (!this.seasons.isLocked) this.updateSeasonButton();

    // Species auto-classification (throttled internally)
    this.species.update(this.world, currentTime);

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

    // Update Day/Night HUD text if in auto mode
    if (!this.dayNight.isLocked) {
      const phase = this.dayNight.getPhase();
      const btn = document.getElementById('btn-day-night');
      if (btn) {
        btn.innerText = phase === 'night' ? '🌙 Night' : (phase === 'dusk' ? '🌆 Dusk' : (phase === 'dawn' ? '🌅 Dawn' : '☀️ Day'));
      }
    }

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
