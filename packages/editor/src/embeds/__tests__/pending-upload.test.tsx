import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { runWithPendingEmbedUpload, usePendingEmbedUpload } from '../pending-upload'

describe('pending embed uploads', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('publishes transient upload state until the matching operation finishes', async () => {
    const { result } = renderHook(() => usePendingEmbedUpload('note', 'embed-1'))

    expect(result.current).toBeNull()

    const operation = createDeferred<void>()
    let execution!: Promise<void>
    act(() => {
      execution = runWithPendingEmbedUpload(
        'note',
        'embed-1',
        'portrait.png',
        () => operation.promise,
      )
    })

    expect(result.current?.fileName).toBe('portrait.png')

    act(() => operation.resolve())
    await act(() => execution)

    expect(result.current).toBeNull()
  })

  it('does not let an older operation clear a newer upload for the same embed', async () => {
    const { result } = renderHook(() => usePendingEmbedUpload('canvas', 'embed-1'))

    const first = createDeferred<void>()
    const second = createDeferred<void>()
    let firstExecution!: Promise<void>
    let secondExecution!: Promise<void>
    act(() => {
      firstExecution = runWithPendingEmbedUpload(
        'canvas',
        'embed-1',
        'first.png',
        () => first.promise,
      )
      secondExecution = runWithPendingEmbedUpload(
        'canvas',
        'embed-1',
        'second.png',
        () => second.promise,
      )
    })

    act(() => first.resolve())
    await act(() => firstExecution)
    expect(result.current?.fileName).toBe('second.png')

    act(() => second.resolve())
    await act(() => secondExecution)
    expect(result.current).toBeNull()
  })

  it('keeps immediately completed uploads pending through a browser paint', async () => {
    const animationFrames: Array<FrameRequestCallback> = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })
    const { result } = renderHook(() => usePendingEmbedUpload('note', 'embed-fast'))

    let execution!: Promise<void>
    act(() => {
      execution = runWithPendingEmbedUpload('note', 'embed-fast', 'small.png', () =>
        Promise.resolve(),
      )
    })
    await Promise.resolve()

    expect(result.current?.fileName).toBe('small.png')

    act(() => animationFrames.shift()?.(0))
    expect(result.current?.fileName).toBe('small.png')

    act(() => animationFrames.shift()?.(16))
    await act(() => execution)
    expect(result.current).toBeNull()
  })
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}
