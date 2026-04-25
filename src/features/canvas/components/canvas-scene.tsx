import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '~/features/shadcn/lib/utils'
import { BezierCanvasEdge } from '../edges/bezier/bezier-canvas-edge'
import type { CanvasEdgeType } from '../edges/canvas-edge-types'
import { StepCanvasEdge } from '../edges/step/step-canvas-edge'
import { StraightCanvasEdge } from '../edges/straight/straight-canvas-edge'
import { TextNode } from '../nodes/text/text-node'
import { EmbedNode } from '../nodes/embed/embed-node'
import { StrokeNode } from '../nodes/stroke/stroke-node'
import { useCanvasEngine, useCanvasEngineSelector } from '../react/use-canvas-engine'
import { CanvasAwarenessHost } from './canvas-awareness-host'
import { CanvasLocalOverlaysHost } from './canvas-local-overlays-host'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { RemoteUser } from '../utils/canvas-awareness-types'
import type { CanvasEngine, CanvasInternalNode } from '../system/canvas-engine'
import { isCanvasEmptyPaneTarget } from '../runtime/interaction/canvas-pane-targets'
import type { Connection, Edge, Node } from '@xyflow/react'
import type {
  ComponentType,
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
  onPaneClick?: (event: ReactMouseEvent) => void
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

type ConnectionDraft = {
  source: string
  sourceHandle: string | null
  start: { x: number; y: number }
  current: { x: number; y: number }
}

const NODE_RENDERERS = {
  embed: EmbedNode,
  stroke: StrokeNode,
  text: TextNode,
} as const

const EDGE_RENDERERS = {
  bezier: BezierCanvasEdge,
  straight: StraightCanvasEdge,
  step: StepCanvasEdge,
} as const
const MINIMAP_SCALE = 40
const MINIMAP_OFFSET_PERCENT = 48
const MINIMAP_MAX_PERCENT = 96
type CanvasNodeShellSnapshot = {
  id: string
  type: string | undefined
  className: string | undefined
  position: { x: number; y: number }
  width: number | undefined
  height: number | undefined
  zIndex: number
  visible: boolean
}

type CanvasNodeContentSnapshot = {
  id: string
  type: keyof typeof NODE_RENDERERS
  data: Node['data']
  dragging: boolean
  selected: boolean
  width: number | undefined
  height: number | undefined
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
  const connectionDraftRef = useRef<ConnectionDraft | null>(null)
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null)
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

  const handlePaneClick = (event: ReactMouseEvent) => {
    if (isCanvasEmptyPaneTarget(event.target, paneRef.current)) {
      sceneHandlers.onPaneClick?.(event)
    }
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
      onClick={handlePaneClick}
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
      <style>{`
        .canvas-scene__viewport[data-camera-state="moving"] .canvas-stroke-hit-target-layer,
        .canvas-scene__viewport[data-camera-state="moving"] .canvas-node-connection-handle {
          display: none;
        }

        .canvas-scene__viewport[data-camera-state="moving"] .canvas-stroke-highlight-path {
          visibility: hidden;
        }
      `}</style>
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

const CanvasNodeRenderer = memo(function CanvasNodeRenderer({
  onNodeClick,
  onNodeContextMenu,
}: {
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void
  onNodeContextMenu: (event: ReactMouseEvent, node: Node) => void
}) {
  const nodeIds = useCanvasEngineSelector((snapshot) => snapshot.nodeIds, areStringArraysEqual)
  return nodeIds.map((nodeId) => (
    <CanvasNodeWrapper
      key={nodeId}
      nodeId={nodeId}
      onNodeClick={onNodeClick}
      onNodeContextMenu={onNodeContextMenu}
    />
  ))
})

const CanvasNodeWrapper = memo(function CanvasNodeWrapper({
  nodeId,
  onNodeClick,
  onNodeContextMenu,
}: {
  nodeId: string
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void
  onNodeContextMenu: (event: ReactMouseEvent, node: Node) => void
}) {
  const shell = useCanvasEngineSelector(
    (snapshot) => selectCanvasNodeShellSnapshot(snapshot.nodeLookup.get(nodeId)),
    areCanvasNodeShellSnapshotsEqual,
  )
  const canvasEngine = useCanvasEngine()
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!shell) {
      return undefined
    }

    const nodeElement = nodeRef.current
    if (!nodeElement || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      if (nodeElement.dataset.canvasCulled === 'true') return
      if (entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return
      canvasEngine.measureNode(shell.id, {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(nodeElement)
    return () => observer.disconnect()
  }, [canvasEngine, shell])

  useEffect(() => canvasEngine.registerNodeElement(nodeId, nodeRef.current), [canvasEngine, nodeId])

  if (!shell || !shell.visible) {
    return null
  }

  const getCurrentNode = () => canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node ?? null
  const handleNodeKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
    }
  }

  return (
    <div
      ref={nodeRef}
      className={cn(
        'canvas-node-shell absolute left-0 top-0 touch-none select-none',
        shell.className,
      )}
      data-node-id={shell.id}
      data-node-type={shell.type}
      role="group"
      aria-label={`${shell.type ?? 'canvas'} node`}
      tabIndex={-1}
      style={{
        contain: 'layout style',
        transform: `translate(${shell.position.x}px, ${shell.position.y}px)`,
        width: shell.width,
        height: shell.height,
        zIndex: shell.zIndex,
        pointerEvents: 'auto',
      }}
      onClick={(event) => {
        const node = getCurrentNode()
        if (node) {
          onNodeClick?.(event, node)
        }
      }}
      onContextMenu={(event) => {
        const node = getCurrentNode()
        if (node) {
          onNodeContextMenu(event, node)
        }
      }}
      onKeyDown={handleNodeKeyDown}
    >
      <CanvasNodeContent nodeId={nodeId} />
    </div>
  )
})

const CanvasNodeContent = memo(function CanvasNodeContent({ nodeId }: { nodeId: string }) {
  const content = useCanvasEngineSelector(
    (snapshot) => selectCanvasNodeContentSnapshot(snapshot.nodeLookup.get(nodeId)),
    areCanvasNodeContentSnapshotsEqual,
  )

  if (!content) {
    return null
  }

  const Component = NODE_RENDERERS[content.type] as ComponentType<CanvasNodeComponentProps>
  return (
    <div className="canvas-node-content h-full w-full" style={{ contain: 'layout style' }}>
      <Component
        id={content.id}
        type={content.type}
        data={content.data}
        dragging={content.dragging}
        selected={content.selected}
        width={content.width}
        height={content.height}
      />
    </div>
  )
})

const CanvasEdgeRenderer = memo(function CanvasEdgeRenderer({
  onEdgeClick,
  onEdgeContextMenu,
}: {
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: Edge) => void
}) {
  const edgeIds = useCanvasEngineSelector((snapshot) => snapshot.edgeIds, areStringArraysEqual)
  return edgeIds.map((edgeId) => (
    <CanvasEdgeWrapper
      key={edgeId}
      edgeId={edgeId}
      onEdgeClick={onEdgeClick}
      onEdgeContextMenu={onEdgeContextMenu}
    />
  ))
})

