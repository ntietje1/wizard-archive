import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSelectionState } from '../../../runtime/selection/use-canvas-selection-state'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from '../../../runtime/selection/use-canvas-pending-selection-preview'
import { StrokeNode } from '../stroke-node'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ zoom: 1 }),
}))

vi.mock('../../shared/resizable-node-wrapper', () => ({
  ResizableNodeWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

afterEach(() => {
  clearCanvasPendingSelectionPreview()
  useCanvasSelectionState.getState().reset()
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
})

function setupStrokeNodeProps({ selected }: { selected: boolean }) {
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
      size: 4,
    },
  }
}
