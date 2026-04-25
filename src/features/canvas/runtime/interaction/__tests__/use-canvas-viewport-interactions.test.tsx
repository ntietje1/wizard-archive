import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { createCanvasRuntime } from '../../__tests__/canvas-runtime-test-utils'
import { useCanvasViewportInteractions } from '../use-canvas-viewport-interactions'
import type { CanvasViewportController } from '../../../system/canvas-viewport-controller'

describe('useCanvasViewportInteractions', () => {
  it('routes wheel, middle-button pan, and hand-tool primary pan to the engine viewport', () => {
    const viewportController = createViewportControllerMock()
    const canPrimaryPan = vi.fn(() => true)

    render(<Harness canPrimaryPan={canPrimaryPan} viewportController={viewportController} />)

    const surface = document.querySelector('[data-testid="surface"]') as HTMLElement
    const flow = document.querySelector('.react-flow') as HTMLElement

    flow.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 10 }))
    flow.dispatchEvent(createPointerEvent('pointerdown', { button: 1 }))
    flow.dispatchEvent(createPointerEvent('pointerdown', { button: 0 }))
    surface.dispatchEvent(createPointerEvent('pointerdown', { button: 0 }))

    expect(viewportController.handleWheel).toHaveBeenCalledTimes(1)
    expect(viewportController.handlePanPointerDown).toHaveBeenCalledTimes(2)
  })

  it('captures handled wheel events before React Flow can mutate the viewport', () => {
    const viewportController = createViewportControllerMock()
    vi.mocked(viewportController.handleWheel).mockImplementation((event) => {
      event.preventDefault()
    })
    const reactFlowWheel = vi.fn()

    render(<Harness canPrimaryPan={() => false} viewportController={viewportController} />)

    const flow = document.querySelector('.react-flow') as HTMLElement
    flow.addEventListener('wheel', reactFlowWheel, { passive: true })
    flow.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 10 }))

    expect(viewportController.handleWheel).toHaveBeenCalledTimes(1)
    expect(reactFlowWheel).not.toHaveBeenCalled()
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
      <div className="react-flow" />
    </div>
  )
}

function createViewportControllerMock(): CanvasViewportController {
  return {
    ...createCanvasRuntime().viewportController,
    handleWheel: vi.fn(),
    handlePanPointerDown: vi.fn(),
  }
}

function createPointerEvent(type: string, init: { button: number }): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    button: { value: init.button },
  })
  return event
}
