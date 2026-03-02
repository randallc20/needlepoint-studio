import { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useCanvasStore } from '../../store/canvasStore';
import './ProjectManager.css';

export function ProjectManager() {
  const activeProjectName = useProjectStore(s => s.activeProjectName);
  const projects = useProjectStore(s => s.projects);
  const isDirty = useProjectStore(s => s.isDirty);
  const saveProject = useProjectStore(s => s.saveProject);
  const saveProjectAs = useProjectStore(s => s.saveProjectAs);
  const loadProject = useProjectStore(s => s.loadProject);
  const deleteProject = useProjectStore(s => s.deleteProject);
  const newProject = useProjectStore(s => s.newProject);
  const autoSave = useProjectStore(s => s.autoSave);
  const restoreAutoSave = useProjectStore(s => s.restoreAutoSave);
  const markDirty = useProjectStore(s => s.markDirty);
  const refreshList = useProjectStore(s => s.refreshList);
  const exportToFile = useProjectStore(s => s.exportToFile);
  const importFromFile = useProjectStore(s => s.importFromFile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mark dirty whenever canvas changes
  useEffect(() => {
    const unsub = useCanvasStore.subscribe(() => {
      markDirty();
    });
    return unsub;
  }, [markDirty]);

  // Auto-save every 30 seconds when dirty
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (useProjectStore.getState().isDirty) {
        autoSave();
      }
    }, 30000);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [autoSave]);

  // Restore auto-save on mount
  useEffect(() => {
    restoreAutoSave();
    refreshList();
  }, [restoreAutoSave, refreshList]);

  const handleSave = () => {
    const state = useProjectStore.getState();
    if (!state.activeProjectId) {
      setShowSaveAs(true);
      setSaveAsName(state.activeProjectName);
    } else {
      saveProject();
    }
  };

  const handleSaveAs = () => {
    if (!saveAsName.trim()) return;
    saveProjectAs(saveAsName.trim());
    setShowSaveAs(false);
  };

  const handleNew = () => {
    if (useProjectStore.getState().isDirty) {
      if (!confirm('You have unsaved changes. Create a new project anyway?')) return;
    }
    newProject();
    setIsOpen(false);
  };

  const handleLoad = (id: string) => {
    if (useProjectStore.getState().isDirty) {
      if (!confirm('You have unsaved changes. Load a different project?')) return;
    }
    loadProject(id);
    setIsOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteProject(id);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      if (importFromFile(json)) {
        setIsOpen(false);
      } else {
        alert('Failed to import project. The file may be corrupted or invalid.');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = '';
  };

  return (
    <>
      <button className="project-trigger" onClick={() => setIsOpen(true)}>
        <span className="project-name">{activeProjectName}</span>
        {isDirty && <span className="dirty-dot" title="Unsaved changes" />}
      </button>

      {isOpen && (
        <div className="project-overlay" onClick={() => setIsOpen(false)}>
          <div className="project-dialog" onClick={e => e.stopPropagation()}>
            <div className="project-header">
              <span className="project-title">Projects</span>
              <button className="project-close" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            <div className="project-actions-row">
              <button className="project-action-btn" onClick={handleNew}>New</button>
              <button className="project-action-btn primary" onClick={handleSave}>
                Save{isDirty ? ' *' : ''}
              </button>
              <button className="project-action-btn" onClick={() => { setShowSaveAs(true); setSaveAsName(activeProjectName); }}>
                Save As
              </button>
            </div>

            <div className="project-actions-row">
              <button className="project-action-btn" onClick={exportToFile} title="Download project as a .json file">
                Export to File
              </button>
              <button className="project-action-btn" onClick={() => fileInputRef.current?.click()} title="Load a project from a .json file">
                Import from File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.npstudio.json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </div>

            {showSaveAs && (
              <div className="save-as-row">
                <input
                  type="text"
                  value={saveAsName}
                  onChange={e => setSaveAsName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveAs(); }}
                  placeholder="Project name..."
                  autoFocus
                />
                <button className="project-action-btn primary" onClick={handleSaveAs}>Save</button>
                <button className="project-action-btn" onClick={() => setShowSaveAs(false)}>Cancel</button>
              </div>
            )}

            <div className="project-list">
              {projects.length === 0 && (
                <div className="project-empty">No saved projects yet</div>
              )}
              {projects.map(p => (
                <div key={p.id} className="project-item" onClick={() => handleLoad(p.id)}>
                  <div className="project-item-info">
                    <div className="project-item-name">{p.name}</div>
                    <div className="project-item-meta">
                      {p.width}x{p.height} &middot; {p.stitchCount.toLocaleString()} stitches &middot; {new Date(p.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="project-item-delete"
                    onClick={e => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                    title="Delete project"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
