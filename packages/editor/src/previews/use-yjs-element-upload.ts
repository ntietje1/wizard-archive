import type { ResourceId } from '../resources/domain-id'
import { useEffect, useRef } from 'react'
import { captureElementPreview } from './generate'
import type { PreviewUploadCapability } from '../files/preview-upload-contract'

import type * as Y from 'yjs'

const DEFAULT_DEBOUNCE_MS = 5_000

type PreviewFlushState =
  | { status: 'idle' }
  | { status: 'flushing'; targetWatermark: number; promise: Promise<void> }

type PreviewGenerationState = {
  dirtyWatermark: number
  flushedWatermark: number
  timer: ReturnType<typeof setTimeout> | null
  flush: PreviewFlushState
}

export function useYjsElementPreviewUpload({
  itemId,
  doc,
  containerRef,
  previewUpload,
  resolveElement,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  enabled = true,
}: {
  itemId: ResourceId
  doc: Y.Doc | null
  containerRef: React.RefObject<HTMLElement | null>
  previewUpload: PreviewUploadCapability
  resolveElement: (container: HTMLElement) => HTMLElement | null
  debounceMs?: number
  enabled?: boolean
}) {
  const subscriptionIdRef = useRef(0)
  const itemIdRef = useRef(itemId)
  itemIdRef.current = itemId
  const resolveElementRef = useRef(resolveElement)
  resolveElementRef.current = resolveElement

  const previewUploadRef = useRef(previewUpload)
  previewUploadRef.current = previewUpload

  useEffect(() => {
    if (!enabled || !doc || previewUpload.status !== 'available') {
      return
    }

    const subscriptionId = subscriptionIdRef.current + 1
    subscriptionIdRef.current = subscriptionId
    const subscriptionAbortController = new AbortController()
    let cancelled = false
    const state: PreviewGenerationState = {
      dirtyWatermark: 0,
      flushedWatermark: 0,
      timer: null,
      flush: { status: 'idle' },
    }

    const isActive = () => !cancelled && subscriptionIdRef.current === subscriptionId

    const flush = () => {
      if (!isActive()) return
      if (state.flush.status === 'flushing') return state.flush.promise
      if (state.dirtyWatermark <= state.flushedWatermark) return
      const container = containerRef.current
      if (!container) return

      const element = resolveElementRef.current(container)
      if (!element) return

      const generatingItemId = itemIdRef.current
      const targetWatermark = state.dirtyWatermark
      const promise = Promise.resolve().then(async () => {
        try {
          const currentPreviewUpload = previewUploadRef.current
          if (currentPreviewUpload.status !== 'available') return

          const result = await currentPreviewUpload.upload(
            generatingItemId,
            () => captureElementPreview(element),
            { signal: subscriptionAbortController.signal },
          )
          if (result.status === 'error') {
            console.error(`Preview generation failed for ${generatingItemId}:`, result.error)
          }
        } catch (error) {
          console.error(`Preview generation failed for ${generatingItemId}:`, error)
        } finally {
          const completedWatermark =
            state.flush.status === 'flushing' ? state.flush.targetWatermark : targetWatermark
          state.flushedWatermark = Math.max(state.flushedWatermark, completedWatermark)
          state.flush = { status: 'idle' }
          if (isActive() && state.dirtyWatermark > state.flushedWatermark) {
            scheduleGeneration(0)
          }
        }
      })
      state.flush = { status: 'flushing', targetWatermark, promise }
      return promise
    }

    function scheduleGeneration(delay = debounceMs) {
      if (!isActive()) return
      if (state.timer) {
        clearTimeout(state.timer)
      }
      state.timer = setTimeout(() => {
        state.timer = null
        void flush()
      }, delay)
    }

    const markDirty = () => {
      if (!isActive()) return
      state.dirtyWatermark += 1
      scheduleGeneration()
    }

    doc.on('update', markDirty)
    markDirty()

    return () => {
      cancelled = true
      subscriptionAbortController.abort()
      subscriptionIdRef.current += 1
      doc.off('update', markDirty)
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = null
      }
    }
  }, [containerRef, debounceMs, doc, enabled, previewUpload.status])
}
