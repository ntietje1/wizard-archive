import { render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useCanvasPointerBridge } from '../use-canvas-pointer-bridge'
import type { CanvasToolHandlers } from '../../../tools/canvas-tool-types'

describe('useCanvasPointerBridge', () => {
  it('routes an accepted tool pointer gesture through window move and release events', () => {
    const handlers: CanvasToolHandlers = {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
    }

    render(<Harness activeToolHandlers={handlers} />)

    screen.getByTestId('canvas-target').dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 0,
        pointerId: 7,
      }),
    )
    window.dispatchEvent(createPointerEvent('pointermove', { button: 0, pointerId: 3 }))
    window.dispatchEvent(createPointerEvent('pointermove', { button: 0, pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointerup', { button: 0, pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointermove', { button: 0, pointerId: 7 }))

    expect(handlers.onPointerDown).toHaveBeenCalledTimes(1)
    expect(handlers.onPointerMove).toHaveBeenCalledTimes(1)
    expect(handlers.onPointerUp).toHaveBeenCalledTimes(1)
  })

  it('blocks native text selection while a tool pointer gesture is active', () => {
    const handlers: CanvasToolHandlers = {
      onPointerDown: vi.fn(),
      onPointerUp: vi.fn(),
    }

    render(<Harness activeToolHandlers={handlers} />)

    screen.getByTestId('canvas-target').dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 0,
        pointerId: 7,
      }),
    )
    const activeSelectStart = new Event('selectstart', { bubbles: true, cancelable: true })
    window.dispatchEvent(activeSelectStart)
    window.dispatchEvent(createPointerEvent('pointerup', { button: 0, pointerId: 7 }))
    const idleSelectStart = new Event('selectstart', { bubbles: true, cancelable: true })
    window.dispatchEvent(idleSelectStart)

    expect(activeSelectStart.defaultPrevented).toBe(true)
    expect(idleSelectStart.defaultPrevented).toBe(false)
  })

  it('keeps routing an active gesture to the handlers that received pointerdown', () => {
    const initialHandlers: CanvasToolHandlers = {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
    }
    const replacementHandlers: CanvasToolHandlers = {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
    }

    const { rerender } = render(<Harness activeToolHandlers={initialHandlers} />)

    screen.getByTestId('canvas-target').dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 0,
        pointerId: 7,
      }),
    )
    rerender(<Harness activeToolHandlers={replacementHandlers} />)
    window.dispatchEvent(createPointerEvent('pointermove', { button: 0, pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointerup', { button: 0, pointerId: 7 }))

    expect(initialHandlers.onPointerDown).toHaveBeenCalledTimes(1)
    expect(initialHandlers.onPointerMove).toHaveBeenCalledTimes(1)
    expect(initialHandlers.onPointerUp).toHaveBeenCalledTimes(1)
    expect(replacementHandlers.onPointerMove).not.toHaveBeenCalled()
    expect(replacementHandlers.onPointerUp).not.toHaveBeenCalled()
  })

  it('does not start a tool gesture from non-canvas targets', () => {
    const handlers: CanvasToolHandlers = {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
    }

    render(<Harness activeToolHandlers={handlers} />)

    screen.getByTestId('outside-target').dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 0,
        pointerId: 7,
      }),
    )
    window.dispatchEvent(createPointerEvent('pointermove', { button: 0, pointerId: 7 }))

    expect(handlers.onPointerDown).not.toHaveBeenCalled()
    expect(handlers.onPointerMove).not.toHaveBeenCalled()
  })
})

function Harness({ activeToolHandlers }: { activeToolHandlers: CanvasToolHandlers }) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  useCanvasPointerBridge({ surfaceRef, activeToolHandlers })

  return (
    <div ref={surfaceRef}>
      <div className="canvas-scene" data-testid="canvas-target" />
      <div data-testid="outside-target" />
    </div>
  )
}

function createPointerEvent(
  type: string,
  init: { button: number; pointerId: number },
): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    button: { value: init.button },
    buttons: { value: 1 },
    pointerId: { value: init.pointerId },
  })
  return event
}
