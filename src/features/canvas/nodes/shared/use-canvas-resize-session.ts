import { useCallback, useEffect, useRef } from 'react'
import { getCanvasNodeBounds } from './canvas-node-bounds'
import { useCanvasNodeResizeMetadataSnapshot } from './canvas-node-resize-metadata'
import {
  useCanvasDocumentServices,
  useCanvasInteractionServices,
} from '../../runtime/providers/canvas-runtime'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import {
  clearCanvasDragSnapGuides,
  setCanvasDragSnapGuides,
} from '../../runtime/interaction/canvas-drag-snap-overlay'
import { useCanvasModifierKeys } from '../../runtime/interaction/use-canvas-modifier-keys'
import { releasePointerCapture } from '../../tools/shared/tool-module-utils'
import { affectsCanvasResizeAxis, resolveCanvasResize } from '../../system/canvas-resize-geometry'
import { getResizeHandlePoint } from '../../system/canvas-resize-handles'
import { useCanvasEngine, useCanvasEngineSelector } from '../../react/use-canvas-engine'
import type { CanvasNodeResizeMetadata } from './canvas-node-resize-metadata'
import type { CanvasResizeHandlePosition } from '../../system/canvas-resize-geometry'
import type { CanvasNodeResizeUpdate } from '../../tools/canvas-tool-types'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../../system/canvas-engine'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { boundsUnion } from '../../utils/canvas-geometry-utils'
import type { Bounds } from '../../utils/canvas-geometry-utils'

const HANDLE_HIT_SIZE_PX = 36

const DEFAULT_RESIZE_METADATA: CanvasNodeResizeMetadata = {
  dragging: false,
  minHeight: 30,
  minWidth: 50,
}

const RESIZE_HANDLES: Array<{
  position: CanvasResizeHandlePosition
  cursorClassName: string
}> = [
  {
    position: 'top-left',
    cursorClassName: 'cursor-nwse-resize',
  },
  {
    position: 'top',
    cursorClassName: 'cursor-ns-resize',
  },
  {
    position: 'top-right',
    cursorClassName: 'cursor-nesw-resize',
  },
  {
    position: 'right',
    cursorClassName: 'cursor-ew-resize',
  },
  {
    position: 'bottom-right',
    cursorClassName: 'cursor-nwse-resize',
  },
  {
    position: 'bottom',
    cursorClassName: 'cursor-ns-resize',
  },
  {
    position: 'bottom-left',
    cursorClassName: 'cursor-nesw-resize',
  },
  {
    position: 'left',
    cursorClassName: 'cursor-ew-resize',
  },
]

interface CanvasSelectionResizeSession {
  bounds: Bounds
  zones: ReadonlyArray<CanvasSelectionResizeZoneDescriptor>
}

export interface CanvasSelectionResizeZoneDescriptor {
  cursorClassName: string
  onKeyboardStart: (target: HTMLButtonElement) => void
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  position: CanvasResizeHandlePosition
  style: CSSProperties
}

interface SelectionResizeNode {
  bounds: Bounds
  dragging: boolean
  id: string
  metadata: CanvasNodeResizeMetadata
}

interface ActiveSelectionResize {
  handlePosition: CanvasResizeHandlePosition
  nodes: ReadonlyArray<SelectionResizeNode>
  startBounds: Bounds
  targetBounds: ReadonlyArray<Bounds>
  minWidth: number
  minHeight: number
  currentPoint: { x: number; y: number } | null
}

type CanvasResizeSessionResult = ReturnType<typeof resolveCanvasResize> & { final: boolean }

