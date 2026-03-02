import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { CanvasConfig, Layer, StitchCell, StitchType, Tool, DmcColor, CellRect, CellGroup, ClipboardData } from '../types';
import type { ViewMode } from '../data/symbolSet';

enableMapSet();

const UNDO_LIMIT = 100;

function makeLayerId() {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultLayer(name = 'Layer 1'): Layer {
  return {
    id: makeLayerId(),
    name,
    visible: true,
    opacity: 1,
    cells: {},
  };
}

interface HistoryEntry {
  layers: Layer[];
  activeLayerId: string;
}

interface CanvasState {
  config: CanvasConfig;
  layers: Layer[];
  activeLayerId: string;
  activeTool: Tool;
  activeColor: string;
  activeDmcNumber: string | null;
  activeStitchType: StitchType;
  palette: DmcColor[];
  eraserSize: number;
  shapeFilled: boolean;
  viewMode: ViewMode;
  showStitchOverlays: boolean;
  zoom: number;
  scrollZoomEnabled: boolean;
  showGrid: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];

  // Selection state
  selection: Set<string> | null;
  selectionBounds: CellRect | null;
  groups: Record<string, CellGroup>;
  groupCounter: number;
  clipboard: ClipboardData | null;

  // Selection actions
  setSelection: (cellKeys: Set<string> | null) => void;
  selectRect: (minRow: number, minCol: number, maxRow: number, maxCol: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  expandSelectionToGroup: (cellKey: string) => void;
  moveSelection: (deltaRow: number, deltaCol: number) => void;
  deleteSelection: () => void;
  copySelection: () => void;
  pasteClipboard: (atRow: number, atCol: number) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  findGroupForCell: (cellKey: string) => string | null;

  setConfig: (config: Partial<CanvasConfig>) => void;
  setTool: (tool: Tool) => void;
  setEraserSize: (size: number) => void;
  toggleShapeFilled: () => void;
  setColor: (hex: string, dmcNumber: string | null) => void;
  setStitchType: (type: StitchType) => void;
  setZoom: (zoom: number) => void;
  toggleScrollZoom: () => void;
  toggleGrid: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleStitchOverlays: () => void;
  addToPalette: (color: DmcColor) => void;
  removeFromPalette: (dmcNumber: string) => void;
  paintCell: (row: number, col: number) => void;
  paintCells: (cells: [number, number][]) => void;
  eraseCell: (row: number, col: number) => void;
  eraseCells: (cells: [number, number][]) => void;
  floodFill: (row: number, col: number) => void;
  pickColor: (row: number, col: number) => void;
  clearCanvas: () => void;
  loadCells: (cells: Record<string, StitchCell>, layerId?: string) => void;
  addLayer: () => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  mergeLayers: () => void;
  undo: () => void;
  redo: () => void;
  snapshot: () => void;
}

function deepCopyLayers(layers: Layer[]): Layer[] {
  return layers.map(l => ({ ...l, cells: { ...l.cells } }));
}

const initialLayer = defaultLayer();

export const useCanvasStore = create<CanvasState>()(
  immer((set, get) => ({
    config: { width: 80, height: 60, meshCount: 18, cellSize: 16 },
    layers: [initialLayer],
    activeLayerId: initialLayer.id,
    activeTool: 'pointer',
    activeColor: '#1a237e',
    activeDmcNumber: '820',
    activeStitchType: 'continental',
    palette: [],
    eraserSize: 1,
    shapeFilled: false,
    viewMode: 'color' as ViewMode,
    showStitchOverlays: false,
    zoom: 1,
    scrollZoomEnabled: false,
    showGrid: true,
    past: [],
    future: [],

    // Selection initial state
    selection: null,
    selectionBounds: null,
    groups: {},
    groupCounter: 0,
    clipboard: null,

    setConfig: (cfg) => set(s => { Object.assign(s.config, cfg); }),
    setTool: (tool) => set(s => { s.activeTool = tool; }),
    setEraserSize: (size) => set(s => { s.eraserSize = size; }),
    toggleShapeFilled: () => set(s => { s.shapeFilled = !s.shapeFilled; }),
    setColor: (hex, dmcNumber) => set(s => {
      s.activeColor = hex;
      s.activeDmcNumber = dmcNumber;
    }),
    setStitchType: (type) => set(s => { s.activeStitchType = type; }),
    setZoom: (zoom) => set(s => { s.zoom = Math.min(8, Math.max(0.25, zoom)); }),
    toggleScrollZoom: () => set(s => { s.scrollZoomEnabled = !s.scrollZoomEnabled; }),
    toggleGrid: () => set(s => { s.showGrid = !s.showGrid; }),
    setViewMode: (mode) => set(s => { s.viewMode = mode; }),
    toggleStitchOverlays: () => set(s => { s.showStitchOverlays = !s.showStitchOverlays; }),

    addToPalette: (color) => set(s => {
      if (!s.palette.find(c => c.number === color.number)) {
        s.palette.push(color);
      }
    }),
    removeFromPalette: (dmcNumber) => set(s => {
      s.palette = s.palette.filter(c => c.number !== dmcNumber);
    }),

    snapshot: () => set(s => {
      const entry: HistoryEntry = {
        layers: deepCopyLayers(s.layers as Layer[]),
        activeLayerId: s.activeLayerId,
      };
      s.past = [...s.past.slice(-UNDO_LIMIT + 1), entry];
      s.future = [];
    }),

    undo: () => set(s => {
      if (s.past.length === 0) return;
      const prev = s.past[s.past.length - 1];
      const current: HistoryEntry = {
        layers: deepCopyLayers(s.layers as Layer[]),
        activeLayerId: s.activeLayerId,
      };
      s.future = [current, ...s.future];
      s.past = s.past.slice(0, -1);
      s.layers = prev.layers;
      s.activeLayerId = prev.activeLayerId;
    }),

    redo: () => set(s => {
      if (s.future.length === 0) return;
      const next = s.future[0];
      const current: HistoryEntry = {
        layers: deepCopyLayers(s.layers as Layer[]),
        activeLayerId: s.activeLayerId,
      };
      s.past = [...s.past, current];
      s.future = s.future.slice(1);
      s.layers = next.layers;
      s.activeLayerId = next.activeLayerId;
    }),

    paintCell: (row, col) => {
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer) return;
        layer.cells[`${row},${col}`] = {
          color: s.activeColor,
          dmcNumber: s.activeDmcNumber,
          stitchType: s.activeStitchType,
        };
      });
    },

    paintCells: (cells) => {
      if (cells.length === 0) return;
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer) return;
        for (const [row, col] of cells) {
          if (row >= 0 && row < s.config.height && col >= 0 && col < s.config.width) {
            layer.cells[`${row},${col}`] = {
              color: s.activeColor,
              dmcNumber: s.activeDmcNumber,
              stitchType: s.activeStitchType,
            };
          }
        }
      });
    },

    eraseCell: (row, col) => {
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer) return;
        delete layer.cells[`${row},${col}`];
      });
    },

    eraseCells: (cells) => {
      if (cells.length === 0) return;
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer) return;
        for (const [row, col] of cells) {
          delete layer.cells[`${row},${col}`];
        }
      });
    },

    floodFill: (row, col) => {
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer) return;
        const { width, height } = s.config;
        const key = `${row},${col}`;
        const targetCell = layer.cells[key];
        const targetColor = targetCell?.color ?? null;
        const fillColor = s.activeColor;

        if (targetColor === fillColor) return;

        const queue: [number, number][] = [[row, col]];
        const visited = new Set<string>();

        while (queue.length > 0) {
          const [r, c] = queue.shift()!;
          const k = `${r},${c}`;
          if (visited.has(k)) continue;
          if (r < 0 || r >= height || c < 0 || c >= width) continue;

          const cell = layer.cells[k];
          const cellColor = cell?.color ?? null;
          if (cellColor !== targetColor) continue;

          visited.add(k);
          layer.cells[k] = {
            color: fillColor,
            dmcNumber: s.activeDmcNumber,
            stitchType: s.activeStitchType,
          };

          queue.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
        }
      });
    },

    pickColor: (row, col) => {
      const s = get();
      const layer = s.layers.find(l => l.id === s.activeLayerId);
      if (!layer) return;
      const cell = layer.cells[`${row},${col}`];
      if (cell?.color) {
        set(st => {
          st.activeColor = cell.color!;
          st.activeDmcNumber = cell.dmcNumber;
          st.activeTool = 'pencil';
        });
      }
    },

    clearCanvas: () => {
      get().snapshot();
      set(s => {
        s.layers.forEach(l => { l.cells = {}; });
      });
    },

    loadCells: (cells, layerId) => {
      get().snapshot();
      set(s => {
        const id = layerId ?? s.activeLayerId;
        const layer = s.layers.find(l => l.id === id);
        if (!layer) return;
        layer.cells = { ...cells };
      });
    },

    addLayer: () => set(s => {
      const newLayer = defaultLayer(`Layer ${s.layers.length + 1}`);
      s.layers.push(newLayer);
      s.activeLayerId = newLayer.id;
    }),

    removeLayer: (id) => set(s => {
      if (s.layers.length === 1) return;
      s.layers = s.layers.filter(l => l.id !== id);
      if (s.activeLayerId === id) {
        s.activeLayerId = s.layers[s.layers.length - 1].id;
      }
    }),

    setActiveLayer: (id) => set(s => {
      s.activeLayerId = id;
      s.selection = null;
      s.selectionBounds = null;
    }),

    toggleLayerVisibility: (id) => set(s => {
      const layer = s.layers.find(l => l.id === id);
      if (layer) layer.visible = !layer.visible;
    }),

    renameLayer: (id, name) => set(s => {
      const layer = s.layers.find(l => l.id === id);
      if (layer) layer.name = name;
    }),

    reorderLayers: (from, to) => set(s => {
      const [moved] = s.layers.splice(from, 1);
      s.layers.splice(to, 0, moved);
    }),

    mergeLayers: () => {
      get().snapshot();
      set(s => {
        const merged = defaultLayer('Merged');
        for (const layer of s.layers) {
          Object.assign(merged.cells, layer.cells);
        }
        s.layers = [merged];
        s.activeLayerId = merged.id;
      });
    },

    // --- Selection actions ---

    setSelection: (cellKeys) => set(s => {
      if (!cellKeys || cellKeys.size === 0) {
        s.selection = null;
        s.selectionBounds = null;
        return;
      }
      s.selection = cellKeys;
      let minRow = Infinity, minCol = Infinity, maxRow = -Infinity, maxCol = -Infinity;
      for (const key of cellKeys) {
        const [r, c] = key.split(',').map(Number);
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
      s.selectionBounds = { minRow, minCol, maxRow, maxCol };
    }),

    selectRect: (minRow, minCol, maxRow, maxCol) => set(s => {
      const layer = s.layers.find(l => l.id === s.activeLayerId);
      if (!layer) return;
      const keys = new Set<string>();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const k = `${r},${c}`;
          if (layer.cells[k]) keys.add(k);
        }
      }
      s.selection = keys.size > 0 ? keys : null;
      s.selectionBounds = keys.size > 0 ? { minRow, minCol, maxRow, maxCol } : null;
    }),

    selectAll: () => set(s => {
      const layer = s.layers.find(l => l.id === s.activeLayerId);
      if (!layer) return;
      const keys = new Set(Object.keys(layer.cells));
      if (keys.size === 0) { s.selection = null; s.selectionBounds = null; return; }
      let minRow = Infinity, minCol = Infinity, maxRow = -Infinity, maxCol = -Infinity;
      for (const key of keys) {
        const [r, c] = key.split(',').map(Number);
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
      s.selection = keys;
      s.selectionBounds = { minRow, minCol, maxRow, maxCol };
    }),

    clearSelection: () => set(s => {
      s.selection = null;
      s.selectionBounds = null;
    }),

    expandSelectionToGroup: (cellKey) => set(s => {
      for (const group of Object.values(s.groups)) {
        if (group.layerId === s.activeLayerId && group.cellKeys.has(cellKey)) {
          const merged = new Set(s.selection ?? []);
          for (const k of group.cellKeys) merged.add(k);
          s.selection = merged;
          let minRow = Infinity, minCol = Infinity, maxRow = -Infinity, maxCol = -Infinity;
          for (const key of merged) {
            const [r, c] = key.split(',').map(Number);
            if (r < minRow) minRow = r;
            if (r > maxRow) maxRow = r;
            if (c < minCol) minCol = c;
            if (c > maxCol) maxCol = c;
          }
          s.selectionBounds = { minRow, minCol, maxRow, maxCol };
          return;
        }
      }
    }),

    moveSelection: (deltaRow, deltaCol) => {
      if (deltaRow === 0 && deltaCol === 0) return;
      const state = get();
      if (!state.selection || state.selection.size === 0) return;
      const { width, height } = state.config;
      // Bounds check: ensure ALL destination cells are within canvas
      for (const key of state.selection) {
        const [r, c] = key.split(',').map(Number);
        if (r + deltaRow < 0 || r + deltaRow >= height || c + deltaCol < 0 || c + deltaCol >= width) return;
      }
      const oldSelectionKeys = new Set(state.selection);
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer || !s.selection) return;
        // Collect cells to move
        const toMove: { oldKey: string; newKey: string; cell: StitchCell }[] = [];
        for (const key of oldSelectionKeys) {
          const cell = layer.cells[key];
          if (!cell) continue;
          const [r, c] = key.split(',').map(Number);
          toMove.push({ oldKey: key, newKey: `${r + deltaRow},${c + deltaCol}`, cell: { ...cell } });
        }
        // Delete from original
        for (const { oldKey } of toMove) delete layer.cells[oldKey];
        // Write to new positions
        for (const { newKey, cell } of toMove) layer.cells[newKey] = cell;
        // Update selection keys
        const newSelection = new Set<string>();
        for (const key of oldSelectionKeys) {
          const [r, c] = key.split(',').map(Number);
          newSelection.add(`${r + deltaRow},${c + deltaCol}`);
        }
        s.selection = newSelection;
        if (s.selectionBounds) {
          s.selectionBounds = {
            minRow: s.selectionBounds.minRow + deltaRow,
            minCol: s.selectionBounds.minCol + deltaCol,
            maxRow: s.selectionBounds.maxRow + deltaRow,
            maxCol: s.selectionBounds.maxCol + deltaCol,
          };
        }
        // Update groups that contained moved cells
        for (const group of Object.values(s.groups)) {
          if (group.layerId !== s.activeLayerId) continue;
          const newGroupKeys = new Set<string>();
          for (const gk of group.cellKeys) {
            if (oldSelectionKeys.has(gk)) {
              const [r, c] = gk.split(',').map(Number);
              newGroupKeys.add(`${r + deltaRow},${c + deltaCol}`);
            } else {
              newGroupKeys.add(gk);
            }
          }
          group.cellKeys = newGroupKeys;
        }
      });
    },

    deleteSelection: () => {
      const state = get();
      if (!state.selection || state.selection.size === 0) return;
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer || !s.selection) return;
        for (const key of s.selection) delete layer.cells[key];
        // Remove deleted keys from groups, clean up empty groups
        const emptyGroupIds: string[] = [];
        for (const [id, group] of Object.entries(s.groups)) {
          if (group.layerId !== s.activeLayerId) continue;
          for (const key of s.selection!) group.cellKeys.delete(key);
          if (group.cellKeys.size === 0) emptyGroupIds.push(id);
        }
        for (const id of emptyGroupIds) delete s.groups[id];
        s.selection = null;
        s.selectionBounds = null;
      });
    },

    copySelection: () => set(s => {
      if (!s.selection || s.selection.size === 0) return;
      const layer = s.layers.find(l => l.id === s.activeLayerId);
      if (!layer) return;
      let minRow = Infinity, minCol = Infinity, maxRow = -Infinity, maxCol = -Infinity;
      for (const key of s.selection) {
        const [r, c] = key.split(',').map(Number);
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
      const cells: Record<string, StitchCell> = {};
      for (const key of s.selection) {
        const cell = layer.cells[key];
        if (!cell) continue;
        const [r, c] = key.split(',').map(Number);
        cells[`${r - minRow},${c - minCol}`] = { ...cell };
      }
      s.clipboard = { cells, width: maxCol - minCol + 1, height: maxRow - minRow + 1 };
    }),

    pasteClipboard: (atRow, atCol) => {
      const state = get();
      if (!state.clipboard) return;
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer || !s.clipboard) return;
        const newSelection = new Set<string>();
        for (const [key, cell] of Object.entries(s.clipboard.cells)) {
          const [r, c] = key.split(',').map(Number);
          const destR = atRow + r;
          const destC = atCol + c;
          if (destR >= 0 && destR < s.config.height && destC >= 0 && destC < s.config.width) {
            const destKey = `${destR},${destC}`;
            layer.cells[destKey] = { ...cell };
            newSelection.add(destKey);
          }
        }
        s.selection = newSelection.size > 0 ? newSelection : null;
        if (newSelection.size > 0) {
          let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
          for (const k of newSelection) {
            const [r, c] = k.split(',').map(Number);
            if (r < minR) minR = r; if (r > maxR) maxR = r;
            if (c < minC) minC = c; if (c > maxC) maxC = c;
          }
          s.selectionBounds = { minRow: minR, minCol: minC, maxRow: maxR, maxCol: maxC };
        }
      });
    },

    groupSelection: () => set(s => {
      if (!s.selection || s.selection.size === 0) return;
      const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      s.groupCounter += 1;
      s.groups[id] = {
        id,
        name: `Group ${s.groupCounter}`,
        layerId: s.activeLayerId,
        cellKeys: new Set(s.selection),
      };
    }),

    ungroupSelection: () => set(s => {
      if (!s.selection || s.selection.size === 0) return;
      const toDelete: string[] = [];
      for (const [id, group] of Object.entries(s.groups)) {
        if (group.layerId !== s.activeLayerId) continue;
        for (const key of s.selection!) {
          if (group.cellKeys.has(key)) { toDelete.push(id); break; }
        }
      }
      for (const id of toDelete) delete s.groups[id];
    }),

    findGroupForCell: (cellKey) => {
      const s = get();
      for (const [id, group] of Object.entries(s.groups)) {
        if (group.layerId === s.activeLayerId && group.cellKeys.has(cellKey)) return id;
      }
      return null;
    },
  }))
);
