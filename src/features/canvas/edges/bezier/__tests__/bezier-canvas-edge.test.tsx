import { act, render, screen } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasRenderModeProvider } from '../../../runtime/providers/canvas-render-mode-context'
import { useCanvasSelectionState } from '../../../runtime/selection/use-canvas-selection-state'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from '../../../runtime/selection/use-canvas-pending-selection-preview'
import type { CanvasEdgeRendererProps } from '../../canvas-edge-module-types'
import { DEFAULT_CANVAS_EDGE_STROKE_WIDTH } from '../../shared/canvas-edge-style'
import { BezierCanvasEdge } from '../bezier-canvas-edge'
import { buildBezierCanvasEdgeGeometryFromEdge } from '../bezier-canvas-edge-geometry'
import type { Node } from '@xyflow/react'

const baseEdgeSpy = vi.hoisted(() => vi.fn())
const useNodesMock = vi.hoisted(() => vi.fn(() => [] as Array<Node>))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')

  return {
    ...actual,
    useNodes: () => useNodesMock(),
    BaseEdge: (props: Record<string, unknown>) => {
      baseEdgeSpy(props)
      return <path data-testid="base-edge" />
    },
  }
})

afterEach(() => {
  act(() => {
    clearCanvasPendingSelectionPreview()
    useCanvasSelectionState.getState().reset()
  })
  baseEdgeSpy.mockReset()
  useNodesMock.mockReset()
  useNodesMock.mockReturnValue([])
})

describe('BezierCanvasEdge', () => {
  it('keeps baseline styling when no pending preview is active', () => {
    render(<BezierCanvasEdge {...createEdgeProps({ selected: false })} />)

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute(
      'data-edge-pending-preview-active',
      'false',
    )
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-pending-selected', 'false')
    expect(baseEdgeSpy).toHaveBeenCalledTimes(1)
    expect(baseEdgeSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        style: expect.objectContaining({
          stroke: 'var(--foreground)',
          strokeWidth: DEFAULT_CANVAS_EDGE_STROKE_WIDTH,
          strokeLinecap: 'square',
          strokeLinejoin: 'round',
        }),
      }),
    )
    expect(screen.queryByTestId('canvas-edge-selection-highlight')).toBeNull()
  })

  it('keeps baseline styling when another edge owns the pending preview', () => {
    act(() => {
      setCanvasPendingSelectionPreview({ nodeIds: [], edgeIds: ['other-edge'] })
    })

    render(<BezierCanvasEdge {...createEdgeProps({ selected: false })} />)

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute(
      'data-edge-pending-preview-active',
      'true',
    )
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-pending-selected', 'false')
    expect(baseEdgeSpy).toHaveBeenCalledTimes(1)
    expect(baseEdgeSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        style: expect.objectContaining({
          stroke: 'var(--foreground)',
          strokeWidth: DEFAULT_CANVAS_EDGE_STROKE_WIDTH,
          strokeLinecap: 'square',
          strokeLinejoin: 'round',
        }),
      }),
    )
    expect(screen.queryByTestId('canvas-edge-selection-highlight')).toBeNull()
  })

  it('keeps the edge stroke and adds a thin selected highlight from authoritative selection', () => {
    useCanvasSelectionState.getState().setSelection({ nodeIds: [], edgeIds: ['edge-1'] })
    render(<BezierCanvasEdge {...createEdgeProps({ selected: true })} />)

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-visual-selected', 'true')
    expect(baseEdgeSpy).toHaveBeenCalledTimes(1)
    expect(baseEdgeSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        style: expect.objectContaining({
          stroke: 'var(--foreground)',
          strokeWidth: DEFAULT_CANVAS_EDGE_STROKE_WIDTH,
          strokeLinecap: 'square',
          strokeLinejoin: 'round',
        }),
      }),
    )
    expect(screen.getByTestId('canvas-edge-selection-highlight')).toHaveStyle({
      stroke: 'var(--primary)',
      strokeLinecap: 'square',
      strokeLinejoin: 'round',
    })
  })

  it('preserves custom edge styling while drawing the selected highlight inside it', () => {
    useCanvasSelectionState.getState().setSelection({ nodeIds: [], edgeIds: ['edge-1'] })
    render(
      <BezierCanvasEdge
        {...createEdgeProps(
          { selected: true },
          { style: { stroke: 'var(--t-red)', strokeWidth: 8 } },
        )}
      />,
    )

    expect(baseEdgeSpy).toHaveBeenCalledTimes(1)
    expect(baseEdgeSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        style: expect.objectContaining({
          stroke: 'var(--t-red)',
          strokeWidth: 8,
          strokeLinecap: 'square',
          strokeLinejoin: 'round',
        }),
      }),
    )
    expect(screen.getByTestId('canvas-edge-selection-highlight')).toHaveStyle({
      stroke: 'var(--primary)',
    })
  })

  it('shows lower-opacity local preview styling for pending-selected edges', () => {
    act(() => {
      setCanvasPendingSelectionPreview({ nodeIds: [], edgeIds: ['edge-1'] })
    })

    render(<BezierCanvasEdge {...createEdgeProps({ selected: false })} />)

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute(
      'data-edge-pending-preview-active',
      'true',
    )
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-pending-selected', 'true')
    expect(baseEdgeSpy).toHaveBeenCalledTimes(1)
    expect(baseEdgeSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        style: expect.objectContaining({
          stroke: 'var(--foreground)',
          strokeWidth: DEFAULT_CANVAS_EDGE_STROKE_WIDTH,
          opacity: 0.45,
          strokeLinecap: 'square',
          strokeLinejoin: 'round',
        }),
      }),
    )
    expect(screen.getByTestId('canvas-edge-selection-highlight')).toHaveStyle({
      stroke: 'var(--primary)',
    })
  })

  it('suppresses edge interaction chrome in embedded read-only mode', () => {
    useCanvasSelectionState.getState().setSelection({ nodeIds: [], edgeIds: ['edge-1'] })

    render(
      <CanvasRenderModeProvider mode="embedded-readonly">
        <BezierCanvasEdge {...createEdgeProps({ selected: true })} />
      </CanvasRenderModeProvider>,
    )

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-visual-selected', 'false')
    expect(baseEdgeSpy).toHaveBeenCalledTimes(1)
    expect(baseEdgeSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        interactionWidth: 0,
        style: expect.objectContaining({
          stroke: 'var(--foreground)',
          strokeWidth: DEFAULT_CANVAS_EDGE_STROKE_WIDTH,
          strokeLinecap: 'square',
          strokeLinejoin: 'round',
        }),
      }),
    )
    expect(screen.queryByTestId('canvas-edge-selection-highlight')).toBeNull()
  })

  it('anchors the curve to node bounds instead of render-prop handle coordinates when nodes are available', () => {
    useNodesMock.mockReturnValue([
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
    ])

    render(
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
    )

    const nodes = useNodesMock()
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
    expect(baseEdgeSpy).toHaveBeenCalledTimes(1)
    expect(baseEdgeSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        path: geometry?.path,
      }),
    )
  })
})

function createEdgeProps(
  { selected }: { selected: boolean },
  overrides: Partial<CanvasEdgeRendererProps> = {},
): CanvasEdgeRendererProps {
  return {
    id: 'edge-1',
    type: 'bezier',
    source: 'source',
    target: 'target',
    sourceX: 40,
    sourceY: 20,
    targetX: 160,
    targetY: 20,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    animated: false,
    data: {},
    selectable: true,
    deletable: true,
    style: undefined,
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
    ...overrides,
    selected: overrides.selected ?? selected,
  }
}
