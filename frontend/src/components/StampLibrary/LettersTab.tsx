import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { findNearestDmcColor } from '../../data/dmcColors';
import type { StitchCell, TextMeta } from '../../types';
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

function extractCells(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  hexColor: string,
  dmcNumber: string | null,
): RasterResult {
  const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
  const { data } = imageData;

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

  if (minRow > maxRow) return { cells: {}, width: 1, height: 1 };

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

function rasterizeCurvedText(
  text: string,
  fontFamily: string,
  sizePx: number,
  hexColor: string,
  dmcNumber: string | null,
  curveAmount: number,
): RasterResult {
  if (!text) return { cells: {}, width: 1, height: 1 };
  if (curveAmount === 0) return rasterizeText(text, fontFamily, sizePx, hexColor, dmcNumber);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${sizePx}px ${fontFamily}`;

  // Measure each character
  const chars = text.split('');
  const charWidths = chars.map(ch => ctx.measureText(ch).width);
  const totalWidth = charWidths.reduce((a, b) => a + b, 0);

  if (totalWidth === 0) return { cells: {}, width: 1, height: 1 };

  // Arc parameters: curveAmount ±100 maps to ±π (±180°)
  const arcAngle = (curveAmount / 100) * Math.PI;
  const radius = totalWidth / Math.abs(arcAngle);

  // Canvas size — generous to contain the arc
  const dim = Math.ceil((radius + sizePx) * 2 + sizePx * 2);
  canvas.width = dim;
  canvas.height = dim;
  const cx = dim / 2;
  const cy = curveAmount > 0 ? dim / 2 + radius : dim / 2 - radius;

  // Draw each character along the arc
  ctx.fillStyle = hexColor;
  ctx.font = `bold ${sizePx}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  let accumulated = -totalWidth / 2;
  for (let i = 0; i < chars.length; i++) {
    const halfW = charWidths[i] / 2;
    accumulated += halfW;
    const charAngle = (accumulated / totalWidth) * arcAngle;

    ctx.save();
    ctx.translate(cx, cy);
    if (curveAmount > 0) {
      const angle = -Math.PI / 2 + charAngle;
      ctx.rotate(angle);
      ctx.translate(0, -radius);
    } else {
      const angle = Math.PI / 2 + charAngle;
      ctx.rotate(angle);
      ctx.translate(0, radius);
      ctx.rotate(Math.PI);
    }
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();

    accumulated += halfW;
  }

  return extractCells(ctx, dim, dim, hexColor, dmcNumber);
}

function rotateCells(
  result: RasterResult,
  rotation: 0 | 90 | 180 | 270,
): RasterResult {
  if (rotation === 0) return result;

  const { cells, width, height } = result;
  const rotated: Record<string, StitchCell> = {};
  let newW = width;
  let newH = height;

  for (const [key, cell] of Object.entries(cells)) {
    const [r, c] = key.split(',').map(Number);
    let nr: number, nc: number;

    if (rotation === 90) {
      nr = c;
      nc = height - 1 - r;
      newW = height;
      newH = width;
    } else if (rotation === 180) {
      nr = height - 1 - r;
      nc = width - 1 - c;
    } else {
      // 270
      nr = width - 1 - c;
      nc = r;
      newW = height;
      newH = width;
    }

    rotated[`${nr},${nc}`] = cell;
  }

  return { cells: rotated, width: newW, height: newH };
}

export function LettersTab() {
  const activeColor = useCanvasStore(s => s.activeColor);
  const activeDmcNumber = useCanvasStore(s => s.activeDmcNumber);
  const selection = useCanvasStore(s => s.selection);
  const groups = useCanvasStore(s => s.groups);
  const activeLayerId = useCanvasStore(s => s.activeLayerId);

  const [mode, setMode] = useState<'letter' | 'phrase'>('letter');
  const [letterCase, setLetterCase] = useState<'upper' | 'lower'>('upper');
  const [selectedLetter, setSelectedLetter] = useState('A');
  const [phrase, setPhrase] = useState('');
  const [textSize, setTextSize] = useState(25);
  const [curve, setCurve] = useState(0);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [fontIdx, setFontIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { loadGoogleFonts(); }, []);

  // Detect when a text group is selected
  const selectedTextGroup = useMemo(() => {
    if (!selection || selection.size === 0) return null;
    for (const [id, group] of Object.entries(groups)) {
      if (group.layerId !== activeLayerId || !group.textMeta) continue;
      // Check if the selection matches this group's cells
      const groupKeys = group.cellKeys;
      if (groupKeys.size === 0) continue;
      const allGroupInSelection = [...groupKeys].every(k => selection.has(k));
      const allSelectionInGroup = [...selection].every(k => groupKeys.has(k));
      if (allGroupInSelection && allSelectionInGroup) return { id, ...group };
    }
    return null;
  }, [selection, groups, activeLayerId]);

  // Load text metadata when a text group is selected
  useEffect(() => {
    if (selectedTextGroup && selectedTextGroup.textMeta && editingGroupId !== selectedTextGroup.id) {
      const meta = selectedTextGroup.textMeta;
      setEditingGroupId(selectedTextGroup.id);
      if (meta.text.length === 1) {
        setMode('letter');
        const isUpper = meta.text === meta.text.toUpperCase();
        setLetterCase(isUpper ? 'upper' : 'lower');
        setSelectedLetter(meta.text);
      } else {
        setMode('phrase');
        setPhrase(meta.text);
      }
      setTextSize(meta.sizePx);
      setCurve(meta.curve);
      setRotation(meta.rotation);
      setFontIdx(meta.fontIdx);
    } else if (!selectedTextGroup && editingGroupId) {
      setEditingGroupId(null);
    }
  }, [selectedTextGroup, editingGroupId]);

  const letters = letterCase === 'upper' ? UPPER : LOWER;

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
    const raw = rasterizeCurvedText(displayText, font.family, textSize, activeColor, activeDmcNumber, curve);
    const result = rotateCells(raw, rotation);

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
  }, [displayText, font.family, textSize, curve, rotation, activeColor, activeDmcNumber]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const buildTextMeta = (): TextMeta => ({
    text: displayText,
    fontFamily: font.family,
    fontIdx,
    sizePx: textSize,
    curve,
    rotation,
    hexColor: activeColor,
    dmcNumber: activeDmcNumber,
  });

  const handleAddToCanvas = () => {
    const raw = rasterizeCurvedText(displayText, font.family, textSize, activeColor, activeDmcNumber, curve);
    const result = rotateCells(raw, rotation);
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

    // Attach text metadata to the newly created group
    const storeAfter = useCanvasStore.getState();
    const groupIds = Object.keys(storeAfter.groups);
    if (groupIds.length > 0) {
      const latestGroupId = groupIds[groupIds.length - 1];
      storeAfter.setGroupTextMeta(latestGroupId, buildTextMeta());
    }

    // Switch to select tool so user can immediately drag
    useCanvasStore.setState({ activeTool: 'select' });

    setToast('Letter placed — drag to reposition');
  };

  const handleUpdateText = () => {
    if (!editingGroupId) return;
    const raw = rasterizeCurvedText(displayText, font.family, textSize, activeColor, activeDmcNumber, curve);
    const result = rotateCells(raw, rotation);
    if (Object.keys(result.cells).length === 0) {
      setToast('No pixels to update');
      return;
    }
    const store = useCanvasStore.getState();
    store.replaceGroupCells(editingGroupId, result.cells, result.width, result.height);
    store.setGroupTextMeta(editingGroupId, buildTextMeta());
    setToast('Text updated');
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
      {editingGroupId && (
        <div className="letters-editing-banner">Editing placed text</div>
      )}
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
          <input
            type="range"
            min={5}
            max={80}
            value={textSize}
            onChange={e => setTextSize(Number(e.target.value))}
            className="letters-slider"
          />
          <span className="letters-size-value">{textSize}</span>
        </div>
        <div className="letters-row">
          <label>Curve</label>
          <input
            type="range"
            min={-100}
            max={100}
            value={curve}
            onChange={e => setCurve(Number(e.target.value))}
            className="letters-slider"
          />
          <span className="letters-size-value">{curve}</span>
        </div>
        <div className="letters-row">
          <label>Orient</label>
          <div className="letters-orient-group">
            {([0, 90, 180, 270] as const).map(deg => (
              <button
                key={deg}
                className={`letters-orient-btn ${rotation === deg ? 'active' : ''}`}
                onClick={() => setRotation(deg)}
                title={`${deg}°`}
              >
                <span className="letters-orient-arrow" style={{ transform: `rotate(${deg}deg)` }}>&#8593;</span>
              </button>
            ))}
          </div>
        </div>
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

      {/* Action buttons */}
      {editingGroupId ? (
        <div className="letters-edit-actions">
          <button
            className="letters-add-btn letters-update-btn"
            onClick={handleUpdateText}
            disabled={mode === 'phrase' && !phrase.trim()}
          >
            Update Text
          </button>
          <button
            className="letters-add-btn letters-cancel-btn"
            onClick={() => setEditingGroupId(null)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="letters-add-btn"
          onClick={handleAddToCanvas}
          disabled={mode === 'phrase' && !phrase.trim()}
        >
          Add to Canvas
        </button>
      )}

      {toast && <div className="letters-toast">{toast}</div>}
    </div>
  );
}
