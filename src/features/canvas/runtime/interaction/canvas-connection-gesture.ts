import { useCallback, useEffect, useRef, useState } from 'react'
import { CANVAS_HANDLE_POSITION } from '../../types/canvas-domain-types'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasConnection, CanvasHandlePosition } from '../../types/canvas-domain-types'
import type {
  CanvasConnectionDraft,
  CanvasConnectionDraftEndpoint,
} from './canvas-connection-gesture-types'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'

const CONNECTION_HANDLE_SNAP_RADIUS = 20
const CONNECTION_HANDLE_SNAP_INTERVAL_MS = 50

interface CanvasConnectionGestureOptions {
  canEdit: boolean
  canvasEngine: CanvasEngine
  paneRef: RefObject<HTMLDivElement | null>
  createEdgeFromConnection: (connection: CanvasConnection) => void
}

export function useCanvasConnectionGesture({
  canEdit,
  canvasEngine,
  paneRef,
  createEdgeFromConnection,
}: CanvasConnectionGestureOptions) {
  const connectionDraftRef = useRef<CanvasConnectionDraft | null>(null)
  const connectionSnapStateRef = useRef({ lastResolvedAt: 0 })
  const pointerUpRef = useRef<(event: PointerEvent) => void>(() => undefined)
  const pointerCancelRef = useRef<(event: PointerEvent) => void>(() => undefined)
  const createEdgeRef = useRef(createEdgeFromConnection)
  const [draft, setDraft] = useState<CanvasConnectionDraft | null>(null)
  const isDragging = draft !== null
  createEdgeRef.current = createEdgeFromConnection

  const cancel = useCallback(() => {
    connectionDraftRef.current = null
    connectionSnapStateRef.current.lastResolvedAt = 0
    setDraft(null)
  }, [])

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      updateConnectionDraftPosition({
        canvasEngine,
        connectionDraftRef,
        connectionSnapStateRef,
        paneRef,
        event,
        setDraft,
      })
    },
    [canvasEngine, paneRef],
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      const activeDraft = connectionDraftRef.current
      if (!activeDraft || event.pointerId !== activeDraft.pointerId) {
        return
      }

      window.removeEventListener('pointerup', pointerUpRef.current)
      window.removeEventListener('pointercancel', pointerCancelRef.current)
      finishConnectionDraft({
        canvasEngine,
        connectionDraftRef,
        connectionSnapStateRef,
        event,
        paneRef,
        setDraft,
        createEdgeFromConnection: createEdgeRef.current,
      })
    },
    [canvasEngine, paneRef],
  )

  const handlePointerCancel = useCallback(
    (event: PointerEvent) => {
      const activeDraft = connectionDraftRef.current
      if (!activeDraft || event.pointerId !== activeDraft.pointerId) {
        return
      }

      window.removeEventListener('pointerup', pointerUpRef.current)
      window.removeEventListener('pointercancel', pointerCancelRef.current)
      cancel()
    },
    [cancel],
  )

  useEffect(() => {
    if (!isDragging) {
      return undefined
    }

    pointerUpRef.current = handlePointerUp
    pointerCancelRef.current = handlePointerCancel
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [handlePointerCancel, handlePointerMove, handlePointerUp, isDragging])

  const onPointerDownCapture = useCallback(
    (event: ReactPointerEvent) => {
      if (!canEdit || event.button !== 0) {
        return
      }

      const handle = resolveCanvasConnectionHandle(event.target)
      if (!handle?.nodeId || !handle.position) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      const rect = handle.element.getBoundingClientRect()
      const start = screenToCanvasPosition(canvasEngine, paneRef, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
      const nextDraft = {
        pointerId: event.pointerId,
        source: {
          nodeId: handle.nodeId,
          handleId: handle.handleId,
          position: handle.position,
          point: start,
        },
        current: start,
        snapTarget: null,
      }
      connectionDraftRef.current = nextDraft
      connectionSnapStateRef.current.lastResolvedAt = 0
      setDraft(nextDraft)
    },
    [canEdit, canvasEngine, paneRef],
  )

  const onEscapeKeyDown = useCallback(
    (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
      if ((event.key !== 'Escape' && event.key !== 'Esc') || !connectionDraftRef.current) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      cancel()
    },
    [cancel],
  )

  return {
    draft,
    onPointerDownCapture,
    onEscapeKeyDown,
  }
}

function resolveCanvasConnectionHandle(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  const element = target.closest('[data-canvas-node-handle="true"]')
  if (!(element instanceof HTMLElement)) {
    return null
  }

  const nodeElement = element.closest('[data-node-id]')
  if (!(nodeElement instanceof HTMLElement)) {
    return null
  }

  return {
    element,
    nodeId: nodeElement.dataset.nodeId ?? null,
    handleId: element.dataset.handleId ?? null,
    position: parseConnectionHandlePosition(element.dataset.handlePosition),
  }
}

function resolveConnectionSnapTarget({
  canvasEngine,
  event,
  paneRef,
  source,
}: {
  canvasEngine: CanvasEngine
  event: PointerEvent
  paneRef: RefObject<HTMLDivElement | null>
  source: CanvasConnectionDraftEndpoint
}): CanvasConnectionDraftEndpoint | null {
  const root = paneRef.current ?? document
  const handles = root.querySelectorAll('[data-canvas-node-handle="true"]')
  let closest: CanvasConnectionDraftEndpoint | null = null
  let closestDistance = Number.POSITIVE_INFINITY

  for (const element of handles) {
    if (!(element instanceof HTMLElement)) {
      continue
    }

    const handle = resolveCanvasConnectionHandle(element)
    if (!handle || !handle.nodeId || handle.nodeId === source.nodeId || !handle.position) {
      continue
    }

    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      continue
    }

    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    const distance = Math.hypot(center.x - event.clientX, center.y - event.clientY)
    if (distance > CONNECTION_HANDLE_SNAP_RADIUS || distance >= closestDistance) {
      continue
    }

    closestDistance = distance
    closest = {
      nodeId: handle.nodeId,
      handleId: handle.handleId,
      position: handle.position,
      point: screenToCanvasPosition(canvasEngine, paneRef, center),
    }
  }

  return closest
}

