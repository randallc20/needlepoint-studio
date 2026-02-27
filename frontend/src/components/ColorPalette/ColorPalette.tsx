import { useState, useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { DMC_COLORS } from '../../data/dmcColors';
import type { DmcColor } from '../../types';
import './ColorPalette.css';

export function ColorPalette() {
  const activeColor = useCanvasStore(s => s.activeColor);
  const activeDmcNumber = useCanvasStore(s => s.activeDmcNumber);
  const palette = useCanvasStore(s => s.palette);
  const setColor = useCanvasStore(s => s.setColor);
  const addToPalette = useCanvasStore(s => s.addToPalette);
  const removeFromPalette = useCanvasStore(s => s.removeFromPalette);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'palette' | 'dmc'>('palette');

  const filteredDmc = useMemo(() => {
    if (!search.trim()) return DMC_COLORS.slice(0, 60);
    const q = search.toLowerCase();
    return DMC_COLORS.filter(
      c => c.number.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [search]);

  const selectColor = (color: DmcColor) => {
    setColor(color.hex, color.number);
    if (!palette.find(p => p.number === color.number)) {
      addToPalette(color);
    }
  };

  // Yardage calculation
  const layers = useCanvasStore(s => s.layers);
  const config = useCanvasStore(s => s.config);

  const colorCounts = useMemo(() => {
    const counts = new Map<string, { color: DmcColor; count: number }>();
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const cell of layer.cells.values()) {
        if (!cell.dmcNumber) continue;
        const dmc = DMC_COLORS.find(c => c.number === cell.dmcNumber);
        if (!dmc) continue;
        const existing = counts.get(cell.dmcNumber);
        if (existing) existing.count++;
        else counts.set(cell.dmcNumber, { color: dmc, count: 1 });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [layers]);

  const stitchesPerSqIn = config.meshCount * config.meshCount;

  return (
    <div className="color-palette">
      {/* Active color swatch */}
      <div className="active-color-section">
        <div className="active-swatch" style={{ background: activeColor }} />
        <div className="active-info">
          <div className="active-dmc">DMC {activeDmcNumber ?? '—'}</div>
          <div className="active-hex">{activeColor}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="palette-tabs">
        <button
          className={`tab-btn ${tab === 'palette' ? 'active' : ''}`}
          onClick={() => setTab('palette')}
        >
          Palette
        </button>
        <button
          className={`tab-btn ${tab === 'dmc' ? 'active' : ''}`}
          onClick={() => setTab('dmc')}
        >
          DMC Library
        </button>
      </div>

      {tab === 'palette' && (
        <div className="palette-panel">
          {palette.length === 0 && (
            <div className="empty-palette">
              Pick colors from the DMC Library to add to your palette.
            </div>
          )}
          <div className="swatch-grid">
            {palette.map(color => (
              <div
                key={color.number}
                className={`swatch ${activeDmcNumber === color.number ? 'selected' : ''}`}
                style={{ background: color.hex }}
                title={`DMC ${color.number} — ${color.name}`}
                onClick={() => selectColor(color)}
                onContextMenu={e => {
                  e.preventDefault();
                  removeFromPalette(color.number);
                }}
              />
            ))}
          </div>

          {colorCounts.length > 0 && (
            <div className="thread-counter">
              <div className="section-label">Thread Usage</div>
              <div className="thread-list">
                {colorCounts.map(({ color, count }) => {
                  const sqIn = count / stitchesPerSqIn;
                  const yardage = sqIn * 1.5;
                  const skeins = Math.ceil(yardage / 8.7);
                  return (
                    <div
                      key={color.number}
                      className="thread-row"
                      onClick={() => selectColor(color)}
                    >
                      <div className="thread-swatch" style={{ background: color.hex }} />
                      <div className="thread-info">
                        <span className="thread-number">DMC {color.number}</span>
                        <span className="thread-name">{color.name}</span>
                      </div>
                      <div className="thread-stats">
                        <span>{count} sts</span>
                        <span>{yardage.toFixed(1)} yds</span>
                        <span>{skeins} sk</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'dmc' && (
        <div className="dmc-panel">
          <input
            className="dmc-search"
            placeholder="Search by number or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="dmc-grid">
            {filteredDmc.map(color => (
              <div
                key={color.number}
                className={`dmc-swatch ${activeDmcNumber === color.number ? 'selected' : ''}`}
                style={{ background: color.hex }}
                title={`DMC ${color.number} — ${color.name}`}
                onClick={() => selectColor(color)}
              />
            ))}
          </div>
          {search && filteredDmc.length === 0 && (
            <div className="empty-palette">No colors found.</div>
          )}
        </div>
      )}
    </div>
  );
}
