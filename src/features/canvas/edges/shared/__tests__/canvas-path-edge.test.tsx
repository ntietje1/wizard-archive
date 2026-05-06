import { render } from '@testing-library/react'
import { CANVAS_HANDLE_POSITION } from '~/features/canvas/types/canvas-domain-types'
import { describe, expect, it, vi } from 'vitest'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { createCanvasDomRuntime } from '../../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { CanvasPathEdge } from '../canvas-path-edge'
import type { CanvasEdgeRendererProps } from '../../canvas-edge-types'
import type { CanvasRegisteredEdgePaths } from '../../../system/canvas-dom-registry'
import type { ReactElement } from 'react'
import { DEFAULT_CANVAS_EDGE_STROKE_WIDTH } from '../canvas-edge-style'

describe('CanvasPathEdge', () => {
  it('registers edge paths only after geometry paths are mounted', () => {
    const unregister = vi.fn()
    const registerEdgePaths = vi.fn((_edgeId: string, _paths: CanvasRegisteredEdgePaths) => {
      return unregister
    })
    const geometry = {
      path: 'M 0,0 L 10,10',
      labelX: 5,
      labelY: 5,
      hitPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    }
    const { rerender } = renderEdge(
      <CanvasPathEdge props={createEdgeProps()} geometry={null} />,
      registerEdgePaths,
    )

    expect(registerEdgePaths).not.toHaveBeenCalled()

    rerender(
      createRuntimeTree(
        <CanvasPathEdge props={createEdgeProps()} geometry={geometry} />,
        registerEdgePaths,
      ),
    )

    expect(registerEdgePaths).toHaveBeenCalledTimes(1)
    expect(registerEdgePaths.mock.calls[0]?.[0]).toBe('edge-1')
    expect(registerEdgePaths.mock.calls[0]?.[1].path?.getAttribute('d')).toBe(geometry.path)
    expect(registerEdgePaths.mock.calls[0]?.[1].path).toHaveAttribute(
      'data-canvas-authored-stroke-width',
      String(DEFAULT_CANVAS_EDGE_STROKE_WIDTH),
    )
    expect(registerEdgePaths.mock.calls[0]?.[1].interactionPath?.getAttribute('d')).toBe(
      geometry.path,
    )

    rerender(
      createRuntimeTree(
        <CanvasPathEdge props={createEdgeProps()} geometry={null} />,
        registerEdgePaths,
      ),
    )

    expect(unregister).toHaveBeenCalledTimes(1)
    expect(registerEdgePaths).toHaveBeenCalledTimes(1)
  })
})

function renderEdge(
  ui: ReactElement,
  registerEdgePaths: (edgeId: string, paths: CanvasRegisteredEdgePaths) => () => void,
) {
  return render(createRuntimeTree(ui, registerEdgePaths))
}

function createRuntimeTree(
  ui: ReactElement,
  registerEdgePaths: (edgeId: string, paths: CanvasRegisteredEdgePaths) => () => void,
) {
  const domRuntime = createCanvasDomRuntime()
  const engine = createCanvasEngine({ domRuntime })
  const runtime = createCanvasRuntime({
    canEdit: false,
    canvasEngine: engine,
    domRuntime: {
      ...domRuntime,
      registerEdgePaths,
    },
  })

  return (
    <CanvasEngineProvider engine={engine}>
      <CanvasRuntimeProvider {...runtime}>
        <svg>{ui}</svg>
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>
  )
}

function createEdgeProps(): CanvasEdgeRendererProps {
  return {
    id: 'edge-1',
    type: 'bezier',
    source: 'source',
    target: 'target',
    sourceX: 0,
    sourceY: 0,
    targetX: 10,
    targetY: 10,
    sourcePosition: CANVAS_HANDLE_POSITION.Right,
    targetPosition: CANVAS_HANDLE_POSITION.Left,
    selected: false,
    sourceHandleId: 'right',
    targetHandleId: 'left',
    style: undefined,
  }
}
