import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSelectionState } from '../../../runtime/selection/use-canvas-selection-state'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from '../../../runtime/selection/use-canvas-pending-selection-preview'
import { StrokeNode } from '../stroke-node'

const connectionHandlesSpy = vi.hoisted(() => vi.fn())

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ zoom: 1 }),
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  },
}))

vi.mock('../../shared/resizable-node-wrapper', () => ({
  ResizableNodeWrapper: ({ children, chrome }: { children: ReactNode; chrome?: ReactNode }) => (
    <div>
      {chrome}
      {children}
    </div>
  ),
}))

vi.mock('../../shared/canvas-node-connection-handles', () => ({
  CanvasNodeConnectionHandles: (props: unknown) => {
    connectionHandlesSpy(props)
    return <div data-testid="stroke-connection-handles" />
  },
}))

afterEach(() => {
  clearCanvasPendingSelectionPreview()
  useCanvasSelectionState.getState().reset()
  connectionHandlesSpy.mockReset()
})

describe('StrokeNode', () => {
  it('renders the local stroke highlight for pending-selected strokes', () => {
    setCanvasPendingSelectionPreview({ nodeIds: ['stroke-1'], edgeIds: [] })
    const { container, getByTestId } = render(
      <StrokeNode {...setupStrokeNodeProps({ selected: false })} />,
    )

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(3)
  })

  it('drops the local stroke highlight when a pending preview excludes the committed stroke', () => {
    setCanvasPendingSelectionPreview({ nodeIds: ['other-node'], edgeIds: [] })
    const { container, getByTestId } = render(
      <StrokeNode {...setupStrokeNodeProps({ selected: true })} />,
    )

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('keeps two paths (stroke and hit target) when a pending preview excludes an unselected stroke', () => {
    setCanvasPendingSelectionPreview({ nodeIds: [], edgeIds: [] })
    const { container, getByTestId } = render(
      <StrokeNode {...setupStrokeNodeProps({ selected: false })} />,
    )

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('keeps the highlight path when a pending preview includes an already selected stroke', () => {
    setCanvasPendingSelectionPreview({ nodeIds: ['stroke-1'], edgeIds: [] })
    const { container, getByTestId } = render(
      <StrokeNode {...setupStrokeNodeProps({ selected: true })} />,
    )

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(3)
  })

  it('passes only start and end connection handles at the stroke endpoints', () => {
    render(<StrokeNode {...setupStrokeNodeProps({ selected: false })} />)

    expect(connectionHandlesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        handles: [
          expect.objectContaining({
            id: 'start',
            position: 'left',
            style: expect.objectContaining({ left: 0, top: 10 }),
          }),
          expect.objectContaining({
            id: 'end',
            position: 'right',
            style: expect.objectContaining({ left: 100, top: 10 }),
          }),
        ],
      }),
    )
  })

  it('still renders a visible stroke path when legacy stroke data has size zero', () => {
    const { container, getByTestId } = render(
      <StrokeNode {...setupStrokeNodeProps({ selected: false, size: 0 })} />,
    )

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })
})

function setupStrokeNodeProps({ selected, size = 4 }: { selected: boolean; size?: number }) {
  useCanvasSelectionState.getState().setSelection({
    nodeIds: selected ? ['stroke-1'] : [],
    edgeIds: [],
  })

  return {
    id: 'stroke-1',
    selected,
    dragging: false,
    width: 100,
    height: 20,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    isConnectable: false,
    draggable: true,
    selectable: true,
    deletable: true,
    zIndex: 1,
    type: 'stroke',
    data: {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      points: [
        [0, 10, 0.5],
        [100, 10, 0.5],
      ] as Array<[number, number, number]>,
      color: 'var(--foreground)',
      size,
    },
  }
}
