/**
 * Biosphera - Microscope & Neural Inspector
 */

const INPUT_LABELS = [
  'Food D', 'Food ∠', 'Org D', 'Org ∠', 'Role',
  'Hazard', 'Energy', 'Bias', 'Scent', 'Age', 'Ready', 'Mem 1', 'Mem 2', 'Kin'
];
const OUTPUT_LABELS = ['Steer', 'Thrust', 'Bite', 'Split'];

export class Inspector {
  constructor(containerId) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Inspector element #${containerId} not found`);
    this.container = el;

    this.container.innerHTML = `
      <div class="inspector-header">
        <h3><svg class="icon icon-sm" aria-hidden="true"><use href="#i-eye"/></svg> Microscope Inspector</h3>
        <button id="close-inspector" class="btn-icon" aria-label="Close inspector"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-x"/></svg></button>
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
    this.onCloneToLab = null;
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
      ? '<span class="badge badge-herbivore"><i class="dot dot-herb"></i>Herbivore</span>'
      : (org.dna.diet > 0.2
        ? '<span class="badge badge-carnivore"><i class="dot dot-carn"></i>Carnivore</span>'
        : '<span class="badge badge-omnivore"><i class="dot dot-omni"></i>Omnivore</span>');

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
        <label>Species / Lineage</label>
        <span class="stat-val">${org.speciesName ? `<em>${org.speciesName}</em>, ` : ''}${org.parentId ? `Descendant of #${org.parentId}` : 'Genesis Ancestor (Generation 1)'}</span>
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
      <button id="btn-arena" class="btn btn-secondary btn-sm" style="grid-column: span 2;"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-zap"/></svg>Arena Benchmark</button>
      <button id="btn-follow" class="btn btn-secondary btn-sm"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-target"/></svg>Follow</button>
      <button id="btn-clone" class="btn btn-secondary btn-sm"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-dna"/></svg>Clone</button>
      <button id="btn-clone-lab" class="btn btn-secondary btn-sm"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-flask"/></svg>Clone to Lab</button>
      <button id="btn-specimen-card" class="btn btn-secondary btn-sm"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-camera"/></svg>Specimen Card</button>
      <button id="btn-export" class="btn btn-primary btn-sm"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-upload"/></svg>Export DNA</button>
      <button id="btn-kill" class="btn btn-danger btn-sm"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-x"/></svg>Terminate</button>
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

    document.getElementById('btn-clone-lab')?.addEventListener('click', () => {
      this.onCloneToLab?.(org);
    });

