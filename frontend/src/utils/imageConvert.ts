import { findNearestDmcColor } from '../data/dmcColors';
import { rgbToLab, type Lab } from './colorScience';
import type { StitchCell } from '../types';

export type DitherMode = 'none' | 'floyd-steinberg' | 'ordered';
export type CleanupLevel = 'none' | 'light' | 'medium' | 'heavy';

export interface RgbPixel { r: number; g: number; b: number }

// ─── LAB pixel for perceptual clustering ─────────────────────────────

interface LabPixel { l: number; a: number; b: number }

function rgbToLabPixel(p: RgbPixel): LabPixel {
  return rgbToLab(p.r, p.g, p.b);
}

function labDistance(a: LabPixel, b: LabPixel): number {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dl * dl + da * da + db * db;
}

function findNearestLabCentroid(pixel: LabPixel, centroids: LabPixel[]): number {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < centroids.length; i++) {
    const dist = labDistance(pixel, centroids[i]);
    if (dist < minDist) { minDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

// ─── K-Means++ Initialization in LAB space ───────────────────────────

function kMeansPlusPlusInitLab(pixels: LabPixel[], k: number): LabPixel[] {
  const centroids: LabPixel[] = [];
  centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });

  for (let i = 1; i < k; i++) {
    const distances: number[] = new Array(pixels.length);
    let totalDist = 0;
    for (let j = 0; j < pixels.length; j++) {
      let minDist = Infinity;
      for (const c of centroids) {
        const dist = labDistance(pixels[j], c);
        if (dist < minDist) minDist = dist;
      }
      distances[j] = minDist;
      totalDist += minDist;
    }

    let target = Math.random() * totalDist;
    let picked = false;
    for (let j = 0; j < pixels.length; j++) {
      target -= distances[j];
      if (target <= 0) {
        centroids.push({ ...pixels[j] });
        picked = true;
        break;
      }
    }
    if (!picked) {
      centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });
    }
  }

  return centroids;
}

// ─── K-Means Quantization in LAB space ───────────────────────────────

function kMeansLab(labPixels: LabPixel[], k: number, maxIter = 30): LabPixel[] {
  const centroids = kMeansPlusPlusInitLab(labPixels, k);

  for (let iter = 0; iter < maxIter; iter++) {
    const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, count: 0 }));

    for (const p of labPixels) {
      const bestIdx = findNearestLabCentroid(p, centroids);
      sums[bestIdx].l += p.l;
      sums[bestIdx].a += p.a;
      sums[bestIdx].b += p.b;
      sums[bestIdx].count++;
    }

    let converged = true;
    for (let ci = 0; ci < centroids.length; ci++) {
      if (sums[ci].count === 0) continue;
      const newL = sums[ci].l / sums[ci].count;
      const newA = sums[ci].a / sums[ci].count;
      const newB = sums[ci].b / sums[ci].count;
      if (Math.abs(centroids[ci].l - newL) > 0.1 ||
          Math.abs(centroids[ci].a - newA) > 0.1 ||
          Math.abs(centroids[ci].b - newB) > 0.1) {
        converged = false;
      }
      centroids[ci] = { l: newL, a: newA, b: newB };
    }
    if (converged) break;
  }

  // Remove empty centroids
  const used = new Set<number>();
  for (const p of labPixels) {
    used.add(findNearestLabCentroid(p, centroids));
  }
  return centroids.filter((_, i) => used.has(i));
}

/**
 * Run k-means multiple times and return the best result (lowest total error).
 */
function kMeansLabBestOf(labPixels: LabPixel[], k: number, runs: number): LabPixel[] {
  let bestCentroids: LabPixel[] = [];
  let bestError = Infinity;

  for (let r = 0; r < runs; r++) {
    const centroids = kMeansLab(labPixels, k);
    let totalError = 0;
    for (const p of labPixels) {
      const idx = findNearestLabCentroid(p, centroids);
      totalError += labDistance(p, centroids[idx]);
    }
    if (totalError < bestError) {
      bestError = totalError;
      bestCentroids = centroids;
    }
  }

  return bestCentroids;
}

// ─── Backwards-compatible RGB wrappers (used by old callers) ─────────

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

