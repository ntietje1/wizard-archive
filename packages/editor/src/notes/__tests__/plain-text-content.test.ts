import { describe, expect, it } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { createPlainTextNoteContent } from '../imported-text'
import { getVisibleNoteBlocks } from '../visibility'
import type { NoteBlock } from '../document/model'
import type { NoteItemWithContent } from '../item-contract'

describe('createPlainTextNoteContent', () => {
  it('projects plain text into editable note content with full-access block metadata', () => {
    const noteContent = createPlainTextNoteContent({
      text: ['A waterfront bazaar.', '', '- Ask Mara about the blue-glass shipment.'].join('\n'),
      fileName: 'session-notes.txt',
    })

    expect(noteContent.content).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [expect.objectContaining({ text: 'A waterfront bazaar.' })],
      }),
      expect.objectContaining({
        type: 'paragraph',
        content: [expect.objectContaining({ text: '- Ask Mara about the blue-glass shipment.' })],
      }),
    ])
    expect(Object.keys(noteContent.blockMeta)).toEqual(collectBlockIds(noteContent.content))
    expect(Object.values(noteContent.blockMeta)).toEqual(
      collectBlockIds(noteContent.content).map(() =>
        expect.objectContaining({
          myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
          shareStatus: 'not_shared',
          sharedWith: [],
        }),
      ),
    )
  })

  it('creates metadata for nested imported markdown blocks', () => {
    const noteContent = createPlainTextNoteContent({
      text: ['- Visit the harbor', '  - Ask Mara about the blue-glass shipment'].join('\n'),
      fileName: 'session-notes.md',
      mimeType: 'text/markdown',
    })
    const blockIds = collectBlockIds(noteContent.content)

    expect(noteContent.content[0]?.children).toHaveLength(1)
    expect(Object.keys(noteContent.blockMeta)).toEqual(blockIds)
    expect(
      getVisibleNoteBlocks(
        {
          ...noteContent,
          name: 'Session Notes',
        } as NoteItemWithContent,
        {
          getMemberItemPermissionLevel: () => PERMISSION_LEVEL.NONE,
          viewAsPlayerId: undefined,
        },
      ),
    ).toEqual(noteContent.content)
  })
})

function collectBlockIds(blocks: ReadonlyArray<NoteBlock>): Array<string> {
  return blocks.flatMap((block) => [block.id, ...collectBlockIds(block.children ?? [])])
}
