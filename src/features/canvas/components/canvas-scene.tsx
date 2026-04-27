import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CanvasAwarenessHost } from './canvas-awareness-host'
import { CanvasBackground } from './canvas-background'
import { CanvasConnectionLayer } from './canvas-connection-layer'
import type { CanvasConnectionDraft } from './canvas-connection-layer-geometry'
import { CanvasEdgeRenderer } from './canvas-edge-renderer'
import { CanvasLocalOverlaysHost } from './canvas-local-overlays-host'
import { CanvasNodeContent } from './canvas-node-content'
import { CanvasNodeRenderer } from './canvas-node-renderer'
import { CanvasPendingSelectionPreviewOverlay } from './canvas-pending-selection-preview-overlay'
import { CanvasSelectionResizeOverlay } from './canvas-selection-resize-overlay'
import { CanvasNodeResizeMetadataProvider } from '../nodes/shared/canvas-node-resize-metadata-provider'
import { isCanvasEmptyPaneTarget } from '../runtime/interaction/canvas-pane-targets'
import { useCanvasEngine } from '../react/use-canvas-engine'
import { useCanvasRuntime } from '../runtime/providers/canvas-runtime'
import type { CanvasEngine } from '../system/canvas-engine'
import type {
  CanvasConnection,
  CanvasEdge,
  CanvasHandlePosition,
  CanvasNode,
} from '../types/canvas-domain-types'
import type { RemoteUser } from '../utils/canvas-awareness-types'
import { CANVAS_HANDLE_POSITION } from '~/features/canvas/types/canvas-domain-types'
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from 'react'

const CONNECTION_HANDLE_SNAP_RADIUS = 20
const CONNECTION_HANDLE_SNAP_INTERVAL_MS = 50

type CanvasSceneHandlers = {
  createEdgeFromConnection: (connection: CanvasConnection) => void
  onNodeClick?: (event: ReactMouseEvent, node: CanvasNode) => void
  onEdgeClick?: (event: ReactMouseEvent, edge: CanvasEdge) => void
  onMouseMove?: (event: ReactMouseEvent) => void
  onMouseLeave?: () => void
}

interface CanvasSceneProps {
  canEdit: boolean
  remoteUsers: Array<RemoteUser>
  sceneHandlers: CanvasSceneHandlers
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasNode) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasEdge) => void
  onPaneContextMenu: (event: ReactMouseEvent) => void
}

