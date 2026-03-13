export type Tool =
  | 'pointer'
  | 'pencil'
  | 'fill'
  | 'eyedropper'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'select';

export type StitchType =
  | 'tent'
  | 'continental'
  | 'basketweave'
  | 'longstitch'
  | 'backstitch'
  | 'frenchknot'
  | 'none';

export interface DmcColor {
  number: string;
  name: string;
  r: number;
  g: number;
  b: number;
  hex: string;
  lab?: { l: number; a: number; b: number };
}

export interface StitchCell {
  color: string | null; // hex color
  dmcNumber: string | null;
  stitchType: StitchType;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  cells: Record<string, StitchCell>; // key: "row,col"
}

export interface CanvasConfig {
  width: number;   // stitches wide
  height: number;  // stitches tall
  meshCount: 10 | 13 | 14 | 18 | 22;
  cellSize: number; // pixels per stitch at 100% zoom
}

export interface Project {
  id: string;
  name: string;
  config: CanvasConfig;
  layers: Layer[];
  activeLayerId: string;
  activeColor: string;
  activeDmcNumber: string | null;
  palette: DmcColor[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface PatternGenerationStatus {
  step: 'idle' | 'refining' | 'generating-image' | 'converting' | 'done' | 'error';
  message: string;
}

export interface ColorCount {
  dmcNumber: string;
  name: string;
  hex: string;
  stitchCount: number;
  squareInches: number;
  yardage: number;
  skeins: number;
}

export interface CellRect {
  minRow: number;
  minCol: number;
  maxRow: number;
  maxCol: number;
}

export interface TextMeta {
  text: string;
  fontFamily: string;
  fontIdx: number;
  sizePx: number;
  curve: number;
  rotation: 0 | 90 | 180 | 270;
  hexColor: string;
  dmcNumber: string | null;
}

export interface CellGroup {
  id: string;
  name: string;
  layerId: string;
  cellKeys: Set<string>;
  locked: boolean;
  textMeta?: TextMeta;
}

export interface ClipboardData {
  cells: Record<string, StitchCell>;
  width: number;
  height: number;
  groups?: { cellKeys: string[] }[];
}

export interface SavedStamp {
  id: string;
  name: string;
  cells: Record<string, StitchCell>;
  width: number;
  height: number;
  createdAt: string;
  thumbnail: string;
}

export interface CanvasPrintConfig {
  meshCount: number;
  scaleFactor: number;        // 10 | 15 | 20 | 25 | 30
  margins: { top: number; bottom: number; left: number; right: number }; // inches
  format: 'tiff' | 'png';
  colorProfile: 'srgb' | 'adobe-rgb' | 'custom';
  customIccProfile?: ArrayBuffer;
  embedIccProfile: boolean;
}
