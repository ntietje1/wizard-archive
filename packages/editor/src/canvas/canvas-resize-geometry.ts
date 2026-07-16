import type { CanvasBounds } from './canvas-bounds'
import type { CanvasResizeHandle } from './interaction-controller'
import type { CanvasNodeId } from '../resources/domain-id'

const MIN_CANVAS_NODE_SIZE = 40

export function resolveCanvasResizeBounds(
  handle: CanvasResizeHandle,
  initialBounds: CanvasBounds,
  point: Readonly<{ x: number; y: number }>,
  initialNodeBounds: ReadonlyMap<CanvasNodeId, CanvasBounds>,
  square: boolean,
): CanvasBounds {
  const minimum = minimumSelectionSize(initialBounds, initialNodeBounds)
  if (handle === 'top' || handle === 'right' || handle === 'bottom' || handle === 'left') {
    return resolveSideResize(handle, initialBounds, point, minimum)
  }
  const anchor = oppositeCorner(initialBounds, handle)
  const direction = resizeDirection(handle)
  const width = Math.max((point.x - anchor.x) * direction.x, minimum.width)
  const height = Math.max((point.y - anchor.y) * direction.y, minimum.height)
  const size = square ? Math.max(width, height, minimum.width, minimum.height) : null
  return normalizeBounds(anchor, {
    x: anchor.x + direction.x * (size ?? width),
    y: anchor.y + direction.y * (size ?? height),
  })
}

export function projectCanvasResizeNodeBounds(
  initialBounds: CanvasBounds,
  currentBounds: CanvasBounds,
  initialNodeBounds: ReadonlyMap<CanvasNodeId, CanvasBounds>,
): ReadonlyMap<CanvasNodeId, CanvasBounds> {
  const scaleX = initialBounds.width > 0 ? currentBounds.width / initialBounds.width : 1
  const scaleY = initialBounds.height > 0 ? currentBounds.height / initialBounds.height : 1
  return new Map(
    Array.from(initialNodeBounds, ([id, bounds]) => [
      id,
      {
        x: currentBounds.x + (bounds.x - initialBounds.x) * scaleX,
        y: currentBounds.y + (bounds.y - initialBounds.y) * scaleY,
        width: bounds.width * scaleX,
        height: bounds.height * scaleY,
      },
    ]),
  )
}

function minimumSelectionSize(
  selection: CanvasBounds,
  nodes: ReadonlyMap<CanvasNodeId, CanvasBounds>,
) {
  let minimumScaleX = 0
  let minimumScaleY = 0
  for (const bounds of nodes.values()) {
    if (bounds.width > 0)
      minimumScaleX = Math.max(minimumScaleX, MIN_CANVAS_NODE_SIZE / bounds.width)
    if (bounds.height > 0) {
      minimumScaleY = Math.max(minimumScaleY, MIN_CANVAS_NODE_SIZE / bounds.height)
    }
  }
  return {
    width: Math.max(1, selection.width * minimumScaleX),
    height: Math.max(1, selection.height * minimumScaleY),
  }
}

function resolveSideResize(
  handle: 'bottom' | 'left' | 'right' | 'top',
  bounds: CanvasBounds,
  point: Readonly<{ x: number; y: number }>,
  minimum: Readonly<{ width: number; height: number }>,
): CanvasBounds {
  switch (handle) {
    case 'left': {
      const right = bounds.x + bounds.width
      const width = Math.max(right - point.x, minimum.width)
      return { ...bounds, x: right - width, width }
    }
    case 'right':
      return { ...bounds, width: Math.max(point.x - bounds.x, minimum.width) }
    case 'top': {
      const bottom = bounds.y + bounds.height
      const height = Math.max(bottom - point.y, minimum.height)
      return { ...bounds, y: bottom - height, height }
    }
    case 'bottom':
      return { ...bounds, height: Math.max(point.y - bounds.y, minimum.height) }
  }
}

function oppositeCorner(bounds: CanvasBounds, handle: CanvasResizeHandle) {
  switch (handle) {
    case 'top-left':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
    case 'top-right':
      return { x: bounds.x, y: bounds.y + bounds.height }
    case 'bottom-left':
      return { x: bounds.x + bounds.width, y: bounds.y }
    case 'bottom-right':
      return { x: bounds.x, y: bounds.y }
    case 'top':
    case 'right':
    case 'bottom':
    case 'left':
      return { x: bounds.x, y: bounds.y }
  }
}

function resizeDirection(handle: CanvasResizeHandle) {
  return {
    x: handle === 'top-left' || handle === 'bottom-left' ? -1 : 1,
    y: handle === 'top-left' || handle === 'top-right' ? -1 : 1,
  }
}

function normalizeBounds(
  anchor: Readonly<{ x: number; y: number }>,
  point: Readonly<{ x: number; y: number }>,
): CanvasBounds {
  return {
    x: Math.min(anchor.x, point.x),
    y: Math.min(anchor.y, point.y),
    width: Math.abs(point.x - anchor.x),
    height: Math.abs(point.y - anchor.y),
  }
}