export function CanvasScene({
  canEdit,
  remoteUsers,
  sceneHandlers,
  onNodeContextMenu,
  onEdgeContextMenu,
  onPaneContextMenu,
}: CanvasSceneProps) {
  const canvasEngine = useCanvasEngine()
  const { domRuntime } = useCanvasRuntime()
  const paneRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const sceneHandlersRef = useRef(sceneHandlers)
  const nodeHandlersRef = useRef({
    onNodeClick: sceneHandlers.onNodeClick,
    onNodeContextMenu,
  })
  const edgeHandlersRef = useRef({
    onEdgeClick: sceneHandlers.onEdgeClick,
    onEdgeContextMenu,
  })
  const connectionDraftRef = useRef<CanvasConnectionDraft | null>(null)
  const connectionPointerUpRef = useRef<(event: PointerEvent) => void>(() => undefined)
  const connectionPointerCancelRef = useRef<() => void>(() => undefined)
  const connectionSnapStateRef = useRef({ lastResolvedAt: 0 })
  const [connectionDraft, setConnectionDraft] = useState<CanvasConnectionDraft | null>(null)
  const isDraggingConnection = connectionDraft !== null

  useLayoutEffect(() => {
    sceneHandlersRef.current = sceneHandlers
    nodeHandlersRef.current = {
      onNodeClick: sceneHandlers.onNodeClick,
      onNodeContextMenu,
    }
    edgeHandlersRef.current = {
      onEdgeClick: sceneHandlers.onEdgeClick,
      onEdgeContextMenu,
    }
  }, [onEdgeContextMenu, onNodeContextMenu, sceneHandlers])
  const handleNodeClick = useCallback((event: ReactMouseEvent, node: CanvasNode) => {
    nodeHandlersRef.current.onNodeClick?.(event, node)
  }, [])
  const handleNodeContextMenu = useCallback((event: ReactMouseEvent, node: CanvasNode) => {
    nodeHandlersRef.current.onNodeContextMenu(event, node)
  }, [])
  const handleEdgeClick = useCallback((event: ReactMouseEvent, edge: CanvasEdge) => {
    edgeHandlersRef.current.onEdgeClick?.(event, edge)
  }, [])
  const handleEdgeContextMenu = useCallback((event: ReactMouseEvent, edge: CanvasEdge) => {
    edgeHandlersRef.current.onEdgeContextMenu(event, edge)
  }, [])

  useEffect(() => {
    const unregister = domRuntime.registerViewportElement(viewportRef.current)
    domRuntime.scheduleViewportTransform(canvasEngine.getSnapshot().viewport)
    domRuntime.scheduleCameraState(canvasEngine.getSnapshot().cameraState)
    domRuntime.flushRenderScheduler()
    return unregister
  }, [canvasEngine, domRuntime])

  const handleConnectionPointerMove = useCallback(
    (event: PointerEvent) => {
      updateConnectionDraftPosition({
        canvasEngine,
        connectionDraftRef,
        connectionSnapStateRef,
        paneRef,
        event,
        setConnectionDraft,
      })
    },
    [canvasEngine],
  )

  const handleConnectionPointerUp = useCallback(
    (event: PointerEvent) => {
      window.removeEventListener('pointercancel', connectionPointerCancelRef.current)
      finishConnectionDraft({
        canvasEngine,
        connectionDraftRef,
        connectionSnapStateRef,
        event,
        paneRef,
        setConnectionDraft,
        createEdgeFromConnection: sceneHandlersRef.current.createEdgeFromConnection,
      })
    },
    [canvasEngine],
  )

  const handleConnectionPointerCancel = useCallback(() => {
    window.removeEventListener('pointerup', connectionPointerUpRef.current)
    cancelConnectionDraft({ connectionDraftRef, connectionSnapStateRef, setConnectionDraft })
  }, [])

  useEffect(() => {
    if (!isDraggingConnection) {
      return undefined
    }

    const pointerUpHandler = handleConnectionPointerUp
    const pointerCancelHandler = handleConnectionPointerCancel
    connectionPointerUpRef.current = pointerUpHandler
    connectionPointerCancelRef.current = pointerCancelHandler
    window.addEventListener('pointermove', handleConnectionPointerMove)
    window.addEventListener('pointerup', pointerUpHandler, { once: true })
    window.addEventListener('pointercancel', pointerCancelHandler, { once: true })
    return () => {
      window.removeEventListener('pointermove', handleConnectionPointerMove)
      window.removeEventListener('pointerup', pointerUpHandler)
      window.removeEventListener('pointercancel', pointerCancelHandler)
    }
  }, [
    handleConnectionPointerCancel,
    handleConnectionPointerMove,
    handleConnectionPointerUp,
    isDraggingConnection,
  ])

  const handlePointerDownCapture = (event: ReactPointerEvent) => {
    if (!canEdit || event.button !== 0) {
      return
    }

    const handle = resolveConnectionHandle(event.target)
    if (!handle) {
      return
    }
    if (!handle.nodeId) {
      return
    }
    if (!handle.position) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const rect = handle.element.getBoundingClientRect()
    const start = canvasEngine.screenToCanvasPosition(
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      paneRef.current?.getBoundingClientRect() ?? null,
    )
    const draft = {
      source: {
        nodeId: handle.nodeId,
        handleId: handle.handleId,
        position: handle.position,
        point: start,
      },
      current: start,
      snapTarget: null,
    }
    connectionDraftRef.current = draft
    connectionSnapStateRef.current.lastResolvedAt = 0
    setConnectionDraft(draft)
  }

  const handlePaneKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === ' ') {
      event.preventDefault()
      return
    }

    if ((event.key === 'Escape' || event.key === 'Esc') && connectionDraftRef.current) {
      event.preventDefault()
      event.stopPropagation()
      cancelConnectionDraft({ connectionDraftRef, connectionSnapStateRef, setConnectionDraft })
    }
  }

  return (
    <div
      ref={paneRef}
      className="canvas-scene absolute inset-0 touch-none select-none overflow-hidden bg-background"
      data-canvas-pane="true"
      data-testid="canvas-scene"
      role="application"
      aria-label="Canvas"
      tabIndex={-1}
      onContextMenu={(event) => {
        if (isCanvasEmptyPaneTarget(event.target, paneRef.current)) {
          onPaneContextMenu(event)
        }
      }}
      onMouseMove={sceneHandlers.onMouseMove}
      onMouseLeave={sceneHandlers.onMouseLeave}
      onKeyDown={handlePaneKeyDown}
      onPointerDownCapture={handlePointerDownCapture}
    >
      <CanvasBackground />
      <CanvasNodeResizeMetadataProvider>
        <div
          ref={viewportRef}
          data-canvas-viewport="true"
          className="canvas-scene__viewport absolute left-0 top-0 h-full w-full"
          style={{
            backfaceVisibility: 'hidden',
            transformOrigin: '0 0',
          }}
        >
          <svg
            className="canvas-edge-layer pointer-events-none absolute left-0 top-0 overflow-visible"
            data-canvas-edge-layer="true"
            width="1"
            height="1"
          >
            <CanvasEdgeRenderer
              onEdgeClick={handleEdgeClick}
              onEdgeContextMenu={handleEdgeContextMenu}
            />
            <CanvasConnectionLayer draft={connectionDraft} />
          </svg>
          <CanvasNodeRenderer
            onNodeClick={handleNodeClick}
            onNodeContextMenu={handleNodeContextMenu}
            NodeContentComponent={CanvasNodeContent}
          />
        </div>
        <CanvasPendingSelectionPreviewOverlay />
        <CanvasSelectionResizeOverlay />
      </CanvasNodeResizeMetadataProvider>
      <CanvasLocalOverlaysHost />
      <CanvasAwarenessHost remoteUsers={remoteUsers} />
    </div>
  )
}

