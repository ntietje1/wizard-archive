import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useRichEmbedActivation,
  useRichEmbedLifecycle,
  type RichEmbedActivationPayload,
  type RichEmbedLifecycleController,
} from '../useRichEmbedLifecycle'

const { mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
}))

vi.mock('~/shared/utils/logger', () => ({
  logger: {
    warn: (...args: Array<unknown>) => mockLoggerWarn(...args),
  },
}))

describe('useRichEmbedLifecycle', () => {
  let queuedFrames: Array<FrameRequestCallback>
  let requestAnimationFrameSpy: ReturnType<typeof vi.fn>
  let cancelAnimationFrameSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queuedFrames = []
    mockLoggerWarn.mockReset()
    requestAnimationFrameSpy = vi.fn((cb: FrameRequestCallback) => {
      queuedFrames.push(cb)
      return queuedFrames.length
    })
    cancelAnimationFrameSpy = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameSpy)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defers embed activation to the next frame and stores the click point', () => {
    const setEditingEmbedId = vi.fn()
    const { result, unmount } = renderHook(() =>
      useRichEmbedActivation({
        canEdit: true,
        embedId: 'embed-1',
        setEditingEmbedId,
      }),
    )

    act(() => {
      result.current.handleDoubleClick({ clientX: 10, clientY: 20 } as React.MouseEvent)
    })

    expect(result.current.lifecycle.pendingActivationRef.current).toEqual({
      point: { x: 10, y: 20 },
    })
    expect(setEditingEmbedId).not.toHaveBeenCalled()

    act(() => {
      queuedFrames.shift()?.(0)
    })

    expect(setEditingEmbedId).toHaveBeenCalledWith('embed-1')

    unmount()
    expect(result.current.lifecycle.pendingActivationRef.current).toBeNull()
  })

  it('waits for readiness and preserves pending activation until it can activate', () => {
    const lifecycle: RichEmbedLifecycleController = {
      pendingActivationRef: {
        current: { point: { x: 30, y: 40 } } satisfies RichEmbedActivationPayload,
      },
    }
    const onActivate = vi.fn()

    let ready = false
    const { rerender } = renderHook(
      ({ editable }: { editable: boolean }) =>
        useRichEmbedLifecycle({
          lifecycle,
          editable,
          isReady: () => ready,
          onActivate,
        }),
      { initialProps: { editable: true } },
    )

    act(() => {
      for (let i = 0; i <= 10; i += 1) {
        queuedFrames.shift()?.(i)
      }
    })

    expect(onActivate).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'useRichEmbedLifecycle: rich embed did not become ready within retry limit',
    )
    expect(lifecycle.pendingActivationRef.current).toEqual({
      point: { x: 30, y: 40 },
    })

    ready = true
    rerender({ editable: true })

    act(() => {
      queuedFrames.shift()?.(3)
    })

    expect(onActivate).toHaveBeenCalledWith({ point: { x: 30, y: 40 } })
    expect(lifecycle.pendingActivationRef.current).toBeNull()

    rerender({ editable: false })
    expect(lifecycle.pendingActivationRef.current).toBeNull()
  })
})
