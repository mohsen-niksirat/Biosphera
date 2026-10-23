/**
 * Biosphera - Microscope & Neural Inspector
 */

export class Inspector {
  constructor(containerId) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Inspector element #${containerId} not found`);
    this.container = el;

    this.container.innerHTML = `
      <div class="inspector-header">
        <h3>🔬 Microscope Inspector</h3>
        <button id="close-inspector" class="btn-icon">&times;</button>
      </div>
      <div class="empty-state" id="inspector-empty">Click any swimming organism to inspect its brain & DNA</div>
      <div class="inspector-body" id="inspector-content" style="display: none;">
        <div class="canvas-wrapper">
          <canvas id="neural-canvas" width="280" height="180"></canvas>
          <div class="neural-labels">
            <span>Sensors (Inputs)</span>
            <span>Hidden</span>
            <span>Actuators (Actions)</span>
          </div>
        </div>
        <div id="inspector-stats" class="stats-grid"></div>
        <div id="inspector-actions" class="actions-row"></div>
      </div>
    `;

    this.netCanvas = document.getElementById('neural-canvas');
    this.netCtx = this.netCanvas.getContext('2d');
    this.statsContainer = document.getElementById('inspector-stats');
    this.actionsContainer = document.getElementById('inspector-actions');
    this.currentOrganism = null;

    this.onFollow = null;
    this.onClone = null;
    this.onKill = null;
    this.onExport = null;
    this.onArenaTrial = null;

    document.getElementById('close-inspector')?.addEventListener('click', () => {
      this.deselect();
    });

