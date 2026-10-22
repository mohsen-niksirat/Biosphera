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

      // Watermark metadata bar
      const barHeight = 44;
      const barY = exportCanvas.height - barHeight - 16;
      const barWidth = Math.min(480, exportCanvas.width - 32);
      const barX = 16;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1;

      // Rounded rectangle
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, 8);
      ctx.fill();
      ctx.stroke();

      // Text metadata
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`🧬 Biosphera  •  Gen ${world.maxGeneration}  •  Pop ${world.organisms.length}`, barX + 16, barY + 20);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText('github.com/mohsen-niksirat/Biosphera', barX + 16, barY + 36);
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
