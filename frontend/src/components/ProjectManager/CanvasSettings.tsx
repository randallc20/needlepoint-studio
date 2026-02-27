import { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import type { CanvasConfig } from '../../types';
import './CanvasSettings.css';

const MESH_COUNTS = [10, 13, 14, 18, 22] as const;

export function CanvasSettings() {
  const config = useCanvasStore(s => s.config);
  const setConfig = useCanvasStore(s => s.setConfig);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<CanvasConfig>(config);

  const open = () => {
    setDraft(config);
    setIsOpen(true);
  };

  const apply = () => {
    setConfig(draft);
    setIsOpen(false);
  };

  const physicalWidth = (config.width / config.meshCount).toFixed(1);
  const physicalHeight = (config.height / config.meshCount).toFixed(1);

  return (
    <>
      <button className="settings-trigger" onClick={open} title="Canvas Settings">
        ⚙ Canvas: {config.width}×{config.height} ({config.meshCount}-count)
        &nbsp;|&nbsp;{physicalWidth}"×{physicalHeight}"
      </button>

      {isOpen && (
        <div className="settings-overlay" onClick={() => setIsOpen(false)}>
          <div className="settings-dialog" onClick={e => e.stopPropagation()}>
            <div className="settings-title">Canvas Settings</div>

            <div className="settings-row">
              <label>Width (stitches)</label>
              <input
                type="number"
                min={10} max={500}
                value={draft.width}
                onChange={e => setDraft(d => ({ ...d, width: Number(e.target.value) }))}
              />
            </div>

            <div className="settings-row">
              <label>Height (stitches)</label>
              <input
                type="number"
                min={10} max={500}
                value={draft.height}
                onChange={e => setDraft(d => ({ ...d, height: Number(e.target.value) }))}
              />
            </div>

            <div className="settings-row">
              <label>Mesh Count</label>
              <select
                value={draft.meshCount}
                onChange={e => setDraft(d => ({ ...d, meshCount: Number(e.target.value) as typeof MESH_COUNTS[number] }))}
              >
                {MESH_COUNTS.map(m => (
                  <option key={m} value={m}>{m}-count ({(draft.width / m).toFixed(1)}"×{(draft.height / m).toFixed(1)}")</option>
                ))}
              </select>
            </div>

            <div className="settings-preview">
              Physical size: <strong>{(draft.width / draft.meshCount).toFixed(1)}"</strong> × <strong>{(draft.height / draft.meshCount).toFixed(1)}"</strong>
              &nbsp;({draft.width * draft.height} total stitches)
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
