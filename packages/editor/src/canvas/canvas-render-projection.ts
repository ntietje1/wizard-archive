import type { CanvasDocumentEdge, CanvasDocumentNode } from './document-contract'
import { canvasEdgeBounds } from './canvas-edge-geometry'
import type { CanvasInteractionSnapshot } from './interaction-controller'
import { canvasNodeBounds } from './canvas-bounds'
import type { CanvasBounds } from './canvas-bounds'
import type { CanvasNodeId } from '../resources/domain-id'

export type CanvasSurfaceSize = Readonly<{ width: number; height: number }>

export function projectCanvasRenderContent(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  edges: ReadonlyArray<CanvasDocumentEdge>,
  interaction: CanvasInteractionSnapshot,
  surface: CanvasSurfaceSize,
) {
  if (surface.width <= 0 || surface.height <= 0) return { nodes, edges }
  const viewport = interaction.viewport
  const overscan = 160 / viewport.zoom
  const visibleBounds: CanvasBounds = {
    x: -viewport.x / viewport.zoom - overscan,
    y: -viewport.y / viewport.zoom - overscan,
    width: surface.width / viewport.zoom + overscan * 2,
    height: surface.height / viewport.zoom + overscan * 2,
  }
  const retained = retainedCanvasInteractionNodeIds(interaction)
  const visibleNodes = nodes.filter(
    (node) => retained.has(node.id) || canvasBoundsIntersect(visibleBounds, canvasNodeBounds(node)),
  )
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const visibleEdges = edges.filter((edge) => {
    const bounds = canvasEdgeBounds(edge, nodeById)
    return bounds ? canvasBoundsIntersect(visibleBounds, bounds) : false
  })
  return { nodes: visibleNodes, edges: visibleEdges }
}

function retainedCanvasInteractionNodeIds(
  snapshot: CanvasInteractionSnapshot,
): ReadonlySet<CanvasNodeId> {
  const interaction = snapshot.interaction
  switch (interaction.type) {
    case 'connecting':
      return new Set(
        interaction.target
          ? [interaction.source.nodeId, interaction.target.nodeId]
          : [interaction.source.nodeId],
      )
    case 'dragging':
      return new Set(interaction.initialPositions.keys())
    case 'editing':
      return new Set([interaction.nodeId])
    case 'erasing':
      return interaction.nodeIds
    case 'resizing':
      return new Set(interaction.initialNodeBounds.keys())
    case 'drawing':
    case 'idle':
    case 'panning':
    case 'selecting':
      return new Set()
  }
}

function canvasBoundsIntersect(left: CanvasBounds, right: CanvasBounds): boolean {
  return !(
    left.x + left.width < right.x ||
    right.x + right.width < left.x ||
    left.y + left.height < right.y ||
    right.y + right.height < left.y
  )
}
