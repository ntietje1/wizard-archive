import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasAwarenessHost } from '../canvas-awareness-host'
import * as canvasNodeRegistry from '../../nodes/canvas-node-registry'
import * as canvasToolModules from '../../tools/canvas-tool-modules'

const viewportMock = vi.hoisted(() => ({
  x: 12,
  y: 34,
  zoom: 2,
}))

vi.mock('@xyflow/react', () => ({
  useViewport: () => viewportMock,
}))

describe('CanvasAwarenessHost', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders tool and node awareness layers from the registry selectors', () => {
    vi.spyOn(canvasToolModules, 'getCanvasToolAwarenessLayers').mockReturnValue([
      {
        key: 'select',
        Layer: () => <div data-testid="tool-awareness-layer" />,
      },
    ])
    vi.spyOn(canvasNodeRegistry, 'getCanvasNodeAwarenessLayers').mockReturnValue([
      {
        key: 'text',
        Layer: () => <div data-testid="node-awareness-layer" />,
      },
    ])

    render(<CanvasAwarenessHost remoteUsers={[]} />)

    expect(screen.getByTestId('tool-awareness-layer')).toBeVisible()
    expect(screen.getByTestId('node-awareness-layer')).toBeVisible()
  })

  it('applies the current viewport transform to the awareness layer container', () => {
    vi.spyOn(canvasToolModules, 'getCanvasToolAwarenessLayers').mockReturnValue([])
    vi.spyOn(canvasNodeRegistry, 'getCanvasNodeAwarenessLayers').mockReturnValue([])

    const { getByTestId } = render(<CanvasAwarenessHost remoteUsers={[]} />)

    const transformedLayerContainer = getByTestId('awareness-layer-container')
    expect(transformedLayerContainer).toHaveStyle({
      transform: 'translate(12px, 34px) scale(2)',
      transformOrigin: '0 0',
    })
  })
})
