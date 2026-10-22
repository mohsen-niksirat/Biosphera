/**
 * Biosphera - Main Application Entrypoint
 * Glues World, Camera, Renderer, Inspector, and Controls into a seamless 60fps loop.
 */

import { World } from './engine/World';
import { Camera } from './render/Camera';
import { Renderer } from './render/Renderer';
import { Inspector } from './ui/Inspector';
import { Controls } from './ui/Controls';
import { DNA } from './genetics/DNA';

class BiospheraApp {
  private canvas: HTMLCanvasElement;
  private world: World;
  private camera: Camera;
  private renderer: Renderer;
  private inspector: Inspector;
  private controls: Controls;

  private lastTime: number;
  private frameCount: number;
  private lastFpsUpdate: number;
  private currentFps: number;

  private isDragging: boolean;
  private dragStartX: number;
  private dragStartY: number;

  constructor() {
    this.canvas = document.getElementById('sim-canvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Could not find #sim-canvas');

    // Create World (2400 x 1800 virtual playground)
    this.world = new World(2400, 1800);

    // Initial Camera centered on the world
    this.camera = new Camera(this.world.width * 0.5 - 400, this.world.height * 0.5 - 300, 0.75);

    // Renderer
    this.renderer = new Renderer(this.canvas, this.camera);

    // UI Modules
    this.inspector = new Inspector('inspector-panel');
    this.controls = new Controls(this.world);

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

    // Start simulation loop
    requestAnimationFrame((t) => this.loop(t));
  }

  private resizeCanvas(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = (window.innerHeight - 64) * dpr; // subtract top hud
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight - 64}px`;
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Mouse & Touch Pan / Zoom
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
        // Detect hovered organism
        const worldCoords = this.camera.screenToWorld(mouseX, mouseY);
        const candidates = this.world.spatialOrganisms.query(worldCoords.x, worldCoords.y, 40);
        this.renderer.hoveredOrganism = candidates.length > 0 ? candidates[0] : null;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isDragging) {
        // If movement was negligible, treat as a click to select
        const movedDist = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
        if (movedDist < 5) {
          this.handleCanvasClick(e.clientX, e.clientY);
        }
      }
      this.isDragging = false;
    });

    // Zoom on wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const screenX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const screenY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      this.camera.zoomAt(e.deltaY, screenX, screenY);
    }, { passive: false });
  }

  private handleCanvasClick(clientX: number, clientY: number): void {
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
      // Clicked on empty space: deselect
      this.renderer.selectedOrganism = null;
      this.inspector.deselect();
    }
  }

  private setupUIBindings(): void {
    // Camera follow
    this.inspector.onFollow = (org) => {
      this.camera.follow(org);
      this.controls.showToast(`🎯 Tracking Organism #${org.id}`);
    };

    // Clone organism
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
      navigator.clipboard.writeText(dnaString).then(() => {
        this.controls.showToast('📋 DNA string copied to clipboard!');
      }).catch(() => {
        prompt('Copy DNA string below:', dnaString);
      });
    };

    // Import DNA
    this.controls.onImportDNA = (dna: DNA) => {
      // Spawn at camera center
      const centerWorld = this.camera.screenToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5);
      const injected = this.world.spawnOrganismAt(centerWorld.x, centerWorld.y, dna);
      this.renderer.selectedOrganism = injected;
      this.inspector.inspect(injected);
      this.camera.follow(injected);
    };
  }

  private loop(currentTime: number): void {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // Track FPS
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
      this.controls.updateStats(this.world.getStats(this.currentFps));
    }

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

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new BiospheraApp();
});
