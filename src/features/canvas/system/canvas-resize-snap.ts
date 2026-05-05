import { resolveResizeBounds } from './canvas-resize-bounds'
import {
  affectsCanvasResizeAxis,
  getResizeAxisAnchorPoint,
  getResizeHandlePoint,
  isCornerResizeHandle,
  isLeadingResizeHandle,
} from './canvas-resize-handles'
import type { CanvasDragGuide } from '../utils/canvas-snap-guides'
import type {
  CanvasResizeBounds,
  CanvasResizeHandlePosition,
  ResizeAxis,
} from './canvas-resize-handles'

export function resolveResizeSnap({
  bounds,
  currentPoint,
  handlePosition,
  targetBounds,
  threshold,
  minWidth,
  minHeight,
  lockedAspectRatio,
  square,
}: {
  bounds: CanvasResizeBounds
  currentPoint: { x: number; y: number }
  handlePosition: CanvasResizeHandlePosition
  targetBounds: ReadonlyArray<CanvasResizeBounds>
  threshold: number
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
}): { bounds: CanvasResizeBounds; guides: ReadonlyArray<CanvasDragGuide> } | null {
  if (!lockedAspectRatio && (!isCornerResizeHandle(handlePosition) || !square)) {
    return resolveFreeformResizeSnap({
      bounds,
      handlePosition,
      targetBounds,
      threshold,
      minWidth,
      minHeight,
    })
  }

  return resolveConstrainedResizeSnap({
    bounds,
    currentPoint,
    handlePosition,
    targetBounds,
    threshold,
    minWidth,
    minHeight,
    lockedAspectRatio,
    square,
  })
}

function resolveFreeformResizeSnap({
  bounds,
  handlePosition,
  targetBounds,
  threshold,
  minWidth,
  minHeight,
}: {
  bounds: CanvasResizeBounds
  handlePosition: CanvasResizeHandlePosition
  targetBounds: ReadonlyArray<CanvasResizeBounds>
  threshold: number
  minWidth: number
  minHeight: number
}): { bounds: CanvasResizeBounds; guides: ReadonlyArray<CanvasDragGuide> } | null {
  const currentPoint = getResizeHandlePoint(bounds, handlePosition)
  const xSnap = affectsCanvasResizeAxis(handlePosition, 'x')
    ? getBestResizeAxisSnap({
        axis: 'x',
        bounds,
        handlePosition,
        targetBounds,
        threshold,
      })
    : null
  const ySnap = affectsCanvasResizeAxis(handlePosition, 'y')
    ? getBestResizeAxisSnap({
        axis: 'y',
        bounds,
        handlePosition,
        targetBounds,
        threshold,
      })
    : null

  if (!xSnap && !ySnap) {
    return null
  }

  const snappedBounds = resolveResizeBounds({
    handlePosition,
    startBounds: bounds,
    currentPoint: {
      x: xSnap?.point ?? currentPoint.x,
      y: ySnap?.point ?? currentPoint.y,
    },
    minWidth,
    minHeight,
    square: false,
  })

  return {
    bounds: snappedBounds,
    guides: [xSnap?.guide ?? null, ySnap?.guide ?? null].filter(
      (guide): guide is CanvasDragGuide => guide !== null,
    ),
  }
}

function resolveConstrainedResizeSnap({
  bounds,
  currentPoint,
  handlePosition,
  targetBounds,
  threshold,
  minWidth,
  minHeight,
  lockedAspectRatio,
  square,
}: {
  bounds: CanvasResizeBounds
  currentPoint: { x: number; y: number }
  handlePosition: CanvasResizeHandlePosition
  targetBounds: ReadonlyArray<CanvasResizeBounds>
  threshold: number
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
}): { bounds: CanvasResizeBounds; guides: ReadonlyArray<CanvasDragGuide> } | null {
  const candidates = targetBounds.flatMap((targetBoundsItem) => [
    ...collectResizeAxisCandidates({
      axis: 'x',
      bounds,
      targetBounds: targetBoundsItem,
      handlePosition,
    }),
    ...collectResizeAxisCandidates({
      axis: 'y',
      bounds,
      targetBounds: targetBoundsItem,
      handlePosition,
    }),
  ])
  const bestCandidate = getBestResizeSnapCandidate(candidates, threshold)

  if (!bestCandidate) {
    return null
  }

  const snappedBounds = resolveResizeBounds({
    handlePosition,
    startBounds: bounds,
    currentPoint: {
      x: bestCandidate.axis === 'x' ? bestCandidate.point : currentPoint.x,
      y: bestCandidate.axis === 'y' ? bestCandidate.point : currentPoint.y,
    },
    minWidth,
    minHeight,
    lockedAspectRatio,
    square,
    preferredAxis: bestCandidate.axis,
  })

  return {
    bounds: snappedBounds,
    guides: [createResizeAxisGuide(bestCandidate)],
  }
}

function getBestResizeAxisSnap({
  axis,
  bounds,
  handlePosition,
  targetBounds,
  threshold,
}: {
  axis: 'x' | 'y'
  bounds: CanvasResizeBounds
  handlePosition: CanvasResizeHandlePosition
  targetBounds: ReadonlyArray<CanvasResizeBounds>
  threshold: number
}): { point: number; guide: CanvasDragGuide } | null {
  const candidates = targetBounds.flatMap((targetBoundsItem) =>
    collectResizeAxisCandidates({
      axis,
      bounds,
      targetBounds: targetBoundsItem,
      handlePosition,
    }),
  )
  const bestCandidate = getBestResizeSnapCandidate(candidates, threshold)

  if (!bestCandidate) {
    return null
  }

  return {
    point: bestCandidate.point,
    guide: createResizeAxisGuide(bestCandidate),
  }
}

