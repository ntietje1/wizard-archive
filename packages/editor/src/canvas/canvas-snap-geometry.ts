import { canvasBoundsUnion, canvasNodeBounds } from './canvas-bounds'
import type { CanvasBounds } from './canvas-bounds'
import type { CanvasDocumentNode } from './document-contract'
import type { CanvasPoint } from './interaction-types'
import type { CanvasNodeId } from '../resources/domain-id'

const CANVAS_SNAP_THRESHOLD_PX = 8

export type CanvasSnapGuide = Readonly<{
  orientation: 'horizontal' | 'vertical'
  position: number
  start: number
  end: number
}>

type CanvasSnapAxisEntry = Readonly<{
  coordinate: number
  index: number
}>

export function createCanvasSnapTargetIndex(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  excludedNodeIds: ReadonlySet<CanvasNodeId>,
) {
  const bounds = nodes.flatMap((node) =>
    node.hidden || node.type === 'stroke' || excludedNodeIds.has(node.id)
      ? []
      : [canvasNodeBounds(node)],
  )
  const x = snapAxisEntries(bounds, 'x')
  const y = snapAxisEntries(bounds, 'y')
  return {
    near(queryBounds: CanvasBounds, threshold: number): ReadonlyArray<CanvasBounds> {
      const indexes = new Set<number>()
      for (const [axis, entries] of [
        ['x', x],
        ['y', y],
      ] as const) {
        const size = axis === 'x' ? queryBounds.width : queryBounds.height
        for (const coordinate of [
          queryBounds[axis],
          queryBounds[axis] + size / 2,
          queryBounds[axis] + size,
        ]) {
          let index = lowerBoundAxis(entries, coordinate - threshold)
          while (entries[index] && entries[index]!.coordinate <= coordinate + threshold) {
            indexes.add(entries[index]!.index)
            index += 1
          }
        }
      }
      return Array.from(indexes)
        .sort((left, right) => left - right)
        .map((index) => bounds[index]!)
    },
  }
}

function snapAxisEntries(
  bounds: ReadonlyArray<CanvasBounds>,
  axis: 'x' | 'y',
): ReadonlyArray<CanvasSnapAxisEntry> {
  const size = axis === 'x' ? 'width' : 'height'
  const entries = new Map<number, number>()
  bounds.forEach((candidate, index) => {
    for (const coordinate of [
      candidate[axis],
      candidate[axis] + candidate[size] / 2,
      candidate[axis] + candidate[size],
    ]) {
      if (!entries.has(coordinate)) entries.set(coordinate, index)
    }
  })
  return Array.from(entries, ([coordinate, index]) => ({ coordinate, index })).sort(
    (left, right) => left.coordinate - right.coordinate || left.index - right.index,
  )
}

function lowerBoundAxis(entries: ReadonlyArray<CanvasSnapAxisEntry>, coordinate: number): number {
  let low = 0
  let high = entries.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (entries[middle]!.coordinate < coordinate) low = middle + 1
    else high = middle
  }
  return low
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
  const dragged = canvasBoundsUnion(translated)!
  const threshold = canvasSnapThreshold(zoom)
  const vertical = bestSnapCandidate(
    snapCandidatesForTargets('x', dragged, targetBounds),
    threshold,
  )
  const horizontal = bestSnapCandidate(
    snapCandidatesForTargets('y', dragged, targetBounds),
    threshold,
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
  candidates: Iterable<TCandidate>,
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

function* snapCandidatesForTargets(
  axis: 'x' | 'y',
  dragged: CanvasBounds,
  targets: ReadonlyArray<CanvasBounds>,
): Generator<CanvasSnapCandidate> {
  for (const target of targets) yield* snapCandidates(axis, dragged, target)
}

function* snapCandidates(
  axis: 'x' | 'y',
  dragged: CanvasBounds,
  target: CanvasBounds,
): Generator<CanvasSnapCandidate> {
  const draggedValues = boundsAxisValues(dragged, axis)
  const targetValues = boundsAxisValues(target, axis)
  const draggedStart = axis === 'x' ? dragged.y : dragged.x
  const draggedEnd = draggedStart + (axis === 'x' ? dragged.height : dragged.width)
  const targetStart = axis === 'x' ? target.y : target.x
  const targetEnd = targetStart + (axis === 'x' ? target.height : target.width)
  for (const draggedValue of draggedValues) {
    for (const targetValue of targetValues) {
      yield {
        dragged: draggedValue,
        target: targetValue,
        draggedStart,
        draggedEnd,
        targetStart,
        targetEnd,
      }
    }
  }
}

function boundsAxisValues(
  bounds: CanvasBounds,
  axis: 'x' | 'y',
): readonly [number, number, number] {
  const start = bounds[axis]
  const size = axis === 'x' ? bounds.width : bounds.height
  return [start, start + size / 2, start + size]
}
