import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeferredRichEmbedActivation } from '../use-rich-embed-lifecycle'
import type {
  PendingRichEmbedActivationRef,
  RichEmbedActivationPayload,
} from '../use-rich-embed-lifecycle'

const { mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
}))

vi.mock('~/shared/utils/logger', () => ({
  logger: {
    warn: (...args: Array<unknown>) => mockLoggerWarn(...args),
  },
}))

describe('useDeferredRichEmbedActivation', () => {
  let queuedFrames: Array<FrameRequestCallback | undefined>
  let requestAnimationFrameSpy: ReturnType<typeof vi.fn>
  let cancelAnimationFrameSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queuedFrames = []
    mockLoggerWarn.mockReset()
    requestAnimationFrameSpy = vi.fn((cb: FrameRequestCallback) => {
      queuedFrames.push(cb)
      return queuedFrames.length
    })
    cancelAnimationFrameSpy = vi.fn((id: number) => {
      queuedFrames[id - 1] = undefined
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameSpy)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('activates once readiness becomes available and clears pending activation', () => {
    const pendingActivationRef = createPendingActivationRef({ point: { x: 30, y: 40 } })
    const onActivate = vi.fn()
    let ready = false

    renderHook(() =>
      useDeferredRichEmbedActivation({
        pendingActivationRef,
        editable: true,
        isReady: () => ready,
        onActivate,
      }),
    )

    act(() => {
      queuedFrames.shift()?.(0)
    })
    expect(onActivate).not.toHaveBeenCalled()
    expect(pendingActivationRef.current).toEqual({ point: { x: 30, y: 40 } })

    ready = true
    act(() => {
      queuedFrames.shift()?.(1)
    })

    expect(onActivate).toHaveBeenCalledWith({ point: { x: 30, y: 40 } })
    expect(pendingActivationRef.current).toBeNull()
  })

  it('logs a retry-limit warning and preserves pending activation when readiness never arrives', () => {
    const pendingActivationRef = createPendingActivationRef({ point: { x: 30, y: 40 } })
    const onActivate = vi.fn()

    renderHook(() =>
      useDeferredRichEmbedActivation({
        pendingActivationRef,
        editable: true,
        isReady: () => false,
        onActivate,
      }),
    )

    act(() => {
      for (let index = 0; index <= 10; index += 1) {
        queuedFrames.shift()?.(index)
      }
    })

    expect(onActivate).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'useDeferredRichEmbedActivation: rich embed did not become ready within retry limit',
    )
    expect(pendingActivationRef.current).toEqual({ point: { x: 30, y: 40 } })
  })

  it('clears pending activation when editing becomes disabled', () => {
    const pendingActivationRef = createPendingActivationRef({ point: { x: 30, y: 40 } })
    const onActivate = vi.fn()

    const { rerender } = renderHook(
      ({ editable }: { editable: boolean }) =>
        useDeferredRichEmbedActivation({
          pendingActivationRef,
          editable,
          isReady: () => false,
          onActivate,
        }),
      { initialProps: { editable: true } },
    )

    rerender({ editable: false })

    expect(pendingActivationRef.current).toBeNull()
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('uses latest callbacks without restarting scheduled activation', () => {
    const pendingActivationRef = createPendingActivationRef({ point: { x: 30, y: 40 } })
    const firstActivate = vi.fn()
    const secondActivate = vi.fn()
    const initialProps: {
      isReady: () => boolean
      onActivate: (payload: RichEmbedActivationPayload | null) => void
    } = {
      isReady: () => false,
      onActivate: firstActivate,
    }

    const { rerender } = renderHook(
      ({
        isReady,
        onActivate,
      }: {
        isReady: () => boolean
        onActivate: (payload: RichEmbedActivationPayload | null) => void
      }) =>
        useDeferredRichEmbedActivation({
          pendingActivationRef,
          editable: true,
          isReady,
          onActivate,
        }),
      { initialProps },
    )

    rerender({
      isReady: () => true,
      onActivate: secondActivate,
    })

    expect(cancelAnimationFrameSpy).not.toHaveBeenCalled()

    act(() => {
      queuedFrames.shift()?.(0)
    })

    expect(firstActivate).not.toHaveBeenCalled()
    expect(secondActivate).toHaveBeenCalledWith({ point: { x: 30, y: 40 } })
    expect(pendingActivationRef.current).toBeNull()
  })

  it('cancels scheduled activation on unmount', () => {
    const pendingActivationRef = createPendingActivationRef({ point: { x: 30, y: 40 } })
    const onActivate = vi.fn()

    const { unmount } = renderHook(() =>
      useDeferredRichEmbedActivation({
        pendingActivationRef,
        editable: true,
        isReady: () => true,
        onActivate,
      }),
    )

    unmount()
    act(() => {
      queuedFrames.forEach((frame) => frame?.(0))
    })

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1)
    expect(onActivate).not.toHaveBeenCalled()
    expect(pendingActivationRef.current).toEqual({ point: { x: 30, y: 40 } })
  })
})

function createPendingActivationRef(
  current: RichEmbedActivationPayload | null,
): PendingRichEmbedActivationRef {
  return { current }
}
