import type { CanvasDocumentEdge, CanvasDocumentNode } from './document-contract'
import { canvasNodeSize } from './canvas-layout'
import type { CanvasInteractionSnapshot } from './interaction-controller'
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
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    return source && target
      ? canvasBoundsIntersect(visibleBounds, canvasEdgeBounds(source, target))
      : false
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

function canvasNodeBounds(node: CanvasDocumentNode): CanvasBounds {
  const size = canvasNodeSize(node)
  return { x: node.position.x, y: node.position.y, width: size.width, height: size.height }
}

function canvasEdgeBounds(source: CanvasDocumentNode, target: CanvasDocumentNode): CanvasBounds {
  const sourceSize = canvasNodeSize(source)
  const targetSize = canvasNodeSize(target)
  const sourceCenter = {
    x: source.position.x + sourceSize.width / 2,
    y: source.position.y + sourceSize.height / 2,
  }
  const targetCenter = {
    x: target.position.x + targetSize.width / 2,
    y: target.position.y + targetSize.height / 2,
  }
  return {
    x: Math.min(sourceCenter.x, targetCenter.x),
    y: Math.min(sourceCenter.y, targetCenter.y),
    width: Math.abs(targetCenter.x - sourceCenter.x),
    height: Math.abs(targetCenter.y - sourceCenter.y),
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
