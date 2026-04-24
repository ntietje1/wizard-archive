import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCanvasSurfaceClickGuard } from '../use-canvas-surface-click-guard'

describe('useCanvasSurfaceClickGuard', () => {
  it('blocks exactly one next surface click after suppression is requested', () => {
    const surfaceElement = document.createElement('div')
    const childElement = document.createElement('div')
    const bubbleSpy = vi.fn()
    surfaceElement.appendChild(childElement)
    surfaceElement.addEventListener('click', bubbleSpy)

    const { result } = renderHook(() => useCanvasSurfaceClickGuard({ current: surfaceElement }))

    act(() => {
      result.current.suppressNextSurfaceClick()
    })

    childElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    childElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(bubbleSpy).toHaveBeenCalledTimes(1)
  })

  it('does not block surface clicks unless suppression was explicitly requested', () => {
    const surfaceElement = document.createElement('div')
    const childElement = document.createElement('div')
    const bubbleSpy = vi.fn()
    surfaceElement.appendChild(childElement)
    surfaceElement.addEventListener('click', bubbleSpy)

    renderHook(() => useCanvasSurfaceClickGuard({ current: surfaceElement }))

    childElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(bubbleSpy).toHaveBeenCalledTimes(1)
  })
})
