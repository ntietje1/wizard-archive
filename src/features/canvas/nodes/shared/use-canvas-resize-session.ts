import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { ControlPosition } from '@xyflow/react'
import { getCanvasNodeBounds } from './canvas-node-bounds'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import {
  clearCanvasDragSnapGuides,
  setCanvasDragSnapGuides,
} from '../../runtime/interaction/canvas-drag-snap-overlay'
import { getSnapThresholdForZoom } from '../../runtime/interaction/canvas-drag-snap-utils'
import { useCanvasModifierKeys } from '../../runtime/interaction/use-canvas-modifier-keys'
import { useIsCanvasNodeSelected } from '../../runtime/selection/use-canvas-selection-state'
import { constrainPointToSquare } from '../../utils/canvas-constraint-utils'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'
import { releasePointerCapture } from '../../tools/shared/tool-module-utils'
import type { CanvasNodeResizeHandleDescriptor } from './canvas-node-resize-handles'
import type { CSSProperties } from 'react'
import type { CanvasDragGuide } from '../../runtime/interaction/canvas-drag-snap-utils'

const HANDLE_SIZE = 4
const HANDLE_HIT_SIZE = 16
const SELECTION_BORDER_OUTSET_PX = 1
const RESIZE_HANDLE_OUTSET_PX = SELECTION_BORDER_OUTSET_PX

const CORNERS: Array<{
  position: ControlPosition
  cursorClassName: string
  style: CSSProperties
}> = [
  {
    position: 'top-left',
    cursorClassName: 'cursor-nwse-resize',
    style: {
      left: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
      top: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
    },
  },
  {
    position: 'top-right',
    cursorClassName: 'cursor-nesw-resize',
    style: {
      right: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
      top: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
    },
  },
  {
    position: 'bottom-left',
    cursorClassName: 'cursor-nesw-resize',
    style: {
      left: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
      bottom: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
    },
  },
  {
    position: 'bottom-right',
    cursorClassName: 'cursor-nwse-resize',
    style: {
      right: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
      bottom: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
    },
  },
]

type ResizeBounds = {
  x: number
  y: number
  width: number
  height: number
}

type CornerHandlePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type ResizeAxis = 'x' | 'y'

type ResizeSession = {
  pointerId: number
  target: Element | null
  handlePosition: CornerHandlePosition
  startBounds: ResizeBounds
  currentPoint: { x: number; y: number } | null
  targetBounds: Array<ResizeBounds>
}

