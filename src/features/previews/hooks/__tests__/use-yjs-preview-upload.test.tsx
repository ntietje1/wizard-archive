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
    expect(claimAndUpload).toHaveBeenCalledWith('item-id', expect.any(Function))
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
})
