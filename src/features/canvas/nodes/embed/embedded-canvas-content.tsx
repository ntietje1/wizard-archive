import { useLayoutEffect, useMemo } from 'react'
import {
  Background,
  getNodesBounds,
  getViewportForBounds,
  ReactFlow,
  ReactFlowProvider,
  useInternalNode,
  useStoreApi,
} from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import { canvasEdgeTypes } from '../../edges/canvas-edge-renderers'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime-context'
import { READ_ONLY_CANVAS_RUNTIME } from '../../runtime/providers/canvas-runtime'
import { useEmbeddedCanvasState } from './use-embedded-canvas-state'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'
import { CanvasThumbnailPreview } from '~/features/previews/components/canvas-thumbnail-preview'
import { embeddedCanvasNodeTypes } from './embedded-canvas-node-types'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node, Viewport } from '@xyflow/react'

const MAX_ZOOM = 4
const MIN_ZOOM = 0.01
const PRO_OPTIONS = { hideAttribution: true }
const EMPTY_NODES: Array<Node> = []
const EMPTY_EDGES: Array<Edge> = []
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }
const FIT_PADDING = 0.12
const NOOP = () => {}

export function EmbeddedCanvasContent({
  nodeId,
  canvasId,
  previewUrl,
  alt,
}: {
  nodeId: string
  canvasId: Id<'sidebarItems'>
  previewUrl: string | null
  alt: string
}) {
  const { nodes, edges, isLoading, isError } = useEmbeddedCanvasState(canvasId)
  const internalNode = useInternalNode(nodeId)
  const containerSize = useMemo(() => {
    const width = internalNode?.measured?.width ?? internalNode?.width ?? 0
    const height = internalNode?.measured?.height ?? internalNode?.height ?? 0
    return { width, height }
  }, [
    internalNode?.height,
    internalNode?.measured?.height,
    internalNode?.measured?.width,
    internalNode?.width,
  ])
  const normalizedEdges = useMemo(() => normalizeEmbeddedCanvasEdges(nodes, edges), [edges, nodes])

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span className="sr-only">Loading embedded canvas</span>
      </div>
    )
  }

  if (isError) {
    return <CanvasThumbnailPreview previewUrl={previewUrl} alt={alt} />
  }

  return (
    <div className="h-full w-full min-h-0 min-w-0 overflow-hidden">
      <CanvasRuntimeProvider {...READ_ONLY_CANVAS_RUNTIME}>
        <ReactFlowProvider>
          <EmbeddedCanvasFlow nodes={nodes} edges={normalizedEdges} containerSize={containerSize} />
        </ReactFlowProvider>
      </CanvasRuntimeProvider>
    </div>
  )
}

function EmbeddedCanvasFlow({
  nodes,
  edges,
  containerSize,
}: {
  nodes: Array<Node>
  edges: Array<Edge>
  containerSize: { width: number; height: number }
}) {
  const colorMode = useResolvedTheme()
  const bounds = useMemo(() => getEmbeddedCanvasBounds(nodes), [nodes])
  const viewport = useMemo(
    () => getEmbeddedCanvasViewport(bounds, containerSize.width, containerSize.height),
    [bounds, containerSize.height, containerSize.width],
  )

  return (
    <div className="relative h-full w-full min-h-0 min-w-0 bg-background [&_.react-flow__edge]:pointer-events-none [&_.react-flow__node]:pointer-events-none">
      <ReactFlow
        className="h-full w-full min-h-0 min-w-0"
        defaultNodes={EMPTY_NODES}
        defaultEdges={EMPTY_EDGES}
        nodes={nodes}
        edges={edges}
        nodeTypes={embeddedCanvasNodeTypes}
        edgeTypes={canvasEdgeTypes}
        colorMode={colorMode}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={false}
        selectionOnDrag={false}
        zoomOnDoubleClick={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnScroll={false}
        panOnDrag={false}
        preventScrolling={true}
        proOptions={PRO_OPTIONS}
        viewport={viewport}
        onViewportChange={NOOP}
      >
        <EmbeddedCanvasSizeSync width={containerSize.width} height={containerSize.height} />
        <Background bgColor="var(--background)" />
      </ReactFlow>
    </div>
  )
}

function EmbeddedCanvasSizeSync({ width, height }: { width: number; height: number }) {
  const store = useStoreApi()

  useLayoutEffect(() => {
    if (width <= 0 || height <= 0) {
      return
    }

    store.setState((current) =>
      current.width === width && current.height === height ? current : { width, height },
    )
  }, [height, store, width])

  return null
}

function getEmbeddedCanvasBounds(nodes: Array<Node>) {
  if (nodes.length === 0) {
    return null
  }

  const bounds = getNodesBounds(nodes)
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null
  }

  return bounds
}

function getEmbeddedCanvasViewport(
  bounds: ReturnType<typeof getEmbeddedCanvasBounds>,
  width: number,
  height: number,
): Viewport {
  if (!bounds || width <= 0 || height <= 0) {
    return DEFAULT_VIEWPORT
  }

  return getViewportForBounds(bounds, width, height, MIN_ZOOM, MAX_ZOOM, FIT_PADDING)
}

function normalizeEmbeddedCanvasEdges(nodes: Array<Node>, edges: Array<Edge>): Array<Edge> {
  if (edges.length === 0) {
    return edges
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node] as const))

  return edges.map((edge) => {
    const sourceNode = nodesById.get(edge.source)
    const targetNode = nodesById.get(edge.target)
    if (!sourceNode || !targetNode) {
      return edge
    }

    const inferredHandles = inferEmbeddedCanvasHandleIds(sourceNode, targetNode)
    const nextSourceHandle =
      typeof edge.sourceHandle === 'string' && edge.sourceHandle.length > 0
        ? edge.sourceHandle
        : inferredHandles.sourceHandle
    const nextTargetHandle =
      typeof edge.targetHandle === 'string' && edge.targetHandle.length > 0
        ? edge.targetHandle
        : inferredHandles.targetHandle

    if (edge.sourceHandle === nextSourceHandle && edge.targetHandle === nextTargetHandle) {
      return edge
    }

    return {
      ...edge,
      sourceHandle: nextSourceHandle,
      targetHandle: nextTargetHandle,
    }
  })
}

function inferEmbeddedCanvasHandleIds(sourceNode: Node, targetNode: Node) {
  const sourceBounds = getEmbeddedCanvasBounds([sourceNode])
  const targetBounds = getEmbeddedCanvasBounds([targetNode])
  if (!sourceBounds || !targetBounds) {
    return { sourceHandle: 'right', targetHandle: 'left' }
  }

  const dx = targetBounds.x + targetBounds.width / 2 - (sourceBounds.x + sourceBounds.width / 2)
  const dy = targetBounds.y + targetBounds.height / 2 - (sourceBounds.y + sourceBounds.height / 2)

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' }
  }

  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' }
}
