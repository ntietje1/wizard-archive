import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { CanvasAwarenessHost } from '../canvas-awareness-host'
import { CanvasLocalOverlaysHost } from '../canvas-local-overlays-host'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime'
import { createCanvasRuntime } from '../../runtime/__tests__/canvas-runtime-test-utils'

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

describe('CanvasAwarenessHost', () => {
  it('renders tool awareness layers from the direct awareness exports', () => {
    const runtime = createCanvasRuntime({ canEdit: false })
    try {
      render(
        <CanvasEngineProvider engine={runtime.canvasEngine}>
          <CanvasRuntimeProvider {...runtime}>
            <CanvasAwarenessHost remoteUsers={[]} />
          </CanvasRuntimeProvider>
        </CanvasEngineProvider>,
      )

      expect(screen.getByTestId('tool-awareness-layer')).toBeVisible()
    } finally {
      runtime.canvasEngine.destroy()
      runtime.domRuntime.destroy()
    }
  })

  it('renders awareness layers in a screen-space container without viewport registration', () => {
    const domRuntime = createCanvasDomRuntime()
    const canvasEngine = createCanvasEngine({ domRuntime })
    try {
      canvasEngine.setViewport({ x: 12, y: 34, zoom: 2 })

      render(
        <CanvasEngineProvider engine={canvasEngine}>
          <CanvasRuntimeProvider
            {...createCanvasRuntime({
              canEdit: false,
              canvasEngine,
              domRuntime,
            })}
          >
            <CanvasAwarenessHost remoteUsers={[]} />
          </CanvasRuntimeProvider>
        </CanvasEngineProvider>,
      )

      const layerContainer = screen.getByTestId('awareness-layer-container')
      expect(layerContainer.style.transform).toBe('')
    } finally {
      canvasEngine.destroy()
      domRuntime.destroy()
    }
  })

  it('renders local overlays in a screen-space container without viewport registration', () => {
    const domRuntime = createCanvasDomRuntime()
    const canvasEngine = createCanvasEngine({ domRuntime })
    try {
      canvasEngine.setViewport({ x: -20, y: 8, zoom: 0.75 })

      render(
        <CanvasEngineProvider engine={canvasEngine}>
          <CanvasRuntimeProvider
            {...createCanvasRuntime({
              canEdit: false,
              canvasEngine,
              domRuntime,
            })}
          >
            <CanvasLocalOverlaysHost />
          </CanvasRuntimeProvider>
        </CanvasEngineProvider>,
      )

      expect(screen.getByTestId('tool-local-overlay-layer')).toBeVisible()
      const layerContainer = screen.getByTestId('local-overlay-screen-container')
      expect(layerContainer.style.transform).toBe('')
    } finally {
      canvasEngine.destroy()
      domRuntime.destroy()
    }
  })
})
