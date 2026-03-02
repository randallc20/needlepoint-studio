import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { gatherVisibleCells } from '../../utils/exportPdf';
import './PreviewPanel.css';

interface PreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PreviewPanel({ isOpen, onClose }: PreviewPanelProps) {
  const config = useCanvasStore(s => s.config);
  const layers = useCanvasStore(s => s.layers);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cells = gatherVisibleCells(layers);

    // Determine scale: fit the design into the viewport with padding
    const maxW = window.innerWidth - 80;
    const maxH = window.innerHeight - 120;
    const scaleX = maxW / config.width;
    const scaleY = maxH / config.height;
    const scale = Math.min(scaleX, scaleY, 12); // cap at 12px per cell

    const w = Math.round(config.width * scale);
    const h = Math.round(config.height * scale);
    canvas.width = w;
    canvas.height = h;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Draw cells
    const cellW = w / config.width;
    const cellH = h / config.height;
    for (const [key, cell] of Object.entries(cells)) {
      if (!cell.color) continue;
      const [r, c] = key.split(',').map(Number);
      ctx.fillStyle = cell.color;
      ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  }, [config, layers]);

  useEffect(() => {
    if (isOpen) render();
  }, [isOpen, render]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const physW = (config.width / config.meshCount).toFixed(1);
  const physH = (config.height / config.meshCount).toFixed(1);

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-container" onClick={e => e.stopPropagation()}>
        <div className="preview-header">
          <span className="preview-info">
            {config.width} x {config.height} stitches | {physW}" x {physH}" | {config.meshCount}-ct
          </span>
          <button className="preview-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>
        <div className="preview-canvas-wrap">
          <canvas ref={canvasRef} className="preview-canvas" />
        </div>
      </div>
    </div>
  );
}
