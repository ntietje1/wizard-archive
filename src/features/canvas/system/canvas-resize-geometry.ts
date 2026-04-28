import { getSnapThresholdForZoom } from '../runtime/interaction/canvas-drag-snap-utils'
import { resolveResizeBounds } from './canvas-resize-bounds'
import { resolveResizeSnap } from './canvas-resize-snap'
import type { CanvasDragGuide } from '../runtime/interaction/canvas-drag-snap-utils'
import type { CanvasResizeBounds, CanvasResizeHandlePosition } from './canvas-resize-handles'

export type { CanvasResizeHandlePosition } from './canvas-resize-handles'
export { affectsCanvasResizeAxis } from './canvas-resize-handles'

interface CanvasResizeGeometryResult {
  bounds: CanvasResizeBounds
  guides: ReadonlyArray<CanvasDragGuide>
}

export interface CanvasResizeGeometryOptions {
  handlePosition: CanvasResizeHandlePosition
  startBounds: CanvasResizeBounds
  currentPoint: { x: number; y: number }
  targetBounds: ReadonlyArray<CanvasResizeBounds>
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
  snap: boolean
  zoom: number
}

export function resolveCanvasResize({
  handlePosition,
  startBounds,
  currentPoint,
  targetBounds,
  minWidth,
  minHeight,
  lockedAspectRatio,
  square,
  snap,
  zoom,
}: CanvasResizeGeometryOptions): CanvasResizeGeometryResult {
  const bounds = resolveResizeBounds({
    handlePosition,
    startBounds,
    currentPoint,
    minWidth,
    minHeight,
    lockedAspectRatio,
    square,
  })

  if (!snap || targetBounds.length === 0) {
    return { bounds, guides: [] }
  }

  const snapResult = resolveResizeSnap({
    bounds,
    currentPoint,
    handlePosition,
    targetBounds,
    threshold: getSnapThresholdForZoom(zoom),
    minWidth,
    minHeight,
    lockedAspectRatio,
    square,
  })

  return {
    bounds: snapResult?.bounds ?? bounds,
    guides: snapResult?.guides ?? [],
  }
}
