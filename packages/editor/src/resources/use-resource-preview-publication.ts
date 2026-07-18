import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type * as Y from 'yjs'
import type { ContentSessionSaveResult } from './content-session-contract'
import type { ResourcePreviewPublicationGateway } from './editor-runtime-contract'
import type { ResourceId } from './domain-id'
import { captureElementPreview } from './resource-preview-generation'

const DEFAULT_PREVIEW_DEBOUNCE_MS = 5_000

export type ResourcePreviewPublicationBinding = Readonly<{
  gateway: ResourcePreviewPublicationGateway
  prepare: () => Promise<ContentSessionSaveResult>
  resourceId: ResourceId
}>

type FlushState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'flushing'; targetWatermark: number; promise: Promise<void> }>

export function useResourcePreviewPublication({
  binding,
  containerRef,
  debounceMs = DEFAULT_PREVIEW_DEBOUNCE_MS,
  document,
  enabled,
  resolveElement,
}: {
  binding: ResourcePreviewPublicationBinding | null
  containerRef: RefObject<HTMLElement | null>
  debounceMs?: number
  document: Y.Doc
  enabled: boolean
  resolveElement: (container: HTMLElement) => HTMLElement | null
}) {
  const resolveElementRef = useRef(resolveElement)
  resolveElementRef.current = resolveElement
  const gateway = binding?.gateway
  const prepare = binding?.prepare
  const resourceId = binding?.resourceId

  useEffect(() => {
    if (!enabled || !gateway || !prepare || !resourceId) return
    const abort = new AbortController()
    let active = true
    let dirtyWatermark = 0
    let flushedWatermark = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let flushState: FlushState = { status: 'idle' }

    const schedule = (delay = debounceMs) => {
      if (!active) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void flush()
      }, delay)
    }
    const flush = () => {
      if (!active) return
      if (flushState.status === 'flushing') return flushState.promise
      if (dirtyWatermark <= flushedWatermark) return
      const targetWatermark = dirtyWatermark
      const promise = Promise.resolve().then(async () => {
        try {
          const prepared = await prepare()
          if (!active || prepared.status !== 'completed') return
          const container = containerRef.current
          if (!container) return
          const element = resolveElementRef.current(container)
          if (!element || element.clientWidth <= 0 || element.clientHeight <= 0) return
          await gateway.publish(resourceId, () => captureElementPreview(element), abort.signal)
        } finally {
          const completedWatermark =
            flushState.status === 'flushing' ? flushState.targetWatermark : targetWatermark
          flushedWatermark = Math.max(flushedWatermark, completedWatermark)
          flushState = { status: 'idle' }
          if (active && dirtyWatermark > flushedWatermark) schedule(0)
        }
      })
      flushState = { status: 'flushing', targetWatermark, promise }
      return promise
    }
    const markDirty = () => {
      if (!active) return
      dirtyWatermark += 1
      schedule()
    }

    document.on('update', markDirty)
    markDirty()
    return () => {
      active = false
      abort.abort()
      document.off('update', markDirty)
      if (timer) clearTimeout(timer)
    }
  }, [containerRef, debounceMs, document, enabled, gateway, prepare, resourceId])
}
