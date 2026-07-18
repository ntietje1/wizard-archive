import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { useResourcePreviewPublication } from '../use-resource-preview-publication'
import { assertVersionStamp } from '../component-version'

const capturePreview = vi.hoisted(() => vi.fn())

vi.mock('../resource-preview-generation', () => ({
  captureElementPreview: capturePreview,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

function previewElement() {
  const element = window.document.createElement('div')
  Object.defineProperties(element, {
    clientWidth: { value: 320 },
    clientHeight: { value: 180 },
  })
  return element
}

describe('useResourcePreviewPublication', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    capturePreview.mockReset()
    capturePreview.mockResolvedValue(new Blob(['preview'], { type: 'image/webp' }))
  })

  afterEach(() => vi.useRealTimers())

  it('debounces Yjs changes, flushes canonical content, then captures the resolved element', async () => {
    const document = new Y.Doc()
    const container = previewElement()
    const target = previewElement()
    container.appendChild(target)
    const order: Array<string> = []
    const prepare = vi.fn(() => {
      order.push('prepare')
      return Promise.resolve({
        status: 'completed' as const,
        version: assertVersionStamp({
          scheme: 'authoritative-revision-v1' as const,
          revision: 2,
          digest: '0'.repeat(64),
        }),
      })
    })
    const publish = vi.fn(async (_resourceId, generate: () => Promise<Blob>) => {
      order.push('publish')
      await generate()
      return { status: 'published' as const }
    })

    renderHook(() =>
      useResourcePreviewPublication({
        binding: {
          gateway: { publish },
          prepare,
          resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
        },
        containerRef: { current: container },
        document,
        enabled: true,
        resolveElement: () => target,
      }),
    )
    act(() => {
      document.getMap('content').set('first', 1)
      document.getMap('content').set('second', 2)
    })
    await act(async () => vi.advanceTimersByTimeAsync(5_000))

    expect(order).toEqual(['prepare', 'publish'])
    expect(publish).toHaveBeenCalledOnce()
    expect(capturePreview).toHaveBeenCalledWith(target)
  })

  it('does not publish content that could not be canonically flushed', async () => {
    const publish = vi.fn()
    renderHook(() =>
      useResourcePreviewPublication({
        binding: {
          gateway: { publish },
          prepare: () => Promise.resolve({ status: 'rejected', reason: 'content_corrupt' }),
          resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
        },
        containerRef: { current: previewElement() },
        document: new Y.Doc(),
        enabled: true,
        resolveElement: (container) => container,
      }),
    )
    await act(async () => vi.advanceTimersByTimeAsync(5_000))

    expect(publish).not.toHaveBeenCalled()
    expect(capturePreview).not.toHaveBeenCalled()
  })

  it('publishes a newer watermark after an in-flight publication settles', async () => {
    const document = new Y.Doc()
    const pending = deferred<{ status: 'published' }>()
    const publish = vi
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue({ status: 'published' })
    renderHook(() =>
      useResourcePreviewPublication({
        binding: {
          gateway: { publish },
          prepare: () =>
            Promise.resolve({
              status: 'completed',
              version: assertVersionStamp({
                scheme: 'authoritative-revision-v1',
                revision: 1,
                digest: '0'.repeat(64),
              }),
            }),
          resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
        },
        containerRef: { current: previewElement() },
        document,
        enabled: true,
        resolveElement: (container) => container,
      }),
    )
    await act(async () => vi.advanceTimersByTimeAsync(5_000))
    expect(publish).toHaveBeenCalledOnce()

    act(() => {
      document.getMap('content').set('newer', true)
    })
    await act(async () => vi.advanceTimersByTimeAsync(5_000))
    expect(publish).toHaveBeenCalledOnce()
    await act(async () => {
      pending.resolve({ status: 'published' })
      await pending.promise
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('cancels scheduled and in-flight publication when the editor unmounts', async () => {
    const signal = vi.fn()
    const publish = vi.fn(async (_resourceId, _generate, abort?: AbortSignal) => {
      signal(abort)
      return await new Promise<{ status: 'stale' }>(() => undefined)
    })
    const { unmount } = renderHook(() =>
      useResourcePreviewPublication({
        binding: {
          gateway: { publish },
          prepare: () =>
            Promise.resolve({
              status: 'completed',
              version: assertVersionStamp({
                scheme: 'authoritative-revision-v1',
                revision: 1,
                digest: '0'.repeat(64),
              }),
            }),
          resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
        },
        containerRef: { current: previewElement() },
        document: new Y.Doc(),
        enabled: true,
        resolveElement: (container) => container,
      }),
    )
    await act(async () => vi.advanceTimersByTimeAsync(5_000))
    const abort = signal.mock.calls[0]?.[0] as AbortSignal | undefined
    expect(abort?.aborted).toBe(false)
    unmount()
    expect(abort?.aborted).toBe(true)
  })
})
