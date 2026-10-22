/**
 * Biosphera - Main Application Entrypoint
 */

import { World } from './engine/World.js';
import { Camera } from './render/Camera.js';
import { Renderer } from './render/Renderer.js';
import { Inspector } from './ui/Inspector.js';
import { Controls } from './ui/Controls.js';

class BiospheraApp {
  constructor() {
    this.canvas = document.getElementById('sim-canvas');
    if (!this.canvas) throw new Error('Could not find #sim-canvas');

    this.world = new World(2400, 1800);
    this.camera = new Camera(this.world.width * 0.5 - 400, this.world.height * 0.5 - 300, 0.75);
    this.renderer = new Renderer(this.canvas, this.camera);

    this.inspector = new Inspector('inspector-panel');
    this.controls = new Controls(this.world);

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

    requestAnimationFrame((t) => this.loop(t));
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
    this.inspector.onFollow = (org) => {
      this.camera.follow(org);
      this.controls.showToast(`🎯 Tracking Organism #${org.id}`);
    };

    this.inspector.onClone = (org) => {
      const childDNA = org.dna.mutate(0.04, 0.15);
      const clone = this.world.spawnOrganismAt(org.x + 20, org.y + 20, childDNA);
      this.renderer.selectedOrganism = clone;
      this.inspector.inspect(clone);
      this.controls.showToast('🧬 Organism cloned and mutated!');
    };

    this.inspector.onKill = (org) => {
      org.isDead = true;
      this.renderer.selectedOrganism = null;
      this.controls.showToast('💀 Organism terminated.');
    };

    this.inspector.onExport = (dnaString) => {
      navigator.clipboard.writeText(dnaString).then(() => {
        this.controls.showToast('📋 DNA string copied to clipboard!');
      }).catch(() => {
        prompt('Copy DNA string below:', dnaString);
      });
    };

    this.controls.onImportDNA = (dna) => {
      const centerWorld = this.camera.screenToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5);
      const injected = this.world.spawnOrganismAt(centerWorld.x, centerWorld.y, dna);
      this.renderer.selectedOrganism = injected;
      this.inspector.inspect(injected);
      this.camera.follow(injected);
    };
  }

  loop(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
      this.controls.updateStats(this.world.getStats(this.currentFps));
    }

    this.world.update(dt);
    this.camera.update(this.canvas.width, this.canvas.height);
    this.renderer.render(this.world);
    this.inspector.update();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new BiospheraApp();
});
