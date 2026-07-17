import { useEffect } from 'react'
import type { EditorView } from '@tiptap/pm/view'
import { focusEditorViewAtEnd, focusEditorViewAtNearestPoint } from './blocknote-editor-focus'

export type BlockNoteActivation =
  | Readonly<{ kind: 'end' }>
  | Readonly<{ kind: 'point'; point: Readonly<{ x: number; y: number }> }>

type BlockNoteEditorWithView = Readonly<{
  _tiptapEditor?: Readonly<{ view?: EditorView | null }>
}>

const MAX_MOUNT_RETRIES = 10

export function useBlockNoteActivation(
  editor: BlockNoteEditorWithView,
  activation: BlockNoteActivation | null,
) {
  const kind = activation?.kind ?? null
  const pointX = activation?.kind === 'point' ? activation.point.x : null
  const pointY = activation?.kind === 'point' ? activation.point.y : null
  useEffect(() => {
    if (!kind) return
    let cancelled = false
    let frame = 0
    let retries = 0

    const activate = () => {
      if (cancelled) return
      const view = mountedEditorView(editor)
      if (!view) {
        retries += 1
        if (retries <= MAX_MOUNT_RETRIES) frame = requestAnimationFrame(activate)
        return
      }
      const focused =
        kind === 'point' && pointX !== null && pointY !== null
          ? focusEditorViewAtNearestPoint(view, { x: pointX, y: pointY }) ||
            focusEditorViewAtEnd(view)
          : focusEditorViewAtEnd(view)
      if (!focused) console.warn('BlockNote editor activation failed')
    }

    frame = requestAnimationFrame(activate)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [editor, kind, pointX, pointY])
}

function mountedEditorView(editor: BlockNoteEditorWithView): EditorView | null {
  try {
    const view = editor._tiptapEditor?.view
    return view?.dom.isConnected ? view : null
  } catch {
    return null
  }
}
