import type { CanvasBounds } from './canvas-bounds'
import type { CanvasResizeHandle } from './interaction-controller'
import { bestSnapCandidate, canvasSnapThreshold, snapGuide } from './canvas-snap-geometry'
import type { CanvasSnapCandidate, CanvasSnapGuide } from './canvas-snap-geometry'
import type { CanvasNodeId } from '../resources/domain-id'

const MIN_CANVAS_NODE_SIZE = 40

export function resolveCanvasResize({
  handle,
  initialBounds,
  point,
  initialNodeBounds,
  targetBounds,
  square,
  snap,
  zoom,
}: {
  handle: CanvasResizeHandle
  initialBounds: CanvasBounds
  point: Readonly<{ x: number; y: number }>
  initialNodeBounds: ReadonlyMap<CanvasNodeId, CanvasBounds>
  targetBounds: ReadonlyArray<CanvasBounds>
  square: boolean
  snap: boolean
  zoom: number
}): Readonly<{ bounds: CanvasBounds; guides: ReadonlyArray<CanvasSnapGuide> }> {
  const bounds = resolveCanvasResizeBounds(handle, initialBounds, point, initialNodeBounds, square)
  if (!snap || targetBounds.length === 0) return { bounds, guides: [] }
  const threshold = canvasSnapThreshold(zoom)
  const xCandidates = affectsResizeAxis(handle, 'x')
    ? targetBounds.flatMap((target) => resizeSnapCandidates('x', bounds, target, handle))
    : []
  const yCandidates = affectsResizeAxis(handle, 'y')
    ? targetBounds.flatMap((target) => resizeSnapCandidates('y', bounds, target, handle))
    : []
  const candidates = square
    ? [bestSnapCandidate([...xCandidates, ...yCandidates], threshold)]
    : [bestSnapCandidate(xCandidates, threshold), bestSnapCandidate(yCandidates, threshold)]
  const selected = candidates.filter(
    (candidate): candidate is CanvasResizeSnapCandidate => candidate !== null,
  )
  if (selected.length === 0) return { bounds, guides: [] }
  const snappedPoint = { ...point }
  selected.forEach((candidate) => {
    snappedPoint[candidate.axis] = candidate.point
  })
  const snappedBounds = resolveCanvasResizeBounds(
    handle,
    initialBounds,
    snappedPoint,
    initialNodeBounds,
    square,
  )
  return {
    bounds: snappedBounds,
    guides: selected.flatMap((candidate) =>
      resizeCandidatePreserved(snappedBounds, handle, candidate)
        ? [snapGuide(candidate.axis, candidate)]
        : [],
    ),
  }
}

function resolveCanvasResizeBounds(
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

type CanvasResizeSnapCandidate = CanvasSnapCandidate &
  Readonly<{ axis: 'x' | 'y'; point: number; center: boolean }>

function resizeSnapCandidates(
  axis: 'x' | 'y',
  bounds: CanvasBounds,
  target: CanvasBounds,
  handle: CanvasResizeHandle,
): ReadonlyArray<CanvasResizeSnapCandidate> {
  const size = axis === 'x' ? bounds.width : bounds.height
  const leading = isLeadingResizeHandle(handle, axis)
  const active = bounds[axis] + (leading ? 0 : size)
  const anchor = bounds[axis] + (leading ? size : 0)
  const center = bounds[axis] + size / 2
  const targetSize = axis === 'x' ? target.width : target.height
  const targetValues = [target[axis], target[axis] + targetSize / 2, target[axis] + targetSize]
  const draggedStart = axis === 'x' ? bounds.y : bounds.x
  const draggedEnd = draggedStart + (axis === 'x' ? bounds.height : bounds.width)
  const targetStart = axis === 'x' ? target.y : target.x
  const targetEnd = targetStart + (axis === 'x' ? target.height : target.width)
  return targetValues.flatMap((targetValue) => [
    {
      axis,
      point: targetValue,
      center: false,
      dragged: active,
      target: targetValue,
      draggedStart,
      draggedEnd,
      targetStart,
      targetEnd,
    },
    {
      axis,
      point: 2 * targetValue - anchor,
      center: true,
      dragged: center,
      target: targetValue,
      draggedStart,
      draggedEnd,
      targetStart,
      targetEnd,
    },
  ])
}

function resizeCandidatePreserved(
  bounds: CanvasBounds,
  handle: CanvasResizeHandle,
  candidate: CanvasResizeSnapCandidate,
): boolean {
  const size = candidate.axis === 'x' ? bounds.width : bounds.height
  const value = candidate.center
    ? bounds[candidate.axis] + size / 2
    : bounds[candidate.axis] + (isLeadingResizeHandle(handle, candidate.axis) ? 0 : size)
  return value === candidate.target
}

function affectsResizeAxis(handle: CanvasResizeHandle, axis: 'x' | 'y'): boolean {
  return axis === 'x'
    ? handle !== 'top' && handle !== 'bottom'
    : handle !== 'left' && handle !== 'right'
}

function isLeadingResizeHandle(handle: CanvasResizeHandle, axis: 'x' | 'y'): boolean {
  return axis === 'x' ? handle.includes('left') : handle.includes('top')
}
