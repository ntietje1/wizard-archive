import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Selection } from '@tiptap/pm/state'
import { logger } from '~/shared/utils/logger'

export type BlockNoteSelectionSnapshot = Record<string, unknown>

type BlockNoteFocusableEditor = {
  focus: () => void
  prosemirrorView?: BlockNoteEditorView | null
}

type BlockNoteStyleReader = {
  getActiveStyles: () => Record<string, unknown>
}

interface BlockNoteEditorView {
  dom?: HTMLElement
  dispatch: (transaction: unknown) => void
  focus: () => void
  state: {
    doc: unknown
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
  return getBlockNoteEditorView(editor)?.state.selection.toJSON() ?? null
}

export function restoreBlockNoteSelection(
  editor: BlockNoteFocusableEditor,
  selectionSnapshot: BlockNoteSelectionSnapshot | null,
) {
  const view = getBlockNoteEditorView(editor)
  if (!view) {
    editor.focus()
    return
  }

  if (selectionSnapshot) {
    try {
      const nextSelection = Selection.fromJSON(view.state.doc as ProseMirrorNode, selectionSnapshot)
      view.dispatch(view.state.tr.setSelection(nextSelection))
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.debug(
          'Failed to restore selection from snapshot, falling back to current editor selection',
          error,
        )
      }
    }
  }

  view.focus()
}

export function readBlockNoteActiveStyles<TStyle extends string>(
  editor: BlockNoteStyleReader,
): Partial<Record<TStyle, boolean>> {
  return editor.getActiveStyles() as Partial<Record<TStyle, boolean>>
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
  const editorElement = getBlockNoteEditorView(editor)?.dom
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
  const view = editor?.prosemirrorView
  return view && typeof view === 'object' ? view : null
}
