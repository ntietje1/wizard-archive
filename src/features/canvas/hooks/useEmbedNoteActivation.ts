import { useCallback, useEffect, useRef } from 'react'

interface UseEmbedNoteActivationOptions {
  canEdit: boolean
  embedId: string
  setEditingEmbedId: (id: string | null) => void
}

export function useEmbedNoteActivation({
  canEdit,
  embedId,
  setEditingEmbedId,
}: UseEmbedNoteActivationOptions) {
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const activateEditFrameRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (activateEditFrameRef.current !== null) {
        cancelAnimationFrame(activateEditFrameRef.current)
      }
    }
  }, [])

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit) return

      clickCoordsRef.current = { x: e.clientX, y: e.clientY }
      if (activateEditFrameRef.current !== null) {
        cancelAnimationFrame(activateEditFrameRef.current)
      }
      // handleDoubleClick stores clickCoordsRef, cancels activateEditFrameRef, and defers setEditingEmbedId to the next paint so the embed's visual mode switch settles before editor activation.
      activateEditFrameRef.current = requestAnimationFrame(() => {
        activateEditFrameRef.current = null
        setEditingEmbedId(embedId)
      })
    },
    [canEdit, embedId, setEditingEmbedId],
  )

  return { clickCoordsRef, handleDoubleClick }
}
