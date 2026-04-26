import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CanvasNodeConnectionHandles } from '../canvas-node-connection-handles'
import { useCanvasToolStore } from '../../../stores/canvas-tool-store'

describe('CanvasNodeConnectionHandles', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
  })

  it('keeps handles mounted but inert when the edge tool is inactive', () => {
    render(<CanvasNodeConnectionHandles />)

    expect(screen.getAllByTestId(/canvas-node-handle-/)).toHaveLength(4)
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('opacity-0')
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('pointer-events-none')
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('duration-0')
  })

  it('marks handles visible while the edge tool is active', () => {
    useCanvasToolStore.getState().setActiveTool('edge')

    render(<CanvasNodeConnectionHandles />)

    expect(screen.getByTestId('canvas-node-handle-top')).toHaveAttribute(
      'data-handles-visible',
      'true',
    )
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('duration-150')
  })

  it('shows all handles while the edge tool is active even without node selection', () => {
    useCanvasToolStore.getState().setActiveTool('edge')

    render(<CanvasNodeConnectionHandles />)

    expect(screen.getByTestId('canvas-node-handle-top')).toHaveAttribute(
      'data-edge-tool-active',
      'true',
    )
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass(
      'canvas-node-connection-handle',
    )
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('pointer-events-auto')
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('opacity-100')
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('duration-150')
  })
})
