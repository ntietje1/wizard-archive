import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { useCanvasViewportInteractions } from '../use-canvas-viewport-interactions'
import type { CanvasViewportController } from '../../../system/canvas-viewport-controller'

describe('useCanvasViewportInteractions', () => {
  it('routes wheel, middle-button pan, and hand-tool primary pan to the engine viewport', () => {
    const viewportController = createViewportControllerMock()
    const canPrimaryPan = vi.fn(() => true)

    render(<Harness canPrimaryPan={canPrimaryPan} viewportController={viewportController} />)

    const surface = document.querySelector('[data-testid="surface"]') as HTMLElement
    const scene = document.querySelector('.canvas-scene') as HTMLElement

    scene.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 10 }))
    scene.dispatchEvent(createPointerEvent('pointerdown', { button: 1 }))
    scene.dispatchEvent(createPointerEvent('pointerdown', { button: 0 }))
    surface.dispatchEvent(createPointerEvent('pointerdown', { button: 0 }))

    expect(viewportController.handleWheel).toHaveBeenCalledTimes(1)
    expect(viewportController.handlePanPointerDown).toHaveBeenCalledTimes(2)
  })

  it('captures handled wheel events before scene bubble handlers observe them', () => {
    const viewportController = createViewportControllerMock()
    vi.mocked(viewportController.handleWheel).mockImplementation((event) => {
      event.preventDefault()
    })
    const sceneWheel = vi.fn()

    render(<Harness canPrimaryPan={() => false} viewportController={viewportController} />)

    const scene = document.querySelector('.canvas-scene') as HTMLElement
    scene.addEventListener('wheel', sceneWheel, { passive: true })
    scene.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 10 }))

    expect(viewportController.handleWheel).toHaveBeenCalledTimes(1)
    expect(sceneWheel).not.toHaveBeenCalled()
  })
})

function Harness({
  canPrimaryPan,
  viewportController,
}: {
  canPrimaryPan: () => boolean
  viewportController: CanvasViewportController
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useCanvasViewportInteractions({ canPrimaryPan, ref, viewportController })

  return (
    <div ref={ref} data-testid="surface">
      <div className="canvas-scene" />
    </div>
  )
}

function createViewportControllerMock(): CanvasViewportController {
  return {
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    getZoom: vi.fn(() => 1),
    screenToCanvasPosition: vi.fn((position) => position),
    canvasToScreenPosition: vi.fn((position) => position),
    handleWheel: vi.fn(),
    handlePanPointerDown: vi.fn(),
    panBy: vi.fn(),
    zoomBy: vi.fn(),
    zoomTo: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
    syncFromDocumentOrAdapter: vi.fn(),
    setZoomBounds: vi.fn(),
    commit: vi.fn(),
    destroy: vi.fn(),
  }
}

function createPointerEvent(type: string, init: { button: number }): PointerEvent {
  if (typeof PointerEvent !== 'undefined') {
    return new PointerEvent(type, {
      bubbles: true,
      button: init.button,
      cancelable: true,
    })
  }

  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperty(event, 'button', { value: init.button })
  return event
}
