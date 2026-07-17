import { describe, expect, it, vi } from 'vite-plus/test'
import { applyCanvasTextDefaultTextColor } from '../text/default-color'

describe('canvas text default color', () => {
  it('materializes inherited text before changing the node default', () => {
    const document = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Inherited', styles: {} },
          { type: 'text', text: 'Explicit', styles: { textColor: 'var(--t-blue)' } },
        ],
      },
    ]
    const addStyles = vi.fn()
    const replaceBlocks = vi.fn()
    const editor = {
      addStyles,
      document,
      focus: vi.fn(),
      replaceBlocks,
    } as unknown as Parameters<typeof applyCanvasTextDefaultTextColor>[0]

    applyCanvasTextDefaultTextColor(editor, 'var(--foreground)', 'var(--t-red)')

    expect(replaceBlocks).toHaveBeenCalledWith(document, [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Inherited',
            styles: { textColor: 'var(--foreground)' },
          },
          {
            type: 'text',
            text: 'Explicit',
            styles: { textColor: 'var(--t-blue)' },
          },
        ],
      },
    ])
    expect(addStyles).toHaveBeenCalledWith({ textColor: 'var(--t-red)' })
  })
})
