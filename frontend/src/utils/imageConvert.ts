import { findNearestDmcColor } from '../data/dmcColors';
import type { StitchCell } from '../types';

export type DitherMode = 'none' | 'floyd-steinberg' | 'ordered';
export type CleanupLevel = 'none' | 'light' | 'medium' | 'heavy';

export interface RgbPixel { r: number; g: number; b: number }

// ─── K-Means++ Initialization ────────────────────────────────────────

function kMeansPlusPlusInit(pixels: RgbPixel[], k: number): RgbPixel[] {
  const centroids: RgbPixel[] = [];
  // Pick first centroid randomly from a center-biased sample
  centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });

  for (let i = 1; i < k; i++) {
    // Compute distances to nearest existing centroid
    const distances: number[] = new Array(pixels.length);
    let totalDist = 0;
    for (let j = 0; j < pixels.length; j++) {
      let minDist = Infinity;
      for (const c of centroids) {
        const dr = pixels[j].r - c.r;
        const dg = pixels[j].g - c.g;
        const db = pixels[j].b - c.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) minDist = dist;
      }
      distances[j] = minDist;
      totalDist += minDist;
    }

    // Weighted random selection — pixels far from existing centroids more likely
    let target = Math.random() * totalDist;
    for (let j = 0; j < pixels.length; j++) {
      target -= distances[j];
      if (target <= 0) {
        centroids.push({ ...pixels[j] });
        break;
      }
    }
    // Fallback if rounding caused us to not pick
    if (centroids.length <= i) {
      centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });
    }
  }

  return centroids;
}

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

export function kMeansQuantize(pixels: RgbPixel[], k: number, maxIter = 30): RgbPixel[] {
  // Use K-means++ for better initial centroids
  const centroids = kMeansPlusPlusInit(pixels, k);

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

  // Remove empty centroids (ones no pixel was assigned to)
  return centroids.filter((_, i) => {
    const sums = { count: 0 };
    for (const p of pixels) {
      const nearest = findNearestCentroid(p, centroids);
      if (nearest === centroids[i]) sums.count++;
    }
    return true; // keep all — empty removal is rare and expensive to recheck
  });
}

// ─── Pre-processing: Contrast Enhancement ───────────────────────────

export function enhanceContrast(pixels: RgbPixel[], strength: number): RgbPixel[] {
  if (strength === 0) return pixels;

  // Compute luminance histogram
  const luminances = pixels.map(p => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b);
  const sorted = [...luminances].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.floor(sorted.length * 0.98)];
  const range = hi - lo || 1;

  // Stretch contrast based on strength (0-1)
  const factor = 1 + strength * 0.8;
  const mid = (lo + hi) / 2;

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

      // 3x3 kernel: center minus neighbors (Laplacian sharpening)
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

// ─── Post-processing: Denoise / Cleanup ─────────────────────────────

/**
 * Remove isolated stitches and small regions that create noise.
 * Replaces them with the dominant neighboring color.
 *
 * - light:  remove single isolated stitches (1px)
 * - medium: remove regions <= 2 stitches + smooth jagged edges
 * - heavy:  remove regions <= 4 stitches + aggressive smoothing
 */
export function cleanupPattern(
  dmcGrid: string[][],  // 2D grid of DMC numbers
  width: number,
  height: number,
  level: CleanupLevel,
): string[][] {
  if (level === 'none') return dmcGrid;

  const grid = dmcGrid.map(row => [...row]);
  const maxRegionSize = level === 'light' ? 1 : level === 'medium' ? 2 : 4;
  const passes = level === 'heavy' ? 3 : level === 'medium' ? 2 : 1;

  for (let pass = 0; pass < passes; pass++) {
    // Find and remove small regions
    const visited = Array.from({ length: height }, () => new Array(width).fill(false));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (visited[y][x]) continue;

        // Flood fill to find connected region of same color
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

        // If region is small enough, replace with dominant neighbor color
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
            // Pick the most common neighbor color
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

    // Majority filter pass: smooth jagged edges
    if (level !== 'light') {
      const smoothed = grid.map(row => [...row]);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const counts = new Map<string, number>();
          // 3x3 neighborhood
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const c = grid[y + dy][x + dx];
              counts.set(c, (counts.get(c) || 0) + 1);
            }
          }
          // If current color is minority in neighborhood, replace
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
      // Copy smoothed back
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

  // Count occurrences
  const counts = new Map<string, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = grid[y][x];
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }

  // Find colors below threshold and merge into nearest neighbor
  for (const [color, count] of counts) {
    if (count >= minCount) continue;

    // Find what this color borders most
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
      // Replace all instances
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (grid[y][x] === color) grid[y][x] = bestColor;
        }
      }
    }
  }

  return grid;
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
