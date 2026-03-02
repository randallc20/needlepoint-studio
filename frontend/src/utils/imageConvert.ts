import { findNearestDmcColor } from '../data/dmcColors';
import type { StitchCell } from '../types';

export type DitherMode = 'none' | 'floyd-steinberg' | 'ordered';

export interface RgbPixel { r: number; g: number; b: number }

// ─── K-Means Quantization ────────────────────────────────────────────

export function findNearestCentroid(pixel: RgbPixel, centroids: RgbPixel[]): RgbPixel {
  let minDist = Infinity;
  let nearest = centroids[0];
  for (const c of centroids) {
    const dr = pixel.r - c.r;
    const dg = pixel.g - c.g;
    const db = pixel.b - c.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < minDist) {
      minDist = dist;
      nearest = c;
    }
  }
  return nearest;
}

export function kMeansQuantize(pixels: RgbPixel[], k: number, maxIter = 20): RgbPixel[] {
  const step = Math.max(1, Math.floor(pixels.length / k));
  const centroids: RgbPixel[] = [];
  for (let i = 0; i < k; i++) {
    const p = pixels[Math.min(i * step, pixels.length - 1)];
    centroids.push({ ...p });
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const sums: { r: number; g: number; b: number; count: number }[] =
      centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (const p of pixels) {
      let minDist = Infinity;
      let bestIdx = 0;
      for (let ci = 0; ci < centroids.length; ci++) {
        const c = centroids[ci];
        const dr = p.r - c.r;
        const dg = p.g - c.g;
        const db = p.b - c.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) { minDist = dist; bestIdx = ci; }
      }
      sums[bestIdx].r += p.r;
      sums[bestIdx].g += p.g;
      sums[bestIdx].b += p.b;
      sums[bestIdx].count++;
    }

    let converged = true;
    for (let ci = 0; ci < centroids.length; ci++) {
      if (sums[ci].count === 0) continue;
      const newR = Math.round(sums[ci].r / sums[ci].count);
      const newG = Math.round(sums[ci].g / sums[ci].count);
      const newB = Math.round(sums[ci].b / sums[ci].count);
      if (centroids[ci].r !== newR || centroids[ci].g !== newG || centroids[ci].b !== newB) {
        converged = false;
      }
      centroids[ci] = { r: newR, g: newG, b: newB };
    }
    if (converged) break;
  }

  return centroids;
}

// ─── Floyd-Steinberg Dithering ───────────────────────────────────────

export function floydSteinbergDither(
  pixels: RgbPixel[],
  centroids: RgbPixel[],
  width: number,
  height: number,
): RgbPixel[] {
  const buf: { r: number; g: number; b: number }[] = pixels.map(p => ({ ...p }));
  const result: RgbPixel[] = new Array(pixels.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = buf[idx];
      const clamped = {
        r: Math.max(0, Math.min(255, Math.round(old.r))),
        g: Math.max(0, Math.min(255, Math.round(old.g))),
        b: Math.max(0, Math.min(255, Math.round(old.b))),
      };
      const nearest = findNearestCentroid(clamped, centroids);
      result[idx] = nearest;

      const errR = clamped.r - nearest.r;
      const errG = clamped.g - nearest.g;
      const errB = clamped.b - nearest.b;

      const spread = (i: number, factor: number) => {
        if (i >= 0 && i < buf.length) {
          buf[i].r += errR * factor;
          buf[i].g += errG * factor;
          buf[i].b += errB * factor;
        }
      };

      if (x + 1 < width) spread(idx + 1, 7 / 16);
      if (y + 1 < height) {
        if (x > 0) spread(idx + width - 1, 3 / 16);
        spread(idx + width, 5 / 16);
        if (x + 1 < width) spread(idx + width + 1, 1 / 16);
      }
    }
  }

  return result;
}

// ─── Ordered (Bayer 4×4) Dithering ──────────────────────────────────

const BAYER_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

export function orderedDither(
  pixels: RgbPixel[],
  centroids: RgbPixel[],
  width: number,
  height: number,
): RgbPixel[] {
  let maxCentroidDist = 0;
  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      const dr = centroids[i].r - centroids[j].r;
      const dg = centroids[i].g - centroids[j].g;
      const db = centroids[i].b - centroids[j].b;
      maxCentroidDist = Math.max(maxCentroidDist, Math.sqrt(dr * dr + dg * dg + db * db));
    }
  }
  const spread = Math.max(16, maxCentroidDist * 0.25);

  const result: RgbPixel[] = new Array(pixels.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const p = pixels[idx];

      const threshold = (BAYER_4X4[y % 4][x % 4] / 16) - 0.5;

      const adjusted: RgbPixel = {
        r: Math.max(0, Math.min(255, Math.round(p.r + threshold * spread))),
        g: Math.max(0, Math.min(255, Math.round(p.g + threshold * spread))),
        b: Math.max(0, Math.min(255, Math.round(p.b + threshold * spread))),
      };

      result[idx] = findNearestCentroid(adjusted, centroids);
    }
  }

  return result;
}

// ─── High-level conversion helper ────────────────────────────────────

export async function convertImageToStitchCells(
  imageUrl: string,
  targetWidth: number,
  targetHeight: number,
  colorCount: number,
  ditherMode: DitherMode,
): Promise<{ cells: Record<string, StitchCell>; width: number; height: number }> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = imageUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const pixels: RgbPixel[] = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    pixels.push({ r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2] });
  }

  const centroids = kMeansQuantize(pixels, colorCount);

  let quantized: RgbPixel[];
  switch (ditherMode) {
    case 'floyd-steinberg':
      quantized = floydSteinbergDither(pixels, centroids, targetWidth, targetHeight);
      break;
    case 'ordered':
      quantized = orderedDither(pixels, centroids, targetWidth, targetHeight);
      break;
    default:
      quantized = pixels.map(p => findNearestCentroid(p, centroids));
  }

  const cells: Record<string, StitchCell> = {};
  const centroidToDmc = new Map<string, { hex: string; dmcNumber: string }>();

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const idx = y * targetWidth + x;
      const qColor = quantized[idx];
      const cKey = `${qColor.r},${qColor.g},${qColor.b}`;

      if (!centroidToDmc.has(cKey)) {
        const match = findNearestDmcColor(qColor.r, qColor.g, qColor.b);
        centroidToDmc.set(cKey, { hex: match.color.hex, dmcNumber: match.color.number });
      }

      const { hex, dmcNumber } = centroidToDmc.get(cKey)!;
      cells[`${y},${x}`] = {
        color: hex,
        dmcNumber,
        stitchType: 'tent',
      };
    }
  }

  return { cells, width: targetWidth, height: targetHeight };
}
