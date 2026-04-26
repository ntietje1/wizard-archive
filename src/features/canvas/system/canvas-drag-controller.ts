import { getCanvasNodeBounds } from '../nodes/shared/canvas-node-bounds'
import { constrainPointToAxis } from '../utils/canvas-constraint-utils'
import {
  getSnapThresholdForZoom,
  resolveCanvasDragSnap,
  withBoundsPosition,
} from '../runtime/interaction/canvas-drag-snap-utils'
import {
  clearCanvasDragSnapGuides,
  setCanvasDragSnapGuides,
} from '../runtime/interaction/canvas-drag-snap-overlay'
import type { CanvasEngine } from './canvas-engine'
import type { CanvasNode, CanvasPosition } from '../types/canvas-domain-types'

export interface CanvasDragEvent {
  sourceEvent: PointerEvent | MouseEvent
  activeNodeId: string
  draggedNodeIds: ReadonlySet<string>
  startPositions: ReadonlyMap<string, CanvasPosition>
  resolvedPositions: ReadonlyMap<string, CanvasPosition>
  delta: CanvasPosition
  final: boolean
}

type CanvasDragCallbacks = {
  onStart?: (event: CanvasDragEvent) => void
  onDrag?: (event: CanvasDragEvent) => void
  onEnd?: (event: CanvasDragEvent) => void
}

export interface CanvasDragController {
  handlePointerDown: (nodeId: string, event: PointerEvent | MouseEvent) => void
  profileDrag: (options: {
    nodeIds: ReadonlySet<string>
    delta: CanvasPosition
    steps: number
  }) => void
  destroy: () => void
}

interface CanvasDragSession {
  activeNodeId: string
  draggedNodeIds: ReadonlySet<string>
  startPointer: CanvasPosition
  pendingClientStart: CanvasPosition
  startPositions: ReadonlyMap<string, CanvasPosition>
  nodeBounds: ReadonlyMap<string, { x: number; y: number; width: number; height: number }>
  targetBounds: Array<{ x: number; y: number; width: number; height: number }>
  lastResolvedPositions: ReadonlyMap<string, CanvasPosition>
  started: boolean
  inputType: 'pointer' | 'mouse'
}

