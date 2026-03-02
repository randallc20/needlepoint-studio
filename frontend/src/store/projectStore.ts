import { create } from 'zustand';
import { useCanvasStore } from './canvasStore';
import type { DmcColor, Layer, CanvasConfig } from '../types';

interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stitchCount: number;
  width: number;
  height: number;
  thumbnail: string | null;
}

interface SavedProject {
  meta: ProjectMeta;
  config: CanvasConfig;
  layers: Layer[];
  activeLayerId: string;
  activeColor: string;
  activeDmcNumber: string | null;
  palette: DmcColor[];
}

const LS_PREFIX = 'np-project-';
const LS_META_KEY = 'np-projects-meta';
const LS_AUTOSAVE_KEY = 'np-autosave';

function generateId() {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function countStitches(layers: Layer[]): number {
  const allKeys = new Set<string>();
  for (const layer of layers) {
    for (const key of Object.keys(layer.cells)) {
      allKeys.add(key);
    }
  }
  return allKeys.size;
}

function loadMetaList(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMetaList(list: ProjectMeta[]) {
  localStorage.setItem(LS_META_KEY, JSON.stringify(list));
}

interface ProjectState {
  projects: ProjectMeta[];
  activeProjectId: string | null;
  activeProjectName: string;
  isDirty: boolean;

  refreshList: () => void;
  saveProject: (name?: string) => string;
  saveProjectAs: (name: string) => string;
  loadProject: (id: string) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  newProject: () => void;
  autoSave: () => void;
  restoreAutoSave: () => boolean;
  markDirty: () => void;
  exportToFile: () => void;
  importFromFile: (json: string) => boolean;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: loadMetaList(),
  activeProjectId: null,
  activeProjectName: 'Untitled',
  isDirty: false,

  refreshList: () => {
    set({ projects: loadMetaList() });
  },

  saveProject: (name) => {
    const state = get();
    const canvas = useCanvasStore.getState();
    const id = state.activeProjectId ?? generateId();
    const projectName = name ?? state.activeProjectName;
    const now = new Date().toISOString();

    const meta: ProjectMeta = {
      id,
      name: projectName,
      createdAt: state.activeProjectId ? (state.projects.find(p => p.id === id)?.createdAt ?? now) : now,
      updatedAt: now,
      stitchCount: countStitches(canvas.layers),
      width: canvas.config.width,
      height: canvas.config.height,
      thumbnail: null,
    };

    const saved: SavedProject = {
      meta,
      config: { ...canvas.config },
      layers: canvas.layers.map(l => ({ ...l, cells: { ...l.cells } })),
      activeLayerId: canvas.activeLayerId,
      activeColor: canvas.activeColor,
      activeDmcNumber: canvas.activeDmcNumber,
      palette: [...canvas.palette],
    };

    localStorage.setItem(LS_PREFIX + id, JSON.stringify(saved));

    // Update meta list
    const list = loadMetaList();
    const idx = list.findIndex(p => p.id === id);
    if (idx >= 0) list[idx] = meta;
    else list.unshift(meta);
    saveMetaList(list);

    set({ activeProjectId: id, activeProjectName: projectName, projects: list, isDirty: false });
    return id;
  },

  saveProjectAs: (name) => {
    set({ activeProjectId: null });
    return get().saveProject(name);
  },

  loadProject: (id) => {
    try {
      const raw = localStorage.getItem(LS_PREFIX + id);
      if (!raw) return;
      const saved: SavedProject = JSON.parse(raw);
      const canvas = useCanvasStore.getState();

      canvas.setConfig(saved.config);
      // We need to directly set the layers via the store
      useCanvasStore.setState({
        layers: saved.layers,
        activeLayerId: saved.activeLayerId,
        activeColor: saved.activeColor,
        activeDmcNumber: saved.activeDmcNumber,
        palette: saved.palette,
        past: [],
        future: [],
      });

      set({
        activeProjectId: id,
        activeProjectName: saved.meta.name,
        isDirty: false,
      });
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  },

  deleteProject: (id) => {
    localStorage.removeItem(LS_PREFIX + id);
    const list = loadMetaList().filter(p => p.id !== id);
    saveMetaList(list);
    const state = get();
    if (state.activeProjectId === id) {
      set({ activeProjectId: null, activeProjectName: 'Untitled' });
    }
    set({ projects: list });
  },

  renameProject: (id, name) => {
    const list = loadMetaList();
    const proj = list.find(p => p.id === id);
    if (proj) {
      proj.name = name;
      saveMetaList(list);
      // Also update the saved project
      try {
        const raw = localStorage.getItem(LS_PREFIX + id);
        if (raw) {
          const saved: SavedProject = JSON.parse(raw);
          saved.meta.name = name;
          localStorage.setItem(LS_PREFIX + id, JSON.stringify(saved));
        }
      } catch {}
    }
    if (get().activeProjectId === id) {
      set({ activeProjectName: name });
    }
    set({ projects: loadMetaList() });
  },

  newProject: () => {
    useCanvasStore.setState({
      config: { width: 80, height: 60, meshCount: 18, cellSize: 16 },
      layers: [{ id: `layer-${Date.now()}`, name: 'Layer 1', visible: true, opacity: 1, cells: {} }],
      activeLayerId: '',
      activeColor: '#1a237e',
      activeDmcNumber: '820',
      palette: [],
      past: [],
      future: [],
    });
    // Fix activeLayerId
    const layers = useCanvasStore.getState().layers;
    useCanvasStore.setState({ activeLayerId: layers[0].id });
    set({ activeProjectId: null, activeProjectName: 'Untitled', isDirty: false });
  },

  autoSave: () => {
    const canvas = useCanvasStore.getState();
    const state = get();
    const data: SavedProject = {
      meta: {
        id: state.activeProjectId ?? 'autosave',
        name: state.activeProjectName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stitchCount: countStitches(canvas.layers),
        width: canvas.config.width,
        height: canvas.config.height,
        thumbnail: null,
      },
      config: { ...canvas.config },
      layers: canvas.layers.map(l => ({ ...l, cells: { ...l.cells } })),
      activeLayerId: canvas.activeLayerId,
      activeColor: canvas.activeColor,
      activeDmcNumber: canvas.activeDmcNumber,
      palette: [...canvas.palette],
    };
    localStorage.setItem(LS_AUTOSAVE_KEY, JSON.stringify(data));
    set({ isDirty: false });
  },

  restoreAutoSave: () => {
    try {
      const raw = localStorage.getItem(LS_AUTOSAVE_KEY);
      if (!raw) return false;
      const saved: SavedProject = JSON.parse(raw);
      if (countStitches(saved.layers) === 0) return false;

      useCanvasStore.setState({
        config: saved.config,
        layers: saved.layers,
        activeLayerId: saved.activeLayerId,
        activeColor: saved.activeColor,
        activeDmcNumber: saved.activeDmcNumber,
        palette: saved.palette,
        past: [],
        future: [],
      });
      set({
        activeProjectId: saved.meta.id === 'autosave' ? null : saved.meta.id,
        activeProjectName: saved.meta.name,
        isDirty: false,
      });
      return true;
    } catch { return false; }
  },

  markDirty: () => set({ isDirty: true }),

  exportToFile: () => {
    const canvas = useCanvasStore.getState();
    const state = get();
    const data: SavedProject = {
      meta: {
        id: state.activeProjectId ?? 'exported',
        name: state.activeProjectName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stitchCount: countStitches(canvas.layers),
        width: canvas.config.width,
        height: canvas.config.height,
        thumbnail: null,
      },
      config: { ...canvas.config },
      layers: canvas.layers.map(l => ({ ...l, cells: { ...l.cells } })),
      activeLayerId: canvas.activeLayerId,
      activeColor: canvas.activeColor,
      activeDmcNumber: canvas.activeDmcNumber,
      palette: [...canvas.palette],
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.activeProjectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.npstudio.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importFromFile: (json: string) => {
    try {
      const saved: SavedProject = JSON.parse(json);
      // Basic validation
      if (!saved.config || !saved.layers || !Array.isArray(saved.layers)) return false;

      useCanvasStore.setState({
        config: saved.config,
        layers: saved.layers,
        activeLayerId: saved.activeLayerId,
        activeColor: saved.activeColor,
        activeDmcNumber: saved.activeDmcNumber,
        palette: saved.palette ?? [],
        past: [],
        future: [],
      });

      set({
        activeProjectId: null, // Treat as new project (not linked to any localStorage entry)
        activeProjectName: saved.meta?.name ?? 'Imported',
        isDirty: true,
      });
      return true;
    } catch (err) {
      console.error('Failed to import project:', err);
      return false;
    }
  },
}));
