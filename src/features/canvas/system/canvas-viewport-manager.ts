import { EMPTY_SET } from './canvas-document-projector'
import type { CanvasEngineSnapshot, CanvasViewport } from './canvas-engine-types'
import type { XYPosition } from '@xyflow/react'

const MIN_ZOOM_SHAPE_COUNT_THRESHOLD = 500

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 }

interface CanvasViewportManager {
  setViewport: (
    snapshot: CanvasEngineSnapshot,
    viewport: CanvasViewport,
  ) => Omit<CanvasEngineSnapshot, 'version'> | null
  setViewportLive: (
    snapshot: CanvasEngineSnapshot,
    viewport: CanvasViewport,
  ) => Omit<CanvasEngineSnapshot, 'version'> | null
  getDebouncedZoomLevel: (snapshot: CanvasEngineSnapshot) => number
  getEfficientZoomLevel: (snapshot: CanvasEngineSnapshot) => number
  screenToCanvasPosition: (
    snapshot: CanvasEngineSnapshot,
    position: XYPosition,
    surfaceBounds: DOMRect | null,
  ) => XYPosition
  canvasToScreenPosition: (
    snapshot: CanvasEngineSnapshot,
    position: XYPosition,
    surfaceBounds: DOMRect | null,
  ) => XYPosition
  reset: () => void
}

export function createCanvasViewportManager(): CanvasViewportManager {
  let hasUncommittedViewport = false

  return {
    setViewport: (snapshot, viewport) => {
      if (areCanvasViewportsEqual(snapshot.viewport, viewport) && !hasUncommittedViewport) {
        return null
      }

      hasUncommittedViewport = false
      return {
        ...snapshot,
        viewport,
        cameraState: 'idle',
        debouncedZoomLevel: viewport.zoom,
        dirtyNodeIds: EMPTY_SET,
        dirtyEdgeIds: EMPTY_SET,
      }
    },
    setViewportLive: (snapshot, viewport) => {
      if (areCanvasViewportsEqual(snapshot.viewport, viewport)) {
        return null
      }

      hasUncommittedViewport = true
      return {
        ...snapshot,
        viewport,
        cameraState: 'moving',
        debouncedZoomLevel:
          snapshot.cameraState === 'idle' ? snapshot.viewport.zoom : snapshot.debouncedZoomLevel,
      }
    },
    getDebouncedZoomLevel: (snapshot) =>
      snapshot.cameraState === 'idle' ? snapshot.viewport.zoom : snapshot.debouncedZoomLevel,
    getEfficientZoomLevel: (snapshot) =>
      snapshot.nodes.length + snapshot.edges.length > MIN_ZOOM_SHAPE_COUNT_THRESHOLD
        ? snapshot.cameraState === 'idle'
          ? snapshot.viewport.zoom
          : snapshot.debouncedZoomLevel
        : snapshot.viewport.zoom,
    screenToCanvasPosition: (snapshot, position, surfaceBounds) => {
      const originX = surfaceBounds?.left ?? 0
      const originY = surfaceBounds?.top ?? 0

      return {
        x: (position.x - originX - snapshot.viewport.x) / snapshot.viewport.zoom,
        y: (position.y - originY - snapshot.viewport.y) / snapshot.viewport.zoom,
      }
    },
    canvasToScreenPosition: (snapshot, position, surfaceBounds) => {
      const originX = surfaceBounds?.left ?? 0
      const originY = surfaceBounds?.top ?? 0

      return {
        x: position.x * snapshot.viewport.zoom + snapshot.viewport.x + originX,
        y: position.y * snapshot.viewport.zoom + snapshot.viewport.y + originY,
      }
    },
    reset: () => {
      hasUncommittedViewport = false
    },
  }
}

function areCanvasViewportsEqual(left: CanvasViewport, right: CanvasViewport) {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom
}
