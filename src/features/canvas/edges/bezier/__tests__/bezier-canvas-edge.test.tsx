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
import { BezierCanvasEdge } from '../bezier-canvas-edge'

const baseEdgeSpy = vi.hoisted(() => vi.fn())

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')

  return {
    ...actual,
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
})

describe('BezierCanvasEdge', () => {
  it('keeps baseline styling when no pending preview is active', () => {
    render(<BezierCanvasEdge {...createEdgeProps({ selected: false })} />)

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute(
      'data-edge-pending-preview-active',
      'false',
    )
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-pending-selected', 'false')
    expect(baseEdgeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        style: undefined,
      }),
    )
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
    expect(baseEdgeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        style: undefined,
      }),
    )
  })

  it('shows committed selected styling from authoritative edge selection', () => {
    useCanvasSelectionState.getState().setSelection({ nodeIds: [], edgeIds: ['edge-1'] })
    render(<BezierCanvasEdge {...createEdgeProps({ selected: true })} />)

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-visual-selected', 'true')
    expect(baseEdgeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          stroke: 'var(--primary)',
          strokeWidth: 1.5,
        }),
      }),
    )
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
    expect(baseEdgeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          opacity: 0.45,
        }),
      }),
    )
  })

  it('suppresses edge interaction chrome in embedded read-only mode', () => {
    useCanvasSelectionState.getState().setSelection({ nodeIds: [], edgeIds: ['edge-1'] })

    render(
      <CanvasRenderModeProvider mode="embedded-readonly">
        <BezierCanvasEdge {...createEdgeProps({ selected: true })} />
      </CanvasRenderModeProvider>,
    )

    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-edge-visual-selected', 'false')
    expect(baseEdgeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionWidth: 0,
        style: undefined,
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
