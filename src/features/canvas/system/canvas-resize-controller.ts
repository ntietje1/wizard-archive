import { getSnapThresholdForZoom } from '../runtime/interaction/canvas-drag-snap-utils'
import { constrainPointToSquare } from '../utils/canvas-constraint-utils'
import type { CanvasDragGuide } from '../runtime/interaction/canvas-drag-snap-utils'

type CanvasResizeBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasResizeHandlePosition =
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'top-left'

type CanvasSideResizeHandlePosition = 'top' | 'right' | 'bottom' | 'left'
type CanvasCornerResizeHandlePosition = Exclude<
  CanvasResizeHandlePosition,
  CanvasSideResizeHandlePosition
>

type ResizeAxis = 'x' | 'y'

type ResizeSession = {
  pointerId: number
  handlePosition: CanvasResizeHandlePosition
  startBounds: CanvasResizeBounds
  currentPoint: { x: number; y: number } | null
  targetBounds: ReadonlyArray<CanvasResizeBounds>
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
  snap: boolean
  zoom: number
}

type CanvasResizeResult = {
  bounds: CanvasResizeBounds
  guides: ReadonlyArray<CanvasDragGuide>
  final: boolean
}

interface CanvasResizeController {
  start: (options: {
    pointerId: number
    handlePosition: CanvasResizeHandlePosition
    startBounds: CanvasResizeBounds
    targetBounds: ReadonlyArray<CanvasResizeBounds>
    minWidth: number
    minHeight: number
    lockedAspectRatio?: number
  }) => void
  update: (options: {
    pointerId: number
    currentPoint: { x: number; y: number }
    square: boolean
    snap: boolean
    zoom: number
  }) => CanvasResizeResult | null
  refreshModifiers: (options: {
    square: boolean
    snap: boolean
    zoom: number
  }) => CanvasResizeResult | null
  commit: (options: {
    pointerId: number
    currentPoint: { x: number; y: number }
    square: boolean
    snap: boolean
    zoom: number
  }) => CanvasResizeResult | null
  cancel: () => CanvasResizeResult | null
  dispose: () => void
}

export function createCanvasResizeController(): CanvasResizeController {
  let session: ResizeSession | null = null

  const resolveSession = (final: boolean): CanvasResizeResult | null => {
    if (!session?.currentPoint) {
      return null
    }

    const { bounds, guides } = resolveSessionResizeBounds({
      session,
      currentPoint: session.currentPoint,
      minWidth: session.minWidth,
      minHeight: session.minHeight,
      lockedAspectRatio: session.lockedAspectRatio,
      square: session.square,
      snap: session.snap,
      zoom: session.zoom,
    })

    return { bounds, guides, final }
  }

  const clearSession = () => {
    session = null
  }

  const cancelSession = () => {
    if (!session) {
      return null
    }

    const result = { bounds: session.startBounds, guides: [], final: false }
    clearSession()
    return result
  }

  return {
    start: (options) => {
      session = {
        ...options,
        currentPoint: null,
        square: false,
        snap: false,
        zoom: 1,
      }
    },
    update: ({ pointerId, currentPoint, square, snap, zoom }) => {
      if (!session || session.pointerId !== pointerId) {
        return null
      }

      session = { ...session, currentPoint, square, snap, zoom }
      return resolveSession(false)
    },
    // refreshModifiers handles keyboard-only changes; pointerId is validated by update and commit.
    refreshModifiers: ({ square, snap, zoom }) => {
      if (!session) {
        return null
      }

      session = { ...session, square, snap, zoom }
      return resolveSession(false)
    },
    commit: ({ pointerId, currentPoint, square, snap, zoom }) => {
      if (!session || session.pointerId !== pointerId) {
        return null
      }

      session = { ...session, currentPoint, square, snap, zoom }
      const result = resolveSession(true)
      clearSession()
      return result
    },
    cancel: cancelSession,
    dispose: clearSession,
  }
}

