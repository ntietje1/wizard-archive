import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { CanvasNodeWrapper } from '../canvas-node-wrapper'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import {
  createCanvasRuntime,
  createCanvasRuntimeEnginePair,
} from '../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime'
import type { CanvasDocumentNode } from '../../document-contract'

const resizeObservers: Array<MockResizeObserver> = []

afterEach(() => {
  vi.unstubAllGlobals()
  resizeObservers.length = 0
})

describe('CanvasNodeWrapper', () => {
  it('removes hidden node shells from the canvas DOM runtime', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const runtimePair = createCanvasRuntimeEnginePair()
    const node = createNode()
    runtimePair.canvasEngine.setDocumentSnapshot({ nodes: [node] })
    const runtime = createCanvasRuntime({
      canvasEngine: runtimePair.canvasEngine,
      domRuntime: runtimePair.domRuntime,
    })

    try {
      render(
        <CanvasEngineProvider engine={runtimePair.canvasEngine}>
          <CanvasRuntimeProvider {...runtime}>
            <CanvasNodeWrapper nodeId={node.id}>
              <span>Node content</span>
            </CanvasNodeWrapper>
          </CanvasRuntimeProvider>
        </CanvasEngineProvider>,
      )

      expect(screen.getByText('Node content')).toBeVisible()
      expect(runtimePair.domRuntime.registry.getNode(node.id)).toBeInstanceOf(HTMLElement)
      expect(resizeObservers[0]?.isObserving).toBe(true)

      act(() => {
        runtimePair.canvasEngine.setDocumentSnapshot({ nodes: [{ ...node, hidden: true }] })
      })

      expect(runtimePair.domRuntime.registry.getNode(node.id)).toBeUndefined()
      expect(resizeObservers[0]?.isObserving).toBe(false)
    } finally {
      runtimePair.canvasEngine.destroy()
      runtimePair.domRuntime.destroy()
    }
  })
})

function createNode(): CanvasDocumentNode {
  return {
    id: 'node-1',
    type: 'text',
    position: { x: 0, y: 0 },
    width: 100,
    height: 50,
    data: {},
  }
}

class MockResizeObserver implements ResizeObserver {
  isObserving = false

  constructor(_callback: ResizeObserverCallback) {
    resizeObservers.push(this)
  }

  observe() {
    this.isObserving = true
  }

  unobserve() {
    this.isObserving = false
  }

  disconnect() {
    this.isObserving = false
  }
}