const CanvasEdgeWrapper = memo(function CanvasEdgeWrapper({
  edgeId,
  onEdgeClick,
  onEdgeContextMenu,
}: {
  edgeId: string
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: Edge) => void
}) {
  const internalEdge = useCanvasEngineSelector((snapshot) => snapshot.edgeLookup.get(edgeId))
  const canvasEngine = useCanvasEngine()
  const edgeRef = useRef<SVGGElement | null>(null)

  useEffect(() => canvasEngine.registerEdgeElement(edgeId, edgeRef.current), [canvasEngine, edgeId])

  if (!internalEdge || !internalEdge.visible) {
    return null
  }

  const edge = internalEdge.edge
  const type = resolveEdgeType(edge.type)
  const Component = EDGE_RENDERERS[type] as ComponentType<Record<string, unknown>>
  const props = {
    ...edge,
    type,
    sourceHandleId: edge.sourceHandle ?? undefined,
    targetHandleId: edge.targetHandle ?? undefined,
    selected: internalEdge.selected,
  }

  return (
    <g
      ref={edgeRef}
      className="pointer-events-auto"
      data-canvas-edge-id={edge.id}
      onClick={(event) => onEdgeClick?.(event, edge)}
      onContextMenu={(event) => onEdgeContextMenu(event, edge)}
    >
      <Component {...props} />
    </g>
  )
})

