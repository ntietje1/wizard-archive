import { render, screen } from '@testing-library/react'
import { CANVAS_HANDLE_POSITION } from '../../../types/canvas-domain-types'
import { describe, expect, it } from 'vite-plus/test'
import { CanvasRenderModeContext } from '../../../runtime/providers/canvas-render-mode-context'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasDomRuntime } from '../../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { resolveCanvasScreenMinimumStrokeWidthCss as screenMinimumStrokeWidthCss } from '../../../screen-stroke-width'
import type { CanvasEdgeRendererProps } from '../../canvas-edge-types'
import { PENDING_PREVIEW_EDGE_OPACITY } from '../../shared/canvas-edge-style'
import { BezierCanvasEdge } from '../bezier-canvas-edge'
import {
  buildBezierCanvasEdgeGeometryFromEdge,
  buildBezierCanvasEdgeGeometryFromRenderProps,
} from '../bezier-canvas-edge-geometry'
import type { ReactElement } from 'react'
import type { CanvasDocumentNode } from '../../../document-contract'

describe('BezierCanvasEdge', () => {
  const defaultEdgeOpacity = 1
  const defaultEdgeStrokeWidth = 1.5

  it('keeps baseline styling when no pending preview is active', () => {
    renderEdge(<BezierCanvasEdge {...createEdgeProps({ selected: false })} />)

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute(
      'data-edge-pending-preview-active',
      'false',
    )
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-pending-selected', 'false')
    expect(getPrimaryPath()).toHaveStyle({
      opacity: String(defaultEdgeOpacity),
      stroke: 'var(--foreground)',
      strokeWidth: String(screenMinimumStrokeWidthCss(defaultEdgeStrokeWidth)),
      strokeLinecap: 'square',
      strokeLinejoin: 'round',
    })
    expect(screen.queryByTestId('canvas-edge-selection-highlight')).toBeNull()
  })

  it('keeps baseline styling when another edge owns the pending preview', () => {
    renderEdge(<BezierCanvasEdge {...createEdgeProps({ selected: false })} />, {
      pendingPreview: {
        nodeIds: new Set<string>(),
        edgeIds: new Set(['other-edge']),
      },
    })

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute(
      'data-edge-pending-preview-active',
      'true',
    )
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-pending-selected', 'false')
    expect(getPrimaryPath()).toHaveStyle({
      opacity: String(defaultEdgeOpacity),
      stroke: 'var(--foreground)',
      strokeWidth: String(screenMinimumStrokeWidthCss(defaultEdgeStrokeWidth)),
      strokeLinecap: 'square',
      strokeLinejoin: 'round',
    })
    expect(screen.queryByTestId('canvas-edge-selection-highlight')).toBeNull()
  })

  it('keeps the edge stroke and adds a thin selected highlight from authoritative selection', () => {
    renderEdge(<BezierCanvasEdge {...createEdgeProps({ selected: true })} />, {
      selection: { nodeIds: new Set<string>(), edgeIds: new Set(['edge-1']) },
    })

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-visual-selected', 'true')
    expect(getPrimaryPath()).toHaveStyle({
      opacity: String(defaultEdgeOpacity),
      stroke: 'var(--foreground)',
      strokeWidth: String(screenMinimumStrokeWidthCss(defaultEdgeStrokeWidth)),
      strokeLinecap: 'square',
      strokeLinejoin: 'round',
    })
    expect(screen.getByTestId('canvas-edge-selection-highlight')).toHaveStyle({
      stroke: 'var(--primary)',
      strokeLinecap: 'square',
      strokeLinejoin: 'round',
    })
  })

  it('renders a remote edge selection with the collaborator color', () => {
    renderEdge(<BezierCanvasEdge {...createEdgeProps({ selected: false })} />, {
      remoteEdgeHighlights: new Map([['edge-1', { color: '#ef4444', name: 'Remote' }]]),
    })

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-remote-selected', 'true')
    expect(screen.getByTestId('canvas-edge-selection-highlight')).toHaveStyle({
      stroke: '#ef4444',
    })
  })

  it('preserves custom edge styling while drawing the selected highlight inside it', () => {
    renderEdge(
      <BezierCanvasEdge
        {...createEdgeProps(
          { selected: true },
          { style: { stroke: 'var(--t-red)', strokeWidth: 8 } },
        )}
      />,
      {
        selection: { nodeIds: new Set<string>(), edgeIds: new Set(['edge-1']) },
      },
    )

    expect(getPrimaryPath()).toHaveStyle({
      stroke: 'var(--t-red)',
      strokeWidth: String(screenMinimumStrokeWidthCss(8)),
      strokeLinecap: 'square',
      strokeLinejoin: 'round',
    })
    expect(screen.getByTestId('canvas-edge-selection-highlight')).toHaveStyle({
      stroke: 'var(--primary)',
    })
  })

  it('shows lower-opacity local preview styling for pending-selected edges', () => {
    renderEdge(<BezierCanvasEdge {...createEdgeProps({ selected: false })} />, {
      pendingPreview: {
        nodeIds: new Set<string>(),
        edgeIds: new Set(['edge-1']),
      },
    })

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute(
      'data-edge-pending-preview-active',
      'true',
    )
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-pending-selected', 'true')
    expect(getPrimaryPath()).toHaveStyle({
      stroke: 'var(--foreground)',
      strokeWidth: String(screenMinimumStrokeWidthCss(defaultEdgeStrokeWidth)),
      opacity: String(PENDING_PREVIEW_EDGE_OPACITY),
      strokeLinecap: 'square',
      strokeLinejoin: 'round',
    })
    expect(screen.getByTestId('canvas-edge-selection-highlight')).toHaveStyle({
      stroke: 'var(--primary)',
    })
  })

  it('suppresses edge interaction chrome in embedded read-only mode', () => {
    renderEdge(
      <CanvasRenderModeContext value="embedded-readonly">
        <BezierCanvasEdge {...createEdgeProps({ selected: true })} />
      </CanvasRenderModeContext>,
      {
        selection: { nodeIds: new Set<string>(), edgeIds: new Set(['edge-1']) },
      },
    )

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-visual-selected', 'false')
    expect(getPrimaryPath()).toHaveStyle({
      opacity: String(defaultEdgeOpacity),
      stroke: 'var(--foreground)',
      strokeWidth: String(screenMinimumStrokeWidthCss(defaultEdgeStrokeWidth)),
      strokeLinecap: 'square',
      strokeLinejoin: 'round',
    })
    expect(screen.queryByTestId('canvas-edge-interaction')).toBeNull()
    expect(screen.queryByTestId('canvas-edge-selection-highlight')).toBeNull()
  })

  it('anchors the curve to node bounds instead of render-prop handle coordinates when nodes are available', () => {
    const nodes: Array<CanvasDocumentNode> = [
      {
        id: 'source',
        type: 'text',
        position: { x: 10, y: 20 },
        width: 80,
        height: 40,
        data: {},
      },
      {
        id: 'target',
        type: 'text',
        position: { x: 200, y: 20 },
        width: 80,
        height: 40,
        data: {},
      },
    ]

    renderEdge(
      <BezierCanvasEdge
        {...createEdgeProps(
          { selected: false },
          {
            sourceX: 999,
            sourceY: 999,
            targetX: 1999,
            targetY: 1999,
          },
        )}
      />,
      { nodes },
    )

    const geometry = buildBezierCanvasEdgeGeometryFromEdge(
      {
        id: 'edge-1',
        type: 'bezier',
        source: 'source',
        target: 'target',
        sourceHandle: 'right',
        targetHandle: 'left',
      },
      new Map(nodes.map((node) => [node.id, node] as const)),
    )

    expect(geometry).not.toBeNull()
    expect(getPrimaryPath()).toHaveAttribute('d', geometry?.path)
  })

  it('falls back to render-prop geometry when endpoint nodes are unavailable', () => {
    const props = createEdgeProps(
      { selected: false },
      {
        sourceX: 25,
        sourceY: 35,
        targetX: 155,
        targetY: 75,
      },
    )

    renderEdge(<BezierCanvasEdge {...props} />)

    expect(getPrimaryPath()).toHaveAttribute(
      'd',
      buildBezierCanvasEdgeGeometryFromRenderProps(props).path,
    )
  })
})

