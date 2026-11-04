/**
 * Biosphera - Social Snapshot & High-Resolution Poster Exporter
 * Captures the current biosphere canvas with clean metadata badges for sharing.
 */

export class SnapshotExporter {
  static capture(sourceCanvas, world, showToastCallback) {
    if (!sourceCanvas) return;

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = sourceCanvas.width;
      exportCanvas.height = sourceCanvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      // Draw the main simulation frame
      ctx.drawImage(sourceCanvas, 0, 0);

      // The source canvas is device-pixel sized (DPR scaling), so scale the
      // overlay by the same factor or the badges render at half CSS size on HiDPI.
      const cssWidth = sourceCanvas.getBoundingClientRect().width || sourceCanvas.width;
      const scale = sourceCanvas.width / cssWidth;

      // Watermark metadata bar
      const barHeight = 44 * scale;
      const barY = exportCanvas.height - barHeight - 16 * scale;
      const barWidth = Math.min(480 * scale, exportCanvas.width - 32 * scale);
      const barX = 16 * scale;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1 * scale;

      // Rounded rectangle (roundRect needs Chrome 99+/Safari 16+; arcTo covers the rest)
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(barX, barY, barWidth, barHeight, 8 * scale);
      } else {
        const r = 8 * scale;
        ctx.moveTo(barX + r, barY);
        ctx.arcTo(barX + barWidth, barY, barX + barWidth, barY + barHeight, r);
        ctx.arcTo(barX + barWidth, barY + barHeight, barX, barY + barHeight, r);
        ctx.arcTo(barX, barY + barHeight, barX, barY, r);
        ctx.arcTo(barX, barY, barX + barWidth, barY, r);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();

      // Text metadata
      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${13 * scale}px system-ui, sans-serif`;
      ctx.fillText(`🧬 Biosphera  •  Gen ${world.maxGeneration}  •  Pop ${world.organisms.length}`, barX + 16 * scale, barY + 20 * scale);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `${11 * scale}px monospace`;
      ctx.fillText('github.com/mohsen-niksirat/Biosphera', barX + 16 * scale, barY + 36 * scale);
      ctx.restore();

      // Trigger PNG download
      const dataUrl = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `biosphera-gen${world.maxGeneration}-${Date.now().toString().slice(-4)}.png`;
      link.href = dataUrl;
      link.click();

      showToastCallback?.('📸 Ecosystem snapshot saved to downloads!');
    } catch (e) {
      console.error('Failed to capture snapshot:', e);
      showToastCallback?.('Failed to export snapshot.');
    }
  }
}
