import { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import type { CanvasConfig } from '../../types';
import './CanvasSettings.css';

const MESH_COUNTS = [10, 13, 14, 18, 22] as const;

type InputMode = 'stitches' | 'inches';

interface SizePreset {
  label: string;
  widthInches: number;
  heightInches: number;
  meshCount: typeof MESH_COUNTS[number];
}

const SIZE_PRESETS: SizePreset[] = [
  { label: 'Ornament (4" x 4")', widthInches: 4, heightInches: 4, meshCount: 18 },
  { label: 'Coaster (4" x 4")', widthInches: 4, heightInches: 4, meshCount: 14 },
  { label: 'Eyeglass Case (3.5" x 7")', widthInches: 3.5, heightInches: 7, meshCount: 18 },
  { label: 'Coin Purse (5" x 5")', widthInches: 5, heightInches: 5, meshCount: 18 },
  { label: 'Belt (2" x 36")', widthInches: 2, heightInches: 36, meshCount: 18 },
  { label: 'Clutch (6" x 10")', widthInches: 6, heightInches: 10, meshCount: 14 },
  { label: 'Pillow - Small (10" x 10")', widthInches: 10, heightInches: 10, meshCount: 14 },
  { label: 'Pillow - Medium (12" x 12")', widthInches: 12, heightInches: 12, meshCount: 14 },
  { label: 'Pillow - Large (14" x 14")', widthInches: 14, heightInches: 14, meshCount: 13 },
  { label: 'Wall Art - Small (8" x 10")', widthInches: 8, heightInches: 10, meshCount: 18 },
  { label: 'Wall Art - Medium (12" x 16")', widthInches: 12, heightInches: 16, meshCount: 14 },
  { label: 'Wall Art - Large (16" x 20")', widthInches: 16, heightInches: 20, meshCount: 13 },
  { label: 'Stocking (10" x 18")', widthInches: 10, heightInches: 18, meshCount: 13 },
  { label: 'Luggage Tag (3" x 5")', widthInches: 3, heightInches: 5, meshCount: 18 },
];

export function CanvasSettings() {
  const config = useCanvasStore(s => s.config);
  const setConfig = useCanvasStore(s => s.setConfig);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<CanvasConfig>(config);
  const [inputMode, setInputMode] = useState<InputMode>('stitches');
  // Physical size in inches (derived from draft)
  const [inchWidth, setInchWidth] = useState(() => +(config.width / config.meshCount).toFixed(1));
  const [inchHeight, setInchHeight] = useState(() => +(config.height / config.meshCount).toFixed(1));

  const open = () => {
    setDraft(config);
    setInchWidth(+(config.width / config.meshCount).toFixed(1));
    setInchHeight(+(config.height / config.meshCount).toFixed(1));
    setIsOpen(true);
  };

  const apply = () => {
    setConfig(draft);
    setIsOpen(false);
  };

  const physicalWidth = (draft.width / draft.meshCount).toFixed(1);
  const physicalHeight = (draft.height / draft.meshCount).toFixed(1);

  // When changing inches, update stitch count
  const handleInchWidthChange = (inches: number) => {
    setInchWidth(inches);
    const stitches = Math.round(inches * draft.meshCount);
    setDraft(d => ({ ...d, width: Math.max(10, Math.min(500, stitches)) }));
  };

  const handleInchHeightChange = (inches: number) => {
    setInchHeight(inches);
    const stitches = Math.round(inches * draft.meshCount);
    setDraft(d => ({ ...d, height: Math.max(10, Math.min(500, stitches)) }));
  };

  // When changing mesh count in inches mode, recalculate stitches
  const handleMeshChange = (mesh: number) => {
    const meshTyped = mesh as typeof MESH_COUNTS[number];
    if (inputMode === 'inches') {
      setDraft(d => ({
        ...d,
        meshCount: meshTyped,
        width: Math.max(10, Math.min(500, Math.round(inchWidth * meshTyped))),
        height: Math.max(10, Math.min(500, Math.round(inchHeight * meshTyped))),
      }));
    } else {
      setDraft(d => ({ ...d, meshCount: meshTyped }));
    }
  };

  const applyPreset = (preset: SizePreset) => {
    const w = Math.round(preset.widthInches * preset.meshCount);
    const h = Math.round(preset.heightInches * preset.meshCount);
    setDraft(d => ({ ...d, width: w, height: h, meshCount: preset.meshCount }));
    setInchWidth(preset.widthInches);
    setInchHeight(preset.heightInches);
  };

  // Canvas fabric recommendation (add 2-3 inches on each side for mounting)
  const fabricMargin = 3;
  const fabricWidth = (draft.width / draft.meshCount + fabricMargin * 2).toFixed(1);
  const fabricHeight = (draft.height / draft.meshCount + fabricMargin * 2).toFixed(1);

  return (
    <>
      <button className="settings-trigger" onClick={open} title="Click to open Canvas Settings">
        <span className="settings-dimensions">{config.width} x {config.height}</span>
        <span className="settings-separator">|</span>
        <span className="settings-detail">{config.meshCount}-ct</span>
        <span className="settings-separator">|</span>
        <span className="settings-detail">{(config.width / config.meshCount).toFixed(1)}" x {(config.height / config.meshCount).toFixed(1)}"</span>
        <span className="settings-gear">⚙</span>
      </button>

      {isOpen && (
        <div className="settings-overlay" onClick={() => setIsOpen(false)}>
          <div className="settings-dialog" onClick={e => e.stopPropagation()}>
            <div className="settings-title">Canvas Settings</div>

            <div className="settings-row">
              <label>Size Preset</label>
              <select
                value=""
                onChange={e => {
                  const idx = Number(e.target.value);
                  if (!isNaN(idx) && SIZE_PRESETS[idx]) applyPreset(SIZE_PRESETS[idx]);
                }}
              >
                <option value="" disabled>Choose a preset...</option>
                {SIZE_PRESETS.map((p, i) => (
                  <option key={i} value={i}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="settings-mode-toggle">
              <button
                className={`mode-btn ${inputMode === 'stitches' ? 'active' : ''}`}
                onClick={() => setInputMode('stitches')}
              >
                By Stitch Count
              </button>
              <button
                className={`mode-btn ${inputMode === 'inches' ? 'active' : ''}`}
                onClick={() => setInputMode('inches')}
              >
                By Physical Size
              </button>
            </div>

            {inputMode === 'stitches' ? (
              <>
                <div className="settings-row">
                  <label>Width (stitches)</label>
                  <input
                    type="number"
                    min={10} max={500}
                    value={draft.width}
                    onChange={e => {
                      const w = Number(e.target.value);
                      setDraft(d => ({ ...d, width: w }));
                      setInchWidth(+(w / draft.meshCount).toFixed(1));
                    }}
                  />
                </div>

                <div className="settings-row">
                  <label>Height (stitches)</label>
                  <input
                    type="number"
                    min={10} max={500}
                    value={draft.height}
                    onChange={e => {
                      const h = Number(e.target.value);
                      setDraft(d => ({ ...d, height: h }));
                      setInchHeight(+(h / draft.meshCount).toFixed(1));
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="settings-row">
                  <label>Width (inches)</label>
                  <input
                    type="number"
                    min={0.5} max={30} step={0.5}
                    value={inchWidth}
                    onChange={e => handleInchWidthChange(Number(e.target.value))}
                  />
                </div>

                <div className="settings-row">
                  <label>Height (inches)</label>
                  <input
                    type="number"
                    min={0.5} max={30} step={0.5}
                    value={inchHeight}
                    onChange={e => handleInchHeightChange(Number(e.target.value))}
                  />
                </div>
              </>
            )}

            <div className="settings-row">
              <label>Mesh Count</label>
              <select
                value={draft.meshCount}
                onChange={e => handleMeshChange(Number(e.target.value))}
              >
                {MESH_COUNTS.map(m => (
                  <option key={m} value={m}>
                    {m}-count ({(draft.width / m).toFixed(1)}" x {(draft.height / m).toFixed(1)}")
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-preview">
              <div><strong>Design area:</strong> {physicalWidth}" x {physicalHeight}" ({draft.width} x {draft.height} stitches)</div>
              <div><strong>Total stitches:</strong> {(draft.width * draft.height).toLocaleString()}</div>
              <div><strong>Canvas fabric needed:</strong> {fabricWidth}" x {fabricHeight}" (includes 3" margin per side)</div>
            </div>

            <div className="settings-actions">
              <button className="settings-cancel" onClick={() => setIsOpen(false)}>Cancel</button>
              <button className="settings-apply" onClick={apply}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
