import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Group, Text, Circle } from 'react-konva';
import Konva from 'konva';
import { useCanvasStore } from '../../store/canvasStore';
import { assignSymbols } from '../../data/symbolSet';
import { setGlobalStage } from '../../utils/stageRef';
import type { StitchCell, CellRect } from '../../types';

const GUIDE_EVERY = 10;

// Bresenham's line algorithm
function bresenhamLine(r0: number, c0: number, r1: number, c1: number): [number, number][] {
  const cells: [number, number][] = [];
  const dc = Math.abs(c1 - c0);
  const dr = Math.abs(r1 - r0);
  const sc = c0 < c1 ? 1 : -1;
  const sr = r0 < r1 ? 1 : -1;
  let err = dc - dr;
  let r = r0, c = c0;
  while (true) {
    cells.push([r, c]);
    if (r === r1 && c === c1) break;
    const e2 = 2 * err;
    if (e2 > -dr) { err -= dr; c += sc; }
    if (e2 < dc) { err += dc; r += sr; }
  }
  return cells;
}

// Rectangle outline cells
function rectangleOutline(r0: number, c0: number, r1: number, c1: number): [number, number][] {
  const cells: [number, number][] = [];
  const minR = Math.min(r0, r1), maxR = Math.max(r0, r1);
  const minC = Math.min(c0, c1), maxC = Math.max(c0, c1);
  for (let c = minC; c <= maxC; c++) {
    cells.push([minR, c]);
    if (minR !== maxR) cells.push([maxR, c]);
  }
  for (let r = minR + 1; r < maxR; r++) {
    cells.push([r, minC]);
    if (minC !== maxC) cells.push([r, maxC]);
  }
  return cells;
}

// Filled rectangle
function rectangleFilled(r0: number, c0: number, r1: number, c1: number): [number, number][] {
  const cells: [number, number][] = [];
  const minR = Math.min(r0, r1), maxR = Math.max(r0, r1);
  const minC = Math.min(c0, c1), maxC = Math.max(c0, c1);
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      cells.push([r, c]);
    }
  }
  return cells;
}

// Midpoint ellipse algorithm (outline)
function ellipseOutline(r0: number, c0: number, r1: number, c1: number): [number, number][] {
  const set = new Set<string>();
  const cx = (c0 + c1) / 2;
  const cy = (r0 + r1) / 2;
  const rx = Math.abs(c1 - c0) / 2;
  const ry = Math.abs(r1 - r0) / 2;
  if (rx < 0.5 && ry < 0.5) return [[Math.round(cy), Math.round(cx)]];

  const addPoint = (row: number, col: number) => {
    const rr = Math.round(row);
    const cc = Math.round(col);
    set.add(`${rr},${cc}`);
  };

  // Plot 4 symmetric points
  const plot4 = (cxf: number, cyf: number, x: number, y: number) => {
    addPoint(cyf + y, cxf + x);
    addPoint(cyf + y, cxf - x);
    addPoint(cyf - y, cxf + x);
    addPoint(cyf - y, cxf - x);
  };

  // Bresenham-style midpoint ellipse
  let x = 0, y = ry;
  let rx2 = rx * rx, ry2 = ry * ry;
  let p1 = ry2 - rx2 * ry + 0.25 * rx2;

  // Region 1
  while (ry2 * x <= rx2 * y) {
    plot4(cx, cy, x, y);
    x++;
    if (p1 < 0) {
      p1 += 2 * ry2 * x + ry2;
    } else {
      y--;
      p1 += 2 * ry2 * x - 2 * rx2 * y + ry2;
    }
  }

  // Region 2
  let p2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
  while (y >= 0) {
    plot4(cx, cy, x, y);
    y--;
    if (p2 > 0) {
      p2 -= 2 * rx2 * y + rx2;
    } else {
      x++;
      p2 += 2 * ry2 * x - 2 * rx2 * y + rx2;
    }
  }

  return Array.from(set).map(k => {
    const [r, c] = k.split(',').map(Number);
    return [r, c] as [number, number];
  });
}

