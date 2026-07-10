import type { NoteBlockId } from '../document/model'
import type { useNoteEditorStore } from '../editor-store'

type ActiveNoteEditor = ReturnType<typeof useNoteEditorStore.getState>['editor']

export function findNoteBlockElementInEditor(
  editor: ActiveNoteEditor,
  noteBlockId: NoteBlockId,
): HTMLElement | null {
  const editorRoot = editor?._tiptapEditor?.view.dom
  if (!editorRoot) return null

  return editorRoot.querySelector<HTMLElement>(`[data-id="${CSS.escape(noteBlockId)}"]`)
}
