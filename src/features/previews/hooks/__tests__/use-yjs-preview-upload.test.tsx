import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useYjsPreviewUpload } from '../use-yjs-preview-upload'
import { testId } from '~/test/helpers/test-id'

const capturePreviewSpy = vi.hoisted(() => vi.fn())
const claimAndUploadHookSpy = vi.hoisted(() => vi.fn())

vi.mock('~/features/previews/utils/generate-preview', () => ({
  captureElementPreview: capturePreviewSpy,
}))

vi.mock('~/features/previews/hooks/use-claim-and-upload-preview', () => ({
  useClaimAndUploadPreview: claimAndUploadHookSpy,
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

describe('useYjsPreviewUpload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    capturePreviewSpy.mockReset()
    claimAndUploadHookSpy.mockReset()
    capturePreviewSpy.mockResolvedValue(new Blob(['preview']))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces Yjs updates and captures the resolved element', async () => {
    const doc = new Y.Doc()
    const container = document.createElement('div')
    const target = document.createElement('div')
    target.className = 'preview-target'
    container.appendChild(target)

    const claimAndUpload = vi.fn(async (_itemId: string, generate: () => Promise<Blob>) => {
      await generate()
      return { status: 'success' }
    })
    claimAndUploadHookSpy.mockReturnValue(claimAndUpload)

    renderHook(() =>
      useYjsPreviewUpload({
        itemId: testId<'sidebarItems'>('item-id'),
        doc,
        containerRef: { current: container },
        resolveElement: (root) => {
          const element = root.querySelector('.preview-target')
          return element instanceof HTMLElement ? element : null
        },
      }),
    )

    act(() => {
      doc.getMap('nodes').set('a', { value: 1 })
      doc.getMap('nodes').set('b', { value: 2 })
    })

    expect(claimAndUpload).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(claimAndUpload).toHaveBeenCalledTimes(1)
    expect(claimAndUpload).toHaveBeenCalledWith('item-id', expect.any(Function), {
      signal: expect.any(AbortSignal),
    })
    expect(capturePreviewSpy).toHaveBeenCalledTimes(1)
    expect(capturePreviewSpy).toHaveBeenCalledWith(target)
  })

  it('skips generation when the capture element cannot be resolved', async () => {
    const doc = new Y.Doc()
    const claimAndUpload = vi.fn()
    claimAndUploadHookSpy.mockReturnValue(claimAndUpload)

    renderHook(() =>
      useYjsPreviewUpload({
        itemId: testId<'sidebarItems'>('item-id'),
        doc,
        containerRef: { current: document.createElement('div') },
        resolveElement: () => null,
      }),
    )

    act(() => {
      doc.getMap('nodes').set('a', { value: 1 })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(claimAndUpload).not.toHaveBeenCalled()
    expect(capturePreviewSpy).not.toHaveBeenCalled()
  })

  it('clears scheduled work on unmount', async () => {
    const doc = new Y.Doc()
    const claimAndUpload = vi.fn()
    claimAndUploadHookSpy.mockReturnValue(claimAndUpload)

    const { unmount } = renderHook(() =>
      useYjsPreviewUpload({
        itemId: testId<'sidebarItems'>('item-id'),
        doc,
        containerRef: { current: document.createElement('div') },
        resolveElement: (container) => container,
      }),
    )

    act(() => {
      doc.getMap('nodes').set('a', { value: 1 })
    })

    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(claimAndUpload).not.toHaveBeenCalled()
    expect(capturePreviewSpy).not.toHaveBeenCalled()
  })

  it('allows a new document to generate after a stale in-flight upload settles', async () => {
    const firstDoc = new Y.Doc()
    const secondDoc = new Y.Doc()
    const container = document.createElement('div')
    const target = document.createElement('div')
    container.appendChild(target)
    const pendingUpload = createDeferred<{ status: 'success' }>()

    const claimAndUpload = vi.fn(
      async (
        _itemId: string,
        _generate: () => Promise<Blob>,
        _options?: { signal?: AbortSignal },
      ) => pendingUpload.promise,
    )
    claimAndUploadHookSpy.mockReturnValue(claimAndUpload)

    const { rerender } = renderHook(
      ({ doc }) =>
        useYjsPreviewUpload({
          itemId: testId<'sidebarItems'>('item-id'),
          doc,
          containerRef: { current: container },
          resolveElement: (root) => root,
        }),
      { initialProps: { doc: firstDoc } },
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(claimAndUpload).toHaveBeenCalledTimes(1)

    rerender({ doc: secondDoc })

    await act(async () => {
      pendingUpload.resolve({ status: 'success' })
      await pendingUpload.promise
      await Promise.resolve()
    })

    act(() => {
      secondDoc.getMap('nodes').set('after-swap', { value: 1 })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(claimAndUpload).toHaveBeenCalledTimes(2)
  })

  it('aborts stale preview uploads when the Yjs document changes', async () => {
    const firstDoc = new Y.Doc()
    const secondDoc = new Y.Doc()
    const container = document.createElement('div')
    const pendingUpload = createDeferred<{ status: 'stale' }>()

    const claimAndUpload = vi.fn(
      async (
        _itemId: string,
        _generate: () => Promise<Blob>,
        _options?: { signal?: AbortSignal },
      ) => pendingUpload.promise,
    )
    claimAndUploadHookSpy.mockReturnValue(claimAndUpload)

    const { rerender } = renderHook(
      ({ doc }) =>
        useYjsPreviewUpload({
          itemId: testId<'sidebarItems'>('item-id'),
          doc,
          containerRef: { current: container },
          resolveElement: (root) => root,
        }),
      { initialProps: { doc: firstDoc } },
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    const firstOptions = claimAndUpload.mock.calls[0]?.[2]
    const firstSignal = firstOptions?.signal
    expect(firstSignal).toBeInstanceOf(AbortSignal)
    if (!firstSignal) throw new Error('Expected preview upload signal')
    expect(firstSignal.aborted).toBe(false)

    rerender({ doc: secondDoc })

    expect(firstSignal.aborted).toBe(true)

    await act(async () => {
      pendingUpload.resolve({ status: 'stale' })
      await pendingUpload.promise
      await Promise.resolve()
    })
  })
})
