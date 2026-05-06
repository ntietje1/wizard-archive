export type CanvasResizeBounds = {
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

export type CanvasSideResizeHandlePosition = 'top' | 'right' | 'bottom' | 'left'
export type CanvasCornerResizeHandlePosition = Exclude<
  CanvasResizeHandlePosition,
  CanvasSideResizeHandlePosition
>

export type ResizeAxis = 'x' | 'y'

export function getHandleDirection(handlePosition: CanvasResizeHandlePosition) {
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

export function getOppositeCorner(
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

export function getResizeHandlePoint(
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

export function getResizeAxisAnchorPoint(
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

export function isCornerResizeHandle(
  handlePosition: CanvasResizeHandlePosition,
): handlePosition is CanvasCornerResizeHandlePosition {
  return (
    handlePosition === 'top-left' ||
    handlePosition === 'top-right' ||
    handlePosition === 'bottom-left' ||
    handlePosition === 'bottom-right'
  )
}

export function isSideResizeHandle(
  handlePosition: CanvasResizeHandlePosition,
): handlePosition is CanvasSideResizeHandlePosition {
  return !isCornerResizeHandle(handlePosition)
}

export function affectsCanvasResizeAxis(
  handlePosition: CanvasResizeHandlePosition,
  axis: ResizeAxis,
) {
  if (axis === 'x') {
    return handlePosition !== 'top' && handlePosition !== 'bottom'
  }

  return handlePosition !== 'left' && handlePosition !== 'right'
}

export function isLeadingResizeHandle(
  handlePosition: CanvasResizeHandlePosition,
  axis: ResizeAxis,
) {
  if (axis === 'x') {
    return (
      handlePosition === 'left' || handlePosition === 'top-left' || handlePosition === 'bottom-left'
    )
  }

  return handlePosition === 'top' || handlePosition === 'top-left' || handlePosition === 'top-right'
}