export function useCanvasResizeSession(): CanvasSelectionResizeSession | null {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const canvasEngine = useCanvasEngine()
  const {
    nodeActions: { onResizeMany, onResizeManyCancel, onResizeManyEnd },
  } = useCanvasDocumentServices()
  const { canEdit, viewportController } = useCanvasInteractionServices()
  const modifiers = useCanvasModifierKeys()
  const metadataSnapshot = useCanvasNodeResizeMetadataSnapshot()
  const selection = useCanvasEngineSelector((snapshot) =>
    getSelectedResizeNodes(snapshot, metadataSnapshot),
  )
  const resizeTargetRef = useRef<{ pointerId: number; target: Element | null } | null>(null)
  const activeResizeRef = useRef<ActiveSelectionResize | null>(null)
  const removeWindowListenersRef = useRef<() => void>(() => undefined)
  const canvasEngineRef = useRef(canvasEngine)
  const viewportControllerRef = useRef(viewportController)
  const onResizeManyRef = useRef(onResizeMany)
  const onResizeManyCancelRef = useRef(onResizeManyCancel)
  const onResizeManyEndRef = useRef(onResizeManyEnd)
  canvasEngineRef.current = canvasEngine
  viewportControllerRef.current = viewportController
  onResizeManyRef.current = onResizeMany
  onResizeManyCancelRef.current = onResizeManyCancel
  onResizeManyEndRef.current = onResizeManyEnd

  const applyResizeResult = useCallback(
    (
      result: CanvasResizeSessionResult | null,
      options: { cancel?: boolean; clearGuides: boolean } = { clearGuides: false },
    ) => {
      const activeResize = activeResizeRef.current
      if (!result || !activeResize) {
        return
      }

      if (options.clearGuides || result.guides.length === 0) {
        clearCanvasDragSnapGuides()
      } else {
        setCanvasDragSnapGuides([...result.guides])
      }

      const updates = resolveSelectionResizeUpdates({
        handlePosition: activeResize.handlePosition,
        nextBounds: result.bounds,
        nodes: activeResize.nodes,
        startBounds: activeResize.startBounds,
      })
      const resize = options.cancel
        ? onResizeManyCancelRef.current
        : result.final
          ? onResizeManyEndRef.current
          : onResizeManyRef.current
      resize(updates)
    },
    [],
  )

  const updateResizeForSession = useCallback(
    (square: boolean, snap: boolean) => {
      const activeResize = activeResizeRef.current
      if (!activeResize?.currentPoint) {
        return
      }

      applyResizeResult({
        ...resolveCanvasResize({
          handlePosition: activeResize.handlePosition,
          startBounds: activeResize.startBounds,
          currentPoint: activeResize.currentPoint,
          targetBounds: activeResize.targetBounds,
          minWidth: activeResize.minWidth,
          minHeight: activeResize.minHeight,
          square,
          snap,
          zoom: viewportControllerRef.current.getZoom(),
        }),
        final: false,
      })
    },
    [applyResizeResult],
  )

  const updateResize = useCallback(
    (event: PointerEvent, commit: boolean) => {
      const resizeTarget = resizeTargetRef.current
      if (!resizeTarget || event.pointerId !== resizeTarget.pointerId) {
        return
      }

      const currentPoint = viewportControllerRef.current.screenToCanvasPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const activeResize = activeResizeRef.current
      if (!activeResize) {
        return
      }

      const square = readShiftModifier(modifiers)
      const snap = readPrimaryModifier(modifiers)
      activeResizeRef.current = { ...activeResize, currentPoint }

      applyResizeResult(
        {
          ...resolveCanvasResize({
            handlePosition: activeResize.handlePosition,
            startBounds: activeResize.startBounds,
            currentPoint,
            targetBounds: activeResize.targetBounds,
            minWidth: activeResize.minWidth,
            minHeight: activeResize.minHeight,
            square,
            snap,
            zoom: viewportControllerRef.current.getZoom(),
          }),
          final: commit,
        },
        {
          clearGuides: commit,
        },
      )
    },
    [applyResizeResult, modifiers],
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

      if (commit) {
        updateResize(event, true)
      } else {
        const activeResize = activeResizeRef.current
        applyResizeResult(
          activeResize ? { bounds: activeResize.startBounds, guides: [], final: false } : null,
          { cancel: true, clearGuides: true },
        )
      }
      releasePointerCapture(resizeTarget.target, resizeTarget.pointerId)
      resizeTargetRef.current = null
      activeResizeRef.current = null
      removeWindowListenersRef.current()
      if (!commit) {
        clearCanvasDragSnapGuides()
      }
    },
    [applyResizeResult, updateResize],
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
      activeResizeRef.current = null
    }
  }, [removeWindowListeners])

  if (
    !canEdit ||
    !interactiveRenderMode ||
    !selection ||
    selection.nodes.some((node) => node.dragging || node.metadata.dragging)
  ) {
    return null
  }

  const startSelectionResize = (
    position: CanvasResizeHandlePosition,
    target: HTMLButtonElement,
    pointerId: number | null,
  ) => {
    const startSelection = getSelectedResizeNodes(
      canvasEngineRef.current.getSnapshot(),
      metadataSnapshot,
    )
    if (!startSelection) {
      return
    }

    const minimumSize = getMinimumSelectionResizeSize(startSelection)
    if (pointerId !== null) {
      target.setPointerCapture(pointerId)
      resizeTargetRef.current = {
        pointerId,
        target,
      }
    } else {
      resizeTargetRef.current = null
    }
    activeResizeRef.current = {
      handlePosition: position,
      nodes: startSelection.nodes,
      startBounds: startSelection.bounds,
      minWidth: minimumSize.width,
      minHeight: minimumSize.height,
      currentPoint:
        pointerId === null ? getResizeHandlePoint(startSelection.bounds, position) : null,
      targetBounds: canvasEngineRef.current
        .getSnapshot()
        .nodes.filter(
          (candidate) =>
            candidate.type !== 'stroke' && !startSelection.selectedNodeIds.has(candidate.id),
        )
        .flatMap((candidate) => {
          const bounds = getCanvasNodeBounds(candidate)
          return bounds ? [bounds] : []
        }),
    }
    if (pointerId !== null) {
      addWindowListeners()
    }
  }

  const zones = RESIZE_HANDLES.map(({ position, cursorClassName }) => ({
    position,
    cursorClassName,
    style: getResizeZoneStyle(position),
    onKeyboardStart: (target: HTMLButtonElement) => {
      startSelectionResize(position, target, null)
    },
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      startSelectionResize(position, event.currentTarget, event.pointerId)
    },
  }))

  return {
    bounds: selection.bounds,
    zones,
  }
}

