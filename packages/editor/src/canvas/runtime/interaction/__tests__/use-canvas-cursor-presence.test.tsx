import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useCanvasCursorPresence } from '../use-canvas-cursor-presence'

describe('useCanvasCursorPresence', () => {
  it('updates local cursor presence on mouse move', () => {
    const awareness = createAwarenessMock()
    const { result } = renderHook(() =>
      useCanvasCursorPresence({
        screenToCanvasPosition: (position) => ({ x: position.x * 2, y: position.y * 2 }),
        awareness,
      }),
    )

    act(() => {
      result.current.onMouseMove({ clientX: 8, clientY: 12 } as never)
    })

    expect(awareness.setLocalCursor).toHaveBeenCalledWith({ x: 16, y: 24 })
  })

  it('clears local cursor presence immediately on mouse leave', () => {
    const awareness = createAwarenessMock()
    const { result } = renderHook(() =>
      useCanvasCursorPresence({
        screenToCanvasPosition: (position) => position,
        awareness,
      }),
    )

    act(() => {
      result.current.onMouseMove({ clientX: 8, clientY: 12 } as never)
      result.current.onMouseLeave()
    })

    expect(awareness.setLocalCursor).toHaveBeenLastCalledWith(null)
  })

  it('clears local cursor presence on unmount', () => {
    const awareness = createAwarenessMock()
    const { unmount } = renderHook(() =>
      useCanvasCursorPresence({
        screenToCanvasPosition: (position) => position,
        awareness,
      }),
    )

    unmount()

    expect(awareness.setLocalCursor).toHaveBeenCalledWith(null)
  })
})

function createAwarenessMock() {
  return {
    setLocalCursor: vi.fn(),
    setLocalResizing: vi.fn(),
    setLocalSelection: vi.fn(),
  }
}
