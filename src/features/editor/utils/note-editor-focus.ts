import { Selection, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

type NoteEditorFocusPoint = { x: number; y: number }

export function focusEditorViewAtNearestPoint(view: EditorView, point: NoteEditorFocusPoint) {
  const selection = getSelectionNearestPoint(view, point)
  if (!selection) {
    return false
  }

  try {
    const tr = view.state.tr.setSelection(selection)
    view.dispatch(tr)
    view.focus()
    return true
  } catch {
    return false
  }
}

export function focusEditorViewAtEnd(view: EditorView) {
  try {
    const selection = Selection.atEnd(view.state.doc)
    const tr = view.state.tr.setSelection(selection)
    view.dispatch(tr)
    view.focus()
    return true
  } catch {
    return false
  }
}

function getSelectionNearestPoint(view: EditorView, point: NoteEditorFocusPoint) {
  const selection = getSelectionAtPoint(view, point)
  if (selection) {
    return selection
  }

  const clampedPoint = getPointClampedToEditor(view, point)
  if (!clampedPoint || (clampedPoint.x === point.x && clampedPoint.y === point.y)) {
    return null
  }

  return getSelectionAtPoint(view, clampedPoint)
}

function getSelectionAtPoint(view: EditorView, point: NoteEditorFocusPoint) {
  const pos = getPositionAtPoint(view, point)
  if (pos === null) {
    return null
  }

  try {
    return TextSelection.near(view.state.doc.resolve(pos))
  } catch {
    return null
  }
}

function getPositionAtPoint(view: EditorView, point: NoteEditorFocusPoint) {
  try {
    const result = view.posAtCoords({ left: point.x, top: point.y })
    return typeof result?.pos === 'number' ? result.pos : null
  } catch {
    return null
  }
}

function getPointClampedToEditor(view: EditorView, point: NoteEditorFocusPoint) {
  try {
    const rect = view.dom.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }

    return {
      // Keep retried hit tests strictly inside the editor so posAtCoords avoids border edge cases.
      x: clamp(point.x, rect.left + 1, rect.right - 1),
      y: clamp(point.y, rect.top + 1, rect.bottom - 1),
    }
  } catch {
    return null
  }
}

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}
