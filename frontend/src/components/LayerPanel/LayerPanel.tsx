import { useState, useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import './LayerPanel.css';

const GROUP_OUTLINE_COLORS = ['#f59e0b', '#06b6d4', '#84cc16', '#ec4899', '#8b5cf6', '#f97316'];

export function LayerPanel() {
  const layers = useCanvasStore(s => s.layers);
  const activeLayerId = useCanvasStore(s => s.activeLayerId);
  const addLayer = useCanvasStore(s => s.addLayer);
  const removeLayer = useCanvasStore(s => s.removeLayer);
  const setActiveLayer = useCanvasStore(s => s.setActiveLayer);
  const toggleLayerVisibility = useCanvasStore(s => s.toggleLayerVisibility);
  const renameLayer = useCanvasStore(s => s.renameLayer);
  const mergeLayers = useCanvasStore(s => s.mergeLayers);
  const groups = useCanvasStore(s => s.groups);
  const toggleGroupLock = useCanvasStore(s => s.toggleGroupLock);
  const renameGroup = useCanvasStore(s => s.renameGroup);
  const setSelection = useCanvasStore(s => s.setSelection);
  const ungroupSelection = useCanvasStore(s => s.ungroupSelection);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [collapsed, setCollapsed] = useState(false);

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

  const startGroupEdit = (id: string, name: string) => {
    setEditingGroupId(id);
    setEditGroupName(name);
  };

  const finishGroupEdit = () => {
    if (editingGroupId && editGroupName.trim()) {
      renameGroup(editingGroupId, editGroupName.trim());
    }
    setEditingGroupId(null);
  };

  // Show layers in reverse order (top layer first visually)
  const reversedLayers = [...layers].reverse();

  // Groups on active layer
  const activeGroups = useMemo(() => {
    return Object.values(groups).filter(g => g.layerId === activeLayerId);
  }, [groups, activeLayerId]);

  const handleGroupClick = (groupId: string) => {
    const group = groups[groupId];
    if (group) {
      setSelection(new Set(group.cellKeys));
    }
  };

  const handleDeleteGroup = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    const group = groups[groupId];
    if (group) {
      // Select the group's cells then ungroup
      setSelection(new Set(group.cellKeys));
      ungroupSelection();
    }
  };

  if (collapsed) {
    return (
      <div className="panel-collapsed-bar" onClick={() => setCollapsed(false)} title="Expand Layers">
        <span className="panel-collapsed-title">Layers</span>
      </div>
    );
  }

  return (
    <div className="layer-panel">
      <div className="layer-header">
        <span className="layer-title">Layers</span>
        <div className="layer-actions">
          <button className="panel-collapse-btn" onClick={() => setCollapsed(true)} title="Collapse">&#x2039;</button>
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
                {Object.keys(layer.cells).length} sts
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

      {/* Groups section */}
      <div className="groups-section">
        <div className="groups-header">
          <span className="groups-title">Groups ({activeGroups.length})</span>
        </div>
        {activeGroups.length === 0 ? (
          <div className="groups-empty">No groups on this layer</div>
        ) : (
          <div className="groups-list">
            {activeGroups.map((group, idx) => (
              <div
                key={group.id}
                className="group-item"
                onClick={() => handleGroupClick(group.id)}
                title={`${group.name} — ${group.cellKeys.size} cells — click to select`}
              >
                <div
                  className="group-color-dot"
                  style={{ background: GROUP_OUTLINE_COLORS[idx % GROUP_OUTLINE_COLORS.length] }}
                />
                {editingGroupId === group.id ? (
                  <input
                    className="group-name-input"
                    value={editGroupName}
                    onChange={e => setEditGroupName(e.target.value)}
                    onBlur={finishGroupEdit}
                    onKeyDown={e => { if (e.key === 'Enter') finishGroupEdit(); if (e.key === 'Escape') setEditingGroupId(null); }}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="group-name"
                    onDoubleClick={e => { e.stopPropagation(); startGroupEdit(group.id, group.name); }}
                  >
                    {group.name}
                  </span>
                )}
                <span className="group-count">{group.cellKeys.size}</span>
                <button
                  className="group-lock-btn"
                  onClick={e => { e.stopPropagation(); toggleGroupLock(group.id); }}
                  title={group.locked ? 'Unlock group' : 'Lock group'}
                >
                  {group.locked ? '🔒' : '🔓'}
                </button>
                <button
                  className="group-delete-btn"
                  onClick={e => handleDeleteGroup(e, group.id)}
                  title="Ungroup"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
