import Konva from 'konva';

let _stage: Konva.Stage | null = null;

export function setGlobalStage(stage: Konva.Stage | null) {
  _stage = stage;
}

export function getGlobalStage(): Konva.Stage | null {
  return _stage;
}
