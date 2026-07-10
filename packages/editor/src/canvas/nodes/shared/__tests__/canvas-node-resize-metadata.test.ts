import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createCanvasNodeResizeMetadataStore,
  useCanvasNodeResizeMetadataSnapshot,
  useRegisterCanvasNodeResizeMetadata,
} from '../canvas-node-resize-metadata'
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

  it('keeps a newer registration when the same metadata object is registered again', () => {
    const store = createCanvasNodeResizeMetadataStore()
    const metadata: CanvasNodeResizeMetadata = {
      dragging: false,
      minHeight: 30,
      minWidth: 50,
      resizeAxes: 'both',
    }

    const cleanupOriginal = store.register('node-1', metadata)
    store.register('node-1', metadata)
    cleanupOriginal()

    expect(store.getSnapshot().get('node-1')).toBe(metadata)
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

describe('canvas node resize metadata hooks', () => {
  it('requires a metadata provider for node registration', () => {
    expect(() => render(createElement(RegisterMetadataProbe))).toThrow(
      'Canvas node resize metadata provider is missing',
    )
  })

  it('requires a metadata provider for snapshot reads', () => {
    expect(() => render(createElement(ReadMetadataProbe))).toThrow(
      'Canvas node resize metadata provider is missing',
    )
  })
})

function RegisterMetadataProbe() {
  useRegisterCanvasNodeResizeMetadata('node-1', {
    dragging: false,
    minHeight: 30,
    minWidth: 50,
    resizeAxes: 'both',
  })
  return null
}

function ReadMetadataProbe() {
  useCanvasNodeResizeMetadataSnapshot()
  return null
}
