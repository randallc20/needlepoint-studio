import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CanvasConfig, Layer, StitchCell, StitchType, Tool, DmcColor } from '../types';

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
    cells: new Map(),
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
  zoom: number;
  showGrid: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];

  // Config
  setConfig: (config: Partial<CanvasConfig>) => void;

  // Tools & color
  setTool: (tool: Tool) => void;
  setColor: (hex: string, dmcNumber: string | null) => void;
  setStitchType: (type: StitchType) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;

  // Palette
  addToPalette: (color: DmcColor) => void;
  removeFromPalette: (dmcNumber: string) => void;

  // Canvas editing
  paintCell: (row: number, col: number) => void;
  eraseCell: (row: number, col: number) => void;
  floodFill: (row: number, col: number) => void;
  pickColor: (row: number, col: number) => void;
  clearCanvas: () => void;
  loadCells: (cells: Map<string, StitchCell>, layerId?: string) => void;

  // Layers
  addLayer: () => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  mergeLayers: () => void;

  // History
  undo: () => void;
  redo: () => void;
  snapshot: () => void;
}

function deepCopyLayers(layers: Layer[]): Layer[] {
  return layers.map(l => ({ ...l, cells: new Map(l.cells) }));
}

export const useCanvasStore = create<CanvasState>()(
  immer((set, get) => ({
    config: { width: 80, height: 60, meshCount: 18, cellSize: 16 },
    layers: [defaultLayer()],
    activeLayerId: '',
    activeTool: 'pencil',
    activeColor: '#1a237e',
    activeDmcNumber: '820',
    activeStitchType: 'tent',
    palette: [],
    zoom: 1,
    showGrid: true,
    past: [],
    future: [],

    setConfig: (cfg) => set(s => { Object.assign(s.config, cfg); }),
    setTool: (tool) => set(s => { s.activeTool = tool; }),
    setColor: (hex, dmcNumber) => set(s => {
      s.activeColor = hex;
      s.activeDmcNumber = dmcNumber;
    }),
    setStitchType: (type) => set(s => { s.activeStitchType = type; }),
    setZoom: (zoom) => set(s => { s.zoom = Math.min(8, Math.max(0.25, zoom)); }),
    toggleGrid: () => set(s => { s.showGrid = !s.showGrid; }),

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
        layer.cells.set(`${row},${col}`, {
          color: s.activeColor,
          dmcNumber: s.activeDmcNumber,
          stitchType: s.activeStitchType,
        });
      });
    },

    eraseCell: (row, col) => {
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer) return;
        layer.cells.delete(`${row},${col}`);
      });
    },

    floodFill: (row, col) => {
      get().snapshot();
      set(s => {
        const layer = s.layers.find(l => l.id === s.activeLayerId);
        if (!layer) return;
        const { width, height } = s.config;
        const key = `${row},${col}`;
        const targetCell = layer.cells.get(key);
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

          const cell = layer.cells.get(k);
          const cellColor = cell?.color ?? null;
          if (cellColor !== targetColor) continue;

          visited.add(k);
          layer.cells.set(k, {
            color: fillColor,
            dmcNumber: s.activeDmcNumber,
            stitchType: s.activeStitchType,
          });

          queue.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
        }
      });
    },

    pickColor: (row, col) => {
      const s = get();
      const layer = s.layers.find(l => l.id === s.activeLayerId);
      if (!layer) return;
      const cell = layer.cells.get(`${row},${col}`);
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
        s.layers.forEach(l => l.cells.clear());
      });
    },

    loadCells: (cells, layerId) => {
      get().snapshot();
      set(s => {
        const id = layerId ?? s.activeLayerId;
        const layer = s.layers.find(l => l.id === id);
        if (!layer) return;
        layer.cells = new Map(cells);
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

    setActiveLayer: (id) => set(s => { s.activeLayerId = id; }),

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
          for (const [key, cell] of layer.cells) {
            merged.cells.set(key, cell);
          }
        }
        s.layers = [merged];
        s.activeLayerId = merged.id;
      });
    },
  }))
);

// Initialize activeLayerId after store creation
const initialLayer = useCanvasStore.getState().layers[0];
useCanvasStore.setState({ activeLayerId: initialLayer.id });
