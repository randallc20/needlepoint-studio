export type Tool =
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
  cells: Map<string, StitchCell>; // key: "row,col"
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
