import { useEffect, useRef } from 'react'
import { captureElementPreview } from '../utils/generate-preview'
import { useClaimAndUploadPreview } from './use-claim-and-upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import type * as Y from 'yjs'

const DEBOUNCE_MS = 5_000

export function useNotePreview({
  noteId,
  doc,
  editorContainerRef,
}: {
  noteId: Id<'notes'>
  doc: Y.Doc
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
    const generate = async () => {
      if (isGeneratingRef.current) return
      const el = editorContainerRef.current
      if (!el) return

      isGeneratingRef.current = true
      try {
        await claimAndUploadRef.current(noteIdRef.current, () =>
          captureElementPreview(el),
        )
      } finally {
        isGeneratingRef.current = false
      }
    }

    const scheduleGeneration = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(generate, DEBOUNCE_MS)
    }

    doc.on('update', scheduleGeneration)

    return () => {
      doc.off('update', scheduleGeneration)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [doc, noteId, editorContainerRef])
}
