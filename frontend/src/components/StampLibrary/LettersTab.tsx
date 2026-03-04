import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { findNearestDmcColor } from '../../data/dmcColors';
import type { StitchCell } from '../../types';
import './LettersTab.css';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

// Google Fonts that need loading
const GOOGLE_FONT_NAMES = [
  'Dancing Script',
  'Great Vibes',
  'Pacifico',
  'Sacramento',
  'Lobster',
  'Satisfy',
  'Playfair Display',
  'Cinzel',
];

let fontsLoaded = false;
function loadGoogleFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const families = GOOGLE_FONT_NAMES.map(f => f.replace(/ /g, '+')).join('&family=');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  document.head.appendChild(link);
}

const SIZE_PRESETS = [
  { label: 'Small', value: 15 },
  { label: 'Medium', value: 25 },
  { label: 'Large', value: 40 },
  { label: 'Custom', value: 0 },
] as const;

const FONTS = [
  // Sans-serif
  { name: 'Arial', family: 'Arial, sans-serif' },
  { name: 'Verdana', family: 'Verdana, sans-serif' },
  { name: 'Impact', family: 'Impact, sans-serif' },
  // Serif
  { name: 'Georgia', family: 'Georgia, serif' },
  { name: 'Times New Roman', family: '"Times New Roman", serif' },
  // Monospace
  { name: 'Courier New', family: '"Courier New", monospace' },
  // Cursive / Script (Google Fonts)
  { name: 'Dancing Script', family: '"Dancing Script", cursive' },
  { name: 'Great Vibes', family: '"Great Vibes", cursive' },
  { name: 'Pacifico', family: '"Pacifico", cursive' },
  { name: 'Sacramento', family: '"Sacramento", cursive' },
  { name: 'Lobster', family: '"Lobster", cursive' },
  { name: 'Satisfy', family: '"Satisfy", cursive' },
  // Decorative (Google Fonts)
  { name: 'Playfair Display', family: '"Playfair Display", serif' },
  { name: 'Cinzel', family: '"Cinzel", serif' },
];

interface RasterResult {
  cells: Record<string, StitchCell>;
  width: number;
  height: number;
}

