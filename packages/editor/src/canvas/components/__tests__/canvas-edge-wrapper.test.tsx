import { act, render, waitFor } from '@testing-library/react'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { CanvasEdgeWrapper } from '../canvas-edge-wrapper'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime'
import { createCanvasRuntime } from '../../runtime/__tests__/canvas-runtime-test-utils'
import type { CanvasDocumentEdge } from '../../document-contract'

describe('CanvasEdgeWrapper', () => {
  it('registers visible edge elements and unregisters them when hidden', async () => {
    const runtime = createCanvasRuntime()
    const edge = createEdge()

    try {
      runtime.canvasEngine.setDocumentSnapshot({ edges: [edge] })
      const view = render(
        <CanvasEngineProvider engine={runtime.canvasEngine}>
          <CanvasRuntimeProvider {...runtime}>
            <svg>
              <CanvasEdgeWrapper edgeId={edge.id} onEdgeContextMenu={vi.fn()} />
            </svg>
          </CanvasRuntimeProvider>
        </CanvasEngineProvider>,
      )

      await waitFor(() => {
        expect(runtime.domRuntime.registry.getEdge(edge.id)).toBeInstanceOf(SVGElement)
      })

      act(() => {
        runtime.canvasEngine.setDocumentSnapshot({
          edges: [{ ...edge, hidden: true }],
        })
      })
      view.rerender(
        <CanvasEngineProvider engine={runtime.canvasEngine}>
          <CanvasRuntimeProvider {...runtime}>
            <svg>
              <CanvasEdgeWrapper edgeId={edge.id} onEdgeContextMenu={vi.fn()} />
            </svg>
          </CanvasRuntimeProvider>
        </CanvasEngineProvider>,
      )

      await waitFor(() => {
        expect(runtime.domRuntime.registry.getEdge(edge.id)).toBeUndefined()
      })
    } finally {
      runtime.canvasEngine.destroy()
      runtime.domRuntime.destroy()
    }
  })
})

function createEdge(): CanvasDocumentEdge {
  return {
    id: 'edge-1',
    source: testCanvasNodeId('node-1'),
    target: testCanvasNodeId('node-2'),
    sourceHandle: null,
    targetHandle: null,
    type: 'straight',
    style: {},
    zIndex: 1,
  } satisfies CanvasDocumentEdge
}
