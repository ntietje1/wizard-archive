import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useMergedRef } from '../ref-utils'

describe('useMergedRef', () => {
  it('cleans up replaced callback refs and object refs', () => {
    const cleanup = vi.fn()
    const firstRef = vi.fn(() => cleanup)
    const objectRef = { current: null as HTMLDivElement | null }
    const firstNode = document.createElement('div')
    const secondNode = document.createElement('div')
    const { result, rerender } = renderHook(
      ({ callbackRef }) => useMergedRef(callbackRef, objectRef),
      { initialProps: { callbackRef: firstRef } },
    )

    const disposeFirst = result.current(firstNode)
    expect(objectRef.current).toBe(firstNode)

    const secondRef = vi.fn()
    rerender({ callbackRef: secondRef })
    disposeFirst?.()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(objectRef.current).toBeNull()

    result.current(secondNode)
    expect(secondRef).toHaveBeenCalledWith(secondNode)
    expect(objectRef.current).toBe(secondNode)
  })
})
