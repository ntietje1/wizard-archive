import { useEffect, useRef } from 'react'
import { useInternalNode, useReactFlow } from '@xyflow/react'
import type { ControlPosition } from '@xyflow/react'
import {
  useCanvasNodeActionsContext,
  useCanvasRemoteHighlightsContext,
} from '../../runtime/providers/canvas-runtime-hooks'
import { useCanvasModifierKeys } from '../../runtime/interaction/use-canvas-modifier-keys'
import { constrainPointToSquare } from '../../utils/canvas-constraint-utils'
import { releasePointerCapture } from '../../tools/shared/tool-module-utils'
import { useCanvasNodeVisualSelection } from './use-canvas-node-visual-selection'

const HANDLE_SIZE = 4
const HANDLE_HIT_SIZE = 16
const SELECTION_BORDER_OUTSET_PX = 1
const RESIZE_HANDLE_OUTSET_PX = SELECTION_BORDER_OUTSET_PX

const CORNERS: Array<{
  position: ControlPosition
  cursor: string
  cursorClassName: string
  style: React.CSSProperties
}> = [
  {
    position: 'top-left',
    cursor: 'nwse-resize',
    cursorClassName: 'cursor-nwse-resize',
    style: {
      left: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
      top: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
    },
  },
  {
    position: 'top-right',
    cursor: 'nesw-resize',
    cursorClassName: 'cursor-nesw-resize',
    style: {
      right: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
      top: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
    },
  },
  {
    position: 'bottom-left',
    cursor: 'nesw-resize',
    cursorClassName: 'cursor-nesw-resize',
    style: {
      left: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
      bottom: -HANDLE_SIZE / 2 + 1 - (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2 - RESIZE_HANDLE_OUTSET_PX,
    },
  },
  {
    position: 'bottom-right',
    cursor: 'nwse-resize',
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
}

interface ResizableNodeWrapperProps {
  id: string
  nodeType: string
  dragging: boolean
  children: React.ReactNode
  minWidth?: number
  minHeight?: number
}

export function ResizableNodeWrapper({
  id,
  nodeType,
  dragging,
  children,
  minWidth = 50,
  minHeight = 30,
}: ResizableNodeWrapperProps) {
  const reactFlow = useReactFlow()
  const internalNode = useInternalNode(id)
  const remoteHighlights = useCanvasRemoteHighlightsContext()
  const { onResize, onResizeEnd } = useCanvasNodeActionsContext()
  const { shiftPressed } = useCanvasModifierKeys()
  const { visuallySelected, pendingPreviewActive, pendingSelected, selected } =
    useCanvasNodeVisualSelection(id)
  const highlight = remoteHighlights.get(id)
  const showHandles = selected && !dragging
  const resizeSessionRef = useRef<ResizeSession | null>(null)
  const shiftPressedRef = useRef(shiftPressed)
  const onResizeRef = useRef(onResize)
  const onResizeEndRef = useRef(onResizeEnd)
  shiftPressedRef.current = shiftPressed
  onResizeRef.current = onResize
  onResizeEndRef.current = onResizeEnd

  useEffect(() => {
    const updateResize = (event: PointerEvent, commit: boolean) => {
      const session = resizeSessionRef.current
      if (!session || event.pointerId !== session.pointerId) {
        return
      }

      const currentPoint = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const nextBounds = resolveResizeBounds({
        handlePosition: session.handlePosition,
        startBounds: session.startBounds,
        currentPoint,
        minWidth,
        minHeight,
        square: event.shiftKey || shiftPressedRef.current,
      })

      if (commit) {
        onResizeEndRef.current(id, nextBounds.width, nextBounds.height, {
          x: nextBounds.x,
          y: nextBounds.y,
        })
      } else {
        onResizeRef.current(id, nextBounds.width, nextBounds.height, {
          x: nextBounds.x,
          y: nextBounds.y,
        })
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateResize(event, false)
    }

    const endResize = (event: PointerEvent, commit: boolean) => {
      const session = resizeSessionRef.current
      if (!session || event.pointerId !== session.pointerId) {
        return
      }

      updateResize(event, commit)
      releasePointerCapture(session.target, session.pointerId)
      resizeSessionRef.current = null
    }

    const handlePointerUp = (event: PointerEvent) => {
      endResize(event, true)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      endResize(event, false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)

      const session = resizeSessionRef.current
      if (session) {
        releasePointerCapture(session.target, session.pointerId)
        resizeSessionRef.current = null
      }
    }
  }, [id, minHeight, minWidth, reactFlow])

  const currentBounds = getCurrentResizeBounds(internalNode, minWidth, minHeight)

  return (
    <div
      className="relative h-full w-full"
      data-testid="canvas-node"
      data-node-id={id}
      data-node-type={nodeType}
      data-node-selected={selected ? 'true' : 'false'}
      data-node-visual-selected={visuallySelected ? 'true' : 'false'}
      data-node-pending-preview-active={pendingPreviewActive ? 'true' : 'false'}
      data-node-pending-selected={pendingSelected ? 'true' : 'false'}
    >
      {(visuallySelected || highlight) && (
        <div
          data-testid="selection-border"
          className="absolute -inset-0.25 rounded-sm pointer-events-none"
          style={{
            border: `1px solid ${highlight?.color ?? 'var(--primary)'}`,
            borderStyle: !highlight && pendingPreviewActive ? 'dashed' : 'solid',
            opacity: !highlight && pendingPreviewActive ? 0.85 : 1,
          }}
        />
      )}

      {showHandles &&
        CORNERS.map(({ position, cursorClassName, style }) => (
          <button
            key={position}
            type="button"
            data-testid={`canvas-node-resize-handle-${position}`}
            data-resize-handle-position={position}
            className={`canvas-node-resize-handle nodrag nopan absolute border-none bg-transparent p-0 touch-none z-[2] ${cursorClassName}`}
            style={{
              width: HANDLE_HIT_SIZE,
              height: HANDLE_HIT_SIZE,
              ...style,
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()

              if (event.button !== 0 || !currentBounds) {
                return
              }

              event.currentTarget.setPointerCapture(event.pointerId)
              resizeSessionRef.current = {
                pointerId: event.pointerId,
                target: event.currentTarget,
                handlePosition: position as CornerHandlePosition,
                startBounds: currentBounds,
              }
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute rounded-[1px] border border-primary bg-background"
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                top: (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2,
                left: (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2,
              }}
            />
          </button>
        ))}

      {children}
    </div>
  )
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
  square,
}: {
  handlePosition: CornerHandlePosition
  startBounds: ResizeBounds
  currentPoint: { x: number; y: number }
  minWidth: number
  minHeight: number
  square: boolean
}): ResizeBounds {
  const anchor = getOppositeCorner(startBounds, handlePosition)
  const minimumSquareSize = Math.max(minWidth, minHeight)

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
