import type { NoteBlockId } from '../../resources/domain-id'
import type { NoteBlockNoteEditor } from '../note-editor-schema'

export function getBlockShareTargetIds(
  editor: NoteBlockNoteEditor,
  fallbackBlockId: NoteBlockId | undefined,
): Array<NoteBlockId> {
  const selection = editor.getSelection()
  if (selection && selection.blocks.length > 1) {
    return selection.blocks.map((block) => block.id as NoteBlockId)
  }
  return fallbackBlockId ? [fallbackBlockId] : []
}

export function getBlockShareTitle(blockCount: number) {
  return `Share ${blockCount} ${blockCount === 1 ? 'Block' : 'Blocks'}`
}