export function useCanvasResizeSession({
  id,
  dragging,
  minWidth = 50,
  minHeight = 30,
  lockedAspectRatio,
}: {
  id: string
  dragging: boolean
  minWidth?: number
  minHeight?: number
  lockedAspectRatio?: number
}): ReadonlyArray<CanvasNodeResizeHandleDescriptor> {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const {
    canvasEngine,
    nodeActions: { onResize, onResizeEnd },
    viewportController,
  } = useCanvasRuntime()
  const internalNode = useRuntimeCanvasNode(canvasEngine, id)
  const { shiftPressed, primaryPressed } = useCanvasModifierKeys()
  const selected = useIsCanvasNodeSelected(id)
  const resizeSessionRef = useRef<ResizeSession | null>(null)
  const shiftPressedRef = useRef(shiftPressed)
  const primaryPressedRef = useRef(primaryPressed)
  const onResizeRef = useRef(onResize)
  const onResizeEndRef = useRef(onResizeEnd)
  const removeWindowListenersRef = useRef<() => void>(() => undefined)
  const idRef = useRef(id)
  const minWidthRef = useRef(minWidth)
  const minHeightRef = useRef(minHeight)
  const lockedAspectRatioRef = useRef(lockedAspectRatio)
  const canvasEngineRef = useRef(canvasEngine)
  const viewportControllerRef = useRef(viewportController)
  idRef.current = id
  minWidthRef.current = minWidth
  minHeightRef.current = minHeight
  lockedAspectRatioRef.current = lockedAspectRatio
  canvasEngineRef.current = canvasEngine
  viewportControllerRef.current = viewportController
  shiftPressedRef.current = shiftPressed
  primaryPressedRef.current = primaryPressed
  onResizeRef.current = onResize
  onResizeEndRef.current = onResizeEnd

  const updateResizeForSession = useCallback((square: boolean, snap: boolean) => {
    const session = resizeSessionRef.current
    if (!session?.currentPoint) {
      return
    }

    const { bounds: nextBounds, guides } = resolveSessionResizeBounds({
      session,
      currentPoint: session.currentPoint,
      minWidth: minWidthRef.current,
      minHeight: minHeightRef.current,
      lockedAspectRatio: lockedAspectRatioRef.current,
      square,
      snap,
      zoom: viewportControllerRef.current.getZoom(),
    })

    if (guides.length > 0) {
      setCanvasDragSnapGuides(guides)
    } else {
      clearCanvasDragSnapGuides()
    }

    onResizeRef.current(idRef.current, nextBounds.width, nextBounds.height, {
      x: nextBounds.x,
      y: nextBounds.y,
    })
  }, [])

  const updateResize = useCallback((event: PointerEvent, commit: boolean) => {
    const session = resizeSessionRef.current
    if (!session || event.pointerId !== session.pointerId) {
      return
    }

    const currentPoint = viewportControllerRef.current.screenToCanvasPosition({
      x: event.clientX,
      y: event.clientY,
    })
    session.currentPoint = currentPoint
    const { bounds: nextBounds, guides } = resolveSessionResizeBounds({
      session,
      currentPoint,
      minWidth: minWidthRef.current,
      minHeight: minHeightRef.current,
      lockedAspectRatio: lockedAspectRatioRef.current,
      square: event.shiftKey || shiftPressedRef.current,
      snap: isPrimarySelectionModifier(event),
      zoom: viewportControllerRef.current.getZoom(),
    })

    if (commit || guides.length === 0) {
      clearCanvasDragSnapGuides()
    } else {
      setCanvasDragSnapGuides(guides)
    }

    if (commit) {
      onResizeEndRef.current(idRef.current, nextBounds.width, nextBounds.height, {
        x: nextBounds.x,
        y: nextBounds.y,
      })
      return
    }

    onResizeRef.current(idRef.current, nextBounds.width, nextBounds.height, {
      x: nextBounds.x,
      y: nextBounds.y,
    })
  }, [])

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      updateResize(event, false)
    },
    [updateResize],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        updateResizeForSession(true, primaryPressedRef.current)
      }

      if (event.key === 'Control' || event.key === 'Meta') {
        updateResizeForSession(shiftPressedRef.current, true)
      }
    },
    [updateResizeForSession],
  )

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        updateResizeForSession(false, primaryPressedRef.current)
      }

      if (event.key === 'Control' || event.key === 'Meta') {
        updateResizeForSession(shiftPressedRef.current, false)
      }
    },
    [updateResizeForSession],
  )

  const endResize = useCallback(
    (event: PointerEvent, commit: boolean) => {
      const session = resizeSessionRef.current
      if (!session || event.pointerId !== session.pointerId) {
        return
      }

      updateResize(event, commit)
      clearCanvasDragSnapGuides()
      releasePointerCapture(session.target, session.pointerId)
      resizeSessionRef.current = null
      removeWindowListenersRef.current()
    },
    [updateResize],
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      endResize(event, true)
    },
    [endResize],
  )

  const handlePointerCancel = useCallback(
    (event: PointerEvent) => {
      endResize(event, false)
    },
    [endResize],
  )

  const removeWindowListeners = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerCancel)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  }, [handleKeyDown, handleKeyUp, handlePointerMove, handlePointerCancel, handlePointerUp])

  const addWindowListeners = useCallback(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  }, [handleKeyDown, handleKeyUp, handlePointerMove, handlePointerCancel, handlePointerUp])
  removeWindowListenersRef.current = removeWindowListeners

  useEffect(() => {
    return () => {
      removeWindowListeners()
      clearCanvasDragSnapGuides()

      const session = resizeSessionRef.current
      if (session) {
        releasePointerCapture(session.target, session.pointerId)
        resizeSessionRef.current = null
      }
    }
  }, [removeWindowListeners])

  const currentBounds = getCurrentResizeBounds(internalNode, minWidth, minHeight)

  if (!interactiveRenderMode || !selected || dragging) {
    return []
  }

  return CORNERS.map(({ position, cursorClassName, style }) => ({
    position: position as CornerHandlePosition,
    cursorClassName,
    style,
    onPointerDown: (event) => {
      if (event.button !== 0 || !currentBounds) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      event.currentTarget.setPointerCapture(event.pointerId)
      resizeSessionRef.current = {
        pointerId: event.pointerId,
        target: event.currentTarget,
        handlePosition: position as CornerHandlePosition,
        startBounds: currentBounds,
        currentPoint: null,
        targetBounds: canvasEngineRef.current
          .getSnapshot()
          .nodes.filter(
            (candidate) => candidate.type !== 'stroke' && candidate.id !== idRef.current,
          )
          .flatMap((candidate) => {
            const bounds = getCanvasNodeBounds(candidate)
            return bounds ? [bounds] : []
          }),
      }
      addWindowListeners()
    },
  }))
}

