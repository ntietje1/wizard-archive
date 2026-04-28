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
import type { CanvasDocumentNode, CanvasPosition } from '../types/canvas-domain-types'

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
  onCancel?: (event: CanvasDragEvent) => void
}

export interface CanvasDragController {
  begin: (nodeId: string, event: PointerEvent | MouseEvent) => boolean
  update: (event: PointerEvent | MouseEvent) => boolean
  commit: (event: PointerEvent | MouseEvent) => boolean
  cancel: (event: PointerEvent | MouseEvent) => boolean
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
  existingNodeIds: ReadonlySet<string>
  started: boolean
  pointerId: number | null
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
    clearCanvasDragSnapGuides()
    session = null
  }

  const begin: CanvasDragController['begin'] = (nodeId, event) => {
    if (session) {
      return false
    }

    if (event.button !== 0 || !getCanStartDrag() || shouldIgnoreDragTarget(event.target)) {
      return false
    }

    const nextSession = createDragSession({
      activeNodeId: nodeId,
      canvasEngine,
      clientStart: { x: event.clientX, y: event.clientY },
      getCanvasPosition,
      pointerId: getPointerId(event),
      selectedNodeIds: getSelectedNodeIds(),
    })
    if (!nextSession) {
      return false
    }

    session = nextSession
    return true
  }

  const profileDrag: CanvasDragController['profileDrag'] = ({ nodeIds, delta, steps }) => {
    const activeNodeId = nodeIds.values().next().value
    if (!activeNodeId || steps <= 0) {
      return
    }

    const start = { x: 100, y: 100 }
    const syntheticSession = createDragSession({
      activeNodeId,
      canvasEngine,
      clientStart: start,
      getCanvasPosition,
      pointerId: null,
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

  const update: CanvasDragController['update'] = (event) => {
    if (!session || !isSessionEvent(session, event)) {
      return false
    }

    if (!session.started) {
      const distance = Math.hypot(
        event.clientX - session.pendingClientStart.x,
        event.clientY - session.pendingClientStart.y,
      )
      if (distance < thresholdPx) {
        return true
      }
      startSession(event)
    }

    updateSession(event)
    event.preventDefault()
    return true
  }

  const commit: CanvasDragController['commit'] = (event) => {
    if (!session || !isSessionEvent(session, event)) {
      return false
    }

    if (session.started) {
      endSession(event)
    }

    destroy()
    return true
  }

  const cancel: CanvasDragController['cancel'] = (event) => {
    if (!session || !isSessionEvent(session, event)) {
      return false
    }

    if (session.started) {
      canvasEngine.updateDrag(session.startPositions)
      canvasEngine.stopDrag()
      callbacks.onCancel?.(createDragEvent(event, session, session.startPositions, false, false))
    }

    destroy()
    return true
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
    begin,
    update,
    commit,
    cancel,
    profileDrag,
    destroy,
  }
}

function createDragSession({
  activeNodeId,
  canvasEngine,
  clientStart,
  getCanvasPosition,
  pointerId,
  selectedNodeIds,
}: {
  activeNodeId: string
  canvasEngine: CanvasEngine
  clientStart: CanvasPosition
  getCanvasPosition: (point: CanvasPosition) => CanvasPosition
  pointerId: number | null
  selectedNodeIds: ReadonlySet<string>
}): CanvasDragSession | null {
  const snapshot = canvasEngine.getSnapshot()
  const draggedNodeIds = selectedNodeIds.has(activeNodeId)
    ? new Set(selectedNodeIds)
    : new Set([activeNodeId])
  const draggedNodes = Array.from(
    draggedNodeIds,
    (nodeId) => snapshot.nodeLookup.get(nodeId)?.node,
  ).filter((node): node is CanvasDocumentNode => Boolean(node))

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
    existingNodeIds: new Set(snapshot.nodeLookup.keys()),
    started: false,
    pointerId,
  }
}

function getPointerId(event: PointerEvent | MouseEvent) {
  return 'pointerId' in event ? event.pointerId : null
}

function isSessionEvent(session: CanvasDragSession, event: PointerEvent | MouseEvent) {
  return session.pointerId === null || getPointerId(event) === session.pointerId
}

function resolveDragPositions({
  getCanvasPosition,
  getPrimaryPressed,
  getShiftPressed,
  getZoom,
  pointer,
  session,
}: {
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

  for (const nodeId of resolvedPositions.keys()) {
    if (!session.existingNodeIds.has(nodeId)) {
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
        '.canvas-node-connection-handle, .canvas-selection-resize-zone, input, textarea, select, button, a',
      ),
    )
  )
}
