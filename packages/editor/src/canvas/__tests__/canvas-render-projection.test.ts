import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import type { CanvasDocumentNode } from '../document-contract'
import { createCanvasInteractionController } from '../interaction-controller'
import { projectCanvasRenderContent } from '../canvas-render-projection'

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
})

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
