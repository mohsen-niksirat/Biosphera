/**
 * Biosphera - World Minimap
 * A whole-biome overview with the current viewport rectangle. Click or drag
 * on the map to move the camera; it renders at ~10 fps to stay off the
 * simulation's frame budget.
 */

export class Minimap {
  constructor(canvasId, world, camera, viewportCanvas, panelId) {
    this.canvas = document.getElementById(canvasId);
    this.panel = panelId ? document.getElementById(panelId) : null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.world = world;
    this.camera = camera;
    this.viewportCanvas = viewportCanvas;
    this.lastRender = 0;
    this.isDragging = false;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.canvas) return;

    const jump = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      this.centerOn(px * this.world.width, py * this.world.height);
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.canvas.setPointerCapture?.(e.pointerId);
      jump(e);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      jump(e);
    });

    const end = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.canvas.releasePointerCapture?.(e.pointerId);
    };

    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
  }

  centerOn(worldX, worldY) {
    const zoom = this.camera.zoom;
    const viewW = (this.viewportCanvas.clientWidth || this.viewportCanvas.width) / zoom;
    const viewH = (this.viewportCanvas.clientHeight || this.viewportCanvas.height) / zoom;
    this.camera.target = null;
    this.camera.x = worldX - viewW * 0.5;
    this.camera.y = worldY - viewH * 0.5;
    // Render immediately so the map feels responsive while dragging
    this.render(performance.now() + 1000);
  }

  toggle() {
    if (!this.panel) return false;
    const open = this.panel.classList.toggle('open');
    if (open) this.render(performance.now() + 1000);
    return open;
  }

  render(now) {
    if (!this.ctx || !this.canvas || !this.panel?.classList.contains('open')) return;
    if (now - this.lastRender < 100) return;
    this.lastRender = now;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const sx = w / this.world.width;
    const sy = h / this.world.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#02060d';
    ctx.fillRect(0, 0, w, h);

    // Vegetation as a soft green dust
    ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
    for (let i = 0; i < this.world.foods.length; i++) {
      const f = this.world.foods[i];
      if (f.type !== 'plant') continue;
      ctx.fillRect(f.x * sx - 0.5, f.y * sy - 0.5, 1, 1);
    }

    // Meat pellets
    ctx.fillStyle = 'rgba(251, 113, 133, 0.75)';
    for (let i = 0; i < this.world.foods.length; i++) {
      const f = this.world.foods[i];
      if (f.type !== 'meat') continue;
      ctx.fillRect(f.x * sx - 1, f.y * sy - 1, 2, 2);
    }

    // Toxic vents
    for (let i = 0; i < this.world.hazards.length; i++) {
      const hz = this.world.hazards[i];
      ctx.beginPath();
      ctx.arc(hz.x * sx, hz.y * sy, Math.max(2, hz.radius * sx), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 113, 133, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Living organisms, colored by genome hue
    for (let i = 0; i < this.world.organisms.length; i++) {
      const org = this.world.organisms[i];
      ctx.fillStyle = `hsl(${org.dna.colorHue}, 75%, 62%)`;
      const r = org.radius > 16 ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.arc(org.x * sx, org.y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Viewport rectangle (clamped so an off-world camera stays legible)
    const zoom = this.camera.zoom;
    const viewW = Math.min(this.world.width, (this.viewportCanvas.clientWidth || this.viewportCanvas.width) / zoom);
    const viewH = Math.min(this.world.height, (this.viewportCanvas.clientHeight || this.viewportCanvas.height) / zoom);
    const vx = Math.max(0, Math.min(this.world.width - viewW, this.camera.x));
    const vy = Math.max(0, Math.min(this.world.height - viewH, this.camera.y));

    ctx.strokeStyle = '#3fe0d0';
    ctx.lineWidth = 2;
    ctx.strokeRect(vx * sx + 1, vy * sy + 1, Math.max(6, viewW * sx - 2), Math.max(6, viewH * sy - 2));

    // Frame
    ctx.strokeStyle = 'rgba(220, 236, 242, 0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }
}
