import { useEffect } from 'react'
import { TextSelection } from '@tiptap/pm/state'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Doc } from 'yjs'
import { logger } from '~/shared/utils/logger'

// getMountedView checks editor._tiptapEditor?.view and its internal docView so we only touch a fully mounted EditorView; this relies on TipTap 3.18.0 / ProseMirror 1.38.1 internals.
function getMountedView(editor: CustomBlockNoteEditor) {
  const view = editor._tiptapEditor?.view
  const docView = (view as unknown as { docView?: object | null })?.docView
  if (!view?.dom?.isConnected || !docView) {
    return null
  }
  return view
}

interface UseEmbedNoteFocusSyncOptions {
  editor: CustomBlockNoteEditor | null
  editable: boolean
  doc: Doc | null
  clickCoordsRef: React.RefObject<{ x: number; y: number } | null>
}

export function useEmbedNoteFocusSync({
  editor,
  editable,
  doc,
  clickCoordsRef,
}: UseEmbedNoteFocusSyncOptions) {
  useEffect(() => {
    if (!editable) {
      clickCoordsRef.current = null
    }
  }, [editable, clickCoordsRef])

  useEffect(() => {
    if (!editor || !editable || !doc) return

    let rafId: number | null = null
    let retries = 0
    let cancelled = false
    const MAX_MOUNT_RETRIES = 10

    const syncFocus = () => {
      if (cancelled) return

      const view = getMountedView(editor)
      if (!view) {
        retries += 1
        if (retries > MAX_MOUNT_RETRIES) {
          logger.warn(
            'useEmbedNoteFocusSync: editor view did not mount within retry limit',
          )
          return
        }
        rafId = requestAnimationFrame(syncFocus)
        return
      }

      const coords = clickCoordsRef.current
      if (coords) {
        try {
          const pos = view.posAtCoords({ left: coords.x, top: coords.y })
          if (pos) {
            const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, pos.pos))
            view.dispatch(tr)
          }
        } catch (error) {
          logger.warn(
            'useEmbedNoteFocusSync: failed to compute selection from posAtCoords/TextSelection.create',
            error,
          )
        }
        clickCoordsRef.current = null
      }

      view.focus()
    }

    rafId = requestAnimationFrame(syncFocus)
    return () => {
      cancelled = true
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [clickCoordsRef, doc, editable, editor])
}
