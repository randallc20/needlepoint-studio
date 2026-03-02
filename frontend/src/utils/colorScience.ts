/**
 * Color science utilities for perceptually accurate color matching.
 *
 * Replaces Euclidean RGB distance (which doesn't match human perception)
 * with Delta-E CIE2000 in CIELAB color space — the gold standard for
 * "how different do these two colors look to a human?"
 *
 * Delta-E interpretation:
 *   < 1    Imperceptible — "Exact match"
 *   1–3    Barely noticeable — "Very close"
 *   3–6    Noticeable if looking closely — "Close"
 *   6–10   Clearly different — "Approximate"
 *   > 10   Very different — "Poor match"
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface Lab {
  l: number;  // Lightness: 0 (black) to 100 (white)
  a: number;  // Green–Red axis: typically -128 to +127
  b: number;  // Blue–Yellow axis: typically -128 to +127
}

export interface MatchResult {
  index: number;
  deltaE: number;
}

// ─── RGB → XYZ → CIELAB conversion ────────────────────────────────────

// D65 illuminant reference white point
const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

/**
 * Convert sRGB (0–255) to CIELAB.
 */
export function rgbToLab(r: number, g: number, b: number): Lab {
  // sRGB → linear RGB (inverse companding)
  let rl = r / 255;
  let gl = g / 255;
  let bl = b / 255;

  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  rl *= 100;
  gl *= 100;
  bl *= 100;

  // Linear RGB → XYZ (sRGB matrix, D65)
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

  // XYZ → CIELAB
  let fx = x / REF_X;
  let fy = y / REF_Y;
  let fz = z / REF_Z;

  const epsilon = 0.008856;  // (6/29)^3
  const kappa = 7.787;       // (29/6)^2 / 3

  fx = fx > epsilon ? Math.cbrt(fx) : kappa * fx + 16 / 116;
  fy = fy > epsilon ? Math.cbrt(fy) : kappa * fy + 16 / 116;
  fz = fz > epsilon ? Math.cbrt(fz) : kappa * fz + 16 / 116;

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// ─── Delta-E CIE2000 ──────────────────────────────────────────────────

/**
 * Calculate Delta-E 2000 between two CIELAB colors.
 *
 * Implementation follows the CIE DE2000 formula exactly.
 * Reference: Sharma, Wu, Dalal (2005) "The CIEDE2000 Color-Difference Formula"
 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const { l: L1, a: a1, b: b1 } = lab1;
  const { l: L2, a: a2, b: b2 } = lab2;

  // Step 1: Calculate C'ab, h'ab
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab_mean = (C1 + C2) / 2;

  const Cab_mean_pow7 = Math.pow(Cab_mean, 7);
  const G = 0.5 * (1 - Math.sqrt(Cab_mean_pow7 / (Cab_mean_pow7 + 6103515625))); // 25^7

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * (180 / Math.PI);
  if (h1p < 0) h1p += 360;

  let h2p = Math.atan2(b2, a2p) * (180 / Math.PI);
  if (h2p < 0) h2p += 360;

  // Step 2: Calculate dL', dC', dH'
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  // Step 3: Calculate CIEDE2000 ΔE
  const Lp_mean = (L1 + L2) / 2;
  const Cp_mean = (C1p + C2p) / 2;

  let hp_mean: number;
  if (C1p * C2p === 0) {
    hp_mean = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hp_mean = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hp_mean = (h1p + h2p + 360) / 2;
  } else {
    hp_mean = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((hp_mean - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * hp_mean) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hp_mean + 6) * Math.PI) / 180) -
    0.20 * Math.cos(((4 * hp_mean - 63) * Math.PI) / 180);

  const Lp_mean_minus50_sq = (Lp_mean - 50) * (Lp_mean - 50);
  const SL = 1 + 0.015 * Lp_mean_minus50_sq / Math.sqrt(20 + Lp_mean_minus50_sq);
  const SC = 1 + 0.045 * Cp_mean;
  const SH = 1 + 0.015 * Cp_mean * T;

  const Cp_mean_pow7 = Math.pow(Cp_mean, 7);
  const RT =
    -2 *
    Math.sqrt(Cp_mean_pow7 / (Cp_mean_pow7 + 6103515625)) *
    Math.sin(((60 * Math.exp(-Math.pow((hp_mean - 275) / 25, 2))) * Math.PI) / 180);

  // Parametric weighting factors (kL = kC = kH = 1 for standard use)
  const dE = Math.sqrt(
    (dLp / SL) * (dLp / SL) +
    (dCp / SC) * (dCp / SC) +
    (dHp / SH) * (dHp / SH) +
    RT * (dCp / SC) * (dHp / SH)
  );

  return dE;
}

// ─── Nearest-color search ──────────────────────────────────────────────

/**
 * Find the nearest color in a palette using Delta-E CIE2000.
 * Returns the index and the Delta-E distance.
 *
 * @param targetLab - The CIELAB color to match
 * @param paletteLabs - Pre-computed CIELAB values for each palette color
 */
export function findNearestByDeltaE(
  targetLab: Lab,
  paletteLabs: Lab[]
): MatchResult {
  let bestIdx = 0;
  let bestDist = Infinity;

  for (let i = 0; i < paletteLabs.length; i++) {
    const d = deltaE2000(targetLab, paletteLabs[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      if (d < 0.5) break; // close enough — early exit
    }
  }

  return { index: bestIdx, deltaE: bestDist };
}

// ─── Match quality labels ──────────────────────────────────────────────

export type MatchQuality = 'exact' | 'very-close' | 'close' | 'approximate' | 'poor';

export function getMatchQuality(deltaE: number): MatchQuality {
  if (deltaE < 1) return 'exact';
  if (deltaE < 3) return 'very-close';
  if (deltaE < 6) return 'close';
  if (deltaE < 10) return 'approximate';
  return 'poor';
}

export function getMatchQualityLabel(quality: MatchQuality): string {
  switch (quality) {
    case 'exact': return 'Exact match';
    case 'very-close': return 'Very close';
    case 'close': return 'Close';
    case 'approximate': return 'Approximate';
    case 'poor': return 'Poor match';
  }
}

export function getMatchQualityColor(quality: MatchQuality): string {
  switch (quality) {
    case 'exact': return '#22c55e';
    case 'very-close': return '#22c55e';
    case 'close': return '#eab308';
    case 'approximate': return '#f97316';
    case 'poor': return '#ef4444';
  }
}
