import { NeedlepointGrid } from './components/Canvas/NeedlepointGrid';
import { Toolbar } from './components/Toolbar/Toolbar';
import { ColorPalette } from './components/ColorPalette/ColorPalette';
import { LayerPanel } from './components/LayerPanel/LayerPanel';
import { ChatPanel } from './components/AIChat/ChatPanel';
import { CanvasSettings } from './components/ProjectManager/CanvasSettings';
import './App.css';

export default function App() {
  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-icon">🧵</span>
          <span className="brand-name">NeedlePoint Studio</span>
        </div>
        <div className="header-center">
          <CanvasSettings />
        </div>
        <div className="header-right">
          <span className="header-hint">P=Pencil · F=Fill · E=Erase · I=Pick · Ctrl+Z=Undo</span>
        </div>
      </header>

      {/* Main workspace */}
      <div className="workspace">
        <Toolbar />
        <NeedlepointGrid />
        <div className="right-panels">
          <ColorPalette />
          <LayerPanel />
        </div>
      </div>

      {/* AI Chat (floating) */}
      <ChatPanel />
    </div>
  );
}
