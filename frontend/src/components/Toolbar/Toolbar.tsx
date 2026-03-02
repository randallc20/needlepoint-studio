import { useCanvasStore } from '../../store/canvasStore';
import { ImageImport } from '../ImageImport/ImageImport';
import { ExportPanel } from '../ExportPanel/ExportPanel';
import type { Tool, StitchType } from '../../types';
import type { ViewMode } from '../../data/symbolSet';
import './Toolbar.css';

const TOOLS: { id: Tool; label: string; icon: string; shortcut: string }[] = [
  { id: 'pointer', label: 'Pointer', icon: '↖', shortcut: 'V' },
  { id: 'select', label: 'Select', icon: '⬚', shortcut: 'S' },
  { id: 'pencil', label: 'Pencil', icon: '✏️', shortcut: 'P' },
  { id: 'fill', label: 'Fill Bucket', icon: '🪣', shortcut: 'F' },
  { id: 'eyedropper', label: 'Eyedropper', icon: '💉', shortcut: 'I' },
  { id: 'eraser', label: 'Eraser', icon: '🧹', shortcut: 'E' },
  { id: 'line', label: 'Line', icon: '╱', shortcut: 'L' },
  { id: 'rectangle', label: 'Rectangle', icon: '▭', shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', icon: '◯', shortcut: 'C' },
];

const STITCH_TYPES: { id: StitchType; label: string }[] = [
  { id: 'tent', label: 'Tent' },
  { id: 'continental', label: 'Continental' },
  { id: 'basketweave', label: 'Basketweave' },
  { id: 'longstitch', label: 'Long Stitch' },
  { id: 'backstitch', label: 'Backstitch' },
  { id: 'frenchknot', label: 'French Knot' },
];

const ERASER_SIZES = [1, 3, 5, 7];

export function Toolbar() {
  const activeTool = useCanvasStore(s => s.activeTool);
  const activeStitchType = useCanvasStore(s => s.activeStitchType);
  const eraserSize = useCanvasStore(s => s.eraserSize);
  const zoom = useCanvasStore(s => s.zoom);
  const showGrid = useCanvasStore(s => s.showGrid);
  const setTool = useCanvasStore(s => s.setTool);
  const setStitchType = useCanvasStore(s => s.setStitchType);
  const setEraserSize = useCanvasStore(s => s.setEraserSize);
  const setZoom = useCanvasStore(s => s.setZoom);
  const scrollZoomEnabled = useCanvasStore(s => s.scrollZoomEnabled);
  const toggleScrollZoom = useCanvasStore(s => s.toggleScrollZoom);
  const toggleGrid = useCanvasStore(s => s.toggleGrid);
  const viewMode = useCanvasStore(s => s.viewMode);
  const setViewMode = useCanvasStore(s => s.setViewMode);
  const showStitchOverlays = useCanvasStore(s => s.showStitchOverlays);
  const toggleStitchOverlays = useCanvasStore(s => s.toggleStitchOverlays);
  const shapeFilled = useCanvasStore(s => s.shapeFilled);
  const toggleShapeFilled = useCanvasStore(s => s.toggleShapeFilled);
  const undo = useCanvasStore(s => s.undo);
  const redo = useCanvasStore(s => s.redo);
  const clearCanvas = useCanvasStore(s => s.clearCanvas);
  const selection = useCanvasStore(s => s.selection);
  const clearSelection = useCanvasStore(s => s.clearSelection);
  const deleteSelection = useCanvasStore(s => s.deleteSelection);
  const groupSelection = useCanvasStore(s => s.groupSelection);
  const ungroupSelection = useCanvasStore(s => s.ungroupSelection);
  const copySelection = useCanvasStore(s => s.copySelection);
  const pasteClipboard = useCanvasStore(s => s.pasteClipboard);
  const clipboard = useCanvasStore(s => s.clipboard);
  const config = useCanvasStore(s => s.config);

  const showShapeOptions = activeTool === 'rectangle' || activeTool === 'ellipse';
  const hasSelection = selection && selection.size > 0;

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

        {/* Eraser size selector - shown when eraser is active */}
        {activeTool === 'eraser' && (
          <div className="eraser-size-row">
            {ERASER_SIZES.map(size => (
              <button
                key={size}
                className={`eraser-size-btn ${eraserSize === size ? 'active' : ''}`}
                onClick={() => setEraserSize(size)}
                title={`${size}x${size} eraser`}
              >
                {size}
              </button>
            ))}
          </div>
        )}

        {/* Filled/Outline toggle - shown for rectangle and ellipse */}
        {showShapeOptions && (
          <div className="shape-fill-row">
            <button
              className={`eraser-size-btn ${!shapeFilled ? 'active' : ''}`}
              onClick={() => { if (shapeFilled) toggleShapeFilled(); }}
              title="Outline"
            >
              Outline
            </button>
            <button
              className={`eraser-size-btn ${shapeFilled ? 'active' : ''}`}
              onClick={() => { if (!shapeFilled) toggleShapeFilled(); }}
              title="Filled"
            >
              Filled
            </button>
          </div>
        )}

        {/* Selection actions - shown when select tool is active */}
        {activeTool === 'select' && (
          <div className="select-actions">
            {hasSelection && (
              <>
                <div className="toolbar-label">Selection ({selection!.size})</div>
                <button className="tool-btn" onClick={deleteSelection} title="Delete (Del)">
                  🗑 Delete
                </button>
                <button className="tool-btn" onClick={copySelection} title="Copy (Ctrl+C)">
                  📋 Copy
                </button>
                <button className="tool-btn" onClick={groupSelection} title="Group (Ctrl+G)">
                  🔗 Group
                </button>
                <button className="tool-btn" onClick={ungroupSelection} title="Ungroup (Ctrl+Shift+G)">
                  ✂ Ungroup
                </button>
                <button className="tool-btn" onClick={clearSelection} title="Deselect (Esc)">
                  ✕ Deselect
                </button>
              </>
            )}
            {clipboard && (
              <button
                className="tool-btn"
                onClick={() => {
                  const centerR = Math.floor(config.height / 2) - Math.floor(clipboard.height / 2);
                  const centerC = Math.floor(config.width / 2) - Math.floor(clipboard.width / 2);
                  pasteClipboard(centerR, centerC);
                }}
                title="Paste (Ctrl+V)"
              >
                📌 Paste
              </button>
            )}
          </div>
        )}
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
        <div className="toolbar-label">Zoom</div>
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={() => setZoom(zoom / 1.25)} title="Zoom out (Ctrl+-)">−</button>
          <span className="zoom-label" onClick={() => setZoom(1)} title="Click to reset to 100%">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={() => setZoom(zoom * 1.25)} title="Zoom in (Ctrl+=)">+</button>
        </div>
        <div className="zoom-presets">
          <button className="zoom-preset-btn" onClick={() => setZoom(0.5)} title="50%">50</button>
          <button className="zoom-preset-btn" onClick={() => setZoom(1)} title="100% (Ctrl+0)">100</button>
          <button className="zoom-preset-btn" onClick={() => setZoom(2)} title="200%">200</button>
          <button className="zoom-preset-btn" onClick={() => setZoom(4)} title="400%">400</button>
        </div>
        <button
          className={`tool-btn scroll-zoom-btn ${scrollZoomEnabled ? 'active' : ''}`}
          onClick={toggleScrollZoom}
          title={scrollZoomEnabled ? 'Scroll zoom ON — mouse wheel zooms in/out. Click to disable.' : 'Scroll zoom OFF — enable to zoom with mouse wheel without Ctrl.'}
        >
          🔍 Scroll Zoom
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <div className="toolbar-label">Display</div>
        <button
          className={`tool-btn ${showGrid ? 'active' : ''}`}
          onClick={toggleGrid}
          title="Show or hide the grid lines overlay"
        >
          ⊞ Grid
        </button>
        <button
          className={`tool-btn ${showStitchOverlays ? 'active' : ''}`}
          onClick={toggleStitchOverlays}
          title="Show or hide stitch direction lines on each cell"
        >
          ✂ Stitches
        </button>
        <div className="toolbar-sublabel">View Mode</div>
        <div className="view-mode-row">
          {(['color', 'symbol', 'combined'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              className={`view-mode-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => setViewMode(mode)}
              title={
                mode === 'color'
                  ? 'Color view \u2014 show thread colors only'
                  : mode === 'symbol'
                  ? 'Symbol view \u2014 show chart symbols only (for printed patterns)'
                  : 'Combined view \u2014 show colors with symbol overlay'
              }
            >
              {mode === 'color' ? 'Color' : mode === 'symbol' ? 'Symbol' : 'Both'}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <div className="toolbar-label">Import</div>
        <ImageImport />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <div className="toolbar-label">Export</div>
        <ExportPanel />
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