function updateConnectionDraftPosition({
  canvasEngine,
  connectionDraftRef,
  connectionSnapStateRef,
  paneRef,
  event,
  setDraft,
}: {
  canvasEngine: CanvasEngine
  connectionDraftRef: RefObject<CanvasConnectionDraft | null>
  connectionSnapStateRef: RefObject<{ lastResolvedAt: number }>
  paneRef: RefObject<HTMLDivElement | null>
  event: PointerEvent
  setDraft: (draft: CanvasConnectionDraft | null) => void
}) {
  const draft = connectionDraftRef.current
  if (!draft || event.pointerId !== draft.pointerId) {
    return
  }

  const now = event.timeStamp > 0 ? event.timeStamp : performance.now()
  const shouldResolveSnapTarget =
    connectionSnapStateRef.current.lastResolvedAt === 0 ||
    now - connectionSnapStateRef.current.lastResolvedAt >= CONNECTION_HANDLE_SNAP_INTERVAL_MS
  const snapTarget = shouldResolveSnapTarget
    ? resolveConnectionSnapTarget({
        canvasEngine,
        event,
        paneRef,
        source: draft.source,
      })
    : draft.snapTarget
  if (shouldResolveSnapTarget) {
    connectionSnapStateRef.current.lastResolvedAt = now
  }

  const nextDraft = {
    ...draft,
    current: screenToCanvasPosition(canvasEngine, paneRef, { x: event.clientX, y: event.clientY }),
    snapTarget,
  }
  connectionDraftRef.current = nextDraft
  setDraft(nextDraft)
}

function finishConnectionDraft({
  canvasEngine,
  connectionDraftRef,
  connectionSnapStateRef,
  event,
  paneRef,
  setDraft,
  createEdgeFromConnection,
}: {
  canvasEngine: CanvasEngine
  connectionDraftRef: RefObject<CanvasConnectionDraft | null>
  connectionSnapStateRef: RefObject<{ lastResolvedAt: number }>
  event: PointerEvent
  paneRef: RefObject<HTMLDivElement | null>
  setDraft: (draft: CanvasConnectionDraft | null) => void
  createEdgeFromConnection: (connection: CanvasConnection) => void
}) {
  const draft = connectionDraftRef.current
  const snapTarget = draft
    ? resolveConnectionSnapTarget({
        canvasEngine,
        event,
        paneRef,
        source: draft.source,
      })
    : null
  connectionDraftRef.current = null
  connectionSnapStateRef.current.lastResolvedAt = 0
  setDraft(null)

  if (draft && snapTarget) {
    createEdgeFromConnection({
      source: draft.source.nodeId,
      target: snapTarget.nodeId,
      sourceHandle: draft.source.handleId,
      targetHandle: snapTarget.handleId,
    })
  }
}

function screenToCanvasPosition(
  canvasEngine: CanvasEngine,
  paneRef: RefObject<HTMLDivElement | null>,
  point: { x: number; y: number },
) {
  return canvasEngine.screenToCanvasPosition(
    point,
    paneRef.current?.getBoundingClientRect() ?? null,
  )
}

function parseConnectionHandlePosition(value: string | undefined): CanvasHandlePosition | null {
  switch (value) {
    case CANVAS_HANDLE_POSITION.Top:
      return CANVAS_HANDLE_POSITION.Top
    case CANVAS_HANDLE_POSITION.Right:
      return CANVAS_HANDLE_POSITION.Right
    case CANVAS_HANDLE_POSITION.Bottom:
      return CANVAS_HANDLE_POSITION.Bottom
    case CANVAS_HANDLE_POSITION.Left:
      return CANVAS_HANDLE_POSITION.Left
    default:
      return null
  }
}
