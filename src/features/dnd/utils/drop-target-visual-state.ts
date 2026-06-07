export type DropTargetVisualState = 'default' | 'file' | 'destructive'

const dropTargetRingClass: Record<DropTargetVisualState, string> = {
  default: 'ring-drop-target',
  file: 'ring-drop-target-file',
  destructive: 'ring-drop-target-destructive',
}

const dropTargetBeforeRingClass: Record<DropTargetVisualState, string> = {
  default: 'before:ring-drop-target',
  file: 'before:ring-drop-target-file',
  destructive: 'before:ring-drop-target-destructive',
}

const dropTargetFillClass: Record<DropTargetVisualState, string> = {
  default: 'bg-drop-target-fill',
  file: 'bg-drop-target-fill',
  destructive: 'bg-drop-target-destructive-fill',
}

const dropTargetSvgFillClass: Record<DropTargetVisualState, string> = {
  default: 'fill-drop-target-fill',
  file: 'fill-drop-target-fill',
  destructive: 'fill-drop-target-destructive-fill',
}

const dropTargetSvgStrokeClass: Record<DropTargetVisualState, string> = {
  default: 'stroke-drop-target',
  file: 'stroke-drop-target-file',
  destructive: 'stroke-drop-target-destructive',
}

export function dropTargetChromeClass(state: DropTargetVisualState) {
  return `ring-2 ring-inset ${dropTargetRingClass[state]} ${dropTargetFillClass[state]}`
}

export function dropTargetBeforeRingClassName(state: DropTargetVisualState) {
  return dropTargetBeforeRingClass[state]
}

export function dropTargetFillClassName(state: DropTargetVisualState) {
  return dropTargetFillClass[state]
}

export function dropTargetSvgFillClassName(state: DropTargetVisualState) {
  return dropTargetSvgFillClass[state]
}

export function dropTargetSvgStrokeClassName(state: DropTargetVisualState) {
  return dropTargetSvgStrokeClass[state]
}