export function resolveSelectionResizeUpdates({
  handlePosition,
  nextBounds,
  nodes,
  startBounds,
}: {
  handlePosition: CanvasResizeHandlePosition
  nextBounds: Bounds
  nodes: ReadonlyArray<SelectionResizeNode>
  startBounds: Bounds
}): ReadonlyMap<string, CanvasNodeResizeUpdate> {
  const updates = new Map<string, CanvasNodeResizeUpdate>()
  const scaleX = startBounds.width > 0 ? nextBounds.width / startBounds.width : 1
  const scaleY = startBounds.height > 0 ? nextBounds.height / startBounds.height : 1

  for (const selectionNode of nodes) {
    const { bounds, metadata } = selectionNode
    const centerX = nextBounds.x + (bounds.x + bounds.width / 2 - startBounds.x) * scaleX
    const centerY = nextBounds.y + (bounds.y + bounds.height / 2 - startBounds.y) * scaleY
    let width = Math.max(bounds.width * scaleX, metadata.minWidth)
    let height = Math.max(bounds.height * scaleY, metadata.minHeight)

    if (metadata.lockedAspectRatio) {
      const scale = getLockedNodeScale(handlePosition, scaleX, scaleY)
      if (affectsCanvasResizeAxis(handlePosition, 'x')) {
        width = Math.max(
          bounds.width * scale,
          metadata.minWidth,
          metadata.minHeight * metadata.lockedAspectRatio,
        )
        height = width / metadata.lockedAspectRatio
      } else {
        height = Math.max(
          bounds.height * scale,
          metadata.minHeight,
          metadata.minWidth / metadata.lockedAspectRatio,
        )
        width = height * metadata.lockedAspectRatio
      }
    }

    updates.set(selectionNode.id, {
      width,
      height,
      position: {
        x: centerX - width / 2,
        y: centerY - height / 2,
      },
    })
  }

  return updates
}

function getSelectedResizeNodes(
  snapshot: CanvasEngineSnapshot,
  metadataSnapshot: ReadonlyMap<string, CanvasNodeResizeMetadata>,
): {
  bounds: Bounds
  nodes: ReadonlyArray<SelectionResizeNode>
  selectedNodeIds: ReadonlySet<string>
} | null {
  if (
    snapshot.selection.pendingPreview.kind === 'active' ||
    snapshot.selection.nodeIds.size === 0
  ) {
    return null
  }

  const selectedNodeIds = new Set(snapshot.selection.nodeIds)
  const nodes: Array<SelectionResizeNode> = []

  for (const nodeId of selectedNodeIds) {
    const internalNode = snapshot.nodeLookup.get(nodeId)
    if (!internalNode?.visible) {
      continue
    }

    const metadata = metadataSnapshot.get(nodeId) ?? DEFAULT_RESIZE_METADATA
    const bounds = getCurrentResizeBounds(internalNode, metadata)
    if (!bounds) {
      continue
    }

    nodes.push({
      bounds,
      dragging: internalNode.dragging,
      id: nodeId,
      metadata,
    })
  }

  if (nodes.length === 0) {
    return null
  }

  const selectionBounds = boundsUnion(nodes.map((node) => node.bounds))
  if (!selectionBounds) {
    return null
  }

  return {
    bounds: selectionBounds,
    nodes,
    selectedNodeIds,
  }
}

