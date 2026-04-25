import { useEffect, useRef, useState } from 'react'
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
import type { Connection, Edge, Node } from '@xyflow/react'
import type {
  ComponentType,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
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
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null)

  useEffect(() => {
    const unregister = canvasEngine.registerViewportElement(viewportRef.current)
    canvasEngine.scheduleViewportTransform(canvasEngine.getSnapshot().viewport)
    canvasEngine.scheduleCameraState(canvasEngine.getSnapshot().cameraState)
    canvasEngine.flushRenderScheduler()
    return unregister
  }, [canvasEngine])

  useEffect(() => {
    if (!connectionDraft) {
      return undefined
    }

    const handlePointerMove = (event: PointerEvent) => {
      setConnectionDraft((draft) => {
        if (!draft) {
          return null
        }
        return {
          ...draft,
          current: canvasEngine.screenToCanvasPosition(
            { x: event.clientX, y: event.clientY },
            paneRef.current?.getBoundingClientRect() ?? null,
          ),
        }
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)
      const targetHandle = resolveConnectionHandle(target)
      setConnectionDraft((draft) => {
        if (draft && targetHandle && targetHandle.nodeId !== draft.source) {
          sceneHandlers.createEdgeFromConnection({
            source: draft.source,
            target: targetHandle.nodeId,
            sourceHandle: draft.sourceHandle,
            targetHandle: targetHandle.handleId,
          })
        }
        return null
      })
    }

    const handlePointerCancel = () => setConnectionDraft(null)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    window.addEventListener('pointercancel', handlePointerCancel, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [canvasEngine, connectionDraft, sceneHandlers])

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
    setConnectionDraft({
      source: handle.nodeId,
      sourceHandle: handle.handleId,
      start,
      current: start,
    })
  }

  const handlePaneClick = (event: ReactMouseEvent) => {
    if (event.target === paneRef.current) {
      sceneHandlers.onPaneClick?.(event)
    }
  }

  return (
    <div
      ref={paneRef}
      className="canvas-scene absolute inset-0 touch-none select-none overflow-hidden bg-background"
      data-canvas-pane="true"
      data-testid="canvas-scene"
      onClick={handlePaneClick}
      onContextMenu={(event) => {
        if (event.target === paneRef.current) {
          onPaneContextMenu(event)
        }
      }}
      onMouseMove={sceneHandlers.onMouseMove}
      onMouseLeave={sceneHandlers.onMouseLeave}
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
        className="canvas-scene__viewport absolute left-0 top-0 h-full w-full"
        style={{
          backfaceVisibility: 'hidden',
          transformOrigin: '0 0',
        }}
      >
        <svg
          className="canvas-edge-layer pointer-events-none absolute left-0 top-0 overflow-visible"
          width="1"
          height="1"
        >
          <CanvasEdgeRenderer
            onEdgeClick={sceneHandlers.onEdgeClick}
            onEdgeContextMenu={onEdgeContextMenu}
          />
          <CanvasConnectionLayer draft={connectionDraft} />
        </svg>
        <CanvasNodeRenderer
          onNodeClick={sceneHandlers.onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
        />
      </div>
      <CanvasLocalOverlaysHost />
      <CanvasAwarenessHost remoteUsers={remoteUsers} />
      <CanvasMiniMap />
    </div>
  )
}

function CanvasNodeRenderer({
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
}

function CanvasNodeWrapper({
  nodeId,
  onNodeClick,
  onNodeContextMenu,
}: {
  nodeId: string
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void
  onNodeContextMenu: (event: ReactMouseEvent, node: Node) => void
}) {
  const internalNode = useCanvasEngineSelector((snapshot) => snapshot.nodeLookup.get(nodeId))
  const canvasEngine = useCanvasEngine()
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!internalNode) {
      return undefined
    }

    const nodeElement = nodeRef.current
    if (!nodeElement || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      canvasEngine.measureNode(internalNode.id, {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(nodeElement)
    return () => observer.disconnect()
  }, [canvasEngine, internalNode])

  if (!internalNode || !internalNode.visible) {
    return null
  }

  const node = internalNode.node
  const type =
    node.type === 'embed' || node.type === 'stroke' || node.type === 'text' ? node.type : 'text'
  const Component = NODE_RENDERERS[type] as ComponentType<CanvasNodeComponentProps>
  const width = node.width ?? internalNode.measured.width
  const height = node.height ?? internalNode.measured.height

  return (
    <div
      ref={nodeRef}
      className={cn(
        'canvas-node-shell absolute left-0 top-0 touch-none select-none',
        node.className,
      )}
      data-node-id={node.id}
      data-node-type={node.type}
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        width,
        height,
        zIndex: internalNode.zIndex,
        pointerEvents: 'auto',
      }}
      onClick={(event) => onNodeClick?.(event, node)}
      onContextMenu={(event) => onNodeContextMenu(event, node)}
    >
      <Component
        id={node.id}
        type={node.type}
        data={node.data}
        dragging={internalNode.dragging}
        selected={internalNode.selected}
        width={width}
        height={height}
      />
    </div>
  )
}

function CanvasEdgeRenderer({
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
}

function CanvasEdgeWrapper({
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
      onClick={(event) => onEdgeClick?.(event, edge)}
      onContextMenu={(event) => onEdgeContextMenu(event, edge)}
    >
      <Component {...props} />
    </g>
  )
}

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
            left: `${Math.max(0, Math.min(96, node.position.x / 40 + 48))}%`,
            top: `${Math.max(0, Math.min(96, node.position.y / 40 + 48))}%`,
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
