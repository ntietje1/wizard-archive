import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from '../../../runtime/selection/use-canvas-pending-selection-preview'
import { StrokeNode } from '../stroke-node'

vi.mock('../../shared/resizable-node-wrapper', () => ({
  ResizableNodeWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

afterEach(() => {
  clearCanvasPendingSelectionPreview()
})

describe('StrokeNode', () => {
  it('renders the local stroke highlight for pending-selected strokes', () => {
    setCanvasPendingSelectionPreview(['stroke-1'])
    const { container } = render(<StrokeNode {...createStrokeNodeProps({ selected: false })} />)

    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('drops the local stroke highlight when a pending preview excludes the committed stroke', () => {
    setCanvasPendingSelectionPreview(['other-node'])
    const { container } = render(<StrokeNode {...createStrokeNodeProps({ selected: true })} />)

    expect(container.querySelectorAll('path')).toHaveLength(1)
  })

  it('keeps a single stroke path when a pending preview is active but excludes an unselected stroke', () => {
    setCanvasPendingSelectionPreview([])
    const { container } = render(<StrokeNode {...createStrokeNodeProps({ selected: false })} />)

    expect(container.querySelectorAll('path')).toHaveLength(1)
  })

  it('keeps the highlight path when a pending preview includes an already selected stroke', () => {
    setCanvasPendingSelectionPreview(['stroke-1'])
    const { container } = render(<StrokeNode {...createStrokeNodeProps({ selected: true })} />)

    expect(container.querySelectorAll('path')).toHaveLength(2)
  })
})

function createStrokeNodeProps({ selected }: { selected: boolean }) {
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
