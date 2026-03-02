/**
 * Canvas print export — generates production-quality images for printing
 * onto physical needlepoint canvas mesh.
 *
 * Key properties of the output:
 *   - Each stitch = exactly scaleFactor × scaleFactor pixels
 *   - DPI = meshCount × scaleFactor (embedded in file metadata)
 *   - Physical dimensions match stitches ÷ meshCount
 *   - Configurable margins for canvas stretching/framing
 *   - Optional ICC color profile for accurate print colors
 *   - No anti-aliasing — crisp pixel-perfect stitch blocks
 */

import type { CanvasConfig, CanvasPrintConfig, Layer } from '../types';
import { gatherVisibleCells } from './exportPdf';
import { buildTiff } from './tiffEncoder';
import { injectPngDpi, injectPngIcc } from './pngDpi';
import { getSrgbProfileBytes } from './srgbProfile';

// ─── Types ─────────────────────────────────────────────────────────────

export interface PrintExportEstimate {
  scaleFactor: number;
  actualDpi: number;
  imageWidthPx: number;
  imageHeightPx: number;
  designWidthIn: number;
  designHeightIn: number;
  totalWidthIn: number;
  totalHeightIn: number;
  estimatedFileSizeMb: number;
  emptyCellCount: number;
}

export interface PrintExportWarning {
  level: 'info' | 'warning' | 'error';
  message: string;
}

// ─── Estimation (pure math, no rendering) ──────────────────────────────

/**
 * Calculate output dimensions and file size without rendering.
 * Used for live UI display in the export panel.
 */
export function estimatePrintExport(
  config: CanvasConfig,
  printConfig: CanvasPrintConfig,
  layers: Layer[]
): PrintExportEstimate {
  const { meshCount, scaleFactor, margins } = printConfig;
  const dpi = meshCount * scaleFactor;

  const designWidthPx = config.width * scaleFactor;
  const designHeightPx = config.height * scaleFactor;

  const marginLeftPx = Math.round(margins.left * dpi);
  const marginRightPx = Math.round(margins.right * dpi);
  const marginTopPx = Math.round(margins.top * dpi);
  const marginBottomPx = Math.round(margins.bottom * dpi);

  const totalWidthPx = designWidthPx + marginLeftPx + marginRightPx;
  const totalHeightPx = designHeightPx + marginTopPx + marginBottomPx;

  const designWidthIn = config.width / meshCount;
  const designHeightIn = config.height / meshCount;
  const totalWidthIn = totalWidthPx / dpi;
  const totalHeightIn = totalHeightPx / dpi;

  // Count empty cells
  const cells = gatherVisibleCells(layers);
  let filledCount = 0;
  for (let r = 0; r < config.height; r++) {
    for (let c = 0; c < config.width; c++) {
      if (cells[`${r},${c}`]) filledCount++;
    }
  }
  const emptyCellCount = config.width * config.height - filledCount;

  // Estimated file size: RGB = 3 bytes/pixel for TIFF (uncompressed)
  // PNG is compressed but we estimate conservatively
  const rawBytes = totalWidthPx * totalHeightPx * 3;
  const estimatedFileSizeMb = printConfig.format === 'tiff'
    ? rawBytes / (1024 * 1024)
    : rawBytes / (1024 * 1024) * 0.4; // PNG ~60% compression typical

  return {
    scaleFactor,
    actualDpi: dpi,
    imageWidthPx: totalWidthPx,
    imageHeightPx: totalHeightPx,
    designWidthIn: Math.round(designWidthIn * 100) / 100,
    designHeightIn: Math.round(designHeightIn * 100) / 100,
    totalWidthIn: Math.round(totalWidthIn * 100) / 100,
    totalHeightIn: Math.round(totalHeightIn * 100) / 100,
    estimatedFileSizeMb: Math.round(estimatedFileSizeMb * 10) / 10,
    emptyCellCount,
  };
}

/**
 * Generate validation warnings for the export configuration.
 */
export function getExportWarnings(
  estimate: PrintExportEstimate,
  printConfig: CanvasPrintConfig
): PrintExportWarning[] {
  const warnings: PrintExportWarning[] = [];

  if (estimate.totalWidthIn > 13 || estimate.totalHeightIn > 13) {
    warnings.push({
      level: 'warning',
      message: `Print size ${estimate.totalWidthIn}" × ${estimate.totalHeightIn}" exceeds typical home printer width (13"). Verify your printer supports this size.`,
    });
  }

  if (estimate.estimatedFileSizeMb > 100) {
    warnings.push({
      level: 'warning',
      message: `Estimated file size ~${estimate.estimatedFileSizeMb} MB. Export may take a moment.`,
    });
  }

  if (estimate.emptyCellCount > 0) {
    warnings.push({
      level: 'info',
      message: `${estimate.emptyCellCount} cells have no color — will appear as bare canvas (white).`,
    });
  }

  if (printConfig.format === 'tiff' && estimate.estimatedFileSizeMb > 500) {
    warnings.push({
      level: 'error',
      message: `File would exceed 500 MB. Consider reducing scale factor or using PNG format.`,
    });
  }

  return warnings;
}