export function kMeansQuantize(pixels: RgbPixel[], k: number, maxIter = 30): RgbPixel[] {
  // Convert to LAB, run k-means, convert back
  const labPixels = pixels.map(rgbToLabPixel);
  const labCentroids = kMeansLab(labPixels, k, maxIter);

  // Map LAB centroids back to average RGB of assigned pixels
  const rgbSums = labCentroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
  for (let i = 0; i < pixels.length; i++) {
    const idx = findNearestLabCentroid(labPixels[i], labCentroids);
    rgbSums[idx].r += pixels[i].r;
    rgbSums[idx].g += pixels[i].g;
    rgbSums[idx].b += pixels[i].b;
    rgbSums[idx].count++;
  }

  return rgbSums
    .filter(s => s.count > 0)
    .map(s => ({
      r: Math.round(s.r / s.count),
      g: Math.round(s.g / s.count),
      b: Math.round(s.b / s.count),
    }));
}

// ─── Main quantization: LAB-space with multi-run ─────────────────────

export interface QuantizeResult {
  /** Index of the centroid each pixel was assigned to */
  assignments: number[];
  /** LAB centroids */
  centroids: LabPixel[];
  /** Average RGB for each centroid */
  centroidRgb: RgbPixel[];
}

export function quantizePixels(
  pixels: RgbPixel[],
  colorCount: number,
  ditherMode: DitherMode,
  width: number,
  height: number,
  runs = 3,
): QuantizeResult {
  const labPixels = pixels.map(rgbToLabPixel);
  const centroids = kMeansLabBestOf(labPixels, colorCount, runs);

  // Compute average RGB per centroid
  const rgbSums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
  for (let i = 0; i < pixels.length; i++) {
    const idx = findNearestLabCentroid(labPixels[i], centroids);
    rgbSums[idx].r += pixels[i].r;
    rgbSums[idx].g += pixels[i].g;
    rgbSums[idx].b += pixels[i].b;
    rgbSums[idx].count++;
  }
  const centroidRgb = rgbSums.map(s =>
    s.count > 0
      ? { r: Math.round(s.r / s.count), g: Math.round(s.g / s.count), b: Math.round(s.b / s.count) }
      : { r: 0, g: 0, b: 0 }
  );

  // Assign pixels — with optional dithering
  let assignments: number[];

  if (ditherMode === 'none') {
    assignments = labPixels.map(p => findNearestLabCentroid(p, centroids));
  } else if (ditherMode === 'floyd-steinberg') {
    assignments = floydSteinbergDitherLab(labPixels, centroids, width, height);
  } else {
    assignments = orderedDitherLab(labPixels, centroids, width, height);
  }

  return { assignments, centroids, centroidRgb };
}

// ─── Floyd-Steinberg Dithering in LAB space ──────────────────────────

function floydSteinbergDitherLab(
  pixels: LabPixel[],
  centroids: LabPixel[],
  width: number,
  height: number,
): number[] {
  const buf = pixels.map(p => ({ l: p.l, a: p.a, b: p.b }));
  const result = new Array<number>(pixels.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = buf[idx];
      const bestIdx = findNearestLabCentroid(old, centroids);
      result[idx] = bestIdx;

      const nearest = centroids[bestIdx];
      const errL = old.l - nearest.l;
      const errA = old.a - nearest.a;
      const errB = old.b - nearest.b;

      const spread = (i: number, factor: number) => {
        if (i >= 0 && i < buf.length) {
          buf[i].l += errL * factor;
          buf[i].a += errA * factor;
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

// ─── Ordered (Bayer 4×4) Dithering in LAB space ─────────────────────

const BAYER_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

function orderedDitherLab(
  pixels: LabPixel[],
  centroids: LabPixel[],
  width: number,
  height: number,
): number[] {
  // Compute spread based on centroid distances in LAB
  let maxDist = 0;
  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      const d = Math.sqrt(labDistance(centroids[i], centroids[j]));
      if (d > maxDist) maxDist = d;
    }
  }
  const spread = Math.max(4, maxDist * 0.2);

  const result = new Array<number>(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const p = pixels[idx];
      const threshold = (BAYER_4X4[y % 4][x % 4] / 16) - 0.5;

      const adjusted: LabPixel = {
        l: p.l + threshold * spread,
        a: p.a + threshold * spread * 0.5,
        b: p.b + threshold * spread * 0.5,
      };
      result[idx] = findNearestLabCentroid(adjusted, centroids);
    }
  }

  return result;
}

// ─── RGB-space dithering (kept for backward compat) ──────────────────

export function floydSteinbergDither(
  pixels: RgbPixel[],
  centroids: RgbPixel[],
  width: number,
  height: number,
): RgbPixel[] {
  const buf = pixels.map(p => ({ ...p }));
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

// ─── Pre-processing: Contrast Enhancement ───────────────────────────

export function enhanceContrast(pixels: RgbPixel[], strength: number): RgbPixel[] {
  if (strength === 0) return pixels;

  const luminances = pixels.map(p => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b);
  const sorted = [...luminances].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.floor(sorted.length * 0.98)];
  const mid = (lo + hi) / 2;
  const factor = 1 + strength * 0.8;

  return pixels.map(p => ({
    r: Math.max(0, Math.min(255, Math.round(mid + (p.r - mid) * factor))),
    g: Math.max(0, Math.min(255, Math.round(mid + (p.g - mid) * factor))),
    b: Math.max(0, Math.min(255, Math.round(mid + (p.b - mid) * factor))),
  }));
}

// ─── Pre-processing: Sharpening (unsharp mask) ──────────────────────

export function sharpenPixels(
  pixels: RgbPixel[],
  width: number,
  height: number,
  strength: number,
): RgbPixel[] {
  if (strength === 0) return pixels;

  const result: RgbPixel[] = new Array(pixels.length);
  const amount = strength * 1.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const p = pixels[idx];

      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        result[idx] = { ...p };
        continue;
      }

      const top = pixels[(y - 1) * width + x];
      const bot = pixels[(y + 1) * width + x];
      const left = pixels[y * width + (x - 1)];
      const right = pixels[y * width + (x + 1)];

      const avgR = (top.r + bot.r + left.r + right.r) / 4;
      const avgG = (top.g + bot.g + left.g + right.g) / 4;
      const avgB = (top.b + bot.b + left.b + right.b) / 4;

      result[idx] = {
        r: Math.max(0, Math.min(255, Math.round(p.r + amount * (p.r - avgR)))),
        g: Math.max(0, Math.min(255, Math.round(p.g + amount * (p.g - avgG)))),
        b: Math.max(0, Math.min(255, Math.round(p.b + amount * (p.b - avgB)))),
      };
    }
  }

  return result;
}

