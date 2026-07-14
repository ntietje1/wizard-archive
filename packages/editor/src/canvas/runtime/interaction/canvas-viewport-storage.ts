import type { ResourceId } from '../../../resources/domain-id'
export interface PersistedCanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface CanvasViewportStore {
  loadCanvasViewport: (canvasId: ResourceId) => PersistedCanvasViewport
  saveCanvasViewport: (canvasId: ResourceId, viewport: PersistedCanvasViewport) => void
}