function resolveSessionResizeBounds({
  session,
  currentPoint,
  minWidth,
  minHeight,
  lockedAspectRatio,
  square,
  snap,
  zoom,
}: {
  session: ResizeSession
  currentPoint: { x: number; y: number }
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
  snap: boolean
  zoom: number
}): { bounds: CanvasResizeBounds; guides: ReadonlyArray<CanvasDragGuide> } {
  const bounds = resolveResizeBounds({
    handlePosition: session.handlePosition,
    startBounds: session.startBounds,
    currentPoint,
    minWidth,
    minHeight,
    lockedAspectRatio,
    square,
  })

  if (!snap || session.targetBounds.length === 0) {
    return { bounds, guides: [] }
  }

  const snapResult = resolveResizeSnap({
    bounds,
    currentPoint,
    handlePosition: session.handlePosition,
    targetBounds: session.targetBounds,
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

function resolveResizeBounds({
  handlePosition,
  startBounds,
  currentPoint,
  minWidth,
  minHeight,
  lockedAspectRatio,
  square,
  preferredAxis,
}: {
  handlePosition: CanvasResizeHandlePosition
  startBounds: CanvasResizeBounds
  currentPoint: { x: number; y: number }
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
  preferredAxis?: ResizeAxis
}): CanvasResizeBounds {
  if (isSideResizeHandle(handlePosition) && lockedAspectRatio) {
    return resolveAspectLockedSideResizeBounds({
      handlePosition,
      startBounds,
      currentPoint,
      minWidth,
      minHeight,
      lockedAspectRatio,
    })
  }

  if (isSideResizeHandle(handlePosition)) {
    return resolveOneAxisResizeBounds({
      handlePosition,
      startBounds,
      currentPoint,
      minWidth,
      minHeight,
    })
  }

  const anchor = getOppositeCorner(startBounds, handlePosition)
  if (lockedAspectRatio) {
    const signedPoint = applyLockedAspectRatioSize({
      anchor,
      point: currentPoint,
      handlePosition,
      minWidth,
      minHeight,
      lockedAspectRatio,
      preferredAxis,
    })

    return normalizeResizeBounds(anchor, signedPoint)
  }

  if (square) {
    const minimumSquareSize = Math.max(minWidth, minHeight)
    const signedPoint = resolveSquareResizePoint({
      anchor,
      point: currentPoint,
      handlePosition,
      minSize: minimumSquareSize,
      preferredAxis,
    })

    return normalizeResizeBounds(anchor, signedPoint)
  }

  const signedPoint = applyMinimumRectSize({
    anchor,
    point: currentPoint,
    handlePosition,
    minWidth,
    minHeight,
  })

  return normalizeResizeBounds(anchor, signedPoint)
}

function resolveAspectLockedSideResizeBounds({
  handlePosition,
  startBounds,
  currentPoint,
  minWidth,
  minHeight,
  lockedAspectRatio,
}: {
  handlePosition: CanvasSideResizeHandlePosition
  startBounds: CanvasResizeBounds
  currentPoint: { x: number; y: number }
  minWidth: number
  minHeight: number
  lockedAspectRatio: number
}): CanvasResizeBounds {
  const centerX = startBounds.x + startBounds.width / 2
  const centerY = startBounds.y + startBounds.height / 2
  const { minimumWidth, minimumHeight } = getMinimumLockedAspectRatioDimensions(
    minWidth,
    minHeight,
    lockedAspectRatio,
  )

  switch (handlePosition) {
    case 'left': {
      const right = startBounds.x + startBounds.width
      const width = Math.max(Math.abs(currentPoint.x - right), minimumWidth)
      const height = width / lockedAspectRatio
      return {
        x: right - width,
        y: centerY - height / 2,
        width,
        height,
      }
    }
    case 'right': {
      const width = Math.max(Math.abs(currentPoint.x - startBounds.x), minimumWidth)
      const height = width / lockedAspectRatio
      return {
        x: startBounds.x,
        y: centerY - height / 2,
        width,
        height,
      }
    }
    case 'top': {
      const bottom = startBounds.y + startBounds.height
      const height = Math.max(Math.abs(currentPoint.y - bottom), minimumHeight)
      const width = height * lockedAspectRatio
      return {
        x: centerX - width / 2,
        y: bottom - height,
        width,
        height,
      }
    }
    case 'bottom': {
      const height = Math.max(Math.abs(currentPoint.y - startBounds.y), minimumHeight)
      const width = height * lockedAspectRatio
      return {
        x: centerX - width / 2,
        y: startBounds.y,
        width,
        height,
      }
    }
  }
}

function resolveSquareResizePoint({
  anchor,
  point,
  handlePosition,
  minSize,
  preferredAxis,
}: {
  anchor: { x: number; y: number }
  point: { x: number; y: number }
  handlePosition: CanvasResizeHandlePosition
  minSize: number
  preferredAxis?: ResizeAxis
}) {
  if (preferredAxis === 'x' || preferredAxis === 'y') {
    const direction = getHandleDirection(handlePosition)
    const size = Math.max(
      Math.abs(
        (preferredAxis === 'x' ? point.x : point.y) - (preferredAxis === 'x' ? anchor.x : anchor.y),
      ),
      minSize,
    )

    return {
      x: anchor.x + direction.x * size,
      y: anchor.y + direction.y * size,
    }
  }

  const constrainedPoint = constrainPointToSquare(anchor, point)
  return applyMinimumSquareSize({
    anchor,
    point: constrainedPoint,
    handlePosition,
    minSize,
  })
}

function resolveOneAxisResizeBounds({
  handlePosition,
  startBounds,
  currentPoint,
  minWidth,
  minHeight,
}: {
  handlePosition: CanvasSideResizeHandlePosition
  startBounds: CanvasResizeBounds
  currentPoint: { x: number; y: number }
  minWidth: number
  minHeight: number
}): CanvasResizeBounds {
  switch (handlePosition) {
    case 'left': {
      const right = startBounds.x + startBounds.width
      const width = Math.max(Math.abs(currentPoint.x - right), minWidth)
      return {
        ...startBounds,
        x: right - width,
        width,
      }
    }
    case 'right': {
      const width = Math.max(Math.abs(currentPoint.x - startBounds.x), minWidth)
      return {
        ...startBounds,
        width,
      }
    }
    case 'top': {
      const bottom = startBounds.y + startBounds.height
      const height = Math.max(Math.abs(currentPoint.y - bottom), minHeight)
      return {
        ...startBounds,
        y: bottom - height,
        height,
      }
    }
    case 'bottom': {
      const height = Math.max(Math.abs(currentPoint.y - startBounds.y), minHeight)
      return {
        ...startBounds,
        height,
      }
    }
  }
}

function getMinimumLockedAspectRatioDimensions(
  minWidth: number,
  minHeight: number,
  lockedAspectRatio: number,
) {
  return {
    minimumWidth: Math.max(minWidth, minHeight * lockedAspectRatio),
    minimumHeight: Math.max(minHeight, minWidth / lockedAspectRatio),
  }
}

function applyLockedAspectRatioSize({
  anchor,
  point,
  handlePosition,
  minWidth,
  minHeight,
  lockedAspectRatio,
  preferredAxis,
}: {
  anchor: { x: number; y: number }
  point: { x: number; y: number }
  handlePosition: CanvasResizeHandlePosition
  minWidth: number
  minHeight: number
  lockedAspectRatio: number
  preferredAxis?: ResizeAxis
}) {
  const direction = getHandleDirection(handlePosition)
  const deltaX = Math.abs(point.x - anchor.x)
  const deltaY = Math.abs(point.y - anchor.y)
  const { minimumWidth, minimumHeight } = getMinimumLockedAspectRatioDimensions(
    minWidth,
    minHeight,
    lockedAspectRatio,
  )

  if (preferredAxis === 'x') {
    const width = Math.max(deltaX, minimumWidth)

    return {
      x: anchor.x + direction.x * width,
      y: anchor.y + direction.y * (width / lockedAspectRatio),
    }
  }

  if (preferredAxis === 'y') {
    const height = Math.max(deltaY, minimumHeight)

    return {
      x: anchor.x + direction.x * height * lockedAspectRatio,
      y: anchor.y + direction.y * height,
    }
  }

  const widthFromX = Math.max(deltaX, minimumWidth)
  const heightFromY = Math.max(deltaY, minimumHeight)
  const candidateFromX = {
    width: widthFromX,
    height: widthFromX / lockedAspectRatio,
  }
  const candidateFromY = { width: heightFromY * lockedAspectRatio, height: heightFromY }
  const chosenCandidate =
    getCandidateDistance(candidateFromX, deltaX, deltaY) <=
    getCandidateDistance(candidateFromY, deltaX, deltaY)
      ? candidateFromX
      : candidateFromY

  return {
    x: anchor.x + direction.x * chosenCandidate.width,
    y: anchor.y + direction.y * chosenCandidate.height,
  }
}

function getCandidateDistance(
  candidate: { width: number; height: number },
  targetWidth: number,
  targetHeight: number,
) {
  return Math.abs(candidate.width - targetWidth) + Math.abs(candidate.height - targetHeight)
}

function getOppositeCorner(
  bounds: CanvasResizeBounds,
  handlePosition: CanvasCornerResizeHandlePosition,
) {
  switch (handlePosition) {
    case 'top-left':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
    case 'top-right':
      return { x: bounds.x, y: bounds.y + bounds.height }
    case 'bottom-left':
      return { x: bounds.x + bounds.width, y: bounds.y }
    case 'bottom-right':
      return { x: bounds.x, y: bounds.y }
  }
}

function applyMinimumSquareSize({
  anchor,
  point,
  handlePosition,
  minSize,
}: {
  anchor: { x: number; y: number }
  point: { x: number; y: number }
  handlePosition: CanvasResizeHandlePosition
  minSize: number
}) {
  const direction = getHandleDirection(handlePosition)
  const width = Math.abs(point.x - anchor.x)
  const height = Math.abs(point.y - anchor.y)
  const size = Math.max(width, height, minSize)

  return {
    x: anchor.x + direction.x * size,
    y: anchor.y + direction.y * size,
  }
}

function applyMinimumRectSize({
  anchor,
  point,
  handlePosition,
  minWidth,
  minHeight,
}: {
  anchor: { x: number; y: number }
  point: { x: number; y: number }
  handlePosition: CanvasResizeHandlePosition
  minWidth: number
  minHeight: number
}) {
  const direction = getHandleDirection(handlePosition)
  const width = Math.max(Math.abs(point.x - anchor.x), minWidth)
  const height = Math.max(Math.abs(point.y - anchor.y), minHeight)

  return {
    x: anchor.x + direction.x * width,
    y: anchor.y + direction.y * height,
  }
}

function normalizeResizeBounds(anchor: { x: number; y: number }, point: { x: number; y: number }) {
  return {
    x: Math.min(anchor.x, point.x),
    y: Math.min(anchor.y, point.y),
    width: Math.abs(point.x - anchor.x),
    height: Math.abs(point.y - anchor.y),
  }
}

function getHandleDirection(handlePosition: CanvasResizeHandlePosition) {
  switch (handlePosition) {
    case 'top-left':
      return { x: -1, y: -1 }
    case 'top-right':
      return { x: 1, y: -1 }
    case 'bottom-left':
      return { x: -1, y: 1 }
    case 'bottom-right':
      return { x: 1, y: 1 }
    case 'top':
      return { x: 0, y: -1 }
    case 'right':
      return { x: 1, y: 0 }
    case 'bottom':
      return { x: 0, y: 1 }
    case 'left':
      return { x: -1, y: 0 }
  }
}

function resolveResizeSnap({
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
  const xSnap = affectsResizeAxis(handlePosition, 'x')
    ? getBestResizeAxisSnap({
        axis: 'x',
        bounds,
        handlePosition,
        targetBounds,
        threshold,
      })
    : null
  const ySnap = affectsResizeAxis(handlePosition, 'y')
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
    guides: [xSnap?.guide ?? null, ySnap?.guide ?? null].filter((guide) => guide !== null),
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

function getResizeHandlePoint(
  bounds: CanvasResizeBounds,
  handlePosition: CanvasResizeHandlePosition,
) {
  switch (handlePosition) {
    case 'top':
      return { x: bounds.x + bounds.width / 2, y: bounds.y }
    case 'top-left':
      return { x: bounds.x, y: bounds.y }
    case 'top-right':
      return { x: bounds.x + bounds.width, y: bounds.y }
    case 'right':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
    case 'bottom':
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }
    case 'bottom-left':
      return { x: bounds.x, y: bounds.y + bounds.height }
    case 'bottom-right':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
    case 'left':
      return { x: bounds.x, y: bounds.y + bounds.height / 2 }
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
}) {
  if (!affectsResizeAxis(handlePosition, axis)) {
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

function isCornerResizeHandle(
  handlePosition: CanvasResizeHandlePosition,
): handlePosition is CanvasCornerResizeHandlePosition {
  return (
    handlePosition === 'top-left' ||
    handlePosition === 'top-right' ||
    handlePosition === 'bottom-left' ||
    handlePosition === 'bottom-right'
  )
}

function isSideResizeHandle(
  handlePosition: CanvasResizeHandlePosition,
): handlePosition is CanvasSideResizeHandlePosition {
  return !isCornerResizeHandle(handlePosition)
}

function affectsResizeAxis(handlePosition: CanvasResizeHandlePosition, axis: ResizeAxis) {
  if (axis === 'x') {
    return handlePosition !== 'top' && handlePosition !== 'bottom'
  }

  return handlePosition !== 'left' && handlePosition !== 'right'
}

function isLeadingResizeHandle(handlePosition: CanvasResizeHandlePosition, axis: ResizeAxis) {
  if (axis === 'x') {
    return (
      handlePosition === 'left' || handlePosition === 'top-left' || handlePosition === 'bottom-left'
    )
  }

  return handlePosition === 'top' || handlePosition === 'top-left' || handlePosition === 'top-right'
}

function getResizeAxisAnchorPoint(
  bounds: CanvasResizeBounds,
  handlePosition: CanvasResizeHandlePosition,
) {
  switch (handlePosition) {
    case 'top':
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }
    case 'top-right':
      return { x: bounds.x, y: bounds.y + bounds.height }
    case 'right':
      return { x: bounds.x, y: bounds.y + bounds.height / 2 }
    case 'bottom-right':
      return { x: bounds.x, y: bounds.y }
    case 'bottom':
      return { x: bounds.x + bounds.width / 2, y: bounds.y }
    case 'bottom-left':
      return { x: bounds.x + bounds.width, y: bounds.y }
    case 'left':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
    case 'top-left':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
  }
}
