import { Selection, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

type BlockNoteEditorFocusPoint = Readonly<{ x: number; y: number }>

export function focusEditorViewAtNearestPoint(
  view: EditorView,
  point: BlockNoteEditorFocusPoint,
): boolean {
  const selection = getSelectionNearestPoint(view, point)
  if (!selection) return false

  try {
    view.dispatch(view.state.tr.setSelection(selection))
  } catch {
    return false
  }
  focusEditorView(view)
  return true
}

export function focusEditorViewAtEnd(view: EditorView): boolean {
  try {
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)))
  } catch {
    return false
  }
  focusEditorView(view)
  return true
}

function getSelectionNearestPoint(view: EditorView, point: BlockNoteEditorFocusPoint) {
  const selection = getSelectionAtPoint(view, point)
  if (selection) return selection

  const clampedPoint = getPointClampedToEditor(view, point)
  if (!clampedPoint || (clampedPoint.x === point.x && clampedPoint.y === point.y)) return null
  return getSelectionAtPoint(view, clampedPoint)
}

function getSelectionAtPoint(view: EditorView, point: BlockNoteEditorFocusPoint) {
  let position: number | null = null
  try {
    const result = view.posAtCoords({ left: point.x, top: point.y })
    position = typeof result?.pos === 'number' ? result.pos : null
  } catch {
    return null
  }
  if (position === null) return null

  try {
    return TextSelection.near(view.state.doc.resolve(position))
  } catch {
    return null
  }
}

function getPointClampedToEditor(view: EditorView, point: BlockNoteEditorFocusPoint) {
  try {
    const rect = view.dom.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: clamp(point.x, rect.left + 1, rect.right - 1),
      y: clamp(point.y, rect.top + 1, rect.bottom - 1),
    }
  } catch {
    return null
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

function focusEditorView(view: EditorView) {
  try {
    view.focus()
  } catch {
    // The selection is still useful when the browser rejects programmatic focus.
  }
}
