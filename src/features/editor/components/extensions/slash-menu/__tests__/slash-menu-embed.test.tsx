import { describe, expect, it, vi } from 'vitest'
import { createEmbedSlashMenuItem } from '../embed-slash-menu-item'

describe('embed slash menu item', () => {
  it('inserts an empty embed block after the current block', () => {
    const currentBlock = { id: 'paragraph-1' }
    const editor = {
      getTextCursorPosition: vi.fn(() => ({ block: currentBlock })),
      insertBlocks: vi.fn(),
    }

    createEmbedSlashMenuItem(editor as never).onItemClick?.()

    expect(editor.insertBlocks).toHaveBeenCalledWith(
      [{ type: 'embed', props: { targetKind: 'empty' } }],
      currentBlock,
      'after',
    )
  })
})
