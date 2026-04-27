import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useEmbeddedCanvasState } from './use-embedded-canvas-state'
import { CanvasThumbnailPreview } from '~/features/previews/components/canvas-thumbnail-preview'
import { CanvasReadOnlyPreview } from '../../components/canvas-read-only-preview'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'

const MAX_ZOOM = 4
const MIN_ZOOM = 0.01
const FIT_PADDING = 0.12

export function EmbeddedCanvasContent({
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
      <CanvasReadOnlyPreview
        nodes={nodes}
        edges={normalizedEdges}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        fitPadding={FIT_PADDING}
        className="pointer-events-none relative h-full w-full min-h-0 min-w-0"
      />
    </div>
  )
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
  const sourceBounds = getNodeBounds(sourceNode)
  const targetBounds = getNodeBounds(targetNode)
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

function getNodeBounds(node: Node) {
  const width = node.width ?? node.measured?.width
  const height = node.height ?? node.measured?.height
  if (typeof width !== 'number' || typeof height !== 'number') {
    return null
  }

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  }
}
