import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CanvasAwarenessHost } from '../canvas-awareness-host'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasEngine } from '../../system/canvas-engine'

vi.mock('../../tools/canvas-tool-modules', () => ({
  canvasToolAwarenessLayers: [
    {
      key: 'select',
      Layer: () => <div data-testid="tool-awareness-layer" />,
    },
  ],
}))

vi.mock('../../nodes/canvas-node-modules', () => ({
  canvasNodeAwarenessLayers: [
    {
      key: 'text',
      Layer: () => <div data-testid="node-awareness-layer" />,
    },
  ],
}))

describe('CanvasAwarenessHost', () => {
  it('renders tool and node awareness layers from the direct awareness exports', () => {
    render(<CanvasAwarenessHost remoteUsers={[]} />)

    expect(screen.getByTestId('tool-awareness-layer')).toBeVisible()
    expect(screen.getByTestId('node-awareness-layer')).toBeVisible()
  })

  it('applies the current viewport transform to the awareness layer container', () => {
    const canvasEngine = createCanvasEngine()
    canvasEngine.setViewport({ x: 12, y: 34, zoom: 2 })

    render(
      <CanvasEngineProvider engine={canvasEngine}>
        <CanvasAwarenessHost remoteUsers={[]} />
      </CanvasEngineProvider>,
    )

    const transformedLayerContainer = screen.getByTestId('awareness-layer-container')
    expect(transformedLayerContainer).toHaveStyle({
      transform: 'translate(12px, 34px) scale(2)',
      transformOrigin: '0 0',
    })
  })
})
