import { useEffect, useRef } from 'react'
import { captureElementPreview } from '../utils/generate-preview'
import { useClaimAndUploadPreview } from './use-claim-and-upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import type * as Y from 'yjs'
import { logger } from '~/shared/utils/logger'

const DEBOUNCE_MS = 5_000

export function useNotePreview({
  noteId,
  doc,
  editorContainerRef,
}: {
  noteId: Id<'sidebarItems'>
  doc: Y.Doc | null
  editorContainerRef: React.RefObject<HTMLElement | null>
}) {
  const isGeneratingRef = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteIdRef = useRef(noteId)
  noteIdRef.current = noteId

  const claimAndUpload = useClaimAndUploadPreview()
  const claimAndUploadRef = useRef(claimAndUpload)
  claimAndUploadRef.current = claimAndUpload

  useEffect(() => {
    if (!doc) return

    let cancelled = false

    const generate = async () => {
      if (isGeneratingRef.current) return
      const el = editorContainerRef.current
      if (!el) return

      isGeneratingRef.current = true
      try {
        if (cancelled) return
        await claimAndUploadRef.current(noteIdRef.current, () => captureElementPreview(el))
      } catch (error) {
        logger.error('Failed to generate note preview:', error)
      } finally {
        if (!cancelled) isGeneratingRef.current = false
      }
    }

    const scheduleGeneration = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(generate, DEBOUNCE_MS)
    }

    doc.on('update', scheduleGeneration)
    scheduleGeneration()

    return () => {
      cancelled = true
      isGeneratingRef.current = false
      doc.off('update', scheduleGeneration)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, noteId])
}