// ─── Pre-processing: Bilateral Filter (edge-preserving smoothing) ───

/**
 * Bilateral filter: smooths flat color regions while preserving sharp edges.
 * This is the key to getting clean, painterly regions in needlepoint patterns.
 *
 * @param strength 0-1: 0 = no smoothing, 1 = maximum smoothing
 */
export function bilateralFilter(
  pixels: RgbPixel[],
  width: number,
  height: number,
  strength: number,
): RgbPixel[] {
  if (strength === 0) return pixels;

  const result: RgbPixel[] = new Array(pixels.length);

  // Spatial sigma scales with strength (radius of influence)
  const sigmaSpatial = 1 + strength * 2;    // 1-3 pixel radius
  const sigmaColor = 20 + strength * 40;     // color similarity threshold

  const spatialDenom = 2 * sigmaSpatial * sigmaSpatial;
  const colorDenom = 2 * sigmaColor * sigmaColor;

  // Kernel radius
  const radius = Math.ceil(sigmaSpatial * 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const center = pixels[idx];

      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;

          const neighbor = pixels[ny * width + nx];

          // Spatial weight (distance from center)
          const spatialDist = dx * dx + dy * dy;
          const spatialWeight = Math.exp(-spatialDist / spatialDenom);

          // Color weight (color difference from center)
          const dr = center.r - neighbor.r;
          const dg = center.g - neighbor.g;
          const db = center.b - neighbor.b;
          const colorDist = dr * dr + dg * dg + db * db;
          const colorWeight = Math.exp(-colorDist / colorDenom);

          const w = spatialWeight * colorWeight;
          sumR += neighbor.r * w;
          sumG += neighbor.g * w;
          sumB += neighbor.b * w;
          sumW += w;
        }
      }

      result[idx] = {
        r: Math.max(0, Math.min(255, Math.round(sumR / sumW))),
        g: Math.max(0, Math.min(255, Math.round(sumG / sumW))),
        b: Math.max(0, Math.min(255, Math.round(sumB / sumW))),
      };
    }
  }

  return result;
}

// ─── Post-processing: Denoise / Cleanup ─────────────────────────────

