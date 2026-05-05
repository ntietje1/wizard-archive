import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CanvasEdgeRenderer } from '../canvas-edge-renderer'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasDocumentEdge } from 'convex/canvases/validation'

vi.mock('../canvas-edge-wrapper', () => ({
  CanvasEdgeWrapper: ({ edgeId }: { edgeId: string }) => <g data-testid={`edge-${edgeId}`} />,
}))

describe('CanvasEdgeRenderer', () => {
  it('renders each edge in a positioned layer using the edge z-index', () => {
    const domRuntime = createCanvasDomRuntime()
    const engine = createCanvasEngine({ domRuntime })
    try {
      engine.setDocumentSnapshot({
        edges: [
          createEdge({ id: 'edge-behind', zIndex: 2 }),
          createEdge({ id: 'edge-front', zIndex: 7 }),
        ],
      })

      render(
        <CanvasEngineProvider engine={engine}>
          <CanvasEdgeRenderer onEdgeContextMenu={vi.fn()} />
        </CanvasEngineProvider>,
      )

      const frontLayer = screen.getByTestId('edge-edge-front').parentElement
      expect(frontLayer?.tagName.toLowerCase()).toBe('svg')
      expect(frontLayer).toHaveAttribute('data-canvas-edge-layer', 'true')
      expect(frontLayer).toHaveStyle({
        zIndex: '7',
      })
    } finally {
      engine.destroy()
      domRuntime.destroy()
    }
  })
})

function createEdge({ id, zIndex }: { id: string; zIndex: number }): CanvasDocumentEdge {
  return {
    id,
    source: `${id}-source`,
    target: `${id}-target`,
    sourceHandle: null,
    targetHandle: null,
    type: 'straight',
    style: {},
    zIndex,
  } satisfies CanvasDocumentEdge
}
