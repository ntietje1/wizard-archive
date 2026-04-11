import { useEffect, useRef } from 'react'
import { captureElementPreview } from '../utils/generate-preview'
import { useClaimAndUploadPreview } from './use-claim-and-upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import type * as Y from 'yjs'
import { logger } from '~/shared/utils/logger'

const DEBOUNCE_MS = 5_000

export function useCanvasPreview({
  canvasId,
  doc,
  containerRef,
}: {
  canvasId: Id<'sidebarItems'>
  doc: Y.Doc
  containerRef: React.RefObject<HTMLElement | null>
}) {
  const isGeneratingRef = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasIdRef = useRef(canvasId)
  canvasIdRef.current = canvasId

  const claimAndUpload = useClaimAndUploadPreview()
  const claimAndUploadRef = useRef(claimAndUpload)
  claimAndUploadRef.current = claimAndUpload

  useEffect(() => {
    const generate = async () => {
      if (isGeneratingRef.current) return
      const el = containerRef.current
      if (!el) return

      isGeneratingRef.current = true
      try {
        await claimAndUploadRef.current(canvasIdRef.current, () => captureElementPreview(el))
      } catch (error) {
        logger.error(`Canvas preview generation failed for ${canvasIdRef.current}:`, error)
      } finally {
        isGeneratingRef.current = false
      }
    }

    const scheduleGeneration = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(generate, DEBOUNCE_MS)
    }

    doc.on('update', scheduleGeneration)
    scheduleGeneration()

    return () => {
      doc.off('update', scheduleGeneration)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, canvasId])
}