// Filled ellipse (scanline fill)
function ellipseFilled(r0: number, c0: number, r1: number, c1: number): [number, number][] {
  const cells: [number, number][] = [];
  const cx = (c0 + c1) / 2;
  const cy = (r0 + r1) / 2;
  const rx = Math.abs(c1 - c0) / 2;
  const ry = Math.abs(r1 - r0) / 2;
  if (rx < 0.5 && ry < 0.5) return [[Math.round(cy), Math.round(cx)]];

  const minR = Math.min(r0, r1), maxR = Math.max(r0, r1);
  for (let r = minR; r <= maxR; r++) {
    const dy = r - cy;
    if (ry === 0) {
      cells.push([r, Math.round(cx)]);
      continue;
    }
    const xSpan = rx * Math.sqrt(1 - (dy * dy) / (ry * ry));
    const cLeft = Math.round(cx - xSpan);
    const cRight = Math.round(cx + xSpan);
    for (let c = cLeft; c <= cRight; c++) {
      cells.push([r, c]);
    }
  }
  return cells;
}

// Compute shape cells based on tool type and filled state
function computeShapeCells(tool: string, filled: boolean, r0: number, c0: number, r1: number, c1: number): [number, number][] {
  switch (tool) {
    case 'line':
      return bresenhamLine(r0, c0, r1, c1);
    case 'rectangle':
      return filled ? rectangleFilled(r0, c0, r1, c1) : rectangleOutline(r0, c0, r1, c1);
    case 'ellipse':
      return filled ? ellipseFilled(r0, c0, r1, c1) : ellipseOutline(r0, c0, r1, c1);
    default:
      return [];
  }
}

