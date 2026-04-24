import { useEffect, useRef } from 'react'
import { captureElementPreview } from '../utils/generate-preview'
import { useClaimAndUploadPreview } from './use-claim-and-upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import type * as Y from 'yjs'
import { logger } from '~/shared/utils/logger'

const DEFAULT_DEBOUNCE_MS = 5_000

export function useYjsPreviewUpload({
  itemId,
  doc,
  containerRef,
  resolveElement,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: {
  itemId: Id<'sidebarItems'>
  doc: Y.Doc | null
  containerRef: React.RefObject<HTMLElement | null>
  resolveElement: (container: HTMLElement) => HTMLElement | null
  debounceMs?: number
}) {
  const isGeneratingRef = useRef(false)
  const generationIdRef = useRef(0)
  const subscriptionIdRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemIdRef = useRef(itemId)
  itemIdRef.current = itemId
  const resolveElementRef = useRef(resolveElement)
  resolveElementRef.current = resolveElement

  const claimAndUpload = useClaimAndUploadPreview()
  const claimAndUploadRef = useRef(claimAndUpload)
  claimAndUploadRef.current = claimAndUpload

  useEffect(() => {
    if (!doc) {
      return
    }

    const subscriptionId = subscriptionIdRef.current + 1
    subscriptionIdRef.current = subscriptionId
    let cancelled = false

    const generate = async () => {
      if (cancelled || isGeneratingRef.current || subscriptionIdRef.current !== subscriptionId) {
        return
      }

      const container = containerRef.current
      if (!container) {
        return
      }

      const element = resolveElementRef.current(container)
      if (!element) {
        return
      }

      const generatingItemId = itemIdRef.current
      const generationId = generationIdRef.current + 1
      generationIdRef.current = generationId
      isGeneratingRef.current = true
      try {
        await claimAndUploadRef.current(generatingItemId, () => captureElementPreview(element))
      } catch (error) {
        logger.error(`Preview generation failed for ${generatingItemId}:`, error)
      } finally {
        if (!cancelled && generationIdRef.current === generationId) {
          isGeneratingRef.current = false
        }
      }
    }

    const scheduleGeneration = () => {
      if (subscriptionIdRef.current !== subscriptionId) {
        return
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        void generate()
      }, debounceMs)
    }

    doc.on('update', scheduleGeneration)
    scheduleGeneration()

    return () => {
      cancelled = true
      subscriptionIdRef.current += 1
      doc.off('update', scheduleGeneration)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [containerRef, debounceMs, doc])
}