function resolveConnectionHandle(target: EventTarget | null) {
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

function updateConnectionDraftPosition({
  canvasEngine,
  connectionDraftRef,
  connectionSnapStateRef,
  paneRef,
  event,
  setConnectionDraft,
}: {
  canvasEngine: CanvasEngine
  connectionDraftRef: RefObject<CanvasConnectionDraft | null>
  connectionSnapStateRef: RefObject<{ lastResolvedAt: number }>
  paneRef: RefObject<HTMLDivElement | null>
  event: PointerEvent
  setConnectionDraft: Dispatch<SetStateAction<CanvasConnectionDraft | null>>
}) {
  const draft = connectionDraftRef.current
  if (!draft) {
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
  setConnectionDraft(nextDraft)
}

function finishConnectionDraft({
  canvasEngine,
  connectionDraftRef,
  connectionSnapStateRef,
  event,
  paneRef,
  setConnectionDraft,
  createEdgeFromConnection,
}: {
  canvasEngine: CanvasEngine
  connectionDraftRef: RefObject<CanvasConnectionDraft | null>
  connectionSnapStateRef: RefObject<{ lastResolvedAt: number }>
  event: PointerEvent
  paneRef: RefObject<HTMLDivElement | null>
  setConnectionDraft: Dispatch<SetStateAction<CanvasConnectionDraft | null>>
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
  setConnectionDraft(null)

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

function resolveConnectionSnapTarget({
  canvasEngine,
  event,
  paneRef,
  source,
}: {
  canvasEngine: CanvasEngine
  event: PointerEvent
  paneRef: RefObject<HTMLDivElement | null>
  source: CanvasConnectionDraft['source']
}): CanvasConnectionDraft['snapTarget'] {
  const root = paneRef.current ?? document
  const handles = root.querySelectorAll('[data-canvas-node-handle="true"]')
  let closest: CanvasConnectionDraft['snapTarget'] = null
  let closestDistance = Number.POSITIVE_INFINITY

  for (const element of handles) {
    if (!(element instanceof HTMLElement)) {
      continue
    }

    const handle = resolveConnectionHandle(element)
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

function cancelConnectionDraft({
  connectionDraftRef,
  connectionSnapStateRef,
  setConnectionDraft,
}: {
  connectionDraftRef: RefObject<CanvasConnectionDraft | null>
  connectionSnapStateRef: RefObject<{ lastResolvedAt: number }>
  setConnectionDraft: Dispatch<SetStateAction<CanvasConnectionDraft | null>>
}) {
  connectionDraftRef.current = null
  connectionSnapStateRef.current.lastResolvedAt = 0
  setConnectionDraft(null)
}
