import { BlockNoteEditor } from '@blocknote/core'

type BlockNoteEditorOptions = NonNullable<Parameters<typeof BlockNoteEditor.create>[0]>

export function createHeadlessBlockNoteEditor(options: Omit<BlockNoteEditorOptions, '_headless'>) {
  return BlockNoteEditor.create({ ...options, _headless: true })
}
