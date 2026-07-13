import { describe, expect, it, vi } from 'vite-plus/test'
import { createEmbedSlashMenuItem } from '../embed-slash-menu-item'

describe('embed slash menu item', () => {
  it('replaces the current slash block with an empty embed block', () => {
    const currentBlock = { id: 'paragraph-1', content: [] }
    const editor = {
      getTextCursorPosition: vi.fn(() => ({ block: currentBlock })),
      insertBlocks: vi.fn(),
      replaceBlocks: vi.fn(),
      focus: vi.fn(),
    }

    createEmbedSlashMenuItem(editor as never).onItemClick?.()

    expect(editor.replaceBlocks).toHaveBeenCalledWith(
      [currentBlock],
      [{ type: 'embed', props: { targetKind: 'empty', previewWidth: 480 } }],
    )
    expect(editor.focus).toHaveBeenCalledOnce()
  })

  it('inserts after a paragraph without destroying its content', () => {
    const currentBlock = { id: 'paragraph-1', content: [{ type: 'text', text: 'Keep me' }] }
    const editor = {
      getTextCursorPosition: vi.fn(() => ({ block: currentBlock })),
      insertBlocks: vi.fn(),
      replaceBlocks: vi.fn(),
      focus: vi.fn(),
    }

    createEmbedSlashMenuItem(editor as never).onItemClick?.()

    expect(editor.insertBlocks).toHaveBeenCalledWith(
      [{ type: 'embed', props: { targetKind: 'empty', previewWidth: 480 } }],
      currentBlock,
      'after',
    )
    expect(editor.replaceBlocks).not.toHaveBeenCalled()
  })
})