function getCurrentResizeBounds(
  internalNode: CanvasInternalNode,
  metadata: CanvasNodeResizeMetadata,
): Bounds | null {
  const width = internalNode.measured.width ?? internalNode.node.width ?? metadata.minWidth
  const height = internalNode.measured.height ?? internalNode.node.height ?? metadata.minHeight

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return {
    x: internalNode.node.position.x,
    y: internalNode.node.position.y,
    width,
    height,
  }
}

function getMinimumSelectionResizeSize(selection: {
  bounds: Bounds
  nodes: ReadonlyArray<SelectionResizeNode>
}) {
  if (selection.nodes.length > 1) {
    return {
      width: 1,
      height: 1,
    }
  }

  let minScaleX = 0
  let minScaleY = 0

  for (const { bounds, metadata } of selection.nodes) {
    if (bounds.width > 0) {
      const lockedMinimumWidth = metadata.lockedAspectRatio
        ? metadata.minHeight * metadata.lockedAspectRatio
        : 0
      minScaleX = Math.max(
        minScaleX,
        Math.max(metadata.minWidth, lockedMinimumWidth) / bounds.width,
      )
    }

    if (bounds.height > 0) {
      const lockedMinimumHeight = metadata.lockedAspectRatio
        ? metadata.minWidth / metadata.lockedAspectRatio
        : 0
      minScaleY = Math.max(
        minScaleY,
        Math.max(metadata.minHeight, lockedMinimumHeight) / bounds.height,
      )
    }
  }

  return {
    width: Math.max(selection.bounds.width * minScaleX, 1),
    height: Math.max(selection.bounds.height * minScaleY, 1),
  }
}

function getLockedNodeScale(
  handlePosition: CanvasResizeHandlePosition,
  scaleX: number,
  scaleY: number,
) {
  if (!affectsCanvasResizeAxis(handlePosition, 'x')) {
    return scaleY
  }

  if (!affectsCanvasResizeAxis(handlePosition, 'y')) {
    return scaleX
  }

  return Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY
}

function getResizeZoneStyle(position: CanvasResizeHandlePosition): CSSProperties {
  const cornerSize = HANDLE_HIT_SIZE_PX
  const halfCornerSize = cornerSize / 2
  const sideBandSize = HANDLE_HIT_SIZE_PX
  const halfSideBandSize = sideBandSize / 2

  switch (position) {
    case 'top-left':
      return { left: -halfCornerSize, top: -halfCornerSize, width: cornerSize, height: cornerSize }
    case 'top':
      return {
        left: halfCornerSize,
        right: halfCornerSize,
        top: -halfSideBandSize,
        height: sideBandSize,
      }
    case 'top-right':
      return {
        right: -halfCornerSize,
        top: -halfCornerSize,
        width: cornerSize,
        height: cornerSize,
      }
    case 'right':
      return {
        right: -halfSideBandSize,
        top: halfCornerSize,
        bottom: halfCornerSize,
        width: sideBandSize,
      }
    case 'bottom-right':
      return {
        right: -halfCornerSize,
        bottom: -halfCornerSize,
        width: cornerSize,
        height: cornerSize,
      }
    case 'bottom':
      return {
        left: halfCornerSize,
        right: halfCornerSize,
        bottom: -halfSideBandSize,
        height: sideBandSize,
      }
    case 'bottom-left':
      return {
        left: -halfCornerSize,
        bottom: -halfCornerSize,
        width: cornerSize,
        height: cornerSize,
      }
    case 'left':
      return {
        left: -halfSideBandSize,
        top: halfCornerSize,
        bottom: halfCornerSize,
        width: sideBandSize,
      }
  }
}

function readPrimaryModifier(modifiers: ReturnType<typeof useCanvasModifierKeys>) {
  return modifiers.primaryPressed
}

function readShiftModifier(modifiers: ReturnType<typeof useCanvasModifierKeys>) {
  return modifiers.shiftPressed
}
