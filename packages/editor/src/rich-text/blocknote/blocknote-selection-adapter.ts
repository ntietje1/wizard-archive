import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Selection } from '@tiptap/pm/state'

export type BlockNoteSelectionSnapshot = Record<string, unknown>

type BlockNoteFocusableEditor = {
  focus: () => void
  prosemirrorView?: BlockNoteEditorView | null
}

interface BlockNoteEditorView {
  dom?: HTMLElement
  dispatch: (transaction: unknown) => void
  focus: () => void
  state: {
    doc: ProseMirrorNode
    selection: {
      toJSON: () => BlockNoteSelectionSnapshot
    }
    tr: {
      setSelection: (selection: Selection) => unknown
    }
  }
}

export function captureBlockNoteSelection(
  editor: BlockNoteFocusableEditor | null,
): BlockNoteSelectionSnapshot | null {
  const view = getBlockNoteEditorView(editor)
  if (!view) return null

  try {
    return view.state.selection.toJSON()
  } catch {
    return null
  }
}

export function restoreBlockNoteSelection(
  editor: BlockNoteFocusableEditor,
  selectionSnapshot: BlockNoteSelectionSnapshot | null,
) {
  const view = getBlockNoteEditorView(editor)
  if (!view) {
    try {
      editor.focus()
    } catch {
      return
    }
    return
  }

  if (selectionSnapshot) {
    try {
      const nextSelection = Selection.fromJSON(view.state.doc, selectionSnapshot)
      view.dispatch(view.state.tr.setSelection(nextSelection))
    } catch {
      // Selection snapshots can become stale after document edits; keep focus on
      // the editor and fall back to the current ProseMirror selection.
    }
  }

  try {
    view.focus()
  } catch {
    return
  }
}

export function blockNoteSelectionSnapshotCollapsedPosition(
  selectionSnapshot: BlockNoteSelectionSnapshot | null,
) {
  if (!selectionSnapshot) {
    return null
  }

  const { anchor, head } = selectionSnapshot as { anchor?: unknown; head?: unknown }
  return typeof anchor === 'number' && typeof head === 'number' && anchor === head ? anchor : null
}

export function setBlockNotePendingTextColor(
  editor: BlockNoteFocusableEditor | null,
  textColor: string | null,
) {
  const editorElement = getBlockNoteEditorElement(editor)
  if (!editorElement) {
    return
  }

  if (textColor) {
    editorElement.style.setProperty('--formatting-pending-text-color', textColor)
    return
  }

  editorElement.style.removeProperty('--formatting-pending-text-color')
}

function getBlockNoteEditorView(
  editor: BlockNoteFocusableEditor | null,
): BlockNoteEditorView | null {
  let view: BlockNoteEditorView | null | undefined
  try {
    view = editor?.prosemirrorView
  } catch {
    return null
  }
  return view && typeof view === 'object' ? view : null
}

function getBlockNoteEditorElement(editor: BlockNoteFocusableEditor | null): HTMLElement | null {
  const view = getBlockNoteEditorView(editor)
  if (!view) {
    return null
  }

  try {
    return view.dom ?? null
  } catch {
    return null
  }
}
