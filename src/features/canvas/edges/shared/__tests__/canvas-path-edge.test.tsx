import { render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime-context'
import { READ_ONLY_CANVAS_RUNTIME } from '../../../runtime/providers/canvas-runtime'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { CanvasPathEdge } from '../canvas-path-edge'
import type { CanvasEdgeRendererProps } from '../../canvas-edge-types'
import type { CanvasRegisteredEdgePaths } from '../../../system/canvas-dom-registry'
import type { ReactElement } from 'react'

describe('CanvasPathEdge', () => {
  it('registers edge paths only after geometry paths are mounted', () => {
    const unregister = vi.fn()
    const registerEdgePaths = vi.fn((_edgeId: string, _paths: CanvasRegisteredEdgePaths) => {
      return unregister
    })
    const geometry = { path: 'M 0,0 L 10,10', labelX: 5, labelY: 5 }
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
  const engine = createCanvasEngine()
  const runtime = {
    ...READ_ONLY_CANVAS_RUNTIME,
    canvasEngine: engine,
    domRuntime: {
      ...READ_ONLY_CANVAS_RUNTIME.domRuntime,
      registerEdgePaths,
    },
  }

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
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    animated: false,
    data: {},
    selectable: true,
    deletable: true,
    selected: false,
    sourceHandleId: 'right',
    targetHandleId: 'left',
    label: undefined,
    labelStyle: undefined,
    labelShowBg: false,
    labelBgStyle: undefined,
    labelBgPadding: undefined,
    labelBgBorderRadius: undefined,
    markerStart: undefined,
    markerEnd: undefined,
    style: undefined,
  }
}
