import { canvasNodeBounds } from './canvas-bounds'
import type { CanvasBounds } from './canvas-bounds'
import type { CanvasDocumentNode } from './document-contract'
import type { CanvasPoint } from './interaction-controller'
import type { CanvasNodeId } from '../resources/domain-id'

const CANVAS_SNAP_THRESHOLD_PX = 8

export type CanvasSnapGuide = Readonly<{
  orientation: 'horizontal' | 'vertical'
  position: number
  start: number
  end: number
}>

export function canvasSnapTargetBounds(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  excludedNodeIds: ReadonlySet<CanvasNodeId>,
): ReadonlyArray<CanvasBounds> {
  const bounds: Array<CanvasBounds> = []
  for (const node of nodes) {
    if (!node.hidden && node.type !== 'stroke' && !excludedNodeIds.has(node.id)) {
      bounds.push(canvasNodeBounds(node))
    }
  }
  return bounds
}

export function resolveCanvasDrag({
  delta,
  draggedBounds,
  targetBounds,
  constrain,
  snap,
  zoom,
}: {
  delta: CanvasPoint
  draggedBounds: ReadonlyArray<CanvasBounds>
  targetBounds: ReadonlyArray<CanvasBounds>
  constrain: boolean
  snap: boolean
  zoom: number
}): Readonly<{ delta: CanvasPoint; guides: ReadonlyArray<CanvasSnapGuide> }> {
  const constrained = constrainCanvasDrag(delta, constrain)
  if (!snap || constrain || draggedBounds.length === 0 || targetBounds.length === 0) {
    return { delta: constrained, guides: [] }
  }
  const translated = draggedBounds.map((bounds) => ({
    ...bounds,
    x: bounds.x + constrained.x,
    y: bounds.y + constrained.y,
  }))
  const vertical = bestSnapCandidate(
    translated.flatMap((dragged) =>
      targetBounds.flatMap((target) => snapCandidates('x', dragged, target)),
    ),
    canvasSnapThreshold(zoom),
  )
  const horizontal = bestSnapCandidate(
    translated.flatMap((dragged) =>
      targetBounds.flatMap((target) => snapCandidates('y', dragged, target)),
    ),
    canvasSnapThreshold(zoom),
  )
  return {
    delta: {
      x: constrained.x + (vertical ? vertical.target - vertical.dragged : 0),
      y: constrained.y + (horizontal ? horizontal.target - horizontal.dragged : 0),
    },
    guides: [
      vertical ? snapGuide('x', vertical) : null,
      horizontal ? snapGuide('y', horizontal) : null,
    ].filter((guide): guide is CanvasSnapGuide => guide !== null),
  }
}

export function canvasSnapThreshold(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError('Canvas snap zoom must be finite and positive')
  }
  return CANVAS_SNAP_THRESHOLD_PX / zoom
}

export type CanvasSnapCandidate = Readonly<{
  dragged: number
  target: number
  draggedStart: number
  draggedEnd: number
  targetStart: number
  targetEnd: number
}>

export function bestSnapCandidate<TCandidate extends CanvasSnapCandidate>(
  candidates: ReadonlyArray<TCandidate>,
  threshold: number,
): TCandidate | null {
  let best: TCandidate | null = null
  let bestDistance = threshold + 1
  for (const candidate of candidates) {
    const distance = Math.abs(candidate.target - candidate.dragged)
    if (distance <= threshold && distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

export function snapGuide(axis: 'x' | 'y', candidate: CanvasSnapCandidate): CanvasSnapGuide {
  return {
    orientation: axis === 'x' ? 'vertical' : 'horizontal',
    position: candidate.target,
    start: Math.min(candidate.draggedStart, candidate.targetStart),
    end: Math.max(candidate.draggedEnd, candidate.targetEnd),
  }
}

function constrainCanvasDrag(delta: CanvasPoint, constrain: boolean): CanvasPoint {
  if (!constrain) return delta
  return Math.abs(delta.x) >= Math.abs(delta.y) ? { x: delta.x, y: 0 } : { x: 0, y: delta.y }
}

function snapCandidates(
  axis: 'x' | 'y',
  dragged: CanvasBounds,
  target: CanvasBounds,
): ReadonlyArray<CanvasSnapCandidate> {
  const draggedValues = boundsAxisValues(dragged, axis)
  const targetValues = boundsAxisValues(target, axis)
  const draggedStart = axis === 'x' ? dragged.y : dragged.x
  const draggedEnd = draggedStart + (axis === 'x' ? dragged.height : dragged.width)
  const targetStart = axis === 'x' ? target.y : target.x
  const targetEnd = targetStart + (axis === 'x' ? target.height : target.width)
  return draggedValues.flatMap((draggedValue) =>
    targetValues.map((targetValue) => ({
      dragged: draggedValue,
      target: targetValue,
      draggedStart,
      draggedEnd,
      targetStart,
      targetEnd,
    })),
  )
}

function boundsAxisValues(
  bounds: CanvasBounds,
  axis: 'x' | 'y',
): readonly [number, number, number] {
  const start = bounds[axis]
  const size = axis === 'x' ? bounds.width : bounds.height
  return [start, start + size / 2, start + size]
}
