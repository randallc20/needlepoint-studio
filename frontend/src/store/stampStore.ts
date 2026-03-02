import { create } from 'zustand';
import { useCanvasStore } from './canvasStore';
import type { SavedStamp, StitchCell } from '../types';

const LS_KEY = 'np-stamps';

function loadStamps(): SavedStamp[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistStamps(stamps: SavedStamp[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(stamps));
}

function generateThumbnail(
  cells: Record<string, StitchCell>,
  width: number,
  height: number,
): string {
  const scale = Math.min(2, Math.max(1, Math.floor(48 / Math.max(width, height))));
  const w = width * scale;
  const h = height * scale;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  for (const [key, cell] of Object.entries(cells)) {
    if (!cell.color) continue;
    const [r, c] = key.split(',').map(Number);
    ctx.fillStyle = cell.color;
    ctx.fillRect(c * scale, r * scale, scale, scale);
  }

  return canvas.toDataURL('image/png');
}

interface StampState {
  stamps: SavedStamp[];
  saveStamp: (name: string) => boolean;
  saveFromCells: (name: string, cells: Record<string, StitchCell>, width: number, height: number) => void;
  deleteStamp: (id: string) => void;
  renameStamp: (id: string, newName: string) => void;
  loadToClipboard: (id: string) => void;
}

export const useStampStore = create<StampState>((set, get) => ({
  stamps: loadStamps(),

  saveStamp: (name: string) => {
    const canvas = useCanvasStore.getState();
    const { selection, activeLayerId, layers } = canvas;
    if (!selection || selection.size === 0) return false;

    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer) return false;

    // Normalize cells to (0,0) origin
    let minRow = Infinity, minCol = Infinity, maxRow = -Infinity, maxCol = -Infinity;
    for (const key of selection) {
      const [r, c] = key.split(',').map(Number);
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
      if (c < minCol) minCol = c;
      if (c > maxCol) maxCol = c;
    }

    const cells: Record<string, StitchCell> = {};
    for (const key of selection) {
      const cell = layer.cells[key];
      if (!cell) continue;
      const [r, c] = key.split(',').map(Number);
      cells[`${r - minRow},${c - minCol}`] = { ...cell };
    }

    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;

    const stamp: SavedStamp = {
      id: `stamp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      cells,
      width,
      height,
      createdAt: new Date().toISOString(),
      thumbnail: generateThumbnail(cells, width, height),
    };

    const stamps = [stamp, ...get().stamps];
    persistStamps(stamps);
    set({ stamps });
    return true;
  },

  saveFromCells: (name: string, cells: Record<string, StitchCell>, width: number, height: number) => {
    const stamp: SavedStamp = {
      id: `stamp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      cells,
      width,
      height,
      createdAt: new Date().toISOString(),
      thumbnail: generateThumbnail(cells, width, height),
    };

    const stamps = [stamp, ...get().stamps];
    persistStamps(stamps);
    set({ stamps });
  },

  deleteStamp: (id: string) => {
    const stamps = get().stamps.filter(s => s.id !== id);
    persistStamps(stamps);
    set({ stamps });
  },

  renameStamp: (id: string, newName: string) => {
    const stamps = get().stamps.map(s =>
      s.id === id ? { ...s, name: newName } : s
    );
    persistStamps(stamps);
    set({ stamps });
  },

  loadToClipboard: (id: string) => {
    const stamp = get().stamps.find(s => s.id === id);
    if (!stamp) return;
    useCanvasStore.setState({
      clipboard: {
        cells: { ...stamp.cells },
        width: stamp.width,
        height: stamp.height,
      },
    });
  },
}));