function CanvasConnectionLayer({ draft }: { draft: ConnectionDraft | null }) {
  if (!draft) {
    return null
  }

  return (
    <path
      d={`M ${draft.start.x},${draft.start.y} L ${draft.current.x},${draft.current.y}`}
      fill="none"
      stroke="var(--primary)"
      strokeDasharray="6 6"
      strokeWidth={2}
      pointerEvents="none"
      data-testid="canvas-connection-preview"
    />
  )
}

function CanvasBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundColor: 'var(--background)',
        backgroundImage:
          'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--foreground) 14%, transparent) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    />
  )
}

function CanvasMiniMap() {
  const nodes = useCanvasEngineSelector((snapshot) => snapshot.nodes)
  if (nodes.length === 0) {
    return null
  }

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 h-28 w-40 overflow-hidden rounded border bg-background/80 shadow-sm backdrop-blur"
      data-testid="canvas-minimap"
    >
      {nodes.slice(0, 250).map((node) => (
        <div
          key={node.id}
          className="absolute rounded-sm bg-muted-foreground/45"
          style={{
            left: `${Math.max(
              0,
              Math.min(
                MINIMAP_MAX_PERCENT,
                node.position.x / MINIMAP_SCALE + MINIMAP_OFFSET_PERCENT,
              ),
            )}%`,
            top: `${Math.max(
              0,
              Math.min(
                MINIMAP_MAX_PERCENT,
                node.position.y / MINIMAP_SCALE + MINIMAP_OFFSET_PERCENT,
              ),
            )}%`,
            width: 4,
            height: 4,
          }}
        />
      ))}
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
  connectionDraftRef: RefObject<ConnectionDraft | null>
  paneRef: RefObject<HTMLDivElement | null>
  event: PointerEvent
  setConnectionDraft: Dispatch<SetStateAction<ConnectionDraft | null>>
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
  connectionDraftRef: RefObject<ConnectionDraft | null>
  event: PointerEvent
  setConnectionDraft: Dispatch<SetStateAction<ConnectionDraft | null>>
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

function resolveEdgeType(type: string | undefined): CanvasEdgeType {
  return type === 'straight' || type === 'step' || type === 'bezier' ? type : 'bezier'
}

function areStringArraysEqual(left: ReadonlyArray<string>, right: ReadonlyArray<string>) {
  if (left === right) {
    return true
  }
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

function selectCanvasNodeShellSnapshot(
  internalNode: CanvasInternalNode | undefined,
): CanvasNodeShellSnapshot | null {
  if (!internalNode) {
    return null
  }

  const node = internalNode.node
  return {
    id: node.id,
    type: node.type,
    className: node.className,
    position: node.position,
    width: node.width ?? internalNode.measured.width,
    height: node.height ?? internalNode.measured.height,
    zIndex: internalNode.zIndex,
    visible: internalNode.visible,
  }
}

function selectCanvasNodeContentSnapshot(
  internalNode: CanvasInternalNode | undefined,
): CanvasNodeContentSnapshot | null {
  if (!internalNode) {
    return null
  }

  const node = internalNode.node
  const type =
    node.type === 'embed' || node.type === 'stroke' || node.type === 'text' ? node.type : 'text'
  return {
    id: node.id,
    type,
    data: node.data,
    dragging: internalNode.dragging,
    selected: internalNode.selected,
    width: node.width ?? internalNode.measured.width,
    height: node.height ?? internalNode.measured.height,
  }
}

function areCanvasNodeShellSnapshotsEqual(
  left: CanvasNodeShellSnapshot | null,
  right: CanvasNodeShellSnapshot | null,
) {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  return (
    left.id === right.id &&
    left.type === right.type &&
    left.className === right.className &&
    left.position === right.position &&
    left.width === right.width &&
    left.height === right.height &&
    left.zIndex === right.zIndex &&
    left.visible === right.visible
  )
}

function areCanvasNodeContentSnapshotsEqual(
  left: CanvasNodeContentSnapshot | null,
  right: CanvasNodeContentSnapshot | null,
) {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  return (
    left.id === right.id &&
    left.type === right.type &&
    left.data === right.data &&
    left.dragging === right.dragging &&
    left.selected === right.selected &&
    left.width === right.width &&
    left.height === right.height
  )
}
