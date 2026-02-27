import { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import './LayerPanel.css';

export function LayerPanel() {
  const layers = useCanvasStore(s => s.layers);
  const activeLayerId = useCanvasStore(s => s.activeLayerId);
  const addLayer = useCanvasStore(s => s.addLayer);
  const removeLayer = useCanvasStore(s => s.removeLayer);
  const setActiveLayer = useCanvasStore(s => s.setActiveLayer);
  const toggleLayerVisibility = useCanvasStore(s => s.toggleLayerVisibility);
  const renameLayer = useCanvasStore(s => s.renameLayer);
  const mergeLayers = useCanvasStore(s => s.mergeLayers);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const finishEdit = () => {
    if (editingId && editName.trim()) {
      renameLayer(editingId, editName.trim());
    }
    setEditingId(null);
  };

  // Show layers in reverse order (top layer first visually)
  const reversedLayers = [...layers].reverse();

  return (
    <div className="layer-panel">
      <div className="layer-header">
        <span className="layer-title">Layers</span>
        <div className="layer-actions">
          <button className="layer-icon-btn" onClick={addLayer} title="Add Layer">+</button>
          <button
            className="layer-icon-btn"
            onClick={() => { if (confirm('Merge all layers into one?')) mergeLayers(); }}
            title="Merge All Layers"
          >
            ⊞
          </button>
        </div>
      </div>

      <div className="layer-list">
        {reversedLayers.map(layer => {
          const isActive = layer.id === activeLayerId;
          return (
            <div
              key={layer.id}
              className={`layer-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              <button
                className="layer-visibility"
                onClick={e => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? '👁' : '🚫'}
              </button>

              {editingId === layer.id ? (
                <input
                  className="layer-name-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={finishEdit}
                  onKeyDown={e => { if (e.key === 'Enter') finishEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="layer-name"
                  onDoubleClick={e => { e.stopPropagation(); startEdit(layer.id, layer.name); }}
                >
                  {layer.name}
                </span>
              )}

              <div className="layer-cell-count">
                {layer.cells.size} sts
              </div>

              {layers.length > 1 && (
                <button
                  className="layer-delete"
                  onClick={e => { e.stopPropagation(); removeLayer(layer.id); }}
                  title="Delete layer"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