export function NeedlepointGrid() {
  const config = useCanvasStore(s => s.config);
  const layers = useCanvasStore(s => s.layers);
  const activeTool = useCanvasStore(s => s.activeTool);
  const activeColor = useCanvasStore(s => s.activeColor);
  const showGrid = useCanvasStore(s => s.showGrid);
  const zoom = useCanvasStore(s => s.zoom);
  const viewMode = useCanvasStore(s => s.viewMode);
  const showStitchOverlays = useCanvasStore(s => s.showStitchOverlays);
  const selection = useCanvasStore(s => s.selection);
  const selectionBounds = useCanvasStore(s => s.selectionBounds);
  const groups = useCanvasStore(s => s.groups);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const isPaintingRef = useRef(false);
  const lastPainted = useRef<string | null>(null);

  // Pan state (pointer tool drag, middle-mouse, or space+drag)
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Shape tool state
  const shapeStartRef = useRef<{ row: number; col: number } | null>(null);
  const [previewCells, setPreviewCells] = useState<[number, number][]>([]);

  // Selection tool state
  const selectStartRef = useRef<{ row: number; col: number } | null>(null);
  const [selectPreviewRect, setSelectPreviewRect] = useState<CellRect | null>(null);
  const moveStartRef = useRef<{ row: number; col: number } | null>(null);
  const [moveDelta, setMoveDelta] = useState<{ dr: number; dc: number } | null>(null);
  const isDraggingMoveRef = useRef(false);

  const cellSize = config.cellSize * zoom;
  const stageWidth = config.width * cellSize;
  const stageHeight = config.height * cellSize;

  const getCellFromPos = useCallback((x: number, y: number) => {
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (col < 0 || col >= config.width || row < 0 || row >= config.height) return null;
    return { row, col };
  }, [cellSize, config.width, config.height]);

  const shapeFilled = useCanvasStore(s => s.shapeFilled);
  const isShapeTool = activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'ellipse';

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Skip if panning (pointer tool, middle-mouse, or space+drag)
    if (isPanningRef.current) return;

    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const cell = getCellFromPos(pos.x, pos.y);
    if (!cell) return;

    const store = useCanvasStore.getState();

    // Pointer tool is for panning only — don't process as cell action
    if (store.activeTool === 'pointer') return;

    if (store.activeTool === 'fill') {
      store.floodFill(cell.row, cell.col);
      return;
    }
    if (store.activeTool === 'eyedropper') {
      store.pickColor(cell.row, cell.col);
      return;
    }

    // Select tool
    if (store.activeTool === 'select') {
      const clickedKey = `${cell.row},${cell.col}`;
      const currentSelection = store.selection;
      const bounds = store.selectionBounds;

      // Click inside current selection → start move drag
      if (currentSelection && currentSelection.size > 0 && bounds &&
          cell.row >= bounds.minRow && cell.row <= bounds.maxRow &&
          cell.col >= bounds.minCol && cell.col <= bounds.maxCol) {
        moveStartRef.current = { row: cell.row, col: cell.col };
        isDraggingMoveRef.current = true;
        setMoveDelta({ dr: 0, dc: 0 });
        return;
      }

      // Click on a grouped cell → select entire group
      const groupId = store.findGroupForCell(clickedKey);
      if (groupId) {
        const group = store.groups[groupId];
        store.setSelection(new Set(group.cellKeys));
        return;
      }

      // Otherwise → start rubber-band selection
      store.clearSelection();
      selectStartRef.current = { row: cell.row, col: cell.col };
      setSelectPreviewRect({ minRow: cell.row, minCol: cell.col, maxRow: cell.row, maxCol: cell.col });
      return;
    }

    // Shape tools: record start point
    if (store.activeTool === 'line' || store.activeTool === 'rectangle' || store.activeTool === 'ellipse') {
      shapeStartRef.current = { row: cell.row, col: cell.col };
      setPreviewCells([[cell.row, cell.col]]);
      return;
    }

    isPaintingRef.current = true;
    const key = `${cell.row},${cell.col}`;
    lastPainted.current = key;

    if (store.activeTool === 'pencil') {
      store.paintCell(cell.row, cell.col);
    } else if (store.activeTool === 'eraser') {
      const half = Math.floor(store.eraserSize / 2);
      if (half === 0) {
        store.eraseCell(cell.row, cell.col);
      } else {
        const toErase: [number, number][] = [];
        for (let dr = -half; dr <= half; dr++) {
          for (let dc = -half; dc <= half; dc++) {
            toErase.push([cell.row + dr, cell.col + dc]);
          }
        }
        store.eraseCells(toErase);
      }
    }
  }, [getCellFromPos]);

  const handleMouseMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const cell = getCellFromPos(pos.x, pos.y);
    if (!cell) return;

    const store = useCanvasStore.getState();

    // Select tool: rubber-band or move
    if (store.activeTool === 'select') {
      if (isDraggingMoveRef.current && moveStartRef.current) {
        const dr = cell.row - moveStartRef.current.row;
        const dc = cell.col - moveStartRef.current.col;
        setMoveDelta({ dr, dc });
        return;
      }
      if (selectStartRef.current) {
        const start = selectStartRef.current;
        setSelectPreviewRect({
          minRow: Math.min(start.row, cell.row),
          minCol: Math.min(start.col, cell.col),
          maxRow: Math.max(start.row, cell.row),
          maxCol: Math.max(start.col, cell.col),
        });
        return;
      }
      return;
    }

    // Shape tool preview
    if (shapeStartRef.current && (store.activeTool === 'line' || store.activeTool === 'rectangle' || store.activeTool === 'ellipse')) {
      const start = shapeStartRef.current;
      const cells = computeShapeCells(store.activeTool, store.shapeFilled, start.row, start.col, cell.row, cell.col);
      setPreviewCells(cells);
      return;
    }

    // Normal painting
    if (!isPaintingRef.current) return;
    const key = `${cell.row},${cell.col}`;
    if (lastPainted.current === key) return;
    lastPainted.current = key;

    if (store.activeTool === 'pencil') {
      store.paintCell(cell.row, cell.col);
    } else if (store.activeTool === 'eraser') {
      const half = Math.floor(store.eraserSize / 2);
      if (half === 0) {
        store.eraseCell(cell.row, cell.col);
      } else {
        const toErase: [number, number][] = [];
        for (let dr = -half; dr <= half; dr++) {
          for (let dc = -half; dc <= half; dc++) {
            toErase.push([cell.row + dr, cell.col + dc]);
          }
        }
        store.eraseCells(toErase);
      }
    }
  }, [getCellFromPos]);

  const handleMouseUp = useCallback(() => {
    const store = useCanvasStore.getState();

    // Commit select tool actions
    if (store.activeTool === 'select') {
      if (isDraggingMoveRef.current && moveDelta && (moveDelta.dr !== 0 || moveDelta.dc !== 0)) {
        store.moveSelection(moveDelta.dr, moveDelta.dc);
      }
      isDraggingMoveRef.current = false;
      moveStartRef.current = null;
      setMoveDelta(null);

      if (selectStartRef.current && selectPreviewRect) {
        store.selectRect(
          selectPreviewRect.minRow, selectPreviewRect.minCol,
          selectPreviewRect.maxRow, selectPreviewRect.maxCol
        );
      }
      selectStartRef.current = null;
      setSelectPreviewRect(null);
      return;
    }

    // Commit shape if active
    if (shapeStartRef.current) {
      if (store.activeTool === 'line' || store.activeTool === 'rectangle' || store.activeTool === 'ellipse') {
        const stage = stageRef.current;
        if (stage) {
          const pos = stage.getPointerPosition();
          if (pos) {
            const cell = getCellFromPos(pos.x, pos.y);
            if (cell) {
              const start = shapeStartRef.current;
              const cells = computeShapeCells(store.activeTool, store.shapeFilled, start.row, start.col, cell.row, cell.col);
              store.paintCells(cells);
            }
          }
        }
      }
      shapeStartRef.current = null;
      setPreviewCells([]);
    }

    isPaintingRef.current = false;
    lastPainted.current = null;
  }, [getCellFromPos, moveDelta, selectPreviewRect]);

  // Register stage ref globally for export
  useEffect(() => {
    if (stageRef.current) setGlobalStage(stageRef.current);
    return () => setGlobalStage(null);
  }, []);

  // Mouse wheel zoom (Ctrl+scroll, or plain scroll when scrollZoomEnabled)
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      const store = useCanvasStore.getState();
      if (!store.scrollZoomEnabled && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // Proportional zoom: scales smoothly with scroll delta
      // Mouse wheel (~100 delta) → ~10% zoom, trackpad (~2-5 delta) → tiny smooth steps
      const factor = Math.pow(1.001, -e.deltaY);
      store.setZoom(store.zoom * factor);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Pan via pointer tool drag, middle-mouse drag, or space+drag
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      const store = useCanvasStore.getState();
      const isMiddle = e.button === 1;
      const isPointerTool = store.activeTool === 'pointer' && e.button === 0;
      const isSpacePan = spaceHeld && e.button === 0;
      if (!isMiddle && !isPointerTool && !isSpacePan) return;

      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      };
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPanningRef.current || !panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      el.scrollLeft = panStartRef.current.scrollLeft - dx;
      el.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        panStartRef.current = null;
        el.releasePointerCapture(e.pointerId);
      }
    };

    // Prevent default middle-click autoscroll
    const onAuxClick = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('auxclick', onAuxClick);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('auxclick', onAuxClick);
    };
  }, [spaceHeld]);

  // Track space key for pan-while-held
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        // Cancel any ongoing pan if space is released
        isPanningRef.current = false;
        panStartRef.current = null;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const store = useCanvasStore.getState();

      // Modifier key combos
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); store.undo(); return; }
        if (e.key === 'y') { e.preventDefault(); store.redo(); return; }
        if (e.key === 'a') { e.preventDefault(); store.setTool('select'); store.selectAll(); return; }
        if (e.key === 'c') { e.preventDefault(); store.copySelection(); return; }
        if (e.key === 'v') {
          e.preventDefault();
          const cb = store.clipboard;
          if (cb) {
            const centerR = Math.floor(store.config.height / 2) - Math.floor(cb.height / 2);
            const centerC = Math.floor(store.config.width / 2) - Math.floor(cb.width / 2);
            store.pasteClipboard(centerR, centerC);
          }
          return;
        }
        if (e.key === 'g' || e.key === 'G') {
          e.preventDefault();
          if (e.shiftKey) store.ungroupSelection();
          else store.groupSelection();
          return;
        }
        // Ctrl+zoom shortcuts
        if (e.key === '=' || e.key === '+') { e.preventDefault(); store.setZoom(store.zoom * 1.25); return; }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); store.setZoom(store.zoom / 1.25); return; }
        if (e.key === '0') { e.preventDefault(); store.setZoom(1); return; }
        return;
      }

      // Non-modifier keys
      if (e.key === 'Escape') { store.clearSelection(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selection && store.selection.size > 0) {
          e.preventDefault();
          store.deleteSelection();
          return;
        }
      }

      // Tool shortcuts
      if (e.key === 'v') store.setTool('pointer');
      if (e.key === 's') store.setTool('select');
      if (e.key === 'p') store.setTool('pencil');
      if (e.key === 'f') store.setTool('fill');
      if (e.key === 'e') store.setTool('eraser');
      if (e.key === 'i') store.setTool('eyedropper');
      if (e.key === 'l') store.setTool('line');
      if (e.key === 'r') store.setTool('rectangle');
      if (e.key === 'c') store.setTool('ellipse');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Build flat list of all visible cells for rendering
  const allCells: { key: string; row: number; col: number; cell: StitchCell }[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const [key, cell] of Object.entries(layer.cells)) {
      if (!cell.color) continue;
      const [r, c] = key.split(',').map(Number);
      allCells.push({ key: `${layer.id}-${key}`, row: r, col: c, cell });
    }
  }

  // Build symbol map from unique DMC numbers
  const symbolMap = useMemo(() => {
    const dmcSet = new Set<string>();
    for (const { cell } of allCells) {
      if (cell.dmcNumber) dmcSet.add(cell.dmcNumber);
      else if (cell.color) dmcSet.add(cell.color); // fallback to hex if no DMC
    }
    return assignSymbols(Array.from(dmcSet));
  }, [allCells]);

  const showSymbols = viewMode === 'symbol' || viewMode === 'combined';
  const showColors = viewMode === 'color' || viewMode === 'combined';

  // Compute grouped cell keys for visual indicator
  const groupedCellKeys = useMemo(() => {
    const activeLayerId = useCanvasStore.getState().activeLayerId;
    const keys = new Set<string>();
    for (const group of Object.values(groups)) {
      if (group.layerId === activeLayerId) {
        for (const k of group.cellKeys) keys.add(k);
      }
    }
    return keys;
  }, [groups]);

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
    spaceHeld ? (isPanningRef.current ? 'grabbing' : 'grab') :
    activeTool === 'pointer' ? 'grab' :
    activeTool === 'select' ? (isDraggingMoveRef.current ? 'grabbing' : 'crosshair') :
    activeTool === 'pencil' ? 'crosshair' :
    activeTool === 'fill' ? 'cell' :
    activeTool === 'eraser' ? 'not-allowed' :
    activeTool === 'eyedropper' ? 'copy' :
    activeTool === 'line' ? 'crosshair' :
    activeTool === 'rectangle' ? 'crosshair' :
    activeTool === 'ellipse' ? 'crosshair' :
    'default';

  const fontSize = Math.max(6, cellSize * 0.6);

  return (
    <div
      ref={canvasWrapperRef}
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
        <Layer listening={false}>
          {allCells.map(({ key, row, col, cell }) => {
            const x = col * cellSize + 0.5;
            const y = row * cellSize + 0.5;
            const w = cellSize - 1;
            const h = cellSize - 1;
            const dmcKey = cell.dmcNumber ?? cell.color ?? '';
            const symbol = symbolMap.get(dmcKey) ?? '?';

            return (
              <Group key={key}>
                {/* Color fill */}
                <Rect
                  x={x} y={y}
                  width={w} height={h}
                  fill={showColors ? (cell.color ?? undefined) : '#ffffff'}
                  listening={false}
                />
                {/* Symbol text */}
                {showSymbols && (
                  <Text
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    text={symbol}
                    fontSize={fontSize}
                    fontFamily="monospace"
                    fontStyle="bold"
                    fill={viewMode === 'combined' ? '#ffffff' : '#000000'}
                    shadowColor={viewMode === 'combined' ? '#000000' : undefined}
                    shadowBlur={viewMode === 'combined' ? 2 : 0}
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                  />
                )}
                {/* Group indicator: tiny amber dot */}
                {groupedCellKeys.has(`${row},${col}`) && (
                  <Rect
                    x={x + w - 3}
                    y={y}
                    width={4}
                    height={4}
                    fill="#f59e0b"
                    listening={false}
                  />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Stitch type overlays */}
        {showStitchOverlays && (
          <Layer listening={false}>
            {allCells.map(({ key, row, col, cell }) => {
              const x = col * cellSize;
              const y = row * cellSize;
              const s = cellSize;
              const strokeColor = 'rgba(0,0,0,0.4)';
              const sw = Math.max(1, cellSize * 0.08);

              switch (cell.stitchType) {
                case 'tent':
                  return (
                    <Line
                      key={`st-${key}`}
                      points={[x + s * 0.15, y + s * 0.85, x + s * 0.85, y + s * 0.15]}
                      stroke={strokeColor}
                      strokeWidth={sw}
                      listening={false}
                    />
                  );
                case 'continental':
                  return (
                    <Group key={`st-${key}`}>
                      <Line
                        points={[x + s * 0.15, y + s * 0.85, x + s * 0.85, y + s * 0.15]}
                        stroke={strokeColor}
                        strokeWidth={sw}
                        listening={false}
                      />
                      <Line
                        points={[x + s * 0.85, y + s * 0.15, x + s * 0.95, y + s * 0.25]}
                        stroke={strokeColor}
                        strokeWidth={sw}
                        listening={false}
                      />
                    </Group>
                  );
                case 'basketweave':
                  return (
                    <Line
                      key={`st-${key}`}
                      points={
                        (row + col) % 2 === 0
                          ? [x + s * 0.15, y + s * 0.85, x + s * 0.85, y + s * 0.15]
                          : [x + s * 0.15, y + s * 0.15, x + s * 0.85, y + s * 0.85]
                      }
                      stroke={strokeColor}
                      strokeWidth={sw}
                      listening={false}
                    />
                  );
                case 'longstitch':
                  return (
                    <Line
                      key={`st-${key}`}
                      points={[x + s * 0.5, y + s * 0.1, x + s * 0.5, y + s * 0.9]}
                      stroke={strokeColor}
                      strokeWidth={sw * 1.5}
                      listening={false}
                    />
                  );
                case 'backstitch':
                  return (
                    <Line
                      key={`st-${key}`}
                      points={[x + s * 0.05, y + s * 0.95, x + s * 0.95, y + s * 0.95]}
                      stroke={strokeColor}
                      strokeWidth={sw * 2}
                      listening={false}
                    />
                  );
                case 'frenchknot':
                  return (
                    <Circle
                      key={`st-${key}`}
                      x={x + s * 0.5}
                      y={y + s * 0.5}
                      radius={s * 0.15}
                      fill={strokeColor}
                      listening={false}
                    />
                  );
                default:
                  return null;
              }
            })}
          </Layer>
        )}

        {/* Shape preview overlay */}
        {isShapeTool && previewCells.length > 0 && (
          <Layer listening={false}>
            {previewCells.map(([r, c]) => (
              <Rect
                key={`preview-${r}-${c}`}
                x={c * cellSize + 0.5}
                y={r * cellSize + 0.5}
                width={cellSize - 1}
                height={cellSize - 1}
                fill={activeColor}
                opacity={0.5}
                listening={false}
              />
            ))}
          </Layer>
        )}

        {/* Rubber-band selection preview */}
        {activeTool === 'select' && selectPreviewRect && !isDraggingMoveRef.current && (
          <Layer listening={false}>
            <Rect
              x={selectPreviewRect.minCol * cellSize}
              y={selectPreviewRect.minRow * cellSize}
              width={(selectPreviewRect.maxCol - selectPreviewRect.minCol + 1) * cellSize}
              height={(selectPreviewRect.maxRow - selectPreviewRect.minRow + 1) * cellSize}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dash={[6, 3]}
              listening={false}
            />
          </Layer>
        )}

        {/* Active selection highlight */}
        {selection && selectionBounds && !moveDelta && (
          <Layer listening={false}>
            {/* Per-cell overlay (skip for large selections) */}
            {selection.size <= 1000 && Array.from(selection).map(key => {
              const [r, c] = key.split(',').map(Number);
              return (
                <Rect
                  key={`sel-${key}`}
                  x={c * cellSize}
                  y={r * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="rgba(59, 130, 246, 0.15)"
                  stroke="rgba(59, 130, 246, 0.5)"
                  strokeWidth={0.5}
                  listening={false}
                />
              );
            })}
            {/* Outer bounding rectangle */}
            <Rect
              x={selectionBounds.minCol * cellSize}
              y={selectionBounds.minRow * cellSize}
              width={(selectionBounds.maxCol - selectionBounds.minCol + 1) * cellSize}
              height={(selectionBounds.maxRow - selectionBounds.minRow + 1) * cellSize}
              fill={selection.size > 1000 ? 'rgba(59, 130, 246, 0.08)' : 'transparent'}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[8, 4]}
              listening={false}
            />
          </Layer>
        )}

        {/* Move ghost preview */}
        {moveDelta && selection && (moveDelta.dr !== 0 || moveDelta.dc !== 0) && (
          <Layer listening={false}>
            {selection.size <= 500 ? (
              Array.from(selection).map(key => {
                const layer = layers.find(l => l.id === useCanvasStore.getState().activeLayerId);
                const cell = layer?.cells[key];
                if (!cell) return null;
                const [r, c] = key.split(',').map(Number);
                return (
                  <Rect
                    key={`move-${key}`}
                    x={(c + moveDelta.dc) * cellSize + 0.5}
                    y={(r + moveDelta.dr) * cellSize + 0.5}
                    width={cellSize - 1}
                    height={cellSize - 1}
                    fill={cell.color ?? undefined}
                    opacity={0.5}
                    listening={false}
                  />
                );
              })
            ) : (
              selectionBounds && (
                <Rect
                  x={(selectionBounds.minCol + moveDelta.dc) * cellSize}
                  y={(selectionBounds.minRow + moveDelta.dr) * cellSize}
                  width={(selectionBounds.maxCol - selectionBounds.minCol + 1) * cellSize}
                  height={(selectionBounds.maxRow - selectionBounds.minRow + 1) * cellSize}
                  fill="rgba(59, 130, 246, 0.2)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dash={[6, 3]}
                  listening={false}
                />
              )
            )}
          </Layer>
        )}

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
