import { describe, expect, it, vi } from 'vitest'
import { createCanvasNodeResizeMetadataStore } from '../canvas-node-resize-metadata'
import type { CanvasNodeResizeMetadata } from '../canvas-node-resize-metadata'

describe('createCanvasNodeResizeMetadataStore', () => {
  it('keeps newer metadata when an older registration cleans up', () => {
    const store = createCanvasNodeResizeMetadataStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const originalMetadata: CanvasNodeResizeMetadata = {
      dragging: false,
      minHeight: 30,
      minWidth: 50,
      resizeAxes: 'both',
    }
    const nextMetadata: CanvasNodeResizeMetadata = {
      dragging: true,
      minHeight: 40,
      minWidth: 60,
      resizeAxes: 'both',
    }

    const cleanupOriginal = store.register('node-1', originalMetadata)
    store.register('node-1', nextMetadata)
    cleanupOriginal()

    expect(store.getSnapshot().get('node-1')).toBe(nextMetadata)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('reuses the empty metadata snapshot after the final registration cleans up', () => {
    const store = createCanvasNodeResizeMetadataStore()
    const emptySnapshot = store.getSnapshot()
    const cleanup = store.register('node-1', {
      dragging: false,
      minHeight: 30,
      minWidth: 50,
      resizeAxes: 'both',
    })

    cleanup()

    expect(store.getSnapshot()).toBe(emptySnapshot)
  })
})
