import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import type { CanvasDocumentNode } from '../document-contract'
import type { CanvasConnectionHandle } from '../interaction-types'
import { createCanvasInteractionController } from '../interaction-controller'
import { projectCanvasRenderContent } from '../canvas-render-projection'
import { canvasEdgePolyline } from '../canvas-edge-geometry'

describe('projectCanvasRenderContent', () => {
  it('culls a maximum-size canvas while retaining an edge that crosses the viewport', () => {
    const nodes = maximumCanvasNodes()
    const crossing = {
      id: 'crossing',
      source: nodes[0]!.id,
      target: nodes[1]!.id,
      type: 'straight' as const,
    }
    const interaction = createCanvasInteractionController({
      readContent: () => ({ nodes, edges: [crossing] }),
    })
    interaction.setViewport({ x: 0, y: 0, zoom: 1 })

    const projected = projectCanvasRenderContent(nodes, [crossing], interaction.get(), {
      width: 800,
      height: 600,
    })

    expect(projected.nodes.length).toBeLessThan(40)
    expect(projected.edges).toEqual([crossing])
    interaction.dispose()
  })

  it('keeps repeated maximum-size viewport projections within a CI-safe bound', () => {
    const nodes = maximumCanvasNodes()
    const interaction = createCanvasInteractionController({
      readContent: () => ({ nodes, edges: [] }),
    })
    const startedAt = performance.now()
    for (let index = 0; index < 10_000; index += 1) {
      projectCanvasRenderContent(nodes, [], interaction.get(), { width: 800, height: 600 })
    }
    expect(performance.now() - startedAt).toBeLessThan(1_000)
    interaction.dispose()
  })

  it.each(['top', 'right', 'bottom', 'left'] as const)(
    'retains a %s-handle Bezier routed through the viewport from offscreen endpoints',
    (handle) => {
      const { edge, nodes } = routedBezier(handle)
      const interaction = createCanvasInteractionController({
        readContent: () => ({ nodes, edges: [edge] }),
      })
      const path = canvasEdgePolyline(edge, new Map(nodes.map((node) => [node.id, node])))
      expect(
        path?.some((point) => point.x >= 0 && point.x <= 800 && point.y >= 0 && point.y <= 600),
      ).toBe(true)

      expect(
        projectCanvasRenderContent(nodes, [edge], interaction.get(), {
          width: 800,
          height: 600,
        }),
      ).toEqual({ nodes: [], edges: [edge] })
      interaction.dispose()
    },
  )

  it('retains routed bounds through a zoomed and panned viewport', () => {
    const { edge, nodes } = routedBezier('bottom')
    const interaction = createCanvasInteractionController({
      readContent: () => ({ nodes, edges: [edge] }),
    })
    interaction.setViewport({ x: -480, y: -884, zoom: 2 })

    expect(
      projectCanvasRenderContent(nodes, [edge], interaction.get(), {
        width: 800,
        height: 600,
      }),
    ).toEqual({ nodes: [], edges: [edge] })
    interaction.dispose()
  })

  it.each(['straight', 'step'] as const)('retains a crossing %s route', (type) => {
    const nodes = maximumCanvasNodes().slice(0, 2)
    const edge = { id: type, source: nodes[0]!.id, target: nodes[1]!.id, type }
    const interaction = createCanvasInteractionController({
      readContent: () => ({ nodes, edges: [edge] }),
    })

    expect(
      projectCanvasRenderContent(nodes, [edge], interaction.get(), {
        width: 800,
        height: 600,
      }).edges,
    ).toEqual([edge])
    interaction.dispose()
  })

  it('includes stroke extent at the zoom-adjusted overscan boundary', () => {
    const nodes = [199.9, 200.1].flatMap((y) => [textNode(-40, y), textNode(10, y)])
    const edges = [
      straightTopEdge('inside', nodes[0]!, nodes[1]!),
      straightTopEdge('outside', nodes[2]!, nodes[3]!),
    ]
    const interaction = createCanvasInteractionController({
      readContent: () => ({ nodes, edges }),
    })
    interaction.setViewport({ x: 0, y: 0, zoom: 4 })

    expect(
      projectCanvasRenderContent(nodes, edges, interaction.get(), {
        width: 800,
        height: 600,
      }),
    ).toEqual({ nodes: [], edges: [edges[0]] })
    interaction.dispose()
  })
})

function textNode(x: number, y: number): CanvasDocumentNode {
  return {
    id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
    type: 'text',
    position: { x, y },
    data: {},
  }
}

function straightTopEdge(id: string, source: CanvasDocumentNode, target: CanvasDocumentNode) {
  return {
    id,
    source: source.id,
    target: target.id,
    sourceHandle: 'top',
    targetHandle: 'top',
    type: 'straight' as const,
    style: { strokeWidth: 20 },
  }
}

function routedBezier(handle: CanvasConnectionHandle) {
  const horizontal = handle === 'top' || handle === 'bottom'
  const positions = horizontal
    ? [
        { x: 300, y: -500 },
        { x: 300, y: 1_000 },
      ]
    : [
        { x: -500, y: 200 },
        { x: 1_200, y: 200 },
      ]
  const nodes = positions.map((position) => ({
    id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
    type: 'text' as const,
    position,
    data: {},
  }))
  return {
    nodes,
    edge: {
      id: `${handle}-crossing`,
      source: nodes[0]!.id,
      target: nodes[1]!.id,
      sourceHandle: handle,
      targetHandle: handle,
      type: 'bezier' as const,
    },
  }
}

function maximumCanvasNodes(): Array<CanvasDocumentNode> {
  return Array.from({ length: 512 }, (_, index) => ({
    id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
    type: 'text' as const,
    position:
      index === 0
        ? { x: -1_000, y: 200 }
        : index === 1
          ? { x: 1_000, y: 200 }
          : { x: (index % 32) * 240, y: Math.floor(index / 32) * 160 },
    data: {},
  }))
}
