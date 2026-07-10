import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeferredRichEmbedActivation } from '../deferred-activation'
import type {
  PendingRichEmbedActivationRef,
  RichEmbedActivationTarget,
} from '../deferred-activation'

const { consoleWarnSpy } = vi.hoisted(() => ({
  consoleWarnSpy: vi.fn(),
}))

describe('useDeferredRichEmbedActivation', () => {
  let queuedFrames: Array<FrameRequestCallback | undefined>
  let requestAnimationFrameSpy: ReturnType<typeof vi.fn>
  let cancelAnimationFrameSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queuedFrames = []
    consoleWarnSpy.mockReset()
    vi.spyOn(console, 'warn').mockImplementation((...args: Array<unknown>) =>
      consoleWarnSpy(...args),
    )
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
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('activates once readiness becomes available and clears pending activation', () => {
    const target = pointActivation(30, 40)
    const pendingActivationRef = createPendingActivationRef(target)
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
    expect(pendingActivationRef.current).toEqual(target)

    ready = true
    act(() => {
      queuedFrames.shift()?.(1)
    })

    expect(onActivate).toHaveBeenCalledWith(target)
    expect(pendingActivationRef.current).toBeNull()
  })

  it('logs a retry-limit warning and clears pending activation when readiness never arrives', () => {
    const target = pointActivation(30, 40)
    const pendingActivationRef = createPendingActivationRef(target)
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
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'useDeferredRichEmbedActivation: rich embed did not become ready within retry limit',
    )
    expect(pendingActivationRef.current).toBeNull()
  })

  it('clears pending activation when editing becomes disabled', () => {
    const pendingActivationRef = createPendingActivationRef(pointActivation(30, 40))
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
    const target = pointActivation(30, 40)
    const pendingActivationRef = createPendingActivationRef(target)
    const firstActivate = vi.fn()
    const secondActivate = vi.fn()
    const initialProps: {
      isReady: () => boolean
      onActivate: (target: RichEmbedActivationTarget) => void
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
        onActivate: (target: RichEmbedActivationTarget) => void
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
    expect(secondActivate).toHaveBeenCalledWith(target)
    expect(pendingActivationRef.current).toBeNull()
  })

  it('cancels scheduled activation on unmount', () => {
    const target = pointActivation(30, 40)
    const pendingActivationRef = createPendingActivationRef(target)
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
    expect(pendingActivationRef.current).toEqual(target)
  })

  it('waits for an explicit end activation target before scheduling readiness checks', () => {
    const pendingActivationRef = createPendingActivationRef(null)
    const onActivate = vi.fn()

    const { unmount } = renderHook(() =>
      useDeferredRichEmbedActivation({
        pendingActivationRef,
        editable: true,
        isReady: () => true,
        onActivate,
      }),
    )

    expect(requestAnimationFrameSpy).not.toHaveBeenCalled()

    unmount()
    pendingActivationRef.current = { kind: 'end' }
    renderHook(() =>
      useDeferredRichEmbedActivation({
        pendingActivationRef,
        editable: true,
        isReady: () => true,
        onActivate,
      }),
    )

    act(() => {
      queuedFrames.shift()?.(0)
    })

    expect(onActivate).toHaveBeenCalledWith({ kind: 'end' })
    expect(pendingActivationRef.current).toBeNull()
  })
})

function createPendingActivationRef(
  current: RichEmbedActivationTarget | null,
): PendingRichEmbedActivationRef {
  return { current }
}

function pointActivation(x: number, y: number): RichEmbedActivationTarget {
  return { kind: 'point', payload: { point: { x, y } } }
}
