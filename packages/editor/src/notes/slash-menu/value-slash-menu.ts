import { generateUuidV7 } from '../../resources/domain-id'
import type { NoteBlockNoteEditor } from '../note-editor-schema'

export function insertNoteValueFromSlashMenu(editor: NoteBlockNoteEditor) {
  const value = {
    type: 'value' as const,
    props: { valueId: generateUuidV7(), label: 'Value', expressionSource: '0' },
  }
  if (replaceActiveSlashQuery(editor, value)) return
  editor.insertInlineContent([value], { updateSelection: true })
}

function replaceActiveSlashQuery(
  editor: NoteBlockNoteEditor,
  value: { type: 'value'; props: { valueId: string; label: string; expressionSource: string } },
) {
  const tiptap = editor._tiptapEditor
  const view = tiptap?.view
  if (!tiptap || !view) return false

  const { selection } = view.state
  if (!selection.empty) return false

  const selectionPosition = selection.$from
  const textBeforeCursor = selectionPosition.parent.textBetween(
    0,
    selectionPosition.parentOffset,
    '',
    '\uFFFC',
  )
  const slashIndex = textBeforeCursor.lastIndexOf('/')
  if (slashIndex === -1) return false

  const query = textBeforeCursor.slice(slashIndex + 1)
  if (query.includes(' ') || query.includes('\n')) return false

  const from = selectionPosition.start() + slashIndex
  tiptap.chain().focus().setTextSelection({ from, to: selection.from }).run()
  editor.insertInlineContent([value], { updateSelection: true })
  return true
}