// ─── Main export function ──────────────────────────────────────────────

/**
 * Render and download a production print file (TIFF or PNG with DPI metadata).
 *
 * Uses an offscreen HTML Canvas — NOT the Konva stage — to produce pixel-perfect
 * output where each stitch is exactly scaleFactor × scaleFactor pixels.
 */
export function exportCanvasPrint(
  config: CanvasConfig,
  layers: Layer[],
  printConfig: CanvasPrintConfig
): void {
  const { meshCount, scaleFactor, margins, format, colorProfile, embedIccProfile, customIccProfile } = printConfig;
  const dpi = meshCount * scaleFactor;

  const designWidthPx = config.width * scaleFactor;
  const designHeightPx = config.height * scaleFactor;

  const marginLeftPx = Math.round(margins.left * dpi);
  const marginRightPx = Math.round(margins.right * dpi);
  const marginTopPx = Math.round(margins.top * dpi);
  const marginBottomPx = Math.round(margins.bottom * dpi);

  const totalWidth = designWidthPx + marginLeftPx + marginRightPx;
  const totalHeight = designHeightPx + marginTopPx + marginBottomPx;

  // Flatten visible layers
  const cells = gatherVisibleCells(layers);

  // ── Render to offscreen canvas ───────────────────────────────────────

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  // CRITICAL: disable anti-aliasing for crisp stitch blocks
  ctx.imageSmoothingEnabled = false;

  // Fill entire canvas with white (margins + empty cells)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Paint each stitch as a scaleFactor × scaleFactor pixel block
  for (const [key, cell] of Object.entries(cells)) {
    if (!cell.color) continue;
    const [rowStr, colStr] = key.split(',');
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);

    const x = marginLeftPx + col * scaleFactor;
    const y = marginTopPx + row * scaleFactor;

    ctx.fillStyle = cell.color;
    ctx.fillRect(x, y, scaleFactor, scaleFactor);
  }

  // ── Determine ICC profile bytes ──────────────────────────────────────

  let iccProfileBytes: Uint8Array | undefined;
  if (embedIccProfile) {
    if (colorProfile === 'custom' && customIccProfile) {
      iccProfileBytes = new Uint8Array(customIccProfile);
    } else {
      // sRGB or adobe-rgb — use sRGB profile for both for now
      // (Adobe RGB profile would need a separate profile file)
      iccProfileBytes = getSrgbProfileBytes();
    }
  }

  // ── Export based on format ───────────────────────────────────────────

  if (format === 'tiff') {
    exportAsTiff(ctx, totalWidth, totalHeight, dpi, iccProfileBytes);
  } else {
    exportAsPng(canvas, dpi, iccProfileBytes);
  }
}

// ─── Format-specific export helpers ────────────────────────────────────

function exportAsTiff(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpi: number,
  iccProfile?: Uint8Array
) {
  // Get RGBA pixel data from canvas
  const imageData = ctx.getImageData(0, 0, width, height);
  const rgba = imageData.data;

  // Convert RGBA → RGB (drop alpha channel)
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];       // R
    rgb[j + 1] = rgba[i + 1]; // G
    rgb[j + 2] = rgba[i + 2]; // B
  }

  const blob = buildTiff(rgb, width, height, dpi, iccProfile);
  downloadBlob(blob, 'needlepoint-print.tiff');
}

function exportAsPng(
  canvas: HTMLCanvasElement,
  dpi: number,
  iccProfile?: Uint8Array
) {
  canvas.toBlob((blob) => {
    if (!blob) return;

    blob.arrayBuffer().then((buffer) => {
      // Inject DPI metadata (pHYs chunk)
      let processedBuffer = injectPngDpi(buffer, dpi);

      // Inject ICC profile (iCCP chunk) if provided
      if (iccProfile) {
        processedBuffer = injectPngIcc(processedBuffer, iccProfile, 'sRGB');
      }

      const finalBlob = new Blob([processedBuffer], { type: 'image/png' });
      downloadBlob(finalBlob, 'needlepoint-print.png');
    });
  }, 'image/png');
}

// ─── Download helper ───────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
