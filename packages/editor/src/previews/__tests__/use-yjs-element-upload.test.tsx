import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { useYjsElementPreviewUpload } from '../use-yjs-element-upload'
import type { SidebarItemId } from '../../../../../shared/common/ids'

const capturePreviewSpy = vi.hoisted(() => vi.fn())

vi.mock('../generate', () => ({
  captureElementPreview: capturePreviewSpy,
}))

const itemId = 'item-id' as SidebarItemId

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

describe('useYjsElementPreviewUpload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    capturePreviewSpy.mockReset()
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
      return { status: 'success' as const }
    })

    renderHook(() =>
      useYjsElementPreviewUpload({
        itemId,
        doc,
        containerRef: { current: container },
        previewUpload: { status: 'available', upload: claimAndUpload },
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

  it('clears scheduled work on unmount', async () => {
    const doc = new Y.Doc()
    const claimAndUpload = vi.fn()

    const { unmount } = renderHook(() =>
      useYjsElementPreviewUpload({
        itemId,
        doc,
        containerRef: { current: document.createElement('div') },
        previewUpload: { status: 'available', upload: claimAndUpload },
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

  it('flushes a newer same-document watermark after an in-flight upload settles', async () => {
    const doc = new Y.Doc()
    const container = document.createElement('div')
    const pendingUpload = createDeferred<{ status: 'success' }>()
    const claimAndUpload = vi
      .fn()
      .mockImplementationOnce(() => pendingUpload.promise)
      .mockResolvedValue({ status: 'success' as const })

    renderHook(() =>
      useYjsElementPreviewUpload({
        itemId,
        doc,
        containerRef: { current: container },
        previewUpload: { status: 'available', upload: claimAndUpload },
        resolveElement: (root) => root,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(claimAndUpload).toHaveBeenCalledTimes(1)

    act(() => {
      doc.getMap('nodes').set('during-upload', { value: 2 })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(claimAndUpload).toHaveBeenCalledTimes(1)

    await act(async () => {
      pendingUpload.resolve({ status: 'success' })
      await pendingUpload.promise
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(claimAndUpload).toHaveBeenCalledTimes(2)
  })

  it('does not schedule preview uploads while disabled', async () => {
    const doc = new Y.Doc()
    const claimAndUpload = vi.fn()

    renderHook(() =>
      useYjsElementPreviewUpload({
        itemId,
        doc,
        containerRef: { current: document.createElement('div') },
        previewUpload: { status: 'available', upload: claimAndUpload },
        resolveElement: (container) => container,
        enabled: false,
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

    const { rerender } = renderHook(
      ({ doc }) =>
        useYjsElementPreviewUpload({
          itemId,
          doc,
          containerRef: { current: container },
          previewUpload: { status: 'available', upload: claimAndUpload },
          resolveElement: (root) => root,
        }),
      { initialProps: { doc: firstDoc } },
    )

    act(() => {
      firstDoc.getMap('nodes').set('initial', { value: 1 })
    })

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

  it('allows a new document to generate when a stale in-flight upload never settles', async () => {
    const firstDoc = new Y.Doc()
    const secondDoc = new Y.Doc()
    const container = document.createElement('div')

    const claimAndUpload = vi.fn(
      async (
        _itemId: string,
        _generate: () => Promise<Blob>,
        _options?: { signal?: AbortSignal },
      ) => new Promise<{ status: 'success' }>(() => {}),
    )

    const { rerender } = renderHook(
      ({ doc }) =>
        useYjsElementPreviewUpload({
          itemId,
          doc,
          containerRef: { current: container },
          previewUpload: { status: 'available', upload: claimAndUpload },
          resolveElement: (root) => root,
        }),
      { initialProps: { doc: firstDoc } },
    )

    act(() => {
      firstDoc.getMap('nodes').set('initial', { value: 1 })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(claimAndUpload).toHaveBeenCalledTimes(1)

    rerender({ doc: secondDoc })

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

    const { rerender } = renderHook(
      ({ doc }) =>
        useYjsElementPreviewUpload({
          itemId,
          doc,
          containerRef: { current: container },
          previewUpload: { status: 'available', upload: claimAndUpload },
          resolveElement: (root) => root,
        }),
      { initialProps: { doc: firstDoc } },
    )

    act(() => {
      firstDoc.getMap('nodes').set('initial', { value: 1 })
    })

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
