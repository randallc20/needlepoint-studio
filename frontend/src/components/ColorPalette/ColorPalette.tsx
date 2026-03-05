import { useState, useMemo, useRef } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { DMC_COLORS, findNearestDmcColor } from '../../data/dmcColors';
import { getMatchQuality, getMatchQualityLabel, getMatchQualityColor } from '../../utils/colorScience';
import type { DmcColor } from '../../types';
import './ColorPalette.css';

const COLOR_FAMILIES: { label: string; filter: (c: DmcColor) => boolean }[] = [
  { label: 'All', filter: () => true },
  { label: 'Reds', filter: c => c.r > 150 && c.g < 100 && c.b < 100 },
  { label: 'Pinks', filter: c => c.r > 170 && c.g < 170 && c.b > 100 && c.b < 220 },
  { label: 'Oranges', filter: c => c.r > 180 && c.g > 80 && c.g < 160 && c.b < 80 },
  { label: 'Yellows', filter: c => c.r > 180 && c.g > 180 && c.b < 120 },
  { label: 'Greens', filter: c => c.g > c.r && c.g > c.b && c.g > 80 },
  { label: 'Blues', filter: c => c.b > c.r && c.b > c.g && c.b > 80 },
  { label: 'Purples', filter: c => c.r > 60 && c.b > 60 && c.b > c.g && c.r > c.g },
  { label: 'Browns', filter: c => c.r > 80 && c.r < 200 && c.g > 50 && c.g < 150 && c.b < 100 && c.r > c.g },
  { label: 'Grays', filter: c => Math.abs(c.r - c.g) < 20 && Math.abs(c.g - c.b) < 20 && c.r > 40 && c.r < 230 },
  { label: 'B&W', filter: c => (c.r < 40 && c.g < 40 && c.b < 40) || (c.r > 240 && c.g > 240 && c.b > 240) },
];

type SortMode = 'custom' | 'dmc' | 'hue' | 'usage';

function getHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = ((b - r) / d + 2);
  else h = ((r - g) / d + 4);
  return h * 60;
}

