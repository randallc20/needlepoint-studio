import { useCanvasStore } from '../../store/canvasStore';
import type { Tool, StitchType } from '../../types';
import './Toolbar.css';

const TOOLS: { id: Tool; label: string; icon: string; shortcut: string }[] = [
  { id: 'pencil', label: 'Pencil', icon: '✏️', shortcut: 'P' },
  { id: 'fill', label: 'Fill Bucket', icon: '🪣', shortcut: 'F' },
  { id: 'eyedropper', label: 'Eyedropper', icon: '💉', shortcut: 'I' },
  { id: 'eraser', label: 'Eraser', icon: '🧹', shortcut: 'E' },
  { id: 'line', label: 'Line', icon: '╱', shortcut: 'L' },
  { id: 'rectangle', label: 'Rectangle', icon: '▭', shortcut: 'R' },
];

const STITCH_TYPES: { id: StitchType; label: string }[] = [
  { id: 'tent', label: 'Tent' },
  { id: 'continental', label: 'Continental' },
  { id: 'basketweave', label: 'Basketweave' },
  { id: 'longstitch', label: 'Long Stitch' },
  { id: 'backstitch', label: 'Backstitch' },
  { id: 'frenchknot', label: 'French Knot' },
];

export function Toolbar() {
  const activeTool = useCanvasStore(s => s.activeTool);
  const activeStitchType = useCanvasStore(s => s.activeStitchType);
  const zoom = useCanvasStore(s => s.zoom);
  const showGrid = useCanvasStore(s => s.showGrid);
  const setTool = useCanvasStore(s => s.setTool);
  const setStitchType = useCanvasStore(s => s.setStitchType);
  const setZoom = useCanvasStore(s => s.setZoom);
  const toggleGrid = useCanvasStore(s => s.toggleGrid);
  const undo = useCanvasStore(s => s.undo);
  const redo = useCanvasStore(s => s.redo);
  const clearCanvas = useCanvasStore(s => s.clearCanvas);

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <div className="toolbar-label">Tools</div>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => setTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-name">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <div className="toolbar-label">Stitch Type</div>
        <select
          className="stitch-select"
          value={activeStitchType}
          onChange={e => setStitchType(e.target.value as StitchType)}
        >
          {STITCH_TYPES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <div className="toolbar-label">History</div>
        <button className="tool-btn" onClick={undo} title="Undo (Ctrl+Z)">↩ Undo</button>
        <button className="tool-btn" onClick={redo} title="Redo (Ctrl+Y)">↪ Redo</button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <div className="toolbar-label">View</div>
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={() => setZoom(zoom / 1.25)}>−</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={() => setZoom(zoom * 1.25)}>+</button>
        </div>
        <button
          className={`tool-btn ${showGrid ? 'active' : ''}`}
          onClick={toggleGrid}
          title="Toggle Grid"
        >
          ⊞ Grid
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className="tool-btn danger"
          onClick={() => {
            if (confirm('Clear the entire canvas? This cannot be undone easily.')) {
              clearCanvas();
            }
          }}
        >
          🗑 Clear
        </button>
      </div>
    </div>
  );
}
