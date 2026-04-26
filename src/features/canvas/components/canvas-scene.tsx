import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasAwarenessHost } from './canvas-awareness-host'
import { CanvasBackground } from './canvas-background'
import { CanvasConnectionLayer } from './canvas-connection-layer'
import type { CanvasConnectionDraft } from './canvas-connection-layer'
import { CanvasEdgeRenderer } from './canvas-edge-renderer'
import { CanvasLocalOverlaysHost } from './canvas-local-overlays-host'
import { CanvasMiniMap } from './canvas-minimap'
import { CanvasNodeRenderer } from './canvas-node-renderer'
import { isCanvasEmptyPaneTarget } from '../runtime/interaction/canvas-pane-targets'
import { useCanvasEngine } from '../react/use-canvas-engine'
import type { CanvasEngine } from '../system/canvas-engine'
import type { RemoteUser } from '../utils/canvas-awareness-types'
import type { Connection, Edge, Node } from '@xyflow/react'
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from 'react'

type CanvasSceneHandlers = {
  createEdgeFromConnection: (connection: Connection) => void
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void
  onMouseMove?: (event: ReactMouseEvent) => void
  onMouseLeave?: () => void
}

interface CanvasSceneProps {
  canEdit: boolean
  remoteUsers: Array<RemoteUser>
  sceneHandlers: CanvasSceneHandlers
  onNodeContextMenu: (event: ReactMouseEvent, node: Node) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: Edge) => void
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
  const [connectionDraft, setConnectionDraft] = useState<CanvasConnectionDraft | null>(null)
  const isDraggingConnection = connectionDraft !== null
  sceneHandlersRef.current = sceneHandlers
  nodeHandlersRef.current = {
    onNodeClick: sceneHandlers.onNodeClick,
    onNodeContextMenu,
  }
  edgeHandlersRef.current = {
    onEdgeClick: sceneHandlers.onEdgeClick,
    onEdgeContextMenu,
  }
  const handleNodeClick = useCallback((event: ReactMouseEvent, node: Node) => {
    nodeHandlersRef.current.onNodeClick?.(event, node)
  }, [])
  const handleNodeContextMenu = useCallback((event: ReactMouseEvent, node: Node) => {
    nodeHandlersRef.current.onNodeContextMenu(event, node)
  }, [])
  const handleEdgeClick = useCallback((event: ReactMouseEvent, edge: Edge) => {
    edgeHandlersRef.current.onEdgeClick?.(event, edge)
  }, [])
  const handleEdgeContextMenu = useCallback((event: ReactMouseEvent, edge: Edge) => {
    edgeHandlersRef.current.onEdgeContextMenu(event, edge)
  }, [])

  useEffect(() => {
    const unregister = canvasEngine.registerViewportElement(viewportRef.current)
    canvasEngine.scheduleViewportTransform(canvasEngine.getSnapshot().viewport)
    canvasEngine.scheduleCameraState(canvasEngine.getSnapshot().cameraState)
    canvasEngine.flushRenderScheduler()
    return unregister
  }, [canvasEngine])

  const handleConnectionPointerMove = useCallback(
    (event: PointerEvent) => {
      updateConnectionDraftPosition({
        canvasEngine,
        connectionDraftRef,
        paneRef,
        event,
        setConnectionDraft,
      })
    },
    [canvasEngine],
  )

  const handleConnectionPointerUp = useCallback((event: PointerEvent) => {
    finishConnectionDraft({
      connectionDraftRef,
      event,
      setConnectionDraft,
      createEdgeFromConnection: sceneHandlersRef.current.createEdgeFromConnection,
    })
  }, [])

  const handleConnectionPointerCancel = useCallback(() => {
    connectionDraftRef.current = null
    setConnectionDraft(null)
  }, [])

  useEffect(() => {
    if (!isDraggingConnection) {
      return undefined
    }

    window.addEventListener('pointermove', handleConnectionPointerMove)
    window.addEventListener('pointerup', handleConnectionPointerUp, { once: true })
    window.addEventListener('pointercancel', handleConnectionPointerCancel, { once: true })
    return () => {
      window.removeEventListener('pointermove', handleConnectionPointerMove)
      window.removeEventListener('pointerup', handleConnectionPointerUp)
      window.removeEventListener('pointercancel', handleConnectionPointerCancel)
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

    event.preventDefault()
    event.stopPropagation()
    const rect = handle.element.getBoundingClientRect()
    const start = canvasEngine.screenToCanvasPosition(
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      paneRef.current?.getBoundingClientRect() ?? null,
    )
    const draft = {
      source: handle.nodeId,
      sourceHandle: handle.handleId,
      start,
      current: start,
    }
    connectionDraftRef.current = draft
    setConnectionDraft(draft)
  }

  const handlePaneKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === ' ') {
      event.preventDefault()
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
        />
      </div>
      <CanvasLocalOverlaysHost />
      <CanvasAwarenessHost remoteUsers={remoteUsers} />
      <CanvasMiniMap />
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
    nodeId: nodeElement.dataset.nodeId ?? '',
    handleId: element.dataset.handleId ?? null,
  }
}

function updateConnectionDraftPosition({
  canvasEngine,
  connectionDraftRef,
  paneRef,
  event,
  setConnectionDraft,
}: {
  canvasEngine: CanvasEngine
  connectionDraftRef: RefObject<CanvasConnectionDraft | null>
  paneRef: RefObject<HTMLDivElement | null>
  event: PointerEvent
  setConnectionDraft: Dispatch<SetStateAction<CanvasConnectionDraft | null>>
}) {
  const draft = connectionDraftRef.current
  if (!draft) {
    return
  }

  const nextDraft = {
    ...draft,
    current: canvasEngine.screenToCanvasPosition(
      { x: event.clientX, y: event.clientY },
      paneRef.current?.getBoundingClientRect() ?? null,
    ),
  }
  connectionDraftRef.current = nextDraft
  setConnectionDraft(nextDraft)
}

function finishConnectionDraft({
  connectionDraftRef,
  event,
  setConnectionDraft,
  createEdgeFromConnection,
}: {
  connectionDraftRef: RefObject<CanvasConnectionDraft | null>
  event: PointerEvent
  setConnectionDraft: Dispatch<SetStateAction<CanvasConnectionDraft | null>>
  createEdgeFromConnection: (connection: Connection) => void
}) {
  const target = document.elementFromPoint(event.clientX, event.clientY)
  const targetHandle = resolveConnectionHandle(target)
  const draft = connectionDraftRef.current
  connectionDraftRef.current = null
  setConnectionDraft(null)

  if (draft && targetHandle && targetHandle.nodeId !== draft.source) {
    createEdgeFromConnection({
      source: draft.source,
      target: targetHandle.nodeId,
      sourceHandle: draft.sourceHandle,
      targetHandle: targetHandle.handleId,
    })
  }
}
