import { useEffect } from 'react'
import type { EditorView } from '@tiptap/pm/view'
import {
  editorViewSelectionMatchesPoint,
  focusEditorViewAtEnd,
  focusEditorViewAtNearestPoint,
} from './blocknote-editor-focus'

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
    let releaseSelection: () => void = () => undefined

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
      if (focused && kind === 'point' && pointX !== null && pointY !== null) {
        releaseSelection = retainPointSelectionUntilUserInput(editor, {
          x: pointX,
          y: pointY,
        })
      }
    }

    activate()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      releaseSelection()
    }
  }, [editor, kind, pointX, pointY])
}

function retainPointSelectionUntilUserInput(
  editor: BlockNoteEditorWithView,
  point: Readonly<{ x: number; y: number }>,
) {
  let active = true
  let frame = requestAnimationFrame(restoreSelection)
  const stop = () => {
    if (!active) return
    active = false
    cancelAnimationFrame(frame)
    document.removeEventListener('selectionchange', queueRestore)
    document.removeEventListener('beforeinput', stop, true)
    document.removeEventListener('keydown', stop, true)
    document.removeEventListener('pointerdown', stop, true)
  }
  const queueRestore = () => {
    if (active && frame === 0) frame = requestAnimationFrame(restoreSelection)
  }
  function restoreSelection() {
    frame = 0
    const view = mountedEditorView(editor)
    if (view && !editorViewSelectionMatchesPoint(view, point)) {
      focusEditorViewAtNearestPoint(view, point)
    }
  }
  document.addEventListener('selectionchange', queueRestore)
  document.addEventListener('beforeinput', stop, true)
  document.addEventListener('keydown', stop, true)
  document.addEventListener('pointerdown', stop, true)
  return stop
}

function mountedEditorView(editor: BlockNoteEditorWithView): EditorView | null {
  try {
    const view = editor._tiptapEditor?.view
    return view?.dom.isConnected ? view : null
  } catch {
    return null
  }
}