function useRuntimeCanvasNode(
  canvasEngine: ReturnType<typeof useCanvasRuntime>['canvasEngine'],
  nodeId: string,
) {
  return useSyncExternalStore(
    canvasEngine.subscribe ?? subscribeToNoop,
    () => canvasEngine.getSnapshot().nodeLookup?.get(nodeId),
    () => undefined,
  )
}

function subscribeToNoop() {
  return () => undefined
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
}): { bounds: ResizeBounds; guides: Array<CanvasDragGuide> } {
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

function getCurrentResizeBounds(
  internalNode:
    | {
        node: {
          width?: number | null
          height?: number | null
          position: { x: number; y: number }
        }
        measured: { width?: number; height?: number }
        positionAbsolute: { x: number; y: number }
      }
    | undefined,
  minWidth: number,
  minHeight: number,
): ResizeBounds | null {
  if (!internalNode) {
    return null
  }

  const width = internalNode.measured.width ?? internalNode.node.width ?? minWidth
  const height = internalNode.measured.height ?? internalNode.node.height ?? minHeight
  const position = internalNode.node.position

  return {
    x: position.x,
    y: position.y,
    width,
    height,
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
  handlePosition: CornerHandlePosition
  startBounds: ResizeBounds
  currentPoint: { x: number; y: number }
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
  preferredAxis?: ResizeAxis
}): ResizeBounds {
  const anchor = getOppositeCorner(startBounds, handlePosition)
  const minimumSquareSize = Math.max(minWidth, minHeight)

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

function resolveSquareResizePoint({
  anchor,
  point,
  handlePosition,
  minSize,
  preferredAxis,
}: {
  anchor: { x: number; y: number }
  point: { x: number; y: number }
  handlePosition: CornerHandlePosition
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
  handlePosition: CornerHandlePosition
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

function getOppositeCorner(bounds: ResizeBounds, handlePosition: CornerHandlePosition) {
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
  handlePosition: CornerHandlePosition
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
  handlePosition: CornerHandlePosition
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

function getHandleDirection(handlePosition: CornerHandlePosition) {
  switch (handlePosition) {
    case 'top-left':
      return { x: -1, y: -1 }
    case 'top-right':
      return { x: 1, y: -1 }
    case 'bottom-left':
      return { x: -1, y: 1 }
    case 'bottom-right':
      return { x: 1, y: 1 }
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
  bounds: ResizeBounds
  currentPoint: { x: number; y: number }
  handlePosition: CornerHandlePosition
  targetBounds: Array<ResizeBounds>
  threshold: number
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
}): { bounds: ResizeBounds; guides: Array<CanvasDragGuide> } | null {
  if (!square && !lockedAspectRatio) {
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
  bounds: ResizeBounds
  handlePosition: CornerHandlePosition
  targetBounds: Array<ResizeBounds>
  threshold: number
  minWidth: number
  minHeight: number
}): { bounds: ResizeBounds; guides: Array<CanvasDragGuide> } | null {
  const anchor = getOppositeCorner(bounds, handlePosition)
  const currentPoint = getResizeHandlePoint(bounds, handlePosition)
  const xSnap = getBestResizeAxisSnap({
    axis: 'x',
    bounds,
    handlePosition,
    targetBounds,
    threshold,
  })
  const ySnap = getBestResizeAxisSnap({
    axis: 'y',
    bounds,
    handlePosition,
    targetBounds,
    threshold,
  })

  if (!xSnap && !ySnap) {
    return null
  }

  const snappedPoint = applyMinimumRectSize({
    anchor,
    point: {
      x: xSnap?.point ?? currentPoint.x,
      y: ySnap?.point ?? currentPoint.y,
    },
    handlePosition,
    minWidth,
    minHeight,
  })

  return {
    bounds: normalizeResizeBounds(anchor, snappedPoint),
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
  bounds: ResizeBounds
  currentPoint: { x: number; y: number }
  handlePosition: CornerHandlePosition
  targetBounds: Array<ResizeBounds>
  threshold: number
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
}): { bounds: ResizeBounds; guides: Array<CanvasDragGuide> } | null {
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

function getResizeHandlePoint(bounds: ResizeBounds, handlePosition: CornerHandlePosition) {
  switch (handlePosition) {
    case 'top-left':
      return { x: bounds.x, y: bounds.y }
    case 'top-right':
      return { x: bounds.x + bounds.width, y: bounds.y }
    case 'bottom-left':
      return { x: bounds.x, y: bounds.y + bounds.height }
    case 'bottom-right':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
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
  bounds: ResizeBounds
  handlePosition: CornerHandlePosition
  targetBounds: Array<ResizeBounds>
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
  let bestCandidate: (typeof candidates)[number] | null = null
  let bestDistance = threshold + 1

  for (const candidate of candidates) {
    const distance = Math.abs(candidate.targetValue - candidate.draggedValue)
    if (distance > threshold || distance >= bestDistance) {
      continue
    }

    bestCandidate = candidate
    bestDistance = distance
  }

  if (!bestCandidate) {
    return null
  }

  return {
    point: bestCandidate.point,
    guide: createResizeAxisGuide(bestCandidate),
  }
}

function getBestResizeSnapCandidate<TCandidate extends ResizeAxisSnapCandidate>(
  candidates: Array<TCandidate>,
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
  bounds: ResizeBounds
  targetBounds: ResizeBounds
  handlePosition: CornerHandlePosition
}) {
  const createSnapCandidate = ({
    axis: candidateAxis,
    bounds: candidateBounds,
    targetBounds: candidateTargetBounds,
    draggedValue,
    targetValue,
    point,
  }: {
    axis: 'x' | 'y'
    bounds: ResizeBounds
    targetBounds: ResizeBounds
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

  const anchor = getOppositeCorner(bounds, handlePosition)
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2

  if (axis === 'x') {
    const targetValues = [
      targetBounds.x,
      targetBounds.x + targetBounds.width / 2,
      targetBounds.x + targetBounds.width,
    ]

    if (handlePosition === 'top-left' || handlePosition === 'bottom-left') {
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

  if (handlePosition === 'top-left' || handlePosition === 'top-right') {
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
