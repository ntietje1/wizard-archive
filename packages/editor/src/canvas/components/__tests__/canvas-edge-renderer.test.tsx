import { render, screen } from '@testing-library/react'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { CanvasEdgeRenderer } from '../canvas-edge-renderer'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasDocumentEdge } from '../../document-contract'
vi.mock('../canvas-edge-wrapper', () => ({
  CanvasEdgeWrapper: ({ edgeId }: { edgeId: string }) => <g data-testid={edgeId} />,
}))

describe('CanvasEdgeRenderer', () => {
  it('renders visible edges from the engine snapshot', () => {
    const domRuntime = createCanvasDomRuntime()
    const engine = createCanvasEngine({ domRuntime })
    try {
      engine.setDocumentSnapshot({
        edges: [createEdge('edge-a'), createEdge('edge-b')],
      })

      render(
        <CanvasEngineProvider engine={engine}>
          <CanvasEdgeRenderer onEdgeContextMenu={vi.fn()} />
        </CanvasEngineProvider>,
      )

      expect(screen.getByTestId('edge-a')).toBeInTheDocument()
      expect(screen.getByTestId('edge-b')).toBeInTheDocument()
    } finally {
      engine.destroy()
      domRuntime.destroy()
    }
  })

  it('does not render hidden edges from the engine snapshot', () => {
    const domRuntime = createCanvasDomRuntime()
    const engine = createCanvasEngine({ domRuntime })
    try {
      engine.setDocumentSnapshot({
        edges: [createEdge('visible-edge'), createEdge('hidden-edge', { hidden: true })],
      })

      render(
        <CanvasEngineProvider engine={engine}>
          <CanvasEdgeRenderer onEdgeContextMenu={vi.fn()} />
        </CanvasEngineProvider>,
      )

      expect(screen.getByTestId('visible-edge')).toBeInTheDocument()
      expect(screen.queryByTestId('hidden-edge')).toBeNull()
    } finally {
      engine.destroy()
      domRuntime.destroy()
    }
  })
})

function createEdge(
  id: string,
  options: {
    hidden?: boolean
  } = {},
): CanvasDocumentEdge {
  return {
    id,
    source: testCanvasNodeId(`${id}-source`),
    target: testCanvasNodeId(`${id}-target`),
    sourceHandle: null,
    targetHandle: null,
    type: 'straight',
    style: {},
    zIndex: 1,
    hidden: options.hidden,
  } satisfies CanvasDocumentEdge
}
