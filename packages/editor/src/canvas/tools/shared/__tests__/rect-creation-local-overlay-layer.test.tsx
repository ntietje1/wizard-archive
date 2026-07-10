import { render } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { RectCreationLocalOverlayLayer } from '../rect-creation-local-overlay-layer'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { createCanvasToolLocalOverlayStore } from '../../../stores/canvas-tool-local-overlay-store'

describe('RectCreationLocalOverlayLayer', () => {
  it('projects placement rectangles into screen space with constant stroke width', () => {
    const runtime = createCanvasRuntime({ canEdit: false })
    runtime.canvasEngine.setViewport({ x: -5, y: 8, zoom: 2 })
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    localOverlayStore.getState().setRectCreationDragRect({ x: 10, y: 20, width: 30, height: 40 })

    const { container } = render(
      <CanvasEngineProvider engine={runtime.canvasEngine}>
        <CanvasRuntimeProvider {...runtime} localOverlayStore={localOverlayStore}>
          <RectCreationLocalOverlayLayer />
        </CanvasRuntimeProvider>
      </CanvasEngineProvider>,
    )

    const rect = container.querySelector('rect')
    expect(rect).not.toBeNull()
    if (typeof SVGRectElement === 'undefined') {
      expect(rect?.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(rect?.tagName.toLowerCase()).toBe('rect')
    } else {
      expect(rect).toBeInstanceOf(SVGRectElement)
    }
    const rectEl = rect as SVGRectElement
    expect(rectEl).toHaveAttribute('x', '15')
    expect(rectEl).toHaveAttribute('y', '48')
    expect(rectEl).toHaveAttribute('width', '60')
    expect(rectEl).toHaveAttribute('height', '80')
    expect(rectEl).toHaveAttribute('stroke-width', '1.5')
  })
})