export function ColorPalette() {
  const activeColor = useCanvasStore(s => s.activeColor);
  const activeDmcNumber = useCanvasStore(s => s.activeDmcNumber);
  const palette = useCanvasStore(s => s.palette);
  const setColor = useCanvasStore(s => s.setColor);
  const addToPalette = useCanvasStore(s => s.addToPalette);
  const removeFromPalette = useCanvasStore(s => s.removeFromPalette);
  const layers = useCanvasStore(s => s.layers);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'palette' | 'dmc'>('palette');
  const [colorFamily, setColorFamily] = useState(0); // index into COLOR_FAMILIES
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const [showPicker, setShowPicker] = useState(false);
  const [customHex, setCustomHex] = useState('#000000');
  const [hoveredColor, setHoveredColor] = useState<DmcColor | null>(null);
  const [recentColors, setRecentColors] = useState<DmcColor[]>([]);
  const [lastMatchDeltaE, setLastMatchDeltaE] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Filter DMC library
  const filteredDmc = useMemo(() => {
    let colors = DMC_COLORS;
    // Apply family filter
    if (colorFamily > 0) {
      colors = colors.filter(COLOR_FAMILIES[colorFamily].filter);
    }
    // Apply text search
    if (search.trim()) {
      const q = search.toLowerCase();
      colors = colors.filter(
        c => c.number.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    }
    return colors.slice(0, 120);
  }, [search, colorFamily]);

  // Color usage counts
  const colorCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const cell of Object.values(layer.cells)) {
        if (!cell.dmcNumber) continue;
        counts.set(cell.dmcNumber, (counts.get(cell.dmcNumber) ?? 0) + 1);
      }
    }
    return counts;
  }, [layers]);

  // Thread usage stats for display
  const threadStats = useMemo(() => {
    const stats: { color: DmcColor; count: number; yardage: number; skeins: number }[] = [];
    for (const [dmcNum, count] of colorCounts) {
      const dmc = DMC_COLORS.find(c => c.number === dmcNum) ?? palette.find(c => c.number === dmcNum);
      if (!dmc) continue;
      // ~1.5 inches of thread per stitch (front+back), 36 inches per yard
      const yardage = (count * 1.5) / 36;
      const skeins = Math.ceil(yardage / 8.7); // 8.7 yards per DMC skein
      stats.push({ color: dmc, count, yardage, skeins });
    }
    stats.sort((a, b) => b.count - a.count);
    return stats;
  }, [colorCounts, palette]);

  const totalStitches = useMemo(() => {
    let total = 0;
    for (const count of colorCounts.values()) total += count;
    return total;
  }, [colorCounts]);

  // Sorted palette
  const sortedPalette = useMemo(() => {
    const arr = [...palette];
    switch (sortMode) {
      case 'dmc':
        return arr.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
      case 'hue':
        return arr.sort((a, b) => getHue(a.r, a.g, a.b) - getHue(b.r, b.g, b.b));
      case 'usage':
        return arr.sort((a, b) => (colorCounts.get(b.number) ?? 0) - (colorCounts.get(a.number) ?? 0));
      default:
        return arr;
    }
  }, [palette, sortMode, colorCounts]);

  const selectColor = (color: DmcColor) => {
    setColor(color.hex, color.number);
    if (!palette.find(p => p.number === color.number)) {
      addToPalette(color);
    }
    // Add to recent (keep last 8)
    setRecentColors(prev => {
      const filtered = prev.filter(c => c.number !== color.number);
      return [color, ...filtered].slice(0, 8);
    });
  };

  const handleCustomColor = (hex: string) => {
    setCustomHex(hex);
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const { color: nearest, deltaE } = findNearestDmcColor(r, g, b);
    setLastMatchDeltaE(deltaE);
    selectColor(nearest);
  };

  // Active color name
  const activeName = useMemo(() => {
    if (!activeDmcNumber) return '';
    const dmc = DMC_COLORS.find(c => c.number === activeDmcNumber);
    return dmc?.name ?? '';
  }, [activeDmcNumber]);

  if (collapsed) {
    return (
      <div className="panel-collapsed-bar" onClick={() => setCollapsed(false)} title="Expand Colors">
        <span className="panel-collapsed-title">Colors</span>
      </div>
    );
  }

  return (
    <div className="color-palette">
      {/* Header */}
      <div className="color-palette-header">
        <span className="color-palette-title">Colors</span>
        <button className="panel-collapse-btn" onClick={() => setCollapsed(true)} title="Collapse">&#x2039;</button>
      </div>

      {/* Active color swatch */}
      <div className="active-color-section">
        <div
          className="active-swatch"
          style={{ background: activeColor }}
          onClick={() => {
            setShowPicker(!showPicker);
            setTimeout(() => pickerRef.current?.click(), 50);
          }}
          title="Click to pick a custom color"
        />
        <div className="active-info">
          <div className="active-dmc">DMC {activeDmcNumber ?? '—'}</div>
          <div className="active-name">{activeName}</div>
          <div className="active-hex">{activeColor}</div>
          {lastMatchDeltaE !== null && lastMatchDeltaE > 1 && (() => {
            const quality = getMatchQuality(lastMatchDeltaE);
            return (
              <div
                className="match-quality-badge"
                style={{ color: getMatchQualityColor(quality) }}
                title={`Delta-E: ${lastMatchDeltaE.toFixed(1)} — ${getMatchQualityLabel(quality)}`}
              >
                {getMatchQualityLabel(quality)} (ΔE {lastMatchDeltaE.toFixed(1)})
              </div>
            );
          })()}
        </div>
      </div>

      {/* Hidden native color picker */}
      <input
        ref={pickerRef}
        type="color"
        className="hidden-picker"
        value={customHex}
        onChange={e => handleCustomColor(e.target.value)}
      />

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div className="recent-colors">
          <div className="recent-label">Recent</div>
          <div className="recent-row">
            {recentColors.map(c => (
              <div
                key={c.number}
                className={`recent-swatch ${activeDmcNumber === c.number ? 'selected' : ''}`}
                style={{ background: c.hex }}
                title={`DMC ${c.number}`}
                onClick={() => selectColor(c)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="palette-tabs">
        <button
          className={`tab-btn ${tab === 'palette' ? 'active' : ''}`}
          onClick={() => setTab('palette')}
        >
          Palette ({palette.length})
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
          {palette.length === 0 ? (
            <div className="empty-palette">
              Pick colors from the DMC Library tab to build your palette.
            </div>
          ) : (
            <>
              {/* Sort controls */}
              <div className="sort-row">
                <span className="sort-label">Sort:</span>
                {(['custom', 'hue', 'dmc', 'usage'] as SortMode[]).map(mode => (
                  <button
                    key={mode}
                    className={`sort-btn ${sortMode === mode ? 'active' : ''}`}
                    onClick={() => setSortMode(mode)}
                  >
                    {mode === 'custom' ? 'Default' : mode === 'hue' ? 'Hue' : mode === 'dmc' ? 'DMC#' : 'Usage'}
                  </button>
                ))}
              </div>

              <div className="swatch-grid">
                {sortedPalette.map(color => {
                  const count = colorCounts.get(color.number) ?? 0;
                  return (
                    <div
                      key={color.number}
                      className={`swatch ${activeDmcNumber === color.number ? 'selected' : ''}`}
                      style={{ background: color.hex }}
                      title={`DMC ${color.number} — ${color.name}${count > 0 ? ` (${count} stitches)` : ''}\nRight-click to remove`}
                      onClick={() => selectColor(color)}
                      onContextMenu={e => {
                        e.preventDefault();
                        removeFromPalette(color.number);
                      }}
                      onMouseEnter={() => setHoveredColor(color)}
                      onMouseLeave={() => setHoveredColor(null)}
                    >
                      {count > 0 && <span className="swatch-badge" />}
                    </div>
                  );
                })}
              </div>

              {/* Hovered color info */}
              {hoveredColor && (
                <div className="hover-info">
                  <div className="hover-swatch" style={{ background: hoveredColor.hex }} />
                  <div className="hover-details">
                    <span className="hover-dmc">DMC {hoveredColor.number}</span>
                    <span className="hover-name">{hoveredColor.name}</span>
                  </div>
                </div>
              )}

              {/* Thread usage */}
              {threadStats.length > 0 && (
                <div className="thread-counter">
                  <div className="section-label">
                    Thread Usage
                    <span className="thread-total">{totalStitches.toLocaleString()} stitches</span>
                  </div>
                  <div className="thread-list">
                    {threadStats.map(({ color, count, yardage, skeins }) => {
                      const pct = totalStitches > 0 ? (count / totalStitches) * 100 : 0;
                      return (
                        <div
                          key={color.number}
                          className="thread-row"
                          onClick={() => selectColor(color)}
                        >
                          <div className="thread-swatch" style={{ background: color.hex }} />
                          <div className="thread-info">
                            <span className="thread-number">DMC {color.number}</span>
                            <div className="thread-bar-bg">
                              <div
                                className="thread-bar-fill"
                                style={{ width: `${Math.max(pct, 2)}%`, background: color.hex }}
                              />
                            </div>
                          </div>
                          <div className="thread-stats">
                            <span>{count}</span>
                            <span>{yardage.toFixed(1)}yd</span>
                            <span>{skeins}sk</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
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

          {/* Color family filter */}
          <div className="family-row">
            {COLOR_FAMILIES.map((fam, i) => (
              <button
                key={fam.label}
                className={`family-btn ${colorFamily === i ? 'active' : ''}`}
                onClick={() => setColorFamily(i)}
              >
                {fam.label}
              </button>
            ))}
          </div>

          <div className="dmc-grid">
            {filteredDmc.map(color => {
              const inPalette = palette.some(p => p.number === color.number);
              return (
                <div
                  key={color.number}
                  className={`dmc-swatch ${activeDmcNumber === color.number ? 'selected' : ''} ${inPalette ? 'in-palette' : ''}`}
                  style={{ background: color.hex }}
                  title={`DMC ${color.number} — ${color.name}${inPalette ? ' (in palette)' : ''}`}
                  onClick={() => selectColor(color)}
                />
              );
            })}
          </div>
          {filteredDmc.length === 0 && (
            <div className="empty-palette">No colors match your search.</div>
          )}
          <div className="dmc-count">{filteredDmc.length} colors shown</div>
        </div>
      )}
    </div>
  );
}
