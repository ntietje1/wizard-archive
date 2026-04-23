import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasNodeConnectionHandles } from '../canvas-node-connection-handles'
import { useCanvasToolStore } from '../../../stores/canvas-tool-store'

const reactFlowMock = vi.hoisted(() => ({
  connectionInProgress: false,
}))

vi.mock('@xyflow/react', () => ({
  Handle: ({
    children,
    ...props
  }: {
    children?: ReactNode
    id: string
    type: 'source' | 'target'
    position: string
    'data-testid': string
    'data-selected'?: string
    'data-connection-in-progress'?: string
    className?: string
    style?: React.CSSProperties
  }) => <div {...props}>{children}</div>,
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  },
  useConnection: (selector?: (connection: { inProgress: boolean }) => boolean) =>
    selector ? selector({ inProgress: reactFlowMock.connectionInProgress }) : null,
}))

describe('CanvasNodeConnectionHandles', () => {
  beforeEach(() => {
    reactFlowMock.connectionInProgress = false
    useCanvasToolStore.getState().reset()
  })

  it('keeps handles mounted but inert when the edge tool is inactive', () => {
    render(<CanvasNodeConnectionHandles />)

    expect(screen.getAllByTestId(/canvas-node-handle-/)).toHaveLength(4)
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('opacity-0')
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('pointer-events-none')
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('duration-0')
  })

  it('shows connection-indicator styling during an active edge-tool connection', () => {
    reactFlowMock.connectionInProgress = true
    useCanvasToolStore.getState().setActiveTool('edge')

    render(<CanvasNodeConnectionHandles />)

    expect(screen.getByTestId('canvas-node-handle-top')).toHaveAttribute(
      'data-connection-in-progress',
      'true',
    )
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass(
      '[&.connectionindicator]:opacity-100',
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
