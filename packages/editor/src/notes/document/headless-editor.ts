import { BlockNoteEditor } from '@blocknote/core'
import { createBlockNoteUuidV7Extension } from '../../rich-text/blocknote/uuidv7'

type BlockNoteEditorOptions = NonNullable<Parameters<typeof BlockNoteEditor.create>[0]>

export function createHeadlessBlockNoteEditor(options: Omit<BlockNoteEditorOptions, '_headless'>) {
  const { disableExtensions = [], extensions = [], ...editorOptions } = options
  return BlockNoteEditor.create({
    ...editorOptions,
    disableExtensions: [...disableExtensions, 'uniqueID'],
    extensions: [createBlockNoteUuidV7Extension(options.setIdAttribute ?? false), ...extensions],
    _headless: true,
  })
}
