import { useState, useEffect } from 'react';
import { NeedlepointGrid } from './components/Canvas/NeedlepointGrid';
import { Toolbar } from './components/Toolbar/Toolbar';
import { ColorPalette } from './components/ColorPalette/ColorPalette';
import { LayerPanel } from './components/LayerPanel/LayerPanel';
import { ChatPanel } from './components/AIChat/ChatPanel';
import { CanvasSettings } from './components/ProjectManager/CanvasSettings';
import { ProjectManager } from './components/ProjectManager/ProjectManager';
import { PreviewPanel } from './components/PreviewPanel/PreviewPanel';
import { StampLibrary } from './components/StampLibrary/StampLibrary';
import { LoginPage } from './components/Login/LoginPage';
import { AdminPanel } from './components/AdminPanel/AdminPanel';
import { useCanvasStore } from './store/canvasStore';
import { useAuthStore } from './store/authStore';
import './App.css';

export default function App() {
  const user = useAuthStore(s => s.user);
  const isLoading = useAuthStore(s => s.isLoading);
  const checkAuth = useAuthStore(s => s.checkAuth);
  const logout = useAuthStore(s => s.logout);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  if (isLoading) {
    return <div className="app-loading">Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Workspace user={user} onLogout={logout} />;
}

function Workspace({ user, onLogout }: { user: { displayName: string; isAdmin?: boolean }; onLogout: () => void }) {
  const selection = useCanvasStore(s => s.selection);
  const hasSelection = selection && selection.size > 0;
  const [showPreview, setShowPreview] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-icon">&#x1F9F5;</span>
          <span className="brand-name">NeedlePoint Studio</span>
          <ProjectManager />
        </div>
        <div className="header-center">
          <CanvasSettings />
        </div>
        <div className="header-right">
          <button className="preview-btn" onClick={() => setShowPreview(true)} title="Preview design without grid or tools">
            Preview
          </button>
          {user.isAdmin && (
            <button className="preview-btn" onClick={() => setShowAdmin(true)} title="Manage user accounts">
              Accounts
            </button>
          )}
          <span className="user-name">{user.displayName}</span>
          <button className="logout-btn" onClick={onLogout} title="Sign out">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main workspace */}
      <div className="workspace">
        <Toolbar />
        <div className="canvas-wrapper">
          <NeedlepointGrid />
          {hasSelection && (
            <div className="selection-indicator">
              <span className="selection-dot" />
              {selection!.size} selected
            </div>
          )}
        </div>
        <div className="right-panels">
          <ColorPalette />
          <LayerPanel />
          <StampLibrary />
        </div>
      </div>

      {/* AI Chat (floating) */}
      <ChatPanel />

      {/* Design Preview */}
      <PreviewPanel isOpen={showPreview} onClose={() => setShowPreview(false)} />

      {/* Admin Panel */}
      {user.isAdmin && <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} />}
    </div>
  );
}
