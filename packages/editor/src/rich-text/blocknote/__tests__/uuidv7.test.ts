import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, it } from 'vite-plus/test'
import { isUuidV7 } from '../../../resources/domain-id'
import { destroyBlockNoteEditor } from '../destroy-blocknote-editor'
import { configureBlockNoteUuidV7 } from '../uuidv7'

describe('BlockNote UUIDv7 generation', () => {
  it('assigns UUIDv7 IDs to initial and inserted blocks', () => {
    configureBlockNoteUuidV7()
    const editor = BlockNoteEditor.create()

    try {
      expect(isUuidV7(editor.document[0]!.id), editor.document[0]!.id).toBe(true)
      const [inserted] = editor.insertBlocks([{ type: 'paragraph' }], editor.document[0]!, 'after')
      expect(isUuidV7(inserted!.id)).toBe(true)
    } finally {
      destroyBlockNoteEditor(editor)
    }
  })
})