function getBestResizeSnapCandidate<TCandidate extends ResizeAxisSnapCandidate>(
  candidates: ReadonlyArray<TCandidate>,
  threshold: number,
): TCandidate | null {
  let bestCandidate: TCandidate | null = null
  let bestDistance = threshold + 1

  for (const candidate of candidates) {
    const distance = Math.abs(candidate.targetValue - candidate.draggedValue)
    if (distance > threshold || distance >= bestDistance) {
      continue
    }

    bestCandidate = candidate
    bestDistance = distance
  }

  return bestCandidate
}

function createResizeAxisGuide(candidate: ResizeAxisSnapCandidate): CanvasDragGuide {
  return {
    orientation: candidate.axis === 'x' ? 'vertical' : 'horizontal',
    position: candidate.targetValue,
    start: Math.min(candidate.draggedStart, candidate.targetStart),
    end: Math.max(candidate.draggedEnd, candidate.targetEnd),
  }
}

type ResizeAxisSnapCandidate = {
  axis: ResizeAxis
  draggedValue: number
  targetValue: number
  point: number
  draggedStart: number
  draggedEnd: number
  targetStart: number
  targetEnd: number
}

function collectResizeAxisCandidates({
  axis,
  bounds,
  targetBounds,
  handlePosition,
}: {
  axis: 'x' | 'y'
  bounds: CanvasResizeBounds
  targetBounds: CanvasResizeBounds
  handlePosition: CanvasResizeHandlePosition
}): Array<ResizeAxisSnapCandidate> {
  if (!affectsCanvasResizeAxis(handlePosition, axis)) {
    return []
  }

  const createSnapCandidate = ({
    axis: candidateAxis,
    bounds: candidateBounds,
    targetBounds: candidateTargetBounds,
    draggedValue,
    targetValue,
    point,
  }: {
    axis: 'x' | 'y'
    bounds: CanvasResizeBounds
    targetBounds: CanvasResizeBounds
    draggedValue: number
    targetValue: number
    point: number
  }): ResizeAxisSnapCandidate => ({
    axis: candidateAxis,
    draggedValue,
    targetValue,
    point,
    draggedStart: candidateAxis === 'x' ? candidateBounds.y : candidateBounds.x,
    draggedEnd:
      candidateAxis === 'x'
        ? candidateBounds.y + candidateBounds.height
        : candidateBounds.x + candidateBounds.width,
    targetStart: candidateAxis === 'x' ? candidateTargetBounds.y : candidateTargetBounds.x,
    targetEnd:
      candidateAxis === 'x'
        ? candidateTargetBounds.y + candidateTargetBounds.height
        : candidateTargetBounds.x + candidateTargetBounds.width,
  })

  const anchor = getResizeAxisAnchorPoint(bounds, handlePosition)
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2

  if (axis === 'x') {
    const targetValues = [
      targetBounds.x,
      targetBounds.x + targetBounds.width / 2,
      targetBounds.x + targetBounds.width,
    ]

    if (isLeadingResizeHandle(handlePosition, 'x')) {
      return targetValues.flatMap((targetValue) => [
        createSnapCandidate({
          axis,
          bounds,
          targetBounds,
          draggedValue: bounds.x,
          targetValue,
          point: targetValue,
        }),
        createSnapCandidate({
          axis,
          bounds,
          targetBounds,
          draggedValue: centerX,
          targetValue,
          point: 2 * targetValue - anchor.x,
        }),
      ])
    }

    return targetValues.flatMap((targetValue) => [
      createSnapCandidate({
        axis,
        bounds,
        targetBounds,
        draggedValue: bounds.x + bounds.width,
        targetValue,
        point: targetValue,
      }),
      createSnapCandidate({
        axis,
        bounds,
        targetBounds,
        draggedValue: centerX,
        targetValue,
        point: 2 * targetValue - anchor.x,
      }),
    ])
  }

  const targetValues = [
    targetBounds.y,
    targetBounds.y + targetBounds.height / 2,
    targetBounds.y + targetBounds.height,
  ]

  if (isLeadingResizeHandle(handlePosition, 'y')) {
    return targetValues.flatMap((targetValue) => [
      createSnapCandidate({
        axis,
        bounds,
        targetBounds,
        draggedValue: bounds.y,
        targetValue,
        point: targetValue,
      }),
      createSnapCandidate({
        axis,
        bounds,
        targetBounds,
        draggedValue: centerY,
        targetValue,
        point: 2 * targetValue - anchor.y,
      }),
    ])
  }

  return targetValues.flatMap((targetValue) => [
    createSnapCandidate({
      axis,
      bounds,
      targetBounds,
      draggedValue: bounds.y + bounds.height,
      targetValue,
      point: targetValue,
    }),
    createSnapCandidate({
      axis,
      bounds,
      targetBounds,
      draggedValue: centerY,
      targetValue,
      point: 2 * targetValue - anchor.y,
    }),
  ])
}
