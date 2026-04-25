import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CanvasAwarenessHost } from '../canvas-awareness-host'
import { CanvasLocalOverlaysHost } from '../canvas-local-overlays-host'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasEngine } from '../../system/canvas-engine'

vi.mock('../../tools/canvas-tool-modules', () => ({
  canvasToolAwarenessLayers: [
    {
      key: 'select',
      Layer: () => <div data-testid="tool-awareness-layer" />,
    },
  ],
  canvasToolLocalOverlayLayers: [
    {
      key: 'select',
      Layer: () => <div data-testid="tool-local-overlay-layer" />,
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
    const subscribeSpy = vi.spyOn(canvasEngine, 'subscribe')
    const registerSpy = vi.spyOn(canvasEngine, 'registerViewportOverlayElement')

    render(
      <CanvasEngineProvider engine={canvasEngine}>
        <CanvasAwarenessHost remoteUsers={[]} />
      </CanvasEngineProvider>,
    )

    const transformedLayerContainer = screen.getByTestId('awareness-layer-container')
    expect(transformedLayerContainer).toHaveStyle({
      transform: 'translate3d(12px, 34px, 0) scale(2)',
      transformOrigin: '0 0',
    })
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(subscribeSpy).not.toHaveBeenCalled()
  })

  it('applies viewport transforms to local overlays through the DOM scheduler', () => {
    const canvasEngine = createCanvasEngine()
    canvasEngine.setViewport({ x: -20, y: 8, zoom: 0.75 })
    const subscribeSpy = vi.spyOn(canvasEngine, 'subscribe')

    render(
      <CanvasEngineProvider engine={canvasEngine}>
        <CanvasLocalOverlaysHost />
      </CanvasEngineProvider>,
    )

    const localOverlayLayer = screen.getByTestId('tool-local-overlay-layer')
    const transformedLayerContainer = localOverlayLayer.parentElement
    if (!transformedLayerContainer) {
      throw new Error('Expected local overlay layer to have a transform container')
    }
    expect(transformedLayerContainer).toHaveStyle({
      transform: 'translate3d(-20px, 8px, 0) scale(0.75)',
      transformOrigin: '0 0',
    })
    expect(subscribeSpy).not.toHaveBeenCalled()
  })
})
