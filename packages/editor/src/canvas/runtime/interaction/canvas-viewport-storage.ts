import type { SidebarItemId } from '../../../../../../shared/common/ids'

export interface PersistedCanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface CanvasViewportStore {
  loadCanvasViewport: (canvasId: SidebarItemId) => PersistedCanvasViewport
  saveCanvasViewport: (canvasId: SidebarItemId, viewport: PersistedCanvasViewport) => void
}
