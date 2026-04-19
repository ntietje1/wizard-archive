import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CanvasNodeConnectionHandles } from '../canvas-node-connection-handles'

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
  it('renders one bidirectional handle on all four sides when selected', () => {
    reactFlowMock.connectionInProgress = false
    render(<CanvasNodeConnectionHandles selected />)

    expect(screen.getAllByTestId(/canvas-node-handle-/)).toHaveLength(4)
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveAttribute('data-selected', 'true')
    expect(screen.getByTestId('canvas-node-handle-right')).toHaveClass('pointer-events-auto')
    expect(screen.getByTestId('canvas-node-handle-bottom')).toHaveClass('opacity-100')
    expect(screen.getByTestId('canvas-node-handle-left')).toBeInTheDocument()
  })

  it('keeps handles mounted but visually hidden when not selected', () => {
    reactFlowMock.connectionInProgress = false
    render(<CanvasNodeConnectionHandles selected={false} />)

    expect(screen.getAllByTestId(/canvas-node-handle-/)).toHaveLength(4)
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveAttribute('data-selected', 'false')
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('opacity-0')
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass('pointer-events-none')
  })

  it('shows connection-indicator styling only during an active connection', () => {
    reactFlowMock.connectionInProgress = true
    render(<CanvasNodeConnectionHandles selected={false} />)

    expect(screen.getByTestId('canvas-node-handle-top')).toHaveAttribute(
      'data-connection-in-progress',
      'true',
    )
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveClass(
      '[&.connectionindicator]:opacity-100',
    )
  })
})