function createEdgeProps(
  { selected }: { selected: boolean },
  overrides: Partial<CanvasEdgeRendererProps<'bezier'>> = {},
): CanvasEdgeRendererProps<'bezier'> {
  return {
    id: 'edge-1',
    type: 'bezier',
    source: 'source',
    target: 'target',
    sourceX: 40,
    sourceY: 20,
    targetX: 160,
    targetY: 20,
    sourcePosition: CANVAS_HANDLE_POSITION.Right,
    targetPosition: CANVAS_HANDLE_POSITION.Left,
    style: undefined,
    sourceHandleId: 'right',
    targetHandleId: 'left',
    ...overrides,
    selected: overrides.selected ?? selected,
  }
}

function renderEdge(
  ui: ReactElement,
  {
    nodes = [],
    pendingPreview = null,
    remoteEdgeHighlights = new Map(),
    selection = { nodeIds: new Set<string>(), edgeIds: new Set<string>() },
  }: {
    nodes?: Array<CanvasDocumentNode>
    pendingPreview?: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> } | null
    remoteEdgeHighlights?: ReadonlyMap<string, { color: string; name: string }>
    selection?: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> }
  } = {},
) {
  const domRuntime = createCanvasDomRuntime()
  const engine = createCanvasEngine({ domRuntime })
  engine.setDocumentSnapshot({ nodes })
  engine.setSelection(selection)
  if (pendingPreview) {
    engine.setSelectionGesturePreview(pendingPreview)
  }

  return render(
    <CanvasEngineProvider engine={engine}>
      <CanvasRenderModeContext value="interactive">
        <CanvasRuntimeProvider
          {...createCanvasRuntime({
            canEdit: false,
            canvasEngine: engine,
            domRuntime,
            remoteEdgeHighlights: new Map(remoteEdgeHighlights),
          })}
        >
          <svg>{ui}</svg>
        </CanvasRuntimeProvider>
      </CanvasRenderModeContext>
    </CanvasEngineProvider>,
  )
}

function getPrimaryPath() {
  return screen.getByTestId('canvas-edge-primary-path') as unknown as SVGPathElement
}
