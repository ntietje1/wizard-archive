import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { CanvasLocalOverlaysHost } from '../canvas-local-overlays-host'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime'
import { createCanvasRuntime } from '../../runtime/__tests__/canvas-runtime-test-utils'
import { createCanvasToolLocalOverlayStore } from '../../stores/canvas-tool-local-overlay-store'

describe('CanvasLocalOverlaysHost runtime scope', () => {
  it('renders local drawing previews only for the owning runtime', () => {
    const firstRuntime = createCanvasRuntime({ canEdit: false })
    const secondRuntime = createCanvasRuntime({ canEdit: false })
    const firstOverlayStore = createCanvasToolLocalOverlayStore()
    const secondOverlayStore = createCanvasToolLocalOverlayStore()

    try {
      firstOverlayStore.getState().setDrawLocalDrawing({
        points: [
          [0, 0, 0.5],
          [20, 20, 0.5],
        ],
        color: '#ff0000',
        opacity: 100,
        size: 4,
      })

      render(
        <>
          <CanvasEngineProvider engine={firstRuntime.canvasEngine}>
            <CanvasRuntimeProvider {...firstRuntime} localOverlayStore={firstOverlayStore}>
              <div data-testid="first-runtime">
                <CanvasLocalOverlaysHost />
              </div>
            </CanvasRuntimeProvider>
          </CanvasEngineProvider>
          <CanvasEngineProvider engine={secondRuntime.canvasEngine}>
            <CanvasRuntimeProvider {...secondRuntime} localOverlayStore={secondOverlayStore}>
              <div data-testid="second-runtime">
                <CanvasLocalOverlaysHost />
              </div>
            </CanvasRuntimeProvider>
          </CanvasEngineProvider>
        </>,
      )

      expect(screen.getByTestId('first-runtime').querySelector('path')).not.toBeNull()
      expect(screen.getByTestId('second-runtime').querySelector('path')).toBeNull()
    } finally {
      firstRuntime.canvasEngine.destroy()
      firstRuntime.domRuntime.destroy()
      secondRuntime.canvasEngine.destroy()
      secondRuntime.domRuntime.destroy()
    }
  })
})
