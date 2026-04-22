import { useCallback, useEffect, useRef } from 'react'
import { useInternalNode, useReactFlow } from '@xyflow/react'
import type { ControlPosition } from '@xyflow/react'
import { useCanvasNodeActionsContext } from '../../runtime/providers/canvas-runtime-hooks'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasModifierKeys } from '../../runtime/interaction/use-canvas-modifier-keys'
import { useIsCanvasNodeSelected } from '../../runtime/selection/use-canvas-selection-state'
import { constrainPointToSquare } from '../../utils/canvas-constraint-utils'
import { releasePointerCapture } from '../../tools/shared/tool-module-utils'
import type { CanvasNodeResizeHandleDescriptor } from './canvas-node-resize-handles'
import type { CSSProperties } from 'react'

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

type ResizeSession = {
  pointerId: number
  target: Element | null
  handlePosition: CornerHandlePosition
  startBounds: ResizeBounds
  currentPoint: { x: number; y: number } | null
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
  const reactFlow = useReactFlow()
  const internalNode = useInternalNode(id)
  const { onResize, onResizeEnd } = useCanvasNodeActionsContext()
  const { shiftPressed } = useCanvasModifierKeys()
  const selected = useIsCanvasNodeSelected(id)
  const resizeSessionRef = useRef<ResizeSession | null>(null)
  const shiftPressedRef = useRef(shiftPressed)
  const onResizeRef = useRef(onResize)
  const onResizeEndRef = useRef(onResizeEnd)
  const removeWindowListenersRef = useRef<() => void>(() => undefined)
  const idRef = useRef(id)
  const minWidthRef = useRef(minWidth)
  const minHeightRef = useRef(minHeight)
  const lockedAspectRatioRef = useRef(lockedAspectRatio)
  const reactFlowRef = useRef(reactFlow)
  idRef.current = id
  minWidthRef.current = minWidth
  minHeightRef.current = minHeight
  lockedAspectRatioRef.current = lockedAspectRatio
  reactFlowRef.current = reactFlow
  shiftPressedRef.current = shiftPressed
  onResizeRef.current = onResize
  onResizeEndRef.current = onResizeEnd

  const updateResizeForSession = useCallback((square: boolean) => {
    const session = resizeSessionRef.current
    if (!session?.currentPoint) {
      return
    }

    const nextBounds = resolveResizeBounds({
      handlePosition: session.handlePosition,
      startBounds: session.startBounds,
      currentPoint: session.currentPoint,
      minWidth: minWidthRef.current,
      minHeight: minHeightRef.current,
      lockedAspectRatio: lockedAspectRatioRef.current,
      square,
    })

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

    const currentPoint = reactFlowRef.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    session.currentPoint = currentPoint
    const nextBounds = resolveResizeBounds({
      handlePosition: session.handlePosition,
      startBounds: session.startBounds,
      currentPoint,
      minWidth: minWidthRef.current,
      minHeight: minHeightRef.current,
      lockedAspectRatio: lockedAspectRatioRef.current,
      square: event.shiftKey || shiftPressedRef.current,
    })

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
        updateResizeForSession(true)
      }
    },
    [updateResizeForSession],
  )

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        updateResizeForSession(false)
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
      }
      addWindowListeners()
    },
  }))
}

function getCurrentResizeBounds(
  internalNode: ReturnType<typeof useInternalNode> | undefined,
  minWidth: number,
  minHeight: number,
): ResizeBounds | null {
  if (!internalNode) {
    return null
  }

  const width = internalNode.measured?.width ?? internalNode.width ?? minWidth
  const height = internalNode.measured?.height ?? internalNode.height ?? minHeight
  const position = internalNode.position ??
    internalNode.internals.positionAbsolute ?? { x: 0, y: 0 }

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
}: {
  handlePosition: CornerHandlePosition
  startBounds: ResizeBounds
  currentPoint: { x: number; y: number }
  minWidth: number
  minHeight: number
  lockedAspectRatio?: number
  square: boolean
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
    })

    return normalizeResizeBounds(anchor, signedPoint)
  }

  if (square) {
    const constrainedPoint = constrainPointToSquare(anchor, currentPoint)
    const signedPoint = applyMinimumSquareSize({
      anchor,
      point: constrainedPoint,
      handlePosition,
      minSize: minimumSquareSize,
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

function applyLockedAspectRatioSize({
  anchor,
  point,
  handlePosition,
  minWidth,
  minHeight,
  lockedAspectRatio,
}: {
  anchor: { x: number; y: number }
  point: { x: number; y: number }
  handlePosition: CornerHandlePosition
  minWidth: number
  minHeight: number
  lockedAspectRatio: number
}) {
  const direction = getHandleDirection(handlePosition)
  const deltaX = Math.abs(point.x - anchor.x)
  const deltaY = Math.abs(point.y - anchor.y)
  const minimumWidth = Math.max(minWidth, minHeight * lockedAspectRatio)
  const widthFromX = Math.max(deltaX, minimumWidth)
  const widthFromY = Math.max(deltaY * lockedAspectRatio, minimumWidth)
  const candidateFromX = {
    width: widthFromX,
    height: widthFromX / lockedAspectRatio,
  }
  const candidateFromY = {
    width: widthFromY,
    height: widthFromY / lockedAspectRatio,
  }
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