export function cleanupPattern(
  dmcGrid: string[][],
  width: number,
  height: number,
  level: CleanupLevel,
): string[][] {
  if (level === 'none') return dmcGrid;

  const grid = dmcGrid.map(row => [...row]);
  const maxRegionSize = level === 'light' ? 1 : level === 'medium' ? 2 : 4;
  const passes = level === 'heavy' ? 3 : level === 'medium' ? 2 : 1;

  for (let pass = 0; pass < passes; pass++) {
    const visited = Array.from({ length: height }, () => new Array(width).fill(false));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (visited[y][x]) continue;

        const color = grid[y][x];
        const region: [number, number][] = [];
        const queue: [number, number][] = [[y, x]];
        visited[y][x] = true;

        while (queue.length > 0) {
          const [cy, cx] = queue.shift()!;
          region.push([cy, cx]);

          const neighbors: [number, number][] = [
            [cy - 1, cx], [cy + 1, cx], [cy, cx - 1], [cy, cx + 1],
          ];
          for (const [ny, nx] of neighbors) {
            if (ny >= 0 && ny < height && nx >= 0 && nx < width && !visited[ny][nx] && grid[ny][nx] === color) {
              visited[ny][nx] = true;
              queue.push([ny, nx]);
            }
          }
        }

        if (region.length <= maxRegionSize) {
          const neighborCounts = new Map<string, number>();
          for (const [ry, rx] of region) {
            const neighbors: [number, number][] = [
              [ry - 1, rx], [ry + 1, rx], [ry, rx - 1], [ry, rx + 1],
            ];
            for (const [ny, nx] of neighbors) {
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                const nc = grid[ny][nx];
                if (nc !== color) {
                  neighborCounts.set(nc, (neighborCounts.get(nc) || 0) + 1);
                }
              }
            }
          }

          if (neighborCounts.size > 0) {
            let bestColor = color;
            let bestCount = 0;
            for (const [nc, count] of neighborCounts) {
              if (count > bestCount) {
                bestCount = count;
                bestColor = nc;
              }
            }
            for (const [ry, rx] of region) {
              grid[ry][rx] = bestColor;
            }
          }
        }
      }
    }

    // Majority filter: smooth jagged edges
    if (level !== 'light') {
      const smoothed = grid.map(row => [...row]);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const counts = new Map<string, number>();
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const c = grid[y + dy][x + dx];
              counts.set(c, (counts.get(c) || 0) + 1);
            }
          }
          const currentCount = counts.get(grid[y][x]) || 0;
          if (currentCount <= 2) {
            let bestColor = grid[y][x];
            let bestCount = 0;
            for (const [c, cnt] of counts) {
              if (cnt > bestCount) {
                bestCount = cnt;
                bestColor = c;
              }
            }
            smoothed[y][x] = bestColor;
          }
        }
      }
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          grid[y][x] = smoothed[y][x];
        }
      }
    }
  }

  return grid;
}

// ─── Merge similar colors that ended up too close ───────────────────

export function mergeSimilarColors(
  dmcGrid: string[][],
  width: number,
  height: number,
  minStitchPercent: number,
): string[][] {
  const totalStitches = width * height;
  const minCount = Math.max(1, Math.floor(totalStitches * minStitchPercent / 100));

  const grid = dmcGrid.map(row => [...row]);

  const counts = new Map<string, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = grid[y][x];
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }

  for (const [color, count] of counts) {
    if (count >= minCount) continue;

    const neighborCounts = new Map<string, number>();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] !== color) continue;
        const neighbors: [number, number][] = [
          [y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1],
        ];
        for (const [ny, nx] of neighbors) {
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const nc = grid[ny][nx];
            if (nc !== color) {
              neighborCounts.set(nc, (neighborCounts.get(nc) || 0) + 1);
            }
          }
        }
      }
    }

    if (neighborCounts.size > 0) {
      let bestColor = color;
      let bestCount = 0;
      for (const [nc, cnt] of neighborCounts) {
        if (cnt > bestCount) { bestCount = cnt; bestColor = nc; }
      }
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (grid[y][x] === color) grid[y][x] = bestColor;
        }
      }
    }
  }

  return grid;
}

// ─── High-level conversion helper (legacy) ──────────────────────────

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

  const qResult = quantizePixels(pixels, colorCount, ditherMode, targetWidth, targetHeight);

  const cells: Record<string, StitchCell> = {};
  const centroidToDmc = new Map<number, { hex: string; dmcNumber: string }>();

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const idx = y * targetWidth + x;
      const ci = qResult.assignments[idx];

      if (!centroidToDmc.has(ci)) {
        const rgb = qResult.centroidRgb[ci];
        const match = findNearestDmcColor(rgb.r, rgb.g, rgb.b);
        centroidToDmc.set(ci, { hex: match.color.hex, dmcNumber: match.color.number });
      }

      const { hex, dmcNumber } = centroidToDmc.get(ci)!;
      cells[`${y},${x}`] = {
        color: hex,
        dmcNumber,
        stitchType: 'tent',
      };
    }
  }

  return { cells, width: targetWidth, height: targetHeight };
}
