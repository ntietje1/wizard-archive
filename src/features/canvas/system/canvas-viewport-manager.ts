import { EMPTY_SET } from './canvas-document-projector'
import type { CanvasEngineSnapshot, CanvasViewport } from './canvas-engine-types'
import type { CanvasPosition } from '../types/canvas-domain-types'

const MIN_ZOOM_SHAPE_COUNT_THRESHOLD = 500
const VIEWPORT_EQUALITY_EPSILON = 1e-6

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
    position: CanvasPosition,
    surfaceBounds: DOMRect | null,
  ) => CanvasPosition
  canvasToScreenPosition: (
    snapshot: CanvasEngineSnapshot,
    position: CanvasPosition,
    surfaceBounds: DOMRect | null,
  ) => CanvasPosition
  reset: () => void
}

export function createCanvasViewportManager(): CanvasViewportManager {
  let hasUncommittedViewport = false
  const getDebouncedZoomLevel = (snapshot: CanvasEngineSnapshot) =>
    snapshot.cameraState === 'idle' ? snapshot.viewport.zoom : snapshot.debouncedZoomLevel

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
    getDebouncedZoomLevel,
    getEfficientZoomLevel: (snapshot) =>
      snapshot.nodes.length + snapshot.edges.length > MIN_ZOOM_SHAPE_COUNT_THRESHOLD
        ? getDebouncedZoomLevel(snapshot)
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
  return (
    Math.abs(left.x - right.x) <= VIEWPORT_EQUALITY_EPSILON &&
    Math.abs(left.y - right.y) <= VIEWPORT_EQUALITY_EPSILON &&
    Math.abs(left.zoom - right.zoom) <= VIEWPORT_EQUALITY_EPSILON
  )
}
