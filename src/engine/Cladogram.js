/**
 * Biosphera - Phylogenetic Tree & Evolutionary Cladogram
 * Reconstructs and visualizes the branching genealogy of living species in the ecosystem.
 */

export class Cladogram {
  constructor(canvasId, onSelectOrganism) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.onSelect = onSelectOrganism;
    this.nodes = []; // { id, parentId, gen, hue, diet, count, orgRef, x, y }

    this.bindCanvasEvents();
  }

  bindCanvasEvents() {
    if (!this.canvas) return;

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      // The canvas is CSS-scaled to container width — map click into canvas coordinates
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      for (const node of this.nodes) {
        const dist = Math.hypot(node.x - clickX, node.y - clickY);
        if (dist <= 12) {
          if (node.orgRef && !node.orgRef.isDead) {
            this.onSelect?.(node.orgRef);
            const modal = document.getElementById('lineage-modal');
            if (modal) modal.style.display = 'none';
          }
          break;
        }
      }
    });
  }

  rebuildTree(world) {
    if (!this.canvas || !this.ctx) return;

    // Group living organisms by lineage / lineage clusters
    const living = world.organisms;
    if (living.length === 0) return;

    // Build unique species clusters based on color hue & generation
    const lineageMap = new Map();

    for (const org of living) {
      const clusterKey = `${Math.round(org.dna.colorHue / 30) * 30}-${org.generation}`;
      let cluster = lineageMap.get(clusterKey);
      if (!cluster) {
        cluster = {
          id: org.id,
          parentId: org.parentId,
          gen: org.generation,
          hue: org.dna.colorHue,
          diet: org.dna.diet,
          count: 0,
          orgRef: org
        };
        lineageMap.set(clusterKey, cluster);
      }
      cluster.count++;
    }

    const clusters = Array.from(lineageMap.values());
    clusters.sort((a, b) => a.gen - b.gen);

    // Layout nodes into generational columns
    const w = this.canvas.width;
    const h = this.canvas.height;
    const maxGen = Math.max(1, world.maxGeneration);
    const minGen = Math.max(1, maxGen - 8); // Show recent 8 generations

    const genBuckets = new Map();
    for (const c of clusters) {
      const g = Math.max(minGen, Math.min(maxGen, c.gen));
      if (!genBuckets.has(g)) genBuckets.set(g, []);
      genBuckets.get(g).push(c);
    }

    const positioned = [];
    const span = Math.max(1, maxGen - minGen);

    genBuckets.forEach((list, gen) => {
      const colX = 50 + ((gen - minGen) / span) * (w - 100);
      const totalInCol = list.length;

      for (let i = 0; i < totalInCol; i++) {
        const rowY = 40 + ((i + 0.5) / totalInCol) * (h - 80);
        list[i].x = colX;
        list[i].y = rowY;
        positioned.push(list[i]);
      }
    });

    this.nodes = positioned;
    this.render(minGen, maxGen);
  }

  render(minGen, maxGen) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background grid & labels
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Ancestral Lineage (Generations ${minGen} ⟷ ${maxGen})`, 20, 24);

    // Draw branch connecting lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.2;

    for (const node of this.nodes) {
      if (node.parentId) {
        // Link to the direct parent cluster if it is present among the living;
        // otherwise fall back to the closest-hue node in the nearest earlier generation.
        let parent = this.nodes.find(n => n.id === node.parentId);
        if (!parent) {
          let bestDist = Infinity;
          for (const n of this.nodes) {
            if (n.gen >= node.gen) continue;
            const hueDist = Math.min(
              Math.abs(n.hue - node.hue),
              360 - Math.abs(n.hue - node.hue)
            );
            const genGap = node.gen - n.gen;
            const score = hueDist + genGap * 6;
            if (score < bestDist) {
              bestDist = score;
              parent = n;
            }
          }
        }
        if (parent) {
          ctx.beginPath();
          ctx.moveTo(parent.x, parent.y);
          ctx.bezierCurveTo(
            parent.x + 30, parent.y,
            node.x - 30, node.y,
            node.x, node.y
          );
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const node of this.nodes) {
      const radius = Math.min(14, 5 + node.count * 1.5);

      // Node shadow
      ctx.shadowColor = `hsl(${node.hue}, 80%, 60%)`;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${node.hue}, 75%, 55%)`;
      ctx.fill();

      ctx.shadowBlur = 0; // reset

      ctx.strokeStyle = node.diet > 0.2 ? '#f43f5e' : (node.diet < -0.2 ? '#10b981' : '#facc15');
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Population count label
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.count.toString(), node.x, node.y);
    }
  }
}
