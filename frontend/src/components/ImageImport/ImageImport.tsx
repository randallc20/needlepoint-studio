import { useState, useRef, useCallback, useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { findNearestDmcColor, findNearestDmcColors, DMC_COLORS } from '../../data/dmcColors';
import { getMatchQuality, getMatchQualityLabel, getMatchQualityColor } from '../../utils/colorScience';
import {
  kMeansQuantize,
  findNearestCentroid,
  floydSteinbergDither,
  orderedDither,
  type RgbPixel,
  type DitherMode,
} from '../../utils/imageConvert';
import type { StitchCell, DmcColor } from '../../types';
import './ImageImport.css';

interface ConvertSettings {
  targetWidth: number;
  targetHeight: number;
  colorCount: number;
  ditherMode: DitherMode;
  lockAspect: boolean;
  restrictToPalette: boolean;
}

/** One unique color mapping produced during conversion */
interface ColorMapping {
  centroidR: number;
  centroidG: number;
  centroidB: number;
  dmc: DmcColor;
  deltaE: number;
  stitchCount: number;
  alternatives: Array<{ color: DmcColor; deltaE: number }>;
}

/** Result of conversion, held for review before applying */
interface ConvertResult {
  cells: Record<string, StitchCell>;
  previewUrl: string;
  colorMappings: ColorMapping[];
  width: number;
  height: number;
}

export function ImageImport() {
  const config = useCanvasStore(s => s.config);
  const setConfig = useCanvasStore(s => s.setConfig);
  const loadCells = useCanvasStore(s => s.loadCells);
  const palette = useCanvasStore(s => s.palette);

  const [isOpen, setIsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [settings, setSettings] = useState<ConvertSettings>({
    targetWidth: config.width,
    targetHeight: config.height,
    colorCount: 25,
    ditherMode: 'floyd-steinberg',
    lockAspect: true,
    restrictToPalette: false,
  });
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const paletteWarning = useMemo(() => {
    if (!settings.restrictToPalette) return null;
    if (palette.length === 0) return 'No colors in project palette — add colors first';
    if (palette.length < settings.colorCount)
      return `Palette has ${palette.length} colors but ${settings.colorCount} requested — will use all ${palette.length}`;
    return null;
  }, [settings.restrictToPalette, settings.colorCount, palette.length]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      const aspect = img.naturalWidth / img.naturalHeight;
      setSettings(s => {
        const tw = s.targetWidth;
        const th = Math.round(tw / aspect);
        return { ...s, targetHeight: th };
      });
    };
    img.src = url;
    setImageUrl(url);
    setResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleWidthChange = (w: number) => {
    if (settings.lockAspect && imageSize) {
      const aspect = imageSize.w / imageSize.h;
      setSettings(s => ({ ...s, targetWidth: w, targetHeight: Math.round(w / aspect) }));
    } else {
      setSettings(s => ({ ...s, targetWidth: w }));
    }
  };

  const handleHeightChange = (h: number) => {
    if (settings.lockAspect && imageSize) {
      const aspect = imageSize.w / imageSize.h;
      setSettings(s => ({ ...s, targetHeight: h, targetWidth: Math.round(h * aspect) }));
    } else {
      setSettings(s => ({ ...s, targetHeight: h }));
    }
  };

  // Swap a DMC color in the result
  const swapColor = useCallback((oldDmcNumber: string, newDmc: DmcColor) => {
    if (!result) return;
    const newCells = { ...result.cells };
    let swapCount = 0;
    for (const key of Object.keys(newCells)) {
      if (newCells[key].dmcNumber === oldDmcNumber) {
        newCells[key] = { ...newCells[key], color: newDmc.hex, dmcNumber: newDmc.number };
        swapCount++;
      }
    }

    // Update preview
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = result.width;
    previewCanvas.height = result.height;
    const pCtx = previewCanvas.getContext('2d')!;
    const pData = pCtx.createImageData(result.width, result.height);
    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const cell = newCells[`${y},${x}`];
        const idx = (y * result.width + x) * 4;
        const dmc = DMC_COLORS.find(c => c.number === cell.dmcNumber);
        if (dmc) {
          pData.data[idx] = dmc.r;
          pData.data[idx + 1] = dmc.g;
          pData.data[idx + 2] = dmc.b;
        }
        pData.data[idx + 3] = 255;
      }
    }
    pCtx.putImageData(pData, 0, 0);

    // Update color mappings
    const newMappings = result.colorMappings.map(m => {
      if (m.dmc.number === oldDmcNumber) {
        const alternatives = findNearestDmcColors(m.centroidR, m.centroidG, m.centroidB, 6)
          .filter(a => a.color.number !== newDmc.number);
        // Recompute deltaE for the new DMC relative to the original centroid
        const newResult = findNearestDmcColor(m.centroidR, m.centroidG, m.centroidB, [newDmc.number]);
        return {
          ...m,
          dmc: newDmc,
          deltaE: newResult.deltaE,
          stitchCount: swapCount,
          alternatives: alternatives.slice(0, 5),
        };
      }
      return m;
    });

    setResult({
      ...result,
      cells: newCells,
      previewUrl: previewCanvas.toDataURL(),
      colorMappings: newMappings,
    });
  }, [result]);

  // Client-side image conversion
  const convertImage = useCallback(async () => {
    if (!imageUrl) return;
    setConverting(true);
    setResult(null);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvas = canvasRef.current!;
      canvas.width = settings.targetWidth;
      canvas.height = settings.targetHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, settings.targetWidth, settings.targetHeight);

      const imageData = ctx.getImageData(0, 0, settings.targetWidth, settings.targetHeight);
      const pixels: RgbPixel[] = [];
      for (let i = 0; i < imageData.data.length; i += 4) {
        pixels.push({ r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2] });
      }

      // K-means clustering
      const centroids = kMeansQuantize(pixels, settings.colorCount);

      // Assign each pixel to nearest centroid using selected dithering method
      let quantized: RgbPixel[];
      switch (settings.ditherMode) {
        case 'floyd-steinberg':
          quantized = floydSteinbergDither(pixels, centroids, settings.targetWidth, settings.targetHeight);
          break;
        case 'ordered':
          quantized = orderedDither(pixels, centroids, settings.targetWidth, settings.targetHeight);
          break;
        default:
          quantized = pixels.map(p => findNearestCentroid(p, centroids));
      }

      // Build palette restriction list
      const restrictTo = settings.restrictToPalette && palette.length > 0
        ? palette.map(c => c.number)
        : undefined;

      // Map each quantized color to nearest DMC with Delta-E tracking
      const cells: Record<string, StitchCell> = {};
      // Track which centroid maps to which DMC
      const centroidToDmc = new Map<string, { dmc: DmcColor; deltaE: number; centroid: RgbPixel }>();

      for (let y = 0; y < settings.targetHeight; y++) {
        for (let x = 0; x < settings.targetWidth; x++) {
          const idx = y * settings.targetWidth + x;
          const qColor = quantized[idx];
          const cKey = `${qColor.r},${qColor.g},${qColor.b}`;

          if (!centroidToDmc.has(cKey)) {
            const match = findNearestDmcColor(qColor.r, qColor.g, qColor.b, restrictTo);
            centroidToDmc.set(cKey, { dmc: match.color, deltaE: match.deltaE, centroid: qColor });
          }

          const { dmc } = centroidToDmc.get(cKey)!;
          cells[`${y},${x}`] = {
            color: dmc.hex,
            dmcNumber: dmc.number,
            stitchType: 'tent',
          };
        }
      }

      // Build color mapping summaries for review panel
      const stitchCounts = new Map<string, number>();
      for (const cell of Object.values(cells)) {
        stitchCounts.set(cell.dmcNumber!, (stitchCounts.get(cell.dmcNumber!) || 0) + 1);
      }

      const colorMappings: ColorMapping[] = [];
      const seenDmc = new Set<string>();
      for (const [, { dmc, deltaE, centroid }] of centroidToDmc) {
        if (seenDmc.has(dmc.number)) continue;
        seenDmc.add(dmc.number);
        const alts = findNearestDmcColors(centroid.r, centroid.g, centroid.b, 6)
          .filter(a => a.color.number !== dmc.number)
          .slice(0, 5);
        colorMappings.push({
          centroidR: centroid.r,
          centroidG: centroid.g,
          centroidB: centroid.b,
          dmc,
          deltaE,
          stitchCount: stitchCounts.get(dmc.number) || 0,
          alternatives: alts,
        });
      }
      colorMappings.sort((a, b) => b.stitchCount - a.stitchCount);

      // Generate preview image
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = settings.targetWidth;
      previewCanvas.height = settings.targetHeight;
      const pCtx = previewCanvas.getContext('2d')!;
      const pData = pCtx.createImageData(settings.targetWidth, settings.targetHeight);
      for (let y = 0; y < settings.targetHeight; y++) {
        for (let x = 0; x < settings.targetWidth; x++) {
          const cell = cells[`${y},${x}`];
          const pIdx = (y * settings.targetWidth + x) * 4;
          const dmc = DMC_COLORS.find(c => c.number === cell.dmcNumber);
          if (dmc) {
            pData.data[pIdx] = dmc.r;
            pData.data[pIdx + 1] = dmc.g;
            pData.data[pIdx + 2] = dmc.b;
          }
          pData.data[pIdx + 3] = 255;
        }
      }
      pCtx.putImageData(pData, 0, 0);

      setResult({
        cells,
        previewUrl: previewCanvas.toDataURL(),
        colorMappings,
        width: settings.targetWidth,
        height: settings.targetHeight,
      });
    } catch (err) {
      console.error('Conversion failed:', err);
      alert('Image conversion failed. Please try again.');
    } finally {
      setConverting(false);
    }
  }, [imageUrl, settings, palette]);

  const applyResult = useCallback(() => {
    if (!result) return;
    setConfig({ width: result.width, height: result.height });
    loadCells(result.cells);
    setIsOpen(false);
    setImageUrl(null);
    setResult(null);
  }, [result, setConfig, loadCells]);

  const close = () => {
    setIsOpen(false);
    setImageUrl(null);
    setResult(null);
  };

  const poorMatches = result?.colorMappings.filter(m => m.deltaE > 6) || [];

  return (
    <>
      <button className="tool-btn" onClick={() => setIsOpen(true)} title="Import Image">
        <span className="tool-icon">📷</span>
        <span className="tool-name">Import</span>
      </button>

      {isOpen && (
        <div className="import-overlay" onClick={close}>
          <div className={`import-dialog ${result ? 'import-dialog--wide' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="import-header">
              <span className="import-title">
                {result ? 'Review Color Mapping' : 'Import Image to Pattern'}
              </span>
              <button className="import-close" onClick={close}>✕</button>
            </div>

            {!imageUrl && !result ? (
              <div
                className="import-dropzone"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon">📷</div>
                <div className="dropzone-text">Drop an image here or click to browse</div>
                <div className="dropzone-hint">Supports JPG, PNG, GIF, BMP</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
              </div>
            ) : result ? (
              /* ─── Review Panel ─────────────────────────────── */
              <div className="import-review">
                <div className="review-previews">
                  {imageUrl && (
                    <div className="preview-box">
                      <div className="preview-label">Original</div>
                      <img src={imageUrl} alt="Original" className="preview-image" />
                    </div>
                  )}
                  <div className="preview-box">
                    <div className="preview-label">Pattern Preview</div>
                    <img src={result.previewUrl} alt="Preview" className="preview-image pixelated" />
                    <div className="preview-info">{result.width} x {result.height} stitches</div>
                  </div>
                </div>

                {poorMatches.length > 0 && (
                  <div className="review-warning">
                    {poorMatches.length} color{poorMatches.length > 1 ? 's' : ''} with poor DMC match
                    (Delta-E &gt; 6) — consider swapping to alternatives below
                  </div>
                )}

                <div className="review-summary">
                  {result.colorMappings.length} colors mapped &middot;{' '}
                  {result.width * result.height} total stitches
                </div>

                <div className="color-map-table">
                  <div className="color-map-header">
                    <span className="cm-col cm-swatch">Color</span>
                    <span className="cm-col cm-dmc">DMC</span>
                    <span className="cm-col cm-deltae">Match</span>
                    <span className="cm-col cm-count">Stitches</span>
                    <span className="cm-col cm-alts">Alternatives</span>
                  </div>
                  {result.colorMappings.map(mapping => (
                    <ColorMappingRow
                      key={mapping.dmc.number}
                      mapping={mapping}
                      onSwap={swapColor}
                    />
                  ))}
                </div>

                <div className="import-actions">
                  <button className="import-btn secondary" onClick={() => setResult(null)}>
                    Back to Settings
                  </button>
                  <button className="import-btn primary" onClick={applyResult}>
                    Apply to Canvas
                  </button>
                </div>
              </div>
            ) : (
              /* ─── Settings Panel ───────────────────────────── */
              <div className="import-content">
                <div className="import-previews">
                  <div className="preview-box">
                    <div className="preview-label">Original</div>
                    <img src={imageUrl!} alt="Original" className="preview-image" />
                    {imageSize && <div className="preview-info">{imageSize.w} x {imageSize.h}px</div>}
                  </div>
                </div>

                <div className="import-settings">
                  <div className="import-row">
                    <label>Width (stitches)</label>
                    <input
                      type="number" min={10} max={500}
                      value={settings.targetWidth}
                      onChange={e => handleWidthChange(Number(e.target.value))}
                    />
                  </div>
                  <div className="import-row">
                    <label>Height (stitches)</label>
                    <input
                      type="number" min={10} max={500}
                      value={settings.targetHeight}
                      onChange={e => handleHeightChange(Number(e.target.value))}
                    />
                  </div>
                  <div className="import-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.lockAspect}
                        onChange={e => setSettings(s => ({ ...s, lockAspect: e.target.checked }))}
                      />
                      Lock aspect ratio
                    </label>
                  </div>
                  <div className="import-row">
                    <label>Colors (2-50)</label>
                    <input
                      type="number" min={2} max={50}
                      value={settings.colorCount}
                      onChange={e => setSettings(s => ({ ...s, colorCount: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="import-row">
                    <label>Dithering</label>
                    <select
                      value={settings.ditherMode}
                      onChange={e => setSettings(s => ({ ...s, ditherMode: e.target.value as DitherMode }))}
                      className="import-select"
                    >
                      <option value="none">None (flat)</option>
                      <option value="floyd-steinberg">Floyd-Steinberg</option>
                      <option value="ordered">Ordered (Bayer 4x4)</option>
                    </select>
                  </div>
                  <div className="import-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.restrictToPalette}
                        onChange={e => setSettings(s => ({ ...s, restrictToPalette: e.target.checked }))}
                      />
                      Restrict to project palette ({palette.length} colors)
                    </label>
                  </div>
                  {paletteWarning && (
                    <div className="import-palette-warning">{paletteWarning}</div>
                  )}
                </div>

                <div className="import-actions">
                  <button className="import-btn secondary" onClick={() => { setImageUrl(null); setResult(null); }}>
                    Choose Different Image
                  </button>
                  <button
                    className="import-btn primary"
                    onClick={convertImage}
                    disabled={converting || (settings.restrictToPalette && palette.length === 0)}
                  >
                    {converting ? 'Converting...' : 'Convert & Review'}
                  </button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Color Mapping Row Component ─────────────────────────────────────

function ColorMappingRow({
  mapping,
  onSwap,
}: {
  mapping: ColorMapping;
  onSwap: (oldDmcNumber: string, newDmc: DmcColor) => void;
}) {
  const [showAlts, setShowAlts] = useState(false);
  const quality = getMatchQuality(mapping.deltaE);
  const qualityColor = getMatchQualityColor(quality);
  const qualityLabel = getMatchQualityLabel(quality);

  return (
    <div className={`color-map-row ${mapping.deltaE > 6 ? 'color-map-row--poor' : ''}`}>
      <span className="cm-col cm-swatch">
        <span
          className="cm-swatch-box"
          style={{ background: `rgb(${mapping.centroidR},${mapping.centroidG},${mapping.centroidB})` }}
          title={`Original: rgb(${mapping.centroidR},${mapping.centroidG},${mapping.centroidB})`}
        />
        <span className="cm-arrow">→</span>
        <span
          className="cm-swatch-box"
          style={{ background: mapping.dmc.hex }}
          title={`DMC ${mapping.dmc.number}: ${mapping.dmc.hex}`}
        />
      </span>
      <span className="cm-col cm-dmc" title={mapping.dmc.name}>
        {mapping.dmc.number}
      </span>
      <span className="cm-col cm-deltae">
        <span className="cm-quality-dot" style={{ background: qualityColor }} />
        <span className="cm-deltae-value">{mapping.deltaE.toFixed(1)}</span>
        <span className="cm-quality-label">{qualityLabel}</span>
      </span>
      <span className="cm-col cm-count">{mapping.stitchCount}</span>
      <span className="cm-col cm-alts">
        <button
          className="cm-alts-btn"
          onClick={() => setShowAlts(!showAlts)}
          title="Show alternatives"
        >
          {showAlts ? 'Hide' : 'Swap'}
        </button>
      </span>

      {showAlts && (
        <div className="cm-alts-panel">
          {mapping.alternatives.map(alt => {
            const aq = getMatchQuality(alt.deltaE);
            return (
              <button
                key={alt.color.number}
                className="cm-alt-option"
                onClick={() => {
                  onSwap(mapping.dmc.number, alt.color);
                  setShowAlts(false);
                }}
                title={`${alt.color.name} — Delta-E ${alt.deltaE.toFixed(1)}`}
              >
                <span className="cm-swatch-box cm-swatch-sm" style={{ background: alt.color.hex }} />
                <span className="cm-alt-number">{alt.color.number}</span>
                <span className="cm-alt-de" style={{ color: getMatchQualityColor(aq) }}>
                  ΔE {alt.deltaE.toFixed(1)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

