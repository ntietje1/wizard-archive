import { BlockNoteEditor } from '@blocknote/core'
import { configureBlockNoteUuidV7 } from '../../rich-text/blocknote/uuidv7'

type BlockNoteEditorOptions = NonNullable<Parameters<typeof BlockNoteEditor.create>[0]>

export function createHeadlessBlockNoteEditor(options: Omit<BlockNoteEditorOptions, '_headless'>) {
  configureBlockNoteUuidV7()
  return BlockNoteEditor.create({ ...options, _headless: true })
}
