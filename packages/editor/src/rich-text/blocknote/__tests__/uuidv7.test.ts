import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, it } from 'vite-plus/test'
import { destroyHeadlessBlockNoteEditor } from '../../../notes/document/headless-editor-cleanup'
import { DOMAIN_ID_KIND, generateDomainId, isUuidV7 } from '../../../resources/domain-id'
import { createBlockNoteUuidV7Extension } from '../uuidv7'

describe('canonical BlockNote identity', () => {
  it('replaces identities injected outside the configured generator', () => {
    const editor = BlockNoteEditor.create({
      initialContent: [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: 'Original',
        },
      ],
      disableExtensions: ['uniqueID'],
      extensions: [createBlockNoteUuidV7Extension(false)],
    })
    const element = document.createElement('div')
    document.body.append(element)
    try {
      editor.mount(element)
      editor.insertBlocks(
        [
          {
            id: '8cfa1d7a-b6fd-4e17-ba3d-c06c373de3ba',
            type: 'paragraph',
            content: 'Injected',
          },
        ],
        editor.document[0]!,
        'after',
      )
      expect(editor.document.every((block) => isUuidV7(block.id))).toBe(true)
    } finally {
      editor.unmount()
      element.remove()
      destroyHeadlessBlockNoteEditor(editor)
    }
  })
})
