import { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Line, Group } from 'react-konva';
import Konva from 'konva';
import { useCanvasStore } from '../../store/canvasStore';
import type { StitchCell } from '../../types';

const GUIDE_EVERY = 10;

export function NeedlepointGrid() {
  const config = useCanvasStore(s => s.config);
  const layers = useCanvasStore(s => s.layers);
  const activeLayerId = useCanvasStore(s => s.activeLayerId);
  const activeTool = useCanvasStore(s => s.activeTool);
  const showGrid = useCanvasStore(s => s.showGrid);
  const zoom = useCanvasStore(s => s.zoom);

  const paintCell = useCanvasStore(s => s.paintCell);
  const eraseCell = useCanvasStore(s => s.eraseCell);
  const floodFill = useCanvasStore(s => s.floodFill);
  const pickColor = useCanvasStore(s => s.pickColor);
  const setTool = useCanvasStore(s => s.setTool);

  const stageRef = useRef<Konva.Stage>(null);
  const [isPainting, setIsPainting] = useState(false);
  const lastPainted = useRef<string | null>(null);

  const cellSize = config.cellSize * zoom;
  const stageWidth = config.width * cellSize;
  const stageHeight = config.height * cellSize;

  const getCellFromPos = useCallback((x: number, y: number) => {
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (col < 0 || col >= config.width || row < 0 || row >= config.height) return null;
    return { row, col };
  }, [cellSize, config.width, config.height]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const cell = getCellFromPos(pos.x, pos.y);
    if (!cell) return;

    if (activeTool === 'fill') {
      floodFill(cell.row, cell.col);
      return;
    }
    if (activeTool === 'eyedropper') {
      pickColor(cell.row, cell.col);
      setTool('pencil');
      return;
    }

    setIsPainting(true);
    const key = `${cell.row},${cell.col}`;
    if (lastPainted.current === key) return;
    lastPainted.current = key;

    if (activeTool === 'pencil') paintCell(cell.row, cell.col);
    else if (activeTool === 'eraser') eraseCell(cell.row, cell.col);
  }, [activeTool, getCellFromPos, paintCell, eraseCell, floodFill, pickColor, setTool]);

  const handleMouseMove = useCallback(() => {
    if (!isPainting) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const cell = getCellFromPos(pos.x, pos.y);
    if (!cell) return;

    const key = `${cell.row},${cell.col}`;
    if (lastPainted.current === key) return;
    lastPainted.current = key;

    if (activeTool === 'pencil') paintCell(cell.row, cell.col);
    else if (activeTool === 'eraser') eraseCell(cell.row, cell.col);
  }, [isPainting, activeTool, getCellFromPos, paintCell, eraseCell]);

  const handleMouseUp = useCallback(() => {
    setIsPainting(false);
    lastPainted.current = null;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); useCanvasStore.getState().undo(); }
        if (e.key === 'y') { e.preventDefault(); useCanvasStore.getState().redo(); }
      }
      if (e.key === 'p') setTool('pencil');
      if (e.key === 'f') setTool('fill');
      if (e.key === 'e') setTool('eraser');
      if (e.key === 'i') setTool('eyedropper');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setTool]);

  // Build flat list of all visible cells for rendering
  const allCells: { key: string; row: number; col: number; cell: StitchCell }[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const [key, cell] of layer.cells) {
      if (!cell.color) continue;
      const [r, c] = key.split(',').map(Number);
      allCells.push({ key: `${layer.id}-${key}`, row: r, col: c, cell });
    }
  }

  // Grid lines
  const gridLines: JSX.Element[] = [];
  if (showGrid) {
    for (let col = 0; col <= config.width; col++) {
      const isGuide = col % GUIDE_EVERY === 0;
      gridLines.push(
        <Line
          key={`v${col}`}
          points={[col * cellSize, 0, col * cellSize, stageHeight]}
          stroke={isGuide ? '#94a3b8' : '#e2e8f0'}
          strokeWidth={isGuide ? 1.5 : 0.5}
          listening={false}
        />
      );
    }
    for (let row = 0; row <= config.height; row++) {
      const isGuide = row % GUIDE_EVERY === 0;
      gridLines.push(
        <Line
          key={`h${row}`}
          points={[0, row * cellSize, stageWidth, row * cellSize]}
          stroke={isGuide ? '#94a3b8' : '#e2e8f0'}
          strokeWidth={isGuide ? 1.5 : 0.5}
          listening={false}
        />
      );
    }
  }

  const cursorStyle =
    activeTool === 'pencil' ? 'crosshair' :
    activeTool === 'fill' ? 'cell' :
    activeTool === 'eraser' ? 'not-allowed' :
    activeTool === 'eyedropper' ? 'copy' :
    'default';

  return (
    <div
      style={{
        overflow: 'auto',
        flex: 1,
        background: '#f8fafc',
        cursor: cursorStyle,
      }}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ display: 'block' }}
      >
        {/* Background */}
        <Layer listening={false}>
          <Rect
            x={0} y={0}
            width={stageWidth} height={stageHeight}
            fill="white"
          />
        </Layer>

        {/* Stitch cells */}
        <Layer>
          {allCells.map(({ key, row, col, cell }) => (
            <Rect
              key={key}
              x={col * cellSize + 0.5}
              y={row * cellSize + 0.5}
              width={cellSize - 1}
              height={cellSize - 1}
              fill={cell.color ?? undefined}
              listening={false}
            />
          ))}
        </Layer>

        {/* Grid overlay */}
        {showGrid && (
          <Layer listening={false}>
            <Group>{gridLines}</Group>
          </Layer>
        )}
      </Stage>
    </div>
  );
}
