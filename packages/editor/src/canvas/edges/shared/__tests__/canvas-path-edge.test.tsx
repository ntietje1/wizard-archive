import { render, screen } from '@testing-library/react'
import { CANVAS_HANDLE_POSITION } from '../../../types/canvas-domain-types'
import { describe, expect, it, vi } from 'vite-plus/test'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime'
import { CanvasRenderModeContext } from '../../../runtime/providers/canvas-render-mode-context'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { createCanvasDomRuntime } from '../../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { CanvasPathEdge } from '../canvas-path-edge'
import { PENDING_PREVIEW_EDGE_OPACITY } from '../canvas-edge-style'
import type { CanvasEdgeRendererProps } from '../../canvas-edge-types'
import type { ReactElement } from 'react'

interface CanvasRegisteredEdgePaths {
  path: SVGPathElement | null
  highlightPath?: SVGPathElement | null
  interactionPath?: SVGPathElement | null
}

describe('CanvasPathEdge', () => {
  const geometry = {
    path: 'M 0,0 L 10,10',
    labelX: 5,
    labelY: 5,
    hitPoints: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
  }

  it('registers edge paths only after geometry paths are mounted', () => {
    const unregister = vi.fn()
    const registerEdgePaths = vi.fn((_edgeId: string, _paths: CanvasRegisteredEdgePaths) => {
      return unregister
    })
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
      '1.5',
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

  it('registers the selected highlight path separately from the authored stroke path', () => {
    const registerEdgePaths = vi.fn((_edgeId: string, _paths: CanvasRegisteredEdgePaths) => vi.fn())

    renderEdge(
      <CanvasPathEdge props={createEdgeProps()} geometry={geometry} />,
      registerEdgePaths,
      {
        selection: { nodeIds: new Set<string>(), edgeIds: new Set(['edge-1']) },
      },
    )

    const paths = registerEdgePaths.mock.calls[0]?.[1]
    expect(paths?.highlightPath?.getAttribute('d')).toBe(geometry.path)
    expect(paths?.highlightPath).toHaveAttribute('data-canvas-highlight-stroke-width', '1')
    expect(paths?.highlightPath).not.toHaveAttribute('data-canvas-authored-stroke-width')
  })

  it('uses pending-preview opacity only for pending-selected edges', () => {
    renderEdge(<CanvasPathEdge props={createEdgeProps()} geometry={geometry} />, vi.fn(), {
      pendingPreview: {
        nodeIds: new Set<string>(),
        edgeIds: new Set(['edge-1']),
      },
    })

    expect(screen.getByTestId('canvas-edge-primary-path')).toHaveStyle({
      opacity: String(PENDING_PREVIEW_EDGE_OPACITY),
    })
  })
})

function renderEdge(
  ui: ReactElement,
  registerEdgePaths: (edgeId: string, paths: CanvasRegisteredEdgePaths) => () => void,
  options: RuntimeTreeOptions = {},
) {
  return render(createRuntimeTree(ui, registerEdgePaths, options))
}

function createRuntimeTree(
  ui: ReactElement,
  registerEdgePaths: (edgeId: string, paths: CanvasRegisteredEdgePaths) => () => void,
  { pendingPreview = null, selection }: RuntimeTreeOptions = {},
) {
  const domRuntime = createCanvasDomRuntime()
  const engine = createCanvasEngine({ domRuntime })
  if (selection) {
    engine.setSelection(selection)
  }
  if (pendingPreview) {
    engine.setSelectionGesturePreview(pendingPreview)
  }
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
      <CanvasRenderModeContext.Provider value="interactive">
        <CanvasRuntimeProvider {...runtime}>
          <svg>{ui}</svg>
        </CanvasRuntimeProvider>
      </CanvasRenderModeContext.Provider>
    </CanvasEngineProvider>
  )
}

interface RuntimeTreeOptions {
  pendingPreview?: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> } | null
  selection?: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> }
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
