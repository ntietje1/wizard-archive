import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RectCreationLocalOverlayLayer } from '../rect-creation-local-overlay-layer'
import {
  clearRectCreationLocalOverlay,
  setRectCreationDragRect,
} from '../rect-creation-local-overlay'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasEngine } from '../../../system/canvas-engine'

describe('RectCreationLocalOverlayLayer', () => {
  afterEach(() => {
    clearRectCreationLocalOverlay()
  })

  it('projects placement rectangles into screen space with constant stroke width', () => {
    const engine = createCanvasEngine()
    engine.setViewport({ x: -5, y: 8, zoom: 2 })
    setRectCreationDragRect({ x: 10, y: 20, width: 30, height: 40 })

    const { container } = render(
      <CanvasEngineProvider engine={engine}>
        <RectCreationLocalOverlayLayer />
      </CanvasEngineProvider>,
    )

    const rect = container.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(rect!).toHaveAttribute('x', '15')
    expect(rect!).toHaveAttribute('y', '48')
    expect(rect!).toHaveAttribute('width', '60')
    expect(rect!).toHaveAttribute('height', '80')
    expect(rect!).toHaveAttribute('stroke-width', '1.5')
  })
})
