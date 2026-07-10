import { describe, expect, it } from 'vitest'
import { resolveRichTextSelectionTextColor } from '../rich-text-selection-colors'

describe('resolveRichTextSelectionTextColor', () => {
  it('uses the active cursor color when there is no selected text', () => {
    expect(
      resolveRichTextSelectionTextColor({
        activeTextColor: 'var(--t-red)',
        defaultTextColor: 'var(--foreground)',
        hasTextSelection: false,
        selectedBlocks: [],
      }),
    ).toEqual({
      kind: 'value',
      value: { color: 'var(--t-red)', opacity: 100 },
    })
  })

  it('resolves one selected text color through nested inline content', () => {
    expect(
      resolveRichTextSelectionTextColor({
        activeTextColor: null,
        defaultTextColor: 'var(--foreground)',
        hasTextSelection: true,
        selectedBlocks: [
          {
            content: [
              {
                content: [{ text: 'nested', styles: { textColor: 'var(--t-blue)' } }],
              },
            ],
          },
        ],
      }),
    ).toEqual({
      kind: 'value',
      value: { color: 'var(--t-blue)', opacity: 100 },
    })
  })

  it('treats unstyled or empty-color selected text as default text color', () => {
    expect(
      resolveRichTextSelectionTextColor({
        activeTextColor: 'var(--t-red)',
        defaultTextColor: 'var(--foreground)',
        hasTextSelection: true,
        selectedBlocks: [
          {
            content: [{ text: 'unstyled' }, { text: 'empty color', styles: { textColor: '' } }],
          },
        ],
      }),
    ).toEqual({
      kind: 'value',
      value: { color: 'var(--foreground)', opacity: 100 },
    })
  })

  it('reports mixed selected text colors across child blocks', () => {
    expect(
      resolveRichTextSelectionTextColor({
        activeTextColor: null,
        defaultTextColor: 'var(--foreground)',
        hasTextSelection: true,
        selectedBlocks: [
          {
            content: [{ text: 'red', styles: { textColor: 'var(--t-red)' } }],
            children: [
              {
                content: [{ text: 'blue', styles: { textColor: 'var(--t-blue)' } }],
              },
            ],
          },
        ],
      }),
    ).toEqual({ kind: 'mixed' })
  })
})
