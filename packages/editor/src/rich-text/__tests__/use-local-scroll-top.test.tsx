import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useLocalScrollTop } from '../use-local-scroll-top'

describe('useLocalScrollTop', () => {
  it('tracks the latest viewport scroll position', () => {
    const viewport = document.createElement('div')

    const { result } = renderHook(() => useLocalScrollTop({ current: viewport }))

    act(() => {
      viewport.scrollTop = 128
      viewport.dispatchEvent(new Event('scroll'))
    })

    expect(result.current.current).toBe(128)
  })

  it('removes its scroll listener on unmount', () => {
    const viewport = document.createElement('div')
    const removeEventListener = vi.spyOn(viewport, 'removeEventListener')

    const { unmount } = renderHook(() => useLocalScrollTop({ current: viewport }))

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
