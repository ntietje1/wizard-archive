import { constrainPointToSquare } from '../utils/canvas-constraint-utils'
import { getHandleDirection, getOppositeCorner, isSideResizeHandle } from './canvas-resize-handles'
import type {
  CanvasResizeBounds,
  CanvasResizeHandlePosition,
  CanvasSideResizeHandlePosition,
  ResizeAxis,
} from './canvas-resize-handles'

export function resolveResizeBounds({
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
