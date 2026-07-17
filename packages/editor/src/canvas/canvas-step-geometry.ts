import type { CanvasBounds } from './canvas-bounds'
import type { CanvasConnectionHandle, CanvasPoint } from './interaction-types'

const STEP_STUB_LENGTH = 48
const POINT_EPSILON = 1e-6

type StepRoute = Readonly<{
  source: CanvasPoint
  target: CanvasPoint
  sourceHandle: CanvasConnectionHandle
  targetHandle: CanvasConnectionHandle
  sourceStub: CanvasPoint
  targetStub: CanvasPoint
  splitX?: number
  splitY?: number
  relaxSplitX: boolean
  relaxSplitY: boolean
}>

export function canvasStepPoints(
  source: CanvasPoint,
  target: CanvasPoint,
  sourceHandle: CanvasConnectionHandle,
  targetHandle: CanvasConnectionHandle,
  bounds?: Readonly<{ source: CanvasBounds; target: CanvasBounds }>,
): ReadonlyArray<CanvasPoint> {
  const sourceStub = stepStub(source, sourceHandle)
  const targetStub = stepStub(target, targetHandle)
  const sourceHorizontal = isHorizontal(sourceHandle)
  const targetHorizontal = isHorizontal(targetHandle)
  const route: StepRoute = {
    source,
    target,
    sourceHandle,
    targetHandle,
    sourceStub,
    targetStub,
    ...stepSplit(bounds),
  }

  if (sourceHorizontal && targetHorizontal) return horizontalStepPoints(route)
  if (!sourceHorizontal && !targetHorizontal) return verticalStepPoints(route)
  return mixedStepPoints(route, sourceHorizontal)
}

function stepSplit(
  bounds: Readonly<{ source: CanvasBounds; target: CanvasBounds }> | undefined,
): Pick<StepRoute, 'relaxSplitX' | 'relaxSplitY' | 'splitX' | 'splitY'> {
  const splitX = bounds ? closestHorizontalEdgeMidpoint(bounds.source, bounds.target) : undefined
  const splitY = bounds ? closestVerticalEdgeMidpoint(bounds.source, bounds.target) : undefined
  if (!bounds) {
    return { splitX, splitY, relaxSplitX: false, relaxSplitY: false }
  }
  return {
    splitX,
    splitY,
    relaxSplitX:
      coordinateWithinBounds(splitX, bounds.source.x, bounds.source.width) ||
      coordinateWithinBounds(splitX, bounds.target.x, bounds.target.width),
    relaxSplitY:
      coordinateWithinBounds(splitY, bounds.source.y, bounds.source.height) ||
      coordinateWithinBounds(splitY, bounds.target.y, bounds.target.height),
  }
}

function horizontalStepPoints(route: StepRoute): ReadonlyArray<CanvasPoint> {
  if (
    horizontalHandlesFace(
      route.sourceHandle,
      route.targetHandle,
      route.sourceStub.x,
      route.targetStub.x,
    )
  ) {
    const x = (route.sourceStub.x + route.targetStub.x) / 2
    return compactPoints([
      route.source,
      route.sourceStub,
      { x, y: route.sourceStub.y },
      { x, y: route.targetStub.y },
      route.targetStub,
      route.target,
    ])
  }
  if (route.relaxSplitY) {
    return relaxedHorizontalPoints(
      route.source,
      route.target,
      route.sourceHandle,
      route.targetHandle,
    )
  }
  const y = route.splitY ?? (route.source.y + route.target.y) / 2
  return compactPoints([
    route.source,
    route.sourceStub,
    { x: route.sourceStub.x, y },
    { x: route.targetStub.x, y },
    route.targetStub,
    route.target,
  ])
}

function verticalStepPoints(route: StepRoute): ReadonlyArray<CanvasPoint> {
  if (
    verticalHandlesFace(
      route.sourceHandle,
      route.targetHandle,
      route.sourceStub.y,
      route.targetStub.y,
    )
  ) {
    const y = (route.sourceStub.y + route.targetStub.y) / 2
    return compactPoints([
      route.source,
      route.sourceStub,
      { x: route.sourceStub.x, y },
      { x: route.targetStub.x, y },
      route.targetStub,
      route.target,
    ])
  }
  if (route.relaxSplitX) {
    return relaxedVerticalPoints(route.source, route.target, route.sourceHandle, route.targetHandle)
  }
  const x = route.splitX ?? (route.source.x + route.target.x) / 2
  return compactPoints([
    route.source,
    route.sourceStub,
    { x, y: route.sourceStub.y },
    { x, y: route.targetStub.y },
    route.targetStub,
    route.target,
  ])
}