    document.getElementById('btn-specimen-card')?.addEventListener('click', () => {
      this.exportSpecimenCard(org);
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

  /** Export a crisp PNG trading card for the inspected specimen. */
  exportSpecimenCard(org) {
    const w = 440;
    const h = 580;
    const dpr = 2;
    const card = document.createElement('canvas');
    card.width = w * dpr;
    card.height = h * dpr;
    const ctx = card.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Card background & border
    ctx.fillStyle = '#050d14';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0c1a24';
    ctx.fillRect(14, 14, w - 28, h - 28);
    ctx.strokeStyle = 'rgba(63, 224, 208, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, w - 28, h - 28);

    // Header
    ctx.fillStyle = '#3fe0d0';
    ctx.font = 'bold 11px ui-monospace, Consolas, monospace';
    ctx.fillText('BIOSPHERA SPECIMEN CARD', 28, 38);
    ctx.fillStyle = '#8fa9b3';
    ctx.textAlign = 'right';
    ctx.fillText(`#${org.id} · GEN ${org.generation}`, w - 28, 38);
    ctx.textAlign = 'left';

    // Portrait well
    ctx.fillStyle = '#02060d';
    ctx.fillRect(28, 52, w - 56, 200);
    ctx.strokeStyle = 'rgba(220, 236, 242, 0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 52, w - 56, 200);

    // Draw organism portrait
    const cx = w * 0.5;
    const cy = 152;
    const scale = 3.2;
    const r = Math.min(48, (org.dna.size || 12) * scale);
    const hue = org.dna.colorHue ?? 175;
    ctx.save();
    ctx.translate(cx, cy);
    // Vision cone
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 88, -(org.dna.sensorFov || 2.4) * 0.5, (org.dna.sensorFov || 2.4) * 0.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(63, 224, 208, 0.1)';
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, 0);
    ctx.quadraticCurveTo(-r * 1.4, -r * 0.5, -r * 1.9, 0);
    ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.75)`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 78%, 52%)`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 236, 242, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Eyes
    ctx.fillStyle = '#02060d';
    ctx.beginPath();
    ctx.arc(r * 0.55, -r * 0.35, 3.5, 0, Math.PI * 2);
    ctx.arc(r * 0.55, r * 0.35, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Species & Diet
    const dietText = org.dna.diet < -0.2 ? 'Herbivore' : (org.dna.diet > 0.2 ? 'Carnivore' : 'Omnivore');
    const dietColor = org.dna.diet < -0.2 ? '#34d399' : (org.dna.diet > 0.2 ? '#fb7185' : '#fbbf24');
    ctx.fillStyle = '#dcecf2';
    ctx.font = 'italic bold 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(org.speciesName || `Lineage #${org.id}`, 28, 282);
    ctx.fillStyle = dietColor;
    ctx.font = 'bold 12px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(dietText.toUpperCase(), w - 28, 282);
    ctx.textAlign = 'left';

    // Stats rows
    const rows = [
      ['Size / Mass', `${org.dna.size.toFixed(1)} px`],
      ['Top Speed', `${org.dna.speed.toFixed(1)}x`],
      ['Vision Cone', `${Math.round(org.dna.sensorRange)}px @ ${Math.round((org.dna.sensorFov * 180) / Math.PI)}°`],
      ['Age / Offspring', `${Math.round(org.age)}s / ${org.childrenCount}`],
      ['Jaw / Armor', `${(org.dna.jawPower ?? 0.5).toFixed(2)} / ${(org.dna.armor ?? 0).toFixed(2)}`],
      ['Fins / Fat Res.', `${org.dna.finCount ?? 2} / ${(org.dna.fatReserve ?? 0.5).toFixed(2)}`]
    ];

    let y = 312;
    for (const [label, val] of rows) {
      ctx.fillStyle = '#0a1620';
      ctx.fillRect(28, y, w - 56, 32);
      ctx.strokeStyle = 'rgba(220, 236, 242, 0.08)';
      ctx.strokeRect(28, y, w - 56, 32);
      ctx.fillStyle = '#8fa9b3';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(label, 40, y + 20);
      ctx.fillStyle = '#dcecf2';
      ctx.font = '12px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val, w - 40, y + 20);
      ctx.textAlign = 'left';
      y += 38;
    }

    // Footer
    ctx.fillStyle = 'rgba(143, 169, 179, 0.7)';
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.fillText(`Exported ${new Date().toISOString().slice(0, 10)}`, 28, h - 28);

    const link = document.createElement('a');
    link.download = `biosphera-specimen-${org.id}.png`;
    link.href = card.toDataURL('image/png');
    link.click();
  }

  drawNeuralNet(org) {
    const ctx = this.netCtx;
    const rect = this.netCanvas.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect.width || 280));
    const h = Math.max(100, Math.round(rect.height || 156));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (this.netCanvas.width !== targetW || this.netCanvas.height !== targetH) {
      this.netCanvas.width = targetW;
      this.netCanvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const brain = org.dna.brain;
    const layerSizes = [brain.topology.inputs, ...brain.topology.hiddens, brain.topology.outputs];
    const layerCount = layerSizes.length;
    const leftPad = 48;
    const rightPad = 44;
    const topPad = 10;
    const bottomPad = 10;

    const nodePositions = [];

    for (let l = 0; l < layerCount; l++) {
      const count = layerSizes[l];
      const x = leftPad + (l / (layerCount - 1)) * (w - leftPad - rightPad);
      const layerNodes = [];

      for (let n = 0; n < count; n++) {
        const y = topPad + ((n + 0.5) / count) * (h - topPad - bottomPad);
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
            ? `rgba(63, 224, 208, ${alpha})`
            : `rgba(251, 113, 133, ${alpha})`;
          ctx.lineWidth = Math.min(2.5, Math.max(0.5, Math.abs(weight)));
          ctx.stroke();
        }
      }
    }

    // Nodes & I/O Labels
    ctx.font = '9px ui-monospace, Consolas, monospace';
    ctx.textBaseline = 'middle';

    for (let l = 0; l < layerCount; l++) {
      const activations = brain.layerActivations[l];
      const nodes = nodePositions[l];
      const isInput = l === 0;
      const isOutput = l === layerCount - 1;

      for (let n = 0; n < nodes.length; n++) {
        const node = nodes[n];
        const act = activations[n] || 0;

        ctx.beginPath();
        ctx.arc(node.x, node.y, nodes.length > 9 ? 3.8 : 4.5, 0, Math.PI * 2);

        if (act > 0) {
          ctx.fillStyle = `rgba(63, 224, 208, ${0.3 + act * 0.7})`;
        } else {
          ctx.fillStyle = `rgba(251, 113, 133, ${0.3 + Math.abs(act) * 0.7})`;
        }
        ctx.fill();

        ctx.strokeStyle = 'rgba(220, 236, 242, 0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (isInput && INPUT_LABELS[n]) {
          ctx.fillStyle = 'rgba(143, 169, 179, 0.85)';
          ctx.textAlign = 'right';
          ctx.fillText(INPUT_LABELS[n], node.x - 8, node.y);
        } else if (isOutput && OUTPUT_LABELS[n]) {
          ctx.fillStyle = 'rgba(220, 236, 242, 0.9)';
          ctx.textAlign = 'left';
          ctx.fillText(OUTPUT_LABELS[n], node.x + 8, node.y);
        }
      }
    }
  }
}
