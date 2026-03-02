import type { CanvasConfig, Layer } from '../types';
import { gatherVisibleCells } from './exportPdf';

interface WatermarkOptions {
  config: CanvasConfig;
  layers: Layer[];
  projectName: string;
  watermarkText?: string;
  scale?: number; // pixels per stitch cell (default 4)
}

export function exportWatermarkedPreview({
  config,
  layers,
  projectName,
  watermarkText = 'PREVIEW',
  scale = 4,
}: WatermarkOptions) {
  const cells = gatherVisibleCells(layers);
  const w = config.width * scale;
  const h = config.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Draw cells
  for (const [key, cell] of Object.entries(cells)) {
    if (!cell.color) continue;
    const [r, c] = key.split(',').map(Number);
    ctx.fillStyle = cell.color;
    ctx.fillRect(c * scale, r * scale, scale, scale);
  }

  // Draw watermark
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 4);

  const fontSize = Math.max(24, Math.min(w, h) * 0.08);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Tile watermark text across the image
  const textWidth = ctx.measureText(watermarkText).width;
  const spacingX = textWidth + fontSize * 2;
  const spacingY = fontSize * 3;
  const diagonal = Math.sqrt(w * w + h * h);
  const repeatsX = Math.ceil(diagonal / spacingX) + 1;
  const repeatsY = Math.ceil(diagonal / spacingY) + 1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let iy = -repeatsY; iy <= repeatsY; iy++) {
    for (let ix = -repeatsX; ix <= repeatsX; ix++) {
      ctx.fillText(watermarkText, ix * spacingX, iy * spacingY);
    }
  }
  ctx.restore();

  // Download
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'needlepoint'}-preview.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
