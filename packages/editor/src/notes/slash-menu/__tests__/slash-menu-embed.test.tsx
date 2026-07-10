import { describe, expect, it, vi } from 'vite-plus/test'
import { createEmbedSlashMenuItem } from '../embed-slash-menu-item'

describe('embed slash menu item', () => {
  it('replaces the current slash block with an empty embed block', () => {
    const currentBlock = { id: 'paragraph-1' }
    const editor = {
      getTextCursorPosition: vi.fn(() => ({ block: currentBlock })),
      replaceBlocks: vi.fn(),
    }

    createEmbedSlashMenuItem(editor as never).onItemClick?.()

    expect(editor.replaceBlocks).toHaveBeenCalledWith(
      [currentBlock],
      [{ type: 'embed', props: { targetKind: 'empty', previewWidth: 480 } }],
    )
  })
})
