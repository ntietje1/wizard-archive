import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { ControlPosition } from '@xyflow/react'
import { getCanvasNodeBounds } from './canvas-node-bounds'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import {
  clearCanvasDragSnapGuides,
  setCanvasDragSnapGuides,
} from '../../runtime/interaction/canvas-drag-snap-overlay'
import { useCanvasModifierKeys } from '../../runtime/interaction/use-canvas-modifier-keys'
import { useIsCanvasNodeSelected } from '../../runtime/selection/use-canvas-selection-state'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'
import { releasePointerCapture } from '../../tools/shared/tool-module-utils'
import { createCanvasResizeController } from '../../system/canvas-resize-controller'
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

type CornerHandlePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type CanvasResizeBounds = {
  x: number
  y: number
  width: number
  height: number
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
  const modifiers = useCanvasModifierKeys()
  const selected = useIsCanvasNodeSelected(id)
  const resizeController = useMemo(() => createCanvasResizeController(), [])
  const resizeTargetRef = useRef<{ pointerId: number; target: Element | null } | null>(null)
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
  onResizeRef.current = onResize
  onResizeEndRef.current = onResizeEnd

  const applyResizeResult = useCallback(
    (
      result: ReturnType<typeof resizeController.update>,
      options: { clearGuides: boolean } = { clearGuides: false },
    ) => {
      if (!result) {
        return
      }

      if (options.clearGuides || result.guides.length === 0) {
        clearCanvasDragSnapGuides()
      } else {
        setCanvasDragSnapGuides([...result.guides])
      }

      const { bounds } = result
      const resize = result.final ? onResizeEndRef.current : onResizeRef.current
      resize(idRef.current, bounds.width, bounds.height, {
        x: bounds.x,
        y: bounds.y,
      })
    },
    [],
  )

  const updateResizeForSession = useCallback(
    (square: boolean, snap: boolean) => {
      applyResizeResult(
        resizeController.refreshModifiers({
          square,
          snap,
          zoom: viewportControllerRef.current.getZoom(),
        }),
      )
    },
    [applyResizeResult, resizeController],
  )

  const updateResize = useCallback(
    (event: PointerEvent, commit: boolean) => {
      const currentPoint = viewportControllerRef.current.screenToCanvasPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const options = {
        pointerId: event.pointerId,
        currentPoint,
        square: event.shiftKey || readShiftModifier(modifiers),
        snap: isPrimarySelectionModifier(event),
        zoom: viewportControllerRef.current.getZoom(),
      }

      applyResizeResult(
        commit ? resizeController.commit(options) : resizeController.update(options),
        {
          clearGuides: commit,
        },
      )
    },
    [applyResizeResult, modifiers, resizeController],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      updateResize(event, false)
    },
    [updateResize],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        updateResizeForSession(true, readPrimaryModifier(modifiers))
      }

      if (event.key === 'Control' || event.key === 'Meta') {
        updateResizeForSession(readShiftModifier(modifiers), true)
      }
    },
    [modifiers, updateResizeForSession],
  )

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        updateResizeForSession(false, readPrimaryModifier(modifiers))
      }

      if (event.key === 'Control' || event.key === 'Meta') {
        updateResizeForSession(readShiftModifier(modifiers), false)
      }
    },
    [modifiers, updateResizeForSession],
  )

  const endResize = useCallback(
    (event: PointerEvent, commit: boolean) => {
      const resizeTarget = resizeTargetRef.current
      if (!resizeTarget || event.pointerId !== resizeTarget.pointerId) {
        return
      }

      updateResize(event, commit)
      clearCanvasDragSnapGuides()
      releasePointerCapture(resizeTarget.target, resizeTarget.pointerId)
      resizeTargetRef.current = null
      removeWindowListenersRef.current()
      if (!commit) {
        resizeController.cancel()
      }
    },
    [resizeController, updateResize],
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

      const resizeTarget = resizeTargetRef.current
      if (resizeTarget) {
        releasePointerCapture(resizeTarget.target, resizeTarget.pointerId)
        resizeTargetRef.current = null
      }
      resizeController.dispose()
    }
  }, [removeWindowListeners, resizeController])

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
      resizeTargetRef.current = {
        pointerId: event.pointerId,
        target: event.currentTarget,
      }
      resizeController.start({
        pointerId: event.pointerId,
        handlePosition: position as CornerHandlePosition,
        startBounds: currentBounds,
        minWidth: minWidthRef.current,
        minHeight: minHeightRef.current,
        lockedAspectRatio: lockedAspectRatioRef.current,
        targetBounds: canvasEngineRef.current
          .getSnapshot()
          .nodes.filter(
            (candidate) => candidate.type !== 'stroke' && candidate.id !== idRef.current,
          )
          .flatMap((candidate) => {
            const bounds = getCanvasNodeBounds(candidate)
            return bounds ? [bounds] : []
          }),
      })
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

function readPrimaryModifier(modifiers: ReturnType<typeof useCanvasModifierKeys>) {
  return modifiers.getPrimaryPressed?.() ?? modifiers.primaryPressed
}

function readShiftModifier(modifiers: ReturnType<typeof useCanvasModifierKeys>) {
  return modifiers.getShiftPressed?.() ?? modifiers.shiftPressed
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
): CanvasResizeBounds | null {
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
