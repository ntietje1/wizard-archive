import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CanvasDragSnapOverlay } from '../canvas-drag-snap-overlay'
import {
  clearCanvasDragSnapGuides,
  setCanvasDragSnapGuides,
} from '../../runtime/interaction/canvas-drag-snap-overlay'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasEngine } from '../../system/canvas-engine'

afterEach(() => {
  clearCanvasDragSnapGuides()
})

describe('CanvasDragSnapOverlay', () => {
  it('projects guide endpoints into screen space with constant stroke width', () => {
    const engine = createCanvasEngine()
    engine.setViewport({ x: 5, y: -10, zoom: 2 })
    setCanvasDragSnapGuides([
      { orientation: 'vertical', position: 10, start: 20, end: 40 },
      { orientation: 'horizontal', position: 50, start: 60, end: 80 },
    ])

    const { container } = render(
      <CanvasEngineProvider engine={engine}>
        <CanvasDragSnapOverlay />
      </CanvasEngineProvider>,
    )

    const lines = container.querySelectorAll('line')
    expect(lines).toHaveLength(2)
    const [vertical, horizontal] = lines
    expect(vertical).toHaveAttribute('x1', '25')
    expect(vertical).toHaveAttribute('y1', '30')
    expect(vertical).toHaveAttribute('x2', '25')
    expect(vertical).toHaveAttribute('y2', '70')
    expect(vertical).toHaveAttribute('stroke-width', '1.5')
    expect(horizontal).toHaveAttribute('x1', '125')
    expect(horizontal).toHaveAttribute('y1', '90')
    expect(horizontal).toHaveAttribute('x2', '165')
    expect(horizontal).toHaveAttribute('y2', '90')
    expect(horizontal).toHaveAttribute('stroke-width', '1.5')
  })
})