function rasterizeText(
  text: string,
  fontFamily: string,
  sizePx: number,
  hexColor: string,
  dmcNumber: string | null,
): RasterResult {
  if (!text) return { cells: {}, width: 1, height: 1 };

  // Measure text to determine canvas size
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  measureCtx.font = `bold ${sizePx}px ${fontFamily}`;
  const metrics = measureCtx.measureText(text);
  const textWidth = Math.ceil(metrics.width);

  const pad = Math.ceil(sizePx * 0.5);
  const canvasW = textWidth + pad * 2;
  const canvasH = sizePx + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = hexColor;
  ctx.font = `bold ${sizePx}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillText(text, pad, pad);

  const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
  const { data } = imageData;

  // Find bounding box of opaque pixels
  let minRow = canvasH, maxRow = 0, minCol = canvasW, maxCol = 0;
  for (let row = 0; row < canvasH; row++) {
    for (let col = 0; col < canvasW; col++) {
      const alpha = data[(row * canvasW + col) * 4 + 3];
      if (alpha > 128) {
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
      }
    }
  }

  if (minRow > maxRow) {
    return { cells: {}, width: 1, height: 1 };
  }

  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;
  const cells: Record<string, StitchCell> = {};

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const alpha = data[(row * canvasW + col) * 4 + 3];
      if (alpha > 128) {
        cells[`${row - minRow},${col - minCol}`] = {
          color: hexColor,
          dmcNumber,
          stitchType: 'tent',
        };
      }
    }
  }

  return { cells, width, height };
}

export function LettersTab() {
  const activeColor = useCanvasStore(s => s.activeColor);
  const activeDmcNumber = useCanvasStore(s => s.activeDmcNumber);

  const [mode, setMode] = useState<'letter' | 'phrase'>('letter');
  const [letterCase, setLetterCase] = useState<'upper' | 'lower'>('upper');
  const [selectedLetter, setSelectedLetter] = useState('A');
  const [phrase, setPhrase] = useState('');
  const [sizePreset, setSizePreset] = useState('Medium');
  const [customSize, setCustomSize] = useState(25);
  const [fontIdx, setFontIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { loadGoogleFonts(); }, []);

  const letters = letterCase === 'upper' ? UPPER : LOWER;

  const effectiveSize = sizePreset === 'Custom'
    ? Math.max(5, Math.min(100, customSize))
    : SIZE_PRESETS.find(p => p.label === sizePreset)!.value;

  const font = FONTS[fontIdx];
  const displayText = mode === 'letter' ? selectedLetter : phrase;

  // Get DMC color info for display
  const colorMatch = activeColor
    ? (() => {
        const r = parseInt(activeColor.slice(1, 3), 16);
        const g = parseInt(activeColor.slice(3, 5), 16);
        const b = parseInt(activeColor.slice(5, 7), 16);
        return findNearestDmcColor(r, g, b);
      })()
    : null;

  // Draw preview
  const drawPreview = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Rasterize at actual size to get pixel grid
    const result = rasterizeText(displayText, font.family, effectiveSize, activeColor, activeDmcNumber);

    // Draw preview: each cell = a small square
    const maxDim = Math.max(result.width, result.height, 1);
    const cellPx = Math.max(1, Math.floor(140 / maxDim));
    const pw = result.width * cellPx;
    const ph = result.height * cellPx;

    canvas.width = Math.max(pw, 20);
    canvas.height = Math.max(ph, 20);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const [key, cell] of Object.entries(result.cells)) {
      if (!cell.color) continue;
      const [r, c] = key.split(',').map(Number);
      ctx.fillStyle = cell.color;
      ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
    }

    // Grid lines if cells are large enough
    if (cellPx >= 3) {
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= result.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellPx, 0);
        ctx.lineTo(x * cellPx, ph);
        ctx.stroke();
      }
      for (let y = 0; y <= result.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellPx);
        ctx.lineTo(pw, y * cellPx);
        ctx.stroke();
      }
    }
  }, [displayText, font.family, effectiveSize, activeColor, activeDmcNumber]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleAddToCanvas = () => {
    const result = rasterizeText(displayText, font.family, effectiveSize, activeColor, activeDmcNumber);
    if (Object.keys(result.cells).length === 0) {
      setToast('No pixels to add');
      return;
    }
    const store = useCanvasStore.getState();

    // Set clipboard (pasteClipboard reads from it)
    useCanvasStore.setState({
      clipboard: { cells: result.cells, width: result.width, height: result.height },
    });

    // Paste at canvas center
    const centerR = Math.floor(store.config.height / 2) - Math.floor(result.height / 2);
    const centerC = Math.floor(store.config.width / 2) - Math.floor(result.width / 2);
    store.pasteClipboard(centerR, centerC);

    // Group so it always moves as a unit
    store.groupSelection();

    // Switch to select tool so user can immediately drag
    useCanvasStore.setState({ activeTool: 'select' });

    setToast('Letter placed — drag to reposition');
  };

  const handleCaseToggle = (newCase: 'upper' | 'lower') => {
    setLetterCase(newCase);
    // Keep same letter position
    const idx = (newCase === 'upper' ? UPPER : LOWER).indexOf(
      newCase === 'upper' ? selectedLetter.toUpperCase() : selectedLetter.toLowerCase()
    );
    if (idx >= 0) {
      setSelectedLetter((newCase === 'upper' ? UPPER : LOWER)[idx]);
    }
  };

  return (
    <div className="letters-tab">
      {/* Mode toggle */}
      <div className="letters-case-toggle">
        <button
          className={`letters-case-btn ${mode === 'letter' ? 'active' : ''}`}
          onClick={() => setMode('letter')}
        >
          Letter
        </button>
        <button
          className={`letters-case-btn ${mode === 'phrase' ? 'active' : ''}`}
          onClick={() => setMode('phrase')}
        >
          Phrase
        </button>
      </div>

      {mode === 'letter' && <>
        {/* Case toggle */}
        <div className="letters-case-toggle">
          <button
            className={`letters-case-btn ${letterCase === 'upper' ? 'active' : ''}`}
            onClick={() => handleCaseToggle('upper')}
          >
            ABC
          </button>
          <button
            className={`letters-case-btn ${letterCase === 'lower' ? 'active' : ''}`}
            onClick={() => handleCaseToggle('lower')}
          >
            abc
          </button>
        </div>

        {/* Letter grid */}
        <div className="letters-grid">
          {letters.split('').map(ch => (
            <button
              key={ch}
              className={`letters-cell ${selectedLetter === ch ? 'active' : ''}`}
              onClick={() => setSelectedLetter(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      </>}

      {mode === 'phrase' && (
        <div className="letters-phrase-input">
          <input
            type="text"
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            placeholder="Type your text..."
            className="letters-text-field"
            maxLength={50}
          />
        </div>
      )}

      {/* Controls */}
      <div className="letters-controls">
        <div className="letters-row">
          <label>Size</label>
          <select
            value={sizePreset}
            onChange={e => {
              setSizePreset(e.target.value);
              const preset = SIZE_PRESETS.find(p => p.label === e.target.value);
              if (preset && preset.value > 0) setCustomSize(preset.value);
            }}
            className="letters-select"
          >
            {SIZE_PRESETS.map(p => (
              <option key={p.label} value={p.label}>
                {p.label}{p.value > 0 ? ` (${p.value})` : ''}
              </option>
            ))}
          </select>
        </div>
        {sizePreset === 'Custom' && (
          <div className="letters-row">
            <label>Stitches</label>
            <input
              type="number"
              min={5}
              max={100}
              value={customSize}
              onChange={e => setCustomSize(Number(e.target.value))}
              className="letters-number-input"
            />
          </div>
        )}
        <div className="letters-row">
          <label>Font</label>
          <select
            value={fontIdx}
            onChange={e => setFontIdx(Number(e.target.value))}
            className="letters-select"
          >
            {FONTS.map((f, i) => (
              <option key={f.name} value={i}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="letters-row">
          <label>Color</label>
          <div className="letters-color-info">
            <div
              className="letters-color-swatch"
              style={{ backgroundColor: activeColor }}
            />
            <span className="letters-color-label">
              {activeDmcNumber ? `DMC ${activeDmcNumber}` : colorMatch ? `DMC ${colorMatch.color.number}` : activeColor}
            </span>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="letters-preview-wrap">
        <canvas ref={previewRef} className="letters-preview-canvas" />
      </div>

      {/* Add button */}
      <button
        className="letters-add-btn"
        onClick={handleAddToCanvas}
        disabled={mode === 'phrase' && !phrase.trim()}
      >
        Add to Canvas
      </button>

      {toast && <div className="letters-toast">{toast}</div>}
    </div>
  );
}
