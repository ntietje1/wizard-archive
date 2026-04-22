import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MiniMapNode } from '../canvas-minimap-node'
import * as canvasNodeModules from '../../nodes/canvas-node-modules'

const useInternalNodeMock = vi.hoisted(() => vi.fn())

vi.mock('@xyflow/react', () => ({
  useInternalNode: useInternalNodeMock,
}))

describe('MiniMapNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useInternalNodeMock.mockReturnValue({
      id: 'node-1',
      type: 'stroke',
    })
  })

  it('renders a custom minimap node when the registry provides one', () => {
    vi.spyOn(canvasNodeModules, 'renderCanvasNodeMinimap').mockReturnValue(
      <circle data-testid="custom-minimap-node" cx="5" cy="5" r="5" />,
    )

    render(
      <svg>
        <MiniMapNode
          id="node-1"
          x={0}
          y={0}
          width={10}
          height={10}
          color="red"
          borderRadius={0}
          shapeRendering="geometricPrecision"
        />
      </svg>,
    )

    expect(screen.getByTestId('custom-minimap-node')).toBeVisible()
  })

  it('falls back to the default rectangle when the registry has no custom minimap renderer', () => {
    vi.spyOn(canvasNodeModules, 'renderCanvasNodeMinimap').mockReturnValue(null)

    const { container } = render(
      <svg>
        <MiniMapNode
          id="node-1"
          x={1}
          y={2}
          width={30}
          height={40}
          color="red"
          borderRadius={6}
          shapeRendering="geometricPrecision"
        />
      </svg>,
    )

    const rectEl = container.querySelector('rect')
    expect(rectEl).not.toBeNull()
    expect(rectEl!).toHaveAttribute('x', '1')
    expect(rectEl!).toHaveAttribute('y', '2')
    expect(rectEl!).toHaveAttribute('width', '30')
    expect(rectEl!).toHaveAttribute('height', '40')
  })
})