function mixedStepPoints(route: StepRoute, sourceHorizontal: boolean): ReadonlyArray<CanvasPoint> {
  return compactPoints(
    sourceHorizontal
      ? [
          route.source,
          route.sourceStub,
          { x: route.sourceStub.x, y: route.targetStub.y },
          route.targetStub,
          route.target,
        ]
      : [
          route.source,
          route.sourceStub,
          { x: route.targetStub.x, y: route.sourceStub.y },
          route.targetStub,
          route.target,
        ],
  )
}

function relaxedHorizontalPoints(
  source: CanvasPoint,
  target: CanvasPoint,
  sourceHandle: CanvasConnectionHandle,
  targetHandle: CanvasConnectionHandle,
): ReadonlyArray<CanvasPoint> {
  if (
    (sourceHandle === 'right' && targetHandle === 'left') ||
    (sourceHandle === 'left' && targetHandle === 'right')
  ) {
    const x = (source.x + target.x) / 2
    return compactPoints([source, { x, y: source.y }, { x, y: target.y }, target])
  }
  const x =
    sourceHandle === 'right' || targetHandle === 'right'
      ? Math.max(source.x, target.x)
      : Math.min(source.x, target.x)
  return compactPoints([source, { x, y: source.y }, { x, y: target.y }, target])
}

function relaxedVerticalPoints(
  source: CanvasPoint,
  target: CanvasPoint,
  sourceHandle: CanvasConnectionHandle,
  targetHandle: CanvasConnectionHandle,
): ReadonlyArray<CanvasPoint> {
  if (
    (sourceHandle === 'bottom' && targetHandle === 'top') ||
    (sourceHandle === 'top' && targetHandle === 'bottom')
  ) {
    const y = (source.y + target.y) / 2
    return compactPoints([source, { x: source.x, y }, { x: target.x, y }, target])
  }
  const y =
    sourceHandle === 'bottom' || targetHandle === 'bottom'
      ? Math.max(source.y, target.y)
      : Math.min(source.y, target.y)
  return compactPoints([source, { x: source.x, y }, { x: target.x, y }, target])
}

function stepStub(point: CanvasPoint, handle: CanvasConnectionHandle): CanvasPoint {
  switch (handle) {
    case 'top':
      return { x: point.x, y: point.y - STEP_STUB_LENGTH }
    case 'right':
      return { x: point.x + STEP_STUB_LENGTH, y: point.y }
    case 'bottom':
      return { x: point.x, y: point.y + STEP_STUB_LENGTH }
    case 'left':
      return { x: point.x - STEP_STUB_LENGTH, y: point.y }
  }
}

function isHorizontal(handle: CanvasConnectionHandle): boolean {
  return handle === 'left' || handle === 'right'
}

function horizontalHandlesFace(
  source: CanvasConnectionHandle,
  target: CanvasConnectionHandle,
  sourceStubX: number,
  targetStubX: number,
): boolean {
  return (
    (source === 'right' && target === 'left' && sourceStubX <= targetStubX) ||
    (source === 'left' && target === 'right' && sourceStubX >= targetStubX)
  )
}

function verticalHandlesFace(
  source: CanvasConnectionHandle,
  target: CanvasConnectionHandle,
  sourceStubY: number,
  targetStubY: number,
): boolean {
  return (
    (source === 'bottom' && target === 'top' && sourceStubY <= targetStubY) ||
    (source === 'top' && target === 'bottom' && sourceStubY >= targetStubY)
  )
}

function closestHorizontalEdgeMidpoint(source: CanvasBounds, target: CanvasBounds): number {
  const sourceCenter = source.x + source.width / 2
  const targetCenter = target.x + target.width / 2
  return sourceCenter <= targetCenter
    ? (source.x + source.width + target.x) / 2
    : (target.x + target.width + source.x) / 2
}

function closestVerticalEdgeMidpoint(source: CanvasBounds, target: CanvasBounds): number {
  const sourceCenter = source.y + source.height / 2
  const targetCenter = target.y + target.height / 2
  return sourceCenter <= targetCenter
    ? (source.y + source.height + target.y) / 2
    : (target.y + target.height + source.y) / 2
}

function coordinateWithinBounds(value: number | undefined, start: number, size: number): boolean {
  return value !== undefined && value > start && value < start + size
}

function compactPoints(points: ReadonlyArray<CanvasPoint>): ReadonlyArray<CanvasPoint> {
  return points.filter((point, index) => {
    if (index === 0) return true
    const previous = points[index - 1]
    return (
      Math.abs(previous.x - point.x) > POINT_EPSILON ||
      Math.abs(previous.y - point.y) > POINT_EPSILON
    )
  })
}