    // Start hidden until user clicks an organism
    this.container.style.display = 'none';
  }

  inspect(org) {
    this.currentOrganism = org;
    const emptyState = document.getElementById('inspector-empty');
    const content = document.getElementById('inspector-content');

    if (!org || org.isDead) {
      this.container.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (content) content.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (content) content.style.display = 'block';

    this.renderStats(org);
    this.renderActions(org);
  }

  deselect() {
    this.inspect(null);
  }

  update() {
    if (!this.currentOrganism || this.currentOrganism.isDead) {
      if (this.currentOrganism?.isDead) {
        this.inspect(null);
      }
      return;
    }

    this.drawNeuralNet(this.currentOrganism);
    this.updateLiveStats(this.currentOrganism);
  }

  renderStats(org) {
    const dietLabel = org.dna.diet < -0.2
      ? '<span class="badge badge-herbivore">🌿 Herbivore</span>'
      : (org.dna.diet > 0.2
        ? '<span class="badge badge-carnivore">🥩 Carnivore</span>'
        : '<span class="badge badge-omnivore">🌾 Omnivore</span>');

    this.statsContainer.innerHTML = `
      <div class="stat-item">
        <label>Classification</label>
        <div>${dietLabel}</div>
      </div>
      <div class="stat-item">
        <label>Generation</label>
        <span class="stat-val">Gen ${org.generation}</span>
      </div>
      <div class="stat-item">
        <label>Energy</label>
        <div class="progress-bar">
          <div id="energy-bar" class="progress-fill" style="width: ${Math.min(100, Math.max(0, (org.energy / org.dna.reproduceThreshold) * 100))}%"></div>
        </div>
      </div>
      <div class="stat-item">
        <label>Age / Offspring</label>
        <span class="stat-val" id="stat-age-children">${Math.round(org.age)}s / ${org.childrenCount} children</span>
      </div>
      <div class="stat-item">
        <label>Speed / Size</label>
        <span class="stat-val">${org.dna.speed.toFixed(1)}x / ${org.dna.size.toFixed(1)}px</span>
      </div>
      <div class="stat-item">
        <label>Vision Cone</label>
        <span class="stat-val">${Math.round(org.dna.sensorRange)}px @ ${(org.dna.sensorFov * 180 / Math.PI).toFixed(0)}°</span>
      </div>
      <div class="stat-item" style="grid-column: span 2;">
        <label>Lineage / Origin</label>
        <span class="stat-val text-muted">${org.parentId ? `Descendant of #${org.parentId}` : '✨ Genesis Ancestor (Generation 1)'}</span>
      </div>
    `;
  }

  updateLiveStats(org) {
    const energyBar = document.getElementById('energy-bar');
    if (energyBar) {
      const pct = Math.min(100, Math.max(0, (org.energy / org.dna.reproduceThreshold) * 100));
      energyBar.style.width = `${pct}%`;
    }

    const ageChild = document.getElementById('stat-age-children');
    if (ageChild) {
      ageChild.innerText = `${Math.round(org.age)}s / ${org.childrenCount} children`;
    }
  }

  renderActions(org) {
    this.actionsContainer.innerHTML = `
      <button id="btn-arena" class="btn btn-secondary btn-sm" style="grid-column: span 2; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">⚔️ Arena Benchmark Trial</button>
      <button id="btn-follow" class="btn btn-secondary btn-sm">🎯 Follow</button>
      <button id="btn-clone" class="btn btn-secondary btn-sm">🧬 Clone</button>
      <button id="btn-export" class="btn btn-primary btn-sm">📤 Export DNA</button>
      <button id="btn-kill" class="btn btn-danger btn-sm">💀 Terminate</button>
    `;

    document.getElementById('btn-arena')?.addEventListener('click', () => {
      this.onArenaTrial?.(org);
    });

    document.getElementById('btn-follow')?.addEventListener('click', () => {
      this.onFollow?.(org);
    });

    document.getElementById('btn-clone')?.addEventListener('click', () => {
      this.onClone?.(org);
    });

    document.getElementById('btn-export')?.addEventListener('click', () => {
      const dnaStr = org.dna.serialize();
      this.onExport?.(dnaStr);
    });

    document.getElementById('btn-kill')?.addEventListener('click', () => {
      this.onKill?.(org);
      this.deselect();
    });
  }

  drawNeuralNet(org) {
    const ctx = this.netCtx;
    const w = this.netCanvas.width;
    const h = this.netCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const brain = org.dna.brain;
    const layerSizes = [brain.topology.inputs, ...brain.topology.hiddens, brain.topology.outputs];
    const layerCount = layerSizes.length;

    const nodePositions = [];

    for (let l = 0; l < layerCount; l++) {
      const count = layerSizes[l];
      const x = 30 + (l / (layerCount - 1)) * (w - 60);
      const layerNodes = [];

      for (let n = 0; n < count; n++) {
        const y = 20 + ((n + 0.5) / count) * (h - 40);
        layerNodes.push({ x, y });
      }
      nodePositions.push(layerNodes);
    }

    // Synapses
    for (let l = 0; l < brain.weights.length; l++) {
      const layerWeights = brain.weights[l];
      const fromNodes = nodePositions[l];
      const toNodes = nodePositions[l + 1];

      for (let to = 0; to < layerWeights.length; to++) {
        const neuronWeights = layerWeights[to];
        const dest = toNodes[to];

        for (let from = 0; from < neuronWeights.length; from++) {
          const weight = neuronWeights[from];
          const src = fromNodes[from];

          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(dest.x, dest.y);

          const alpha = Math.min(0.8, Math.abs(weight) * 0.4);
          ctx.strokeStyle = weight > 0
            ? `rgba(56, 189, 248, ${alpha})`
            : `rgba(244, 63, 94, ${alpha})`;
          ctx.lineWidth = Math.min(2.5, Math.max(0.5, Math.abs(weight)));
          ctx.stroke();
        }
      }
    }

    // Nodes
    for (let l = 0; l < layerCount; l++) {
      const activations = brain.layerActivations[l];
      const nodes = nodePositions[l];

      for (let n = 0; n < nodes.length; n++) {
        const node = nodes[n];
        const act = activations[n] || 0;

        ctx.beginPath();
        ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);

        if (act > 0) {
          ctx.fillStyle = `rgba(56, 189, 248, ${0.3 + act * 0.7})`;
        } else {
          ctx.fillStyle = `rgba(244, 63, 94, ${0.3 + Math.abs(act) * 0.7})`;
        }
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}
