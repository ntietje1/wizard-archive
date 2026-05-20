import { describe, expect, it, vi } from 'vitest'
import { createValueReferenceSlashMenuItem } from '../value-block-slash-menu-item'

describe('value slash menu item', () => {
  it('creates a value with a zero formula by default', () => {
    const block = { content: [] }
    const updateBlock = vi.fn()
    const editor = {
      document: [],
      getTextCursorPosition: () => ({ block }),
      updateBlock,
      setTextCursorPosition: vi.fn(),
      insertInlineContent: vi.fn(),
    }

    createValueReferenceSlashMenuItem(editor as never).onItemClick?.()

    expect(updateBlock).toHaveBeenCalledWith(block, {
      content: [
        {
          type: 'value',
          props: expect.objectContaining({
            slug: 'value',
            expressionSource: '0',
          }),
        },
      ],
    })
  })

  it('replaces the active slash query before inserting a value', () => {
    const selectionRange = vi.fn()
    const run = vi.fn()
    const editor = {
      document: [],
      getTextCursorPosition: vi.fn(),
      updateBlock: vi.fn(),
      setTextCursorPosition: vi.fn(),
      insertInlineContent: vi.fn(),
      _tiptapEditor: {
        view: {
          state: {
            selection: {
              empty: true,
              from: 8,
              $from: {
                parentOffset: 7,
                parent: { textBetween: () => 'text /v' },
                start: () => 1,
              },
            },
          },
        },
        chain: () => ({
          focus: () => ({
            setTextSelection: (range: { from: number; to: number }) => {
              selectionRange(range)
              return { run }
            },
          }),
        }),
      },
    }

    createValueReferenceSlashMenuItem(editor as never).onItemClick?.()

    expect(selectionRange).toHaveBeenCalledWith({ from: 6, to: 8 })
    expect(editor.insertInlineContent).toHaveBeenCalledWith(
      [
        {
          type: 'value',
          props: expect.objectContaining({
            slug: 'value',
            expressionSource: '0',
          }),
        },
      ],
      { updateSelection: true },
    )
    expect(editor.updateBlock).not.toHaveBeenCalled()
  })
})
