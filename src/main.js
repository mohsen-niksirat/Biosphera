/**
 * Biosphera - Main Application Entrypoint
 * Orchestrates simulation, WebAudio, population dynamics, Gene Lab, and Evolutionary Achievements.
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

class BiospheraApp {
  constructor() {
    this.canvas = document.getElementById('sim-canvas');
    if (!this.canvas) throw new Error('Could not find #sim-canvas');

    // 1. Audio Engine & Charts
    this.soundEngine = new SoundEngine();
    this.chart = new PopulationChart('chart-canvas', 160);
    this.achievements = new AchievementsEngine();

    // 2. World & Camera
    this.world = new World(2400, 1800);
    this.camera = new Camera(this.world.width * 0.5 - 400, this.world.height * 0.5 - 300, 0.75);
    this.renderer = new Renderer(this.canvas, this.camera);

    // 3. UI Modules
    this.inspector = new Inspector('inspector-panel');
    this.controls = new Controls(this.world, this.soundEngine);

    // 4. Gene Lab
    this.geneLab = new GeneLab('genelab-modal', (engineeredDNA) => {
      const centerWorld = this.camera.screenToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5);
      const injected = this.world.spawnOrganismAt(centerWorld.x, centerWorld.y, engineeredDNA);
      this.renderer.selectedOrganism = injected;
      this.inspector.inspect(injected);
      this.camera.follow(injected);
      this.achievements.unlock('bio_engineer');
      this.controls.showToast('🧬 Injected custom engineered lifeform!');
    });

    // 5. Hook Achievements Unlocked
    this.achievements.onUnlock = (trophy) => {
      this.soundEngine.playBirth();
      this.controls.showToast(`🏆 Milestone Unlocked: ${trophy.icon} ${trophy.title}`);
      this.updateTrophyBadge();
    };

    // 6. Hook world sound events
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

    this.resizeCanvas();
    this.setupEventListeners();
    this.setupUIBindings();
    this.setupPWA();
    this.updateTrophyBadge();

    requestAnimationFrame((t) => this.loop(t));
  }

  setupPWA() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  resizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = (window.innerHeight - 64) * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight - 64}px`;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

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
      if (this.isDragging) {
        const movedDist = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
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
  }

  handleCanvasClick(clientX, clientY) {
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
    // Camera follow
    this.inspector.onFollow = (org) => {
      this.camera.follow(org);
      this.controls.showToast(`🎯 Tracking Organism #${org.id}`);
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
  }

  updateTrophyBadge() {
    const badge = document.getElementById('trophy-count');
    if (badge) {
      badge.innerText = `${this.achievements.getUnlockedCount()}/${this.achievements.trophies.length}`;
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
    }

    // Record population history in chart
    this.chart.record(stats, currentTime);

    // 1. Simulation Step
    this.world.update(dt);

    // 2. Camera tracking
    this.camera.update(this.canvas.width, this.canvas.height);

    // 3. Render Viewport
    this.renderer.render(this.world);

    // 4. Update Microscope Inspector
    this.inspector.update();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new BiospheraApp();
});