export function createCanvasDragController({
  callbacks = {},
  canvasEngine,
  getCanvasPosition,
  getPrimaryPressed,
  getCanStartDrag = () => true,
  getSelectedNodeIds,
  getShiftPressed,
  getZoom,
  thresholdPx = 3,
}: {
  callbacks?: CanvasDragCallbacks
  canvasEngine: CanvasEngine
  getCanvasPosition: (point: CanvasPosition) => CanvasPosition
  getPrimaryPressed: () => boolean
  getCanStartDrag?: () => boolean
  getSelectedNodeIds: () => ReadonlySet<string>
  getShiftPressed: () => boolean
  getZoom: () => number
  thresholdPx?: number
}): CanvasDragController {
  let session: CanvasDragSession | null = null

  const destroy = () => {
    detachWindowListeners()
    clearCanvasDragSnapGuides()
    session = null
  }

  const handlePointerDown = (nodeId: string, event: PointerEvent | MouseEvent) => {
    if (session) {
      return
    }

    if (event.button !== 0 || !getCanStartDrag() || shouldIgnoreDragTarget(event.target)) {
      return
    }

    const inputType =
      typeof PointerEvent !== 'undefined' && event instanceof PointerEvent ? 'pointer' : 'mouse'
    const nextSession = createDragSession({
      activeNodeId: nodeId,
      canvasEngine,
      clientStart: { x: event.clientX, y: event.clientY },
      getCanvasPosition,
      inputType,
      selectedNodeIds: getSelectedNodeIds(),
    })
    if (!nextSession) {
      return
    }

    session = nextSession
    attachWindowListeners(inputType)
  }

  const profileDrag: CanvasDragController['profileDrag'] = ({ nodeIds, delta, steps }) => {
    const [activeNodeId] = nodeIds
    if (!activeNodeId || steps <= 0) {
      return
    }

    const start = { x: 100, y: 100 }
    const syntheticSession = createDragSession({
      activeNodeId,
      canvasEngine,
      clientStart: start,
      getCanvasPosition,
      inputType: 'mouse',
      selectedNodeIds: nodeIds,
    })
    if (!syntheticSession) {
      return
    }

    session = syntheticSession
    startSession(new MouseEvent('mousemove', { clientX: start.x, clientY: start.y }))
    for (let step = 1; step <= steps; step += 1) {
      updateSession(
        new MouseEvent('mousemove', {
          clientX: start.x + (delta.x * step) / steps,
          clientY: start.y + (delta.y * step) / steps,
        }),
      )
    }
    endSession(
      new MouseEvent('mouseup', { clientX: start.x + delta.x, clientY: start.y + delta.y }),
    )
    clearCanvasDragSnapGuides()
    session = null
  }

  const onPointerMove = (event: PointerEvent) => {
    handleMove(event)
  }

  const onMouseMove = (event: MouseEvent) => {
    handleMove(event)
  }

  const handleMove = (event: PointerEvent | MouseEvent) => {
    if (!session) {
      return
    }

    if (!session.started) {
      const distance = Math.hypot(
        event.clientX - session.pendingClientStart.x,
        event.clientY - session.pendingClientStart.y,
      )
      if (distance < thresholdPx) {
        return
      }
      startSession(event)
    }

    updateSession(event)
    event.preventDefault()
  }

  const onPointerUp = (event: PointerEvent) => {
    handleUp(event)
  }

  const onMouseUp = (event: MouseEvent) => {
    handleUp(event)
  }

  const handleUp = (event: PointerEvent | MouseEvent) => {
    if (session?.started) {
      endSession(event)
    }

    destroy()
  }

  function attachWindowListeners(inputType: CanvasDragSession['inputType']) {
    if (inputType === 'pointer') {
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
      return
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function detachWindowListeners() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  function startSession(sourceEvent: PointerEvent | MouseEvent) {
    if (!session || session.started) {
      return
    }

    session.started = true
    canvasEngine.startDrag(session.draggedNodeIds)
    callbacks.onStart?.(createDragEvent(sourceEvent, session, session.startPositions, true, false))
  }

  function updateSession(sourceEvent: PointerEvent | MouseEvent) {
    if (!session) {
      return
    }

    const resolvedPositions = resolveDragPositions({
      canvasEngine,
      getCanvasPosition,
      getPrimaryPressed,
      getShiftPressed,
      getZoom,
      pointer: { x: sourceEvent.clientX, y: sourceEvent.clientY },
      session,
    })
    session.lastResolvedPositions = resolvedPositions
    canvasEngine.updateDrag(resolvedPositions)
    callbacks.onDrag?.(createDragEvent(sourceEvent, session, resolvedPositions, false, false))
  }

  function endSession(sourceEvent: PointerEvent | MouseEvent) {
    if (!session) {
      return
    }

    canvasEngine.stopDrag()
    callbacks.onEnd?.(
      createDragEvent(sourceEvent, session, session.lastResolvedPositions, false, true),
    )
  }

  return {
    handlePointerDown,
    profileDrag,
    destroy,
  }
}

function createDragSession({
  activeNodeId,
  canvasEngine,
  clientStart,
  getCanvasPosition,
  inputType,
  selectedNodeIds,
}: {
  activeNodeId: string
  canvasEngine: CanvasEngine
  clientStart: CanvasPosition
  getCanvasPosition: (point: CanvasPosition) => CanvasPosition
  inputType: CanvasDragSession['inputType']
  selectedNodeIds: ReadonlySet<string>
}): CanvasDragSession | null {
  const snapshot = canvasEngine.getSnapshot()
  const draggedNodeIds = selectedNodeIds.has(activeNodeId)
    ? new Set(selectedNodeIds)
    : new Set([activeNodeId])
  const draggedNodes = Array.from(
    draggedNodeIds,
    (nodeId) => snapshot.nodeLookup.get(nodeId)?.node,
  ).filter((node): node is CanvasNode => Boolean(node))

  if (draggedNodes.length === 0) {
    return null
  }

  const startPositions = new Map(draggedNodes.map((node) => [node.id, node.position]))
  const nodeBounds = new Map(
    draggedNodes.flatMap((node) => {
      const bounds = getCanvasNodeBounds(node)
      return bounds ? [[node.id, bounds] as const] : []
    }),
  )
  const targetBounds = snapshot.nodes
    .filter((node) => node.type !== 'stroke' && !draggedNodeIds.has(node.id))
    .flatMap((node) => {
      const bounds = getCanvasNodeBounds(node)
      return bounds ? [bounds] : []
    })

  return {
    activeNodeId,
    draggedNodeIds,
    startPointer: getCanvasPosition(clientStart),
    pendingClientStart: clientStart,
    startPositions,
    nodeBounds,
    targetBounds,
    lastResolvedPositions: startPositions,
    started: false,
    inputType,
  }
}

function resolveDragPositions({
  canvasEngine,
  getCanvasPosition,
  getPrimaryPressed,
  getShiftPressed,
  getZoom,
  pointer,
  session,
}: {
  canvasEngine: CanvasEngine
  getCanvasPosition: (point: CanvasPosition) => CanvasPosition
  getPrimaryPressed: () => boolean
  getShiftPressed: () => boolean
  getZoom: () => number
  pointer: CanvasPosition
  session: CanvasDragSession
}) {
  const currentPointer = getCanvasPosition(pointer)
  const constrainedPointer = getShiftPressed()
    ? constrainPointToAxis(session.startPointer, currentPointer)
    : currentPointer
  const delta = {
    x: constrainedPointer.x - session.startPointer.x,
    y: constrainedPointer.y - session.startPointer.y,
  }
  const resolvedPositions = new Map<string, CanvasPosition>()

  for (const [nodeId, startPosition] of session.startPositions) {
    resolvedPositions.set(nodeId, {
      x: startPosition.x + delta.x,
      y: startPosition.y + delta.y,
    })
  }

  if (getPrimaryPressed() && session.targetBounds.length > 0) {
    const draggedBounds = Array.from(resolvedPositions).flatMap(([nodeId, position]) => {
      const bounds = session.nodeBounds.get(nodeId)
      return bounds ? [withBoundsPosition(bounds, position)] : []
    })
    const snap = resolveCanvasDragSnap({
      draggedBounds,
      targetBounds: session.targetBounds,
      threshold: getSnapThresholdForZoom(getZoom()),
    })
    if (snap.guides.length > 0) {
      setCanvasDragSnapGuides(snap.guides)
    } else {
      clearCanvasDragSnapGuides()
    }

    for (const [nodeId, position] of resolvedPositions) {
      resolvedPositions.set(nodeId, {
        x: position.x + snap.xAdjustment,
        y: position.y + snap.yAdjustment,
      })
    }
  } else {
    clearCanvasDragSnapGuides()
  }

  const existingIds = new Set(canvasEngine.getSnapshot().nodeLookup.keys())
  for (const nodeId of resolvedPositions.keys()) {
    if (!existingIds.has(nodeId)) {
      resolvedPositions.delete(nodeId)
    }
  }

  return resolvedPositions
}

function createDragEvent(
  sourceEvent: PointerEvent | MouseEvent,
  session: CanvasDragSession,
  resolvedPositions: ReadonlyMap<string, CanvasPosition>,
  useStartPositions: boolean,
  final: boolean,
): CanvasDragEvent {
  const firstPosition = useStartPositions
    ? session.startPositions.get(session.activeNodeId)
    : resolvedPositions.get(session.activeNodeId)
  const startPosition = session.startPositions.get(session.activeNodeId) ?? { x: 0, y: 0 }
  const delta = firstPosition
    ? { x: firstPosition.x - startPosition.x, y: firstPosition.y - startPosition.y }
    : { x: 0, y: 0 }

  return {
    sourceEvent,
    activeNodeId: session.activeNodeId,
    draggedNodeIds: session.draggedNodeIds,
    startPositions: session.startPositions,
    resolvedPositions,
    delta,
    final,
  }
}

function shouldIgnoreDragTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        '.canvas-node-connection-handle, .canvas-node-resize-handle, input, textarea, select, button, a',
      ),
    )
  )
}
