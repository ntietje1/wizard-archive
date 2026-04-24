import type { Bounds } from '../../utils/canvas-geometry-utils'

const SNAP_THRESHOLD_SCREEN_PX = 8

export interface CanvasDragGuide {
  orientation: 'vertical' | 'horizontal'
  position: number
  start: number
  end: number
}

interface SnapTargetCandidate {
  draggedValue: number
  targetValue: number
  draggedStart: number
  draggedEnd: number
  targetStart: number
  targetEnd: number
}

export interface CanvasDragSnapResult {
  xAdjustment: number
  yAdjustment: number
  guides: Array<CanvasDragGuide>
}

export function getSnapThresholdForZoom(zoom: number) {
  return SNAP_THRESHOLD_SCREEN_PX / zoom
}

function getBoundsCenter(bounds: Bounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}

export function withBoundsPosition(bounds: Bounds, position: { x: number; y: number }): Bounds {
  return {
    x: position.x,
    y: position.y,
    width: bounds.width,
    height: bounds.height,
  }
}

export function resolveCanvasDragSnap({
  draggedBounds,
  targetBounds,
  threshold,
}: {
  draggedBounds: Array<Bounds>
  targetBounds: Array<Bounds>
  threshold: number
}): CanvasDragSnapResult {
  const xCandidates = draggedBounds.flatMap((dragged) =>
    targetBounds.flatMap((target) => collectVerticalCandidates(dragged, target)),
  )
  const yCandidates = draggedBounds.flatMap((dragged) =>
    targetBounds.flatMap((target) => collectHorizontalCandidates(dragged, target)),
  )

  const bestVertical = getBestSnapCandidate(xCandidates, threshold)
  const bestHorizontal = getBestSnapCandidate(yCandidates, threshold)

  const guides = [
    bestVertical
      ? {
          orientation: 'vertical' as const,
          position: bestVertical.targetValue,
          start: Math.min(bestVertical.draggedStart, bestVertical.targetStart),
          end: Math.max(bestVertical.draggedEnd, bestVertical.targetEnd),
        }
      : null,
    bestHorizontal
      ? {
          orientation: 'horizontal' as const,
          position: bestHorizontal.targetValue,
          start: Math.min(bestHorizontal.draggedStart, bestHorizontal.targetStart),
          end: Math.max(bestHorizontal.draggedEnd, bestHorizontal.targetEnd),
        }
      : null,
  ].filter((guide) => guide !== null)

  return {
    xAdjustment: bestVertical ? bestVertical.targetValue - bestVertical.draggedValue : 0,
    yAdjustment: bestHorizontal ? bestHorizontal.targetValue - bestHorizontal.draggedValue : 0,
    guides,
  }
}

function collectVerticalCandidates(dragged: Bounds, target: Bounds): Array<SnapTargetCandidate> {
  const draggedCenter = getBoundsCenter(dragged)
  const targetCenter = getBoundsCenter(target)
  const draggedValues = [dragged.x, draggedCenter.x, dragged.x + dragged.width]
  const targetValues = [target.x, targetCenter.x, target.x + target.width]

  return draggedValues.flatMap((draggedValue) =>
    targetValues.map((targetValue) => ({
      draggedValue,
      targetValue,
      draggedStart: dragged.y,
      draggedEnd: dragged.y + dragged.height,
      targetStart: target.y,
      targetEnd: target.y + target.height,
    })),
  )
}

function collectHorizontalCandidates(dragged: Bounds, target: Bounds): Array<SnapTargetCandidate> {
  const draggedCenter = getBoundsCenter(dragged)
  const targetCenter = getBoundsCenter(target)
  const draggedValues = [dragged.y, draggedCenter.y, dragged.y + dragged.height]
  const targetValues = [target.y, targetCenter.y, target.y + target.height]

  return draggedValues.flatMap((draggedValue) =>
    targetValues.map((targetValue) => ({
      draggedValue,
      targetValue,
      draggedStart: dragged.x,
      draggedEnd: dragged.x + dragged.width,
      targetStart: target.x,
      targetEnd: target.x + target.width,
    })),
  )
}

function getBestSnapCandidate(
  candidates: Array<SnapTargetCandidate>,
  threshold: number,
): SnapTargetCandidate | null {
  let best: SnapTargetCandidate | null = null
  let bestDistance = threshold + 1

  for (const candidate of candidates) {
    const distance = Math.abs(candidate.targetValue - candidate.draggedValue)
    if (distance > threshold || distance >= bestDistance) {
      continue
    }

    best = candidate
    bestDistance = distance
  }

  return best
}
